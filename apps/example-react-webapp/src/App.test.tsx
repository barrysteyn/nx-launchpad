import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouterProvider } from '@tanstack/react-router';
import { createAppRouter } from './router.tsx';

describe('App', () => {
  it('renders heading', async () => {
    render(<RouterProvider router={createAppRouter()} />);
    await waitFor(() =>
      expect(screen.getByRole('heading')).toBeInTheDocument(),
    );
  });
});
