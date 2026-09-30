# Local Lean 4 + Mathlib checking service for the V3 Experiments module.
# Serves POST /check {code} -> {success, errors, sorryCount}; see server.py.
FROM ubuntu:24.04

# Mathlib tags track Lean releases 1:1; the Lean toolchain is read from the
# tag's own lean-toolchain file so the two can never drift apart.
ARG MATHLIB_REF=v4.34.1

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git python3 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --shell /bin/bash lean

USER lean
ENV HOME=/home/lean \
    ELAN_HOME=/home/lean/.elan \
    PATH=/home/lean/.elan/bin:$PATH
WORKDIR /home/lean/checker

RUN curl -sSfL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh \
 | sh -s -- -y --no-modify-path --default-toolchain none

# `lake exe cache get` downloads prebuilt Mathlib .olean files instead of
# compiling Mathlib from source (hours) — the compressed archives are deleted
# afterwards to keep the image smaller.
RUN set -eux; \
    printf 'name = "checker"\n\n[[require]]\nname = "mathlib"\ngit = "https://github.com/leanprover-community/mathlib4.git"\nrev = "%s"\n' "${MATHLIB_REF}" > lakefile.toml; \
    curl -sSfL "https://raw.githubusercontent.com/leanprover-community/mathlib4/${MATHLIB_REF}/lean-toolchain" > lean-toolchain; \
    lake update; \
    lake exe cache get; \
    rm -rf "${HOME}/.cache/mathlib"

# Fail the build now, not on the first request, if the Mathlib cache didn't unpack.
RUN printf 'import Mathlib\ntheorem smoke (n : Nat) : n + 0 = n := by simp\n' > /tmp/Smoke.lean \
 && lake env lean /tmp/Smoke.lean \
 && rm /tmp/Smoke.lean

# The persistent Lean REPL the server drives. Built against the project's exact
# toolchain (the nearest repl tag may target a slightly older patch release).
ARG REPL_REF=v4.34.0
RUN set -eux; \
    git clone --depth 1 --branch "${REPL_REF}" https://github.com/leanprover-community/repl.git /home/lean/repl; \
    cp /home/lean/checker/lean-toolchain /home/lean/repl/lean-toolchain; \
    cd /home/lean/repl; \
    lake build; \
    test -x .lake/build/bin/repl

COPY --chown=lean:lean server.py /home/lean/server.py

ENV PORT=8765 \
    LEAN_PROJECT_DIR=/home/lean/checker
EXPOSE 8765
CMD ["python3", "/home/lean/server.py"]
