export async function handler(
  _event: Record<string, unknown>,
  _context: Record<string, unknown>,
): Promise<{ statusCode: number; body: string }> {
  return { statusCode: 200, body: 'Hello from example-node-cli!' };
}

export function main(): void {
  console.log('Hello from example-node-cli!');
}

if (require.main === module) {
  main();
}
