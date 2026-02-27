/** Defines the square arena boundaries */
export class Arena {
  readonly x: number;
  readonly y: number;
  readonly size: number;

  constructor(x: number, y: number, size: number) {
    this.x = x;
    this.y = y;
    this.size = size;
  }

  get left(): number { return this.x; }
  get right(): number { return this.x + this.size; }
  get top(): number { return this.y; }
  get bottom(): number { return this.y + this.size; }
  get centerX(): number { return this.x + this.size / 2; }
  get centerY(): number { return this.y + this.size / 2; }
}
