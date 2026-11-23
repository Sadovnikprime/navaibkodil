import { $$, esc } from '../utils.js';
import { icon } from '../icons.js';
import { COMPANY } from '../config.js';
import { copyText } from '../ui.js';

function isOfficeOpen() {
  const officeTime = new Date(Date.now() + COMPANY.timezoneOffset * 3600 * 1000);
  const hour = officeTime.getUTCHours() + officeTime.getUTCMinutes() / 60;
  const weekday = officeTime.getUTCDay();
  return COMPANY.workDays.includes(weekday) && hour >= COMPANY.workFrom && hour < COMPANY.workTo;
}

function contactRow(iconName, label, value) {
  return `
    <div class="crow">
      <span class="c-ico">${icon(iconName, 20)}</span>
      <div class="c-main"><small>${label}</small><span>${esc(value)}</span></div>
      <button class="copy-btn" type="button" data-copy="${esc(value)}" aria-label="Скопировать: ${label}">
        ${icon('copy', 19)}
      </button>
    </div>`;
}

export default function contactsScreen() {
  const open = isOfficeOpen();

  const html = `
    <div class="card">
      <div class="company">
        <span class="company-logo">${icon('logo', 30)}</span>
        <div><b>${esc(COMPANY.name)}</b><small>${esc(COMPANY.subtitle)}</small></div>
      </div>
      <div class="hours">
        <span class="open-dot ${open ? '' : 'closed'}"></span>
        <span>${open ? 'Сейчас работаем' : 'Сейчас закрыто'} · ${esc(COMPANY.hoursText)}</span>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      ${contactRow('phone', 'Телефон', COMPANY.phone)}
      ${contactRow('globe', 'Сайт', COMPANY.site)}
      ${contactRow('mail', 'Email', COMPANY.email)}
      ${contactRow('pin', 'Адрес', COMPANY.address)}
    </div>

    <a class="btn btn-primary btn-block call-btn" href="tel:${esc(COMPANY.phoneForCall)}">
      ${icon('phone', 22)}Позвонить
    </a>
    <p class="hint" style="text-align:center;margin-top:14px">
      Если звонок не начался автоматически, наберите номер ${esc(COMPANY.phone)} вручную.
    </p>`;

  function mount(root) {
    $$('[data-copy]', root).forEach((button) => {
      button.addEventListener('click', () => copyText(button.dataset.copy));
    });
  }

  return { title: 'Контакты', tab: 'contacts', html, mount };
}
