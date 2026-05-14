const regexSpecials = /[.+?^${}()|[\]\\/]/g;

function compilePattern(pattern: string): (origin: string) => boolean {
  if (!pattern.includes('*')) return (origin) => origin === pattern;
  const escaped = pattern
    .split('*')
    .map((s) => s.replace(regexSpecials, '\\$&'))
    .join('[^/]*');
  const re = new RegExp(`^${escaped}$`);
  return (origin) => re.test(origin);
}

const matcherCache = new Map<string, (origin: string) => boolean>();

export function getOriginMatcher(raw: string): (origin: string) => boolean {
  const cached = matcherCache.get(raw);
  if (cached) return cached;
  const matchers = raw.split(',').filter(Boolean).map(compilePattern);
  const fn = (origin: string) => matchers.some((m) => m(origin));
  matcherCache.set(raw, fn);
  return fn;
}
