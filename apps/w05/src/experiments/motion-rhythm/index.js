import './style.css';
import { evaluateEasing, springProgress, timelineProgress, sequenceDuration } from './model.js';

const colors = ['#2e7863', '#ba6849', '#5d79a3', '#9a729b', '#a78a36'];
const chapters = [
  ['basics', '基础缓动'], ['families', '曲线家族'], ['bezier', 'Bézier'],
  ['physics', '弹簧与阶梯'], ['rhythm', '时间编排'], ['quiz', '课堂练习'],
];
const quizCases = [
  { family: 'cubic', label: 'Ease Out', hint: '一开始推进很快，接近终点逐渐减速。这里采用 Cubic Out。' },
  { family: 'bounce', label: 'Bounce', hint: '先碰到终点，再向起点一侧回弹；不会穿过终点。' },
  { family: 'linear', label: 'Linear', hint: '相等时间走过相等距离，时间—进度图是一条直线。' },
  { family: 'elastic', label: 'Elastic', hint: '多次穿过终点，振荡的幅度逐渐变小。' },
  { family: 'back', label: 'Back', hint: '超过终点后回拉一次。' },
  { family: 'steps', label: 'Steps', hint: '保持一个位置，再瞬间跳到下一档。' },
];
const directions = '<option value="in">In · 慢起</option><option value="out">Out · 慢停</option><option value="inout">InOut · 慢起慢停</option>';

export function mountMotionRhythm(container) {
  const state = {
    chapter: 'basics', group: 'powers', direction: 'out', physics: 'spring', duration: 2,
    x1: .25, y1: .1, x2: .25, y2: 1, mass: 1, stiffness: 100, damping: 10, velocity: 0,
    steps: 5, delay: .3, stagger: .18, time: 0, loop: true,
    running: !matchMedia('(prefers-reduced-motion: reduce)').matches, question: 0, revealed: false,
  };
  const controller = new AbortController();
  let parameterController = new AbortController();
  const $ = selector => container.querySelector(selector);
  const listen = (node, event, handler) => node.addEventListener(event, handler, { signal: controller.signal });
  let curves = [], total = 2, chartMin = 0, chartMax = 1, lastTime = null, animationId, lastPaint = -1;
  const plot = { left: 54, top: 30, width: 494, height: 266 };

  container.innerHTML = `
    <section class="experiment-heading"><div><h1>运动的快慢与节奏</h1><p>让路程相同，改变时间的分配。对照曲线与物体，观察加速、减速和回弹。</p></div><span class="motion-duration-note">默认运动段 2 秒</span></section>
    <section class="motion-lab" aria-label="运动曲线交互实验">
      <nav class="motion-chapters" aria-label="节奏实验章节">${chapters.map(([id, title]) => `<button data-chapter="${id}" aria-pressed="${id === state.chapter}">${title}</button>`).join('')}</nav>
      <div class="motion-layout">
        <section class="motion-observation" aria-label="同步曲线与运动">
          <div class="motion-intro"><h2 id="motion-title"></h2><p id="motion-description"></p></div>
          <div class="motion-views">
            <div class="motion-chart-wrap"><div class="motion-view-label"><span>时间—运动进度</span><span id="motion-chart-unit">斜率对应快慢</span></div><svg id="motion-chart" viewBox="0 0 580 342" role="img" aria-label="横轴时间，纵轴运动进度；彩色点与右侧物体同步"></svg><p class="motion-chart-note" id="motion-chart-note">纵轴是已完成的位移比例，不是速度。曲线越陡，此刻运动越快。</p></div>
            <div class="motion-stage"><div class="motion-view-label"><span>同一路程 · 同步比较</span><span>起点 → 终点</span></div><div id="motion-tracks"></div><div id="motion-legend" class="motion-legend"></div></div>
          </div>
          <div class="motion-transport"><div class="motion-buttons"><button id="motion-play" class="primary-button">暂停</button><button id="motion-replay">重播</button><button id="motion-step">步进 0.1 秒</button></div><label class="motion-loop"><input id="motion-loop" type="checkbox" checked>循环</label><output id="motion-clock">0.00 / 2.00 s</output><label class="motion-scrub"><span>时间轴</span><input id="motion-scrub" aria-label="拖动时间轴" type="range" min="0" max="1000" step="1" value="0"></label></div>
        </section>
        <aside class="motion-controls" aria-label="曲线参数"><div class="motion-panel-heading"><h2>调整参数</h2><button id="motion-reset">恢复本节默认</button></div><div id="motion-parameters"></div><label class="motion-param" for="motion-duration"><span id="motion-duration-label">运动时长 <output id="motion-duration-value">2.00 s</output></span><input id="motion-duration" type="range" min="0.4" max="5" step="0.1" value="2"></label><p class="motion-control-note" id="motion-timing-note"></p></aside>
      </div>
      <section class="motion-reading" aria-label="观察提示"><h2 id="motion-reading-title">怎样读曲线？</h2><p id="motion-reading-text"></p></section>
      <details class="model-notes"><summary>曲线说明与参考</summary><div><p>归一化时间 t 在 0–1 之间，运动进度 p 决定位置 x = 起点 + p × 路程。基础 In / Out / InOut 采用 Cubic 家族，不等同于 CSS 同名的 Bézier 关键词。Back、Elastic 和 Spring 允许 p 超出 0–1；轨道留有空间显示过冲。只有直线路径中，曲线斜率才直接对应沿路径的有符号速度。</p><p>Cubic Bézier 先由横坐标求参数，再取纵坐标，控制点 x 限制为 0–1，y 可越界。Steps 使用 jump-start / jump-end；跳变处瞬时速度没有有限值。Bounce 为分段反弹示意，Elastic 为衰减振荡的缓动公式，两者不等同于真实物理碰撞。</p><p>Spring 使用质量、刚度、阻尼和初速度的解析弹簧响应，以真实秒数计算。观察时长只截取播放窗口，结束时不强制归位；改变参数会从起点重新演示，不模拟中途改目标的状态承接。初速度单位为完整路程/秒。</p><p>依据课件“运动的快慢与节奏”章节改编，图形均由本实验实时绘制。参考：<a href="https://www.w3.org/TR/css-easing-1/" target="_blank" rel="noreferrer">W3C · CSS Easing</a>、<a href="https://easings.net/" target="_blank" rel="noreferrer">Easing Functions Cheat Sheet</a>、<a href="https://ocw.mit.edu/courses/8-03sc-physics-iii-vibrations-and-waves-fall-2016/910ef4a939ed4daa2eafd1f5b06f24fa_MIT8_03SCF16_Lec2.pdf" target="_blank" rel="noreferrer">MIT · Damped Free Oscillators</a>。</p></div></details>
    </section>`;

  function select(label, id, options) {
    return `<label class="motion-select" for="${id}"><span>${label}</span><select id="${id}">${options}</select></label>`;
  }
  function range(label, key, min, max, step, unit = '') {
    return `<label class="motion-param" for="motion-${key}"><span>${label}<output data-value="${key}">${state[key]}${unit}</output></span><input id="motion-${key}" data-parameter="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state[key]}"></label>`;
  }
  function renderParameters() {
    parameterController.abort();
    parameterController = new AbortController();
    const listen = (node, event, handler) => node.addEventListener(event, handler, { signal: parameterController.signal });
    let html = '';
    if (state.chapter === 'basics') html = '<p class="motion-parameter-copy">四条轨道保持相同路程和总时长，只改变加速、减速的分配方式。</p><div class="motion-key"><strong>In</strong><span>慢起步</span><strong>Out</strong><span>慢收尾</span><strong>InOut</strong><span>慢起步，慢收尾</span></div>';
    if (state.chapter === 'families') html = select('曲线组', 'motion-group', '<option value="powers">Quad / Cubic / Quart / Quint</option><option value="smooth">Sine / Expo / Circ</option><option value="rebound">Back / Elastic / Bounce</option>') + select('缓动方向', 'motion-direction', directions);
    if (state.chapter === 'bezier') html = '<p class="motion-parameter-copy">与 CSS ease 并排对比。调整控制点的 x / y，观察同一时刻的位置变化。</p><div class="motion-bezier-presets"><button data-bezier="ease">CSS ease</button><button data-bezier="out">快速进入</button><button data-bezier="back">轻微过冲</button></div>' + range('控制点 1 · x', 'x1', 0, 1, .01) + range('控制点 1 · y', 'y1', -1, 2, .01) + range('控制点 2 · x', 'x2', 0, 1, .01) + range('控制点 2 · y', 'y2', -1, 2, .01) + '<code id="motion-bezier-code" class="motion-code"></code>';
    if (state.chapter === 'physics') {
      html = select('模型', 'motion-physics', '<option value="spring">Spring · 物理弹簧</option><option value="steps">Steps · 离散阶梯</option>');
      if (state.physics === 'spring') html += range('质量 m', 'mass', .5, 3, .1) + range('刚度 k', 'stiffness', 20, 200, 5) + range('阻尼 c', 'damping', 0, 60, 1) + range('初速度 v₀', 'velocity', -5, 5, .1) + '<p id="motion-spring-status" class="motion-control-note"></p>';
      else html += range('阶梯数量', 'steps', 2, 12, 1) + '<p class="motion-parameter-copy">Start 在运动开始时先跳一档；End 保持起点，经过一档时间后才跳。</p>';
    }
    if (state.chapter === 'rhythm') html = select('单个元素的曲线', 'motion-rhythm-family', '<option value="cubic">Cubic Out · 减速</option><option value="linear">Linear · 匀速</option>') + range('整体延迟', 'delay', 0, 2, .1, ' s') + range('相邻元素错峰', 'stagger', 0, .8, .02, ' s') + '<div class="motion-bezier-presets"><button data-rhythm="together">同时开始</button><button data-rhythm="stagger">依次开始</button></div><p class="motion-control-note">延迟移动整组的起点；错峰拉开各元素的开始时间。每个元素的运动时长相同。</p>';
    if (state.chapter === 'quiz') html = '<p class="motion-parameter-copy">先观察运动，再选择曲线。可以暂停、重播或拖动时间轴。</p><div class="motion-quiz-options">' + quizCases.map(item => `<button data-answer="${item.family}">${item.label}</button>`).join('') + '</div><p id="motion-feedback" class="motion-feedback" role="status" aria-live="polite">选择后显示曲线与解释。</p><button id="motion-next">下一题</button>';
    $('#motion-parameters').innerHTML = html;
    const choices = [['group', 'group'], ['direction', 'direction'], ['physics', 'physics'], ['rhythm-family', 'rhythmFamily']];
    for (const [id, key] of choices) if ($(`#motion-${id}`)) $(`#motion-${id}`).value = state[key] || 'cubic';
    for (const input of container.querySelectorAll('[data-parameter]')) listen(input, 'input', () => {
      state[input.dataset.parameter] = Number(input.value);
      container.querySelector(`[data-value="${input.dataset.parameter}"]`).textContent = input.value + (['delay', 'stagger'].includes(input.dataset.parameter) ? ' s' : '');
      rebuild();
    });
    for (const [id, key] of choices) if ($(`#motion-${id}`)) listen($(`#motion-${id}`), 'change', event => { state[key] = event.target.value; if (key === 'physics') renderParameters(); rebuild(); });
    for (const button of container.querySelectorAll('[data-bezier]')) listen(button, 'click', () => {
      const values = { ease: [.25, .1, .25, 1], out: [.16, 1, .3, 1], back: [.34, 1.56, .64, 1] }[button.dataset.bezier];
      [state.x1, state.y1, state.x2, state.y2] = values; renderParameters(); rebuild();
    });
    for (const button of container.querySelectorAll('[data-rhythm]')) listen(button, 'click', () => { state.delay = .3; state.stagger = button.dataset.rhythm === 'together' ? 0 : .18; renderParameters(); rebuild(); });
    for (const button of container.querySelectorAll('[data-answer]')) listen(button, 'click', () => {
      if (state.revealed) return;
      const answer = quizCases[state.question % quizCases.length]; state.revealed = true;
      $('#motion-feedback').textContent = `${button.dataset.answer === answer.family ? '判断正确。' : `本题是 ${answer.label}。`}${answer.hint}`;
      for (const option of container.querySelectorAll('[data-answer]')) { option.disabled = true; if (option.dataset.answer === answer.family) option.classList.add('is-correct'); }
      rebuild(false);
    });
    if ($('#motion-next')) listen($('#motion-next'), 'click', () => { state.question++; state.revealed = false; renderParameters(); rebuild(); });
  }

  function easingCurve(label, family, options = {}) { return { label, sample: t => evaluateEasing(family, t, options) }; }
  function rebuild(reset = true) {
    const direction = state.direction;
    total = state.duration;
    let title, description, reading;
    if (state.chapter === 'basics') {
      title = '相同时长，不同的起步与收尾'; description = '基础 In / Out / InOut 使用 Cubic（三次）家族。';
      curves = [easingCurve('Linear · 匀速', 'linear'), easingCurve('Ease In · 加速', 'cubic', { direction: 'in' }), easingCurve('Ease Out · 减速', 'cubic', { direction: 'out' }), easingCurve('Ease InOut · 慢起慢停', 'cubic', { direction: 'inout' })];
      reading = '拖到时间轴中点：Linear 完成 50%，Cubic In 只完成 12.5%，Cubic Out 已完成 87.5%。它们仍然同时抵达终点。';
    } else if (state.chapter === 'families') {
      const groups = { powers: ['quad', 'cubic', 'quart', 'quint'], smooth: ['sine', 'expo', 'circ'], rebound: ['back', 'elastic', 'bounce'] };
      curves = groups[state.group].map(family => easingCurve(`${family[0].toUpperCase() + family.slice(1)} · ${direction === 'inout' ? 'InOut' : direction === 'in' ? 'In' : 'Out'}`, family, { direction }));
      title = { powers: '同一方向，比较缓动强度', smooth: '温和、集中与圆弧形的时间分配', rebound: '过冲、振荡与碰撞式回弹' }[state.group];
      description = '所有轨道使用相同的路程、时长与缓动方向。';
      reading = { powers: '从 Quad（二次）到 Quint（五次），起停差异越来越明显。切换 In / Out / InOut，比较加速或减速集中在哪一段。', smooth: 'Sine 起停温和；Expo 把位移集中在更短的一段时间；Circ 使用圆弧形的时间映射，不表示物体沿圆弧移动。', rebound: '在 Out 方向下：Back 越过终点后回拉一次；Elastic 多次穿过终点，振幅逐渐减小；Bounce 触及终点后回弹，不越过终点。负斜率表示向起点方向运动。' }[state.group];
    } else if (state.chapter === 'bezier') {
      title = '用两个控制点定制节奏'; description = '虚线连接控制点；横坐标控制时间分配，纵坐标控制进度。';
      curves = [easingCurve('自定义 Bézier', 'bezier', state), easingCurve('CSS ease · 参考', 'bezier', { x1: .25, y1: .1, x2: .25, y2: 1 })];
      reading = '控制点不一定落在实际运动曲线上。x₁、x₂ 限制在 0–1；y 可以越界产生过冲。Bézier 需要先根据横坐标找到时间，再读取纵坐标，不能直接把曲线参数当作时间。';
      $('#motion-bezier-code').textContent = `cubic-bezier(${state.x1}, ${state.y1}, ${state.x2}, ${state.y2})`;
    } else if (state.chapter === 'physics' && state.physics === 'spring') {
      const critical = 2 * Math.sqrt(state.mass * state.stiffness);
      curves = [{ label: `当前阻尼 c = ${state.damping}`, damping: state.damping }, { label: `临界阻尼 c = ${critical.toFixed(1)}`, damping: critical }, { label: `过阻尼 c = ${(critical * 1.6).toFixed(1)}`, damping: critical * 1.6 }].map(item => ({ label: item.label, sample: t => springProgress(t * state.duration, { ...state, damping: item.damping }) }));
      title = '弹簧：速度与阻尼共同决定响应'; description = '三条轨道共用质量、刚度与初速度，只比较阻尼。';
      reading = '阻尼比 ζ = c / (2√mk)。零初速度时，欠阻尼会振荡，临界阻尼快速收敛，过阻尼收敛更慢。非零初速度会改变响应，不能仅凭阻尼类型判断是否过冲。播放窗口结束时保留真实计算位置。';
      const ratio = state.damping / critical;
      $('#motion-spring-status').textContent = `当前 ζ = ${ratio.toFixed(2)} · ${ratio < .999 ? '欠阻尼' : ratio > 1.001 ? '过阻尼' : '临界阻尼'}。初速度单位：路程/秒。`;
    } else if (state.chapter === 'physics') {
      title = '保持，再跳到下一档'; description = '比较相同档数的 jump-start 与 jump-end。';
      curves = [easingCurve('Steps · Start', 'steps', { steps: state.steps, position: 'start' }), easingCurve('Steps · End', 'steps', { steps: state.steps, position: 'end' }), easingCurve('Linear · 参考', 'linear')];
      reading = '阶梯之间的位置保持不变。Start 在 t = 0 时已跳一档，End 在最后一刻跳到终点。跳变处不是平滑加速；可用于逐帧图像、计数与定格效果。';
    } else if (state.chapter === 'rhythm') {
      total = sequenceDuration(state.duration, state.delay, state.stagger, 5);
      curves = Array.from({ length: 5 }, (_, index) => ({ label: `元素 ${index + 1} · ${(state.delay + index * state.stagger).toFixed(2)} s 开始`, sample: t => t * total < state.delay + index * state.stagger ? 0 : evaluateEasing(state.rhythmFamily || 'cubic', timelineProgress(t * total, state.duration, state.delay + index * state.stagger), { direction: 'out' }) }));
      title = '一个动作的快慢，一组动作的节奏'; description = '5 个元素各走相同路程；改变它们何时出发。';
      reading = `整组时长 = 延迟 + 4 × 错峰 + 单个时长 = ${total.toFixed(2)} 秒。拖动时间轴可看到哪些元素在等待、运动或已完成。把错峰调为 0，比较同时出现与依次出现。`;
    } else {
      const item = quizCases[state.question % quizCases.length];
      curves = [easingCurve(state.revealed ? item.label : '待判断的运动', item.family, { direction: 'out', steps: 5, position: 'end' })];
      title = `观察运动，判断曲线 · 第 ${state.question + 1} 题`; description = '作答前隐藏曲线，先从起步、收尾和是否越界判断。';
      reading = state.revealed ? item.hint : '先看：速度是否恒定？是否逐渐减速？是否越过终点？是否保持后跳变？选择右侧答案后，再对照曲线核验。';
    }
    $('#motion-title').textContent = title; $('#motion-description').textContent = description;
    $('#motion-reading-text').textContent = reading;
    const spring = state.chapter === 'physics' && state.physics === 'spring';
    $('#motion-duration-label').firstChild.textContent = spring ? '观察时长 ' : state.chapter === 'rhythm' ? '单个运动时长 ' : '运动时长 ';
    $('#motion-duration-value').textContent = `${state.duration.toFixed(2)} s`;
    $('#motion-duration').value = state.duration;
    $('#motion-timing-note').textContent = spring ? '延长观察时长只显示更多响应过程，不会把弹簧运动拉慢。' : '调整时长会重新开始。曲线形状不变，时长越短，运动越快。';
    const steps = state.chapter === 'physics' && state.physics === 'steps' || state.chapter === 'quiz' && state.revealed && quizCases[state.question % quizCases.length].family === 'steps';
    $('#motion-chart-unit').textContent = steps ? '保持与瞬时跳变' : spring || state.chapter === 'rhythm' ? '横轴为整段秒数' : '斜率对应快慢';
    $('#motion-chart-note').textContent = steps ? '水平段表示位置不变；竖直跳变处没有有限的连续速度。纵轴表示运动进度。' : '纵轴是已完成的位移比例，不是速度。斜率绝对值越大，此刻运动越快。';
    if (reset) { state.time = 0; lastTime = null; }
    drawChart();
    $('#motion-tracks').innerHTML = curves.map((curve, index) => `<div class="motion-track" style="--curve:${colors[index]}"><div class="motion-track-label"><span>${curve.label}</span><output aria-live="off" data-progress="${index}">0%</output></div><div class="motion-rail" data-rail="${index}"><span class="motion-endpoint motion-start">0</span><span class="motion-endpoint motion-end">1</span><span class="motion-runner" data-runner="${index}"></span></div></div>`).join('');
    const zero = 100 * (0 - chartMin) / (chartMax - chartMin), one = 100 * (1 - chartMin) / (chartMax - chartMin);
    for (const rail of container.querySelectorAll('.motion-rail')) { rail.style.setProperty('--zero', `${zero}%`); rail.style.setProperty('--one', `${one}%`); }
    $('#motion-legend').textContent = state.chapter === 'quiz' && !state.revealed ? '进度读数保留，曲线在作答后揭晓。' : '竖线标记起点 0 与终点 1；超出终点表示过冲。';
    lastPaint = -1; paint();
  }

  const px = t => plot.left + t * plot.width;
  const py = p => plot.top + (chartMax - p) / (chartMax - chartMin) * plot.height;
  function drawChart() {
    const values = curves.flatMap(curve => Array.from({ length: 501 }, (_, index) => curve.sample(index / 500)));
    chartMin = Math.min(-.16, ...values.map(value => value - .08)); chartMax = Math.max(1.16, ...values.map(value => value + .08));
    if (state.chapter === 'bezier') { chartMin = Math.min(chartMin, state.y1 - .1, state.y2 - .1); chartMax = Math.max(chartMax, state.y1 + .1, state.y2 + .1); }
    // Keep identical track geometry across questions and before/after revealing.
    if (state.chapter === 'quiz') { chartMin = -.2; chartMax = 1.5; }
    if (state.chapter === 'quiz' && !state.revealed) { $('#motion-chart').innerHTML = '<rect x="54" y="30" width="494" height="266" rx="4" fill="#f0f3eb"/><text x="301" y="150" text-anchor="middle" fill="#4c6858" font-size="18">先观察右侧运动</text><text x="301" y="180" text-anchor="middle" fill="#7d8a79" font-size="13">选择答案后，显示曲线</text>'; return; }
    let content = '';
    for (const y of [0, .5, 1]) content += `<line x1="${px(0)}" x2="${px(1)}" y1="${py(y)}" y2="${py(y)}" stroke="${y === 0 || y === 1 ? '#b5c3b2' : '#e0e6db'}" stroke-dasharray="4 5"/><text x="43" y="${py(y) + 4}" text-anchor="end">${Math.round(y * 100)}%</text>`;
    for (const t of [0, .25, .5, .75, 1]) content += `<line x1="${px(t)}" x2="${px(t)}" y1="${plot.top}" y2="${plot.top + plot.height}" stroke="#e5e9df"/><text x="${px(t)}" y="317" text-anchor="middle">${(t * total).toFixed(2)}</text>`;
    content += '<text x="54" y="18">运动进度 p</text><text x="548" y="338" text-anchor="end">时间（秒）</text>';
    if (state.chapter === 'bezier') content += `<path d="M${px(0)},${py(0)} L${px(state.x1)},${py(state.y1)} M${px(1)},${py(1)} L${px(state.x2)},${py(state.y2)}" stroke="#849a84" fill="none" stroke-dasharray="4 3"/><circle cx="${px(state.x1)}" cy="${py(state.y1)}" r="5" fill="#fcfcf8" stroke="#708b71"/><circle cx="${px(state.x2)}" cy="${py(state.y2)}" r="5" fill="#fcfcf8" stroke="#708b71"/>`;
    curves.forEach((curve, index) => {
      // Duplicate boundary x coordinates for true Steps jumps, rather than drawing diagonal ramps.
      const isSteps = state.chapter === 'physics' && state.physics === 'steps' && index < 2 || state.chapter === 'quiz' && quizCases[state.question % quizCases.length].family === 'steps';
      let samples = Array.from({ length: 501 }, (_, i) => i / 500);
      if (isSteps) { const count = state.chapter === 'quiz' ? 5 : state.steps; samples = [0, ...Array.from({ length: count }, (_, i) => [(i + 1) / count - 1e-8, (i + 1) / count]).flat()]; }
      const path = samples.map((t, i) => `${i ? 'L' : 'M'}${px(t).toFixed(2)},${py(curve.sample(t)).toFixed(2)}`).join(' ');
      content += `<path d="${path}" fill="none" stroke="${colors[index]}" stroke-width="2.4" ${index === 1 && state.chapter === 'bezier' ? 'stroke-dasharray="6 5"' : ''}/>`;
    });
    content += `<line id="motion-cursor" y1="${plot.top}" y2="${plot.top + plot.height}" stroke="#657d66" stroke-width="1" stroke-dasharray="3 3"/>`;
    curves.forEach((_, index) => { content += `<circle data-chart-dot="${index}" r="5" fill="${colors[index]}" stroke="#fcfcf8" stroke-width="2"/>`; });
    $('#motion-chart').innerHTML = content;
  }
  function paint() {
    const t = Math.min(1, state.time / total);
    $('#motion-play').textContent = state.running ? '暂停' : state.time >= total ? '播放（从头）' : '播放';
    $('#motion-clock').textContent = `${Math.min(state.time, total).toFixed(2)} / ${total.toFixed(2)} s`;
    $('#motion-scrub').value = Math.round(t * 1000);
    const cursor = $('#motion-cursor'); if (cursor) { cursor.setAttribute('x1', px(t)); cursor.setAttribute('x2', px(t)); }
    curves.forEach((curve, index) => {
      const p = curve.sample(t);
      const dot = $(`[data-chart-dot="${index}"]`); if (dot) { dot.setAttribute('cx', px(t)); dot.setAttribute('cy', py(p)); }
      $(`[data-runner="${index}"]`).style.left = `${100 * (p - chartMin) / (chartMax - chartMin)}%`;
      $(`[data-progress="${index}"]`).textContent = `${(p * 100).toFixed(1)}%`;
    });
  }
  for (const button of container.querySelectorAll('[data-chapter]')) listen(button, 'click', () => {
    state.chapter = button.dataset.chapter; state.revealed = false;
    for (const chapter of container.querySelectorAll('[data-chapter]')) chapter.setAttribute('aria-pressed', chapter === button);
    renderParameters(); rebuild();
  });
  listen($('#motion-duration'), 'input', event => { state.duration = Number(event.target.value); rebuild(); });
  listen($('#motion-play'), 'click', () => { if (!state.running && state.time >= total) state.time = 0; state.running = !state.running; lastTime = null; paint(); });
  listen($('#motion-replay'), 'click', () => { state.time = 0; state.running = true; lastTime = null; paint(); });
  listen($('#motion-step'), 'click', () => { state.running = false; state.time = Math.min(total, Math.round((Math.min(state.time, total) + .1) * 1000) / 1000); lastTime = null; paint(); });
  listen($('#motion-loop'), 'change', event => { state.loop = event.target.checked; });
  listen($('#motion-scrub'), 'input', event => { state.running = false; state.time = Number(event.target.value) / 1000 * total; lastTime = null; paint(); });
  listen($('#motion-reset'), 'click', () => {
    Object.assign(state, { duration: 2, direction: 'out', group: 'powers', x1: .25, y1: .1, x2: .25, y2: 1, mass: 1, stiffness: 100, damping: 10, velocity: 0, steps: 5, delay: .3, stagger: .18, rhythmFamily: 'cubic', revealed: false });
    renderParameters(); rebuild();
  });
  listen(document, 'visibilitychange', () => { lastTime = null; });
  function frame(now) {
    if (state.running && !document.hidden && lastTime !== null) {
      state.time += Math.min((now - lastTime) / 1000, .1);
      if (state.time >= total && !state.loop) { state.time = total; state.running = false; }
      else if (state.time > total + .8) state.time = 0;
    }
    lastTime = now;
    if (state.time !== lastPaint) { paint(); lastPaint = state.time; }
    animationId = requestAnimationFrame(frame);
  }
  renderParameters(); rebuild(); animationId = requestAnimationFrame(frame);
  return () => { controller.abort(); parameterController.abort(); cancelAnimationFrame(animationId); };
}
