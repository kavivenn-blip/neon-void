# Neon Void

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node 22](https://img.shields.io/badge/Node-22-green.svg)](https://nodejs.org)
[![make.fun bounty](https://img.shields.io/badge/make.fun-best--game--01-blueviolet.svg)](https://make.fun/bounty/best-game-01)

**Neon Void** is a twin-stick arena shooter for the [make.fun](https://make.fun) best-game-01 bounty: fly a lone ship through an endless neon swarm, chain shard pickups into a score multiplier, and spend nova bombs when the swarm closes in. One run, one score — how long can you keep the void at bay?

## Play

Serve the game and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: `game/` is plain static files (HTML + ES modules).

| Input | Action |
| --- | --- |
| WASD / arrow keys | Fly |
| Mouse | Aim |
| Hold left click | Fire (auto-aims at the nearest enemy until the mouse first moves) |
| Space / Shift / right click | Nova bomb — clears the screen, 3 to start |
| P / Esc | Pause |
| M | Mute |
| Enter / click | Launch, restart |

## The game

- **Goal:** survive and score. There is no final level — the swarm grows until it gets you.
- **Enemies:** Chasers hunt you, Weavers sine in fast, Spinners soak bullets, Splitters burst into Mites, and Snipers keep their distance and fire orbs. New kinds unlock as the run deepens; every 25 seconds a new wave raises the pressure.
- **Shards:** every kill drops a shard. Each one collected raises your multiplier (up to ×100) — and a hit resets it to ×1, so greed is a choice.
- **Nova bombs:** clear the whole screen and turn every enemy into shards. Bonus bombs arrive every 20,000 points; extra lives at 50,000 / 150,000 / 300,000.
- **Feel:** a warp grid that ripples with every explosion, particles, shockwave rings, screen shake, floating score popups, and a fully synthesised WebAudio soundtrack of zaps, booms and rising pickup blips — no audio files.
- **Screens:** title (with a living attract mode), play with HUD, pause, and a game-over screen with score, best, wave and kills. Best score persists in the browser.

## Structure

The source is split into files with one clear job each, under `game/src/`:

| File | Job |
| --- | --- |
| `config.js` | Every tuning number and colour |
| `random.js` | Seeded RNG (mulberry32) — same seed, same run |
| `input.js` | Keyboard and mouse, one-shot action flags |
| `audio.js` | Synthesised sound effects (WebAudio, no files) |
| `world.js` | Rules: ship, enemies, bullets, shards, waves, score |
| `particles.js` | Pooled particles, rings, floating score text |
| `grid.js` | The warp-grid background on springs |
| `render.js` | Drawing only: field, HUD, panels, screens |
| `shots.js` | Screenshot scenes + the autopilot that plays them |
| `main.js` | Boot and the fixed-step game loop |

`main.ts` (root) hands the game in: it copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored `vendor/makefun-game.ts`. Screenshots are real renders of the game's own code, staged deterministically with `?shot=start|play|end&seed=N` (see `shots.json`).

## License

MIT — see [LICENSE](LICENSE).
