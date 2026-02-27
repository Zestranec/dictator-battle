/**
 * Headless simulation module.
 * No PixiJS, no DOM — pure physics + logic.
 *
 * Run with: npx tsx src/Simulation.ts
 * Or import runSimulation() for programmatic use.
 */

import { Rng } from './Rng';
import { OutcomeController } from './OutcomeController';

// ---- Minimal physics types (no Pixi dependency) ----
interface Vec2 { x: number; y: number; }

interface SimEntity {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  speedMul: number;
}

interface SimArena {
  left: number; right: number;
  top: number; bottom: number;
  centerX: number; centerY: number;
}

// ---- Constants (must match Game.ts) ----
const BASE_SPEED = 120;
const CHASE_SPEED_MUL = 2.0;
const PREWAIT_DURATION = 1.0;
const PREKNIFE_DURATION = 3.0;
const CHASE_DURATION = 10.0;
const BALL_RADIUS = 28;
const KNIFE_RADIUS = 20;
const FIXED_DT = 1 / 60;
const ARENA_SIZE = 520;

// ---- Physics helpers ----
function integrate(e: SimEntity, dt: number): void {
  e.pos.x += e.vel.x * dt;
  e.pos.y += e.vel.y * dt;
}

function bounceWalls(e: SimEntity, arena: SimArena): void {
  const r = e.radius;
  if (e.pos.x - r < arena.left) { e.pos.x = arena.left + r; e.vel.x = Math.abs(e.vel.x); }
  else if (e.pos.x + r > arena.right) { e.pos.x = arena.right - r; e.vel.x = -Math.abs(e.vel.x); }
  if (e.pos.y - r < arena.top) { e.pos.y = arena.top + r; e.vel.y = Math.abs(e.vel.y); }
  else if (e.pos.y + r > arena.bottom) { e.pos.y = arena.bottom - r; e.vel.y = -Math.abs(e.vel.y); }
}

function bounceEntities(a: SimEntity, b: SimEntity): void {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = a.radius + b.radius;
  if (dist >= minDist || dist < 0.0001) return;
  const overlap = minDist - dist;
  const nx = dx / dist; const ny = dy / dist;
  a.pos.x -= nx * overlap * 0.5; a.pos.y -= ny * overlap * 0.5;
  b.pos.x += nx * overlap * 0.5; b.pos.y += ny * overlap * 0.5;
  const relVx = a.vel.x - b.vel.x; const relVy = a.vel.y - b.vel.y;
  const dot = relVx * nx + relVy * ny;
  if (dot > 0) { a.vel.x -= dot * nx; a.vel.y -= dot * ny; b.vel.x += dot * nx; b.vel.y += dot * ny; }
}

function dist2D(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function normSpeed(e: SimEntity, speed: number): void {
  const s = Math.sqrt(e.vel.x * e.vel.x + e.vel.y * e.vel.y);
  if (s < 0.0001) return;
  e.vel.x = (e.vel.x / s) * speed; e.vel.y = (e.vel.y / s) * speed;
}

// ---- AI helpers ----
function wanderImpulse(e: SimEntity, rng: Rng, dt: number, mul: number): void {
  const a = rng.range(0, Math.PI * 2);
  const mag = rng.range(0, 80) * mul;
  e.vel.x += Math.cos(a) * mag * dt;
  e.vel.y += Math.sin(a) * mag * dt;
}

function hunterImpulse(hunter: SimEntity, target: SimEntity, dt: number, mul: number): void {
  const dx = target.pos.x - hunter.pos.x;
  const dy = target.pos.y - hunter.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.001) return;
  hunter.vel.x += (dx / d) * 200 * mul * dt;
  hunter.vel.y += (dy / d) * 200 * mul * dt;
}

function runnerImpulse(runner: SimEntity, pursuer: SimEntity, rng: Rng, dt: number, mul: number): void {
  const dx = runner.pos.x - pursuer.pos.x;
  const dy = runner.pos.y - pursuer.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.001) return;
  const perp = rng.range(-0.4, 0.4);
  const ex = dx / d + (-dy / d) * perp;
  const ey = dy / d + (dx / d) * perp;
  runner.vel.x += ex * 200 * mul * dt;
  runner.vel.y += ey * 200 * mul * dt;
}

function centerAttract(e: SimEntity, cx: number, cy: number, dt: number, strength: number): void {
  const dx = cx - e.pos.x; const dy = cy - e.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.001) return;
  e.vel.x += (dx / d) * strength * dt;
  e.vel.y += (dy / d) * strength * dt;
}

// ---- Single round simulation ----
function simulateRound(
  rng: Rng,
  outcome: OutcomeController,
  arena: SimArena
): boolean {
  outcome.sampleOutcome(rng);

  const cx = arena.centerX; const cy = arena.centerY;
  const sep = BALL_RADIUS * 3;

  const ePlayer: SimEntity = {
    pos: { x: cx - sep, y: cy },
    vel: { x: 0, y: 0 },
    radius: BALL_RADIUS,
    speedMul: outcome.speedMultiplier(),
  };
  const eOpponent: SimEntity = {
    pos: { x: cx + sep, y: cy },
    vel: { x: 0, y: 0 },
    radius: BALL_RADIUS,
    speedMul: 1.0,
  };

  const a1 = rng.range(0, Math.PI * 2);
  const a2 = a1 + Math.PI + rng.range(-0.5, 0.5);
  ePlayer.vel.x = Math.cos(a1) * BASE_SPEED;
  ePlayer.vel.y = Math.sin(a1) * BASE_SPEED;
  eOpponent.vel.x = Math.cos(a2) * BASE_SPEED;
  eOpponent.vel.y = Math.sin(a2) * BASE_SPEED;

  const pickupRadius = BALL_RADIUS + KNIFE_RADIUS;
  let knifePickedUp = false;
  let playerIsHunter = false;
  let phaseTimer = PREWAIT_DURATION + PREKNIFE_DURATION;
  let chaseTimer = CHASE_DURATION;
  let knifeSpawned = false;
  let prewaitDone = false;
  let preknifeDone = false;
  let prewaitTimer = PREWAIT_DURATION;
  let preknifeDone2Timer = PREKNIFE_DURATION;

  const MAX_TICKS = Math.ceil((PREWAIT_DURATION + PREKNIFE_DURATION + CHASE_DURATION + 5) / FIXED_DT);

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const dt = FIXED_DT;

    if (!prewaitDone) {
      prewaitTimer -= dt;
      wanderImpulse(ePlayer, rng, dt, 0.5);
      wanderImpulse(eOpponent, rng, dt, 0.5);
      if (prewaitTimer <= 0) prewaitDone = true;
    } else if (!knifeSpawned) {
      preknifeDone2Timer -= dt;
      wanderImpulse(ePlayer, rng, dt, 1.0);
      wanderImpulse(eOpponent, rng, dt, 1.0);
      if (preknifeDone2Timer <= 0) knifeSpawned = true;
    } else if (!knifePickedUp) {
      // Knife pickup phase
      const knifeAttr = outcome.knifeAttractionStrength();
      centerAttract(ePlayer, cx, cy, dt, knifeAttr);
      wanderImpulse(ePlayer, rng, dt, 0.8);
      wanderImpulse(eOpponent, rng, dt, 0.8);

      const dpA = dist2D(ePlayer.pos, { x: cx, y: cy });
      const dpB = dist2D(eOpponent.pos, { x: cx, y: cy });
      if (dpA <= pickupRadius || dpB <= pickupRadius) {
        knifePickedUp = true;
        playerIsHunter = dpA < dpB;
        const chaseSpeed = BASE_SPEED * CHASE_SPEED_MUL;
        ePlayer.speedMul = outcome.speedMultiplier();
        normSpeed(ePlayer, chaseSpeed * ePlayer.speedMul);
        normSpeed(eOpponent, chaseSpeed);
      }
    } else {
      // Chase phase
      chaseTimer -= dt;

      const isPlayerHunter = playerIsHunter;
      const playerSteerMul = outcome.steeringMultiplier(isPlayerHunter);

      const hunter = isPlayerHunter ? ePlayer : eOpponent;
      const runner = isPlayerHunter ? eOpponent : ePlayer;
      const hunterMul = isPlayerHunter ? playerSteerMul : 1.0;
      const runnerMul = !isPlayerHunter ? playerSteerMul : 1.0;

      hunterImpulse(hunter, runner, dt, hunterMul);
      runnerImpulse(runner, hunter, rng, dt, runnerMul);

      normSpeed(hunter, BASE_SPEED * CHASE_SPEED_MUL * hunter.speedMul);
      normSpeed(runner, BASE_SPEED * CHASE_SPEED_MUL * runner.speedMul);

      const d = dist2D(hunter.pos, runner.pos);
      if (d <= hunter.radius + runner.radius) {
        return playerIsHunter; // player wins if they were hunter and caught
      }
      if (chaseTimer <= 0) {
        return !playerIsHunter; // player wins if they were runner and survived
      }
    }

    // Integrate + bounce
    normSpeed(ePlayer, BASE_SPEED * ePlayer.speedMul);
    normSpeed(eOpponent, BASE_SPEED);
    integrate(ePlayer, dt);
    integrate(eOpponent, dt);
    bounceWalls(ePlayer, arena);
    bounceWalls(eOpponent, arena);
    bounceEntities(ePlayer, eOpponent);
  }

  // Fallback: runner wins (timeout)
  return !playerIsHunter;
}

// ---- Main simulation runner ----
export interface SimulationResult {
  rounds: number;
  wins: number;
  losses: number;
  observedWinRate: number;
  totalBet: number;
  totalPayout: number;
  rtp: number;
  configuredWinChance: number;
  expectedRtp: number;
}

export function runSimulation(
  rounds: number = 100_000,
  winChance: number = 0.5,
  betAmount: number = 10,
  baseSeed: number = 42
): SimulationResult {
  const arena: SimArena = {
    left: 0, right: ARENA_SIZE,
    top: 0, bottom: ARENA_SIZE,
    centerX: ARENA_SIZE / 2, centerY: ARENA_SIZE / 2,
  };

  const outcome = new OutcomeController(winChance);
  let wins = 0;
  let totalPayout = 0;
  const PAYOUT_MUL = 1.9;

  for (let i = 0; i < rounds; i++) {
    const rng = new Rng(baseSeed + i);
    const won = simulateRound(rng, outcome, arena);
    if (won) {
      wins++;
      totalPayout += betAmount * PAYOUT_MUL;
    }
  }

  const totalBet = rounds * betAmount;
  const rtp = totalPayout / totalBet;
  const observedWinRate = wins / rounds;

  return {
    rounds,
    wins,
    losses: rounds - wins,
    observedWinRate,
    totalBet,
    totalPayout,
    rtp,
    configuredWinChance: winChance,
    expectedRtp: PAYOUT_MUL * winChance,
  };
}

// ---- CLI entry point ----
// Detect if running directly (not imported)
const isMain = typeof process !== 'undefined' && process.argv[1]?.endsWith('Simulation.ts');
if (isMain) {
  console.log('=== Dictator Battle — Headless RTP Simulation ===\n');

  const configs: Array<{ winChance: number; rounds: number }> = [
    { winChance: 0.1, rounds: 100_000 },
    { winChance: 0.3, rounds: 100_000 },
    { winChance: 0.5, rounds: 100_000 },
    { winChance: 0.7, rounds: 100_000 },
    { winChance: 0.9, rounds: 100_000 },
  ];

  for (const cfg of configs) {
    const t0 = Date.now();
    const result = runSimulation(cfg.rounds, cfg.winChance);
    const elapsed = Date.now() - t0;

    console.log(`Win Chance: ${(cfg.winChance * 100).toFixed(0)}%`);
    console.log(`  Rounds       : ${result.rounds.toLocaleString()}`);
    console.log(`  Wins         : ${result.wins.toLocaleString()} (${(result.observedWinRate * 100).toFixed(2)}%)`);
    console.log(`  Total Bet    : ${result.totalBet.toLocaleString()} FUN`);
    console.log(`  Total Payout : ${result.totalPayout.toLocaleString()} FUN`);
    console.log(`  RTP          : ${(result.rtp * 100).toFixed(2)}% (expected: ${(result.expectedRtp * 100).toFixed(2)}%)`);
    console.log(`  Time         : ${elapsed}ms\n`);
  }
}
