import { createRootRoute, Outlet, useMatches } from '@tanstack/react-router';
import { NavBar } from '../components/nav/NavBar';
import { useToken } from '@nx-launchpad/auth-browser';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    isPublic?: boolean;
  }
}

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const token = useToken();
  const matches = useMatches();
  const isPublic = matches.some((m) => m.staticData?.isPublic);

  if (import.meta.env.VITE_AUTH_URL && !isPublic && !token) {
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
