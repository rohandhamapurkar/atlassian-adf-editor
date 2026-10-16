import React, { useState, useRef, useCallback, useEffect } from 'react';
import { IntlProvider } from 'react-intl';
import TextArea from '@atlaskit/textarea';
import { ComposableEditor } from '@atlaskit/editor-core/composable-editor';
import { useUniversalPreset } from '@atlaskit/editor-core/preset-universal';
import { usePreset } from '@atlaskit/editor-core/use-preset';
import type { EditorProps } from '@atlaskit/editor-core';
import type { ExtractPresetAPI } from '@atlaskit/editor-common/preset';
import { ToolbarButton } from '@atlaskit/editor-common/ui-menu';
import { mentionResourceProvider } from '../utils/SimpleMentionResource';
import { emojiProvider } from '../utils/LocalEmojiResource';
import { editorFeatures } from '../editorConfig';
import ResizableSplit from './ResizableSplit';

const EDITOR_STATE_DB = 'adf-editor-state';
const EDITOR_STATE_STORE = 'editorState';
const EDITOR_STATE_KEY = 'latest-adf';

const openEditorStateDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(EDITOR_STATE_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EDITOR_STATE_STORE)) {
        db.createObjectStore(EDITOR_STATE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const saveEditorState = async (adfJson: string): Promise<void> => {
  const db = await openEditorStateDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(EDITOR_STATE_STORE, 'readwrite');
    const store = tx.objectStore(EDITOR_STATE_STORE);
    store.put(adfJson, EDITOR_STATE_KEY);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  db.close();
};

const loadEditorState = async (): Promise<string | null> => {
  const db = await openEditorStateDb();

  const value = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(EDITOR_STATE_STORE, 'readonly');
    const store = tx.objectStore(EDITOR_STATE_STORE);
    const request = store.get(EDITOR_STATE_KEY);

    request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return value;
};


const providers = {
  mentionProvider: Promise.resolve(mentionResourceProvider),
  emojiProvider,
};

type EditorApi = ExtractPresetAPI<ReturnType<typeof useUniversalPreset>>;

interface ComposableEditorWrapperProps extends EditorProps {
  onEditorApiReady?: (api: EditorApi) => void;
}

const ComposableEditorWrapper = ({ onEditorApiReady, ...props }: ComposableEditorWrapperProps) => {
  const initialPluginConfiguration = {
    tasksAndDecisionsPlugin: { allowBlockTaskItem: true },
  };
  const universalPreset = useUniversalPreset({ props, initialPluginConfiguration });
  const { preset, editorApi } = usePreset(() => universalPreset, [universalPreset]);

  useEffect(() => {
    if (editorApi && onEditorApiReady) {
      onEditorApiReady(editorApi);
    }
  }, [editorApi, onEditorApiReady]);

  return (
    <ComposableEditor
      preset={preset}
      {...props}
      primaryToolbarComponents={
        <ToolbarButton
          titlePosition="top"
          title="Help"
          onClick={() => editorApi?.helpDialog?.actions.openHelp()}
        >
          Help
        </ToolbarButton>
      }
    />
  );
};

const AdfViewer: React.FC = () => {
  const [isValidAdf, setIsValidAdf] = useState(true);
  const editorApiRef = useRef<EditorApi>();
  const adfTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingRestoreRef = useRef<string | null>(null);

  const replaceEditorDocument = useCallback((adfJson: string) => {
    if (editorApiRef.current?.core?.actions?.replaceDocument) {
      return editorApiRef.current.core.actions.replaceDocument(adfJson);
    }

    return false;
  }, []);

  const handleEditorApiReady = useCallback((api: EditorApi) => {
    editorApiRef.current = api;

    if (pendingRestoreRef.current) {
      const restored = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      replaceEditorDocument(restored);
    }
  }, [replaceEditorDocument]);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromIndexedDb = async () => {
      try {
        const savedAdf = await loadEditorState();
        if (!savedAdf || cancelled) {
          return;
        }

        if (adfTextAreaRef.current) {
          adfTextAreaRef.current.value = savedAdf;
        }

        const didReplace = replaceEditorDocument(savedAdf);
        if (!didReplace) {
          pendingRestoreRef.current = savedAdf;
        }
      } catch {
        // Ignore persistence errors to keep editor usable.
      }
    };

    hydrateFromIndexedDb();

    return () => {
      cancelled = true;
    };
  }, [replaceEditorDocument]);

  // Debounced editor→textarea sync to avoid race conditions on rapid typing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateTextArea = useCallback(() => {
    editorApiRef.current?.core.actions.requestDocument((value) => {
      if (!value) return;
      const serializedAdf = JSON.stringify(value, null, 2);
      if (adfTextAreaRef.current) {
        adfTextAreaRef.current.value = serializedAdf;
      }

      saveEditorState(serializedAdf).catch(() => {
        // Ignore persistence errors to avoid interrupting typing.
      });
    });
  }, []);

  const handleEditorChange = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(updateTextArea, 100);
  }, [updateTextArea]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleAdfChange = useCallback(
    (e: { target: { value: string } }) => {
      const value = e.target.value;

      // Validate JSON first
      if (!value.trim()) {
        setIsValidAdf(true);
        return;
      }
      try {
        JSON.parse(value);
      } catch {
        setIsValidAdf(false);
        return;
      }

      // JSON is valid — push to editor
      setIsValidAdf(true);
      try {
        const didReplace = replaceEditorDocument(value);
        if (!didReplace) {
          if (editorApiRef.current) {
            setIsValidAdf(false);
            return;
          }
          pendingRestoreRef.current = value;
        }

        saveEditorState(value).catch(() => {
          // Ignore persistence errors to avoid blocking manual editing.
        });
      } catch {
        // replaceDocument may throw on schema-invalid ADF
        setIsValidAdf(false);
      }
    },
    [replaceEditorDocument]
  );

  return (
    <IntlProvider locale="en">
      <ResizableSplit>
        {/* Left Panel — Editor */}
        <ComposableEditorWrapper
          appearance="full-page"
          {...editorFeatures}
          placeholder="We support markdown! Try **bold**, `inline code`, or ``` for code blocks."
          onChange={handleEditorChange}
          onEditorApiReady={handleEditorApiReady}
          {...providers}
        />
        {/* Right Panel — ADF JSON */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: '0 8px',
            boxSizing: 'border-box',
          }}
        >
          <h2 style={{ margin: '8px 0', flexShrink: 0 }}>ADF</h2>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <TextArea
              aria-label="ADF JSON"
              isMonospaced={true}
              minimumRows={20}
              placeholder='{"version": 1...'
              isInvalid={!isValidAdf}
              ref={adfTextAreaRef}
              onChange={handleAdfChange}
            />
          </div>
        </div>
      </ResizableSplit>
    </IntlProvider>
  );
};

export default AdfViewer;
