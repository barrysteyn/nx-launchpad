import { createRootRoute, Outlet, useMatches } from '@tanstack/react-router';
import { NavBar } from '../components/nav/NavBar';
import { authClient } from '../lib/auth-client';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    isPublic?: boolean;
  }
}

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { data: session, isPending } = authClient.useSession();
  const matches = useMatches();
  const isPublic = matches.some((m) => m.staticData?.isPublic);

  if (isPending) return null;

  if (import.meta.env.VITE_AUTH_URL && !isPublic && !session) {
    window.location.href = `${import.meta.env.VITE_AUTH_URL}/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
