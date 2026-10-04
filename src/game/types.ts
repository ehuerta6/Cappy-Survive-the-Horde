export type Phase = 'PREPARATION' | 'HORDE' | 'GAME_OVER' | 'VICTORY';
export interface Position { x: number; z: number }
export interface Tree extends Position { id: number; alive: boolean }
export interface Zombie extends Position { id: number; attacks: number; cooldown: number; alive: boolean }
export type Action = 'CHOP' | 'MOVE' | 'DEPOSIT' | 'GET_WOOD' | 'GET_STORED_WOOD' | 'GET_BASE_HEALTH';
export interface GameState {
  phase: Phase;
  wood: number;
  carriedWood: number;
  baseHealth: number;
  maxBaseHealth: number;
  cappyPosition: Position;
  trees: Tree[];
  zombies: Zombie[];
  timeRemaining: number | null;
  currentAction: string;
  log: string[];
}
export const BASE = { x: 0, z: 0 };
export const CHEST = { x: 2, z: 0 };
export const MAP_LIMIT = 5;
