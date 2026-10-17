import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const manifest = JSON.parse(readFileSync('build/.vite/manifest.json', 'utf8'));
function filesFor(key, files = new Set()) {
  const chunk = manifest[key];
  if (files.has(chunk.file)) return files;
  files.add(chunk.file);
  for (const child of chunk.imports || []) filesFor(child, files);
  return files;
}
const bootstrap = filesFor('index.html');
filesFor('src/mountEditor.tsx', bootstrap);
function report(label, files) {
  let raw = 0, gzip = 0;
  for (const file of files) {
    const buffer = readFileSync(`build/${file}`); raw += buffer.length; gzip += gzipSync(buffer).length;
  }
  console.log(`${label}: ${(raw / 1024).toFixed(1)} KiB JS / ${(gzip / 1024).toFixed(1)} KiB gzip (${files.size} files)`);
}
report('Document tools and React bootstrap', bootstrap);
report('JSON editor (including shared dependencies)', filesFor('src/components/JsonEditor.tsx'));
report('Rich editor (including shared dependencies)', filesFor('src/components/RichEditor.tsx'));
console.log('Rich editor, JSON editor, emoji catalog, and example are separate dynamic imports. Features remain enabled.');
