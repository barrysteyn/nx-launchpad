import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ADMIN_ROLE } from '@nx-launchpad/auth-browser';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/admin')({
  component: AdminPage,
});

function AdminPage() {
  const { data: session } = authClient.useSession();
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const role = session?.user.role;

  async function callAdminEndpoint() {
    setLoading(true);
    setResult(null);
    setStatus(null);
    try {
      const { data: token } = await authClient.token();
      const response = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus(response.status);
      setResult(JSON.stringify(await response.json(), null, 2));
    } catch (err) {
      setResult(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 max-w-lg mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">Admin Demo</h1>

      {role && (
        <div
          className={`w-full rounded-lg border p-4 text-sm ${role === ADMIN_ROLE ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'}`}
        >
          <p className="font-medium text-gray-600">Your role (from session)</p>
          <p
            className={`text-lg font-bold mt-1 ${role === ADMIN_ROLE ? 'text-green-700' : 'text-yellow-700'}`}
          >
            {role}
          </p>
        </div>
      )}

      <div className="w-full">
        <p className="text-sm text-gray-500 mb-3">
          Click below to call{' '}
          <code className="bg-gray-100 px-1 rounded">/api/admin</code>. The
          server checks <code className="bg-gray-100 px-1 rounded">role</code>{' '}
          from the verified JWT and returns <strong>403</strong> for non-admins.
        </p>
        <button
          onClick={callAdminEndpoint}
          disabled={loading}
          className="w-full rounded bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Calling…' : 'Call /api/admin'}
        </button>
      </div>

      {result !== null && (
        <div
          className={`w-full rounded-lg border p-4 text-sm font-mono whitespace-pre ${status === 200 ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800'}`}
        >
          <p className="font-sans font-medium mb-2">HTTP {status}</p>
          {result}
        </div>
      )}
    </div>
  );
}
