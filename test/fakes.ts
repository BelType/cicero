/** Stand-ins for the DOM and for engine results, cast once here so the tests do not scatter casts. A fake is a plain object that carries only what the code under test reads; the cast says so, once. */

/** A plain object taken for a `T`: the single cast behind every fake below. */
export const fake = <T>(shape: object): T => shape as unknown as T;

export const fakeElement = (shape: object = {}): Element => fake<Element>(shape);
export const fakeNode = (shape: object = {}): Node => fake<Node>(shape);
export const fakeText = (shape: object = {}): Text => fake<Text>(shape);
export const fakeRect = (shape: object = {}): DOMRect => fake<DOMRect>(shape);
export const fakeStyle = (shape: object = {}): CSSStyleDeclaration => fake<CSSStyleDeclaration>(shape);
export const fakeDocument = (shape: object = {}): Document => fake<Document>(shape);

/** A function whose arguments and result are read by shape: for engine entry points handed a fake page and answering a verdict the test probes field by field. The signature of the original is deliberately given up. */
export const byShape = <F extends (...args: any[]) => any>(f: F): ((...args: any[]) => any) => f;
