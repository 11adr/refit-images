(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = {
    intro: $('intro'), workspace: $('workspace'), drop: $('drop'), file: $('file'), sample: $('sample'),
    base: $('base'), mp: $('mp'), mr: $('mr'), layers: $('layers'), stage: $('stage'), cursor: $('cursor'),
    tabOrig: $('tab-orig'), tabRes: $('tab-res'), brushbar: $('brushbar'),
    bProtect: $('b-protect'), bRemove: $('b-remove'), bErase: $('b-erase'), brush: $('brush'), clear: $('clear'),
    wPct: $('w-pct'), hPct: $('h-pct'), wPx: $('w-px'), hPx: $('h-px'), reset: $('reset'),
    faces: $('faces'), sobel: $('sobel'), blur: $('blur'), sobelO: $('sobel-o'), blurO: $('blur-o'), maxside: $('maxside'),
    run: $('run'), error: $('error'), hint: $('hint'), meta: $('meta'),
    busy: $('busy'), barFill: $('bar-fill'), busyText: $('busy-text'), cancel: $('cancel'),
    exportBox: $('export'), fmt: $('fmt'), download: $('download'), newBtn: $('new'),
  };

  const state = {
    source: null,        // ImageBitmap / HTMLImageElement of the original file
    name: 'immagine',
    work: null,          // canvas with the working-resolution original
    result: null,        // canvas with the carved result
    view: 'orig',
    tool: null,          // 'protect' | 'remove' | 'erase' | null
    running: false,
    worker: null,
    workerReady: false,
  };

  /* ---------- worker ---------- */
  function startWorker() {
    if (state.worker) state.worker.terminate();
    state.workerReady = false;
    const w = new Worker('worker.js');
    w.onmessage = onWorkerMessage;
    w.onerror = () => fail('Impossibile avviare il motore di elaborazione.');
    state.worker = w;
  }

  function onWorkerMessage(ev) {
    const m = ev.data;
    if (m.type === 'ready') state.workerReady = true;
    else if (m.type === 'progress') progress(m.n);
    else if (m.type === 'error') fail(m.message);
    else if (m.type === 'done') finish(m);
  }

  /* ---------- loading images ---------- */
  async function loadBlob(blob, name) {
    try {
      let bmp;
      try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
      catch { bmp = await createImageBitmap(blob); }
      state.source = bmp;
      state.name = (name || 'immagine').replace(/\.[^.]+$/, '');
      buildWork();
      el.intro.hidden = true;
      el.workspace.hidden = false;
      setView('orig');
      resetSizes();
      el.exportBox.hidden = true;
      el.tabRes.disabled = true;
      state.result = null;
      hideError();
      if (!state.worker) startWorker();
    } catch {
      alert('Questo file non sembra un\'immagine supportata dal browser.');
    }
  }

  function buildWork() {
    const s = state.source;
    const limit = +el.maxside.value;
    let w = s.width, h = s.height;
    if (limit && Math.max(w, h) > limit) {
      const k = limit / Math.max(w, h);
      w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(s, 0, 0, w, h);
    state.work = c;
    for (const m of [el.mp, el.mr]) { m.width = w; m.height = h; }
    el.brush.value = Math.max(8, Math.round(Math.max(w, h) / 30));
    el.brush.max = Math.round(Math.max(w, h) / 4);
  }

  /* ---------- stage / view ---------- */
  function currentCanvas() { return state.view === 'res' && state.result ? state.result : state.work; }

  function setView(v) {
    state.view = v;
    el.tabOrig.setAttribute('aria-selected', v === 'orig');
    el.tabRes.setAttribute('aria-selected', v === 'res');
    const c = currentCanvas();
    el.base.width = c.width; el.base.height = c.height;
    el.base.getContext('2d').drawImage(c, 0, 0);
    const showMasks = v === 'orig';
    el.mp.hidden = el.mr.hidden = !showMasks;
    el.brushbar.style.visibility = showMasks ? 'visible' : 'hidden';
    el.hint.hidden = !showMasks;
    fit();
    updateMeta();
  }

  function fit() {
    const c = currentCanvas();
    if (!c) return;
    const box = el.stage.getBoundingClientRect();
    const k = Math.min((box.width - 2) / c.width, (box.height - 2) / c.height);
    el.layers.style.width = Math.max(1, Math.floor(c.width * k)) + 'px';
    el.layers.style.height = Math.max(1, Math.floor(c.height * k)) + 'px';
  }
  new ResizeObserver(fit).observe(el.stage);

  function updateMeta() {
    const c = currentCanvas();
    if (!c) return;
    const s = state.source;
    let t = `${state.view === 'res' ? 'Risultato' : 'Originale'}: ${c.width} × ${c.height} px`;
    if (state.view === 'orig' && (c.width !== s.width || c.height !== s.height)) {
      t += ` (file originale ${s.width} × ${s.height})`;
    }
    el.meta.textContent = t;
  }

  /* ---------- size controls ---------- */
  function targetSize() {
    return { w: Math.max(1, +el.wPx.value || state.work.width), h: Math.max(1, +el.hPx.value || state.work.height) };
  }
  function resetSizes() {
    el.wPct.value = el.hPct.value = 100;
    el.wPx.value = state.work.width; el.hPx.value = state.work.height;
    syncRun();
  }
  function syncRun() {
    const t = targetSize();
    el.run.disabled = state.running || (t.w === state.work.width && t.h === state.work.height);
  }
  el.wPct.addEventListener('input', () => { el.wPx.value = Math.max(1, Math.round(state.work.width * el.wPct.value / 100)); syncRun(); });
  el.hPct.addEventListener('input', () => { el.hPx.value = Math.max(1, Math.round(state.work.height * el.hPct.value / 100)); syncRun(); });
  el.wPx.addEventListener('input', () => { el.wPct.value = Math.round(100 * el.wPx.value / state.work.width); syncRun(); });
  el.hPx.addEventListener('input', () => { el.hPct.value = Math.round(100 * el.hPx.value / state.work.height); syncRun(); });
  el.reset.addEventListener('click', resetSizes);
  el.sobel.addEventListener('input', () => el.sobelO.value = el.sobel.value);
  el.blur.addEventListener('input', () => el.blurO.value = el.blur.value);
  el.maxside.addEventListener('change', () => {
    if (!state.source) return;
    buildWork(); state.result = null; el.tabRes.disabled = true; el.exportBox.hidden = true;
    setView('orig'); resetSizes();
  });

  /* ---------- brushes ---------- */
  function setTool(t) {
    state.tool = state.tool === t ? null : t;
    el.bProtect.setAttribute('aria-pressed', state.tool === 'protect');
    el.bRemove.setAttribute('aria-pressed', state.tool === 'remove');
    el.bErase.setAttribute('aria-pressed', state.tool === 'erase');
    el.layers.classList.toggle('painting', !!state.tool && state.view === 'orig');
    el.cursor.hidden = true;
  }
  el.bProtect.onclick = () => setTool('protect');
  el.bRemove.onclick = () => setTool('remove');
  el.bErase.onclick = () => setTool('erase');
  el.clear.onclick = () => { for (const m of [el.mp, el.mr]) m.getContext('2d').clearRect(0, 0, m.width, m.height); };
  el.tabOrig.onclick = () => { if (!state.running) setView('orig'); };
  el.tabRes.onclick = () => { if (state.result && !state.running) setView('res'); };

  let last = null;
  const ptr = (e) => {
    const r = el.layers.getBoundingClientRect();
    return { x: (e.clientX - r.left) * el.mp.width / r.width, y: (e.clientY - r.top) * el.mp.height / r.height, px: e.clientX - r.left, py: e.clientY - r.top, scale: r.width / el.mp.width };
  };
  function stroke(a, b) {
    const size = +el.brush.value;
    const draw = (cv, mode, color) => {
      const ctx = cv.getContext('2d');
      ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = size;
      ctx.globalCompositeOperation = mode; ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y); ctx.stroke();
    };
    if (state.tool === 'protect') { draw(el.mp, 'source-over', '#22c55e'); draw(el.mr, 'destination-out', '#000'); }
    else if (state.tool === 'remove') { draw(el.mr, 'source-over', '#ef4444'); draw(el.mp, 'destination-out', '#000'); }
    else { draw(el.mp, 'destination-out', '#000'); draw(el.mr, 'destination-out', '#000'); }
  }
  function moveCursor(p) {
    const d = +el.brush.value * p.scale;
    Object.assign(el.cursor.style, { width: d + 'px', height: d + 'px', left: p.px + 'px', top: p.py + 'px' });
    el.cursor.className = 'cursor ' + (state.tool === 'erase' ? '' : state.tool);
    el.cursor.hidden = false;
  }
  el.layers.addEventListener('pointerdown', (e) => {
    if (!state.tool || state.view !== 'orig' || state.running) return;
    el.layers.setPointerCapture(e.pointerId);
    last = ptr(e); stroke(last, last); moveCursor(last);
  });
  el.layers.addEventListener('pointermove', (e) => {
    if (!state.tool || state.view !== 'orig') return;
    const p = ptr(e); moveCursor(p);
    if (last) { stroke(last, p); last = p; }
  });
  const endStroke = () => { last = null; };
  el.layers.addEventListener('pointerup', endStroke);
  el.layers.addEventListener('pointercancel', endStroke);
  el.layers.addEventListener('pointerleave', () => { el.cursor.hidden = true; });

  function maskBuffer(cv) {
    const ctx = cv.getContext('2d');
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    let any = false;
    for (let i = 0; i < d.length; i += 4) {
      const on = d[i + 3] > 127;
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = on ? 255 : 0;
      if (on) any = true;
    }
    return any ? img.data.buffer : null;
  }

  /* ---------- running ---------- */
  let totalSeams = 1;
  function estimateSeams(w, h, nw, nh) {
    if (nw && nh && nw < w && nh < h) {
      const m = Math.min(w / nw, h / nh);
      return Math.max(1, Math.round(w / m) - nw + Math.round(h / m) - nh);
    }
    return Math.max(1, Math.abs(nw ? nw - w : 0) + Math.abs(nh ? nh - h : 0));
  }

  el.run.addEventListener('click', () => {
    if (state.running) return;
    const w = state.work.width, h = state.work.height, t = targetSize();
    const nw = t.w === w ? 0 : t.w, nh = t.h === h ? 0 : t.h;
    if (!nw && !nh) return;
    hideError();

    const ctx = state.work.getContext('2d');
    const pixels = ctx.getImageData(0, 0, w, h).data.buffer;
    const protect = maskBuffer(el.mp), remove = maskBuffer(el.mr);
    const transfer = [pixels, protect, remove].filter(Boolean);

    totalSeams = estimateSeams(w, h, nw, nh);
    state.running = true;
    setBusy(true);
    progress(0);
    state.worker.postMessage({
      type: 'run', pixels, width: w, height: h, protect, remove,
      opts: { width: nw, height: nh, sobel: +el.sobel.value, blur: +el.blur.value, faces: el.faces.checked },
    }, transfer);
  });

  function setBusy(on) {
    el.busy.hidden = !on;
    el.run.disabled = on;
    el.tabOrig.disabled = on;
    if (!on) syncRun();
  }
  function progress(n) {
    const p = Math.min(0.99, n / totalSeams);
    el.barFill.style.width = (p * 100).toFixed(1) + '%';
    el.busyText.textContent = n ? `Elaborazione… ${Math.round(p * 100)}%` : 'Preparazione…';
  }
  function finish(m) {
    const c = document.createElement('canvas');
    c.width = m.width; c.height = m.height;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(m.pixels), m.width, m.height), 0, 0);
    state.result = c;
    state.running = false;
    el.barFill.style.width = '100%';
    setBusy(false);
    el.tabRes.disabled = false;
    el.tabOrig.disabled = false;
    el.exportBox.hidden = false;
    setView('res');
  }
  function fail(msg) {
    state.running = false;
    setBusy(false);
    el.tabOrig.disabled = false;
    el.error.textContent = msg.replace(/\s+/g, ' ').trim();
    el.error.hidden = false;
    startWorker(); // a worker that threw may be in an undefined state
  }
  function hideError() { el.error.hidden = true; }

  el.cancel.addEventListener('click', () => {
    if (!state.running) return;
    state.running = false;
    startWorker(); // terminating is the only way to stop a running WASM call
    setBusy(false);
    el.tabOrig.disabled = false;
  });

  /* ---------- export ---------- */
  el.download.addEventListener('click', () => {
    if (!state.result) return;
    const type = 'image/' + el.fmt.value;
    const ext = el.fmt.value === 'jpeg' ? 'jpg' : el.fmt.value;
    let src = state.result;
    if (type === 'image/jpeg') { // JPEG has no alpha: flatten on white
      src = document.createElement('canvas');
      src.width = state.result.width; src.height = state.result.height;
      const x = src.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, src.width, src.height);
      x.drawImage(state.result, 0, 0);
    }
    src.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${state.name}-caire-${state.result.width}x${state.result.height}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, type, 0.95);
  });

  /* ---------- input: drop, picker, paste, sample ---------- */
  const pick = (f) => { if (f && f.type.startsWith('image/')) loadBlob(f, f.name); };
  el.file.addEventListener('change', () => pick(el.file.files[0]));
  el.drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.file.click(); } });
  ['dragenter', 'dragover'].forEach(t => document.addEventListener(t, (e) => { e.preventDefault(); el.drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => document.addEventListener(t, (e) => { e.preventDefault(); el.drop.classList.remove('over'); }));
  document.addEventListener('drop', (e) => pick(e.dataTransfer.files[0]));
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) pick(item.getAsFile());
  });
  el.sample.addEventListener('click', async () => {
    const r = await fetch('sample.jpg');
    loadBlob(await r.blob(), 'esempio');
  });
  el.newBtn.addEventListener('click', () => {
    if (state.running) return;
    el.workspace.hidden = true; el.intro.hidden = false;
    el.file.value = '';
  });

  startWorker(); // warm up the engine while the visitor chooses a picture
})();
