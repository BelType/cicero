// A served page made into a folder `beltype print` can read: the engine's own scripts and interface sheet dropped, every sheet, image and font it reaches fetched beside it under the same path.
// Usage: node scripts/measure/static-page.ts <url> <out-dir>
// Measured 2026-11-09 on the monorepo's manual (`node bin/beltype.js ./docs/index.md --engine cicero -p 48799 --no-watch`), for the readScope timing.
import fs from 'node:fs';
import path from 'node:path';

const [url, out] = process.argv.slice(2);
if (!url || !out) throw new Error('usage: static-page.ts <url> <out-dir>');
const base = new URL(url);
const seen = new Set<string>();

async function save(ref: URL): Promise<string | null> {
  if (ref.origin !== base.origin) return null;
  const local = ref.pathname.replace(/^\//, '').replace(/^_beltype\//, 'beltype-assets/'); // `/_beltype/` is the CLI's own prefix
  if (seen.has(local)) return local;
  seen.add(local);
  const res = await fetch(ref);
  if (!res.ok) { console.warn(`skip ${ref.href}: ${res.status}`); return null; }
  const file = path.join(out, local);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (local.endsWith('.css')) fs.writeFileSync(file, await css(await res.text(), ref));
  else fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return local;
}

/** Fetch every `url()` a sheet names, relative to the sheet, and leave the reference as written. */
async function css(text: string, at: URL): Promise<string> {
  for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (m[1]!.startsWith('data:')) continue;
    await save(new URL(m[1]!, at));
  }
  return text;
}

let html = await (await fetch(base)).text();
html = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<link[^>]*data-beltype="cicero-interface"[^>]*>/gi, '');
html = await css(html, base);
for (const m of html.matchAll(/<(?:link|img|source)\b[^>]*?(?:href|src)="(\/[^"]*)"/gi)) await save(new URL(m[1]!, base));
// Root-absolute references become relative, so the page reads from its own folder.
html = html.replace(/(<(?:link|img|source)\b[^>]*?(?:href|src)=")\/(?!\/)(_beltype\/)?/gi, (_, a, b) => a + (b ? 'beltype-assets/' : ''));
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(`${out}/index.html, ${seen.size} files beside it`);
