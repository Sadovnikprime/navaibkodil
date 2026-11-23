import { $, esc } from '../utils.js';
import { icon } from '../icons.js';
import { session } from '../api.js';
import { store } from '../store.js';
import { STATUSES, TYPE_BY_ID } from '../data.js';
import { ticketCard, skeletons, emptyState } from '../ui.js';
import { connectionNotice } from './home.js';

const filter = { status: 'all', query: '' };

function matchesQuery(ticket, query) {
  if (!query) return true;
  const text = [ticket.number, ticket.description, TYPE_BY_ID[ticket.type]?.label,
    ticket.program, ticket.company, ticket.name].join(' ').toLowerCase();
  return text.includes(query);
}

function renderFilterChips(root, tickets) {
  const chips = [{ id: 'all', label: 'Все' }, ...STATUSES].map((status) => {
    const count = status.id === 'all' ? tickets.length : tickets.filter((t) => t.status === status.id).length;
    return `
      <button type="button" class="chip ${filter.status === status.id ? 'on' : ''}" data-status="${status.id}">
        ${status.label} <span class="cnt">${count}</span>
      </button>`;
  });
  $('#statusChips', root).innerHTML = chips.join('');
}

function renderList(root) {
  const isSpecialist = session.isSpecialist;
  const all = store.sorted();
  renderFilterChips(root, all);

  const list = $('#ticketList', root);
  if (!store.ready) {
    list.innerHTML = skeletons(3);
    return;
  }

  if (!all.length) {
    list.innerHTML = isSpecialist
      ? emptyState({ iconName: 'list', title: 'Заявок пока нет', text: 'Новые обращения клиентов появятся здесь.' })
      : emptyState({
        iconName: 'list',
        title: 'У вас пока нет заявок',
        text: 'Создайте первую — специалист ответит и будет держать вас в курсе.',
        button: `<a class="btn btn-primary" href="#new">${icon('plus', 20)}Создать заявку</a>`
      });
    return;
  }

  const query = filter.query.trim().toLowerCase().replace(/^№\s*/, '');
  const visible = all.filter((t) =>
    (filter.status === 'all' || t.status === filter.status) && matchesQuery(t, query));

  list.innerHTML = visible.length
    ? visible.map((t) => ticketCard(t, { showClient: isSpecialist })).join('')
    : emptyState({ iconName: 'search', title: 'Ничего не найдено', text: 'Измените фильтр или поисковый запрос.' });
}

export default function ticketsScreen() {
  const html = `
    ${connectionNotice()}
    <div class="search">
      ${icon('search', 20)}
      <input id="searchInput" type="search" placeholder="Поиск по номеру или описанию"
        value="${esc(filter.query)}" aria-label="Поиск заявок">
    </div>
    <div class="chips" id="statusChips"></div>
    <div class="tlist" id="ticketList" style="margin-top:12px"></div>`;

  function mount(root) {
    renderList(root);

    $('#searchInput', root).addEventListener('input', (event) => {
      filter.query = event.target.value;
      renderList(root);
    });

    $('#statusChips', root).addEventListener('click', (event) => {
      const chip = event.target.closest('[data-status]');
      if (!chip) return;
      filter.status = chip.dataset.status;
      renderList(root);
    });
  }

  return {
    title: session.isSpecialist ? 'Все заявки' : 'Мои заявки',
    tab: 'tickets',
    html,
    mount,
    update: renderList
  };
}
