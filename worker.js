// Web Worker: runs the caire WebAssembly engine off the main thread.
importScripts('wasm_exec.js');

const ready = (async () => {
  const go = new Go();
  let result;
  try {
    result = await WebAssembly.instantiateStreaming(fetch('caire.wasm'), go.importObject);
  } catch (e) {
    // Fallback for servers that do not send application/wasm.
    const buf = await (await fetch('caire.wasm')).arrayBuffer();
    result = await WebAssembly.instantiate(buf, go.importObject);
  }
  go.run(result.instance); // never resolves: Go main blocks forever
  for (let i = 0; i < 100 && !self.caireReady; i++) await new Promise(r => setTimeout(r, 20));
  if (!self.caireReady) throw new Error('Il motore non si è avviato');
})();

ready.then(() => postMessage({ type: 'ready' }), e => postMessage({ type: 'error', message: String(e.message || e) }));

onmessage = async (ev) => {
  const m = ev.data;
  if (m.type !== 'run') return;
  try {
    await ready;
    const opts = { ...m.opts };
    const out = self.caireResize(
      new Uint8ClampedArray(m.pixels), m.width, m.height,
      {
        width: opts.width, height: opts.height, sobel: opts.sobel, blur: opts.blur, faces: opts.faces,
        protect: m.protect ? new Uint8ClampedArray(m.protect) : null,
        remove: m.remove ? new Uint8ClampedArray(m.remove) : null,
      },
      (n) => postMessage({ type: 'progress', n })
    );
    if (out.error) throw new Error(out.error);
    const buf = out.pixels.buffer;
    postMessage({ type: 'done', width: out.width, height: out.height, pixels: buf }, [buf]);
  } catch (e) {
    postMessage({ type: 'error', message: String(e.message || e) });
  }
};
