import { describe, expect, it, vi } from 'vitest';
import { PinballGame, type GameEvents } from './engine';

function createGame(): PinballGame {
  const events: GameEvents = {
    onScore: vi.fn(),
    onBalls: vi.fn(),
    onGameOver: vi.fn(),
    onSound: vi.fn(),
  };
  const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
  return new PinballGame(canvas, events);
}

describe('pinball launch', () => {
  it('launches with enough force even after a quick tap', () => {
    const game = createGame();

    game.setCharging(true);
    game.setCharging(false);

    expect(game.inLane).toBe(false);
    expect(game.vy).toBe(-1200);
  });

  it('uses the full launch force after charging', () => {
    const game = createGame();
    game.charge = 1;

    game.setCharging(true);
    game.setCharging(false);

    expect(game.inLane).toBe(false);
    expect(game.vy).toBe(-2100);
  });

  it('clears the launcher lane with a quick tap', () => {
    const game = createGame();
    game.setCharging(true);
    game.setCharging(false);
    const advance = Reflect.get(game, 'step');

    if (typeof advance !== 'function') throw new Error('Game step function is unavailable');
    for (let frame = 0; frame < 240 && game.by >= 160; frame++) advance.call(game, 1 / 240);

    expect(game.inLane).toBe(false);
    expect(game.by).toBeLessThan(160);
  });

  it('cancels a touch interruption without launching a weak shot', () => {
    const game = createGame();
    game.charge = 0.5;
    game.setCharging(true);

    game.cancelCharging();
    game.setCharging(false);

    expect(game.inLane).toBe(true);
    expect(game.charging).toBe(false);
    expect(game.charge).toBe(0);
    expect(game.vy).toBe(0);
  });

  it('returns a weak shot to the launcher without consuming a ball', () => {
    const game = createGame();
    game.inLane = false;
    game.vy = -900;
    const advance = Reflect.get(game, 'step');

    if (typeof advance !== 'function') throw new Error('Game step function is unavailable');
    for (let frame = 0; frame < 2400 && !game.inLane; frame++) advance.call(game, 1 / 240);

    expect(game.inLane).toBe(true);
    expect(game.balls).toBe(3);
    expect(game.bx).toBe(372);
    expect(game.vy).toBe(0);
  });
});

describe('pinball tracks', () => {
  it('creates the crystal garden with its own aurora lanes and bumpers', () => {
    const events: GameEvents = {
      onScore: vi.fn(),
      onBalls: vi.fn(),
      onGameOver: vi.fn(),
      onSound: vi.fn(),
    };
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    const game = new PinballGame(canvas, events, 'crystal-garden');

    expect(game.track).toBe('crystal-garden');
    expect(game.lanes.map((lane) => lane.ch).join('')).toBe('AURORA');
    expect(game.bumpers).toHaveLength(5);
    expect(game.ramps[0]?.label).toBe('CASCATA DE CRISTAIS');
    expect(game.holes).toEqual([{ x: 200, y: 505 }, { x: 200, y: 34 }]);
  });
});
