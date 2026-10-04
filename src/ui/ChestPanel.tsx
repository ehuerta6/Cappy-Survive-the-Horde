import type { GameState } from '../game/types';

export function ChestPanel({ state, onBuy }: { state: GameState; onBuy: () => void }) {
  return <section className="chest-panel">
    <div className="chest-heading"><h3>{state.chestType} CHEST — {state.chestItems.length} items</h3>
      <button onClick={onBuy} disabled={state.upgradePoints < 1 || state.chestType === 'SORTED' || state.phase === 'HORDE' || state.tutorialOpen}>Buy Sorted Chest · 1 point</button>
    </div>
    <p>Each <code>chest_get(i)</code> costs <b>250 ms</b> of simulation time. Removing an item shifts later indices.</p>
    <p className="search-trail">Recent inspected indices: {state.inspectionTrail.join(' → ') || 'none'} · Items retrieved: {state.stats.itemsRetrieved} · Wood retrieved: {state.stats.woodRetrieved} · Repairs: {state.stats.repairs}</p>
    <div className="chest-slots" aria-label="Chest slots">{state.chestItems.map((item, index) => <div key={index} data-index={index} className={`chest-slot ${item}${state.activeSlot === index ? ' inspecting' : ''}`}><small>[{index}]</small>{item}</div>)}</div>
    <p>Carried: {state.carriedItems.map(i => `${i.type}${i.retrieved ? ' (retrieved)' : ''}`).join(', ') || 'empty'}</p>
  </section>;
}
