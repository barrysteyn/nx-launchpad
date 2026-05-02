import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../../lib/auth-client';

type ConfirmSearch = { token?: string };

export const Route = createFileRoute('/reset-password/confirm')({
  validateSearch: (search: Record<string, unknown>): ConfirmSearch => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: ConfirmResetPage,
});

function ConfirmResetPage() {
  const search = useSearch({ from: '/reset-password/confirm' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!search.token) {
      setError('Invalid or missing reset token');
      return;
    }
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token: search.token,
    });
    if (err) setError(err.message ?? 'Failed to reset password');
    else setDone(true);
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Password reset</h1>
        <p className="text-sm text-gray-500">Your password has been updated.</p>
        <a href="/login" className="inline-block text-blue-600 hover:underline text-sm">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 text-center">New password</h1>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">New password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">Confirm password</label>
          <input
            id="confirm"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          Reset password
        </button>
      </form>
    </div>
  );
}
