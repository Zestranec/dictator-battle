import * as PIXI from 'pixi.js';
import { Game } from './Game';
import { preloadTextures } from './Assets';
import { DICTATOR_CONFIGS } from './Dictator';

const CANVAS_SIZE = 560;

async function main(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const container = document.getElementById('canvas-container') as HTMLElement;

  const app = new PIXI.Application({
    view: canvas,
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: 0x0a0a10,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.style.width = `${CANVAS_SIZE}px`;
  container.style.height = `${CANVAS_SIZE}px`;

  function fitToViewport(): void {
    const maxW = window.innerWidth - 320;
    const maxH = window.innerHeight - 80;
    const maxSize = Math.max(300, Math.min(maxW, maxH, CANVAS_SIZE));
    const scale = maxSize / CANVAS_SIZE;
    canvas.style.width = `${CANVAS_SIZE * scale}px`;
    canvas.style.height = `${CANVAS_SIZE * scale}px`;
    container.style.width = `${CANVAS_SIZE * scale}px`;
    container.style.height = `${CANVAS_SIZE * scale}px`;
  }

  fitToViewport();
  window.addEventListener('resize', fitToViewport);

  // Preload all dictator textures once before creating Game.
  // Dictator instances read from cache synchronously — no per-round async loads.
  await preloadTextures(DICTATOR_CONFIGS.map(c => c.assetPath));

  new Game(app);
}

main().catch(console.error);
