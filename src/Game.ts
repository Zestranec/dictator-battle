import * as PIXI from 'pixi.js';
import { Arena } from './Arena';
import { Dictator, DICTATOR_CONFIGS, DictatorConfig } from './Dictator';
import { Knife } from './Knife';
import {
  integrateEntity,
  bounceWalls,
  bounceEntities,
  entityDistance,
} from './Physics';
import {
  applyWanderSteering,
  applyKnifeSeekSteering,
  applyHunterSteering,
  applyRunnerSteering,
} from './Ai';
import { Economy } from './Economy';
import { Rng, parseSeed } from './Rng';
import { OutcomeController } from './OutcomeController';
import { Ui, UiState } from './Ui';

// ---- Constants ----
const ARENA_PADDING = 20;
const BALL_RADIUS = 28;
const BASE_SPEED = 120;
const CHASE_SPEED_MUL = 2.0;
const PREWAIT_DURATION = 1.0;
const PREKNIFE_DURATION = 1.5;
const CHASE_DURATION = 10.0;
const FIXED_DT = 1 / 60;

// Phases:
//  idle      — waiting for player to press play
//  prewait   — brief settle (1s, gentle wander)
//  preknife  — countdown before knife spawns (1.5s, active wander)
//  kniferace — knife is at center; BOTH balls race to pick it up
//  chase     — hunter pursues runner until capture or timeout
//  ended     — round result shown
type GamePhase = 'idle' | 'prewait' | 'preknife' | 'kniferace' | 'chase' | 'ended';

export class Game {
  private app: PIXI.Application;
  private arena: Arena;
  private dictators: [Dictator, Dictator] = [] as unknown as [Dictator, Dictator];
  private knife: Knife | null = null;
  private economy: Economy;
  private rng!: Rng;
  private outcome: OutcomeController;
  private ui: Ui;

  private phase: GamePhase = 'idle';
  private phaseTimer: number = 0;
  private accumulator: number = 0;
  private speedScale: number = 1;

  private stage: PIXI.Container;
  private arenaGfx: PIXI.Graphics;

  private playerDictId: string = 'arafat';
  private lastBet: number = 10;
  private _knifePickedUp: boolean = false;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.economy = new Economy(1000);
    this.outcome = new OutcomeController(0.5);

    this.stage = new PIXI.Container();
    app.stage.addChild(this.stage);

    this.arenaGfx = new PIXI.Graphics();
    this.stage.addChild(this.arenaGfx);

    this.arena = this._buildArena();

    this.ui = new Ui(
      (state) => this._onPlay(state),
      (fast) => { this.speedScale = fast ? 2 : 1; }
    );

    this.ui.setBalance(this.economy.balance);
    this.ui.setStatus('ready');
    this.ui.setPhase('ready');

    app.ticker.add((delta) => {
      const dtSeconds = (delta / 60) * this.speedScale;
      this._update(dtSeconds);
    });

    this._drawArena();
    this._initDictators();
    this._hideDictators();
  }

  private _buildArena(): Arena {
    const size = Math.min(this.app.screen.width, this.app.screen.height) - ARENA_PADDING * 2;
    const ox = (this.app.screen.width - size) / 2;
    const oy = (this.app.screen.height - size) / 2;
    return new Arena(ox, oy, size);
  }

  resize(): void {
    this.arena = this._buildArena();
    this._drawArena();
  }

  private _drawArena(): void {
    this.arenaGfx.clear();
    const { x, y, size } = this.arena;

    this.arenaGfx.beginFill(0x0d1020);
    this.arenaGfx.drawRect(x, y, size, size);
    this.arenaGfx.endFill();

    this.arenaGfx.lineStyle(1, 0x1a2040, 0.5);
    const gridStep = size / 8;
    for (let i = 1; i < 8; i++) {
      this.arenaGfx.moveTo(x + gridStep * i, y);
      this.arenaGfx.lineTo(x + gridStep * i, y + size);
      this.arenaGfx.moveTo(x, y + gridStep * i);
      this.arenaGfx.lineTo(x + size, y + gridStep * i);
    }

    this.arenaGfx.lineStyle(3, 0x4a3060, 1);
    this.arenaGfx.drawRect(x, y, size, size);

    this.arenaGfx.lineStyle(1, 0x2a2050, 0.6);
    this.arenaGfx.moveTo(x + size / 2, y + size * 0.3);
    this.arenaGfx.lineTo(x + size / 2, y + size * 0.7);
    this.arenaGfx.moveTo(x + size * 0.3, y + size / 2);
    this.arenaGfx.lineTo(x + size * 0.7, y + size / 2);
  }

  private _initDictators(): void {
    const configA = DICTATOR_CONFIGS[0];
    const configB = DICTATOR_CONFIGS[1];
    const dA = new Dictator(configA, BALL_RADIUS, true);
    const dB = new Dictator(configB, BALL_RADIUS, false);
    this.stage.addChild(dA.container);
    this.stage.addChild(dB.container);
    this.dictators = [dA, dB];
  }

  private _hideDictators(): void {
    this.dictators.forEach(d => { d.container.visible = false; });
    if (this.knife) this.knife.hide();
  }

  private _onPlay(state: UiState): void {
    if (this.phase !== 'idle' && this.phase !== 'ended') return;

    const bet = state.betAmount;
    if (!this.economy.placeBet(bet)) {
      console.warn('Insufficient balance');
      return;
    }
    this.lastBet = bet;
    this.playerDictId = state.selectedDictatorId;
    this.outcome.setWinChance(state.winChance);

    const seedVal = parseSeed(state.seedInput);
    this.rng = new Rng(seedVal);
    this.ui.setSeed(this.rng.seed);

    this.outcome.sampleOutcome(this.rng);
    this.ui.setBalance(this.economy.balance);
    this.ui.setStatus('running');

    this._startRound();
  }

  private _startRound(): void {
    this._cleanupKnife();

    const playerConfig = DICTATOR_CONFIGS.find(d => d.id === this.playerDictId)!;
    const opponentConfig = this._pickOpponent(playerConfig);

    this.dictators.forEach(d => { this.stage.removeChild(d.container); });

    const dPlayer = new Dictator(playerConfig, BALL_RADIUS, true);
    const dOpponent = new Dictator(opponentConfig, BALL_RADIUS, false);
    this.stage.addChild(dPlayer.container);
    this.stage.addChild(dOpponent.container);
    this.dictators = [dPlayer, dOpponent];

    const speedMul = this.outcome.speedMultiplier();
    dPlayer.speedMul = speedMul;
    dOpponent.speedMul = 1.0;

    const cx = this.arena.centerX;
    const cy = this.arena.centerY;
    const sep = BALL_RADIUS * 3;
    dPlayer.pos.x = cx - sep;
    dPlayer.pos.y = cy;
    dOpponent.pos.x = cx + sep;
    dOpponent.pos.y = cy;

    const angle1 = this.rng.range(0, Math.PI * 2);
    const angle2 = angle1 + Math.PI + this.rng.range(-0.5, 0.5);
    dPlayer.setVelocityAngle(angle1, BASE_SPEED);
    dOpponent.setVelocityAngle(angle2, BASE_SPEED);

    dPlayer.container.visible = true;
    dOpponent.container.visible = true;
    dPlayer.setRole('none');
    dOpponent.setRole('none');
    dPlayer.syncRender();
    dOpponent.syncRender();

    this.phase = 'prewait';
    this.phaseTimer = PREWAIT_DURATION;
    this.accumulator = 0;
    this.ui.setPhase('prewait', PREWAIT_DURATION);
  }

  private _pickOpponent(playerConfig: DictatorConfig): DictatorConfig {
    const others = DICTATOR_CONFIGS.filter(d => d.id !== playerConfig.id);
    return others[this.rng.int(0, others.length - 1)];
  }

  private _update(dt: number): void {
    if (this.phase === 'idle' || this.phase === 'ended') return;

    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT) {
      this._tick(FIXED_DT);
      this.accumulator -= FIXED_DT;
      if ((this.phase as string) === 'ended') break;
    }

    this.dictators.forEach(d => d.syncRender());
    if (this.knife && !this._knifePickedUp) this.knife.update(dt);
  }

  private _tick(dt: number): void {
    const [dA, dB] = this.dictators;

    switch (this.phase) {
      case 'prewait':
        this._tickPrewait(dt, dA, dB);
        break;
      case 'preknife':
        this._tickPreknife(dt, dA, dB);
        break;
      case 'kniferace':
        this._tickKnifeRace(dt, dA, dB);
        break;
      case 'chase':
        this._tickChase(dt, dA, dB);
        break;
    }

    if ((this.phase as string) === 'ended') return;

    [dA, dB].forEach(d => {
      d.normalizeSpeed(d.currentSpeed);
      integrateEntity(d, dt);
      bounceWalls(d, this.arena);
    });
    bounceEntities(dA, dB);
  }

  private _tickPrewait(dt: number, dA: Dictator, dB: Dictator): void {
    this.phaseTimer -= dt;
    this.ui.setPhase('prewait', Math.max(0, this.phaseTimer));
    applyWanderSteering(dA, this.rng, dt, 0.5);
    applyWanderSteering(dB, this.rng, dt, 0.5);
    if (this.phaseTimer <= 0) {
      this.phase = 'preknife';
      this.phaseTimer = PREKNIFE_DURATION;
    }
  }

  private _tickPreknife(dt: number, dA: Dictator, dB: Dictator): void {
    this.phaseTimer -= dt;
    this.ui.setPhase('preknife', Math.max(0, this.phaseTimer));
    applyWanderSteering(dA, this.rng, dt, 1.0);
    applyWanderSteering(dB, this.rng, dt, 1.0);
    if (this.phaseTimer <= 0) {
      this._spawnKnife();
    }
  }

  private _spawnKnife(): void {
    // Always at exact arena center
    const cx = this.arena.centerX;
    const cy = this.arena.centerY;

    if (!this.knife) {
      this.knife = new Knife(cx, cy);
      this.stage.addChild(this.knife.container);
    } else {
      this.knife.pos.x = cx;
      this.knife.pos.y = cy;
      this.knife.pickedUp = false;
      this.knife.container.position.set(cx, cy);
      this.knife.container.scale.set(1);
      this.knife.show();
    }

    this._knifePickedUp = false;
    // Transition to knife-race: both balls rush to pick it up
    this.phase = 'kniferace';
    this.ui.setPhase('knifeSpawned');
  }

  /**
   * KnifeRace phase: both dictators steer toward the knife.
   * Outcome bias nudges the player's entity slightly more / less attracted.
   */
  private _tickKnifeRace(dt: number, dA: Dictator, dB: Dictator): void {
    if (!this.knife) return;

    const kx = this.knife.pos.x;
    const ky = this.knife.pos.y;
    const [dPlayer, dOpponent] = this.dictators;

    // Outcome bias: ±10% of base seek impulse (subtle)
    const biasDelta = this.outcome.knifeAttractionStrength() * 0.1;

    applyKnifeSeekSteering(dPlayer, kx, ky, dt, biasDelta);
    applyKnifeSeekSteering(dOpponent, kx, ky, dt, 0);

    // Check pickup
    const pickupRadius = BALL_RADIUS + this.knife.radius;
    const distA = Math.sqrt((dA.pos.x - kx) ** 2 + (dA.pos.y - ky) ** 2);
    const distB = Math.sqrt((dB.pos.x - kx) ** 2 + (dB.pos.y - ky) ** 2);

    if (distA <= pickupRadius || distB <= pickupRadius) {
      const hunterIdx = distA < distB ? 0 : 1;
      this._assignRoles(hunterIdx);
    }
  }

  private _assignRoles(hunterIdx: number): void {
    this._knifePickedUp = true;
    if (this.knife) this.knife.hide();

    const chaseSpeed = BASE_SPEED * CHASE_SPEED_MUL;
    const [dA, dB] = this.dictators;
    const hunter = this.dictators[hunterIdx];
    const runner = this.dictators[1 - hunterIdx];

    hunter.setRole('hunter');
    runner.setRole('runner');
    hunter.baseSpeed = chaseSpeed;
    runner.baseSpeed = chaseSpeed;

    dA.normalizeSpeed(dA.currentSpeed);
    dB.normalizeSpeed(dB.currentSpeed);

    // Transition to chase phase
    this.phase = 'chase';
    this.phaseTimer = CHASE_DURATION;
    this.ui.setPhase('chase', CHASE_DURATION);
  }

  private _tickChase(dt: number, dA: Dictator, dB: Dictator): void {
    this.phaseTimer -= dt;
    this.ui.setPhase('chase', Math.max(0, this.phaseTimer));

    const [dPlayer] = this.dictators;
    const hunter = this.dictators.find(d => d.role === 'hunter')!;
    const runner = this.dictators.find(d => d.role === 'runner')!;

    const isPlayerHunter = dPlayer.role === 'hunter';
    const playerSteerMul = this.outcome.steeringMultiplier(isPlayerHunter);

    const hunterMul = hunter === dPlayer ? playerSteerMul : 1.0;
    const runnerMul = runner === dPlayer ? playerSteerMul : 1.0;

    applyHunterSteering(hunter, runner, dt, hunterMul);
    applyRunnerSteering(runner, hunter, this.rng, dt, runnerMul);

    // Capture check — ends round immediately in same tick
    const dist = entityDistance(hunter, runner);
    if (dist <= hunter.radius + runner.radius) {
      this._endRound(hunter === dPlayer);
      return;
    }

    if (this.phaseTimer <= 0) {
      this._endRound(runner === dPlayer);
    }
  }

  private _endRound(playerWon: boolean): void {
    this.phase = 'ended';

    if (playerWon) {
      const payout = this.economy.applyWin();
      this.ui.setStatus('win');
      this.ui.setBalance(this.economy.balance);
      this.ui.showWinPopup(this.lastBet, this.economy);
      console.log(`[Round] WIN  payout=${payout}`);
    } else {
      this.ui.setStatus('lose');
      this.ui.setBalance(this.economy.balance);
      this.ui.showLosePopup();
      console.log('[Round] LOSE');
    }

    this.ui.setPhase('ready');
  }

  private _cleanupKnife(): void {
    if (this.knife) {
      this.knife.hide();
      this.knife.pickedUp = false;
    }
    this._knifePickedUp = false;
  }
}
