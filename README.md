# Dictator Battle

A PixiJS + TypeScript gambling chase game. Two dictator "balls" fight for a knife — whoever picks it up becomes the Hunter and must catch the Runner within 10 seconds.

---

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Adding Dictator Images

Place your images in the `/public/assets/` directory with **exactly** these filenames:

| File | Dictator |
|------|----------|
| `public/assets/arafat.jpg` | Yasser Arafat |
| `public/assets/hussein.jpg` | Saddam Hussein |
| `public/assets/gaddafi.jpg` | Muammar Gaddafi |
| `public/assets/lukashenko.jpg` | Alexander Lukashenko |

**Requirements:** JPEG or PNG, ideally square or close to square (faces work best). The game will crop them into circles automatically.

If a file is missing, the game falls back to a colored circle with the dictator's initials — the game still works without any images.

---

## Game Rules

1. **Select a dictator**, bet amount (10/20/50 FUN), and win chance percentage.
2. Press **PLAY** (or **Space**).
3. **Pre-knife phase (3s):** Both balls wander around the arena.
4. **Knife spawns** at the center of the arena.
5. **First ball to reach the knife** becomes the **Hunter** 🔪; the other becomes the **Runner** 🏃.
6. **Chase phase (10s):**
   - Hunter must **catch** the Runner.
   - Runner must **survive** for 10 seconds.
7. **Your dictator wins** if:
   - You are Hunter and catch the Runner, OR
   - You are Runner and survive the full 10 seconds.
8. **Payout:** `bet × 1.9` if you win.

---

## Win Chance Control

The **Win Chance** dropdown (10% / 30% / 50% / 70% / 90%) applies subtle steering and speed biases to nudge outcomes — it never forces a win or teleports balls. The game remains physically plausible.

**RTP formula:** `RTP ≈ 1.9 × winChance`

| Win Chance | Expected RTP |
|-----------|-------------|
| 10% | ~19% |
| 30% | ~57% |
| 50% | ~95% |
| 70% | ~133% |
| 90% | ~171% |

> **Note:** For a casino-style ~95% RTP, use the default 50% win chance.

---

## Running the Headless RTP Simulation

Validate the RTP over 100,000 rounds per win-chance setting:

```bash
npm run simulate
```

Or run directly:

```bash
npx tsx src/Simulation.ts
```

**Example output:**
```
=== Dictator Battle — Headless RTP Simulation ===

Win Chance: 50%
  Rounds       : 100,000
  Wins         : 50,234 (50.23%)
  Total Bet    : 1,000,000 FUN
  Total Payout : 954,446 FUN
  RTP          : 95.44% (expected: 95.00%)
  Time         : 843ms
```

The observed win rate should track the configured win chance within ±1–2% (normal statistical variance at 100k rounds).

---

## RNG / Reproducibility

Each round uses a **seeded RNG** (mulberry32 algorithm). To reproduce a specific round:

1. Note the **Seed** shown in the UI after the round.
2. Enter it in the **RNG Seed** input field.
3. Press Play — the round will play out identically.

If the seed field is empty, a random seed is generated each round.

---

## Project Structure

```
src/
├── main.ts             # PixiJS app setup + responsive canvas
├── Game.ts             # State machine: prewait → preknife → chase → ended
├── Arena.ts            # Arena boundary definitions
├── Entity.ts           # Base physics entity (pos, vel, radius)
├── Dictator.ts         # Ball entity + PixiJS rendering
├── Knife.ts            # Knife pickup entity + pulse animation
├── Physics.ts          # Integration, wall bounce, ball collision
├── Ai.ts               # Wander, hunter, runner steering
├── Economy.ts          # Balance, bet, payout
├── Rng.ts              # Seeded pseudo-RNG (mulberry32)
├── OutcomeController.ts # Subtle bias parameters + sampling
├── Ui.ts               # DOM UI, status updates, win/lose popups
└── Simulation.ts       # Headless 100k-round RTP validator

public/
└── assets/
    ├── arafat.jpg      ← PUT YOUR IMAGE HERE
    ├── hussein.jpg     ← PUT YOUR IMAGE HERE
    ├── gaddafi.jpg     ← PUT YOUR IMAGE HERE
    └── lukashenko.jpg  ← PUT YOUR IMAGE HERE
```

---

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Serve with any static file server.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Start round / restart after end / confirm popup |
