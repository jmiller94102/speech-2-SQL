self.onmessage = (e) => {
  const { type, payload } = e.data || {};
  if (type === 'echo') {
    const latency = Math.floor(200 + Math.random() * 600); // 200-800ms
    setTimeout(() => {
      self.postMessage({
        worker: 'worker-1',
        kind: 'echo',
        payload,
        latency,
        at: new Date().toISOString(),
      });
    }, latency);
  }
};
