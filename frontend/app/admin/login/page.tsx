"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, forgotPassword, resetPassword, setAdminToken } from "@/lib/admin-api";

type Step = "login" | "forgot-email" | "forgot-code" | "forgot-newpw";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const { token } = await adminLogin(email, password);
      setAdminToken(token);
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSendCode = async () => {
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setStep("forgot-code");
    } catch (err: any) {
      setError(err.message || "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = () => {
    setError("");
    if (resetCode.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setStep("forgot-newpw");
  };

  const handleResetPassword = async () => {
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, resetCode, newPassword);
      setSuccess("Password updated! Redirecting to login…");
      setTimeout(() => {
        setStep("login");
        setPassword("");
        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccess("");
        setError("");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => {
    setStep("login");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  const subtitles: Record<Step, string> = {
    login: "Sign in with your admin credentials",
    "forgot-email": "Enter your admin email to receive a reset code",
    "forgot-code": "Enter the 6-digit code from your email or backend console",
    "forgot-newpw": "Choose a new password for your admin account",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl p-8 w-full max-w-md relative overflow-hidden">
        {/* Gradient glow behind the card */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {step === "login" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                )}
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">
              {step === "login" ? "Admin Access" : "Reset Password"}
            </h1>
            <p className="text-sm text-slate-400 mt-1">{subtitles[step]}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-message-in">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center animate-message-in">
              {success}
            </div>
          )}

          {/* ── LOGIN STEP ─────────────────────────────────────── */}
          {step === "login" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
                <input
                  id="admin-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  onKeyDown={(e) => e.key === "Enter" && document.getElementById("admin-password-input")?.focus()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
                <input
                  id="admin-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              <button
                id="admin-login-btn"
                onClick={handleLogin}
                disabled={loading || !email || !password}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25"
              >
                {loading ? <Spinner label="Signing in…" /> : "Sign In"}
              </button>
              <button
                id="forgot-password-link"
                onClick={() => { setStep("forgot-email"); setError(""); }}
                className="w-full py-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* ── FORGOT: EMAIL STEP ─────────────────────────────── */}
          {step === "forgot-email" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Admin Email</label>
                <input
                  id="forgot-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleForgotSendCode()}
                />
              </div>
              <button
                id="send-reset-code-btn"
                onClick={handleForgotSendCode}
                disabled={loading || !email}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25"
              >
                {loading ? <Spinner label="Sending…" /> : "Send Reset Code"}
              </button>
              <button onClick={backToLogin} className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors">
                ← Back to login
              </button>
            </div>
          )}

          {/* ── FORGOT: CODE STEP ──────────────────────────────── */}
          {step === "forgot-code" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Reset Code</label>
                <input
                  id="reset-code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.5em] font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                  autoFocus
                />
              </div>
              <button
                id="verify-code-btn"
                onClick={handleVerifyCode}
                disabled={resetCode.length !== 6}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25"
              >
                Continue
              </button>
              <button onClick={backToLogin} className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors">
                ← Back to login
              </button>
            </div>
          )}

          {/* ── FORGOT: NEW PASSWORD STEP ──────────────────────── */}
          {step === "forgot-newpw" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">New Password</label>
                <input
                  id="new-password-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Confirm Password</label>
                <input
                  id="confirm-password-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                />
              </div>
              <button
                id="reset-password-btn"
                onClick={handleResetPassword}
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25"
              >
                {loading ? <Spinner label="Updating…" /> : "Update Password"}
              </button>
              <button onClick={backToLogin} className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors">
                ← Back to login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {label}
    </span>
  );
}
