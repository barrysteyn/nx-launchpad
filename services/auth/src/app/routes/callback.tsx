import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { authClient } from '../lib/auth-client';

type CallbackSearch = { redirect_uri?: string };

export const Route = createFileRoute('/callback')({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    redirect_uri:
      typeof search.redirect_uri === 'string' ? search.redirect_uri : undefined,
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const search = useSearch({ from: '/callback' });
  const [error, setError] = useState('');

  useEffect(() => {
    authClient.token().then(({ data, error: err }) => {
      if (err || !data?.token) {
        setError(err?.message ?? 'Failed to retrieve token. Please sign in again.');
        return;
      }
      const base = search.redirect_uri ?? '/';
      const separator = base.includes('?') ? '&' : '?';
      window.location.href = `${base}${separator}token=${data.token}`;
    });
  }, [search.redirect_uri]);

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
        <p role="alert" className="text-sm text-red-600">{error}</p>
        <a href="/login" className="text-blue-600 hover:underline text-sm">
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-24">
      <div role="status" aria-label="Loading" className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
