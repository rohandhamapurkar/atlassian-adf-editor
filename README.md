# ADF Editor

A standalone [Atlassian Document Format (ADF)](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) editor with a live JSON panel, built with React, Atlaskit, TypeScript, and Vite.

## Run and verify

Use Node.js 22.17.1 (`.nvmrc`) and npm 10.9.4 (`packageManager`).

```sh
npm ci
npm start
```

If your global npm is newer, use `npx --yes npm@10.9.4 ci` for the install step.

Open [localhost:3000](http://localhost:3000).

```sh
npm run verify    # TypeScript, regression tests, production build
npm run preview   # Preview the production build at localhost:4173
```

`npm run build` writes to `build/`. `npm run deploy` verifies first, then publishes that folder to the `gh-pages` branch with Jekyll disabled so assets beginning with underscores are served. Pushing `main` runs CI verification; deployment requires `npm run deploy`. Relative asset URLs support GitHub Pages project paths. CI runs the same verification after a clean install.

## Features

- Full-page rich text editing: headings, bold, italic, underline, strike-through, inline code, code blocks, lists, quotes, rules, links, color, alignment, and indentation.
- Tables with headers, numbered rows, column resizing, cell merging, sorting, and background colors.
- Panels, tasks and decisions, nested tasks, dates, statuses, and expandable sections.
- Quick insert, Markdown shortcuts, undo/redo, find/replace, and keyboard help.
- A local Unicode 16.0 emoji catalog with 3,781 sequences, category browsing, search, skin tone variants, and recent selections. Appearance depends on the operating system emoji font.
- Sample mentions from `SimpleMentionResource`; these IDs are not real Jira account IDs.
- Bidirectional editor/JSON synchronization, invalid JSON highlighting, IndexedDB restoration, and a resizable split view.

`src/editorConfig.ts` holds the typed feature configuration. `fixtures/comment.adf.json` exercises the main node types: paste it into the JSON panel, complete its task, and reload to verify restoration.

Jira attachment uploads/previews, real user lookup, permissions, smart-link previews, custom site emoji, macros, and collaborative editing require product services/providers. Ordinary hyperlinks work locally. Keep original copies of imported documents containing media or product-specific extensions that this standalone configuration does not support.

## Dependency upgrades

Versions are pinned and the lockfile is committed. Use `npm ci` for normal installations. Change `package.json` and `package-lock.json` together for an intentional upgrade, then run `npm run verify` and the browser checks below. Do not use blanket forced peer overrides or `npm audit fix --force` to bypass compatibility requirements.

The October 16, 2026 upgrade targets the latest supported combination:

| Package | Version |
| --- | --- |
| Atlaskit editor-core | 238.0.1 |
| Atlaskit editor-common | 132.0.1 |
| Atlaskit editor-plugins | 16.2.42 |
| Atlaskit emoji / mention / textarea | 73.0.0 / 30.3.0 / 10.2.7 |
| React / React DOM | 18.3.1 |
| react-intl | 7.1.14 |
| TypeScript | 5.9.3 |
| Vite / Vitest | 8.3.4 / 5.0.5 |

React 18.3.1 is the latest React version supported by the current emoji package. React types stay on the matching 18.x line. Atlaskit requires react-intl 5, 6, or 7, so the app uses the latest 7.x instead of the incompatible latest 12.x. react-intl 7 also requires TypeScript 5.x, so the compiler uses its newest supported release, 5.9.3, rather than TypeScript 7. Node types match the Node 22 runtime. Other retained direct dependencies use the latest stable releases checked during this upgrade.

Atlaskit packages have independently numbered versions. Upgrade core, common, and plugins as a compatible set, checking the target core package's peer dependencies. Keep React and React DOM aligned. Build success alone does not prove editor compatibility: check insert menus, formatting, tables, mentions, emoji, JSON import/export, undo/redo, and restoration after reload. The core document API handles synchronization without the deprecated EditorActions bridge.

npm 10 is required for clean installs: npm 11 rejects an unavailable optional analytics package still referenced by the latest Loom SDK. This is an installer compatibility restriction, not a reason to use force or legacy peer resolution.

The build and test stack moved from CRA/CRACO/Jest to Vite/Vitest. Obsolete React Intl alias/type packages, webpack analyzers, and webpack-specific compatibility loaders were removed. Tests use Happy DOM and Testing Library. `React.StrictMode` remains disabled to preserve Atlaskit portal behavior.

Browser implementations of `events`, `buffer`, `string_decoder`, and `process` support Node-style imports in Atlaskit's browser code. The entry point installs the process shim before loading the editor, which is needed by development-only code. A build guard rejects unresolved browser Node stubs so missing implementations fail verification before deployment. Lightning CSS recovers from invalid upstream card selectors by discarding those rules as browsers do; those warnings, an upstream react-virtualized directive warning, and large-chunk notices remain visible. The universal editor preset still produces a large bundle.

Automated tests cover emoji providers, split-view rendering, and serialization of the saved rich ADF fixture using the current Atlaskit schema and transformer. Verify editor interactions in a real browser as described above; DOM test environments cannot fully reproduce Atlaskit's browser-only UI imports and layout APIs.

## Project structure

```text
index.html                    Vite HTML entry
vite.config.ts                Build, development, and test configuration
src/index.tsx                 Browser process bootstrap
src/mountEditor.tsx           React entry
src/editorConfig.ts           Standalone editor features
src/components/AdfViewer.tsx   Editor, JSON sync, and persistence
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
