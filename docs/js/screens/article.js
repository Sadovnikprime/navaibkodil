import { $, esc, storage, KEYS } from '../utils.js';
import { icon } from '../icons.js';
import { ARTICLE_BY_ID } from '../articles.js';
import { CATEGORY_BY_ID } from '../data.js';
import { go } from '../nav.js';
import { emptyState } from '../ui.js';

export default function articleScreen({ id }) {
  const article = ARTICLE_BY_ID[id];
  if (!article) {
    return {
      title: 'Материал', back: 'materials', tab: 'materials',
      html: emptyState({
        iconName: 'search',
        title: 'Материал не найден',
        button: '<a class="btn btn-dark" href="#materials">Все материалы</a>'
      })
    };
  }

  const category = CATEGORY_BY_ID[article.category];

  const html = `
    <article class="article">
      <span class="a-cat cat-${article.category}">${category.label}</span>
      <h2>${esc(article.title)}</h2>
      <div class="a-meta">${article.minutes} мин чтения</div>
      <div class="a-body">${article.body}</div>
    </article>

    <div class="card help-cta" style="margin-top:12px">
      <p>Не получилось решить вопрос самостоятельно?</p>
      <button class="btn btn-primary btn-block" id="askButton" type="button">${icon('plus', 20)}Создать заявку</button>
    </div>`;

  function mount(root) {
    $('#askButton', root).addEventListener('click', () => {
      const draft = storage.get(KEYS.draft, {});
      if (!draft.type) storage.set(KEYS.draft, { ...draft, type: article.ticketType });
      go('new');
    });
  }

  return { title: category.label, back: 'materials', tab: 'materials', html, mount };
}
