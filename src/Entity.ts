/** Base physics entity: position + velocity */
export interface Vec2 {
  x: number;
  y: number;
}

export class Entity {
  pos: Vec2;
  vel: Vec2;
  radius: number;

  constructor(x: number, y: number, radius: number) {
    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };
    this.radius = radius;
  }

  get speed(): number {
    return Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
  }

  /** Set velocity by angle (radians) and magnitude */
  setVelocityAngle(angle: number, speed: number): void {
    this.vel.x = Math.cos(angle) * speed;
    this.vel.y = Math.sin(angle) * speed;
  }

  /** Normalize velocity to a given speed (no-op if speed is 0) */
  normalizeSpeed(targetSpeed: number): void {
    const s = this.speed;
    if (s < 0.0001) return;
    this.vel.x = (this.vel.x / s) * targetSpeed;
    this.vel.y = (this.vel.y / s) * targetSpeed;
  }

  /** Clamp velocity magnitude to maxSpeed */
  clampSpeed(maxSpeed: number): void {
    const s = this.speed;
    if (s > maxSpeed) {
      this.vel.x = (this.vel.x / s) * maxSpeed;
      this.vel.y = (this.vel.y / s) * maxSpeed;
    }
  }
}
