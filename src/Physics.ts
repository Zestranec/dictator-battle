import { Entity } from './Entity';
import { Arena } from './Arena';

/** Advance entity position by dt seconds */
export function integrateEntity(entity: Entity, dt: number): void {
  entity.pos.x += entity.vel.x * dt;
  entity.pos.y += entity.vel.y * dt;
}

/** Bounce entity off arena walls (reflect velocity) */
export function bounceWalls(entity: Entity, arena: Arena): void {
  const r = entity.radius;

  if (entity.pos.x - r < arena.left) {
    entity.pos.x = arena.left + r;
    entity.vel.x = Math.abs(entity.vel.x);
  } else if (entity.pos.x + r > arena.right) {
    entity.pos.x = arena.right - r;
    entity.vel.x = -Math.abs(entity.vel.x);
  }

  if (entity.pos.y - r < arena.top) {
    entity.pos.y = arena.top + r;
    entity.vel.y = Math.abs(entity.vel.y);
  } else if (entity.pos.y + r > arena.bottom) {
    entity.pos.y = arena.bottom - r;
    entity.vel.y = -Math.abs(entity.vel.y);
  }
}

/** Elastic bounce between two entities */
export function bounceEntities(a: Entity, b: Entity): boolean {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = a.radius + b.radius;

  if (dist >= minDist || dist < 0.0001) return false;

  // Push apart
  const overlap = minDist - dist;
  const nx = dx / dist;
  const ny = dy / dist;
  a.pos.x -= nx * overlap * 0.5;
  a.pos.y -= ny * overlap * 0.5;
  b.pos.x += nx * overlap * 0.5;
  b.pos.y += ny * overlap * 0.5;

  // Reflect velocity components along collision normal
  const relVx = a.vel.x - b.vel.x;
  const relVy = a.vel.y - b.vel.y;
  const dot = relVx * nx + relVy * ny;

  // Only resolve if approaching
  if (dot > 0) {
    a.vel.x -= dot * nx;
    a.vel.y -= dot * ny;
    b.vel.x += dot * nx;
    b.vel.y += dot * ny;
  }

  return true;
}

/** Distance between two entity centers */
export function entityDistance(a: Entity, b: Entity): number {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Check if two entities are overlapping (touching) */
export function entitiesOverlap(a: Entity, b: Entity): boolean {
  return entityDistance(a, b) <= a.radius + b.radius;
}

/** Clamp entity inside arena (hard boundary, no bounce) */
export function clampToArena(entity: Entity, arena: Arena): void {
  const r = entity.radius;
  entity.pos.x = Math.max(arena.left + r, Math.min(arena.right - r, entity.pos.x));
  entity.pos.y = Math.max(arena.top + r, Math.min(arena.bottom - r, entity.pos.y));
}
