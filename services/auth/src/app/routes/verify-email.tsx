import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const { error: err } = await authClient.sendVerificationEmail({
      email,
      callbackURL: '/callback',
    });
    if (err) setError(err.message ?? 'Failed to resend');
    else setSent(true);
  }

  return (
    <div className="bg-white rounded-xl shadow p-8 space-y-6 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
      <p className="text-sm text-gray-500">
        Check your inbox for a verification link. If you didn't receive it, enter your email below to resend.
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {sent ? (
        <p className="text-sm text-green-600">Verification email sent!</p>
      ) : (
        <form onSubmit={handleResend} className="space-y-4 text-left">
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
            Resend verification email
          </button>
        </form>
      )}
    </div>
  );
}
