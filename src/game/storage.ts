import type { Resource, ResourceNode, StorageStats } from './types';

export const emptyStats = (): StorageStats => ({ inspections: 0, itemsRetrieved: 0, woodRetrieved: 0, repairs: 0 });
export const initialChest = (): Resource[] => [
  'stone', 'food', 'water', 'stone', 'wood',
  'food', 'stone', 'water', 'wood', 'food',
  'water', 'stone', 'wood', 'food', 'stone',
  'water', 'wood', 'food', 'water', 'wood',
];
export function secondHordeSupply(): Resource[] {
  const filler: Resource[] = ['water', 'food', 'stone'];
  return Array.from({ length: 50 }, (_, i) => i >= 40 ? 'wood' : filler[i % 3]);
}
export function initialNodes(): ResourceNode[] {
  const wood = [{ x: -3, z: -2 }, { x: -2, z: 3 }, { x: 3, z: 3 }, { x: 4, z: -2 }, { x: -4, z: 1 }];
  const others: { x: number; z: number; type: Resource }[] = [
    { x: -4, z: -4, type: 'stone' }, { x: 4, z: 1, type: 'stone' },
    { x: -1, z: -4, type: 'food' }, { x: 1, z: 4, type: 'food' },
    { x: 4, z: -4, type: 'water' }, { x: -4, z: 4, type: 'water' },
  ];
  return [...wood.map(p => ({ ...p, type: 'wood' as const })), ...others].map((node, id) => ({ ...node, id, alive: true }));
}
