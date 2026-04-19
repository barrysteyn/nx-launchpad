export const isJsonObjectOrArray = (val: unknown): val is Record<string, unknown> | unknown[] =>
  typeof val === 'object' && val !== null;

export const chunkArray = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
