import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '../../src/app/routeTree.gen';

const mockToken = vi.fn();
vi.mock('../../src/app/lib/auth-client', () => ({
  authClient: {
    token: () => mockToken(),
    signIn: { email: vi.fn(), magicLink: vi.fn() },
  },
}));

function renderAtPath(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history });
  return render(<RouterProvider router={router} />);
}

describe('Callback route', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  it('shows loading state while fetching token', async () => {
    mockToken.mockImplementation(() => new Promise(() => {}));
    renderAtPath('/callback?redirect_uri=https://app.nimrox.ai');
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('redirects to redirect_uri with token on success', async () => {
    mockToken.mockResolvedValue({ data: { token: 'jwt-abc123' }, error: null });
    renderAtPath('/callback?redirect_uri=https://app.nimrox.ai/dashboard');

    await waitFor(() => {
      expect(window.location.href).toBe(
        'https://app.nimrox.ai/dashboard?token=jwt-abc123',
      );
    });
  });

  it('shows error when token fetch fails', async () => {
    mockToken.mockResolvedValue({ data: null, error: { message: 'Session expired' } });
    renderAtPath('/callback');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
