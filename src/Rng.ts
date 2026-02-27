/**
 * Seeded pseudo-random number generator (mulberry32 algorithm).
 * Produces deterministic results given the same seed.
 */
export class Rng {
  private state: number;
  readonly seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 0xffffffff);
    this.state = this.seed;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Returns a random sign: -1 or +1 */
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }

  /** Pick a random element from an array */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Reset state back to seed */
  reset(): void {
    this.state = this.seed;
  }
}

/** Parse a seed string into a number (handles hex or decimal strings) */
export function parseSeed(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = parseInt(trimmed, 10);
  if (!isNaN(n) && isFinite(n)) return n >>> 0;
  // Try hex
  const h = parseInt(trimmed, 16);
  if (!isNaN(h) && isFinite(h)) return h >>> 0;
  // Fallback: hash the string
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = Math.imul(31, hash) + trimmed.charCodeAt(i) | 0;
  }
  return hash >>> 0;
}
