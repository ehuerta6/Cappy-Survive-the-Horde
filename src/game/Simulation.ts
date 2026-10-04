import { BASE, CHEST, MAP_LIMIT, type Action, type GameState, type Position } from './types';

export class Simulation {
  state: GameState = this.initialState();
  private listeners = new Set<() => void>();
  private pending: { resolve: (value: number) => void; reject: (error: Error) => void; target: Position; kind: Action; elapsed: number; treeId?: number } | null = null;

  private initialState(): GameState {
    return {
      phase: 'PREPARATION', wood: 0, carriedWood: 0, baseHealth: 100, maxBaseHealth: 100,
      cappyPosition: { x: 1, z: 1 },
      trees: [{ x: -3, z: -2 }, { x: -2, z: 3 }, { x: 3, z: 3 }, { x: 4, z: -2 }, { x: -4, z: 1 }].map((p, id) => ({ ...p, id, alive: true })),
      zombies: [], timeRemaining: null, currentAction: 'Idle',
      log: ['Preparation is untimed. Gather wood, deposit it, then start the horde.'],
    };
  }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  snapshot = () => this.state;
  private publish() { this.state = { ...this.state }; this.listeners.forEach(fn => fn()); }
  private log(message: string) { this.state.log = [...this.state.log.slice(-11), message]; }
  stop() {
    const pending = this.pending;
    this.pending = null;
    pending?.reject(new Error('Execution stopped.'));
    this.state.currentAction = 'Idle';
    this.publish();
  }
  reset() { this.stop(); this.state = this.initialState(); this.publish(); }

  async action(kind: Action, direction?: string): Promise<number> {
    if (this.state.phase !== 'PREPARATION') throw new Error('Cappy actions are only available during preparation.');
    if (kind === 'GET_WOOD') return this.state.carriedWood;
    if (kind === 'GET_STORED_WOOD') return this.state.wood;
    if (kind === 'GET_BASE_HEALTH') return this.state.baseHealth;
    if (this.pending) throw new Error('An action is already running.');
    let target: Position = { ...this.state.cappyPosition };
    let treeId: number | undefined;
    if (kind === 'CHOP') {
      const trees = this.state.trees.filter(t => t.alive).sort((a, b) => this.distance(a, target) - this.distance(b, target));
      if (!trees.length) { this.log('No trees left to chop.'); this.publish(); return 0; }
      target = { x: trees[0].x, z: trees[0].z }; treeId = trees[0].id;
      this.state.currentAction = 'Moving to tree';
    } else if (kind === 'DEPOSIT') {
      target = { x: CHEST.x, z: CHEST.z + 1 };
      this.state.currentAction = 'Returning to chest';
    } else {
      const offsets: Record<string, Position> = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, east: { x: 1, z: 0 }, west: { x: -1, z: 0 } };
      const offset = offsets[direction ?? ''];
      if (!offset) throw new Error('move() expects north, south, east, or west.');
      target = { x: Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, target.x + offset.x)), z: Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, target.z + offset.z)) };
      this.state.currentAction = `Moving ${direction}`;
    }
    this.publish();
    return new Promise((resolve, reject) => { this.pending = { resolve, reject, target, kind, treeId, elapsed: 0 }; });
  }

  private distance(a: Position, b: Position) { return Math.hypot(a.x - b.x, a.z - b.z); }
  private approach(position: Position, target: Position, step: number) {
    const distance = this.distance(position, target);
    if (distance <= step) { position.x = target.x; position.z = target.z; return true; }
    position.x += (target.x - position.x) / distance * step;
    position.z += (target.z - position.z) / distance * step;
    return false;
  }
  update(dt: number) {
    const pending = this.pending;
    if (pending) {
      if (this.approach(this.state.cappyPosition, pending.target, dt * 4)) {
        pending.elapsed += dt;
        this.state.currentAction = pending.kind === 'CHOP' ? 'Chopping tree' : pending.kind === 'DEPOSIT' ? 'Depositing wood' : 'Moving';
        if (pending.elapsed >= 0.5) {
          let value = 0;
          if (pending.kind === 'CHOP') {
            const tree = this.state.trees.find(t => t.id === pending.treeId)!;
            tree.alive = false; this.state.carriedWood++; value = 1;
            this.log('Cappy chopped a tree. +1 carried wood.');
          } else if (pending.kind === 'DEPOSIT') {
            value = this.state.carriedWood; this.state.wood += value; this.state.carriedWood = 0;
            this.log(`Deposited ${value} wood in the chest.`);
          } else { this.log('Cappy moved one cell (or stopped at the map edge).'); }
          this.pending = null; this.state.currentAction = 'Idle'; pending.resolve(value);
        }
      }
      this.publish();
    }
    if (this.state.phase !== 'HORDE') return;
    for (const zombie of this.state.zombies) {
      if (!zombie.alive) continue;
      if (this.distance(zombie, BASE) > 1.25) {
        this.approach(zombie, BASE, dt * 1.1);
      } else {
        zombie.cooldown -= dt;
        if (zombie.cooldown <= 0) {
          zombie.attacks++; zombie.cooldown = 1;
          this.state.baseHealth = Math.max(0, this.state.baseHealth - 12);
          this.log(`Zombie ${zombie.id + 1} attacked the base. −12 HP.`);
          if (zombie.attacks >= 2) { zombie.alive = false; this.log(`Zombie ${zombie.id + 1} exhausted its attacks and disappeared.`); }
          if (this.state.baseHealth === 0) { this.state.phase = 'GAME_OVER'; this.log("The horde destroyed Cappy's base."); break; }
        }
      }
    }
    if (this.state.phase === 'HORDE' && this.state.zombies.every(z => !z.alive)) {
      this.state.phase = 'VICTORY'; this.log('Victory! Cappy survived the horde.');
    }
    this.publish();
  }
  startHorde() {
    if (this.state.phase !== 'PREPARATION') return;
    this.stop();
    this.state.phase = 'HORDE';
    this.state.baseHealth += this.state.wood * 10;
    this.state.maxBaseHealth = this.state.baseHealth;
    this.log(`HORDE STARTED. ${this.state.wood} stored wood added ${this.state.wood * 10} defense HP.`);
    this.state.zombies = [{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }, { x: 0, z: -5 }].map((p, id) => ({ ...p, id, attacks: 0, cooldown: 0.6, alive: true }));
    this.publish();
  }
}
