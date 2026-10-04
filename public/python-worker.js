/* Classic worker: Pyodide and all player Python stay off the UI thread. */
let pyodide;
let reply;
let requestId = 0;
function request(action, argument) {
  Atomics.store(reply, 0, 0);
  self.postMessage({ type: 'ACTION', action, argument, id: ++requestId });
  Atomics.wait(reply, 0, 0);
  return new TextDecoder().decode(new Uint8Array(reply.buffer, 8, Atomics.load(reply, 1)).slice());
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
import json as _json

class _HordeFinished(Exception):
    pass

def _call(action, argument=None):
    response = _json.loads(_request(action, argument))
    if response.get('ended'):
        raise _HordeFinished()
    if 'error' in response:
        raise ValueError(response['error'])
    return response['value']

def gather(resource):
    return _call('GATHER', str(resource))

def chop():
    return gather('wood')

def move(direction):
    return _call('MOVE', str(direction))

def get_wood():
    """Return wood carried by Cappy."""
    return _call('GET_WOOD')

def get_stored_wood():
    return _call('GET_STORED_WOOD')

def deposit():
    return _call('DEPOSIT')

def deposit_wood():
    """Compatibility alias: deposits every carried resource."""
    return deposit()

def get_base_health():
    return _call('GET_BASE_HEALTH')

def chest_size():
    return _call('CHEST_SIZE')

def _index(index):
    if type(index) is not int:
        raise TypeError('Chest index must be an integer.')
    return index

def chest_get(index):
    return _call('CHEST_GET', _index(index))

def chest_take(index):
    return _call('CHEST_TAKE', _index(index))

def repair_base():
    return _call('REPAIR')

def horde_active():
    return _call('HORDE_ACTIVE')

def wait_tick():
    return _call('WAIT')
`, { globals });
      await pyodide.runPythonAsync(data.code, { globals });
      self.postMessage({ type: 'DONE' });
    } catch (error) {
      if (error.type === '_HordeFinished') self.postMessage({ type: 'DONE' });
      else self.postMessage({ type: 'ERROR', text: String(error) });
    }
    finally { globals?.destroy(); }
  }
};
