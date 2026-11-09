/**
 * The intake under *render-identical conditions* (I5), DOM-free: a fake window and root say what the document computes, and the refusals name what they refuse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRenderConditions } from '../src/measure.ts';

const doc = (computed: Record<string, string>, dpr = 1): any => ({ defaultView: { devicePixelRatio: dpr, getComputedStyle: () => computed }, documentElement: {} });

test('a horizontal root with an explicit line-height at unit DPR passes, and the three refusals name what they refuse', () => {
  assertRenderConditions(doc({ lineHeight: '24px', writingMode: 'horizontal-tb' }));
  assertRenderConditions(doc({ lineHeight: '24px' }), { relaxDpr: true });
  assert.throws(() => assertRenderConditions(doc({ lineHeight: '24px' }, 2)), /unit device pixel ratio required.*got 2/);
  assert.throws(() => assertRenderConditions(doc({ lineHeight: 'normal' })), /explicit line-height required.*'normal'/);
  assert.throws(() => assertRenderConditions(doc({ lineHeight: '24px', writingMode: 'sideways-lr' })), /writing-mode 'sideways-lr'/, 'Codeberg issue 12: refused at intake, not by the printer');
  assert.throws(() => assertRenderConditions(doc({ lineHeight: '24px', writingMode: 'vertical-rl' })), /writing-mode 'vertical-rl'/);
});

test('a right-to-left root or body is refused by name, as out of scope', () => {
  assert.throws(() => assertRenderConditions(doc({ lineHeight: '24px', direction: 'rtl' })), /right-to-left.*outside this engine's scope.*root/);
  const body = (computed: Record<string, string>): any => ({ defaultView: { devicePixelRatio: 1, getComputedStyle: (el: any) => (el === bodyEl ? { lineHeight: '24px', direction: 'rtl' } : computed) }, documentElement: {}, body: bodyEl });
  const bodyEl = {};
  assert.throws(() => assertRenderConditions(body({ lineHeight: '24px', direction: 'ltr' })), /direction 'rtl' on its body/);
  assertRenderConditions(doc({ lineHeight: '24px', direction: 'ltr' }));
});
