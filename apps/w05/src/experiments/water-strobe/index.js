import { FALL_HEIGHT, FALL_TIME, dropsAt, positionAtAge, sampledTime, sampleIndex, samplingRelation } from './model.js';

const regimes = {
  up: { symbol: '↑', title: '表观倒流', description: '灯闪得稍快，下一次照见更年轻、更高的一滴，图样向上移动。' },
  still: { symbol: '＝', title: '表观悬停', description: '闪光与滴水同频，每次照见相同的相位，图样停在原处。' },
  down: { symbol: '↓', title: '表观慢落', description: '灯闪得稍慢，下一次照见稍年长、更低的一滴，图样向下移动。' },
};

export function mountWaterStrobe(container) {
  container.innerHTML = `
    <section class="experiment-heading">
      <div><h1>水滴倒流<span>频闪效应</span></h1><p>水滴始终向下，改变观察的节奏，就会看到不同的运动。</p></div>
      <a class="source-link" href="https://www.bilibili.com/video/BV19W4y1E7qS" target="_blank" rel="noreferrer">参考视频 ↗</a>
    </section>
    <div class="lab-layout">
      <section class="observation" aria-label="实际运动与频闪观察对比">
        <div class="view-grid">
          <div class="view">
            <div class="view-heading"><h2><i class="dot real-dot"></i>真实运动</h2><span>连续下落</span></div>
            <canvas id="real-view" role="img" aria-label="水滴受重力影响连续下落，标记后可追踪同一滴水"></canvas>
            <div class="view-caption"><span>↓ 每一滴都向下</span><span>连续运动示意</span></div>
          </div>
          <div class="view sampled-view">
            <div class="view-heading"><h2><i class="dot sampled-dot"></i>频闪观察</h2><span id="sample-label">24.6 次 / 秒</span></div>
            <canvas id="sample-view" role="img" aria-label="仅显示闪光时刻的水滴位置，保留画面至下一次采样"></canvas>
            <div class="view-caption"><span id="direction-caption">↑ 表观倒流</span><span>逐次采样 · 保留画面</span></div>
          </div>
        </div>
        <div class="playback">
          <div class="playback-actions"><button id="play" class="primary-button">暂停</button><button id="step">下一次闪光</button><button id="reset" class="icon-button" title="恢复初始参数与时间" aria-label="重置实验">↺</button></div>
          <label class="speed-control">播放速度<select id="speed" aria-label="播放速度"><option value="1">1×</option><option value="0.25">0.25× 慢放</option></select></label>
          <span id="clock" class="clock">t = 0.00 s</span>
        </div>
      </section>
      <aside class="controls" aria-label="实验参数">
        <div class="panel-heading"><h2>调整观察节奏</h2><span>Hz = 次 / 秒</span></div>
        <div class="presets" aria-label="频率预设"><button data-preset="up">倒流</button><button data-preset="still">悬停</button><button data-preset="down">慢落</button></div>
        <div class="parameter">
          <label for="drop-frequency">滴水频率 <span>f<sub>d</sub></span></label>
          <div class="number-row"><input id="drop-frequency" type="number" min="12" max="40" step="0.1" value="24" aria-label="滴水频率"><span>Hz</span></div>
          <input id="drop-range" type="range" min="12" max="40" step="0.1" value="24" aria-label="调节滴水频率">
          <div class="range-labels"><span>12 Hz</span><span>40 Hz</span></div>
        </div>
        <div class="parameter light-parameter">
          <label for="flash-frequency">光源频率 <span>f<sub>s</sub></span></label>
          <div class="number-row"><input id="flash-frequency" type="number" min="21" max="27" step="0.1" value="24.6" aria-label="光源频率"><span>Hz</span></div>
          <input id="flash-range" type="range" min="21" max="27" step="0.1" value="24.6" aria-label="调节光源频率">
          <div class="range-labels"><span id="flash-min">21 Hz</span><span id="flash-max">27 Hz</span></div>
          <p class="control-hint">围绕滴水频率微调 ±3 Hz</p>
        </div>
        <div id="result" class="result" role="status" aria-live="polite"><div class="result-main"><span id="result-symbol">↑</span><div><strong id="result-title">表观倒流</strong><p id="frequency-difference">光源比滴水快 0.6 Hz</p></div></div><p id="result-description"></p></div>
        <div class="tracking"><label><input id="track" type="checkbox">标记同一滴水</label><button id="remark" disabled>重新标记</button><p id="track-hint">用橙色追踪一滴水，检查它的真实方向。</p></div>
      </aside>
    </div>
    <section class="principle" aria-labelledby="principle-title">
      <div class="principle-intro"><h2 id="principle-title">为什么会“倒流”？</h2><p>相邻水滴很相似。连续闪光中，视觉会把<strong>不同水滴</strong>的位置连接起来。</p><p class="principle-note">这里比较相邻五次闪光中，依次出现的五滴水。</p></div>
      <div class="sampling-detail"><div class="detail-heading"><span>连续 5 次闪光 · 局部位移放大</span><span>时间 →</span></div><svg id="sample-diagram" viewBox="0 0 600 145" role="img" aria-label="相邻五次闪光中的水滴位置与水滴身份"></svg></div>
      <div class="phase-explanation"><span class="eyebrow">每次相差多少？</span><div id="phase-delta" class="phase-value">−1.02 <span>ms</span></div><p id="phase-description"></p><div class="formula">Δt = 1/f<sub>s</sub> − 1/f<sub>d</sub></div></div>
    </section>
    <details class="model-notes"><summary>模型说明与参考</summary><div><p>假设水滴以固定频率产生，初速度相同，随后在重力下自由下落：y = v₀a + ½ga²（a 为水滴下落时间）。本例忽略空气阻力、液滴变形与合并，尺寸和局部位移经过教学放大。</p><p>网页计算每次闪光时刻的水滴位置，并保留至下一次采样；光源频率是模拟的采样频率，不是修改显示器刷新率，也不是对眼睛视觉暂留的精确模拟。实际画面更新仍受设备刷新率限制；慢放和“下一次闪光”可帮助观察。左侧同样是屏幕动画，标记水滴可辨认真实运动。</p><p>频率调节限定在滴水频率附近，展示一对一的相邻水滴匹配。更远的频率比可能出现多重图样等混叠现象，不在本例范围内。更改频率会重新开始计时；调整滴水频率时保留当前频差。页面不使用整屏明暗频闪。</p><p>来源：<a href="https://www.bilibili.com/video/BV19W4y1E7qS" target="_blank" rel="noreferrer">李论科学《水滴为什么会倒流？这是频闪光源导致的》</a>；<a href="https://physics.appstate.edu/catalog/1-mechanics/1c-motion-one-dimension/falling-drops" target="_blank" rel="noreferrer">Appalachian State University · Falling Drops</a>。图形为本实验绘制。</p></div></details>
  `;

  const $ = selector => container.querySelector(selector);
  const controller = new AbortController();
  const listen = (target, event, handler) => target.addEventListener(event, handler, { signal: controller.signal });
  const state = { drop: 24, flash: 24.6, time: 0, speed: 1, running: !matchMedia('(prefers-reduced-motion: reduce)').matches, track: false, trackedId: null };
  const canvases = [$('#real-view'), $('#sample-view')];
  const contexts = canvases.map(canvas => canvas.getContext('2d'));
  let animationId;
  let lastTime = null;
  let lastReadout = -1;

  function resetTime() {
    state.time = 0;
    state.trackedId = state.track ? -2 : null;
    lastTime = null;
    lastReadout = -1;
  }

  function updateControls() {
    $('#drop-frequency').value = state.drop.toFixed(1);
    $('#drop-range').value = state.drop;
    for (const element of [$('#flash-frequency'), $('#flash-range')]) {
      element.min = (state.drop - 3).toFixed(1);
      element.max = (state.drop + 3).toFixed(1);
      element.value = state.flash.toFixed(1);
    }
    $('#flash-min').textContent = `${(state.drop - 3).toFixed(1)} Hz`;
    $('#flash-max').textContent = `${(state.drop + 3).toFixed(1)} Hz`;
    $('#sample-label').textContent = `${state.flash.toFixed(1)} 次 / 秒`;
    const relation = samplingRelation(state.drop, state.flash);
    const regime = regimes[relation.direction];
    $('#result-symbol').textContent = regime.symbol;
    $('#result-title').textContent = regime.title;
    $('#direction-caption').textContent = `${regime.symbol} ${regime.title}`;
    $('#sample-view').setAttribute('aria-label', `频闪观察：${regime.title}。${regime.description}`);
    $('#frequency-difference').textContent = relation.direction === 'still' ? '光源与滴水同频' : `光源比滴水${relation.difference > 0 ? '快' : '慢'} ${Math.abs(relation.difference).toFixed(1)} Hz`;
    $('#result-description').textContent = regime.description;
    for (const button of container.querySelectorAll('[data-preset]')) button.setAttribute('aria-pressed', String(button.dataset.preset === relation.direction));
    const dt = relation.ageStep * 1000;
    $('#phase-delta').innerHTML = `${dt < -1e-8 ? '−' : dt > 1e-8 ? '+' : ''}${Math.abs(dt).toFixed(2)} <span>ms</span>`;
    $('#phase-description').textContent = relation.direction === 'still' ? '下一滴被照亮时，下落时间完全相同。位置保持不变。' : `下一滴被照亮时，下落时间${dt < 0 ? '缩短' : '增加'} ${Math.abs(dt).toFixed(2)} ms，位置${dt < 0 ? '更高' : '更低'}。`;
    drawDiagram(relation.ageStep);
    updatePlayback();
  }

  function drawDiagram(ageStep) {
    const displacements = Array.from({ length: 5 }, (_, index) => positionAtAge(0.36 + index * ageStep) - positionAtAge(0.36));
    const magnification = Math.min(1150, 36 / (Math.max(...displacements.map(Math.abs)) || 1));
    const points = displacements.map((displacement, index) => ({ x: 44 + index * 128, y: 68 + displacement * magnification }));
    const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
    $('#sample-diagram').innerHTML = `<line x1="25" x2="580" y1="68" y2="68" stroke="#ccd6cc" stroke-dasharray="4 6"/><path d="${path}" fill="none" stroke="#458776" stroke-width="1.5"/>${points.map((point, index) => `<line x1="${point.x}" x2="${point.x}" y1="22" y2="108" stroke="#dfe4db"/><text x="${point.x}" y="16" text-anchor="middle" fill="#738075" font-size="11">${index === 0 ? '0 ms' : `+${(index / state.flash * 1000).toFixed(1)} ms`}</text><circle cx="${point.x}" cy="${point.y}" r="6" fill="#398b79" stroke="#f6f7f0" stroke-width="2"/><text x="${point.x}" y="132" text-anchor="middle" fill="#384e41" font-size="12">水滴 ${String.fromCharCode(65 + index)}</text>`).join('')}`;
  }

  function updatePlayback() {
    $('#play').textContent = state.running ? '暂停' : '播放';
    $('#step').title = '暂停并推进到下一次闪光时刻';
    $('#speed').value = String(state.speed);
    $('#track').checked = state.track;
    $('#remark').disabled = !state.track;
  }

  function setFrequency(kind, raw) {
    if (raw.trim() === '' || !Number.isFinite(Number(raw))) { updateControls(); return; }
    const value = Math.round(Number(raw) * 10) / 10;
    if (kind === 'drop') {
      const difference = state.flash - state.drop;
      state.drop = Math.min(40, Math.max(12, value));
      state.flash = Math.round((state.drop + difference) * 10) / 10;
    } else state.flash = Math.min(state.drop + 3, Math.max(state.drop - 3, value));
    resetTime();
    updateControls();
  }

  for (const kind of ['drop', 'flash']) {
    listen($(`#${kind}-range`), 'input', event => setFrequency(kind, event.target.value));
    listen($(`#${kind}-frequency`), 'change', event => setFrequency(kind, event.target.value));
  }
  for (const button of container.querySelectorAll('[data-preset]')) {
    listen(button, 'click', () => {
      state.flash = state.drop + ({ up: 0.6, still: 0, down: -0.6 }[button.dataset.preset]);
      resetTime();
      updateControls();
    });
  }
  listen($('#play'), 'click', () => { state.running = !state.running; lastTime = null; updatePlayback(); });
  listen($('#step'), 'click', () => { state.running = false; state.time = (sampleIndex(state.time, state.flash) + 1) / state.flash; lastTime = null; updatePlayback(); });
  listen($('#speed'), 'change', event => { state.speed = Number(event.target.value); });
  listen($('#reset'), 'click', () => { Object.assign(state, { drop: 24, flash: 24.6, speed: 1, running: !matchMedia('(prefers-reduced-motion: reduce)').matches, track: false }); resetTime(); updateControls(); });
  function markDrop() { state.trackedId = Math.floor(state.time * state.drop) - 2; lastReadout = -1; }
  listen($('#track'), 'change', event => { state.track = event.target.checked; if (state.track) markDrop(); else state.trackedId = null; lastReadout = -1; updatePlayback(); });
  listen($('#remark'), 'click', markDrop);
  listen(document, 'visibilitychange', () => { lastTime = null; });

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    for (const canvas of canvases) {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
  }
  const observer = new ResizeObserver(resize);
  canvases.forEach(canvas => observer.observe(canvas));

  function drawScene(canvas, ctx, time, sampled) {
    if (!ctx || !canvas.width) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const x = w * 0.53, top = 49, bottom = h - 44;
    const scale = (bottom - top) / FALL_HEIGHT;
    const toY = value => top + value * scale;
    const glow = ctx.createRadialGradient(x, h * .5, 0, x, h * .5, h * .7);
    glow.addColorStop(0, sampled ? '#173c3d' : '#253838');
    glow.addColorStop(1, '#152326');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.font = '10px system-ui, sans-serif';
    for (let y = .5; y <= 2; y += .5) {
      ctx.strokeStyle = '#ffffff0d';
      ctx.beginPath(); ctx.moveTo(32, toY(y)); ctx.lineTo(w - 28, toY(y)); ctx.stroke();
      ctx.fillStyle = '#7f9999'; ctx.fillText(`${y.toFixed(1)} m`, 15, toY(y) - 7);
    }
    // Faucet and collecting tray are schematic, not video assets.
    ctx.strokeStyle = '#819897'; ctx.lineWidth = 12; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(x - 48, 19); ctx.lineTo(x - 9, 19); ctx.quadraticCurveTo(x, 19, x, 30); ctx.lineTo(x, 41); ctx.stroke();
    ctx.strokeStyle = '#c6d9d1'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 48, 14); ctx.lineTo(x - 8, 14); ctx.stroke();
    ctx.fillStyle = '#9badaa'; ctx.fillRect(x - 8, 39, 16, 4);
    ctx.fillStyle = '#1c3337'; ctx.fillRect(x - 52, bottom + 4, 104, 17);
    ctx.strokeStyle = '#617c7d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 57, bottom + 2); ctx.lineTo(x - 50, bottom + 21); ctx.lineTo(x + 50, bottom + 21); ctx.lineTo(x + 57, bottom + 2); ctx.stroke();
    ctx.strokeStyle = '#78b6b982'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, bottom + 6, 37, 3, 0, 0, Math.PI * 2); ctx.stroke();

    ctx.save(); ctx.beginPath(); ctx.rect(0, top - 3, w, bottom - top + 6); ctx.clip();
    const drops = dropsAt(time, state.drop);
    for (const drop of drops) {
      const y = toY(drop.y);
      const tracked = state.track && drop.id === state.trackedId;
      const radius = Math.max(3.2, Math.min(5, w / 70));
      if (!sampled) {
        const trailLength = Math.min(20, (drop.y - positionAtAge(Math.max(0, drop.age - .018))) * scale);
        const trail = ctx.createLinearGradient(x, y - trailLength, x, y);
        trail.addColorStop(0, '#a6d8d400'); trail.addColorStop(1, tracked ? '#efa97788' : '#a6d8d455');
        ctx.strokeStyle = trail; ctx.lineWidth = radius * 1.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y - trailLength); ctx.lineTo(x, y); ctx.stroke();
      }
      const color = tracked ? '#ffc28a' : sampled ? '#9fe6da' : '#c0dedb';
      ctx.shadowColor = color; ctx.shadowBlur = sampled ? 9 : 4;
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, radius, radius * 1.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f6fffc'; ctx.beginPath(); ctx.ellipse(x - 1.2, y - 1.5, 1.1, 1.5, 0, 0, Math.PI * 2); ctx.fill();
      if (tracked) {
        ctx.strokeStyle = '#ffc28a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, radius + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = '#ffd0a4'; ctx.fillText('同一滴', x + 18, y + 4);
      }
    }
    ctx.restore();
    ctx.fillStyle = '#99b1ad'; ctx.font = '11px system-ui, sans-serif';
    if (sampled) ctx.fillText(`采样 #${sampleIndex(state.time, state.flash)}`, 15, h - 12);
    else ctx.fillText('重力 g = 9.81 m/s²', 15, h - 12);
  }

  function frame(now) {
    if (lastTime !== null && state.running && !document.hidden) state.time += Math.min((now - lastTime) / 1000, .1) * state.speed;
    lastTime = now;
    drawScene(canvases[0], contexts[0], state.time, false);
    drawScene(canvases[1], contexts[1], sampledTime(state.time, state.flash), true);
    const readout = Math.floor(state.time * 30);
    if (readout !== lastReadout) {
      $('#clock').textContent = `t = ${state.time.toFixed(2)} s`;
      const departed = state.track && state.time - state.trackedId / state.drop > FALL_TIME;
      $('#track-hint').textContent = !state.track ? '用橙色追踪一滴水，检查它的真实方向。' : departed ? '标记水滴已落出。点击“重新标记”可再观察。' : '橙色是同一滴水；两边都在向下落。';
      lastReadout = readout;
    }
    animationId = requestAnimationFrame(frame);
  }
  updateControls();
  resize();
  animationId = requestAnimationFrame(frame);
  return () => { controller.abort(); observer.disconnect(); cancelAnimationFrame(animationId); };
}
