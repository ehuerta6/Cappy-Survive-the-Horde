/* Classic worker: Pyodide and all player Python stay off the UI thread. */
let pyodide;
let reply;
let requestId = 0;
function request(action, direction) {
  Atomics.store(reply, 0, 0);
  self.postMessage({ type: 'ACTION', action, direction, id: ++requestId });
  Atomics.wait(reply, 0, 0);
  if (Atomics.load(reply, 0) < 0) throw new Error('Game action failed. Check the game output.');
  return Atomics.load(reply, 1);
}
self.onmessage = async ({ data }) => {
  if (data.type === 'INIT') {
    try {
      reply = new Int32Array(data.buffer);
      importScripts('/pyodide/pyodide.js');
      pyodide = await loadPyodide({ indexURL: '/pyodide/', stdout: text => self.postMessage({ type: 'OUTPUT', text }), stderr: text => self.postMessage({ type: 'OUTPUT', text }) });
      pyodide.registerJsModule('cappy_bridge', { request });
      self.postMessage({ type: 'READY' });
    } catch (error) { self.postMessage({ type: 'ERROR', text: String(error) }); }
  } else if (data.type === 'RUN') {
    let globals;
    try {
      globals = pyodide.runPython('dict(__builtins__=__builtins__)');
      await pyodide.runPythonAsync(`from cappy_bridge import request as _request

def chop():
    return _request('CHOP', None)

def move(direction):
    return _request('MOVE', str(direction))

def get_wood():
    """Return wood currently carried by Cappy."""
    return _request('GET_WOOD', None)

def get_stored_wood():
    return _request('GET_STORED_WOOD', None)

def deposit_wood():
    return _request('DEPOSIT', None)

def get_base_health():
    return _request('GET_BASE_HEALTH', None)
`, { globals });
      await pyodide.runPythonAsync(data.code, { globals });
      self.postMessage({ type: 'DONE' });
    } catch (error) { self.postMessage({ type: 'ERROR', text: String(error) }); }
    finally { globals?.destroy(); }
  }
};
