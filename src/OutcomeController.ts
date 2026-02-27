import { Rng } from './Rng';

export interface BiasParams {
  /** Center attraction strength added when targetWin=true (knife phase) */
  knifeAttractionWin: number;
  /** Repulsion strength added when targetWin=false (knife phase) */
  knifeAttractionLose: number;
  /** Hunter impulse multiplier bonus when targetWin=true */
  hunterBonusWin: number;
  /** Hunter impulse multiplier penalty when targetWin=false */
  hunterPenaltyLose: number;
  /** Runner impulse multiplier bonus when targetWin=true */
  runnerBonusWin: number;
  /** Runner impulse multiplier penalty when targetWin=false */
  runnerPenaltyLose: number;
  /** Speed multiplier bonus when targetWin=true */
  speedBonusWin: number;
  /** Speed multiplier penalty when targetWin=false */
  speedPenaltyLose: number;
}

const DEFAULT_BIAS: BiasParams = {
  knifeAttractionWin: 60,
  knifeAttractionLose: -40,
  hunterBonusWin: 0.10,
  hunterPenaltyLose: -0.10,
  runnerBonusWin: 0.10,
  runnerPenaltyLose: -0.10,
  speedBonusWin: 0.03,
  speedPenaltyLose: -0.03,
};

let DEBUG_LOG = false;

/** Toggle verbose bias logging (for development) */
export function setDebugLog(enabled: boolean): void {
  DEBUG_LOG = enabled;
}

export class OutcomeController {
  private winChance: number;
  private bias: BiasParams;
  targetWin: boolean = false;

  constructor(winChance: number = 0.5, bias: BiasParams = DEFAULT_BIAS) {
    this.winChance = winChance;
    this.bias = { ...bias };
  }

  setWinChance(p: number): void {
    this.winChance = Math.max(0, Math.min(1, p));
  }

  /** Sample outcome at round start */
  sampleOutcome(rng: Rng): void {
    this.targetWin = rng.next() < this.winChance;
    if (DEBUG_LOG) {
      console.log(`[OutcomeController] winChance=${this.winChance} targetWin=${this.targetWin}`);
    }
  }

  /**
   * Get center attraction strength for knife-phase bias.
   * Positive = attraction toward center, negative = repulsion.
   */
  knifeAttractionStrength(): number {
    return this.targetWin
      ? this.bias.knifeAttractionWin
      : this.bias.knifeAttractionLose;
  }

  /**
   * Get steering impulse multiplier for the player's entity.
   * @param isHunter - true if the player is the hunter
   */
  steeringMultiplier(isHunter: boolean): number {
    if (isHunter) {
      return 1.0 + (this.targetWin ? this.bias.hunterBonusWin : this.bias.hunterPenaltyLose);
    } else {
      return 1.0 + (this.targetWin ? this.bias.runnerBonusWin : this.bias.runnerPenaltyLose);
    }
  }

  /**
   * Get speed multiplier for the player's entity.
   */
  speedMultiplier(): number {
    return 1.0 + (this.targetWin ? this.bias.speedBonusWin : this.bias.speedPenaltyLose);
  }
}
