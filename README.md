# Doodle Jump (themed, standalone)

A standalone, browser-playable Doodle Jump with **11 selectable skins/themes**,
multiple power-ups, enemies, and an animated menu. The gameplay, physics, and
art are a faithful JavaScript/Canvas port of the Python (pygame) version, locked
to the original 635×955 game window.

## Run it

The themed game uses **no XHR/JSON loading**, so it runs two ways:

- **Just double-click `index.html`** — works straight from `file://`, no server.
- Or serve it: `./run.sh` (or any static server) and open `index.html`.

> Tip: audio starts after your first click (browser autoplay policy).

## Controls

- **Move:** ← / → (or A / D), screen tilt on mobile is not used — touch + arrows.
- **Shoot:** Space / ↑ / click.
- **Pause:** the pause button (top-right) during play.

## Themes / skins

Click **Options** on the menu, then pick a theme:
Bunny, Default, Doodlestein, Ghost, Ice, Jungle, Ooga, Snow, Soccer, Space,
Underwater. Each changes the player, background, platforms, projectile, and
jetpack/propeller art. Your choice is saved (localStorage `DJ2_theme`).

## Features ported from the Python game

- **Tiles:** normal, moving, shifting, moveable (drag), disappearing, breaking,
  exploding.
- **Power-ups:** jetpack, propeller, spring, trampoline, spring-shoes, shield.
- **Enemies:** monsters (5 variants, varied movement), UFO (abducts you),
  black hole (sucks you in). Shoot or jump on monsters; shield blocks one hit.
- **Animated main menu**, options/skin screen, pause/resume, game-over screen
  with score + high score (saved as `DJ2_highscore`).

## Project layout

| File / dir | What it is |
|---|---|
| `index.html` | **The game** — themed Doodle Jump (double-click or serve). |
| `js/dj/` | Game source (clean, editable JS modules — see below). |
| `static/` | All art, audio, fonts (themes under `images/`). |
| `run.sh` | Optional static server launcher. |
| `classic.html` | The original minified Phaser build (kept as a backup). |
| `classic-offline.html` | Original Phaser build with assets inlined for `file://`. |
| `doodle.html` | Original Chrome-extension popup entry (legacy). |

### `js/dj/` modules

- `rect.js` — a small pygame-`Rect` clone (so the port reads 1:1).
- `assets.js` — image/audio loader, sprite-sheet frame rectangles, theme state.
- `core.js` — engine: 635×955 canvas, 640×900 world scaling, 60fps loop, input.
- `player.js` — player physics/controls/shooting + `MenuPlayer`, `Bullet`.
- `powerups.js` — jetpack, propeller, spring, trampoline, spring-shoes, shield.
- `tiles.js` — the seven tile types + spawn helpers.
- `enemies.js` — monster, UFO, black hole.
- `ui.js` — buttons + skin checkboxes.
- `game.js` — `Game` (states, spawning, scoring, end game) + `DJ.boot`.

## Notes

- Internal simulation runs in the Python game's native 640×900 space (so the
  physics match exactly), letterboxed into the 635×955 canvas with the theme
  background filling the margins — the on-screen size/shape is unchanged.
- The loop is capped to 60fps so motion is consistent on high-refresh displays.

## License

Game art/audio originate from the referenced Doodle Jump projects; this is a
re-implementation/packaging for standalone browser play.
