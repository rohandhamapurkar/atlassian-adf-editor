# ADF Editor

A standalone [Atlassian Document Format (ADF)](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) editor with a syntax-highlighted JSON draft, built with React, Atlaskit, CodeMirror, TypeScript, and Vite.

## Run and verify

Use Node.js 22.17.1 (`.nvmrc`) and npm 10.9.4 (`packageManager`).

```sh
npm ci
npx playwright install chromium
npm start
```

If your global npm is newer, use `npx --yes npm@10.9.4 ci` for the install step.

Open [localhost:3000](http://localhost:3000).

```sh
npm run verify    # TypeScript, unit tests, production build, Chromium browser tests
npm run preview   # Preview the production build at localhost:4173
npm run test:browser  # Browser tests against the existing production build
npm run bundle:report # JS sizes of the tools, JSON editor, and rich editor
```

`npm run build` writes to `build/`. `npm run deploy` verifies first, then publishes that folder to the `gh-pages` branch with Jekyll disabled so assets beginning with underscores are served. Pushing `main` runs CI verification; deployment requires `npm run deploy`. Relative asset URLs support GitHub Pages project paths. CI runs the same verification after a clean install.

## Features

- Full-page rich text editing: headings, bold, italic, underline, strike-through, inline code, code blocks, lists, quotes, rules, links, color, alignment, and indentation.
- Tables with headers, numbered rows, column resizing, cell merging, sorting, and background colors.
- Panels, tasks and decisions, nested tasks, dates, statuses, and expandable sections.
- Quick insert, Markdown shortcuts, undo/redo, find/replace, and keyboard help.
- A local Unicode 16.0 emoji catalog with 3,781 sequences, category browsing, search, skin tone variants, and recent selections. Appearance depends on the operating system emoji font.
- Sample mentions from `SimpleMentionResource`; these IDs are not real Jira account IDs.
- Syntax-highlighted JSON editing with line numbers, folding, Format, Apply, and Discard actions. Ctrl/Cmd+Enter applies a draft. Invalid JSON and unsupported ADF leave the rich text document intact.
- Import `.json`, export `document.adf.json`, copy applied ADF, load a rich example, and clear with confirmation. Files are processed locally; imports are limited to 5 MB.
- Visible local save status, recovery of applied documents and unapplied drafts, and ten previous document versions in IndexedDB.
- A resizable split view with document tools available while the rich editor loads.

## JSON drafts and documents

Rich text changes update JSON whenever there is no pending draft. Editing JSON starts a separate draft: choose **Apply JSON** to update the editor or **Discard JSON changes** to return to the current rich text document. Rich text editing never overwrites a pending JSON draft. Applying validates the document against the active editor schema before replacement; errors appear above the code editor.

**Import JSON** and **Load example** open drafts for review. **Export ADF** and **Copy ADF** always use the applied document, including when a different draft is pending. A confirmation protects unapplied drafts when importing, loading an example, restoring history, or clearing.

## Local saving and recovery

Documents and drafts save after 500 ms of inactivity. The status reports success or a storage error; failed saves can be retried, and export remains available. On reload, both the applied document and pending draft are restored. Existing `latest-adf` storage from earlier versions is migrated automatically. A failed storage read leaves existing saved data untouched and disables writes for that session; reload to retry reading.

**Local history** holds up to ten previous applied documents. Continuous typing is grouped into 30-second checkpoints. Apply, clear, and restore operations checkpoint the document they replace. Restoring also preserves the current applied document in history. Drafts are recovered separately and do not create history entries.

Saving is local to this browser and origin. A localhost document and a GitHub Pages document have separate storage. It is not cloud backup or multi-tab synchronization; export important documents before clearing browser data. Closing a tab before its pending write completes can lose the last unsaved change.

## Loading and browser regression tests

The React/document-tools shell loads separately from Atlaskit, CodeMirror, the emoji catalog, and the example document. JSON editing and export remain usable while Atlaskit loads. All configured rich text features remain enabled; the universal preset still has a large payload, so this improves availability of the tools rather than eliminating the cost of loading the rich editor. `npm run bundle:report` reports raw and gzip JS sizes without treating gzip estimates as measured network transfer.

Playwright tests exercise the **production build** in Chromium: drafts, invalid JSON/ADF, formatting, undo/redo, emoji, mentions/table/task rendering, task completion, import/export/clipboard, draft protection, local recovery/history, legacy migration, storage failures, and delayed rich-editor loading. `npm run verify` runs these after building. CI installs Chromium and uploads screenshots/traces when tests fail. Use `npx playwright show-report` to inspect a local failure.

`src/editorConfig.ts` holds the typed feature configuration. `fixtures/comment.adf.json` exercises the main node types: load the example, apply it, complete its task, and reload to verify restoration.

Jira attachment uploads/previews, real user lookup, permissions, smart-link previews, custom site emoji, macros, and collaborative editing require product services/providers. Ordinary hyperlinks work locally. Keep original copies of imported documents containing media or product-specific extensions that this standalone configuration does not support.

## Dependency upgrades

Versions are pinned and the lockfile is committed. Use `npm ci` for normal installations. Change `package.json` and `package-lock.json` together for an intentional upgrade, then run `npm run verify` and the browser checks below. Do not use blanket forced peer overrides or `npm audit fix --force` to bypass compatibility requirements.

The October 16, 2026 upgrade targets the latest supported combination:

| Package | Version |
| --- | --- |
| Atlaskit editor-core | 238.0.1 |
| Atlaskit editor-common | 132.0.1 |
| Atlaskit editor-plugins | 16.2.42 |
| Atlaskit emoji / mention | 73.0.0 / 30.3.0 |
| React / React DOM | 18.3.1 |
| react-intl | 7.1.14 |
| TypeScript | 5.9.3 |
| Vite / Vitest | 8.3.4 / 5.0.5 |

React 18.3.1 is the latest React version supported by the current emoji package. React types stay on the matching 18.x line. Atlaskit requires react-intl 5, 6, or 7, so the app uses the latest 7.x instead of the incompatible latest 12.x. react-intl 7 also requires TypeScript 5.x, so the compiler uses its newest supported release, 5.9.3, rather than TypeScript 7. Node types match the Node 22 runtime. Other retained direct dependencies use the latest stable releases checked during this upgrade.

Atlaskit packages have independently numbered versions. Upgrade core, common, and plugins as a compatible set, checking the target core package's peer dependencies. Keep React and React DOM aligned. Build success alone does not prove editor compatibility: check insert menus, formatting, tables, mentions, emoji, JSON import/export, undo/redo, and restoration after reload. The core document API handles synchronization without the deprecated EditorActions bridge.

npm 10 is required for clean installs: npm 11 rejects an unavailable optional analytics package still referenced by the latest Loom SDK. This is an installer compatibility restriction, not a reason to use force or legacy peer resolution.

The build and test stack moved from CRA/CRACO/Jest to Vite/Vitest. Obsolete React Intl alias/type packages, webpack analyzers, and webpack-specific compatibility loaders were removed. Tests use Happy DOM and Testing Library. `React.StrictMode` remains disabled to preserve Atlaskit portal behavior.

Browser implementations of `events`, `buffer`, `string_decoder`, and `process` support Node-style imports in Atlaskit's browser code. The entry point installs the process shim before loading the editor, which is needed by development-only code. A build guard rejects unresolved browser Node stubs so missing implementations fail verification before deployment. Lightning CSS recovers from invalid upstream card selectors by discarding those rules as browsers do; those warnings, an upstream react-virtualized directive warning, and large-chunk notices remain visible. The universal editor preset still produces a large bundle.

Unit tests cover emoji providers, split-view rendering, JSON validation, checkpoint grouping/retention, and serialization of the rich ADF fixture using the current Atlaskit schema and transformer. Playwright supplies the real-browser interaction coverage that DOM test environments cannot reproduce.

## Project structure

```text
index.html                    Vite HTML entry
vite.config.ts                Build, development, and test configuration
src/index.tsx                 Browser process bootstrap
src/mountEditor.tsx           React entry
src/editorConfig.ts           Standalone editor features
src/components/AdfViewer.tsx   Document tools and draft coordination
src/components/RichEditor.tsx Lazy Atlaskit editor and active-schema validation
src/components/JsonEditor.tsx Lazy CodeMirror JSON editor
src/useDocumentSession.ts     Saving, hydration, and checkpoints
src/persistence.ts            IndexedDB compatibility and storage
e2e/editor.spec.ts            Production browser regression tests
src/components/ResizableSplit.tsx
src/utils/LocalEmojiResource.ts
src/utils/SimpleMentionResource.ts
src/data/emoji.json            Local Unicode catalog (see licenses/UNICODE.txt)
src/__tests__/                Regression tests
fixtures/comment.adf.json     Manual browser regression document
.github/workflows/verify.yml  Clean-install verification
```

## License

Private. Bundled Unicode data uses the [Unicode License v3](licenses/UNICODE.txt).
