# multi_rpg

JavaScript (Phaser 3 + Socket.IO) online RPG.

## Run
```bash
cd server
npm install
npm start        # http://localhost:3000, also reachable on the LAN (see printed LAN: URLs)
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

## Play over the LAN
1. Start the server on the host PC (`npm start`). It listens on all interfaces (`HOST=0.0.0.0`).
2. Allow TCP port 3000 through the host's firewall.
3. On other PCs in the same network, open `http://<host-ip>:3000`.
