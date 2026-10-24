import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the game title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Cosmic');
  });

  it('keeps the game controls hidden until a game is started', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.game-layout')?.hasAttribute('hidden')).toBe(true);
  });

  it('allows selecting the Mars nebula track', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const tracks = fixture.nativeElement.querySelectorAll('.track-option') as NodeListOf<HTMLButtonElement>;

    tracks[1]?.click();
    fixture.detectChanges();

    expect(tracks[1]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('allows selecting the living Earth track', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const tracks = fixture.nativeElement.querySelectorAll('.track-option') as NodeListOf<HTMLButtonElement>;

    tracks[2]?.click();
    fixture.detectChanges();

    expect(tracks[2]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('does not offer the removed crystal garden track', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Jardim de Cristal');
    expect(fixture.nativeElement.querySelectorAll('.track-option')).toHaveLength(3);
  });
});
