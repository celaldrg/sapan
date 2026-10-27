/**
 * World constants, materials and the five castle levels.
 * Positions use world pixels: x grows to the right, `bottom` is the height of a piece's
 * lowest edge above the ground line, so stacked pieces can be read at a glance.
 */

/** Size of the playfield, the ground line and the slingshot anchor. */
export const WORLD = Object.freeze({
  width: 1600,
  height: 800,
  groundY: 700,
  sling: Object.freeze({ x: 230, y: 560 }),
});

/**
 * Block materials. `strength` is hit points per 1000 px² of block area.
 * @type {Readonly<Record<'wood'|'glass'|'stone', {density:number, friction:number, restitution:number, strength:number, points:number}>>}
 */
export const MATERIALS = Object.freeze({
  wood: Object.freeze({ density: 0.0014, friction: 0.8, restitution: 0.05, strength: 30, points: 300 }),
  glass: Object.freeze({ density: 0.0011, friction: 0.5, restitution: 0.1, strength: 10, points: 200 }),
  stone: Object.freeze({ density: 0.003, friction: 0.9, restitution: 0.02, strength: 90, points: 500 }),
});

/** Slime goblin targets: octagon bodies with a flat base so they sit still. */
export const TARGET = Object.freeze({
  radius: 18,
  sides: 8,
  density: 0.0012,
  friction: 0.7,
  restitution: 0.1,
  hp: 12,
  /** A target that drops this far below its start is defeated (toppled). */
  fallLimit: 50,
});

/** The stone fired by the slingshot. */
export const PROJECTILE = Object.freeze({ radius: 15, density: 0.005, friction: 0.6, restitution: 0.25 });

/**
 * @typedef {{material: keyof typeof MATERIALS, x: number, bottom: number, w: number, h: number}} BlockSpec
 * @typedef {{x: number, bottom: number}} TargetSpec
 * @typedef {{key: string, ammo: number, blocks: BlockSpec[], targets: TargetSpec[]}} LevelSpec
 */

/**
 * Block factory for one material: (centre x, bottom, width, height) => BlockSpec.
 * @param {keyof typeof MATERIALS} material
 * @returns {(x: number, bottom: number, w: number, h: number) => BlockSpec}
 */
const piece = (material) => (x, bottom, w, h) => ({ material, x, bottom, w, h });
const wood = piece('wood');
const glass = piece('glass');
const stone = piece('stone');
/**
 * A slime goblin standing at centre x with its base at `bottom`.
 * @param {number} x
 * @param {number} bottom
 * @returns {TargetSpec}
 */
const goblin = (x, bottom) => ({ x, bottom });

/** @type {ReadonlyArray<LevelSpec>} */
export const LEVELS = Object.freeze([
  {
    key: 'gate',
    ammo: 3,
    blocks: [
      wood(1000, 0, 20, 100), wood(1120, 0, 20, 100), wood(1060, 100, 180, 20),
      glass(1000, 120, 20, 40), glass(1120, 120, 20, 40),
    ],
    targets: [goblin(1060, 0), goblin(1060, 120)],
  },
  {
    key: 'lookout',
    ammo: 3,
    blocks: [
      wood(980, 0, 20, 100), wood(1120, 0, 20, 100), wood(1050, 100, 180, 20),
      glass(1000, 120, 20, 80), glass(1100, 120, 20, 80), glass(1050, 200, 140, 20),
    ],
    targets: [goblin(1050, 0), goblin(1050, 120), goblin(1050, 220)],
  },
  {
    key: 'steps',
    ammo: 4,
    blocks: [
      stone(1100, 0, 240, 40),
      wood(1000, 40, 20, 100), wood(1200, 40, 20, 100), wood(1100, 140, 240, 20),
      stone(1100, 160, 40, 40), glass(1290, 0, 20, 80),
    ],
    targets: [goblin(1100, 40), goblin(1040, 160), goblin(1160, 160)],
  },
  {
    key: 'twins',
    ammo: 4,
    blocks: [
      wood(900, 0, 20, 120), wood(1000, 0, 20, 120), wood(950, 120, 140, 20),
      glass(910, 140, 20, 80), glass(990, 140, 20, 80), glass(950, 220, 120, 20),
      stone(1200, 0, 20, 120), stone(1300, 0, 20, 120), stone(1250, 120, 140, 20),
      wood(1210, 140, 20, 80), wood(1290, 140, 20, 80), wood(1250, 220, 120, 20),
    ],
    targets: [goblin(950, 240), goblin(1250, 140), goblin(1250, 240)],
  },
  {
    key: 'keep',
    ammo: 5,
    blocks: [
      stone(900, 0, 40, 160),
      stone(1020, 0, 20, 120), stone(1220, 0, 20, 120), wood(1120, 120, 240, 20),
      glass(1040, 140, 20, 100), glass(1200, 140, 20, 100), wood(1120, 240, 200, 20),
      wood(1080, 260, 20, 60), wood(1160, 260, 20, 60), glass(1120, 320, 120, 20),
      wood(1340, 0, 20, 140), wood(1420, 0, 20, 140), stone(1380, 140, 120, 20),
    ],
    targets: [goblin(1120, 0), goblin(1120, 140), goblin(1120, 260), goblin(1380, 160)],
  },
]);

/** Number of levels. */
export const LEVEL_COUNT = LEVELS.length;
