import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../lib/auth-client';

type LoginSearch = { redirect_uri?: string };

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect_uri:
      typeof search.redirect_uri === 'string' ? search.redirect_uri : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = useSearch({ from: '/login' });
  const [tab, setTab] = useState<'password' | 'magic-link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);

  const callbackURL = search.redirect_uri ?? '/';

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const { error: err } = await authClient.signIn.email({
      email,
      password,
      callbackURL,
    });
    if (err) {
      setError(err.message ?? 'Sign-in failed');
      return;
    }
    window.location.href = callbackURL;
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const { error: err } = await authClient.signIn.magicLink({
      email,
      callbackURL,
    });
    if (err) setError(err.message ?? 'Failed to send magic link');
    else setMagicSent(true);
  }

  return (
    <div className="bg-white rounded-xl shadow p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 text-center">Sign in</h1>

      <div role="tablist" className="flex border-b">
        <button
          role="tab"
          aria-selected={tab === 'password'}
          onClick={() => setTab('password')}
          className={`flex-1 py-2 text-sm font-medium ${tab === 'password' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          Password
        </button>
        <button
          role="tab"
          aria-selected={tab === 'magic-link'}
          onClick={() => setTab('magic-link')}
          className={`flex-1 py-2 text-sm font-medium ${tab === 'magic-link' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
        >
          Magic Link
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {tab === 'password' && (
        <form onSubmit={handlePasswordSignIn} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            Sign in
          </button>
          <p className="text-center text-sm text-gray-500">
            No account?{' '}
            <a href="/signup" className="text-blue-600 hover:underline">
              Sign up
            </a>
          </p>
        </form>
      )}

      {tab === 'magic-link' && !magicSent && (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
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
            Send magic link
          </button>
        </form>
      )}

      {tab === 'magic-link' && magicSent && (
        <div className="text-center space-y-2">
          <p className="text-gray-700 font-medium">Check your inbox</p>
          <p className="text-sm text-gray-500">
            We sent a magic link to <strong>{email}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
