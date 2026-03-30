import { describe, it, expect, vi } from 'vitest';
import { main } from '../src/main';

describe('main', () => {
  it('prints hello message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    main();
    expect(spy).toHaveBeenCalledWith('Hello from example-node-cli!');
    spy.mockRestore();
  });
});
