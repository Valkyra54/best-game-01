// ECHOWING — the hand-in program for best-game-01 (Node 22, standard library only).
// The game itself is plain static files a desktop browser loads offline: game/index.html
// plus its ES modules, no library, no network request. This program gathers those files
// and the screenshots into /output and writes /output/dossier.json, the summary the
// judge reads, using the vendored make.fun library.
//
// Run it from this directory. Outside the grader's container, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output directory, then the game and its screenshots, in full.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Verify the copy actually landed before the dossier is built. A partial
// /output must fail loudly here — a missing game file, a missing screenshot,
// a wrong screenshot count, or a screenshot over the 256 KiB cap — instead of
// shipping as a broken entry the scorer would refuse anyway.
const problems = [];
const gameFiles = [];
function walkGame(dir, rel) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isDirectory()) walkGame(join(dir, entry.name), p);
    else if (entry.isFile()) gameFiles.push(p);
  }
}
walkGame(join(here, 'game'), '');
for (const f of gameFiles) {
  if (!existsSync(join(out, 'game', f))) problems.push('missing game file: ' + f);
}
const shotNames = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((n) => statSync(join(here, 'screenshots', n)).isFile())
  : [];
if (shotNames.length < 3 || shotNames.length > 4) {
  problems.push('screenshot count ' + shotNames.length + ' — need 3–4');
}
for (const n of shotNames) {
  const outPath = join(out, 'screenshots', n);
  if (!existsSync(outPath)) { problems.push('missing screenshot: ' + n); continue; }
  const bytes = statSync(outPath).size;
  if (bytes > 262144) problems.push('screenshot over 256 KiB: ' + n + ' (' + bytes + ' B)');
}
if (problems.length) {
  throw new Error('output verification failed:\n' + problems.map((p) => '  - ' + p).join('\n'));
}

// The scorer's own caps (reference/gate.json): text_max_bytes shapes the dossier
// bytes; the rest refuse an entry the scorer would refuse — more than 4 screenshots
// or one over 256 KiB, more than 993 files in game/ or 48 MiB of game files in all,
// or a path under game/ longer than 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
