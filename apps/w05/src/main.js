import './style.css';
import { experiments } from './experiments/index.js';

document.querySelector('#app').innerHTML = `
  <header class="site-header">
    <a class="course-link" href="../" aria-label="返回课程首页">← <span>课程首页</span></a>
    <div class="course-title"><span class="week-label">W05</span><span>运动知觉与时间采样</span></div>
    <span class="header-note">视觉原理 · 交互实验</span>
  </header>
  <nav class="case-nav" aria-label="本周案例"></nav>
  <main id="experiment"></main>
`;

const navigation = document.querySelector('.case-nav');
for (const [index, experiment] of experiments.entries()) {
  const link = document.createElement('a');
  link.href = `#${experiment.id}`;
  link.textContent = `${String(index + 1).padStart(2, '0')}　${experiment.title}`;
  link.dataset.case = experiment.id;
  navigation.append(link);
}

let cleanup;
let mountedId;
function showExperiment() {
  const id = location.hash.slice(1);
  const experiment = experiments.find(item => item.id === id) || experiments[0];
  if (id !== experiment.id) history.replaceState(null, '', `#${experiment.id}`);
  if (mountedId === experiment.id) return;
  cleanup?.();
  for (const link of navigation.children) {
    if (link.dataset.case === experiment.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.title = `${experiment.title} · W05 · 视觉原理`;
  cleanup = experiment.mount(document.querySelector('#experiment'));
  mountedId = experiment.id;
}
window.addEventListener('hashchange', showExperiment);
showExperiment();
