import * as PIXI from 'pixi.js';

export class Knife {
  pos: { x: number; y: number };
  readonly radius: number = 20;
  pickedUp: boolean = false;

  container: PIXI.Container;
  private icon: PIXI.Text;
  private pulseTime: number = 0;

  constructor(x: number, y: number) {
    this.pos = { x, y };

    this.container = new PIXI.Container();

    // Glow circle — scaled to match bigger icon
    const glow = new PIXI.Graphics();
    glow.beginFill(0xffdd00, 0.22);
    glow.drawCircle(0, 0, this.radius + 18);
    glow.endFill();
    this.container.addChild(glow);

    // 3x larger knife icon (was 30, now 90)
    this.icon = new PIXI.Text('🔪', {
      fontFamily: 'Arial',
      fontSize: 90,
      align: 'center',
    });
    this.icon.anchor.set(0.5);
    this.container.addChild(this.icon);

    this.container.position.set(x, y);
  }

  /** Animate pulse each frame (dt in seconds) */
  update(dt: number): void {
    this.pulseTime += dt;
    const scale = 0.9 + 0.1 * Math.sin(this.pulseTime * 5);
    this.container.scale.set(scale);
  }

  hide(): void {
    this.container.visible = false;
  }

  show(): void {
    this.container.visible = true;
  }
}
