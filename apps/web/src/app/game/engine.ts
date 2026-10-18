// Pinball engine: physics + rendering, independent from React.
export const W = 400;
export const H = 720;
export type TrackId = "orbit" | "crystal-garden";
const R = 8;
const G = 900;
const DT = 1 / 240;
const MIN_LAUNCH_SPEED = 1200;
const LAUNCHER_CATCH_Y = 670;

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
  accentGate: "#f472b6",
  planet: ["#f0abfc", "#a855f7"],
  moon: ["#fde68a", "#f59e0b"],
  star: "#fff7ae",
  starOff: "#7c5ba8",
  flipper: "#fbcfe8",
  ball: ["#ffffff", "#c4b5fd", "#6d28d9"],
} as const;
type Palette = {
  wall: string;
  glow: string;
  accentGate: string;
  planet: readonly [string, string];
  moon: readonly [string, string];
  star: string;
  starOff: string;
  flipper: string;
  ball: readonly [string, string, string];
};
const CRYSTAL_COLORS: Palette = {
  wall: "#a5f3fc",
  glow: "#22d3ee",
  accentGate: "#a3e635",
  planet: ["#67e8f9", "#0e7490"],
  moon: ["#d9f99d", "#65a30d"],
  star: "#ecfeff",
  starOff: "#397887",
  flipper: "#a5f3fc",
  ball: ["#ffffff", "#a5f3fc", "#0891b2"],
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
  // top rollover lane posts
  { ax: 110, ay: 58, bx: 110, by: 84 },
  { ax: 146, ay: 58, bx: 146, by: 84 },
  { ax: 182, ay: 58, bx: 182, by: 84 },
  { ax: 218, ay: 58, bx: 218, by: 84 },
  { ax: 254, ay: 58, bx: 254, by: 84 },
  { ax: 290, ay: 58, bx: 290, by: 84 },
];

export class PinballGame {
  ctx: CanvasRenderingContext2D;
  ev: GameEvents;
  readonly track: TrackId;
  private readonly palette: Palette;
  bx = 372; by = 680; vx = 0; vy = 0;
  inLane = true;
  gate = false;
  ramp = -1;
  ri = 0;
  ramps: { path: [number, number][]; pts: number; color: string; label: string; dur: number }[] = [
    { path: [[45, 440], [32, 330], [34, 220], [55, 120], [100, 100], [150, 104], [190, 112]], pts: 1000, color: "rgba(167,139,250,0.55)", label: "RAMPA", dur: 0.9 },
    { path: [[325, 335], [345, 240], [342, 150], [315, 105], [285, 125], [290, 230], [310, 380], [300, 500], [282, 560]], pts: 1500, color: "rgba(244,114,182,0.45)", label: "BURACO DE MINHOCA", dur: 1.2 },
  ];
  holes = [{ x: 200, y: 505 }, { x: 200, y: 34 }];
  hole = { from: 0, t: -1, cd: 0 };
  lanes = "ASTRO".split("").map((ch, i) => ({ x: 128 + i * 36, ch, lit: false }));
  comet = { x: 200, dir: 1, cd: 0, y: 265 };
  laneCd = 0;
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

  constructor(canvas: HTMLCanvasElement, ev: GameEvents, track: TrackId = "orbit") {
    this.ctx = canvas.getContext("2d")!;
    this.ev = ev;
    this.track = track;
    this.palette = track === "crystal-garden" ? CRYSTAL_COLORS : COLORS;
    if (track === "crystal-garden") {
      this.ramps = [
        { path: [[48, 445], [35, 335], [48, 245], [82, 175], [130, 130], [190, 115]], pts: 1200, color: "rgba(34,211,238,0.5)", label: "CASCATA DE CRISTAIS", dur: 0.95 },
        { path: [[326, 350], [350, 280], [338, 210], [310, 145], [270, 128], [245, 220], [260, 340], [290, 455], [278, 550]], pts: 1800, color: "rgba(163,230,53,0.45)", label: "PORTAL AURORA", dur: 1.15 },
      ];
      this.holes = [{ x: 200, y: 505 }, { x: 200, y: 34 }];
      this.lanes = "AURORA".split("").map((ch, i) => ({ x: 110 + i * 36, ch, lit: false }));
      this.comet = { x: 200, dir: -1, cd: 0, y: 270 };
      this.bumpers = [
        { x: 200, y: 145, r: 27, pts: 300, hit: 0, kind: "planet" },
        { x: 112, y: 230, r: 21, pts: 125, hit: 0, kind: "moon" },
        { x: 288, y: 230, r: 21, pts: 125, hit: 0, kind: "moon" },
        { x: 150, y: 330, r: 23, pts: 200, hit: 0, kind: "planet" },
        { x: 250, y: 330, r: 23, pts: 200, hit: 0, kind: "planet" },
      ];
      this.stars = [
        { x: 68, y: 155, lit: false, cd: 0 },
        { x: 332, y: 155, lit: false, cd: 0 },
        { x: 82, y: 390, lit: false, cd: 0 },
        { x: 318, y: 390, lit: false, cd: 0 },
        { x: 200, y: 430, lit: false, cd: 0 },
      ];
    }
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
    if (on && !this.fl[i]!.on) this.ev.onSound("flip");
    this.fl[i]!.on = on;
  }
  setCharging(on: boolean) {
    if (!this.inLane || this.over || this.paused) { this.charging = false; return; }
    if (on) { this.charging = true; return; }
    if (this.charging) {
      this.charging = false;
      this.vy = -(MIN_LAUNCH_SPEED + this.charge * 900);
      this.charge = 0;
      this.inLane = false;
      this.gate = false;
      this.ev.onSound("launch");
    }
  }
  cancelCharging() {
    this.charging = false;
    if (this.inLane) this.charge = 0;
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

    if (this.ramp >= 0) {
      const rm = this.ramps[this.ri]!;
      this.ramp += dt / rm.dur;
      const pts = rm.path, n = pts.length - 1;
      if (this.ramp >= 1) {
        this.ramp = -1;
        const [ax, ay] = pts[n - 1]!, [bx, by] = pts[n]!;
        const l = Math.hypot(bx - ax, by - ay);
        this.bx = bx; this.by = by; this.vx = ((bx - ax) / l) * 500; this.vy = ((by - ay) / l) * 500;
        this.addScore(rm.pts, bx, by - 15); this.pops.push({ x: 200, y: 330, t: rm.label + "!", life: 1.2 }); this.burst(bx, by, this.palette.glow, 30); this.ev.onSound("bonus");
      } else {
        const f = this.ramp * n, i = Math.floor(f), k = f - i;
        const p0 = pts[i]!, p1 = pts[i + 1]!;
        this.bx = p0[0] + (p1[0] - p0[0]) * k;
        this.by = p0[1] + (p1[1] - p0[1]) * k;
        if (Math.random() < 0.5) this.parts.push({ x: this.bx, y: this.by, vx: 0, vy: 0, life: 0.4, c: this.palette.star });
      }
      return;
    }
    for (let i = 0; i < this.ramps.length; i++) {
      const e0 = this.ramps[i]!.path[0]!;
      if (this.vy < -120 && Math.hypot(this.bx - e0[0], this.by - e0[1]) < 20) {
        this.ramp = 0; this.ri = i; this.ev.onSound("launch"); return;
      }
    }
    // black holes (teleport between them)
    const h = this.hole;
    h.cd = Math.max(0, h.cd - dt);
    if (h.t >= 0) {
      h.t += dt;
      const inH = this.holes[h.from]!, outH = this.holes[1 - h.from]!;
      if (h.t < 0.5) {
        const k = 1 - h.t / 0.5;
        this.bx = inH.x + Math.cos(h.t * 18) * 12 * k; this.by = inH.y + Math.sin(h.t * 18) * 12 * k;
      } else {
        const k = (h.t - 0.5) / 0.5;
        this.bx = outH.x + Math.cos(h.t * 18) * 12 * k; this.by = outH.y + Math.sin(h.t * 18) * 12 * k;
      }
      if (h.t > 1) {
        h.t = -1; h.cd = 1.2;
        this.bx = outH.x; this.by = outH.y;
        const up = h.from === 1 ? -1 : 1; // from top hole -> exit bottom going up
        const a = (up < 0 ? -Math.PI / 2 : Math.PI / 2) + (Math.random() - 0.5) * 1.2;
        const sp = up < 0 ? 900 : 300;
        this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
        this.addScore(2000, outH.x, outH.y + 30); this.burst(outH.x, outH.y, this.palette.glow, 40); this.ev.onSound("bonus");
        this.pops.push({
          x: 200,
          y: 330,
          t: this.track === "crystal-garden" ? "PORTAL DE CRISTAL!" : "TELETRANSPORTE!",
          life: 1.2,
        });
      }
      return;
    }
    if (h.cd <= 0) {
      const i = this.holes.findIndex((o) => Math.hypot(this.bx - o.x, this.by - o.y) < 16);
      if (i >= 0) { h.t = 0; h.from = i; this.ev.onSound("star"); return; }
    }
    // comet target
    const cm = this.comet;
    cm.cd = Math.max(0, cm.cd - dt);
    cm.x += cm.dir * 70 * dt;
    if (cm.x > 300 || cm.x < 100) cm.dir *= -1;
    if (cm.cd <= 0 && Math.hypot(this.bx - cm.x, this.by - cm.y) < R + 12) {
      cm.cd = 0.6; this.vy = -Math.abs(this.vy) - 200;
      this.addScore(750, cm.x, cm.y - 18); this.burst(cm.x, cm.y, this.track === "crystal-garden" ? this.palette.accentGate : "#7dd3fc", 24); this.ev.onSound("bonus");
      this.pops.push({ x: cm.x, y: cm.y + 30, t: this.track === "crystal-garden" ? "LIBÉLULA!" : "COMETA!", life: 1 });
    }
    // top lanes
    this.laneCd = Math.max(0, this.laneCd - dt);
    if (this.by > 56 && this.by < 86 && this.laneCd <= 0) {
      const ln = this.lanes.find((l) => Math.abs(this.bx - l.x) < 14);
      if (ln && !ln.lit) { ln.lit = true; this.laneCd = 0.3; this.addScore(300, ln.x, 100); this.ev.onSound("star"); }
      if (this.lanes.every((l) => l.lit)) {
        this.lanes.forEach((l) => (l.lit = false));
        const message = this.track === "crystal-garden" ? "AURORA COMPLETA!" : "ASTRO COMPLETO!";
        this.addScore(5000, 200, 110); this.pops.push({ x: 200, y: 330, t: message, life: 1.4 });
        this.burst(200, 70, this.palette.star, 40); this.ev.onSound("bonus");
      }
    }
    if (!this.gate && this.bx < 345) this.gate = true;
    this.vy += G * dt;
    this.vx *= 1 - 0.15 * dt; this.vy *= 1 - 0.05 * dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 2200) { this.vx *= 2200 / sp; this.vy *= 2200 / sp; }
    this.bx += this.vx * dt; this.by += this.vy * dt;

    if (this.vy > 0 && this.by >= LAUNCHER_CATCH_Y && this.bx >= 360 && this.bx <= 385) {
      this.inLane = true;
      this.bx = 372;
      this.by = 700 - R;
      this.vx = 0;
      this.vy = 0;
      this.charge = 0;
      this.charging = false;
      this.gate = false;
      return;
    }

    for (const s of segs) this.collideSeg(s.ax, s.ay, s.bx, s.by, 2, 0.5);
    if (this.gate) this.collideSeg(355, 160, 390, 118, 3, 0.5);
    segs.slice(9, 11).forEach((s) => {
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
          this.burst(b.x + nx * b.r, b.y + ny * b.r, b.kind === "planet" ? this.palette.planet[0] : this.palette.moon[0]);
          this.ev.onSound("bump");
        }
      }
    }
    for (const s of this.stars) {
      if (s.cd <= 0 && Math.hypot(this.bx - s.x, this.by - s.y) < R + 14) {
        s.cd = 0.5;
        if (!s.lit) { s.lit = true; this.addScore(500, s.x, s.y); this.burst(s.x, s.y, this.palette.star, 18); this.ev.onSound("star"); }
        if (this.stars.every((x) => x.lit)) {
          this.mult = Math.min(8, this.mult * 2);
          this.stars.forEach((x) => (x.lit = false));
          this.pops.push({ x: 200, y: 360, t: `CONSTELAÇÃO! x${this.mult}`, life: 1.6 });
          this.burst(200, 360, this.palette.star, 50);
          this.ev.onScore(this.score, this.mult);
          this.ev.onSound("bonus");
        }
      }
    }


    if (this.by > H + 30) {
      this.balls -= 1;
      this.mult = 1;
      this.ev.onBalls(this.balls);
      this.ev.onScore(this.score, this.mult);
      this.ev.onSound("lose");
      if (this.balls <= 0) { this.over = true; this.ev.onGameOver(this.score); }
      else { this.inLane = true; this.gate = false; }
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
    if (this.track === "crystal-garden") {
      g.addColorStop(0, "#164e63"); g.addColorStop(0.5, "#083344"); g.addColorStop(1, "#04131f");
    } else {
      g.addColorStop(0, "#4c1d95"); g.addColorStop(0.5, "#2e1065"); g.addColorStop(1, "#12052b");
    }
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // nebula
    const n = c.createRadialGradient(90, 470, 0, 90, 470, 160);
    n.addColorStop(0, this.track === "crystal-garden" ? "rgba(34,211,238,0.25)" : "rgba(244,114,182,0.25)");
    n.addColorStop(1, this.track === "crystal-garden" ? "rgba(34,211,238,0)" : "rgba(244,114,182,0)");
    c.fillStyle = n; c.fillRect(0, 0, W, H);
    if (this.track === "crystal-garden") this.drawCrystals();
    for (const s of this.bg) {
      c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 2 + s.p));
      c.fillStyle = "#fff"; c.beginPath(); c.arc(s.x, s.y, s.s, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    // orbit ring
    c.strokeStyle = this.track === "crystal-garden" ? "rgba(165,243,252,0.2)" : "rgba(216,180,254,0.25)"; c.lineWidth = 1.5; c.setLineDash([4, 6]);
    c.beginPath(); c.ellipse(200, 230, 130, 70, 0, 0, 7); c.stroke(); c.setLineDash([]);

    this.glowStroke(() => { for (const s of segs) { c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke(); } }, this.palette.wall, 4);

    if (this.track === "crystal-garden") {
      this.drawCrystalPortals();
    } else {
      for (const h of this.holes) {
        for (let i = 5; i > 0; i--) {
          c.strokeStyle = `rgba(216,180,254,${0.12 * i})`; c.lineWidth = 2;
          const rr = h.y < 100 ? 6 + i * 4 : 10 + i * 9;
          c.beginPath(); c.arc(h.x, h.y, rr + Math.sin(this.t * 3 + i) * 2, this.t * i, this.t * i + 4.5); c.stroke();
        }
        const hg = c.createRadialGradient(h.x, h.y, 2, h.x, h.y, 20);
        hg.addColorStop(0, "#000"); hg.addColorStop(0.7, "#1e0636"); hg.addColorStop(1, "rgba(192,132,252,0.8)");
        c.fillStyle = hg; c.beginPath(); c.arc(h.x, h.y, h.y < 100 ? 16 : 20, 0, 7); c.fill();
      }
    }
    // ASTRO lanes
    c.textAlign = "center"; c.font = "bold 14px Fredoka, sans-serif";
    for (const l of this.lanes) {
      c.fillStyle = l.lit ? this.palette.star : "rgba(255,255,255,0.3)"; c.shadowColor = this.palette.star; c.shadowBlur = l.lit ? 16 : 0;
      c.fillText(l.ch, l.x, 76); c.shadowBlur = 0;
    }
    if (this.track === "crystal-garden") {
      this.drawCrystalDragonfly();
    } else {
      const cm = this.comet;
      const tail = c.createLinearGradient(cm.x - cm.dir * 40, cm.y, cm.x, cm.y);
      tail.addColorStop(0, "rgba(125,211,252,0)"); tail.addColorStop(1, "rgba(125,211,252,0.8)");
      c.strokeStyle = tail; c.lineWidth = 8; c.beginPath(); c.moveTo(cm.x - cm.dir * 40, cm.y); c.lineTo(cm.x, cm.y); c.stroke();
      c.fillStyle = "#e0f2fe"; c.shadowColor = "#7dd3fc"; c.shadowBlur = cm.cd > 0 ? 30 : 14;
      c.beginPath(); c.arc(cm.x, cm.y, 9, 0, 7); c.fill(); c.shadowBlur = 0;
    }
    // ramps
    c.lineJoin = "round"; c.lineCap = "round";
    this.ramps.forEach((rm, ri) => {
      const rp = rm.path;
      if (ri === 1) {
        // wormhole: dark tube with spinning rings
        c.strokeStyle = this.track === "crystal-garden" ? "rgba(8,78,93,0.9)" : "rgba(30,6,54,0.85)"; c.lineWidth = 30;
        c.beginPath(); rp.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
        this.glowStroke(() => { c.lineWidth = 2; c.beginPath(); rp.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }, this.palette.accentGate, 2);
        for (let i = 0; i < rp.length - 1; i++) {
          const [x0, y0] = rp[i]!, [x1, y1] = rp[i + 1]!;
          const k = (this.t * 0.8 + i * 0.37) % 1;
          const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
          c.strokeStyle = this.track === "crystal-garden"
            ? `rgba(${i % 2 ? "163,230,53" : "103,232,249"},${0.9 - k * 0.5})`
            : `rgba(244,114,182,${0.9 - k * 0.5})`;
          c.lineWidth = 2;
          c.beginPath(); c.ellipse(x, y, 14, 6, Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2, 0, 7); c.stroke();
        }
        c.fillStyle = this.palette.accentGate; c.beginPath(); c.arc(rp[0]![0], rp[0]![1], 14, 0, 7); c.fill();
        c.fillStyle = "#fff"; c.font = "bold 12px Fredoka, sans-serif"; c.textAlign = "center"; c.fillText("@", rp[0]![0], rp[0]![1] + 4);
        return;
      }
      c.strokeStyle = rm.color; c.lineWidth = 28;
      c.beginPath(); rp.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1.5;
      c.beginPath(); rp.forEach(([x, y], i) => (i ? c.lineTo(x - 13, y) : c.moveTo(x - 13, y))); c.stroke();
      c.beginPath(); rp.forEach(([x, y], i) => (i ? c.lineTo(x + 13, y) : c.moveTo(x + 13, y))); c.stroke();
      this.glowStroke(() => { c.lineWidth = 3; c.setLineDash([10, 8]); c.lineDashOffset = -this.t * 40; c.beginPath(); rp.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.setLineDash([]); }, this.palette.star, 3);
      c.fillStyle = this.palette.glow; c.beginPath(); c.arc(rp[0]![0], rp[0]![1], 14, 0, 7); c.fill();
      c.fillStyle = "#fff"; c.font = "bold 10px Fredoka, sans-serif"; c.textAlign = "center"; c.fillText("▲", rp[0]![0], rp[0]![1] + 4);
    });
    if (this.gate) this.glowStroke(() => { c.beginPath(); c.moveTo(355, 160); c.lineTo(390, 118); c.stroke(); }, this.palette.accentGate, 4);

    for (const b of this.bumpers) {
      const [c1, c2] = b.kind === "planet" ? this.palette.planet : this.palette.moon;
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
    for (const s of this.stars) this.drawStar(s.x, s.y, 13, s.lit ? this.palette.star : this.palette.starOff, s.lit);

    for (const f of this.fl) {
      const ex = f.px + Math.cos(f.a) * f.len, ey = f.py + Math.sin(f.a) * f.len;
      this.glowStroke(() => { c.beginPath(); c.moveTo(f.px, f.py); c.lineTo(ex, ey); c.stroke(); }, this.palette.flipper, 12);
    }

    // launch power
    if (this.inLane) {
      c.fillStyle = "rgba(255,255,255,0.15)"; c.fillRect(362, 600, 20, 70);
      c.fillStyle = this.palette.star; c.fillRect(362, 670 - 70 * this.charge, 20, 70 * this.charge);
    }

    for (const p of this.parts) { c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.c; c.fillRect(p.x, p.y, 3, 3); }
    c.globalAlpha = 1;

    const bg2 = c.createRadialGradient(this.bx - 3, this.by - 3, 1, this.bx, this.by, R);
    bg2.addColorStop(0, this.palette.ball[0]); bg2.addColorStop(0.5, this.palette.ball[1]); bg2.addColorStop(1, this.palette.ball[2]);
    c.shadowColor = "#fff"; c.shadowBlur = 16; c.fillStyle = bg2;
    c.beginPath(); c.arc(this.bx, this.by, this.ramp >= 0 ? R * 1.3 : R, 0, 7); c.fill(); c.shadowBlur = 0;

    c.textAlign = "center"; c.font = "bold 16px Fredoka, sans-serif";
    for (const p of this.pops) { c.globalAlpha = Math.max(0, p.life); c.fillStyle = this.palette.star; c.fillText(p.t, p.x, p.y); }
    c.globalAlpha = 1;
  }

  private drawCrystals() {
    const c = this.ctx;
    for (const [x, y, size] of [[34, 275, 30], [365, 315, 34], [38, 575, 24], [360, 585, 27]] as const) {
      c.save();
      c.translate(x, y);
      c.globalAlpha = 0.5;
      c.fillStyle = this.palette.glow;
      c.shadowColor = this.palette.glow;
      c.shadowBlur = 18;
      c.beginPath();
      c.moveTo(0, -size);
      c.lineTo(size * 0.48, -size * 0.18);
      c.lineTo(size * 0.3, size);
      c.lineTo(-size * 0.35, size * 0.72);
      c.lineTo(-size * 0.5, -size * 0.2);
      c.closePath();
      c.fill();
      c.globalAlpha = 0.65;
      c.strokeStyle = "#ecfeff";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, -size);
      c.lineTo(0, size * 0.75);
      c.lineTo(size * 0.48, -size * 0.18);
      c.moveTo(0, size * 0.75);
      c.lineTo(-size * 0.5, -size * 0.2);
      c.stroke();
      c.restore();
    }
  }

  private drawCrystalPortals() {
    const c = this.ctx;
    for (const [index, portal] of this.holes.entries()) {
      const radius = portal.y < 100 ? 16 : 20;
      c.save();
      c.translate(portal.x, portal.y);
      c.shadowColor = this.palette.glow;
      c.shadowBlur = 20;
      for (let ring = 0; ring < 3; ring++) {
        c.strokeStyle = ring === 1 ? "rgba(163,230,53,0.8)" : "rgba(103,232,249,0.78)";
        c.lineWidth = ring === 1 ? 2 : 3;
        c.beginPath();
        c.ellipse(0, 0, radius + ring * 5, radius * 0.52 + ring * 2, 0, this.t * (index ? -1 : 1) + ring, this.t * (index ? -1 : 1) + ring + Math.PI * 1.65);
        c.stroke();
      }
      const center = c.createRadialGradient(-3, -3, 1, 0, 0, radius * 0.7);
      center.addColorStop(0, "#ecfeff");
      center.addColorStop(0.35, "#67e8f9");
      center.addColorStop(1, "#0e7490");
      c.fillStyle = center;
      c.beginPath();
      c.arc(0, 0, radius * 0.52, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#f0fdfa";
      c.beginPath();
      c.arc(Math.cos(this.t * 3 + index * Math.PI) * radius * 0.72, Math.sin(this.t * 3 + index * Math.PI) * radius * 0.4, 2.5, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  private drawCrystalDragonfly() {
    const c = this.ctx;
    const { x, y, cd } = this.comet;
    const wingbeat = Math.sin(this.t * 18) * 5;
    c.save();
    c.translate(x, y);
    c.rotate(this.comet.dir < 0 ? Math.PI : 0);
    c.scale(1.4, 1.4);
    c.globalAlpha = cd > 0 ? 0.45 : 1;
    c.shadowColor = this.palette.glow;
    c.shadowBlur = cd > 0 ? 8 : 24;
    for (const side of [-1, 1]) {
      for (const offset of [-4, 3]) {
        const spread = 17 + wingbeat * side;
        c.fillStyle = side < 0 ? "rgba(165,243,252,0.82)" : "rgba(103,232,249,0.68)";
        c.beginPath();
        c.moveTo(offset, 0);
        c.quadraticCurveTo(offset - 1, side * spread, offset - 18, side * (spread + 5));
        c.quadraticCurveTo(offset - 13, side * 2, offset, 0);
        c.fill();
        c.strokeStyle = "rgba(236,254,255,0.9)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(offset, 0);
        c.lineTo(offset - 14, side * (spread + 3));
        c.stroke();
      }
    }
    c.fillStyle = "#a3e635";
    c.beginPath();
    c.ellipse(0, 0, 16, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ecfeff";
    c.beginPath();
    c.arc(14, 0, 5, 0, Math.PI * 2);
    c.fill();
    for (let segment = 0; segment < 3; segment++) {
      c.fillStyle = segment % 2 ? "#67e8f9" : "#a3e635";
      c.beginPath();
      c.arc(-13 - segment * 5, 0, 2.5 - segment * 0.4, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#164e63";
    c.beginPath();
    c.arc(15.5, -1.5, 1, 0, Math.PI * 2);
    c.fill();
    c.restore();
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
