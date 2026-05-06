interface HeroProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
}

export function Hero({ title, subtitle, ctaText, ctaHref }: HeroProps) {
  return (
    <section className="py-24 px-6 text-center">
      <h1 className="text-5xl font-bold tracking-tight">{title}</h1>
      <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
      <a
        href={ctaHref}
        className="mt-10 inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        {ctaText}
      </a>
    </section>
  );
}
