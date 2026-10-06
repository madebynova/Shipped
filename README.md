# SHIPPED

A browser strategy game about making a game, and deciding when to ship it.

**Status: v0.0.2.** Tutorial, help layer, a visual pass and five themes on top of the v0.0.1 core.
Concept → Develop → Ship → Review → New Run.

## Run it

```bash
npm install
npm run dev
```

```bash
npm test           # engine, store, tutorial, save and theme tests (Vitest)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
```

Requires Node 22.12 or newer (developed and tested on Node 24). The dev server uses Vite's default
port (5173); pass `-- --port N` if something else owns it.

## First launch: MY FIRST GAME

A first-time player cannot reach the full game. They get one short guided run:

- **6 sprints** and **4 feature cards** (Combat, Story, Crafting, Character Customization).
- A pre-filled starter concept ("Lantern Hollow") that can be renamed.
- **4 scripted teaching cards** at fixed sprints (2, 3, 5 and 6: morale, scope, hype, the deadline). Each says what
  is going on and *why it matters*, using the run's real numbers.
- **TEAM TIPs**: small dismissible boxes at key moments (before the first action, when the first feature is
  playable, when bugs first spike, when the ship window opens). Each shows once and never repeats.
- **Ship with 50+ to pass.** The review is the normal review plus a **WHAT JUST HAPPENED** panel: four bullets tied to
  the player's own choices ("You shipped with 5 bugs. They cost about 6 points…").
- Passing prints "Your studio is open. Full game unlocked." and saves it. Failing offers TRY AGAIN.

The tutorial is the real game on a smaller scale. All teaching is read-only commentary: it never changes game
state, and none of it appears in the full game.

## The full game

You pitch a game, then get **8 sprints** with **3 action slots** each. You cannot do everything: that is the game.

| Action | What it does | What it costs |
| --- | --- | --- |
| **BUILD** | Advance a PLANNED feature toward PLAYABLE, or rework a built one (fast quality, messy) | bugs, scope pressure, morale |
| **POLISH** | Raise a built feature's quality (70+ is POLISHED) and smooth off a bug | a slot, a little morale |
| **FIX** | Remove bugs | a slot; builds nothing |
| **HYPE** | Raise hype | a slot; improves nothing |
| **REST** | Recover morale | a slot; builds nothing |

- **Money** starts at **$500**. Closing a sprint costs *upkeep*: **$45** base, plus **$0 / $5 / $15 / $100** at
  LOW / MEDIUM / HIGH / CRITICAL scope. A big game costs more to keep alive. Sprint 8 ships without a charge.
  At $0 the run continues but the team works unpaid: weaker work and a morale hit each sprint.
- **Morale** drops as you work and recovers when you rest. A tired team builds worse; a burned-out one builds buggy code too.
- **Scope** (LOW → CRITICAL) grows with every feature. A bigger game builds slower, fixes slower, breeds bugs on its
  own and costs more per sprint.
- **Bugs** come from building, from a large game, and from a worn-out team.
- **Hype** raises the bar the audience judges you by. Good game + hype is a bonus; bad game + hype is a penalty.
- **Shipping** unlocks in sprint 4. Sprint 8 forces it.

### How the $500 plays out

| Run | S1 | S2 | S3 | S4 | S5 | S6 | S7 | Ends with |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Disciplined, 4 features | 455 | 405 | 355 | 295 | 235 | 175 | 115 | **$115** |
| Lean, 3 features | 455 | 405 | 355 | 305 | 255 | 205 | 155 | **$155** |
| Over-reaching, 5 features | 455 | 405 | 355 | 295 | 235 | 175 | 30 | $30 |
| Reckless, build everything | 455 | 405 | 345 | 285 | 140 | −5 | −150 | **broke after S6** |

(Money after each sprint closes. `balance.test.ts` pins this intent.)

### The review

Fully deterministic, computed from the final run state (no randomness, no AI): **Gameplay**, **Content**, **Polish**
and **Originality**, averaged (35 / 25 / 25 / 15), then a hype modifier. Bands:
`MASTERPIECE 90+` · `GREAT 75+` · `SOLID 60+` · `ROUGH 45+` · `DISASTER 25+` · `LEGENDARY FAILURE`.

The review builds up in order (score count-up, band stamp, bars, verdict, the build you shipped) and the
**Turning Point** lands last: the one decision that moved your score most, found by replaying your run with a
single action swapped. Click or press a key to skip the build-up.

## Help (passive)

Hover or keyboard-focus any HUD number for a one-to-two sentence tooltip (what it is, what moves it, why it
matters). The **?** button opens a short glossary. Nothing nags or interrupts the full game.

## Themes

Five curated themes, picked from the palette button, with live preview on hover:
**MIDNIGHT** (default), **TERMINAL**, **SUNSET**, **CLEAN PAPER** and **MISSING TEXTURE**.

Every colour in the game is a CSS variable defined in [`src/styles/themes.css`](src/styles/themes.css), so a theme is
a pure variable swap and no component knows which one is active. The saved theme is applied by a tiny inline script
in `index.html` *before first paint*, so there is never a flash of the wrong theme. `themes.test.ts` checks that
every theme defines every token and passes WCAG contrast (7:1 for main text, 4.5:1 for secondary text and for every
semantic colour, button text readable on its button).

To add a theme: add a `[data-theme='id']` block with every token, add it to `src/themes.ts` and to the id list in
`index.html`. The tests fail until all three agree.

Fonts (Pixelify Sans, Inter, JetBrains Mono; SIL OFL) are bundled in `src/assets/fonts`: nothing is fetched at runtime.

## Saves

One small JSON blob in `localStorage` (`shipped:save`): `{ version, tutorialCompleted, theme, archive }`.
The loader never throws: corrupt JSON, wrong types, unknown themes and broken archive entries all fall back to safe
defaults. A save that has finished runs but no tutorial flag is treated as a returning player. v0.0.1 stored nothing,
so there are no real old saves in the wild; the tolerance is covered by tests against simulated legacy shapes.
The **studio archive** on the concept screen lists your last five shipped games; the tutorial run is tagged TUTORIAL.

## Project layout

```
src/
  engine/        pure TypeScript simulation: no React, no DOM, fully tested
    types.ts config.ts economy.ts rng.ts scope.ts morale.ts bugs.ts
    actions.ts game.ts review.ts reviewText.ts originality.ts turningPoint.ts
    testing/     headless bot players used by the balance tests
  tutorial/      script.ts: teaching events, tips, "what just happened" (pure, read-only)
  content/       features.ts, genres.ts: static design data
  styles/        fonts.css, themes.css (all colours), app.css (layout, using tokens only)
  ui/            React screens and components, store.ts (Zustand)
  save.ts themes.ts
```

The engine is the source of truth. The UI only calls `applyAction`, `endSprint`, `shipGame` and renders the state;
it previews consequences by applying an action to a copy (`previewAction`). A run carries a `RunConfig`
(full game or tutorial), and any run can be replayed exactly from its history (`replayHistory`).

## Not in v0.0.2 (on purpose)

More features, synergies, events that change game state, tech debt, run scenarios, hiring, rivals, reputation,
accounts, a backend, or any AI/LLM calls. One version at a time.
