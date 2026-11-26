import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadWhenIdle, staleBuildReloadAllowed } from '../lazyPage';

describe('staleBuildReloadAllowed', () => {
  const now = 1_800_000_000_000;

  it('permet le rechargement quand il n’y en a jamais eu', () => {
    expect(staleBuildReloadAllowed(null, now)).toBe(true);
  });

  it('le refuse dans la minute qui suit un rechargement, pour ne pas boucler', () => {
    expect(staleBuildReloadAllowed(String(now - 5_000), now)).toBe(false);
    expect(staleBuildReloadAllowed(String(now - 60_000), now)).toBe(false);
  });

  it('le permet de nouveau passé une minute', () => {
    expect(staleBuildReloadAllowed(String(now - 60_001), now)).toBe(true);
  });

  it('ignore une valeur enregistrée illisible', () => {
    expect(staleBuildReloadAllowed('pas-un-nombre', now)).toBe(true);
  });
});

describe('preloadWhenIdle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('charge les modules un par un, dans l’ordre, et continue après un échec', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const loader = (name: string, fails = false) => () => {
      calls.push(name);
      return fails ? Promise.reject(new Error('réseau')) : Promise.resolve(name);
    };

    preloadWhenIdle([loader('a'), loader('b', true), loader('c')], 1000);
    expect(calls).toEqual([]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual(['a']);

    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toEqual(['a', 'b', 'c']);
  });
});
