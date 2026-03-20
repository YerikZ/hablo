"use client";

import { useState } from "react";

export function ForgotPasswordForm() {
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestToken(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIssuedToken(null);
    setExpiresAt(null);
    setLoading(true);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });

    const data = await response.json().catch(() => ({ error: "Request failed" }));
    if (!response.ok) {
      setError(data.error || "Failed to request reset token");
      setLoading(false);
      return;
    }

    setMessage(data.message || "Reset token generated.");
    if (data.resetToken) setIssuedToken(data.resetToken);
    if (data.expiresAt) setExpiresAt(data.expiresAt);
    setLoading(false);
  }

  async function confirmReset(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/auth/reset-password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword })
    });

    const data = await response.json().catch(() => ({ error: "Request failed" }));
    if (!response.ok) {
      setError(data.error || "Failed to reset password");
      setLoading(false);
      return;
    }

    setMessage("Password reset successful. You can now log in with the new password.");
    setToken("");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <form onSubmit={requestToken} className="card space-y-3 p-4">
        <h1 className="text-xl font-semibold">Forgot password</h1>
        <p className="text-sm text-slate-600">Step 1: request a one-time reset token using your username.</p>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Please wait..." : "Generate reset token"}
        </button>
        {issuedToken ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="mb-1 font-semibold">Reset token</p>
            <p className="break-all">{issuedToken}</p>
            {expiresAt ? <p className="mt-1">Expires: {new Date(expiresAt).toLocaleString()}</p> : null}
          </div>
        ) : null}
      </form>

      <form onSubmit={confirmReset} className="card space-y-3 p-4">
        <h2 className="font-semibold">Reset with token</h2>
        <p className="text-sm text-slate-600">Step 2: paste the token and set your new password.</p>
        <textarea
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Reset token"
          rows={3}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Please wait..." : "Reset password"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
    </div>
  );
}
