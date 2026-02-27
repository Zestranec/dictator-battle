/** Manages player balance and bet/payout calculations */
export const PAYOUT_MULTIPLIER = 1.9;

export class Economy {
  private _balance: number;
  private _lastBet: number = 0;

  constructor(startingBalance: number = 1000) {
    this._balance = startingBalance;
  }

  get balance(): number { return this._balance; }
  get lastBet(): number { return this._lastBet; }

  /** Deduct bet from balance. Returns false if insufficient funds. */
  placeBet(amount: number): boolean {
    if (amount > this._balance) return false;
    this._balance -= amount;
    this._lastBet = amount;
    return true;
  }

  /** Credit winnings to balance. Returns credited amount. */
  applyWin(): number {
    const payout = Math.floor(this._lastBet * PAYOUT_MULTIPLIER * 100) / 100;
    this._balance += payout;
    return payout;
  }

  /** Win payout amount (does not credit yet) */
  get winPayout(): number {
    return Math.floor(this._lastBet * PAYOUT_MULTIPLIER * 100) / 100;
  }
}
