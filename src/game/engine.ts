// Pinball engine: physics + rendering, independent from React.
export const W = 400;
export const H = 720;
const R = 8;
const G = 900;
const DT = 1 / 240;

type Seg = { ax: number; ay: number; bx: number; by: number };
type Bumper = { x: number; y: number; r: number; pts: number; hit: number; kind: "planet" | "moon" };
type Star = { x: number; y: number; lit: boolean; cd: number };
type Flipper = { px: number; py: number; len: number; rest: number; up: number; a: number; w: number; on: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; c: string };
type Pop = { x: number; y: number; t: string; life: number };

export type GameEvents = {
  onScore: (score: number, mult: number) => void;
  onBalls: (balls: number) => void;
  onGameOver: (score: number) => void;
  onSound: (kind: "bump" | "star" | "flip" | "launch" | "lose" | "bonus") => void;
};

const COLORS = {
  wall: "#e9c8ff",
  glow: "#c084fc",
  planet: ["#f0abfc", "#a855f7"],
  moon: ["#fde68a", "#f59e0b"],
  star: "#fff7ae",
  starOff: "#7c5ba8",
  flipper: "#fbcfe8",
  ball: ["#ffffff", "#c4b5fd", "#6d28d9"],
};

const segs: Seg[] = [
  { ax: 10, ay: 80, bx: 10, by: 520 },
  { ax: 390, ay: 80, bx: 390, by: 700 },
  { ax: 80, ay: 10, bx: 320, by: 10 },
  { ax: 10, ay: 80, bx: 80, by: 10 },
  { ax: 320, ay: 10, bx: 390, by: 80 },
  { ax: 355, ay: 160, bx: 355, by: 700 },
  { ax: 355, ay: 700, bx: 390, by: 700 },
  { ax: 10, ay: 520, bx: 110, by: 625 },
  { ax: 355, ay: 520, bx: 260, by: 625 },
  // small slingshots
  { ax: 60, ay: 470, bx: 100, by: 540 },
  { ax: 305, ay: 470, bx: 265, by: 540 },
];

export class PinballGame {
  ctx: CanvasRenderingContext2D;
  ev: GameEvents;
  bx = 372; by = 680; vx = 0; vy = 0;
  inLane = true;
  balls = 3;
  score = 0;
  mult = 1;
  over = false;
  paused = false;
  charge = 0;
  charging = false;
  acc = 0;
  last = 0;
  raf = 0;
  t = 0;
  bumpers: Bumper[] = [
    { x: 200, y: 130, r: 30, pts: 250, hit: 0, kind: "planet" },
    { x: 125, y: 220, r: 22, pts: 100, hit: 0, kind: "moon" },
    { x: 275, y: 220, r: 22, pts: 100, hit: 0, kind: "moon" },
    { x: 200, y: 310, r: 24, pts: 150, hit: 0, kind: "planet" },
  ];
  stars: Star[] = [
    { x: 70, y: 150, lit: false, cd: 0 },
    { x: 330, y: 150, lit: false, cd: 0 },
    { x: 90, y: 380, lit: false, cd: 0 },
    { x: 310, y: 380, lit: false, cd: 0 },
    { x: 200, y: 420, lit: false, cd: 0 },
  ];
  fl: Flipper[] = [
    { px: 110, py: 625, len: 68, rest: 0.5, up: -0.45, a: 0.5, w: 0, on: false },
    { px: 260, py: 625, len: 68, rest: Math.PI - 0.5, up: Math.PI + 0.45, a: Math.PI - 0.5, w: 0, on: false },
  ];
  parts: Particle[] = [];
  pops: Pop[] = [];
  bg: { x: number; y: number; s: number; p: number }[] = [];

  constructor(canvas: HTMLCanvasElement, ev: GameEvents) {
    this.ctx = canvas.getContext("2d")!;
    this.ev = ev;
    for (let i = 0; i < 90; i++) this.bg.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.3, p: Math.random() * 6 });
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused && !this.over) {
        this.acc += dt;
        while (this.acc >= DT) { this.step(DT); this.acc -= DT; }
      }
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); }

  flip(i: 0 | 1, on: boolean) {
    if (on && !this.fl[i].on) this.ev.onSound("flip");
    this.fl[i].on = on;
  }
  setCharging(on: boolean) {
    if (!this.inLane || this.over || this.paused) { this.charging = false; return; }
    if (on) { this.charging = true; return; }
    if (this.charging) {
      this.charging = false;
      this.vy = -(900 + this.charge * 900);
      this.charge = 0;
      this.inLane = false;
      this.ev.onSound("launch");
    }
  }

  private addScore(p: number, x: number, y: number) {
    const v = p * this.mult;
    this.score += v;
    this.pops.push({ x, y, t: `+${v}`, life: 1 });
    this.ev.onScore(this.score, this.mult);
  }
  private burst(x: number, y: number, c: string, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 180;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.4, c });
    }
  }

  private collideSeg(ax: number, ay: number, bx: number, by: number, rad: number, e: number, sv?: (px: number, py: number) => [number, number]) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = ((this.bx - ax) * dx + (this.by - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + dx * t, cy = ay + dy * t;
    let nx = this.bx - cx, ny = this.by - cy;
    const d = Math.hypot(nx, ny);
    if (d >= R + rad || d === 0) return false;
    nx /= d; ny /= d;
    this.bx = cx + nx * (R + rad);
    this.by = cy + ny * (R + rad);
    const [sx, sy] = sv ? sv(cx, cy) : [0, 0];
    const rvx = this.vx - sx, rvy = this.vy - sy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) { this.vx -= (1 + e) * vn * nx; this.vy -= (1 + e) * vn * ny; }
    return true;
  }

  private step(dt: number) {
    this.t += dt;
    for (const f of this.fl) {
      const target = f.on ? f.up : f.rest;
      const prev = f.a;
      const sp = 22 * dt;
      f.a = Math.abs(target - f.a) < sp ? target : f.a + Math.sign(target - f.a) * sp;
      f.w = (f.a - prev) / dt;
    }
    for (const b of this.bumpers) b.hit = Math.max(0, b.hit - dt);
    for (const s of this.stars) s.cd = Math.max(0, s.cd - dt);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) { p.y -= 40 * dt; p.life -= dt * 1.2; }
    this.pops = this.pops.filter((p) => p.life > 0);

    if (this.inLane) {
      this.bx = 372; this.by = 700 - R; this.vx = 0; this.vy = 0;
      if (this.charging) this.charge = Math.min(1, this.charge + dt * 1.2);
      return;
    }

    this.vy += G * dt;
    this.vx *= 1 - 0.15 * dt; this.vy *= 1 - 0.05 * dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 2200) { this.vx *= 2200 / sp; this.vy *= 2200 / sp; }
    this.bx += this.vx * dt; this.by += this.vy * dt;

    for (const s of segs) this.collideSeg(s.ax, s.ay, s.bx, s.by, 2, 0.5);
    segs.slice(9).forEach((s) => {
      if (this.collideSeg(s.ax, s.ay, s.bx, s.by, 2, 0) ) {
        const nx = -(s.by - s.ay), ny = s.bx - s.ax, l = Math.hypot(nx, ny);
        const dir = (this.bx - s.ax) * nx + (this.by - s.ay) * ny > 0 ? 1 : -1;
        this.vx += (nx / l) * dir * 320; this.vy += (ny / l) * dir * 320;
      }
    });
    for (const f of this.fl) {
      const ex = f.px + Math.cos(f.a) * f.len, ey = f.py + Math.sin(f.a) * f.len;
      this.collideSeg(f.px, f.py, ex, ey, 6, 0.3, (cx, cy) => [-(cy - f.py) * f.w, (cx - f.px) * f.w]);
    }
    for (const b of this.bumpers) {
      const dx = this.bx - b.x, dy = this.by - b.y, d = Math.hypot(dx, dy);
      if (d < b.r + R && d > 0) {
        const nx = dx / d, ny = dy / d;
        this.bx = b.x + nx * (b.r + R); this.by = b.y + ny * (b.r + R);
        const vn = this.vx * nx + this.vy * ny;
        this.vx -= 2 * vn * nx; this.vy -= 2 * vn * ny;
        this.vx += nx * 380; this.vy += ny * 380;
        if (b.hit <= 0.05) {
          b.hit = 0.2;
          this.addScore(b.pts, b.x, b.y - b.r);
          this.burst(b.x + nx * b.r, b.y + ny * b.r, b.kind === "planet" ? COLORS.planet[0] : COLORS.moon[0]);
          this.ev.onSound("bump");
        }
      }
    }
    for (const s of this.stars) {
      if (s.cd <= 0 && Math.hypot(this.bx - s.x, this.by - s.y) < R + 14) {
        s.cd = 0.5;
        if (!s.lit) { s.lit = true; this.addScore(500, s.x, s.y); this.burst(s.x, s.y, COLORS.star, 18); this.ev.onSound("star"); }
        if (this.stars.every((x) => x.lit)) {
          this.mult = Math.min(8, this.mult * 2);
          this.stars.forEach((x) => (x.lit = false));
          this.pops.push({ x: 200, y: 360, t: `CONSTELAÇÃO! x${this.mult}`, life: 1.6 });
          this.burst(200, 360, COLORS.star, 50);
          this.ev.onScore(this.score, this.mult);
          this.ev.onSound("bonus");
        }
      }
    }

    // back in lane -> ready for relaunch
    if (this.bx > 355 && this.by > 690 - R && Math.abs(this.vy) < 60) this.inLane = true;

    if (this.by > H + 30) {
      this.balls -= 1;
      this.mult = 1;
      this.ev.onBalls(this.balls);
      this.ev.onScore(this.score, this.mult);
      this.ev.onSound("lose");
      if (this.balls <= 0) { this.over = true; this.ev.onGameOver(this.score); }
      else this.inLane = true;
    }
  }

  private glowStroke(fn: () => void, color: string, w: number) {
    const c = this.ctx;
    c.strokeStyle = color; c.lineWidth = w; c.shadowColor = color; c.shadowBlur = 14;
    c.lineCap = "round";
    fn(); c.shadowBlur = 0;
  }

  draw() {
    const c = this.ctx;
    const g = c.createRadialGradient(200, 260, 20, 200, 360, 520);
    g.addColorStop(0, "#4c1d95"); g.addColorStop(0.5, "#2e1065"); g.addColorStop(1, "#12052b");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // nebula
    const n = c.createRadialGradient(90, 470, 0, 90, 470, 160);
    n.addColorStop(0, "rgba(244,114,182,0.25)"); n.addColorStop(1, "rgba(244,114,182,0)");
    c.fillStyle = n; c.fillRect(0, 0, W, H);
    for (const s of this.bg) {
      c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 2 + s.p));
      c.fillStyle = "#fff"; c.beginPath(); c.arc(s.x, s.y, s.s, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    // orbit ring
    c.strokeStyle = "rgba(216,180,254,0.25)"; c.lineWidth = 1.5; c.setLineDash([4, 6]);
    c.beginPath(); c.ellipse(200, 230, 130, 70, 0, 0, 7); c.stroke(); c.setLineDash([]);

    this.glowStroke(() => { for (const s of segs) { c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke(); } }, COLORS.wall, 4);

    for (const b of this.bumpers) {
      const [c1, c2] = b.kind === "planet" ? COLORS.planet : COLORS.moon;
      const rr = b.r + (b.hit > 0 ? 4 : 0);
      const pg = c.createRadialGradient(b.x - rr / 3, b.y - rr / 3, 2, b.x, b.y, rr);
      pg.addColorStop(0, "#fff"); pg.addColorStop(0.3, c1); pg.addColorStop(1, c2);
      c.shadowColor = c1; c.shadowBlur = b.hit > 0 ? 30 : 12;
      c.fillStyle = pg; c.beginPath(); c.arc(b.x, b.y, rr, 0, 7); c.fill(); c.shadowBlur = 0;
      if (b.kind === "planet") {
        c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 2;
        c.beginPath(); c.ellipse(b.x, b.y, rr * 1.5, rr * 0.4, -0.3, 0, 7); c.stroke();
      }
    }
    for (const s of this.stars) this.drawStar(s.x, s.y, 13, s.lit ? COLORS.star : COLORS.starOff, s.lit);

    for (const f of this.fl) {
      const ex = f.px + Math.cos(f.a) * f.len, ey = f.py + Math.sin(f.a) * f.len;
      this.glowStroke(() => { c.beginPath(); c.moveTo(f.px, f.py); c.lineTo(ex, ey); c.stroke(); }, COLORS.flipper, 12);
    }

    // launch power
    if (this.inLane) {
      c.fillStyle = "rgba(255,255,255,0.15)"; c.fillRect(362, 600, 20, 70);
      c.fillStyle = COLORS.star; c.fillRect(362, 670 - 70 * this.charge, 20, 70 * this.charge);
    }

    for (const p of this.parts) { c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.c; c.fillRect(p.x, p.y, 3, 3); }
    c.globalAlpha = 1;

    const bg2 = c.createRadialGradient(this.bx - 3, this.by - 3, 1, this.bx, this.by, R);
    bg2.addColorStop(0, COLORS.ball[0]); bg2.addColorStop(0.5, COLORS.ball[1]); bg2.addColorStop(1, COLORS.ball[2]);
    c.shadowColor = "#fff"; c.shadowBlur = 16; c.fillStyle = bg2;
    c.beginPath(); c.arc(this.bx, this.by, R, 0, 7); c.fill(); c.shadowBlur = 0;

    c.textAlign = "center"; c.font = "bold 16px Fredoka, sans-serif";
    for (const p of this.pops) { c.globalAlpha = Math.max(0, p.life); c.fillStyle = COLORS.star; c.fillText(p.t, p.x, p.y); }
    c.globalAlpha = 1;
  }

  private drawStar(x: number, y: number, r: number, color: string, glow: boolean) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.rotate(this.t * (glow ? 1.5 : 0.4));
    c.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const a = (i * Math.PI) / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath(); c.fillStyle = color; c.shadowColor = color; c.shadowBlur = glow ? 20 : 4; c.fill();
    c.restore();
  }
}
