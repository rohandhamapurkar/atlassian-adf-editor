import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { Annotation, Prec } from '@codemirror/state';
import { json } from '@codemirror/lang-json';

const externalChange = Annotation.define<boolean>();

export default function JsonEditor({ value, onChange, onApply }: {
  value: string; onChange: (value: string) => void; onApply: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>();
  const callbacks = useRef({ onChange, onApply });
  callbacks.current = { onChange, onApply };
  useEffect(() => {
    const editor = new EditorView({
      parent: container.current!, doc: value,
      extensions: [basicSetup, json(),
        EditorView.contentAttributes.of({ 'aria-label': 'ADF JSON', 'aria-describedby': 'json-feedback' }),
        Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => { callbacks.current.onApply(); return true; } }])),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !update.transactions.some(tx => tx.annotation(externalChange))) {
            callbacks.current.onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto', fontFamily: 'Consolas, monospace' }, '.cm-content': { fontSize: '13px' } }),
      ],
    });
    view.current = editor;
    return () => { editor.destroy(); view.current = undefined; };
    // External updates are applied separately without resetting selection on typing.
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (editor && value !== editor.state.doc.toString()) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value }, annotations: externalChange.of(true) });
    }
  }, [value]);
  return <div className="json-code" ref={container} />;
}
