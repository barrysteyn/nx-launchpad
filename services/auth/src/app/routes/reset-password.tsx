import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const { error: err } = await authClient.forgetPassword({
      email,
      redirectTo: '/reset-password/confirm',
    });
    if (err) setError(err.message ?? 'Failed to send reset email');
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="bg-white rounded-xl shadow p-8 text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Check your inbox</h1>
        <p className="text-sm text-gray-500">
          We sent a password reset link to <strong>{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 text-center">Reset password</h1>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          Send reset link
        </button>
        <p className="text-center text-sm">
          <a href="/login" className="text-blue-600 hover:underline">Back to sign in</a>
        </p>
      </form>
    </div>
  );
}
