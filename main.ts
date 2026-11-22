// THE LAST VAULT - entry hand-in.
//
// This file packages the museum-heist game for the grader. It does exactly
// three things, in this order:
//
//   1. Copies the playable game    (game/)      -> <out>/game/
//   2. Copies the staged evidence   (screenshots/) -> <out>/screenshots/
//   3. Builds the dossier          (dossier.json) from the two directories
//      above, using the vendored make.fun library.
//
// The output directory is /output inside the grader. Outside it, set
// MAKEFUN_OUTPUT_DIR to any writable path (e.g. `MAKEFUN_OUTPUT_DIR=/tmp/x node main.ts`).
//
// Everything here is deterministic: files are copied in sorted order and no
// timestamps, random ids or run-specific absolute paths end up in the bundle,
// so two runs against the same tree produce byte-identical output.
//
// Only the Node.js standard library is used (node:fs, node:path). TypeScript
// is written in the "erasable" subset so `node main.ts` runs it with nothing
// more than Node's built-in type stripping.

import {
  mkdirSync,
  statSync,
  readdirSync,
  copyFileSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The two source trees that make up a hand-in, each with a matching
// destination subdirectory under the output folder so that the layout
// is preserved (game/src/x.js -> <out>/game/src/x.js).
const BUNDLED_DIRS = ['game', 'screenshots'] as const;

// Grader caps for the dossier. These mirror the reference gate: any entry
// that trips one of these limits would be refused, so we let buildDossier
// throw a DossierError rather than silently ship something oversized.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Root of this source tree (the folder holding game/, screenshots/, vendor/).
const SOURCE_ROOT = fileURLToPath(new URL('.', import.meta.url));

/**
 * Where the hand-in should land on disk.
 *
 * The grader always uses /output. For local runs we honour
 * MAKEFUN_OUTPUT_DIR, resolved to an absolute path so that a value like
 * `out` cannot be confused between the cwd and this module's directory.
 */
function resolveOutDir(): string {
  const override = process.env.MAKEFUN_OUTPUT_DIR;
  if (override && override.trim() !== '') {
    return isAbsolute(override) ? override : resolve(override);
  }
  return '/output';
}

/**
 * Recursively list every regular file under `root`, relative to `root`,
 * sorted by path so that traversal order never depends on the filesystem.
 * Throws if `root` itself does not exist.
 */
function listFilesSorted(root: string): string[] {
  const visit = (dir: string, acc: string[]): string[] => {
    const names = readdirSync(dir).sort();
    for (const name of names) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        visit(full, acc);
      } else {
        acc.push(relative(root, full));
      }
    }
    return acc;
  };
  return visit(root, []).sort();
}

/** Copy one file, creating the parent directory first when needed. */
function copyFile(srcRoot: string, dstRoot: string, relPath: string): void {
  const src = join(srcRoot, relPath);
  const dst = join(dstRoot, relPath);
  mkdirSync(join(dst, '..'), { recursive: true });
  copyFileSync(src, dst);
}

/**
 * Mirror `srcRoot` into `dstRoot` recursively, preserving structure and
 * file bytes. Files are written in sorted order so the resulting tree is
 * reproducible run to run.
 */
function copyDir(srcRoot: string, dstRoot: string): number {
  const files = listFilesSorted(srcRoot);
  mkdirSync(dstRoot, { recursive: true });
  for (const relPath of files) {
    copyFile(srcRoot, dstRoot, relPath);
  }
  return files.length;
}

/**
 * Validate that the dossier library is talking about the folder we just
 * copied into, then hand it the caps. Kept separate from main so the error
 * line printed on failure names the exact stage.
 */
function writeDossier(outDir: string): void {
  const bytes: Uint8Array = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), bytes);
}

function main(): void {
  const outDir = resolveOutDir();
  mkdirSync(outDir, { recursive: true });

  const counts: Record<string, number> = {};
  for (const name of BUNDLED_DIRS) {
    counts[name] = copyDir(join(SOURCE_ROOT, name), join(outDir, name));
  }

  writeDossier(outDir);

  const games = counts['game'] ?? 0;
  const shots = counts['screenshots'] ?? 0;
  const bytes = statSync(join(outDir, 'dossier.json')).size;

  console.log(
    `Wrote ${join(outDir, 'dossier.json')} (${bytes} bytes), ` +
      `game/ (${games} files), screenshots/ (${shots} files).`,
  );
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`THE LAST VAULT: hand-in failed: ${message}`);
  process.exit(1);
}
