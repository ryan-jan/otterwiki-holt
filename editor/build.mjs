// Builds Holt's rich text editor into the repository root, beside holt.css and holt.js, so jsDelivr
// serves it from each tagged release. holt.js loads it on edit pages. Run `npm run build` and commit
// the output.

import { copyFile } from 'node:fs/promises';
import { build } from 'esbuild';

const outdir = '..';

await build({
  entryPoints: { 'holt-editor': 'src/index.js' },
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  outdir,
  legalComments: 'linked',
  logLevel: 'info',
});

// Served beside the editor, so the emoji picker never fetches its data from anywhere else.
await copyFile(
  'node_modules/emoji-picker-element-data/en/emojibase/data.json',
  `${outdir}/holt-emoji.json`,
);
