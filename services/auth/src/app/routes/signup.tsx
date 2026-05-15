import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/signup')({
  component: SignupPage,
});

function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const { error: err } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: '/',
    });
    if (err) setError(err.message ?? 'Sign-up failed');
    else setDone(true);
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl shadow p-8 text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Check your inbox</h1>
        <p className="text-sm text-gray-500">
          We sent a verification email to <strong>{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 text-center">
        Create account
      </h1>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          Create account
        </button>
        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:underline">
            Sign in
          </a>
        </p>
      </form>
    </div>
  );
}
