import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { editor } from 'monaco-editor';
import { Simulation } from './game/Simulation';
import { World } from './renderer/World';
import { PythonRunner, type RunnerState } from './scripting/PythonRunner';
import { CodeEditor } from './ui/CodeEditor';
import { ChestPanel } from './ui/ChestPanel';
import { HordeReports } from './ui/HordeReports';
import { SortedChestTutorial } from './ui/SortedChestTutorial';
import { starterCode } from './ui/starterCode';

export default function App() {
  const [simulation] = useState(() => new Simulation());
  const state = useSyncExternalStore(simulation.subscribe, simulation.snapshot);
  const [code, setCode] = useState(starterCode);
  const [python, setPython] = useState<RunnerState>({ ready: false, running: false, output: 'Loading Python runtime…' });
  const runner = useRef<PythonRunner | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  useEffect(() => { runner.current = new PythonRunner(simulation, setPython); return () => runner.current?.dispose(); }, [simulation]);
  const stopRunning = () => { if (runner.current?.state.running) runner.current.stop(); };
  const reset = () => { runner.current?.stop(); simulation.reset(); };
  const startHorde = () => { stopRunning(); simulation.startHorde(); };
  const buyUpgrade = () => { stopRunning(); simulation.buySortedChest(); };
  const nextHorde = () => { stopRunning(); simulation.prepareHorde2(); };
  const finished = state.phase === 'VICTORY' || state.phase === 'GAME_OVER';
  const firstVictory = state.phase === 'VICTORY' && state.hordeNumber === 1;
  const canRun = (state.phase === 'PREPARATION' || state.phase === 'HORDE') && !state.tutorialOpen;
  const latestReport = state.reports.at(-1);

  return <main>
    <header><div><h1>Cappy: Survive the Horde</h1><p>Gather. Inspect. Retrieve. Repair. Your search costs time.</p></div><span className="badge">POC 2 · STORAGE & SEARCH</span></header>
    <div className="workspace">
      <section className="world-panel">
        <div className="panel-title">GAME WORLD <span>Horde {state.hordeNumber} / 2 · fixed camera</span></div>
        <div className="canvas-wrap"><World simulation={simulation} />{finished && <div className="result">
          <h2>{state.phase === 'GAME_OVER' ? 'GAME OVER' : firstVictory ? 'HORDE 1 SURVIVED' : 'POC 2 COMPLETE'}</h2>
          <p>{state.phase === 'GAME_OVER' ? "The Horde Destroyed Cappy's Base" : firstVictory ? 'Upgrade point +1. Buy Sorted Chest below, then prepare Horde 2.' : 'You survived using your own storage search logic.'}</p>
          <p>Base HP Remaining: {state.baseHealth} · Storage Operations: {latestReport?.inspections ?? 0}</p>
          <p>Average Inspections: {latestReport?.woodRetrieved ? (latestReport.inspections / latestReport.woodRetrieved).toFixed(2) : '—'}</p>
          {firstVictory && <button onClick={nextHorde} disabled={state.tutorialOpen}>Prepare Horde 2</button>}
          <button onClick={reset}>Reset Game</button>
        </div>}</div>
        <div className="legend"><span>Cappy: tan capsule</span><span>Base: gray box</span><span>Chest: gold</span><span>Wood: trees</span><span>Stone: rocks</span><span>Food: pink</span><span>Water: blue</span><span>Zombies: lime</span></div>
      </section>
      <section className="code-panel">
        <div className="panel-title">PYTHON EDITOR <span>{python.ready ? python.running ? 'Running' : 'Ready' : 'Loading runtime'}</span></div>
        <div className="editor"><CodeEditor onMount={instance => { editorRef.current = instance; }} code={code} onChange={setCode} disabled={python.running || !canRun} /></div>
        <div className="buttons"><button onClick={() => runner.current?.run(editorRef.current?.getValue() ?? code)} disabled={!python.ready || python.running || !canRun}>Run</button><button onClick={() => runner.current?.stop()}>Stop</button><button onClick={reset}>Reset</button><button className="horde-button" onClick={startHorde} disabled={state.phase !== 'PREPARATION' || state.tutorialOpen}>Start Horde</button></div>
        <pre className="output" aria-label="Python output">{python.output}</pre>
      </section>
    </div>
    <div className="hud">
      <div><small>PHASE</small><strong>{state.phase}</strong></div><div><small>HORDE</small><strong>{state.hordeNumber} / 2</strong></div>
      <div><small>BASE HP</small><strong>{state.baseHealth} / {state.maxBaseHealth}</strong></div><div><small>CARRIED ITEMS</small><strong>{state.carriedItems.length}</strong></div>
      <div><small>CHEST SIZE</small><strong>{state.chestItems.length}</strong></div><div><small>STORAGE OPERATIONS</small><strong>{state.stats.inspections}</strong></div>
      <div><small>CAPPY ACTION</small><strong>{state.currentAction}</strong></div><div><small>ZOMBIES REMAINING</small><strong>{state.zombies.filter(z => z.alive).length}</strong></div>
      <div><small>UPGRADE POINTS</small><strong>{state.upgradePoints}</strong></div><div><small>CHEST TYPE</small><strong>{state.chestType}</strong></div>
    </div>
    <ChestPanel state={state} onBuy={buyUpgrade} />
    <HordeReports reports={state.reports} />
    <div className="details"><section><h3>Recent events</h3><div className="log">{state.log.map((event, i) => <div key={i}>{event}</div>)}</div></section><section className="help"><h3>Cappy API & rules</h3>
      <p>Preparation: <code>gather("wood" / "stone" / "food" / "water")</code>, <code>deposit()</code>, <code>move("north")</code> / south / east / west. <code>chop()</code> and <code>deposit_wood()</code> remain aliases.</p>
      <p>Storage: <code>chest_size()</code>, <code>chest_get(i)</code> → resource string, <code>chest_take(i)</code> → removes and carries that item. Take costs 150 ms; no search helper is provided.</p>
      <p>Horde: retrieve a wood, then <code>repair_base()</code> consumes it for up to +25 HP (250 ms). Gathered wood must be deposited and retrieved first. Stored wood gives no automatic defense.</p>
      <p>Use <code>while horde_active():</code> and <code>wait_tick()</code> (250 ms) to yield between checks. Queries: <code>get_base_health()</code>, <code>get_wood()</code>, <code>get_stored_wood()</code>.</p>
      <p>Start Horde, then Run the starter linear search. Horde 1: 160 total damage. Horde 2: 240 total damage and 50 extra chest items. Win Horde 1 to buy Sorted Chest. Write your own faster search for Horde 2.</p>
    </section></div>
    {state.tutorialOpen && <SortedChestTutorial onClose={() => simulation.closeTutorial()} />}
  </main>;
}
