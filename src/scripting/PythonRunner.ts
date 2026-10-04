import { HordeEndedError, Simulation } from '../game/Simulation';
import type { Action } from '../game/types';
export interface RunnerState { ready: boolean; running: boolean; output: string }
export class PythonRunner {
  private worker: Worker | null = null;
  private reply: Int32Array | null = null;
  state: RunnerState = { ready: false, running: false, output: 'Loading Python runtime…' };
  constructor(private simulation: Simulation, private onChange: (state: RunnerState) => void) { this.createWorker(); }
  private publish(patch: Partial<RunnerState>) { this.state = { ...this.state, ...patch }; this.onChange(this.state); }
  private append(text: string) { this.publish({ output: (this.state.output + '\n' + text).slice(-6000) }); }
  private createWorker() {
    if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
      this.publish({ output: 'Python requires cross-origin isolation. Run using npm run dev or npm run preview, on localhost.' }); return;
    }
    const worker = new Worker('/python-worker.js');
    this.worker = worker;
    this.reply = new Int32Array(new SharedArrayBuffer(4096));
    const reply = this.reply;
    worker.onmessage = async ({ data }) => {
      if (this.worker !== worker) return;
      if (data.type === 'READY') this.publish({ ready: true, output: 'Python ready. Write code and press Run.' });
      if (data.type === 'OUTPUT') this.append(data.text);
      if (data.type === 'DONE') { this.publish({ running: false }); this.append('Program finished.'); }
      if (data.type === 'ERROR') { this.publish({ running: false }); this.append(data.text); }
      if (data.type === 'ACTION') {
        try {
          const result = await this.simulation.action(data.action as Action, data.argument);
          if (this.worker !== worker) return;
          this.respond(reply, { value: result });
        } catch (error) {
          if (this.worker !== worker) return;
          this.respond(reply, error instanceof HordeEndedError ? { ended: true } : { error: error instanceof Error ? error.message : String(error) });
        }
      }
    };
    worker.onerror = event => this.publish({ running: false, ready: false, output: `Worker error: ${event.message}. Press Stop to reload Python.` });
    worker.postMessage({ type: 'INIT', buffer: reply.buffer });
  }
  private respond(reply: Int32Array, result: { value?: number | string | boolean; error?: string; ended?: boolean }) {
    const bytes = new TextEncoder().encode(JSON.stringify(result));
    new Uint8Array(reply.buffer, 8).set(bytes);
    Atomics.store(reply, 1, bytes.length);
    Atomics.store(reply, 0, 1);
    Atomics.notify(reply, 0);
  }
  run(code: string) {
    if (!this.state.ready || this.state.running) return;
    this.publish({ running: true, output: 'Running…' }); this.worker?.postMessage({ type: 'RUN', code });
  }
  stop() {
    this.worker?.terminate(); this.worker = null; this.simulation.stop();
    this.publish({ running: false, ready: false, output: 'Stopped. Reloading Python…' }); this.createWorker();
  }
  dispose() { this.worker?.terminate(); this.worker = null; this.simulation.stop(); }
}
