import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
export function CodeEditor({ code, onChange, disabled, onMount }: { code: string; onChange: (code: string) => void; disabled: boolean; onMount: (editor: monaco.editor.IStandaloneCodeEditor) => void }) {
  return <Editor onMount={onMount} height="100%" language="python" theme="vs-dark" value={code} onChange={value => onChange(value ?? '')} options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, readOnly: disabled, tabSize: 4 }} />;
}
