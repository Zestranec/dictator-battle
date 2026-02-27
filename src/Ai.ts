import { Entity } from './Entity';
import { Rng } from './Rng';

/** Maximum impulse magnitude applied per second for steering */
const MAX_WANDER_IMPULSE = 80;
const MAX_HUNT_IMPULSE = 200;
const MAX_EVADE_IMPULSE = 200;
const MAX_KNIFE_SEEK_IMPULSE = 200;
const TURN_RATE_CAP = 3.0; // radians per second max turn

/** Apply a steering impulse, capped by TURN_RATE_CAP */
function applyImpulse(entity: Entity, ix: number, iy: number, dt: number, impulseMul: number = 1): void {
  const scaledX = ix * impulseMul * dt;
  const scaledY = iy * impulseMul * dt;
  entity.vel.x += scaledX;
  entity.vel.y += scaledY;
  const spd = entity.speed;
  if (spd > 0.001) {
    const maxDelta = spd * Math.tan(TURN_RATE_CAP * dt);
    const nx = entity.vel.x / spd;
    const ny = entity.vel.y / spd;
    const addedVelX = scaledX;
    const addedVelY = scaledY;
    const perpComp = addedVelX * (-ny) + addedVelY * nx;
    if (Math.abs(perpComp) > maxDelta) {
      const clamp = maxDelta * Math.sign(perpComp);
      const factor = clamp / perpComp;
      entity.vel.x = entity.vel.x - scaledX + scaledX * factor;
      entity.vel.y = entity.vel.y - scaledY + scaledY * factor;
    }
  }
}

/** Pre-knife wandering: mild random steering impulses */
export function applyWanderSteering(
  entity: Entity,
  rng: Rng,
  dt: number,
  impulseMul: number = 1.0
): void {
  const angle = rng.range(0, Math.PI * 2);
  const magnitude = rng.range(0, MAX_WANDER_IMPULSE) * impulseMul;
  const ix = Math.cos(angle) * magnitude;
  const iy = Math.sin(angle) * magnitude;
  applyImpulse(entity, ix, iy, dt, 1);
}

/**
 * KnifeRace seeking: steer entity toward the knife position.
 * biasDelta adds/subtracts from the base impulse for outcome control (e.g. ±20).
 * Keeps natural feel via TURN_RATE_CAP.
 */
export function applyKnifeSeekSteering(
  entity: Entity,
  knifeX: number,
  knifeY: number,
  dt: number,
  biasDelta: number = 0,
): void {
  const dx = knifeX - entity.pos.x;
  const dy = knifeY - entity.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const strength = MAX_KNIFE_SEEK_IMPULSE + biasDelta;
  applyImpulse(entity, nx * strength, ny * strength, dt, 1);
}

/** Pre-knife center attraction (kept for Simulation.ts compatibility) */
export function applyCenterAttraction(
  entity: Entity,
  centerX: number,
  centerY: number,
  dt: number,
  strength: number
): void {
  const dx = centerX - entity.pos.x;
  const dy = centerY - entity.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return;
  const ix = (dx / dist) * strength;
  const iy = (dy / dist) * strength;
  applyImpulse(entity, ix, iy, dt, 1);
}

/** Hunter pursuer steering toward target */
export function applyHunterSteering(
  hunter: Entity,
  target: Entity,
  dt: number,
  impulseMul: number = 1.0
): void {
  const dx = target.pos.x - hunter.pos.x;
  const dy = target.pos.y - hunter.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return;
  const nx = dx / dist;
  const ny = dy / dist;
  applyImpulse(hunter, nx * MAX_HUNT_IMPULSE, ny * MAX_HUNT_IMPULSE, dt, impulseMul);
}

/** Runner evade steering away from pursuer */
export function applyRunnerSteering(
  runner: Entity,
  pursuer: Entity,
  rng: Rng,
  dt: number,
  impulseMul: number = 1.0
): void {
  const dx = runner.pos.x - pursuer.pos.x;
  const dy = runner.pos.y - pursuer.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const perp = rng.range(-0.4, 0.4);
  const evadeX = nx + (-ny) * perp;
  const evadeY = ny + nx * perp;
  applyImpulse(runner, evadeX * MAX_EVADE_IMPULSE, evadeY * MAX_EVADE_IMPULSE, dt, impulseMul);
}
