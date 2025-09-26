// Simulate CPU-heavy work without blocking the UI thread.
// We'll compute a simple hash-like operation repeatedly.

function heavyCompute(input) {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < 1_500_000; i++) {
    const ch = input.charCodeAt(i % input.length);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h1 = (h1 << 13) | (h1 >>> 19);
    h2 = (h2 << 11) | (h2 >>> 21);
  }
  h1 = (h1 ^ (h2 >>> 7)) >>> 0;
  h2 = (h2 ^ (h1 >>> 9)) >>> 0;
  return (
    (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")
  );
}

self.onmessage = (e) => {
  const { type, payload } = e.data || {};
  if (type === 'heavy') {
    const started = Date.now();
    const result = heavyCompute(String(payload || ""));
    const elapsed = Date.now() - started;
    self.postMessage({
      worker: 'worker-2',
      kind: 'heavy',
      hash: result,
      ms: elapsed,
      at: new Date().toISOString(),
    });
  }
};
