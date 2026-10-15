// Placeholder used during the test-first phase. Every engine function throws
// this until it is built in phase 2, so the tests fail for a clear reason.
export function notImplemented(name) {
  throw new Error(`${name} is not built yet (phase 2)`);
}
