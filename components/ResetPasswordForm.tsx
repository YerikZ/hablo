"use client";

import { useState } from "react";

export function ResetPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await response.json().catch(() => ({ error: "Request failed" }));

    if (!response.ok) {
      setError(data.error || "Failed to reset password");
      setLoading(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess("Password updated successfully.");
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3 p-4">
      <h2 className="font-semibold">Reset password</h2>
      <p className="text-sm text-slate-600">Use your current password to set a new one.</p>
      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
        type="password"
        placeholder="Current password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
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
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}
      <button className="btn btn-primary" disabled={loading}>
        {loading ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
