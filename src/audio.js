/**
 * Small synthesised sound effects with the Web Audio API (no sound files).
 * The AudioContext is created on the first user gesture, so browsers never block it.
 */
import { createRng } from './rng.js';

/** Storage key for the mute switch. */
export const MUTE_KEY = 'sapan.muted';

/** Hit sounds closer together than this (seconds) are skipped. */
const HIT_GAP = 0.06;

/**
 * @typedef {{unlock: () => void, setMuted: (muted: boolean) => void,
 *   play: (event: import('./game.js').GameEvent | {type: 'pull'}) => void}} Sound
 */

/**
 * Creates the sound player.
 * @returns {Sound}
 */
export function createSound() {
  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode|null} */
  let master = null;
  /** @type {AudioBuffer|null} */
  let noise = null;
  let muted = false;
  let lastHit = 0;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    const activation = globalThis.navigator?.userActivation;
    if (!Context || (activation && !activation.hasBeenActive)) return;
    try {
      ctx = new Context();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noise = makeNoise(ctx);
    } catch {
      ctx = null;
    }
  }

  /**
   * A tone that glides from one pitch to another and fades out.
   * @param {{from:number, to:number, dur:number, type?: OscillatorType, gain?:number, delay?:number}} spec
   */
  function tone({ from, to, dur, type = 'sine', gain = 0.3, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(amp).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /**
   * A filtered noise burst (thuds, cracks, whooshes).
   * @param {{dur:number, filter: BiquadFilterType, freq:number, to?:number, gain?:number}} spec
   */
  function hiss({ dur, filter, freq, to = freq, gain = 0.3 }) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const biquad = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = noise;
    biquad.type = filter;
    biquad.frequency.setValueAtTime(freq, t);
    biquad.frequency.exponentialRampToValueAtTime(to, t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(biquad).connect(amp).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    pull: () => tone({ from: 160, to: 220, dur: 0.12, type: 'triangle', gain: 0.08 }),
    launch: (e) => {
      hiss({ dur: 0.3, filter: 'bandpass', freq: 500, to: 1800, gain: 0.25 + 0.25 * e.power });
      tone({ from: 260, to: 120, dur: 0.18, type: 'triangle', gain: 0.15 });
    },
    hit: (e) => {
      if (ctx.currentTime - lastHit < HIT_GAP) return;
      lastHit = ctx.currentTime;
      tone({ from: 150, to: 55, dur: 0.14, gain: 0.1 + 0.3 * e.strength });
      hiss({ dur: 0.08, filter: 'lowpass', freq: 600, gain: 0.08 + 0.2 * e.strength });
    },
    break: (e) => BREAKS[e.material]?.(),
    defeat: () => {
      tone({ from: 320, to: 950, dur: 0.18, gain: 0.25 });
      hiss({ dur: 0.12, filter: 'bandpass', freq: 1400, gain: 0.15 });
    },
    won: () => [523, 659, 784, 1047].forEach((f, i) => tone({ from: f, to: f * 1.01, dur: 0.22, type: 'triangle', gain: 0.22, delay: i * 0.11 })),
    lost: () => [392, 330, 262].forEach((f, i) => tone({ from: f, to: f * 0.97, dur: 0.3, gain: 0.2, delay: i * 0.18 })),
  };

  const BREAKS = {
    glass: () => {
      hiss({ dur: 0.25, filter: 'highpass', freq: 3000, gain: 0.25 });
      tone({ from: 1900, to: 1300, dur: 0.15, type: 'triangle', gain: 0.08 });
    },
    wood: () => {
      hiss({ dur: 0.2, filter: 'bandpass', freq: 900, to: 400, gain: 0.3 });
      tone({ from: 180, to: 90, dur: 0.15, type: 'square', gain: 0.05 });
    },
    stone: () => hiss({ dur: 0.35, filter: 'lowpass', freq: 700, to: 200, gain: 0.45 }),
  };

  /** @param {{type: string}} event */
  function play(event) {
    if (!ctx || muted || ctx.state === 'closed') return;
    SOUNDS[event.type]?.(event);
  }

  return { unlock, setMuted: (value) => { muted = value; }, play };
}

/**
 * One second of seeded white noise.
 * @param {AudioContext} ctx
 * @returns {AudioBuffer}
 */
function makeNoise(ctx) {
  const rng = createRng(7);
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = rng() * 2 - 1;
  return buffer;
}
