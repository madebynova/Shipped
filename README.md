# SHIPPED

A browser strategy game about making a game, and deciding when to ship it.

**Status: v0.0.1, the first playable core.** Concept → Develop → Ship → Review → New Run.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # engine + store tests (Vitest)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
```

Requires Node 22.12 or newer (developed and tested on Node 24).

## How a run works

You pitch a game (title, core idea, genre), then get **8 sprints** with **3 action slots** each.
You cannot do everything: that is the game.

| Action | What it does | What it costs |
| --- | --- | --- |
| **BUILD** | Advance a PLANNED feature toward PLAYABLE, or rework a built one (fast quality, messy) | bugs, scope pressure, morale |
| **POLISH** | Raise a built feature's quality (70+ is POLISHED) and smooth off a bug | a slot, a little morale |
| **FIX** | Remove bugs | a slot; builds nothing |
| **HYPE** | Raise hype | a slot; improves nothing |
| **REST** | Recover morale | a slot; builds nothing |

- **Money** starts at 100 and drains 18 per sprint. At 0 the run goes on, but the team is unpaid: weaker work and a morale hit each sprint.
- **Morale** drops as you work and recovers when you rest. A tired team builds worse; a burned-out one builds buggy code too.
- **Scope** (LOW → CRITICAL) grows with every feature you add. A bigger game builds slower, fixes slower and breeds bugs on its own.
- **Bugs** come from building, from a large game, and from a worn-out team.
- **Hype** raises the bar the audience judges you by. Good game + hype is a bonus; bad game + hype is a penalty.
- **Shipping** unlocks in sprint 4. Sprint 8 forces it.

### The review

Fully deterministic, computed from the final run state (no randomness, no AI):

- **Gameplay**: quality of the built features that matter most for play, reduced by bugs
- **Content**: how much of the game was actually built, reduced by bugs
- **Polish**: average feature quality, reduced by bugs
- **Originality**: genre plus how specific and varied the core idea is

The four are averaged (35 / 25 / 25 / 15), then the hype modifier is applied. Bands:
`MASTERPIECE 90+` · `GREAT 75+` · `SOLID 60+` · `ROUGH 45+` · `DISASTER 25+` · `LEGENDARY FAILURE`.

The review text is assembled from rules over the actual state ("the bugs frequently get in the way", "the audience expected more than the final build could deliver"…).

### Turning Point

After the review, the game finds the one decision that moved your score most. It replays your entire run with a
single action swapped for a sensible alternative and compares final scores (swaps that would break later steps are
discarded). So "Sprint 4: You chose BUILD Character Customization instead of FIX… would have scored 70 instead of 59"
is backed by an actual simulation, not a guess.

### Keyboard

`B` `P` `F` `H` `R` choose an action · `1`–`6` pick a feature · `Esc` cancel · `Enter` ends the sprint / starts a new run.

## Project layout

```
src/
  engine/        pure TypeScript simulation: no React, no DOM, fully tested
    types.ts config.ts rng.ts scope.ts morale.ts bugs.ts
    actions.ts game.ts review.ts reviewText.ts originality.ts turningPoint.ts
    testing/     headless bot players used by the balance tests
  content/       features.ts, genres.ts: static design data
  ui/            React screens and components, store.ts (Zustand)
```

The engine is the source of truth. The UI only calls `applyAction`, `endSprint`, `shipGame` and renders the state;
it previews consequences by simply applying an action to a copy (`previewAction`).

Every run has a **seed** and the engine is pure, so any run can be replayed exactly from its history
(`replayHistory`). In v0.0.1 the seed only picks flavour text; scores never depend on it.

All tunable numbers live in `engine/config.ts` and the small rule tables in `scope.ts`, `morale.ts` and `bugs.ts`.
`engine/balance.test.ts` pins the design intent found while tuning with bot players (hype-only play is a legendary
failure, over-building is a disaster, a right-sized game scores SOLID or better, and shipping early rewards bailing
out of a runaway project but not a controlled one).

## Not in v0.0.1 (on purpose)

12 features, synergies, events, tech debt, run scenarios, rivals, staff, marketing, archive, reputation, accounts, backend, or any AI/LLM calls. One version at a time.
