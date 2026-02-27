import { DICTATOR_CONFIGS, DictatorConfig } from './Dictator';
import { Economy, PAYOUT_MULTIPLIER } from './Economy';

export type RoundStatus = 'ready' | 'running' | 'win' | 'lose';
export type PhaseLabel = 'ready' | 'prewait' | 'preknife' | 'knifeSpawned' | 'chase';

export interface UiState {
  selectedDictatorId: string;
  betAmount: number;
  winChance: number;
  seedInput: string;
}

export class Ui {
  private onPlay: (state: UiState) => void;
  private onSpeedup: (fast: boolean) => void;

  private balanceDisplay: HTMLElement;
  private statusBadge: HTMLElement;
  private phaseBar: HTMLElement;
  private seedDisplay: HTMLElement;
  private seedInput: HTMLInputElement;
  private winChanceSelect: HTMLSelectElement;
  private playBtn: HTMLButtonElement;
  private speedupBtn: HTMLButtonElement;
  private selectedDictDisplay: HTMLElement;
  private selectedBetDisplay: HTMLElement;
  private wcDisplay: HTMLElement;

  private dictAvatarImg: HTMLImageElement;
  private dictAvatarFallback: HTMLElement;
  private dictAvatarWrap: HTMLElement;
  private dictAvatarName: HTMLElement;

  private popupOverlay: HTMLElement;
  private popupIcon: HTMLElement;
  private popupTitle: HTMLElement;
  private popupBody: HTMLElement;
  private popupBtn: HTMLButtonElement;
  private autoCloseBar: HTMLElement;

  private _selectedDictId: string = 'arafat';
  private _betAmount: number = 10;
  private _winChance: number = 0.5;
  private _isFast: boolean = false;
  private _popupAutoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private _popupBarInterval: ReturnType<typeof setInterval> | null = null;
  private _status: RoundStatus = 'ready';
  private _popupVisible: boolean = false;

  constructor(
    onPlay: (state: UiState) => void,
    onSpeedup: (fast: boolean) => void,
  ) {
    this.onPlay = onPlay;
    this.onSpeedup = onSpeedup;

    this.balanceDisplay = document.getElementById('balance-display')!;
    this.statusBadge = document.getElementById('status-badge')!;
    this.phaseBar = document.getElementById('phase-bar')!;
    this.seedDisplay = document.getElementById('seed-display')!;
    this.seedInput = document.getElementById('seed-input') as HTMLInputElement;
    this.winChanceSelect = document.getElementById('win-chance-select') as HTMLSelectElement;
    this.playBtn = document.getElementById('play-btn') as HTMLButtonElement;
    this.speedupBtn = document.getElementById('speedup-btn') as HTMLButtonElement;
    this.selectedDictDisplay = document.getElementById('selected-dict-display')!;
    this.selectedBetDisplay = document.getElementById('selected-bet-display')!;
    this.wcDisplay = document.getElementById('wc-display')!;

    this.popupOverlay = document.getElementById('popup-overlay')!;
    this.popupIcon = document.getElementById('popup-icon')!;
    this.popupTitle = document.getElementById('popup-title')!;
    this.popupBody = document.getElementById('popup-body')!;
    this.popupBtn = document.getElementById('popup-btn') as HTMLButtonElement;
    this.autoCloseBar = document.getElementById('auto-close-bar')!;

    this.dictAvatarImg = document.getElementById('dict-avatar-img') as HTMLImageElement;
    this.dictAvatarFallback = document.getElementById('dict-avatar-fallback')!;
    this.dictAvatarWrap = document.getElementById('dict-avatar-wrap')!;
    this.dictAvatarName = document.getElementById('dict-avatar-name')!;

    this._setupDictButtons();
    this._setupBetButtons();
    this._setupPlayButton();
    this._setupSpeedupButton();
    this._setupWinChance();
    this._setupPopupButton();
    this._setupKeyboard();

    this._updateDictDisplay();
    this._updateBetDisplay();
    this._updateWcDisplay();
  }

  private _setupDictButtons(): void {
    document.querySelectorAll('.dict-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this._status === 'running') return;
        const id = (btn as HTMLElement).dataset.id!;
        this._selectedDictId = id;
        document.querySelectorAll('.dict-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._updateDictDisplay();
      });
    });
  }

  private _setupBetButtons(): void {
    document.querySelectorAll('.bet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this._status === 'running') return;
        const amount = parseInt((btn as HTMLElement).dataset.amount!, 10);
        this._betAmount = amount;
        document.querySelectorAll('.bet-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._updateBetDisplay();
      });
    });
  }

  private _setupPlayButton(): void {
    this.playBtn.addEventListener('click', () => {
      this._triggerPlay();
    });
  }

  private _setupSpeedupButton(): void {
    this.speedupBtn.addEventListener('click', () => {
      this._isFast = !this._isFast;
      this.speedupBtn.textContent = this._isFast ? '⚡ Speed 2x' : '⚡ Speed 1x';
      this.speedupBtn.classList.toggle('active', this._isFast);
      this.onSpeedup(this._isFast);
    });
  }

  private _setupWinChance(): void {
    this.winChanceSelect.addEventListener('change', () => {
      this._winChance = parseFloat(this.winChanceSelect.value);
      this._updateWcDisplay();
    });
  }

  private _setupPopupButton(): void {
    this.popupBtn.addEventListener('click', () => {
      this._closePopup();
      this._triggerPlay();
    });
  }

  private _setupKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (this._popupVisible) {
          this._closePopup();
          this._triggerPlay();
        } else if (this._status !== 'running') {
          this._triggerPlay();
        }
      }
    });
  }

  private _triggerPlay(): void {
    if (this._status === 'running') return;
    this.onPlay({
      selectedDictatorId: this._selectedDictId,
      betAmount: this._betAmount,
      winChance: this._winChance,
      seedInput: this.seedInput.value,
    });
  }

  private _updateDictDisplay(): void {
    const config = DICTATOR_CONFIGS.find(d => d.id === this._selectedDictId);
    this.selectedDictDisplay.textContent = config?.shortName ?? '—';
    if (config) this._updateDictAvatar(config);
  }

  private _updateDictAvatar(config: DictatorConfig): void {
    // Update name label
    this.dictAvatarName.textContent = config.name;

    // Set fallback color and initials (shown until image loads)
    const hex = '#' + config.fallbackColor.toString(16).padStart(6, '0');
    this.dictAvatarWrap.style.backgroundColor = hex;
    this.dictAvatarFallback.textContent = config.initials;

    // Reset image visibility — show fallback until load succeeds
    this.dictAvatarImg.style.display = 'none';
    this.dictAvatarFallback.style.display = 'flex';

    this.dictAvatarImg.onload = () => {
      this.dictAvatarImg.style.display = 'block';
      this.dictAvatarFallback.style.display = 'none';
    };
    this.dictAvatarImg.onerror = () => {
      this.dictAvatarImg.style.display = 'none';
      this.dictAvatarFallback.style.display = 'flex';
    };
    this.dictAvatarImg.src = config.assetPath;
  }

  private _updateBetDisplay(): void {
    this.selectedBetDisplay.textContent = `${this._betAmount} FUN`;
  }

  private _updateWcDisplay(): void {
    this.wcDisplay.textContent = `${Math.round(this._winChance * 100)}%`;
  }

  setBalance(balance: number): void {
    this.balanceDisplay.textContent = `${balance.toFixed(0)} FUN`;
  }

  setStatus(status: RoundStatus): void {
    this._status = status;
    this.statusBadge.textContent = status.toUpperCase();
    this.statusBadge.className = '';
    this.statusBadge.id = 'status-badge';
    if (status === 'running') this.statusBadge.classList.add('running');
    if (status === 'win') this.statusBadge.classList.add('win');
    if (status === 'lose') this.statusBadge.classList.add('lose');
    this.playBtn.disabled = status === 'running';
  }

  setPhase(phase: PhaseLabel, timerValue?: number): void {
    switch (phase) {
      case 'ready':
        this.phaseBar.textContent = 'READY';
        break;
      case 'prewait':
        this.phaseBar.textContent = `Pre-knife — ${timerValue !== undefined ? timerValue.toFixed(1) : ''}s`;
        break;
      case 'preknife':
        this.phaseBar.textContent = `Pre-knife — ${timerValue !== undefined ? timerValue.toFixed(1) : ''}s`;
        break;
      case 'knifeSpawned':
        this.phaseBar.textContent = '🔪 Knife spawned — pick it up!';
        break;
      case 'chase':
        this.phaseBar.textContent = `Chase — ${timerValue !== undefined ? timerValue.toFixed(1) : ''}s left`;
        break;
    }
  }

  setSeed(seed: number): void {
    this.seedDisplay.textContent = `Seed: 0x${seed.toString(16).toUpperCase().padStart(8, '0')}`;
  }

  showWinPopup(bet: number, _economy: Economy): void {
    const payout = bet * PAYOUT_MULTIPLIER;
    this.popupIcon.textContent = '🏆';
    this.popupTitle.textContent = 'You Win!';
    this.popupTitle.className = 'win';
    this.popupBody.innerHTML = `Congrats! You have won <strong>${payout.toFixed(2)} FUNS</strong><br>and this is <strong>${PAYOUT_MULTIPLIER.toFixed(2)}</strong> from your Bet`;
    this.popupBtn.textContent = 'Play';
    this._openPopup();
  }

  showLosePopup(): void {
    this.popupIcon.textContent = '😢';
    this.popupTitle.textContent = 'Oh No, You Lose';
    this.popupTitle.className = 'lose';
    this.popupBody.innerHTML = 'Better luck next time!';
    this.popupBtn.textContent = 'Play again';
    this._openPopup();
  }

  private _openPopup(autoCloseMs: number = 2000): void {
    this._popupVisible = true;
    this.popupOverlay.classList.add('visible');
    this.autoCloseBar.style.width = '100%';
    this.autoCloseBar.style.transition = `width ${autoCloseMs}ms linear`;

    // Trigger reflow for transition to start from 100%
    void this.autoCloseBar.offsetWidth;
    this.autoCloseBar.style.width = '0%';

    if (this._popupAutoCloseTimer) clearTimeout(this._popupAutoCloseTimer);
    this._popupAutoCloseTimer = setTimeout(() => {
      // Auto-close only hides the popup — does NOT start a new round.
      // A new round requires explicit user action: popup button, Space, or Play button.
      this._closePopup();
    }, autoCloseMs);
  }

  private _closePopup(): void {
    this._popupVisible = false;
    this.popupOverlay.classList.remove('visible');
    if (this._popupAutoCloseTimer) {
      clearTimeout(this._popupAutoCloseTimer);
      this._popupAutoCloseTimer = null;
    }
    if (this._popupBarInterval) {
      clearInterval(this._popupBarInterval);
      this._popupBarInterval = null;
    }
  }
}
