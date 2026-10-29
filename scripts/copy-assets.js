// What tsc does not emit and the package needs beside its modules: the interface sheet, which `vendorAssets()` serves from `dist/seam/`, and the client handle's type, which `dist/seam/client.d.ts` references.
import { cpSync } from 'node:fs';

for (const file of ['cicero-interface.css', 'handle.d.ts']) cpSync(new URL(`../seam/${file}`, import.meta.url), new URL(`../dist/seam/${file}`, import.meta.url));
