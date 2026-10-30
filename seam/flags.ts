/**
 * Cicero's run-wide flags, in `@beltype/common`'s shape.
 *
 * @remarks
 * One today: `composed`. The other options of a `run()` call — `until`, `resumeAt` and `layer` — belong to a single call, not to a run, and are not flags; nor is a constant someone may want to tune later, until someone asks.
 *
 * This is the node face's table. The client runs in a tab with no way to resolve `@beltype/common`, so `client.ts` keeps the literal `composed = false` as `run()`'s default, and `test/flags.test.ts` pins that literal to this table's default.
 *
 * @packageDocumentation
 */

import { defineFlags } from '@beltype/common/flags';

export const ciceroFlags = defineFlags('cicero', {
  /** Default `false`: the browser sets the lines and Cicero reads what it produced. `true` gives them to the Compositor (*the composed mode reaches the operator*, 2026-09-10). */
  composed: { values: [false, true], default: false }
});
