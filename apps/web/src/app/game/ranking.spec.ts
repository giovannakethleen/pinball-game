import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRanking, saveScore, sortRanking } from './ranking';

describe('ranking', () => {
  const storedValues = new Map<string, string>();
  const storage = {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => storedValues.set(key, value),
    clear: () => storedValues.clear(),
  };

  beforeEach(() => {
    storedValues.clear();
    vi.stubGlobal('localStorage', storage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('orders by descending score, breaks ties by earlier date and keeps ten entries', () => {
    const scores = Array.from({ length: 12 }, (_, index) => ({
      name: `player${index}`,
      score: index === 11 ? 500 : 100,
      date: index,
    }));

    const result = sortRanking(scores);

    expect(result[0]?.score).toBe(500);
    expect(result[1]?.name).toBe('player0');
    expect(result).toHaveLength(10);
  });

  it('preserves local storage and the existing player-name fallback', () => {
    const result = saveScore('   ', 250);

    expect(result[0]?.name).toBe('Astronauta');
    expect(loadRanking()).toEqual(result);
  });
});
