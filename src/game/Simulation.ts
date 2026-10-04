import { BASE, CHEST, MAP_LIMIT, RESOURCES, INSPECTION_SECONDS, REPAIR_HP, type Action, type ActionResult, type GameState, type Position, type Resource, type StorageStats } from './types';
import { emptyStats, initialChest, initialNodes, secondHordeSupply } from './storage';

export class HordeEndedError extends Error {
  constructor() { super('Horde ended before the action finished.'); }
}

interface PendingAction {
  resolve: (value: ActionResult) => void;
  reject: (error: Error) => void;
  kind: Action;
  elapsed: number;
  duration: number;
  target?: Position;
  nodeId?: number;
  index?: number;
}

export class Simulation {
  state: GameState = this.initialState();
  private listeners = new Set<() => void>();
  private pending: PendingAction | null = null;
  private accumulator = 0;

  private initialState(): GameState {
    return {
      phase: 'PREPARATION', hordeNumber: 1, chestType: 'BASIC', chestItems: initialChest(),
      carriedItems: [], upgradePoints: 0, tutorialOpen: false,
      activeSlot: null, inspectionTrail: [], stats: emptyStats(), hordeStats: emptyStats(), reports: [],
      baseHealth: 100, maxBaseHealth: 100, cappyPosition: { x: 1, z: 1 }, nodes: initialNodes(),
      zombies: [], currentAction: 'Idle',
      log: ['Basic Chest: 20 mixed items. Each chest_get costs 250 ms. Start Horde, then Run your repair program.'],
    };
  }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  snapshot = () => this.state;
  private publish() { this.state = { ...this.state }; this.listeners.forEach(fn => fn()); }
  private log(message: string) { this.state.log = [...this.state.log.slice(-15), message]; }
  private count(stat: keyof StorageStats) {
    this.state.stats = { ...this.state.stats, [stat]: this.state.stats[stat] + 1 };
    if (this.state.phase === 'HORDE') this.state.hordeStats = { ...this.state.hordeStats, [stat]: this.state.hordeStats[stat] + 1 };
  }
  stop() {
    const pending = this.pending;
    this.pending = null;
    pending?.reject(new Error('Execution stopped.'));
    this.state.activeSlot = null;
    this.state.currentAction = 'Idle';
    this.publish();
  }
  reset() { this.stop(); this.accumulator = 0; this.state = this.initialState(); this.publish(); }
  private validateIndex(index: unknown): number {
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= this.state.chestItems.length) {
      throw new Error(`Chest index must be an integer from 0 to ${this.state.chestItems.length - 1}.`);
    }
    return index;
  }

  async action(kind: Action, argument?: unknown): Promise<ActionResult> {
    // These queries also let a player's loop exit cleanly after the horde ends.
    if (kind === 'GET_BASE_HEALTH') return this.state.baseHealth;
    if (kind === 'HORDE_ACTIVE') return this.state.phase === 'HORDE';
    if (kind === 'GET_WOOD') return this.state.carriedItems.filter(i => i.type === 'wood').length;
    if (kind === 'GET_STORED_WOOD') return this.state.chestItems.filter(i => i === 'wood').length;
    if (kind === 'CHEST_SIZE') return this.state.chestItems.length;
    if (this.state.phase === 'VICTORY' || this.state.phase === 'GAME_OVER') throw new HordeEndedError();
    if (this.state.tutorialOpen) throw new Error('Close the tutorial before running actions.');
    if (this.pending) throw new Error('An action is already running.');
    let target: Position | undefined;
    let nodeId: number | undefined;
    let index: number | undefined;
    let duration = 0.5;
    if (kind === 'CHOP' || kind === 'GATHER') {
      if (this.state.phase !== 'PREPARATION') throw new Error('Gathering is only available during preparation.');
      const resource = kind === 'CHOP' ? 'wood' : argument;
      if (!RESOURCES.includes(resource as Resource)) throw new Error('gather() expects wood, stone, food, or water.');
      const nodes = this.state.nodes.filter(n => n.alive && n.type === resource).sort((a, b) => this.distance(a, this.state.cappyPosition) - this.distance(b, this.state.cappyPosition));
      if (!nodes.length) { this.log(`No ${resource} nodes left.`); this.publish(); return 0; }
      target = { x: nodes[0].x, z: nodes[0].z }; nodeId = nodes[0].id;
      this.state.currentAction = `Moving to ${resource}`;
    } else if (kind === 'DEPOSIT') {
      if (this.state.phase !== 'PREPARATION') throw new Error('Depositing is only available during preparation.');
      target = { x: CHEST.x, z: CHEST.z + 1 };
      this.state.currentAction = 'Returning to chest';
    } else if (kind === 'MOVE') {
      if (this.state.phase !== 'PREPARATION') throw new Error('Movement is only available during preparation.');
      const offsets: Record<string, Position> = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, east: { x: 1, z: 0 }, west: { x: -1, z: 0 } };
      const offset = typeof argument === 'string' ? offsets[argument] : undefined;
      if (!offset) throw new Error('move() expects north, south, east, or west.');
      target = { x: Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, this.state.cappyPosition.x + offset.x)), z: Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, this.state.cappyPosition.z + offset.z)) };
      this.state.currentAction = `Moving ${argument}`;
    } else if (kind === 'CHEST_GET' || kind === 'CHEST_TAKE') {
      index = this.validateIndex(argument);
      this.state.activeSlot = index;
      if (kind === 'CHEST_GET') {
        duration = INSPECTION_SECONDS;
        this.count('inspections');
        this.state.inspectionTrail = [...this.state.inspectionTrail.slice(-11), index];
        this.log(`Inspected chest[${index}]: ${this.state.chestItems[index]}`);
      } else { duration = 0.15; }
      this.state.currentAction = `${kind === 'CHEST_GET' ? 'Inspecting' : 'Taking'} chest[${index}]`;
    } else if (kind === 'REPAIR') {
      if (this.state.phase !== 'HORDE') throw new Error('repair_base() is only available during the horde.');
      if (!this.state.carriedItems.some(i => i.type === 'wood' && i.retrieved)) throw new Error('repair_base() requires one wood retrieved with chest_take(index).');
      duration = 0.25; this.state.currentAction = 'Repairing base';
    } else if (kind === 'WAIT') {
      duration = 0.25; this.state.currentAction = 'Waiting one tick';
    } else { throw new Error(`Unknown game action: ${kind}`); }
    this.publish();
    return new Promise((resolve, reject) => { this.pending = { resolve, reject, target, kind, nodeId, index, elapsed: 0, duration }; });
  }

  private distance(a: Position, b: Position) { return Math.hypot(a.x - b.x, a.z - b.z); }
  private approach(position: Position, target: Position, step: number) {
    const distance = this.distance(position, target);
    if (distance <= step) { position.x = target.x; position.z = target.z; return true; }
    position.x += (target.x - position.x) / distance * step;
    position.z += (target.z - position.z) / distance * step;
    return false;
  }
  private completeAction(pending: PendingAction) {
    let value: ActionResult = 0;
    if (pending.kind === 'CHOP' || pending.kind === 'GATHER') {
      const node = this.state.nodes.find(n => n.id === pending.nodeId)!;
      node.alive = false;
      this.state.carriedItems = [...this.state.carriedItems, { type: node.type, retrieved: false }];
      value = 1; this.log(`Cappy gathered ${node.type}. +1 carried item.`);
    } else if (pending.kind === 'DEPOSIT') {
      value = this.state.carriedItems.length;
      this.state.chestItems = [...this.state.chestItems, ...this.state.carriedItems.map(i => i.type)];
      if (this.state.chestType === 'SORTED') this.state.chestItems.sort();
      this.state.carriedItems = []; this.state.inspectionTrail = [];
      this.log(`Deposited ${value} items into the ${this.state.chestType.toLowerCase()} chest.`);
    } else if (pending.kind === 'CHEST_GET') {
      value = this.state.chestItems[pending.index!];
    } else if (pending.kind === 'CHEST_TAKE') {
      value = this.state.chestItems[pending.index!];
      this.state.chestItems = this.state.chestItems.filter((_, i) => i !== pending.index);
      this.state.carriedItems = [...this.state.carriedItems, { type: value as Resource, retrieved: true }];
      this.count('itemsRetrieved'); if (value === 'wood') this.count('woodRetrieved');
      this.state.inspectionTrail = [];
      this.log(`Removed ${value} from chest[${pending.index}]. Remaining indices shifted.`);
    } else if (pending.kind === 'REPAIR') {
      const index = this.state.carriedItems.findIndex(i => i.type === 'wood' && i.retrieved);
      this.state.carriedItems = this.state.carriedItems.filter((_, i) => i !== index);
      const before = this.state.baseHealth;
      this.state.baseHealth = Math.min(this.state.maxBaseHealth, before + REPAIR_HP);
      value = this.state.baseHealth - before; this.count('repairs');
      this.log(`Cappy repaired base +${value} HP (one retrieved wood consumed).`);
    } else if (pending.kind === 'MOVE') { this.log('Cappy moved (map boundaries enforced).'); }
    this.pending = null;
    this.state.activeSlot = null;
    this.state.currentAction = 'Idle';
    pending.resolve(value);
  }

  update(dt: number) {
    if (this.state.tutorialOpen) return;
    this.accumulator += dt;
    // Every action and zombie uses the same fixed 50 ms simulation clock.
    while (this.accumulator >= 0.05) { this.accumulator -= 0.05; this.tick(0.05); }
  }
  private tick(dt: number) {
    let changed = false;
    const pending = this.pending;
    if (pending) {
      if (!pending.target || this.approach(this.state.cappyPosition, pending.target, dt * 4)) {
        pending.elapsed += dt;
        if (pending.kind === 'GATHER' || pending.kind === 'CHOP') this.state.currentAction = 'Gathering resource';
        if (pending.kind === 'DEPOSIT') this.state.currentAction = 'Depositing items';
        if (pending.elapsed + 1e-8 >= pending.duration) this.completeAction(pending);
      }
      changed = true;
    }
    if (this.state.phase === 'HORDE') {
      const config = this.state.hordeNumber === 1 ? { damage: 8, interval: 3.5, attacks: 4 } : { damage: 8, interval: 2.5, attacks: 6 };
      for (const zombie of this.state.zombies) {
        if (!zombie.alive) continue;
        if (this.distance(zombie, BASE) > 1.25) {
          this.approach(zombie, BASE, dt * 1.1);
        } else {
          zombie.cooldown -= dt;
          if (zombie.cooldown <= 0) {
            zombie.attacks++; zombie.cooldown = config.interval;
            this.state.baseHealth = Math.max(0, this.state.baseHealth - config.damage);
            this.log(`Zombie ${zombie.id + 1} attacked base −${config.damage} HP.`);
            if (zombie.attacks >= config.attacks) { zombie.alive = false; this.log(`Zombie ${zombie.id + 1} exhausted its attacks.`); }
            if (this.state.baseHealth === 0) { this.finishHorde(false); break; }
          }
        }
      }
      if (this.state.phase === 'HORDE' && this.state.zombies.every(z => !z.alive)) this.finishHorde(true);
      changed = true;
    }
    if (changed) this.publish();
  }
  private finishHorde(survived: boolean) {
    this.state.phase = survived ? 'VICTORY' : 'GAME_OVER';
    // Finish queued work so horde_active() loops can exit rather than being stranded.
    const pending = this.pending;
    this.pending = null;
    this.state.activeSlot = null;
    this.state.currentAction = 'Idle';
    if (pending?.kind === 'WAIT') pending.resolve(0);
    else pending?.reject(new HordeEndedError());
    this.state.reports = [...this.state.reports, { ...this.state.hordeStats, horde: this.state.hordeNumber, survived, health: this.state.baseHealth }];
    if (survived && this.state.hordeNumber === 1) {
      this.state.upgradePoints = 1; this.log('HORDE 1 SURVIVED. +1 upgrade point. Sorted Chest is available.');
    } else { this.log(survived ? 'POC 2 COMPLETE. Both hordes survived.' : "The horde destroyed Cappy's base."); }
  }
  startHorde() {
    if (this.state.phase !== 'PREPARATION' || this.state.tutorialOpen) return;
    this.stop();
    this.state.phase = 'HORDE'; this.state.hordeStats = emptyStats(); this.state.inspectionTrail = [];
    this.log(`HORDE ${this.state.hordeNumber} STARTED. Stored wood must be retrieved and used in repair_base().`);
    this.state.zombies = [{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }, { x: 0, z: -5 }].map((p, id) => ({ ...p, id, attacks: 0, cooldown: 0.6, alive: true }));
    this.publish();
  }
  buySortedChest() {
    if (this.state.upgradePoints < 1 || this.state.chestType === 'SORTED' || this.state.phase === 'HORDE') return;
    this.stop(); this.state.upgradePoints--; this.state.chestType = 'SORTED';
    this.state.chestItems = [...this.state.chestItems].sort(); this.state.inspectionTrail = [];
    this.state.tutorialOpen = true; this.log('Bought Sorted Chest for 1 upgrade point. Gameplay paused for tutorial.');
    this.publish();
  }
  closeTutorial() { this.state.tutorialOpen = false; this.publish(); }
  prepareHorde2() {
    if (this.state.phase !== 'VICTORY' || this.state.hordeNumber !== 1 || this.state.tutorialOpen) return;
    this.stop(); this.state.hordeNumber = 2; this.state.phase = 'PREPARATION';
    this.state.baseHealth = 100; this.state.zombies = [];
    this.state.chestItems = [...this.state.chestItems, ...secondHordeSupply()];
    if (this.state.chestType === 'SORTED') this.state.chestItems.sort();
    this.state.inspectionTrail = [];
    this.log('Horde 2 preparation: +50 chest items, base restored to 100 HP. Longer horde; search efficiency matters.');
    this.publish();
  }
}
