import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PinballGame, H, W } from './game/engine';
import { loadRanking, saveScore, type ScoreEntry } from './game/ranking';

type Screen = 'home' | 'game' | 'over' | 'ranking';

const SOUND: Record<string, [number, number]> = {
  bump: [520, 0.08],
  star: [880, 0.15],
  flip: [180, 0.04],
  launch: [300, 0.2],
  lose: [140, 0.4],
  bonus: [1200, 0.4],
};

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) private gameCanvas!: ElementRef<HTMLCanvasElement>;

  protected readonly screen = signal<Screen>('home');
  protected readonly score = signal(0);
  protected readonly multiplier = signal(1);
  protected readonly balls = signal(3);
  protected readonly paused = signal(false);
  protected readonly volume = signal(0.6);
  protected readonly ranking = signal<ScoreEntry[]>([]);
  protected playerName = '';
  protected readonly saved = signal(false);

  private game: PinballGame | null = null;
  private audio: AudioContext | null = null;

  private readonly keyDown = (event: KeyboardEvent) => this.handleKey(event, true);
  private readonly keyUp = (event: KeyboardEvent) => this.handleKey(event, false);
  private readonly windowBlur = () => {
    if (!this.game || this.screen() !== 'game') return;
    this.game.paused = true;
    this.paused.set(true);
  };

  protected readonly width = W;
  protected readonly height = H;

  ngOnInit(): void {
    this.ranking.set(loadRanking());
  }

  ngOnDestroy(): void {
    this.stopGame();
  }

  protected get bestScore(): number {
    return this.ranking()[0]?.score ?? 0;
  }

  protected get displayedRecord(): number {
    return Math.max(this.bestScore, this.score());
  }

  protected get remainingBalls(): string {
    return '⚪'.repeat(Math.max(0, this.balls()));
  }

  protected medal(index: number): string {
    return ['🥇', '🥈', '🥉'][index] ?? `${index + 1}.`;
  }

  protected formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('pt-BR');
  }

  protected setVolume(value: string): void {
    this.volume.set(Number(value));
  }

  protected setScreen(screen: Screen): void {
    if (this.screen() === 'game' && screen !== 'game') this.stopGame();
    if (screen === 'ranking') this.ranking.set(loadRanking());
    this.screen.set(screen);
  }

  protected startGame(): void {
    this.stopGame();
    this.score.set(0);
    this.balls.set(3);
    this.multiplier.set(1);
    this.paused.set(false);
    this.saved.set(false);
    this.screen.set('game');

    const game = new PinballGame(this.gameCanvas.nativeElement, {
      onScore: (score, multiplier) => {
        this.score.set(score);
        this.multiplier.set(multiplier);
      },
      onBalls: (balls) => this.balls.set(balls),
      onGameOver: (score) => {
        this.score.set(score);
        this.saved.set(false);
        window.setTimeout(() => {
          if (this.game !== game || this.screen() !== 'game') return;
          this.stopGame();
          this.screen.set('over');
        }, 600);
      },
      onSound: (kind) => this.beep(kind, this.volume()),
    });

    this.game = game;
    game.start();
    (document.activeElement as HTMLElement | null)?.blur();
    window.addEventListener('keydown', this.keyDown, true);
    window.addEventListener('keyup', this.keyUp, true);
    window.addEventListener('blur', this.windowBlur);
  }

  protected togglePause(): void {
    if (!this.game) return;
    this.game.paused = !this.game.paused;
    this.paused.set(this.game.paused);
  }

  protected flip(index: 0 | 1, pressed: boolean): void {
    this.game?.flip(index, pressed);
  }

  protected startFlipper(index: 0 | 1, event: PointerEvent): void {
    this.capturePointer(event);
    this.flip(index, true);
  }

  protected setCharging(pressed: boolean): void {
    this.game?.setCharging(pressed);
  }

  protected startCharging(event: PointerEvent): void {
    this.capturePointer(event);
    this.setCharging(true);
  }

  protected cancelCharging(): void {
    this.game?.cancelCharging();
  }

  protected saveCurrentScore(): void {
    this.ranking.set(saveScore(this.playerName, this.score()));
    this.saved.set(true);
  }

  private stopGame(): void {
    this.game?.stop();
    this.game = null;
    window.removeEventListener('keydown', this.keyDown, true);
    window.removeEventListener('keyup', this.keyUp, true);
    window.removeEventListener('blur', this.windowBlur);
  }

  private capturePointer(event: PointerEvent): void {
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  private handleKey(event: KeyboardEvent, pressed: boolean): void {
    const game = this.game;
    if (!game || this.screen() !== 'game') return;

    const key = event.key.toLowerCase();
    if (event.repeat && key !== 'p' && key !== 'escape') {
      event.preventDefault();
      return;
    }

    if (key === 'arrowleft' || key === 'a') game.flip(0, pressed);
    else if (key === 'arrowright' || key === 'd') game.flip(1, pressed);
    else if (key === ' ' || event.code === 'Space') game.setCharging(pressed);
    else if ((key === 'p' || key === 'escape') && pressed) this.togglePause();
    else return;
    event.preventDefault();
  }

  private beep(kind: string, volume: number): void {
    if (volume <= 0) return;
    this.audio ??= new AudioContext();

    const [frequency, duration] = SOUND[kind] ?? [440, 0.1];
    const oscillator = this.audio.createOscillator();
    const gain = this.audio.createGain();
    oscillator.type = kind === 'lose' ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, this.audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      kind === 'lose' ? 60 : frequency * 1.5,
      this.audio.currentTime + duration,
    );
    gain.gain.setValueAtTime(volume * 0.15, this.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + duration);
    oscillator.connect(gain).connect(this.audio.destination);
    oscillator.start();
    oscillator.stop(this.audio.currentTime + duration);
  }
}
