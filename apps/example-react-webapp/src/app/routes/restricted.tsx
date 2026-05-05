import { createFileRoute } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/restricted')({
  component: RestrictedPage,
});

function RestrictedPage() {
  const { data: session } = authClient.useSession();

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <h1 className="text-3xl font-bold text-gray-900">Restricted</h1>
      <p className="text-gray-500">
        You are signed in as{' '}
        <strong>{session?.user.name ?? session?.user.email}</strong>.
      </p>
      <p className="text-gray-400 text-sm">
        This page requires authentication.
      </p>
    </div>
  );
}
