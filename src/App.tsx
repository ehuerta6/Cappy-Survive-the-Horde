import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Simulation } from './game/Simulation';
import { World } from './renderer/World';
import { PythonRunner, type RunnerState } from './scripting/PythonRunner';
import { CodeEditor } from './ui/CodeEditor';
import type { editor } from 'monaco-editor';
const starterCode = 'for i in range(3):\n    chop()\n\n# Return to the chest and strengthen the base.\ndeposit_wood()';
export default function App() {
  const [simulation] = useState(() => new Simulation());
  const state = useSyncExternalStore(simulation.subscribe, simulation.snapshot);
  const [code, setCode] = useState(starterCode);
  const [python, setPython] = useState<RunnerState>({ ready: false, running: false, output: 'Loading Python runtime…' });
  const runner = useRef<PythonRunner | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  useEffect(() => { runner.current = new PythonRunner(simulation, setPython); return () => runner.current?.dispose(); }, [simulation]);
  const reset = () => { runner.current?.stop(); simulation.reset(); };
  const startHorde = () => { if (python.running) runner.current?.stop(); simulation.startHorde(); };
  const finished = state.phase === 'VICTORY' || state.phase === 'GAME_OVER';
  return <main>
    <header><div><h1>Cappy: Survive the Horde</h1><p>Write Python. Gather wood. Keep the base standing.</p></div><span className="badge">TECHNICAL POC</span></header>
    <div className="workspace">
      <section className="world-panel"><div className="panel-title">GAME WORLD <span>11 × 11 grid · fixed camera</span></div><div className="canvas-wrap"><World simulation={simulation} />{finished && <div className="result"><h2>{state.phase === 'VICTORY' ? 'VICTORY' : 'GAME OVER'}</h2><p>{state.phase === 'VICTORY' ? `Cappy survived with ${state.baseHealth} HP.` : "The Horde Destroyed Cappy's Base"}</p><button onClick={reset}>Reset Game</button></div>}</div><div className="legend"><span>● Cappy (tan)</span><span>■ Base (gray)</span><span>■ Chest (gold)</span><span>● Trees (green)</span><span>■ Zombies (lime)</span></div></section>
      <section className="code-panel"><div className="panel-title">PYTHON EDITOR <span>{python.ready ? python.running ? 'Running' : 'Ready' : 'Loading runtime'}</span></div><div className="editor"><CodeEditor onMount={instance => { editorRef.current = instance; }} code={code} onChange={setCode} disabled={python.running || state.phase !== 'PREPARATION'} /></div><div className="buttons"><button onClick={() => runner.current?.run(editorRef.current?.getValue() ?? code)} disabled={!python.ready || python.running || state.phase !== 'PREPARATION'}>Run</button><button onClick={() => runner.current?.stop()}>Stop</button><button onClick={reset}>Reset</button><button className="horde-button" onClick={startHorde} disabled={state.phase !== 'PREPARATION'}>Start Horde</button></div><pre className="output" aria-label="Python output">{python.output}</pre></section>
    </div>
    <div className="hud"><div><small>PHASE</small><strong>{state.phase}</strong></div><div><small>STORED WOOD</small><strong>{state.wood}</strong></div><div><small>CARRIED WOOD</small><strong>{state.carriedWood}</strong></div><div><small>BASE HP</small><strong>{state.baseHealth} / {state.maxBaseHealth}</strong></div><div><small>CAPPY ACTION</small><strong>{state.currentAction}</strong></div><div><small>{state.phase === 'PREPARATION' ? 'HORDE TIMER' : 'ZOMBIES REMAINING'}</small><strong>{state.phase === 'PREPARATION' ? 'Manual start' : state.zombies.filter(z => z.alive).length}</strong></div></div>
    <div className="details"><section><h3>Recent events</h3><div className="log">{state.log.map((event, i) => <div key={i}>{event}</div>)}</div></section><section className="help"><h3>Cappy API</h3><p><code>chop()</code> gathers the nearest tree. <code>deposit_wood()</code> walks to the chest.</p><p><code>move("north")</code> / south / east / west moves one cell.</p><p><code>get_wood()</code> returns carried wood. <code>get_stored_wood()</code> and <code>get_base_health()</code> read the simulation.</p><p>Each stored wood adds <b>10 HP</b> when the horde starts. Five zombies each attack twice for <b>12 damage</b>, then disappear. Store at least <b>3 wood</b> to survive. Stop cancels movement and reloads Python.</p></section></div>
  </main>;
}
