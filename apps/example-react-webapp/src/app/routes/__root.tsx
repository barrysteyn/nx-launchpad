import { createRootRoute, Outlet, useMatches } from '@tanstack/react-router';
import { useEffect } from 'react';
import { NavBar } from '../components/nav/NavBar';
import { authClient, AUTH_URL } from '../lib/auth-client';

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
  const needsAuth = !isPending && !isPublic && !session && !!AUTH_URL;

  useEffect(() => {
    if (needsAuth) {
      window.location.href = `${AUTH_URL}/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
  }, [needsAuth]);

  if (isPending || needsAuth) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
