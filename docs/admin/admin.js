import { $, $$, esc } from '../js/utils.js';
import { icon } from '../js/icons.js';
import { request, session, onUnauthorized, onSlowServer } from '../js/api.js';
import { STATUSES, STATUS_BY_ID, TYPE_BY_ID, URGENCY, URGENCY_BY_ID } from '../js/data.js';

const REFRESH_EVERY_MS = 20000;

const state = {
  page: 'tickets',
  openTicketId: null,
  tickets: [],
  stats: null,
  filter: { status: '', urgency: '', query: '' },
  updatedAt: null,
  refreshTimer: null,
  draft: null
};

const pad = (n) => String(n).padStart(2, '0');

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const formatDay = (ts) => formatDateTime(ts).slice(0, 10);

let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const statusBadge = (status) => `<span class="badge st-${status}">${esc(STATUS_BY_ID[status]?.label || status)}</span>`;
const urgencyBadge = (urgency) => `<span class="urg urg-${urgency}">${esc(URGENCY_BY_ID[urgency]?.label || urgency)}</span>`;

const errorText = (error) => (error.fields ? Object.values(error.fields).join('. ') : error.message);

function showLogin(message = '') {
  clearInterval(state.refreshTimer);
  closePanel();

  $('#root').innerHTML = `
    <div class="login">
      <form class="login-card" id="loginForm" novalidate>
        <div class="logo">
          <span class="logo-mark">${icon('logo', 22)}</span>
          <span><b>1С: <span>Помощник</span></b><small>Админ-панель</small></span>
        </div>
        <h1>Вход для специалистов</h1>
        <p>Используйте учётную запись сотрудника компании</p>
        <div class="form-err" id="loginError" ${message ? '' : 'hidden'}>${esc(message)}</div>
        <label class="field"><span>Телефон или email</span><input class="input" name="login" autocomplete="username"></label>
        <label class="field"><span>Пароль</span><input class="input" type="password" name="password" autocomplete="current-password"></label>
        <button class="btn btn-primary" style="width:100%;height:48px" type="submit" id="loginButton">Войти</button>
        <p style="margin:16px 0 0">
          <a href="../" class="link-btn" style="justify-content:center">${icon('mobile', 18)}Открыть приложение для клиентов</a>
        </p>
      </form>
    </div>`;

  const form = $('#loginForm');
  const showError = (text) => {
    $('#loginError').textContent = text;
    $('#loginError').hidden = false;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const login = form.elements.login.value.trim();
    const password = form.elements.password.value;
    if (!login || !password) return showError('Введите логин и пароль');

    $('#loginButton').disabled = true;
    try {
      const result = await request('POST', '/auth/login', { login, password });
      if (result.user.role !== 'specialist') {
        $('#loginButton').disabled = false;
        return showError('Доступ только для специалистов компании');
      }
      session.save(result.token, result.user);
      startAdmin();
    } catch (error) {
      $('#loginButton').disabled = false;
      showError(error.message);
    }
  });

  setTimeout(() => form.elements.login.focus(), 30);
}

function logout() {
  session.clear();
  showLogin();
}

function startAdmin() {
  if (!session.isSpecialist) {
    return showLogin(session.isLoggedIn ? 'Вы вошли как клиент. Админ-панель доступна только специалистам.' : '');
  }
  const user = session.user;

  $('#root').innerHTML = `
    <div class="layout">
      <aside class="side">
        <div class="logo">
          <span class="logo-mark">${icon('logo', 22)}</span>
          <span><b>1С: <span>Помощник</span></b><small>Админ-панель</small></span>
        </div>
        <nav class="nav" id="nav"></nav>
        <div class="side-foot">
          <div class="me">
            <span class="avatar">${esc(user.name.charAt(0).toUpperCase())}</span>
            <span><b>${esc(user.name)}</b><small>${esc(user.login)}</small></span>
          </div>
          <a class="link-btn" href="../">${icon('mobile', 18)}Приложение</a>
          <button class="link-btn" id="logoutButton" type="button">${icon('logout', 18)}Выйти</button>
        </div>
      </aside>
      <main class="main" id="main"></main>
    </div>`;

  $('#logoutButton').addEventListener('click', logout);

  openPageFromAddress();

  clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') refresh({ silent: true });
  }, REFRESH_EVERY_MS);

  request('GET', '/auth/me').then(({ user: fresh }) => {
    session.updateUser(fresh);
    if (fresh.role !== 'specialist') logout();
  }).catch(() => {});
}

function renderNav() {
  const newCount = state.stats?.statuses.new || 0;
  const link = (page, label, iconName, count = 0) => `
    <a href="#${page}" class="${state.page === page ? 'on' : ''}">
      ${icon(iconName, 19)}${label}
      ${count ? `<span class="cnt">${count}</span>` : ''}
    </a>`;

  $('#nav').innerHTML = `
    ${link('tickets', 'Заявки', 'list', newCount)}
    ${link('clients', 'Клиенты', 'users')}
    ${link('specialists', 'Специалисты', 'shield')}`;
}

function openPageFromAddress() {
  if (!session.isLoggedIn) return showLogin();

  let page = location.hash.replace('#', '') || 'tickets';
  const ticketMatch = page.match(/^ticket-(\d+)$/);
  state.openTicketId = ticketMatch ? Number(ticketMatch[1]) : null;
  if (ticketMatch) page = 'tickets';
  if (!['tickets', 'clients', 'specialists'].includes(page)) page = 'tickets';

  const pageChanged = state.page !== page || !$('#main').firstChild;
  state.page = page;
  renderNav();
  if (pageChanged) $('#main').innerHTML = '';

  refresh({ silent: !pageChanged });

  if (state.openTicketId) openPanel(state.openTicketId);
  else closePanel();
}

function refresh({ silent = false } = {}) {
  if (state.page === 'tickets') loadTickets({ silent });
  else loadUsers(state.page === 'clients' ? 'client' : 'specialist');

  request('GET', '/stats').then((stats) => {
    state.stats = stats;
    renderNav();
    if (state.page === 'tickets') renderStats();
  }).catch(() => {});
}

function renderTicketsPage() {
  const { filter } = state;
  const urgencyOptions = URGENCY.map((u) =>
    `<option value="${u.id}" ${filter.urgency === u.id ? 'selected' : ''}>${u.label}</option>`).join('');

  $('#main').innerHTML = `
    <div class="page-head">
      <h1>Заявки</h1>
      <span class="upd" id="updatedAt"></span>
      <button class="btn btn-ghost btn-sm" id="reloadButton" type="button">${icon('refresh', 16)}Обновить</button>
    </div>

    <div class="stats" id="stats"></div>

    <div class="toolbar">
      <div class="chips" id="statusChips"></div>
      <select class="select" id="urgencySelect" aria-label="Срочность">
        <option value="">Любая срочность</option>
        ${urgencyOptions}
      </select>
      <div class="search">
        ${icon('search', 18)}
        <input class="input" id="searchInput" type="search" placeholder="№, текст, клиент, компания" value="${esc(filter.query)}">
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>№</th><th>Создана</th><th>Клиент</th><th>Обращение</th><th>Срочность</th><th>Статус</th><th>Ответственный</th></tr>
        </thead>
        <tbody id="ticketRows"><tr><td colspan="7" class="empty">Загрузка…</td></tr></tbody>
      </table>
    </div>`;

  renderStats();

  $('#reloadButton').addEventListener('click', () => refresh());
  $('#urgencySelect').addEventListener('change', (e) => {
    filter.urgency = e.target.value;
    loadTickets();
  });

  let searchTimer = null;
  $('#searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filter.query = e.target.value.trim();
      loadTickets();
    }, 300);
  });

  $('#statusChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (!chip) return;
    filter.status = chip.dataset.status;
    renderStatusChips();
    loadTickets();
  });

  const openRow = (row) => { location.hash = `ticket-${row.dataset.id}`; };
  $('#ticketRows').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (row) openRow(row);
  });
  $('#ticketRows').addEventListener('keydown', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (row && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openRow(row);
    }
  });
}

async function loadTickets({ silent = false } = {}) {
  if (!$('#ticketRows')) renderTicketsPage();

  const { filter } = state;
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.urgency) params.set('urgency', filter.urgency);
  if (filter.query) params.set('q', filter.query);
  const query = params.toString();

  try {
    const data = await request('GET', `/tickets${query ? `?${query}` : ''}`);
    state.tickets = data.tickets;
    state.updatedAt = Date.now();
    renderTicketRows();
  } catch (error) {
    if (!silent) toast(error.message);
  }
}

function renderStats() {
  if (!$('#stats')) return;
  const s = state.stats;
  const value = (n) => (s ? n : '—');
  const card = (label, number, color = '', hot = false) => `
    <div class="stat ${hot ? 'hot' : ''}">
      <small>${color ? `<i style="background:var(${color})"></i>` : ''}${label}</small>
      <b>${value(number)}</b>
    </div>`;

  $('#stats').innerHTML = `
    ${card('Новые', s?.statuses.new, '--st-new')}
    ${card('Принятые', s?.statuses.accepted, '--st-accepted')}
    ${card('В работе', s?.statuses.in_progress, '--st-in_progress')}
    ${card('Выполнены', s?.statuses.done, '--st-done')}
    ${card('Критичные открытые', s?.critical, '', Boolean(s?.critical))}
    ${card('Создано сегодня', s?.today)}`;
  renderStatusChips();
}

function renderStatusChips() {
  if (!$('#statusChips')) return;
  const s = state.stats;
  const chips = [{ id: '', label: 'Все', count: s?.total }]
    .concat(STATUSES.map((st) => ({ id: st.id, label: st.label, count: s?.statuses[st.id] })));

  $('#statusChips').innerHTML = chips.map((c) => `
    <button type="button" class="chip ${state.filter.status === c.id ? 'on' : ''}" data-status="${c.id}">
      ${c.label}${s ? ` <span class="n">${c.count}</span>` : ''}
    </button>`).join('');
}

function renderTicketRows() {
  const tbody = $('#ticketRows');
  if (!tbody) return;

  if (state.updatedAt) $('#updatedAt').textContent = `Обновлено в ${formatDateTime(state.updatedAt).slice(11)}`;

  if (!state.tickets.length) {
    const { status, urgency, query } = state.filter;
    const filtered = status || urgency || query;
    tbody.innerHTML = `
      <tr><td colspan="7"><div class="empty">
        <b>${filtered ? 'Ничего не найдено' : 'Заявок пока нет'}</b>
        ${filtered ? 'Измените фильтры или запрос.' : 'Новые обращения клиентов появятся здесь автоматически.'}
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = state.tickets.map((t) => `
    <tr class="click ${state.openTicketId === t.id ? 'sel' : ''}" data-id="${t.id}" tabindex="0">
      <td class="num">№ ${t.number}</td>
      <td style="white-space:nowrap">${formatDateTime(t.createdAt)}</td>
      <td>
        <b>${esc(t.name)}</b>
        <span class="sub">${esc(t.company)}</span>
        <span class="sub">${esc(t.contact)}</span>
      </td>
      <td>
        <b>${esc(TYPE_BY_ID[t.type]?.label || t.type)}</b>
        <span class="sub">${esc(t.program)}</span>
        <span class="desc sub">${esc(t.description)}</span>
      </td>
      <td>${urgencyBadge(t.urgency)}</td>
      <td>${statusBadge(t.status)}</td>
      <td>${t.assignee ? esc(t.assignee.name) : '<span class="sub">не назначен</span>'}</td>
    </tr>`).join('');
}

function closePanel() {
  $('#overlay').innerHTML = '';
  state.draft = null;
  $$('tr.sel').forEach((row) => row.classList.remove('sel'));
}

async function openPanel(ticketId) {
  $$('tr[data-id]').forEach((row) => row.classList.toggle('sel', Number(row.dataset.id) === ticketId));

  if (!$('.drawer')) {
    $('#overlay').innerHTML = `
      <div class="drawer-back" id="panelBackdrop"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="Заявка">
        <div class="drawer-head">
          <h2>Загрузка…</h2>
          <button class="icon-btn" id="closePanelButton" type="button" aria-label="Закрыть">${icon('close', 20)}</button>
        </div>
        <div class="drawer-body"></div>
      </aside>`;
    const close = () => { location.hash = 'tickets'; };
    $('#panelBackdrop').addEventListener('click', close);
    $('#closePanelButton').addEventListener('click', close);
  }

  try {
    const { ticket } = await request('GET', `/tickets/${ticketId}`);
    renderPanel(ticket);
  } catch (error) {
    toast(error.message);
    location.hash = 'tickets';
  }
}

function renderPanel(ticket) {
  if (!state.draft || state.draft.id !== ticket.id) {
    state.draft = { id: ticket.id, status: ticket.status, comment: ticket.comment };
  }
  const { draft } = state;
  const row = (label, value) => `<div class="dl-row"><dt>${label}</dt><dd>${value}</dd></div>`;

  const statusOptions = STATUSES.map((s) => `
    <label>
      <input type="radio" name="panelStatus" value="${s.id}" ${draft.status === s.id ? 'checked' : ''}>
      <span>${s.label}</span>
    </label>`).join('');

  const historyItems = [...(ticket.history || [])].reverse().map((h) => {
    let title = `Статус: ${STATUS_BY_ID[h.status]?.label || h.status}`;
    if (h.kind === 'created') title = 'Заявка создана';
    if (h.kind === 'comment') title = 'Комментарий';
    return `
      <li>
        <b>${title}</b><br>
        <small>${formatDateTime(h.at)}${h.authorName ? ` · ${esc(h.authorName)}` : ''}</small>
        ${h.comment ? `<p>${esc(h.comment)}</p>` : ''}
      </li>`;
  }).join('');

  $('.drawer-head h2').innerHTML = `Заявка № ${ticket.number} ${statusBadge(ticket.status)}`;
  $('.drawer-body').innerHTML = `
    <div class="card edit">
      <div class="card-title" style="color:var(--ink)">Обработка заявки</div>
      <div class="seg" id="panelStatus">${statusOptions}</div>
      <label class="field" style="margin-bottom:12px">
        <span>Комментарий для клиента</span>
        <textarea class="textarea" id="panelComment" rows="4" maxlength="2000"
          placeholder="Что сделано, что требуется от клиента, сроки">${esc(draft.comment)}</textarea>
      </label>
      <button class="btn btn-dark" id="panelSave" type="button" style="width:100%">Сохранить и уведомить клиента</button>
    </div>

    <div class="card">
      <div class="card-title">Описание</div>
      <div class="pre">${esc(ticket.description)}</div>
    </div>

    <div class="card">
      <div class="card-title">Сведения</div>
      <dl>
        ${row('Создана', formatDateTime(ticket.createdAt))}
        ${row('Тип проблемы', esc(TYPE_BY_ID[ticket.type]?.label || ticket.type))}
        ${row('Программа', esc(ticket.program))}
        ${row('Срочность', urgencyBadge(ticket.urgency))}
        ${row('Ответственный', ticket.assignee ? esc(ticket.assignee.name) : 'не назначен')}
        ${row('Имя', esc(ticket.name))}
        ${row('Компания', esc(ticket.company))}
        ${row('Контакт', esc(ticket.contact))}
      </dl>
    </div>

    <div class="card">
      <div class="card-title">История</div>
      <ul class="timeline">${historyItems}</ul>
    </div>`;

  $('#panelStatus').addEventListener('change', (e) => { draft.status = e.target.value; });
  $('#panelComment').addEventListener('input', (e) => { draft.comment = e.target.value; });

  $('#panelSave').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const changes = {};
    if (draft.status !== ticket.status) changes.status = draft.status;
    if (draft.comment.trim() !== ticket.comment) changes.comment = draft.comment.trim();
    if (!Object.keys(changes).length) return toast('Изменений нет');

    button.disabled = true;
    try {
      const result = await request('PATCH', `/tickets/${ticket.id}`, changes);
      state.draft = null;
      renderPanel(result.ticket);
      toast('Сохранено — клиент увидит обновление');
      refresh({ silent: true });
    } catch (error) {
      button.disabled = false;
      toast(errorText(error));
    }
  });
}

function renderUsersPage(role) {
  const isSpecialists = role === 'specialist';
  const headers = isSpecialists
    ? '<th>Имя</th><th>Логин</th><th>Зарегистрирован</th><th>Доступ</th>'
    : '<th>Имя</th><th>Компания</th><th>Логин</th><th>Контакт</th><th>Заявки</th><th>Зарегистрирован</th><th>Доступ</th>';

  $('#main').innerHTML = `
    <div class="page-head">
      <h1>${isSpecialists ? 'Специалисты' : 'Клиенты'}</h1>
      ${isSpecialists ? `<button class="btn btn-red" id="addSpecialistButton" type="button">${icon('plus', 18)}Добавить специалиста</button>` : ''}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody id="userRows"><tr><td colspan="7" class="empty">Загрузка…</td></tr></tbody>
      </table>
    </div>`;

  if (isSpecialists) $('#addSpecialistButton').addEventListener('click', showAddSpecialist);

  $('#userRows').addEventListener('click', async (e) => {
    const button = e.target.closest('[data-user-id]');
    if (!button) return;
    const isActive = button.dataset.active === 'true';
    button.disabled = true;
    try {
      await request('PATCH', `/users/${button.dataset.userId}`, { isActive: !isActive });
      toast(isActive ? 'Доступ заблокирован' : 'Доступ восстановлен');
      loadUsers(role);
    } catch (error) {
      button.disabled = false;
      toast(errorText(error));
    }
  });
}

async function loadUsers(role) {
  if (!$('#userRows')) renderUsersPage(role);
  const isSpecialists = role === 'specialist';

  let users;
  try {
    ({ users } = await request('GET', `/users?role=${role}`));
  } catch (error) {
    toast(error.message);
    return;
  }

  const tbody = $('#userRows');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `
      <tr><td colspan="7"><div class="empty">
        <b>${isSpecialists ? 'Специалистов нет' : 'Клиентов пока нет'}</b>
        ${isSpecialists ? '' : 'Клиенты появятся после регистрации в приложении.'}
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = users.map((u) => {
    const isMe = u.id === session.user.id;
    const accessCell = isMe
      ? '<span class="badge st-done">Активен</span>'
      : `<button type="button" class="btn btn-sm ${u.isActive ? 'btn-ok' : 'btn-danger'}"
           data-user-id="${u.id}" data-active="${u.isActive}"
           title="Нажмите, чтобы ${u.isActive ? 'заблокировать' : 'разблокировать'}">
           ${u.isActive ? 'Активен' : 'Заблокирован'}
         </button>`;

    const nameCell = `<td><b>${esc(u.name)}</b>${isMe ? '<span class="sub">это вы</span>' : ''}</td>`;

    if (isSpecialists) {
      return `<tr>${nameCell}<td>${esc(u.login)}</td><td>${formatDay(u.createdAt)}</td><td>${accessCell}</td></tr>`;
    }
    return `
      <tr>
        ${nameCell}
        <td>${esc(u.company || '—')}</td>
        <td>${esc(u.login)}</td>
        <td>${esc(u.contact || '—')}</td>
        <td><b>${u.ticketsTotal}</b><span class="sub">активных: ${u.ticketsActive}</span></td>
        <td>${formatDay(u.createdAt)}</td>
        <td>${accessCell}</td>
      </tr>`;
  }).join('');
}

function showAddSpecialist() {
  $('#overlay').innerHTML = `
    <div class="modal-back" id="modalBackdrop">
      <form class="modal" id="specialistForm" novalidate>
        <h3>Новый специалист</h3>
        <div class="form-err" id="specialistError" hidden></div>
        <label class="field"><span>Имя</span><input class="input" name="name" maxlength="80"></label>
        <label class="field"><span>Логин (телефон или email)</span><input class="input" name="login" maxlength="80"></label>
        <label class="field"><span>Пароль (не меньше 6 символов)</span>
          <input class="input" name="password" type="password" maxlength="100" autocomplete="new-password">
        </label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="cancelButton">Отмена</button>
          <button class="btn btn-dark" type="submit">Создать</button>
        </div>
      </form>
    </div>`;

  const close = () => { $('#overlay').innerHTML = ''; };
  const form = $('#specialistForm');
  $('#cancelButton').addEventListener('click', close);
  $('#modalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'modalBackdrop') close(); });
  form.elements.name.focus();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await request('POST', '/users', {
        name: form.elements.name.value,
        login: form.elements.login.value,
        password: form.elements.password.value
      });
      close();
      toast('Специалист добавлен');
      loadUsers('specialist');
    } catch (error) {
      $('#specialistError').textContent = errorText(error);
      $('#specialistError').hidden = false;
    }
  });
}

window.addEventListener('hashchange', openPageFromAddress);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($('.modal')) $('#overlay').innerHTML = '';
  else if ($('.drawer')) location.hash = 'tickets';
});

onUnauthorized(() => logout());
onSlowServer((isSlow) => { $('#wakeNotice').hidden = !isSlow; });

if (session.isLoggedIn) startAdmin();
else showLogin();
