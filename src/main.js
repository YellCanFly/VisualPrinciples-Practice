import weeks from '../config/weeks.json';
import './styles.css';

const grid = document.querySelector('#week-grid');
document.querySelector('#week-count').textContent = String(weeks.length);

for (const week of weeks) {
  const card = document.createElement('article');
  card.className = 'week-card';
  card.dataset.week = week.id;

  const link = document.createElement('a');
  link.className = 'week-link';
  link.href = `./${week.path}`;
  link.setAttribute('aria-label', `进入第 ${week.number} 周：${week.title}`);

  const preview = document.createElement('div');
  preview.className = 'week-preview';
  const showPreviewPlaceholder = () => {
    const artwork = document.createElement('div');
    artwork.className = 'preview-placeholder';
    artwork.setAttribute('aria-hidden', 'true');
    const weekNumber = document.createElement('span');
    weekNumber.className = 'placeholder-number';
    weekNumber.textContent = `W${week.number}`;
    const topic = document.createElement('span');
    topic.className = 'placeholder-topic';
    topic.textContent = week.title;
    artwork.append(weekNumber, topic);
    preview.replaceChildren(artwork);
  };
  if (typeof week.preview === 'string' && week.preview.trim()) {
    const image = document.createElement('img');
    image.src = `${import.meta.env.BASE_URL}${week.preview}`;
    image.alt = `${week.title}实验界面预览`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = 1440;
    image.height = 900;
    image.addEventListener('error', showPreviewPlaceholder, { once: true });
    preview.append(image);
  } else {
    showPreviewPlaceholder();
  }

  const content = document.createElement('div');
  content.className = 'week-content';
  const meta = document.createElement('div');
  meta.className = 'week-meta';
  const number = document.createElement('span');
  number.textContent = `第 ${Number(week.number)} 周`;
  meta.append(number);
  const title = document.createElement('h3');
  title.textContent = week.title;
  const description = document.createElement('p');
  description.className = 'week-description';
  description.textContent = week.description;
  const action = document.createElement('span');
  action.className = 'week-action';
  action.append(document.createTextNode('进入实验'));
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  action.append(arrow);
  content.append(meta, title, description, action);
  link.append(preview, content);
  card.append(link);
  grid.append(card);
}
