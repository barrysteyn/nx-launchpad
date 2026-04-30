import { createRootRoute, Outlet } from '@tanstack/react-router';
import { NavBar } from '../components/nav/NavBar';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
