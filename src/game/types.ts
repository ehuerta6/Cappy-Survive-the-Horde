export type Phase = 'PREPARATION' | 'HORDE' | 'GAME_OVER' | 'VICTORY';
export const RESOURCES = ['food', 'stone', 'water', 'wood'] as const;
export type Resource = typeof RESOURCES[number];
export interface Position { x: number; z: number }
export interface ResourceNode extends Position { id: number; type: Resource; alive: boolean }
export interface CarriedItem { type: Resource; retrieved: boolean }
export interface Zombie extends Position { id: number; attacks: number; cooldown: number; alive: boolean }
export type Action = 'CHOP' | 'GATHER' | 'MOVE' | 'DEPOSIT' | 'GET_WOOD' | 'GET_STORED_WOOD' | 'GET_BASE_HEALTH' | 'CHEST_SIZE' | 'CHEST_GET' | 'CHEST_TAKE' | 'REPAIR' | 'WAIT' | 'HORDE_ACTIVE';
export type ActionResult = number | string | boolean;
export interface StorageStats { inspections: number; itemsRetrieved: number; woodRetrieved: number; repairs: number }
export interface HordeReport extends StorageStats { horde: number; survived: boolean; health: number }
export interface GameState {
  phase: Phase;
  hordeNumber: 1 | 2;
  chestType: 'BASIC' | 'SORTED';
  chestItems: Resource[];
  carriedItems: CarriedItem[];
  upgradePoints: number;
  tutorialOpen: boolean;
  activeSlot: number | null;
  inspectionTrail: number[];
  stats: StorageStats;
  hordeStats: StorageStats;
  reports: HordeReport[];
  baseHealth: number;
  maxBaseHealth: number;
  cappyPosition: Position;
  nodes: ResourceNode[];
  zombies: Zombie[];
  currentAction: string;
  log: string[];
}
export const BASE = { x: 0, z: 0 };
export const CHEST = { x: 2, z: 0 };
export const MAP_LIMIT = 5;
export const INSPECTION_SECONDS = 0.25;
export const REPAIR_HP = 25;
