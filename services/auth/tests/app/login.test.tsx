import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from '../../src/app/routeTree.gen';

vi.mock('../../src/app/lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
      magicLink: vi.fn(),
    },
  },
}));

function renderAtPath(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history });
  return render(<RouterProvider router={router} />);
}

describe('Login page', () => {
  it('renders email and password fields', async () => {
    renderAtPath('/login');
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a magic link tab', async () => {
    renderAtPath('/login');
    expect(await screen.findByRole('tab', { name: /magic link/i })).toBeInTheDocument();
  });
});
