# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kokorotomo51/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kokorotomo51/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMARINA** — an original open-world crime game in the spirit of GTA 6, playable offline in a desktop browser. No network, no build step, no dependencies: just static files and a canvas.

You are Rio, a driver-for-hire in Solmarina, a sun-soaked coastal city of six districts — North Hills, Downtown, Old Town, Portside, Marina Bay and Beachfront — with a beach, a marina, a casino, a garage and a hideout. Explore on foot or steal any car on the street and drive it. Traffic cars and pedestrians live their own lives on the road grid; the police respond to your crimes with a wanted level from one to five stars, patrol cars, roadblocks, and a heat meter that only cools when you break line of sight.

What is inside:

- **A 5-mission story arc** — work for fixer Mara Voss: steal a car for her garage, run a 90-second package delivery through the docks, drive three taxi fares, clear the Red Tide gang out of Portside Docks, then steal the Golden Gull sports car from the casino lot and escape a 4-star wanted level to the hideout. Every mission has objectives, dialogue, and a cash reward.
- **Side activities** — taxi fares with tips, 20 sun coins hidden around the city, a gun shop (pistol, SMG, rifle), a spray shop that repairs your car and clears your wanted level, and a garage that stores the cars you steal.
- **Combat** — fists and firearms on foot with mouse aim, drive-by shooting from a car, health and armor pickups, and a full wanted/police system with roadblocks at high levels.
- **A living HUD** — health, armor, cash, weapon and ammo, wanted stars, an in-game clock, the current district, the active objective, dialogue subtitles, and a live minimap with the player, cars, peds, police, and the mission marker.
- **Presentation** — title screen with story and controls, pause menu, game-over screen, save/load through localStorage, and sound effects synthesized live with WebAudio (engine, sirens, gunfire, jingles). No audio files, no external requests.

The source is split into one file per system (`game/src/`): `config.js`, `city.js`, `vehicles.js`, `pedestrians.js`, `player.js`, `police.js`, `missions.js`, `activities.js`, `audio.js`, `save.js`, `input.js`, `world.js`, `render.js`, `shots.js`, `main.js`. `main.ts` copies `game/` and `screenshots/` to the output directory and writes the entry dossier.

## Run it

```sh
node serve.ts
# then open http://localhost:8123/ in a desktop browser
# (or open game/index.html directly — the game runs fully offline)
```

Controls: **WASD / arrows** move and drive · **mouse** aim · **click / Space** shoot or punch · **E** enter or leave a car · **Q** switch weapon · **R** reload · **N** start the next mission · **F** pick up a fare · **M** mute · **P / Esc** pause.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7bd7933c&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
