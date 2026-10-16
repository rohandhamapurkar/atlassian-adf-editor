import browserProcess from 'process';

// Atlaskit has top-level process references in development. Install the browser
// implementation before evaluating its dependency graph, including lazy chunks.
globalThis.process ??= browserProcess;
void import('./mountEditor');
