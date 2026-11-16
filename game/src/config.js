// Neon Void — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  accel: 2600,
  maxSpeed: 460,
  drag: 3.2,
  fireInterval: 0.11,
  bulletSpeed: 920,
  invulnerable: 2.0,
  /** Pixels the ship's nose sticks out past its centre (drawn shape). */
  nose: 20,
};

export const LIVES = 3;
export const BOMBS = 3;
export const MAX_BOMBS = 5;
/** Score at which the next bonus bomb is granted, then every this much again. */
export const BOMB_SCORE_STEP = 20000;
/** Score thresholds that grant an extra life (each once). */
export const EXTRA_LIFE_AT = [50000, 150000, 300000];

export const BULLET = { radius: 4, life: 0.85, damage: 1 };

/** Enemy bullets (sniper orbs). */
export const ORB = { radius: 7, speed: 230, life: 6 };

/** How long a wave lasts before the next banner and the next difficulty step. */
export const WAVE = { seconds: 25, max: 40 };

/** Shards: the pickups enemies drop. Each one raises the score multiplier by one. */
export const SHARD = {
  radius: 9,
  /** Shards drift toward the ship once it is this close (magnet). */
  magnet: 130,
  collect: 26,
  value: 5,
  /** Multiplier cap. */
  maxMultiplier: 100,
  life: 9,
};

/** Enemy kinds, their scores and their tuning. Speeds are px/s at wave 1. */
export const ENEMY = {
  chaser: { score: 50, radius: 16, hp: 1, speed: 150, speedPerWave: 6 },
  weaver: { score: 75, radius: 14, hp: 1, speed: 210, speedPerWave: 7 },
  spinner: { score: 100, radius: 18, hp: 2, speed: 95, speedPerWave: 4 },
  splitter: { score: 150, radius: 24, hp: 4, speed: 70, speedPerWave: 3 },
  mite: { score: 25, radius: 9, hp: 1, speed: 265, speedPerWave: 8 },
  sniper: { score: 200, radius: 15, hp: 2, speed: 110, speedPerWave: 4, shotInterval: 2.4, shotRange: 560 },
};

/** Seconds into a run before each kind first appears. */
export const UNLOCK_AT = { chaser: 0, weaver: 14, spinner: 30, splitter: 58, sniper: 88 };

/** Spawn director: how fast enemies arrive, tightening as waves pass. */
export const SPAWN = {
  interval: 1.15,
  intervalScale: 0.94,
  minInterval: 0.22,
  /** Extra enemies per spawn once the run is deep in. */
  batchAtWave: 6,
};

/** Pools, allocated once at boot; nothing allocates per frame after that. */
export const POOL = { bullets: 96, orbs: 48, enemies: 72, shards: 96, particles: 420, texts: 24, rings: 12 };

/** The warp grid behind the action: points per axis and how far a blast throws them. */
export const GRID = { spacing: 64, impulse: 90, spring: 90, damping: 6 };

export const PALETTE = {
  backdrop: '#04050e',
  grid: 'rgba(64, 160, 255, 0.16)',
  gridHot: 'rgba(120, 220, 255, 0.5)',
  star: '#8fa8c8',
  player: '#7df9ff',
  playerCore: '#ffffff',
  bullet: '#c8fff4',
  chaser: '#ff2d78',
  weaver: '#ffe14d',
  spinner: '#ff7a1a',
  splitter: '#39ff6a',
  mite: '#8dff5e',
  sniper: '#c86bff',
  orb: '#e0aaff',
  shard: '#9ef7ff',
  shardCore: '#ffffff',
  bombRing: '#aef6ff',
  text: '#e8f6ff',
  muted: '#7d8aa5',
  danger: '#ff4d6d',
  gold: '#ffd94d',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-void.best';
