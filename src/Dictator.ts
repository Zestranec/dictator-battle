import * as PIXI from 'pixi.js';
import { Entity } from './Entity';
import { getCachedTexture } from './Assets';

export interface DictatorConfig {
  id: string;
  name: string;
  shortName: string;
  assetPath: string;
  fallbackColor: number;
  initials: string;
}

export const DICTATOR_CONFIGS: DictatorConfig[] = [
  {
    id: 'arafat',
    name: 'Yasser Arafat',
    shortName: 'Arafat',
    assetPath: '/assets/arafat.jpg',
    fallbackColor: 0x3a5a2a,
    initials: 'YA',
  },
  {
    id: 'hussein',
    name: 'Saddam Hussein',
    shortName: 'Hussein',
    assetPath: '/assets/hussein.jpg',
    fallbackColor: 0x5a3a1a,
    initials: 'SH',
  },
  {
    id: 'gaddafi',
    name: 'Muammar Gaddafi',
    shortName: 'Gaddafi',
    assetPath: '/assets/gaddafi.jpg',
    fallbackColor: 0x2a2a5a,
    initials: 'MG',
  },
  {
    id: 'lukashenko',
    name: 'Alexander Lukashenko',
    shortName: 'Lukashenko',
    assetPath: '/assets/lukashenko.jpg',
    fallbackColor: 0x5a1a1a,
    initials: 'AL',
  },
];

export type DictatorRole = 'none' | 'hunter' | 'runner';

export class Dictator extends Entity {
  readonly config: DictatorConfig;
  isPlayer: boolean;
  role: DictatorRole = 'none';
  baseSpeed: number = 120;
  speedMul: number = 1.0;

  // Pixi display objects — created once, reused each frame
  container: PIXI.Container;

  // faceContainer holds everything clipped to the ball circle.
  // It is masked by circleMask; Pixi sets circleMask.renderable=false automatically.
  private faceContainer: PIXI.Container;
  private circleMask: PIXI.Graphics;   // mask object — renderable=false after assignment
  private bgCircle: PIXI.Graphics;     // fallback color fill
  private sprite: PIXI.Sprite | null = null;
  private fallbackText: PIXI.Text;     // initials, shown when no photo

  // Outside faceContainer so they're not clipped by the circle mask
  private outlineRing: PIXI.Graphics;
  private roleIndicator: PIXI.Text;

  constructor(config: DictatorConfig, radius: number, isPlayer: boolean) {
    super(0, 0, radius);
    this.config = config;
    this.isPlayer = isPlayer;

    // ── Outer container ──────────────────────────────────────────────────────
    this.container = new PIXI.Container();

    // ── faceContainer: all ball visuals clipped to circle ────────────────────
    this.faceContainer = new PIXI.Container();

    // Circular mask — Pixi sets renderable=false when assigned as mask.
    // Must be a child of faceContainer so it inherits the correct world transform.
    this.circleMask = new PIXI.Graphics();
    this.circleMask.beginFill(0xffffff);
    this.circleMask.drawCircle(0, 0, radius);
    this.circleMask.endFill();
    this.faceContainer.addChild(this.circleMask);
    this.faceContainer.mask = this.circleMask; // sets circleMask.renderable = false

    // Background circle — visible when photo is missing
    this.bgCircle = new PIXI.Graphics();
    this.bgCircle.beginFill(config.fallbackColor);
    this.bgCircle.drawCircle(0, 0, radius);
    this.bgCircle.endFill();
    this.faceContainer.addChild(this.bgCircle);

    // Fallback initials — hidden once photo sprite is added
    this.fallbackText = new PIXI.Text(config.initials, {
      fontFamily: 'Arial',
      fontSize: radius * 0.7,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center',
    });
    this.fallbackText.anchor.set(0.5);
    this.faceContainer.addChild(this.fallbackText);

    this.container.addChild(this.faceContainer);

    // ── Outline ring — outside faceContainer so it's always fully visible ────
    this.outlineRing = new PIXI.Graphics();
    this.container.addChild(this.outlineRing);

    // ── Role indicator (🔪 / 🏃) — above everything, 3x size ────────────────
    this.roleIndicator = new PIXI.Text('', {
      fontFamily: 'Arial',
      fontSize: radius * 2.4,
      fill: 0xffffff,
    });
    this.roleIndicator.anchor.set(0.5);
    this.roleIndicator.position.set(0, -radius - 42);
    this.container.addChild(this.roleIndicator);

    this._drawOutline();

    // Apply cached texture synchronously (preloaded at startup via Assets.ts)
    const texture = getCachedTexture(config.assetPath);
    if (texture) {
      this._applyTexture(texture);
    }
  }

  private _applyTexture(texture: PIXI.Texture): void {
    this.sprite = new PIXI.Sprite(texture);
    this.sprite.anchor.set(0.5);

    // Cover-fit: scale so the shorter dimension fills the full diameter
    const diameter = this.radius * 2;
    const scale = diameter / Math.min(texture.width, texture.height);
    this.sprite.scale.set(scale);

    // Insert above bgCircle (index 2: after circleMask=0 and bgCircle=1)
    // The sprite is clipped by faceContainer's mask automatically.
    this.faceContainer.addChildAt(this.sprite, 2);
    this.fallbackText.visible = false;
  }

  private _drawOutline(): void {
    this.outlineRing.clear();
    if (this.isPlayer) {
      this.outlineRing.lineStyle(3, 0xd0a0ff, 1);
      this.outlineRing.drawCircle(0, 0, this.radius + 4);
    }
    if (this.role === 'hunter') {
      this.outlineRing.lineStyle(3, 0xff4040, 1);
      this.outlineRing.drawCircle(0, 0, this.radius + (this.isPlayer ? 8 : 4));
    } else if (this.role === 'runner') {
      this.outlineRing.lineStyle(3, 0x40c0ff, 1);
      this.outlineRing.drawCircle(0, 0, this.radius + (this.isPlayer ? 8 : 4));
    }
  }

  setRole(role: DictatorRole): void {
    this.role = role;
    this._drawOutline();
    switch (role) {
      case 'hunter':
        this.roleIndicator.text = '🔪';
        break;
      case 'runner':
        this.roleIndicator.text = '🏃';
        break;
      default:
        this.roleIndicator.text = '';
    }
  }

  syncRender(): void {
    this.container.position.set(this.pos.x, this.pos.y);
  }

  get currentSpeed(): number {
    return this.baseSpeed * this.speedMul;
  }
}
