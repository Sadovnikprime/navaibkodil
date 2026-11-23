import { $, esc, formatDateTime, formatShort } from '../utils.js';
import { icon } from '../icons.js';
import { session } from '../api.js';
import { store } from '../store.js';
import { STATUSES, STATUS_BY_ID, TYPE_BY_ID, URGENCY_BY_ID } from '../data.js';
import { toast, statusBadge, urgencyTag, skeletons, emptyState } from '../ui.js';

const lastFetchedAt = {};

let specialistDraft = { ticketId: null, status: null, comment: '' };

function stepper(ticket) {
  const currentIndex = STATUSES.findIndex((s) => s.id === ticket.status);
  const history = ticket.history || [];
  const lastIndex = STATUSES.length - 1;
  const timeOfStatus = (statusId) => [...history].reverse().find((h) => h.status === statusId)?.at;

  const steps = STATUSES.map((status, index) => {
    let cls = '';
    if (index < currentIndex) cls = 'done';
    if (index === currentIndex) cls = index === lastIndex ? 'current last' : 'current';

    const showCheck = index < currentIndex || (index === currentIndex && index === lastIndex);
    const time = index <= currentIndex ? timeOfStatus(status.id) : null;

    return `
      <li class="${cls}">
        <span class="st-dot">${showCheck ? icon('check', 14) : ''}</span>
        <span class="st-name">${status.label}</span>
        <span class="st-time">${time ? formatShort(time) : ''}</span>
      </li>`;
  });
  return `<ol class="stepper" aria-label="Ход выполнения">${steps.join('')}</ol>`;
}

function commentBlock(ticket) {
  if (ticket.comment) {
    const author = ticket.assignee?.name ? ` · ${esc(ticket.assignee.name)}` : '';
    return `
      <div class="comment">
        <div class="comment-head">${icon('chat', 16)}Комментарий специалиста</div>
        <p>${esc(ticket.comment)}</p>
        ${ticket.commentAt ? `<small>${formatDateTime(ticket.commentAt)}${author}</small>` : ''}
      </div>`;
  }
  const text = ticket.status === 'new'
    ? 'Заявка ожидает рассмотрения. Комментарий появится здесь, когда специалист возьмёт её в работу.'
    : 'Специалист пока не оставил комментарий.';
  return `
    <div class="comment empty-c">
      <div class="comment-head" style="color:var(--muted)">${icon('chat', 16)}Комментарий специалиста</div>
      <p>${text}</p>
    </div>`;
}

function detailsBlock(ticket) {
  const row = (label, value) => `<div class="dl-row"><dt>${label}</dt><dd>${value}</dd></div>`;
  const urgency = URGENCY_BY_ID[ticket.urgency];
  return `
    <div class="card">
      <div class="card-title">${icon('file', 16)}Сведения</div>
      <dl class="dl">
        ${row('Тип проблемы', esc(TYPE_BY_ID[ticket.type]?.label || '—'))}
        ${row('Программа', esc(ticket.program))}
        ${row('Срочность', urgencyTag(ticket.urgency) || esc(urgency?.label || '—'))}
        ${ticket.assignee ? row('Ответственный', esc(ticket.assignee.name)) : ''}
        ${row('Имя', esc(ticket.name))}
        ${row('Компания', esc(ticket.company))}
        ${row('Контакт', esc(ticket.contact))}
      </dl>
    </div>`;
}

function historyBlock(ticket) {
  if (!ticket.history) {
    return `<div class="card"><div class="card-title">${icon('clock', 16)}История</div><p class="muted">Загрузка…</p></div>`;
  }
  const items = [...ticket.history].reverse().map((h) => {
    let title = `Статус: ${STATUS_BY_ID[h.status]?.label || h.status}`;
    if (h.kind === 'created') title = 'Заявка создана';
    if (h.kind === 'comment') title = 'Комментарий специалиста';
    const author = h.by === 'specialist' && h.authorName ? ` · ${esc(h.authorName)}` : '';
    return `
      <li>
        <b>${title}</b>
        <div class="tl-time">${formatDateTime(h.at)}${author}</div>
        ${h.comment ? `<p>${esc(h.comment)}</p>` : ''}
      </li>`;
  });
  return `
    <div class="card">
      <div class="card-title">${icon('clock', 16)}История</div>
      <ul class="timeline">${items.join('')}</ul>
    </div>`;
}

function specialistPanel(ticket) {
  if (specialistDraft.ticketId !== ticket.id) {
    specialistDraft = { ticketId: ticket.id, status: ticket.status, comment: ticket.comment || '' };
  }
  const statusOptions = STATUSES.map((s) => `
    <label>
      <input type="radio" name="newStatus" value="${s.id}" ${specialistDraft.status === s.id ? 'checked' : ''}>
      <span>${s.label}</span>
    </label>`).join('');

  return `
    <div class="card spec-panel">
      <div class="card-title" style="color:var(--ink)">${icon('shield', 16)}Действия специалиста</div>
      <span class="lbl">Статус заявки</span>
      <div class="seg" id="statusPicker" role="radiogroup" aria-label="Статус">${statusOptions}</div>
      <label class="field">
        <span class="lbl">Комментарий для клиента</span>
        <textarea id="commentInput" rows="4" maxlength="2000"
          placeholder="Что сделано, что требуется от клиента, сроки">${esc(specialistDraft.comment)}</textarea>
      </label>
      <button class="btn btn-dark btn-block" id="saveButton" type="button" style="margin-top:14px">
        ${icon('check', 20)}Сохранить изменения
      </button>
      <p class="hint" style="margin-top:8px;text-align:center">Клиент увидит новый статус и комментарий в своей заявке</p>
    </div>`;
}

export default function ticketScreen({ id }, rerender) {
  const ticketId = Number(id);
  const isSpecialist = session.isSpecialist;

  if (store.isMissing(ticketId)) {
    return {
      title: 'Заявка', back: 'tickets', tab: 'tickets',
      html: emptyState({
        iconName: 'search',
        title: 'Заявка не найдена',
        text: 'Возможно, она была удалена или у вас нет к ней доступа.',
        button: '<a class="btn btn-dark" href="#tickets">К списку заявок</a>'
      })
    };
  }

  if (Date.now() - (lastFetchedAt[ticketId] || 0) > 5000) {
    lastFetchedAt[ticketId] = Date.now();
    store.loadDetail(ticketId);
  }

  const ticket = store.get(ticketId);
  if (!ticket) {
    return { title: 'Заявка', back: 'tickets', tab: 'tickets', live: true, html: skeletons(3) };
  }

  const header = `
    <div class="card">
      <div class="t-head">
        <div>
          <h2>№ ${ticket.number}</h2>
          <div class="muted">от ${formatDateTime(ticket.createdAt)}</div>
        </div>
        ${statusBadge(ticket.status)}
      </div>
      ${stepper(ticket)}
    </div>`;

  const description = `
    <div class="card">
      <div class="card-title">${icon('chat', 16)}Описание</div>
      <div class="desc-text">${esc(ticket.description)}</div>
    </div>`;

  const contactButton = isSpecialist ? '' : `
    <a class="btn btn-ghost btn-block" href="#contacts">${icon('phone', 20)}Связаться со специалистом</a>`;

  const html = `
    <div class="stack" style="margin-top:4px">
      ${header}
      ${isSpecialist ? specialistPanel(ticket) : ''}
      ${commentBlock(ticket)}
      ${description}
      ${detailsBlock(ticket)}
      ${historyBlock(ticket)}
      ${contactButton}
    </div>`;

  function mount(root) {
    if (!isSpecialist) {
      store.markSeen(ticket);
      return;
    }

    $('#statusPicker', root).addEventListener('change', (e) => { specialistDraft.status = e.target.value; });
    $('#commentInput', root).addEventListener('input', (e) => { specialistDraft.comment = e.target.value; });

    $('#saveButton', root).addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const current = store.get(ticket.id);
      const changes = {};
      if (specialistDraft.status !== current.status) changes.status = specialistDraft.status;
      if (specialistDraft.comment.trim() !== (current.comment || '')) changes.comment = specialistDraft.comment.trim();

      if (!Object.keys(changes).length) {
        toast('Изменений нет');
        return;
      }

      button.disabled = true;
      try {
        const updated = await store.update(ticket.id, changes);
        specialistDraft = { ticketId: updated.id, status: updated.status, comment: updated.comment };
        toast('Сохранено — клиент увидит обновление');
        rerender();
      } catch (error) {
        button.disabled = false;
        toast(error.message);
      }
    });
  }

  return { title: `Заявка № ${ticket.number}`, back: 'tickets', tab: 'tickets', live: true, html, mount };
}
