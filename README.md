# SHIPPED

A browser strategy game about making a game, and deciding when to ship it.

**Status: v0.0.3.** A legible display font, a concept gallery, a post-launch LIVE UPDATES phase and a fix for a stray
white line on the sprint screen, on top of the v0.0.2 tutorial, help layer and five themes.
Concept → Develop → Ship → Review → **Retire**, or **Live updates → Legacy** → New Run.

## Run it

```bash
npm install
npm run dev
```

```bash
npm test           # engine, store, tutorial, save, theme, font and CSS tests (Vitest)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
```

Requires Node 22.12 or newer (developed and tested on Node 24). The dev server uses Vite's default
port (5173); pass `-- --port N` if something else owns it. The `dev` script is plain `vite`, so launchers can add
flags (`npm run dev -- --port 5301 --strictPort`).

## First launch: MY FIRST GAME

A first-time player cannot reach the full game. They get one short guided run:

- **6 sprints** and **4 feature cards** (Combat, Story, Crafting, Character Customization).
- **Three beginner concepts to pick from** (Lantern Hollow, Pocket Dojo, Moss & Mortar), pre-filled and renamable.
  They only lean on those four cards.
- **4 scripted teaching cards** at fixed sprints (2, 3, 5 and 6: morale, scope, hype, the deadline). Each says what
  is going on and *why it matters*, using the run's real numbers.
- **TEAM TIPs**: small dismissible boxes at key moments (before the first action, when the first feature is
  playable, when bugs first spike, when the ship window opens). Each shows once and never repeats.
- **Ship with 50+ to pass.** The review is the normal review plus a **WHAT JUST HAPPENED** panel: four bullets tied to
  the player's own choices ("You shipped with 5 bugs. They cost about 6 points…").
- Passing prints "Your studio is open. Full game unlocked." and saves it. Failing offers TRY AGAIN.

The tutorial is the real game on a smaller scale. All teaching is read-only commentary: it never changes game
state, and none of it appears in the full game. The tutorial has no live-updates phase.

## Starting a game: the concept gallery

The concept screen offers three ways in:

- **PICK AN EXAMPLE**: browse 17 authored concepts (cosy ones and cursed ones: *Cold Bite*, a fishing horror;
  *Parcel Panic*, a courier roguelike; *Velvet Heist*, museum heist tactics; *Idol Ranch*, an idol-ranching sim;
  *Sir Reginald Falls Down*…). Tap one to load it. It fills the title, idea and genre, and stays fully editable.
- **ROLL RANDOM**: loads a random concept (never the one you already have).
- **WRITE MY OWN**: the original free-text flow, unchanged.

Each concept has a name, a one-line pitch, a genre, a short vision marker, and **2-3 seed features** (shown as
"BUILT AROUND" chips). The seed features are what the pitch **promises**. Starred cards (★ IN THE PITCH) on the
sprint screen show them. A game you write yourself promises its genre's two signature features instead.
Promises only matter after launch (below); before launch the game plays exactly as in v0.0.2.

The gallery is plain data in [`src/content/concepts.ts`](src/content/concepts.ts). To add a concept, add one object;
`concepts.test.ts` checks that names and pitches fit the form, seed features are real and different, all six genres
appear, and so on.

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

It also reports **first-week sales**: the money your launch earned. That number opens the post-launch bank account.

## After launch: LIVE UPDATES

When the review ends you choose: **RETIRE GAME** (the run is over) or **LAUNCH UPDATES** (keep developing).
The live phase is the same sprint loop, not a new mode: the same three slots and five actions, the same
`RunState`, the same engine functions. Only the money, the clock and a few extra rules change.

### Two scores

- **LAUNCH** is the review at ship. It is frozen: nothing you do afterwards touches it.
- **LEGACY** is how good the game is *now*, and where its reputation ends up. It starts equal to the launch score and
  moves with your work. The archive records both, forever.

### Where the money comes from

| | Rule |
| --- | --- |
| **First-week sales** | `(60 + 5.5 × points of score above 20) × (1 + hype / 100) × genre market` (market: RPG and Survival 1.10, Action 1.05, Simulation 0.95, Racing and Strategy 0.90) |
| **Opening account** | your leftover development money (if any) + first-week sales |
| **Sales per sprint** | start at 9% of the first week, then multiply by `0.72 + 0.002 × legacy` every live sprint (good games fade slowly) |
| **Buzz** (hype after launch) | adds 0.4% to income per point, and fades 15% a sprint |
| **Upkeep** (the team) | **$40** + **$0 / $5 / $12 / $35** at LOW / MEDIUM / HIGH / CRITICAL scope, paid at the end of every live sprint |
| **A release** | adds to sales per sprint: `$4 × legacy points above your best published score + $12 × features added` |

Example, *Cold Bite* (launch 73, Survival, no hype, $255 left): first week
`(60 + 5.5 × 53) × 1 × 1.10 = $387`, so the account opens at **$642**. Sales start near $35 a sprint against $45
of upkeep, and fade. Doing nothing drains the account slowly; good updates earn more than they cost.

### What you do each live sprint

- **BUILD** finishes the features you promised and cut. **POLISH** and **FIX** raise legacy. **HYPE** is buzz.
  **REST** is rest.
- **RELEASE AN UPDATE** (free; no slot): a version bump with **patch notes** written from what really changed
  ("v1.2 — polished Vehicles, fixed the co-op crash"), a **community reaction**, and a revenue spike. An update window
  opens every **4 live sprints**; you can release earlier, but it sells at 60%.
- **Events**: a live sprint opens with an event about half the time (never two within three sprints), with a free
  option every time. *Modders fixed your bug*
  (embrace or patch), *a streamer found your game*, *fans want the feature you cut*, *a seasonal sale*,
  *a rival announces a sequel*, *the team is running on fumes*, *a critic gave it a second look*,
  *a driver update broke your game*.
- **Promises**: a promised feature left unbuilt costs **1 legacy point per sprint (up to 4)** until it is built or
  formally **cancelled**. Cancelling costs 2 legacy points for good and 10 hype.

### How legacy is worked out

The review formula is re-run on the game as it stands, then adjusted:

`legacy = review of the game now − skepticism − promise penalty − cancel penalty (+ COMPLETE bonus)`

**Skepticism** keeps the launch meaningful. A launch of 75 or better has no discount. Under 75, every point of
*improvement* counts for less: `credit = 1 − 0.02 × (75 − launch)`, never below 0.4. So a 70 keeps 90% of its
improvements, a 55 keeps 60%, a 40 keeps 40%, and every launch has a ceiling of `launch + credit × (100 − launch)`.
Updates can rescue a game; they cannot erase a bad first impression.

The **COMPLETE** stamp (+6 legacy) goes to a game with **4+ built features, every one POLISHED, no bugs, and every
promise kept**. It is reachable with great play on a lean game, in a few focused sprints. It is not a grind.

### How it ends

- **Retire any time** (button in the live bar): the final **legacy card** shows both scores, how the updates changed
  them, the math, the patch history and the promises.
- **The money runs out.** When the account plus next sprint's sales cannot cover upkeep, a **warning sprint** comes
  first with three options: release an update (if it would bring in money), handle it yourself (polish, fix, hype,
  cancel a promise), or retire on your terms. If the account still cannot pay when that sprint closes, the studio
  closes and the legacy card appears. Nothing crashes and nothing soft-locks.

### What the balance tests pin

`liveBalance.test.ts` plays scripted "smart", "sloppy" and "idle" players on fixed seeds and checks the design intent:

- a decent launch (70s) plus smart updates ends at **85-95**, and COMPLETE games reach the top;
- a launch of about 73 is clearly fixable into the **80s**;
- a rough launch (under 65) improves into the 70s and low 80s, but ends below a decent one;
- a disaster (under 25) gains a lot but never becomes a hit (**stays under 65**);
- a game wrecked by bugs and over-scoping cannot be saved;
- idle games always run out of money; bigger games run out sooner;
- identical play gives identical results, and any run replays exactly from its recorded history.

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

### Fonts

Display type is **Space Grotesk** (Midnight, Sunset, Missing Texture); body text is **Inter**; Terminal uses
**JetBrains Mono** and Clean Paper uses Inter. All are SIL OFL and bundled in `src/assets/fonts`: nothing is fetched
at runtime. v0.0.2's pixel display font (Pixelify Sans) was dropped because it was hard to read: its C and O were
about 98% identical shapes, so "Crafting" could pass for "Drafting". `fonts.test.ts` pins the font list, the licence
file and the rule that no theme may point at a font that is not bundled.

## Saves

One small JSON blob in `localStorage` (`shipped:save`): `{ version, tutorialCompleted, theme, archive }`.
The loader never throws: corrupt JSON, wrong types, unknown themes and broken archive entries all fall back to safe
defaults. A save that has finished runs but no tutorial flag is treated as a returning player.

The save is **version 2**. Archive entries carry a launch `score` and a `legacyScore`/`legacyBand`/`complete`.
Entries written by v0.0.2 have no legacy fields; they load with legacy = launch and COMPLETE off, and a returning
player still skips the tutorial. A game that goes live is archived when you ship (launch score) and its legacy is
updated when it ends. The **studio archive** on the concept screen lists your last five games with both scores (the
save keeps 30); the tutorial run is tagged TUTORIAL. A run in progress is not saved.

## Project layout

```
src/
  engine/        pure TypeScript simulation: no React, no DOM, fully tested
    types.ts config.ts economy.ts rng.ts scope.ts morale.ts bugs.ts
    actions.ts game.ts review.ts reviewText.ts originality.ts turningPoint.ts
    live.ts          launch updates, releases, live sprint close, forced closure
    liveEvents.ts    the eight live events (data plus small apply functions)
    legacy.ts        the legacy score and the COMPLETE rule
    promises.ts      promised features, their penalty, cancelling
    patchNotes.ts    patch notes, community reactions, the legacy verdict
    testing/         headless bot players used by the balance tests
  tutorial/      script.ts: teaching events, tips, "what just happened" (pure, read-only)
  content/       features.ts, genres.ts, concepts.ts: static design data
  styles/        fonts.css, themes.css (all colours), app.css (layout, using tokens only)
  ui/            React screens and components, store.ts (Zustand)
  save.ts themes.ts
```

The engine is the source of truth. The UI only calls engine functions (`applyAction`, `endSprint`, `shipGame`,
`launchUpdates`, `releaseUpdate`, `retireGame`…) and renders the state; it previews consequences by applying an
action to a copy (`previewAction`, `previewRelease`). A run carries a `RunConfig` (full game or tutorial) and a
`phase` (`developing`, `shipped`, `live`, `retired`), and any run can be replayed exactly from its history
(`replayHistory`). The seeded random generator in the run state picks live events, so replays stay identical.

## Not in v0.0.3 (on purpose)

New pre-launch features, cards, scenarios or mechanics; synergies, tech debt, hiring, rivals as a system,
reputation across games; sequels, DLC or a second live game; a live-phase tutorial; accounts, a backend, or any
AI/LLM calls. One version at a time.
