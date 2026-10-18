import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PinballGame, W, H } from "@/game/engine";
import { loadRanking, saveScore, type ScoreEntry } from "@/game/ranking";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cosmic Pinball — Fliperama espacial" },
      { name: "description", content: "Um pinball lilás e divertido no meio das estrelas. Acenda constelações e entre no ranking!" },
      { property: "og:title", content: "Cosmic Pinball — Fliperama espacial" },
      { property: "og:description", content: "Pinball lilás no universo: planetas, estrelas e multiplicadores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Screen = "home" | "game" | "over" | "ranking";

let audio: AudioContext | null = null;
function beep(kind: string, vol: number) {
  if (vol <= 0) return;
  audio ??= new AudioContext();
  const f: Record<string, [number, number]> = { bump: [520, 0.08], star: [880, 0.15], flip: [180, 0.04], launch: [300, 0.2], lose: [140, 0.4], bonus: [1200, 0.4] };
  const [freq, dur] = f[kind] ?? [440, 0.1];
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = kind === "lose" ? "sawtooth" : "triangle";
  o.frequency.setValueAtTime(freq, audio.currentTime);
  o.frequency.exponentialRampToValueAtTime(kind === "lose" ? 60 : freq * 1.5, audio.currentTime + dur);
  g.gain.setValueAtTime(vol * 0.15, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
  o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + dur);
}

function Index() {
  const [screen, setScreen] = useState<Screen>("home");
  const [score, setScore] = useState(0);
  const [mult, setMult] = useState(1);
  const [balls, setBalls] = useState(3);
  const [paused, setPaused] = useState(false);
  const [vol, setVol] = useState(0.6);
  const [ranking, setRanking] = useState<ScoreEntry[]>([]);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PinballGame | null>(null);
  const volRef = useRef(vol);
  volRef.current = vol;

  useEffect(() => setRanking(loadRanking()), []);
  const best = ranking[0]?.score ?? 0;

  useEffect(() => {
    if (screen !== "game" || !canvasRef.current) return;
    const g = new PinballGame(canvasRef.current, {
      onScore: (s, m) => { setScore(s); setMult(m); },
      onBalls: setBalls,
      onGameOver: (s) => { setScore(s); setSaved(false); setTimeout(() => setScreen("over"), 600); },
      onSound: (k) => beep(k, volRef.current),
    });
    gameRef.current = g; setScore(0); setBalls(3); setMult(1); setPaused(false);
    g.start();
    const key = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") g.flip(0, down);
      else if (k === "arrowright" || k === "d") g.flip(1, down);
      else if (k === " ") g.setCharging(down);
      else if ((k === "p" || k === "escape") && down) { g.paused = !g.paused; setPaused(g.paused); }
      else return;
      e.preventDefault();
    };
    const kd = (e: KeyboardEvent) => key(e, true), ku = (e: KeyboardEvent) => key(e, false);
    const blur = () => { g.paused = true; setPaused(true); };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", blur);
    return () => { g.stop(); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); };
  }, [screen]);

  const togglePause = () => { const g = gameRef.current; if (!g) return; g.paused = !g.paused; setPaused(g.paused); };
  const touch = (i: 0 | 1) => ({
    onPointerDown: () => gameRef.current?.flip(i, true),
    onPointerUp: () => gameRef.current?.flip(i, false),
    onPointerLeave: () => gameRef.current?.flip(i, false),
  });

  return (
    <main className="cosmos min-h-screen flex items-center justify-center p-4">
      {screen === "home" && (
        <section className="panel text-center max-w-md w-full space-y-6 animate-in fade-in zoom-in-95">
          <div className="text-6xl float">🪐</div>
          <h1 className="title text-6xl">Cosmic<br />Pinball</h1>
          <p className="text-muted-foreground">Acenda as 5 estrelas para formar uma constelação e dobrar seus pontos!</p>
          <button className="btn-cosmic w-full" onClick={() => setScreen("game")}>🚀 Jogar</button>
          <button className="btn-ghost w-full" onClick={() => { setRanking(loadRanking()); setScreen("ranking"); }}>🏆 Ranking</button>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>← / A e → / D: palhetas · Espaço: segure e solte para lançar · P: pausa</p>
            <p>Recorde: <span className="text-star font-bold">{best.toLocaleString()}</span></p>
          </div>
          <label className="flex items-center gap-3 justify-center text-sm">
            🔊 <input type="range" min={0} max={1} step={0.1} value={vol} onChange={(e) => setVol(+e.target.value)} className="accent-primary" />
          </label>
        </section>
      )}

      {screen === "game" && (
        <div className="flex flex-col lg:flex-row gap-4 items-center lg:items-start">
          <div className="relative">
            <canvas ref={canvasRef} width={W} height={H} className="table-frame w-[min(92vw,400px)] h-auto touch-none" />
            {paused && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 rounded-3xl">
                <p className="title text-4xl">Pausa</p>
                <button className="btn-cosmic" onClick={togglePause}>Continuar</button>
                <button className="btn-ghost" onClick={() => setScreen("home")}>Sair</button>
              </div>
            )}
            <div className="lg:hidden grid grid-cols-3 gap-2 mt-3 select-none">
              <button className="btn-ghost touch-none" {...touch(0)}>◀</button>
              <button className="btn-cosmic touch-none" onPointerDown={() => gameRef.current?.setCharging(true)} onPointerUp={() => gameRef.current?.setCharging(false)}>Lançar</button>
              <button className="btn-ghost touch-none" {...touch(1)}>▶</button>
            </div>
          </div>
          <aside className="panel w-[min(92vw,400px)] lg:w-64 space-y-4">
            <h2 className="title text-3xl text-center">Cosmic Pinball</h2>
            <div className="score-box">{score.toString().padStart(7, "0")}</div>
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <div className="stat">Bolas<br /><b className="text-xl">{"⚪".repeat(Math.max(0, balls))}</b></div>
              <div className="stat">Multiplicador<br /><b className="text-xl text-star">x{mult}</b></div>
            </div>
            <div className="stat text-center text-sm">Recorde: <b className="text-star">{Math.max(best, score).toLocaleString()}</b></div>
            <button className="btn-ghost w-full" onClick={togglePause}>{paused ? "▶ Continuar" : "⏸ Pausar"}</button>
          </aside>
        </div>
      )}

      {screen === "over" && (
        <section className="panel text-center max-w-md w-full space-y-5 animate-in fade-in zoom-in-95">
          <div className="text-5xl float">💫</div>
          <h2 className="title text-5xl">Fim de jogo</h2>
          <div className="score-box">{score.toLocaleString()}</div>
          {score > best && <p className="text-star font-bold">Novo recorde galáctico! ✨</p>}
          {!saved ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setRanking(saveScore(name, score)); setSaved(true); }}>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="Seu apelido" className="flex-1 rounded-full bg-input px-4 py-2 outline-none focus:ring-2 ring-ring" />
              <button className="btn-cosmic">Salvar</button>
            </form>
          ) : <p className="text-muted-foreground">Pontuação salva! 🌟</p>}
          <div className="flex gap-2">
            <button className="btn-cosmic flex-1" onClick={() => setScreen("game")}>Jogar de novo</button>
            <button className="btn-ghost flex-1" onClick={() => setScreen("ranking")}>Ranking</button>
          </div>
        </section>
      )}

      {screen === "ranking" && (
        <section className="panel max-w-md w-full space-y-4">
          <h2 className="title text-5xl text-center">Ranking</h2>
          {ranking.length === 0 ? <p className="text-center text-muted-foreground">Nenhuma pontuação ainda. Seja a primeira estrela! ⭐</p> : (
            <ol className="space-y-2">
              {ranking.map((r, i) => (
                <li key={r.date} className="stat flex justify-between items-center">
                  <span>{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {r.name}</span>
                  <span className="text-right"><b className="text-star">{r.score.toLocaleString()}</b><br /><small className="text-muted-foreground">{new Date(r.date).toLocaleDateString("pt-BR")}</small></span>
                </li>
              ))}
            </ol>
          )}
          <button className="btn-cosmic w-full" onClick={() => setScreen("home")}>Voltar</button>
        </section>
      )}
    </main>
  );
}
