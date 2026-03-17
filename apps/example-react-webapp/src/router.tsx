import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import { RootLayout } from './routes/__root';
import { HomePage } from './routes/index';
import { AboutPage } from './routes/about';

export function createAppRouter() {
  const rootRoute = createRootRoute({ component: RootLayout });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomePage,
  });

  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/about',
    component: AboutPage,
  });

  const routeTree = rootRoute.addChildren([indexRoute, aboutRoute]);
  return createRouter({ routeTree });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
