# Cappy: Survive the Horde — POC 2

A programming survival prototype. Write Python to gather resources, deposit individual items in a chest, inspect storage by index, retrieve wood, and repair Cappy's base during two zombie hordes. Each inspected slot has a visible simulation cost, so the player's search algorithm affects repair speed and survival.

This repository currently contains an intentionally minimal technical proof-of-concept, not the final game architecture or visual design.

The game does not provide Binary Search as a built-in API. The Sorted Chest only guarantees ordering; the player must implement the search algorithm.

## Install and run

Use Node.js 22.12+ (or a newer supported Node version) and npm.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Installation copies the pinned Pyodide runtime into `public/pyodide`; Monaco and Python are served locally. No runtime CDN, backend, or accounts are needed.

```sh
npm run build
npm run preview
```

## Controls and two-horde flow

- **Run** executes the current Monaco contents inside a Pyodide Web Worker. API actions run sequentially, and each returns only when its simulation action finishes.
- **Stop** terminates Python, cancels pending work, and reloads the worker. It recovers from `while True: pass` without refreshing. Completed actions and resources remain.
- **Reset / Reset Game** restores Horde 1 preparation, Basic Chest, initial 20 items and resource nodes, 100 HP, zero upgrade points and statistics, no zombies, and Cappy's starting position. Python stops; editor contents are retained.
- **Start Horde** ends preparation and spawns five zombies. Then press **Run** to execute your repair program. If a preparation program is still running, it is stopped before starting the horde.

### Horde 1: Basic Chest and Linear Search

The Basic Chest starts with 20 mixed items. Deposits append in gathering order; nothing is automatically sorted. The starter program demonstrates Linear Search using `chest_size()` and `chest_get(i)`, then retrieves wood and repairs when HP is at most 75. Press Start Horde, then Run. Preparation is untimed; gathering is optional because the initial chest contains enough wood.

Five zombies approach the base and each attack four times for 8 damage, with 3.5 seconds between attacks. This is 160 total damage. Repairs are required: stored wood no longer automatically becomes defense HP. Surviving grants exactly one upgrade point and a performance report.

### Sorted Chest upgrade

After Horde 1, **Buy Sorted Chest · 1 point** sorts the existing items alphabetically (`food`, `stone`, `water`, `wood`). Future deposits preserve that order. Removing an item preserves order but shifts later indices.

Buying pauses gameplay and displays a tutorial about checking the middle item, discarding half of the search space, and repeating. It explains Linear Search O(n) versus Binary Search O(log n), without providing a complete Binary Search solution or changing your editor code.

### Horde 2: larger storage and faster retrieval

After closing the tutorial, **Prepare Horde 2** restores the base to 100 HP and adds 50 chest items (40 non-wood items and 10 wood). Remaining inventory, storage, statistics, and the purchased upgrade persist. The upgrade is optional; you can compare valid search strategies yourself.

Five zombies each attack six times for 8 damage, with 2.5 seconds between attacks: 240 total damage. Write your own search using the indexed API, Start Horde, and Run. Searching through the larger chest from index 0 takes much longer than halving a sorted search space; faster retrieval allows more timely repairs. The simulation measures inspections, never source-code patterns or an algorithm's name.

Surviving Horde 2 shows **POC 2 COMPLETE**. Losing either horde shows Game Over. There is no Horde 3.

## Python API

| API | Behavior |
| --- | --- |
| `gather("wood")` / `"stone"` / `"food"` / `"water"` | Walk to the nearest living node of that resource and carry one item. Returns 1, or 0 if none remain. Preparation only. |
| `chop()` | Compatibility alias for `gather("wood")`. |
| `deposit()` | Walk to the chest and deposit all carried items. Returns the number deposited. Preparation only. |
| `deposit_wood()` | Compatibility alias for generic `deposit()`; deposits all resource types. |
| `move("north")` / `"south"` / `"east"` / `"west"` | Move one cell, clamped to map boundaries. Preparation only. |
| `chest_size()` | Return the current chest length. No inspection cost. |
| `chest_get(index)` | Highlight and read that slot, returning a resource string. Costs **one inspection and 250 ms** of simulation time. |
| `chest_take(index)` | Remove that exact slot, return its resource string, and add the item to carried inventory as retrieved. Costs **150 ms**. Does not search or count as an inspection. |
| `repair_base()` | Consume one carried wood retrieved using `chest_take`, restore up to **25 HP**, clamped to 100, and return the actual HP restored. Costs **250 ms**. Horde only; raises a clear error without retrieved wood. |
| `get_base_health()` | Return current base HP. |
| `get_wood()` | Return the number of carried wood items. |
| `get_stored_wood()` | Return the number of wood items in storage. Compatibility counter, not a search helper. |
| `horde_active()` | Return whether a horde is still running. |
| `wait_tick()` | Yield for **250 ms** of simulation time. Use in repair loops to avoid busy polling. |

Chest indices must be integers in `[0, chest_size())`. Index and API errors appear in Python output. `print()` works. `chest_get`, `chest_take`, and `wait_tick` work during preparation and the horde. Queries also work after a horde so loops can exit.

Gathered wood must first be deposited and retrieved before it can repair the base. An index returned by search refers to the current chest; search again after removal because subsequent indices shift. No `find_item`, `index_of`, Linear Search, or Binary Search helper is exposed by the game.

For example, preparation still supports the original loop:

```python
for i in range(3):
    chop()
deposit_wood()
```

Read storage yourself:

```python
for i in range(chest_size()):
    print(i, chest_get(i))
```

The starter editor demonstrates a player-written Linear Search. Replace that function with your own algorithm after buying Sorted Chest; the game does not insert a Binary Search implementation.

## Visible cost and reports

All timed actions and zombie attacks use the same fixed 50 ms simulation clock; inspections cost five ticks. Python CPU execution time is not used to score search efficiency. The chest highlights the active inspected slot and displays recent visited indices. Every issued valid inspection increments the Storage Operations counter. Full Reset clears it.

The HUD shows phase, horde number, base HP, carried item count, chest size/type, storage operations, current action, zombies, and upgrade points. Carried item types, retrieved items, wood retrieved, and repairs appear below the chest.

After each horde the report records that horde's inspections, items/wood retrieved, completed repairs, HP remaining, and inspections per wood retrieval. Preparation inspections are included in the total HUD counter but excluded from horde reports. A canceled or horde-ending inspection is still recorded if it had already begun; incomplete takes/repairs do not count as completed. Reports measure actual behavior without labeling the player's algorithm.

## Implementation map

- `src/game`: typed simulation, timed actions, chest items, resource nodes, horde rules, upgrades, and reports; the source of truth.
- `src/renderer`: Babylon primitive meshes and fixed camera, rendering simulation state.
- `src/scripting` and `public/python-worker.js`: worker request/reply bridge and small Python API. Shared JSON replies support resource strings and readable API errors.
- `src/ui` and `src/App.tsx`: Monaco, chest slots, controls, HUD, tutorial, reports, and event log.

Worker requests are messages. A shared reply buffer lets Python wait inside the worker while the main-thread simulation continues. Vite dev and preview send COOP/COEP headers. If serving `dist` elsewhere, use localhost or HTTPS with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

## Current limitations

Desktop-oriented layout, primitive graphics, direct movement with no collisions or pathfinding, fixed resources, two deterministic hordes, no combat coding, persistence, audio, backend, multiplayer, or additional data structures. Reloading loses progress. Python startup and Stop recovery may take a few seconds. The simulation pauses when rendering is suspended in a background tab. Third-party Python packages are not preinstalled. Large Babylon/Monaco bundles are acceptable for this POC. Player code is local experimental code, not a production security sandbox. No automated tests or test infrastructure are included; verification is manual.
