"use client";

import { useState } from "react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "signup" | "forgot";
  onAuthSuccess?: (user: { name: string; email: string }) => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
  onAuthSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Simulate API call
    setTimeout(() => {
      if (mode === "forgot") {
        setMessage("Password reset link sent to your email!");
        setLoading(false);
        setTimeout(() => {
          onClose();
          setEmail("");
          setPassword("");
          setName("");
          setMessage("");
        }, 1500);
      } else {
        setMessage(`${mode === "login" ? "Login" : "Sign up"} successful!`);
        setLoading(false);

        // Call onAuthSuccess with user data
        const userData = {
          name: mode === "signup" ? name : email.split("@")[0],
          email: email,
        };

        setTimeout(() => {
          if (onAuthSuccess) {
            onAuthSuccess(userData);
          }
          onClose();
          setEmail("");
          setPassword("");
          setName("");
          setMessage("");
        }, 1500);
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {mode === "login" && "Welcome Back"}
            {mode === "signup" && "Create Account"}
            {mode === "forgot" && "Reset Password"}
          </h2>
          <p className="text-gray-600">
            {mode === "login" && "Sign in to access your research"}
            {mode === "signup" && "Start mapping evidence today"}
            {mode === "forgot" && "We'll send you a reset link"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          )}

          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              <>
                {mode === "login" && "Sign In"}
                {mode === "signup" && "Create Account"}
                {mode === "forgot" && "Send Reset Link"}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          {mode === "login" && (
            <>
              <button
                onClick={() => setMode("forgot")}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot password?
              </button>
              <p className="mt-2 text-gray-600">
                Don't have an account?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign up
                </button>
              </p>
            </>
          )}

          {mode === "signup" && (
            <p className="text-gray-600">
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign in
              </button>
            </p>
          )}

          {mode === "forgot" && (
            <p className="text-gray-600">
              Remember your password?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
