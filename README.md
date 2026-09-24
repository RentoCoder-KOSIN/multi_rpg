# multi_rpg

JavaScript (Phaser 3 + Socket.IO) online RPG.

## Run
```bash
cd server
npm install
node server.js   # http://localhost:3000
```

## Layout
| Path | Role |
|------|------|
| `client/` | Browser side (served statically by the server) |
| `client/scenes/` | Phaser scenes (`BaseGameScene` is the shared parent, a thin orchestrator) |
| `client/scenes/base/` | Setup helpers used by `BaseGameScene`: assets, UI, input, network callbacks, per-frame updates |
| `client/systems/` | Gameplay logic: combat, skill effects, buff visuals, summons, entity wiring |
| `client/entities/` | Player / Enemy / NPC / SummonedBeast |
| `client/ui/` | UI windows and HUD |
| `client/managers/` | Network, dialogue, quest managers |
| `client/data/` | Static game data (items, skills, jobs, quests, shops). Enemy stats are fetched from the server (`/api/enemy-stats`) |
| `client/assets/` | Images, maps, tiles (only files the game loads) |
| `server/` | Node.js side: `handlers/` (socket events), `services/`, `ai/`. `server/data/enemyStats.js` is the single source of truth for enemy stats |
| `docs/` | Design notes (`enemy-ai.md`, `socket-events.md`) |
| `art-source/` | Unused sprite sheets kept out of the served directory |

`server/data/sharedAI.json` (learned Q-tables) is generated at runtime and git-ignored.
