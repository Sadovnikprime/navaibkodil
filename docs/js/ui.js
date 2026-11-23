import { $, $$, esc, formatRelative } from './utils.js';
import { icon } from './icons.js';
import { STATUS_BY_ID, STATUSES, TYPE_BY_ID, URGENCY_BY_ID } from './data.js';

let toastTimer = null;

export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function confirmDialog({ title, text = '', ok = 'OK', cancel = 'Отмена', danger = false, onOk }) {
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="modal-wrap" id="modalBackdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <h3 id="modalTitle">${esc(title)}</h3>
        ${text ? `<p>${esc(text)}</p>` : ''}
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-action="cancel">${esc(cancel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-dark'}" type="button" data-action="ok">${esc(ok)}</button>
        </div>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ''; };
  $('#modalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'modalBackdrop') close(); });
  $('[data-action="cancel"]', root).addEventListener('click', close);
  $('[data-action="ok"]', root).addEventListener('click', () => { close(); onOk?.(); });
  setTimeout(() => $('[data-action="ok"]', root)?.focus(), 50);
}

export const isModalOpen = () => Boolean($('#modalRoot').firstChild);
export const closeModal = () => { $('#modalRoot').innerHTML = ''; };

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Скопировано: ${text}`);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    toast(ok ? `Скопировано: ${text}` : 'Не удалось скопировать');
  }
}

export function showFieldErrors(form, errors) {
  $$('.field', form).forEach((field) => {
    const message = errors[field.dataset.f];
    field.classList.toggle('invalid', Boolean(message));
    if (message) $('.err', field).textContent = message;
  });

  const firstInvalid = $('.field.invalid', form);
  if (!firstInvalid) return false;

  firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const input = $('input, select, textarea', firstInvalid);
  if (input) setTimeout(() => input.focus({ preventScroll: true }), 250);
  return true;
}

export function clearErrorsOnInput(form) {
  const clear = (e) => e.target.closest('.field')?.classList.remove('invalid');
  form.addEventListener('input', clear);
  form.addEventListener('change', clear);
}

export function statusBadge(statusId) {
  const status = STATUS_BY_ID[statusId] || STATUSES[0];
  return `<span class="badge st-${status.id}">${status.label}</span>`;
}

export function urgencyTag(urgencyId) {
  if (urgencyId !== 'high' && urgencyId !== 'critical') return '';
  return `<span class="urg urg-${urgencyId}">${URGENCY_BY_ID[urgencyId].label}</span>`;
}

export function ticketCard(ticket, { showClient = false } = {}) {
  const type = TYPE_BY_ID[ticket.type];
  return `
    <a class="tcard" href="#ticket-${ticket.id}">
      <div class="tcard-top">
        <span class="tnum">№ ${ticket.number}</span>
        ${ticket.unread ? '<span class="dot-new">Обновление</span>' : ''}
        ${statusBadge(ticket.status)}
      </div>
      <div class="tcard-title">
        ${esc(type ? type.label : 'Обращение')}<span> · ${esc(ticket.program.replace(/^1С:/, ''))}</span>
      </div>
      <p class="tcard-desc">${esc(ticket.description)}</p>
      <div class="tcard-foot">
        <span>${icon('clock', 14)}${formatRelative(ticket.createdAt)}</span>
        ${showClient ? `<span>${icon('user', 14)}${esc(ticket.company || ticket.name)}</span>` : ''}
        ${urgencyTag(ticket.urgency)}
      </div>
    </a>`;
}

export function skeletons(count) {
  return '<div class="skeleton"></div>'.repeat(count);
}

export function emptyState({ iconName, title, text = '', button = '' }) {
  return `
    <div class="empty">
      <div class="empty-ico">${icon(iconName, 28)}</div>
      <h3>${title}</h3>
      ${text ? `<p>${text}</p>` : ''}
      ${button}
    </div>`;
}
