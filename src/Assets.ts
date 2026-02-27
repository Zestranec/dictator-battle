import * as PIXI from 'pixi.js';

/**
 * Central texture cache. Populated once at startup via preloadTextures().
 * Dictator instances read from here synchronously — no per-instance async loading.
 */
const cache = new Map<string, PIXI.Texture>();

/**
 * Load all paths in parallel (errors silently fall back to null → initials shown).
 * Call this ONCE before creating a Game instance.
 */
export async function preloadTextures(paths: string[]): Promise<void> {
  await Promise.allSettled(
    paths.map(async (path) => {
      try {
        const tex = await PIXI.Assets.load(path);
        if (tex && tex.valid) {
          cache.set(path, tex);
        }
      } catch {
        // File missing or load error — fallback circle + initials will be used.
      }
    })
  );
}

/** Synchronous texture retrieval after preload. Returns null if missing/failed. */
export function getCachedTexture(path: string): PIXI.Texture | null {
  return cache.get(path) ?? null;
}
