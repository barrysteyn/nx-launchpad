import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Hero } from '../src/components/Hero';

describe('Hero', () => {
  it('renders the title', () => {
    render(
      <Hero
        title="Test Title"
        subtitle="Test subtitle"
        ctaText="Click me"
        ctaHref="/about"
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Test Title',
    );
  });

  it('renders the CTA link with correct href', () => {
    render(
      <Hero title="Title" subtitle="Subtitle" ctaText="Go" ctaHref="/about" />,
    );
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute(
      'href',
      '/about',
    );
  });
});

describe('FeatureCard', () => {
  it('renders title and description', async () => {
    const { FeatureCard } = await import('../src/components/FeatureCard');
    render(
      <FeatureCard title="My Feature" description="Does something useful" />,
    );
    expect(screen.getByText('My Feature')).toBeInTheDocument();
    expect(screen.getByText('Does something useful')).toBeInTheDocument();
  });
});
