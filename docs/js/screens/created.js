import { esc, formatDateTime } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';

export default function createdScreen({ id }) {
  const ticket = store.get(id);

  const html = `
    <div class="success">
      <div class="success-ico">${icon('check', 46)}</div>
      <h2>Заявка отправлена</h2>
      ${ticket ? `<span class="big-num">№ ${ticket.number} · ${formatDateTime(ticket.createdAt)}</span>` : ''}
      <p>
        Специалист рассмотрит обращение и свяжется с вами${ticket ? ` по контакту <b>${esc(ticket.contact)}</b>` : ''}.
        Статус можно отслеживать в разделе «Мои заявки».
      </p>
      <div class="stack">
        ${ticket ? `<a class="btn btn-dark btn-block" href="#ticket-${ticket.id}">Открыть заявку</a>` : ''}
        <a class="btn btn-ghost btn-block" href="#home">На главную</a>
      </div>
    </div>`;

  return { title: '', back: 'home', tab: 'new', live: true, html };
}
