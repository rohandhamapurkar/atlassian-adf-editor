import { memo, useCallback, useEffect, useRef } from 'react';
import { IntlProvider } from 'react-intl';
import { ComposableEditor } from '@atlaskit/editor-core/composable-editor';
import { useUniversalPreset } from '@atlaskit/editor-core/preset-universal';
import { usePreset } from '@atlaskit/editor-core/use-preset';
import type { ExtractPresetAPI } from '@atlaskit/editor-common/preset';
import { ToolbarButton } from '@atlaskit/editor-common/ui-menu';
import { mentionResourceProvider } from '../utils/SimpleMentionResource';
import { editorFeatures } from '../editorConfig';
import type { AdfDocument } from '../document';

export interface EditorController { apply: (document: AdfDocument) => void }
type EditorApi = ExtractPresetAPI<ReturnType<typeof useUniversalPreset>>;
const providers = {
  mentionProvider: Promise.resolve(mentionResourceProvider),
  emojiProvider: import('../utils/LocalEmojiResource').then(module => module.emojiProvider),
};

function RichEditor({ initialDocument, onReady, onChange }: {
  initialDocument: AdfDocument; onReady: (controller: EditorController) => void;
  onChange: (document: AdfDocument) => void;
}) {
  const initial = useRef(initialDocument);
  const applying = useRef(false);
  const api = useRef<EditorApi>();
  const props = { appearance: 'full-page' as const, ...editorFeatures, ...providers,
    defaultValue: initial.current,
    // Custom toolbar content enables Atlaskit's two-line toolbar. The preset
    // must use the same configuration or it also mounts a second Find popup.
    featureFlags: { twoLineEditorToolbar: true },
    primaryToolbarComponents: <ToolbarButton titlePosition="top" title="Help" onClick={() => api.current?.helpDialog?.actions.openHelp()}>Help</ToolbarButton>,
    placeholder: 'We support markdown! Try **bold**, `inline code`, or ``` for code blocks.' };
  const universalPreset = useUniversalPreset({ props, initialPluginConfiguration: { tasksAndDecisionsPlugin: { allowBlockTaskItem: true } } });
  const { preset, editorApi } = usePreset(() => universalPreset, [universalPreset]);
  api.current = editorApi;
  const change = useRef(onChange);
  change.current = onChange;
  const changed = useCallback(() => {
    if (applying.current) return;
    api.current?.core.actions.requestDocument(value => {
      if (value && !applying.current) change.current(value as AdfDocument);
    });
  }, []);
  useEffect(() => {
    if (!editorApi) return;
    onReady({ apply(document) {
      // Use the active editor schema so disabled or unknown nodes are rejected
      // before Atlaskit's replacement parser can repair/drop them.
      const validator = editorApi.core.actions.createTransformer<AdfDocument>(schema => ({
        encode: node => ({ ...node.toJSON(), version: 1 }) as AdfDocument,
        parse: value => { const node = schema.nodeFromJSON(value); node.check(); return node; },
      }));
      if (!validator) throw new Error('The editor is still loading. Please try again.');
      validator.parse(document);
      applying.current = true;
      try {
        if (!editorApi.core.actions.replaceDocument(JSON.stringify(document))) {
          throw new Error('The editor could not apply this document.');
        }
      } finally { applying.current = false; }
    } });
  }, [editorApi, onReady]);
  return <IntlProvider locale="en"><ComposableEditor preset={preset} {...props} onChange={changed} /></IntlProvider>;
}

export default memo(RichEditor);
