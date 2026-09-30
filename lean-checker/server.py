#!/usr/bin/env python3
"""HTTP wrapper around a persistent Lean REPL for checking Lean 4 + Mathlib source.

POST /check  {"code": "<lean source>"}
          -> {"success": bool, "errors": str, "sorryCount": int, "elapsedMs": int}
GET  /health -> {"ok": true, "ready": bool}

`import Mathlib` costs tens of seconds, so one REPL process imports it once and
every check runs as a command against that base environment (sub-second to a
few seconds). `success` means Lean reported no errors. A proof that still
contains `sorry` compiles with a warning, so it is reported as success=true
with sorryCount > 0 — the caller decides how to treat that.

Security: this executes untrusted Lean source. The denylist below only raises
the bar; the real boundary is the container (non-root, resource limits,
bound to localhost by docker-compose). Do not expose this port publicly.
"""
import json
import os
import queue
import re
import signal
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PROJECT_DIR = os.environ.get("LEAN_PROJECT_DIR", "/home/lean/checker")
REPL_BIN = os.environ.get("REPL_BIN", "/home/lean/repl/.lake/build/bin/repl")
PORT = int(os.environ.get("PORT", "8765"))
CHECK_TIMEOUT_S = int(os.environ.get("CHECK_TIMEOUT_S", "50"))
IMPORT_TIMEOUT_S = int(os.environ.get("IMPORT_TIMEOUT_S", "300"))
# The REPL retains every environment it creates; recycle it before memory grows.
MAX_CMDS_PER_WORKER = int(os.environ.get("MAX_CMDS_PER_WORKER", "100"))
MAX_QUEUED = int(os.environ.get("MAX_QUEUED_CHECKS", "4"))
MAX_CODE_BYTES = 20_000
MAX_ERROR_CHARS = 4_000

slots = threading.BoundedSemaphore(MAX_QUEUED)

# Lean can run arbitrary IO at elaboration time (#eval, run_cmd, elab, ...) and
# custom axioms make any statement "provable". Legitimate LLM-written proofs
# of ordinary math claims need none of these.
FORBIDDEN = re.compile(
    r"#eval|#exit|run_cmd|run_tac|run_elab|\belab\b|elab_rules|\bunsafe\b"
    r"|implemented_by|\bextern\b|initialize|\bIO\b|\bSystem\b|\baxiom\b|\bsorryAx\b"
)
IMPORT_LINE = re.compile(r"^\s*import\s+[\w.«»]+\s*$", re.MULTILINE)
SORRY_WARNING = re.compile(r"declaration uses .?sorry", re.IGNORECASE)


def log(msg: str):
    print(f"[lean-checker] {msg}", flush=True)


def _result(success, errors="", sorry_count=0, started=None):
    return {
        "success": success,
        "errors": errors[:MAX_ERROR_CHARS],
        "sorryCount": sorry_count,
        "elapsedMs": int((time.monotonic() - started) * 1000) if started else 0,
    }


class WorkerTimeout(Exception):
    pass


class WorkerDied(Exception):
    pass


class ReplWorker:
    """One long-lived REPL process with Mathlib imported. Checks are serialized."""

    def __init__(self):
        self.lock = threading.Lock()
        self.ready = threading.Event()
        self.proc = None
        self.responses = None
        self.base_env = None
        self.commands = 0

    def _spawn(self):
        self._kill()
        log("starting Lean REPL and importing Mathlib (slow, once per worker)...")
        started = time.monotonic()
        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": os.environ.get("HOME", "/home/lean"),
            "ELAN_HOME": os.environ.get("ELAN_HOME", "/home/lean/.elan"),
        }
        self.proc = subprocess.Popen(
            ["prlimit", "--fsize=52428800", "--core=0", "--", "lake", "env", REPL_BIN],
            cwd=PROJECT_DIR, env=env, text=True, bufsize=1,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        self.responses = queue.Queue()
        threading.Thread(
            target=self._read_responses, args=(self.proc, self.responses), daemon=True
        ).start()
        resp = self._send({"cmd": "import Mathlib"}, IMPORT_TIMEOUT_S)
        if "env" not in resp:
            raise WorkerDied(f"import Mathlib failed: {resp}")
        self.base_env = resp["env"]
        self.commands = 0
        self.ready.set()
        log(f"Lean REPL ready in {time.monotonic() - started:.1f}s")

    @staticmethod
    def _read_responses(proc, out: "queue.Queue"):
        # The REPL prints one pretty-printed JSON object per response, followed
        # by a blank line; JSON string escapes mean a blank line can't occur inside.
        buf = []
        for line in proc.stdout:
            if line.strip():
                buf.append(line)
            elif buf:
                out.put("".join(buf))
                buf = []
        out.put(None)

    def _send(self, obj: dict, timeout: float) -> dict:
        try:
            self.proc.stdin.write(json.dumps(obj) + "\n\n")
            self.proc.stdin.flush()
        except (BrokenPipeError, OSError):
            raise WorkerDied("Lean REPL process is not running")
        try:
            raw = self.responses.get(timeout=timeout)
        except queue.Empty:
            raise WorkerTimeout()
        if raw is None:
            raise WorkerDied("Lean REPL exited unexpectedly (out of memory?)")
        return json.loads(raw)

    def _kill(self):
        self.ready.clear()
        if self.proc is not None:
            try:
                os.killpg(self.proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            self.proc.wait()
            self.proc = None

    def _ensure_started(self):
        if self.proc is None or self.proc.poll() is not None or self.commands >= MAX_CMDS_PER_WORKER:
            self._spawn()

    def warm(self):
        with self.lock:
            try:
                self._ensure_started()
            except Exception as exc:  # noqa: BLE001 - keep serving; next request retries
                log(f"warm-up failed: {exc!r}")
                self._kill()

    def run(self, code: str) -> dict:
        """Returns the REPL response dict; raises WorkerTimeout / WorkerDied."""
        with self.lock:
            try:
                self._ensure_started()
                resp = self._send({"cmd": code, "env": self.base_env}, CHECK_TIMEOUT_S)
                self.commands += 1
                return resp
            except (WorkerTimeout, WorkerDied):
                self._kill()
                raise


worker = ReplWorker()


def check(code: str) -> dict:
    started = time.monotonic()

    if len(code.encode("utf-8")) > MAX_CODE_BYTES:
        return _result(False, f"Code exceeds {MAX_CODE_BYTES} bytes.", started=started)
    forbidden = FORBIDDEN.search(code)
    if forbidden:
        return _result(
            False,
            f"Rejected by checker policy: `{forbidden.group(0)}` is not allowed "
            "(no IO, #eval, custom axioms, or metaprogramming). Prove the claim "
            "with ordinary Mathlib tactics.",
            started=started,
        )

    # Mathlib is already imported in the base environment, and the REPL only
    # accepts imports on a fresh environment. Blank the lines (not delete them)
    # so reported line numbers still match the code the caller sent.
    code = IMPORT_LINE.sub("", code)

    try:
        resp = worker.run(code)
    except WorkerTimeout:
        return _result(
            False,
            f"Lean check timed out after {CHECK_TIMEOUT_S}s — the proof may be "
            "too expensive; try a simpler approach.",
            started=started,
        )
    except WorkerDied as exc:
        return _result(False, f"Lean worker failure: {exc}", started=started)

    errors, sorry_count = [], 0
    for msg in resp.get("messages", []):
        severity, data = msg.get("severity"), msg.get("data", "")
        if severity == "warning" and SORRY_WARNING.search(data):
            sorry_count += 1
        elif severity == "error":
            pos = msg.get("pos") or {}
            errors.append(f"{pos.get('line', 1)}:{pos.get('column', 0)}: error: {data}")
    if "env" not in resp and resp.get("message"):
        errors.append(str(resp["message"]))

    return _result(not errors, "\n".join(errors), sorry_count, started)


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"ok": True, "ready": worker.ready.is_set()})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path not in ("/", "/check"):
            return self._send(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_CODE_BYTES * 2:
            return self._send(413, {"error": "missing or oversized request body"})
        try:
            code = json.loads(self.rfile.read(length)).get("code")
        except (json.JSONDecodeError, AttributeError):
            return self._send(400, {"error": "body must be JSON: {\"code\": \"...\"}"})
        if not isinstance(code, str) or not code.strip():
            return self._send(400, {"error": "`code` must be a non-empty string"})

        if not slots.acquire(timeout=5):
            return self._send(503, {"error": "checker busy — try again shortly"})
        try:
            self._send(200, check(code))
        finally:
            slots.release()

    def log_message(self, fmt, *args):
        log(f"{self.address_string()} {fmt % args}")


if __name__ == "__main__":
    log(f"listening on :{PORT} (project: {PROJECT_DIR})")
    threading.Thread(target=worker.warm, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
