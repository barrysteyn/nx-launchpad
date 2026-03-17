import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
} from '@tanstack/react-router';

export function createAppRouter() {
  const rootRoute = createRootRoute({
    component: () => (
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b bg-white px-6 py-3 flex gap-4">
          <Link to="/" className="text-gray-700 hover:text-gray-900 [&.active]:font-semibold">
            Home
          </Link>
          <Link to="/about" className="text-gray-700 hover:text-gray-900 [&.active]:font-semibold">
            About
          </Link>
        </nav>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    ),
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Example React Webapp</h1>
        <p className="text-gray-500">Powered by TanStack Router</p>
      </div>
    ),
  });

  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/about',
    component: () => (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <h1 className="text-3xl font-bold text-gray-900">About</h1>
        <p className="text-gray-500">This is an example React app using TanStack Router.</p>
      </div>
    ),
  });

  const routeTree = rootRoute.addChildren([indexRoute, aboutRoute]);
  return createRouter({ routeTree });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
