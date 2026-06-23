# Sprawlopolis Scorer

A scoring app for the cooperative city-building card game **Sprawlopolis**.

You describe your finished city — either by **filling out a grid by hand** or by
**snapping a photo and letting AI read the board** — then pick which of the 18
scoring-condition cards are in effect. The app computes your base score, every
special card's score, and tells you whether you beat the win target.

## Features

- **Manual entry** (no AI needed): paint each block's zone (Residential /
  Commercial / Industrial / Park) on a resizable grid and draw the roads along
  the grid lines.
- **Photo entry**: upload or take a top-down photo of the finished city; Claude
  interprets it into the grid, which you then review and correct before scoring.
- **Full scoring-card database**: all 18 scoring-condition cards with their exact
  rules, browsable in-app and used by the scoring engine.
- **Automatic scoring**: base score (largest group of each zone type, minus the
  number of roads) plus each active scoring card, with a per-card breakdown and a
  win/lose verdict against the target (the sum of the active card numbers).

## Running

```bash
npm install
npm start
# open http://localhost:3000
```

The **manual form works with no configuration**. For **photo interpretation**,
provide an Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# optional: export ANTHROPIC_MODEL=claude-opus-4-8
npm start
```

## Deploying to Render (Blueprint)

This repo ships a [`render.yaml`](render.yaml) Blueprint, so it deploys as a
Render web service in a few clicks:

1. Push this repo to GitHub (already done if you're reading it there).
2. In the Render dashboard: **New → Blueprint**, then pick this repository.
   Render reads `render.yaml` and provisions the `sprawlopolis-scorer` web
   service automatically.
3. (Optional, for photo mode) set the **`ANTHROPIC_API_KEY`** environment
   variable on the service. It's declared with `sync: false`, so it's never
   committed — you enter the secret in the dashboard. Leave it unset to run
   manual-form-only.
4. Click **Apply**. Render runs `npm install` then `npm start` and serves the
   app on its assigned URL (the server binds to Render's `PORT` automatically).

The default plan is `free`. Free web services sleep after inactivity and cold-start
on the next request — bump `plan` in `render.yaml` if you want it always-on.

## How scoring works

**Base score** (from the rulebook):

- **Blocks**: 1 point per block in your *largest* group of each zone type. A
  group is a cluster of matching blocks connected by at least one edge. Only the
  largest group of each of the four types is scored.
- **Roads**: subtract 1 point for each road — a *continuous stretch* of roadway
  (i.e. each connected run of road segments counts as one road).

**Final score** = base block points − number of roads + the points from each
active scoring card. **You win** if the final score meets or exceeds the combined
value of the scoring cards in play (the sum of their numbers).

### The 18 scoring-condition cards

| #  | Name                | Condition |
|----|---------------------|-----------|
| 1  | The Outskirts       | +1 / road that doesn't end at the city edge; −1 / road that does |
| 2  | Bloom Boom          | +1 / row or column with exactly 3 parks; −1 / row or column with 0 parks |
| 3  | Go Green            | +1 / park; −3 / industrial |
| 4  | Block Party         | 2×2 same-type squares → 0:−8, 1:−5, 2:−2, 3:+1, 4:+4, 5+:+7 |
| 5  | Stacks and Scrapers | +2 / industrial adjacent to only commercial/industrial |
| 6  | Master Planned      | largest residential group − largest industrial group |
| 7  | Central Perks       | +1 / interior park; −2 / edge park |
| 8  | The 'Burbs          | +1 / park next to largest residential group; −2 / industrial next to it |
| 9  | Concrete Jungle     | +1 / industrial sharing a corner with another industrial |
| 10 | The Strip           | +1 / commercial in the single best row or column |
| 11 | Mini Marts          | +2 / commercial between two residential joined by one road |
| 12 | Superhighway        | +1 / 2 sections (rounded down) of your longest road |
| 13 | Park Hopping        | +3 / road connecting two different parks |
| 14 | Looping Lanes       | +1 / road section in a completed loop |
| 15 | Skid Row            | +2 / residential adjacent to 2+ industrial |
| 16 | Morning Commute     | +2 / road touching both a residential and a commercial block |
| 17 | Tourist Traps       | +1 / edge commercial; +1 extra / corner commercial |
| 18 | Sprawlopolis        | blocks in longest row + blocks in longest column |

The full card text lives in [`public/js/cards.js`](public/js/cards.js) and the
scoring algorithms in [`public/js/scoring.js`](public/js/scoring.js).

### A note on road-based cards

Most cards are scored exactly. A few (marked **est.** in the app) depend on
subtle road geometry — **The Outskirts (1)**, **Mini Marts (11)**, and **Park
Hopping (13)** — and are computed with a best-effort interpretation of the rules.
If a game is close, verify those against the physical cards. Every other card,
plus the base score, is computed exactly from the grid you enter.

## Project layout

```
server.js            Express server + /api/interpret (Claude vision) endpoint
public/index.html    App shell
public/css/styles.css
public/js/cards.js    Database of all 18 scoring cards + zone metadata
public/js/scoring.js  Base + per-card scoring engine
public/js/editor.js   SVG grid + road editor
public/js/app.js      UI wiring (cards, photo, results)
```
