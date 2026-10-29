/**
 * The handle's seat on the window: `window.__beltypeCicero`, which `client.js` sets at load and every host reads (its `Handle`).
 *
 * A global augmentation, which JSDoc cannot say, so a `.d.ts`. Reached by the reference directive under `client.js`'s `// @ts-check`, never by a jsconfig `include`, so it travels with the file into every program that checks it.
 */
import type { Handle } from './client.js';

declare global {
  interface Window {
    __beltypeCicero: Handle;
  }
}

export {};
