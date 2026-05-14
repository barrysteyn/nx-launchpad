import { describe, expect, it } from 'vitest';
import { pbkdf2Password } from '../../src/worker/password-pbkdf2';

describe('pbkdf2Password', () => {
  it('round-trips: verify returns true for the original password', async () => {
    const hash = await pbkdf2Password.hash('hunter2');
    expect(await pbkdf2Password.verify({ hash, password: 'hunter2' })).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await pbkdf2Password.hash('hunter2');
    expect(await pbkdf2Password.verify({ hash, password: 'hunter3' })).toBe(false);
  });

  it('produces a different hash each call (salted)', async () => {
    const a = await pbkdf2Password.hash('hunter2');
    const b = await pbkdf2Password.hash('hunter2');
    expect(a).not.toBe(b);
  });

  it('rejects a hash without the pbkdf2 prefix', async () => {
    expect(
      await pbkdf2Password.verify({ hash: 'scrypt:abc:def', password: 'x' }),
    ).toBe(false);
  });

  it('rejects a hash with the wrong number of segments', async () => {
    expect(await pbkdf2Password.verify({ hash: 'pbkdf2:only-one', password: 'x' })).toBe(
      false,
    );
  });
});
