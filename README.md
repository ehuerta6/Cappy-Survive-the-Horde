# Cappy: Survive the Horde

A programming survival game: write Python to send Cappy gathering wood in a tiny Babylon.js world, deposit it at the chest, and defend the base against five zombies.

This repository currently contains an intentionally minimal technical proof-of-concept, not the final game architecture or visual design.

## Install and run

Use Node.js 22.12+ (or a newer supported Node version) and npm.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Installation copies the pinned Pyodide runtime into `public/pyodide`; the editor and Python runtime are served locally. No backend, accounts, or runtime CDN is needed.

```sh
npm run build
npm run preview
```

## Controls and gameplay

- **Run** executes the editor's Python in a Web Worker. Each API call waits for its simulation action to finish.
- **Stop** terminates Python, cancels the pending action, and recreates the worker. Completed actions and resources remain. This also stops `while True: pass`.
- **Reset / Reset Game** restores preparation, 100 base HP, zero wood, five trees, no zombies, and Cappy's initial position. Editor code is retained.
- **Start Horde** ends preparation, stops any running code, and spawns five zombies. Preparation has no countdown.

```python
for i in range(3):
    chop()

deposit_wood()
```

`chop()` automatically walks to the nearest living tree, pauses, removes it, and adds one carried wood. `deposit_wood()` walks to the chest and transfers all carried wood to storage. Both return the amount of wood gathered/deposited.

`move("north")`, `move("south")`, `move("east")`, and `move("west")` move one cell and clamp to map boundaries. `get_wood()` returns carried wood; `get_stored_wood()` returns stored wood; `get_base_health()` returns current HP. `print()` output and Python errors appear below the editor. Actions are available during preparation only.

Each stored wood adds **10 temporary base HP** when the horde starts; carried wood provides no defense. Each of five zombies approaches the base, attacks twice for **12 HP per attack**, then disappears. Zero wood loses; three stored wood wins with **10 HP**. Store at least three wood before starting the horde.

## Small implementation map

- `src/game`: typed simulation and action processing; source of truth for resources, movement, damage, and phases.
- `src/renderer`: Babylon primitive meshes, fixed camera, and visual updates.
- `src/scripting` and `public/python-worker.js`: Pyodide worker and request/reply bridge.
- `src/ui` and `src/App.tsx`: Monaco, buttons, HUD, output, and recent events.

Worker API requests are messages. A shared integer reply buffer lets Python wait inside the worker until the main-thread simulation finishes each action, including live resource queries. Vite dev and preview send the required COOP/COEP headers. If serving `dist` elsewhere, use localhost or HTTPS and send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

## Current limitations

Desktop-oriented layout; primitive graphics; direct movement with no collisions or pathfinding; fixed trees and one deterministic horde; no combat coding, persistence, audio, backend, or multiplayer. Reloading loses progress. Python startup may take a few seconds. Stop also reloads Python. The game clock pauses when rendering is suspended in a background tab. Third-party Python packages are not preinstalled. Large Babylon/Monaco bundles are acceptable for this POC. Player code is local experimental code, not a production security sandbox. No automated tests or test infrastructure are included.
