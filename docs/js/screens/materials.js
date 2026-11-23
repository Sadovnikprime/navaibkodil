import { $, esc } from '../utils.js';
import { icon } from '../icons.js';
import { ARTICLES } from '../articles.js';
import { CATEGORIES, CATEGORY_BY_ID } from '../data.js';
import { emptyState } from '../ui.js';

const filter = { category: 'all', query: '' };

const plainText = (html) => html.replace(/<[^>]+>/g, ' ');

function renderList(root) {
  $('#categoryChips', root).innerHTML = [{ id: 'all', label: 'Все' }, ...CATEGORIES]
    .map((c) => `<button type="button" class="chip ${filter.category === c.id ? 'on' : ''}" data-category="${c.id}">${c.label}</button>`)
    .join('');

  const query = filter.query.trim().toLowerCase();
  const visible = ARTICLES.filter((a) =>
    (filter.category === 'all' || a.category === filter.category) &&
    (!query || `${a.title} ${a.lead} ${plainText(a.body)}`.toLowerCase().includes(query)));

  $('#articleList', root).innerHTML = visible.length
    ? visible.map((a) => {
      const category = CATEGORY_BY_ID[a.category];
      return `
        <a class="acard" href="#article-${a.id}">
          <span class="a-ico cat-${a.category}">${icon(category.icon)}</span>
          <span>
            <b>${esc(a.title)}</b>
            <p>${esc(a.lead)}</p>
            <small>${category.label} · ${a.minutes} мин</small>
          </span>
        </a>`;
    }).join('')
    : emptyState({
      iconName: 'search',
      title: 'Ничего не найдено',
      text: 'Попробуйте другой запрос или задайте вопрос специалисту.',
      button: '<a class="btn btn-primary" href="#new">Создать заявку</a>'
    });
}

export default function materialsScreen() {
  const html = `
    <div class="search">
      ${icon('search', 20)}
      <input id="articleSearch" type="search" placeholder="Поиск по материалам"
        value="${esc(filter.query)}" aria-label="Поиск по материалам">
    </div>
    <div class="chips" id="categoryChips"></div>
    <div class="alist" id="articleList" style="margin-top:12px"></div>`;

  function mount(root) {
    renderList(root);
    $('#articleSearch', root).addEventListener('input', (e) => {
      filter.query = e.target.value;
      renderList(root);
    });
    $('#categoryChips', root).addEventListener('click', (e) => {
      const chip = e.target.closest('[data-category]');
      if (!chip) return;
      filter.category = chip.dataset.category;
      renderList(root);
    });
  }

  return { title: 'Полезные материалы', tab: 'materials', html, mount };
}
