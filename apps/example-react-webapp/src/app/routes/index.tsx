import { createFileRoute } from '@tanstack/react-router';
import { authClient, AUTH_URL } from '../lib/auth-client';

export const Route = createFileRoute('/')({
  component: HomePage,
  staticData: { isPublic: true },
});

function HomePage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  async function handleSignOut() {
    await authClient.signOut();
    if (AUTH_URL) {
      window.location.href = `${AUTH_URL}/login`;
    }
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
