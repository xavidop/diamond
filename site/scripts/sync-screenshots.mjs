// Copies the canonical screenshots from docs/screenshots into public/screenshots
// so the site stays the single source of truth without committing duplicate images.
// Runs automatically before `dev` and `build`.
import { cp, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../docs/screenshots');
const dest = resolve(here, '../public/screenshots');

await mkdir(dest, { recursive: true });
const files = (await readdir(src)).filter((f) => f.endsWith('.png'));
for (const f of files) {
  await cp(resolve(src, f), resolve(dest, f));
}
console.log(`[sync-screenshots] copied ${files.length} image(s) → public/screenshots`);
