import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useToken, clearToken } from '@nx-launchpad/auth-browser';
import type { AuthPayload } from '@nx-launchpad/auth-browser';
import { fetchApi } from '../services/api';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const token = useToken();
  const [user, setUser] = useState<AuthPayload | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchApi<AuthPayload>('/api/me', token)
      .then(({ data }) => setUser(data))
      .catch(() => {});
  }, [token]);

  function handleSignOut() {
    clearToken();
    window.location.href = import.meta.env.VITE_AUTH_URL
      ? `${import.meta.env.VITE_AUTH_URL}/login`
      : '/';
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <h1 className="text-3xl font-bold text-gray-900">Example Web App</h1>
      {user ? (
        <>
          <p className="text-gray-700">Welcome, {user.name ?? user.email}</p>
          <p className="text-gray-500 text-sm">{user.email}</p>
          <button
            onClick={handleSignOut}
            className="text-sm text-red-600 hover:underline mt-2"
          >
            Sign out
          </button>
        </>
      ) : (
        <p className="text-gray-500">Powered by NX</p>
      )}
    </div>
  );
}
