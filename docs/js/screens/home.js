import { esc, greeting, plural } from '../utils.js';
import { icon } from '../icons.js';
import { session } from '../api.js';
import { store } from '../store.js';
import { ARTICLES } from '../articles.js';
import { ticketCard, skeletons } from '../ui.js';

export function connectionNotice() {
  if (!store.error) return '';
  const text = store.error.network
    ? 'Нет связи с сервером — показаны последние сохранённые данные.'
    : esc(store.error.message);
  return `<div class="notice">${icon('cloud', 18)}<span>${text}</span></div>`;
}

export default function homeScreen() {
  const isSpecialist = session.isSpecialist;
  const tickets = store.sorted();
  const active = tickets.filter((t) => t.status !== 'done');
  const countByStatus = (status) => tickets.filter((t) => t.status === status).length;

  const hero = isSpecialist
    ? `
      <section class="hero">
        <div class="hero-time">${greeting()}</div>
        <h2>Рабочее место специалиста</h2>
        <div class="stats">
          <div class="stat"><b>${countByStatus('new')}</b><span>новых</span></div>
          <div class="stat"><b>${countByStatus('accepted') + countByStatus('in_progress')}</b><span>в работе</span></div>
          <div class="stat"><b>${countByStatus('done')}</b><span>выполнено</span></div>
        </div>
      </section>`
    : `
      <section class="hero">
        <div class="hero-time">${greeting()}</div>
        <h2>${esc(session.user?.name || 'Здравствуйте')}!</h2>
        <p>Чем можем помочь с 1С сегодня?</p>
      </section>`;

  let ticketsSubtitle = 'Загрузка…';
  if (store.ready) {
    if (active.length) ticketsSubtitle = `${active.length} ${plural(active.length, 'активная', 'активные', 'активных')}`;
    else ticketsSubtitle = tickets.length ? 'Все выполнены' : 'Пока нет заявок';
  }

  const quickButtons = `
    <div class="quick">
      <a class="tile tile-primary" href="#new">
        <span class="tile-ico">${icon('plus', 26)}</span>
        <span><b>Создать заявку</b><small>Ошибка, консультация, доработка</small></span>
      </a>
      <a class="tile" href="#tickets">
        <span class="tile-ico">${icon('list')}</span>
        <span><b>${isSpecialist ? 'Все заявки' : 'Мои заявки'}</b><small>${ticketsSubtitle}</small></span>
      </a>
      <a class="tile" href="#materials">
        <span class="tile-ico">${icon('book')}</span>
        <span><b>Полезные материалы</b><small>${ARTICLES.length} ${plural(ARTICLES.length, 'статья', 'статьи', 'статей')}</small></span>
      </a>
      <a class="tile" href="#contacts">
        <span class="tile-ico">${icon('phone')}</span>
        <span><b>Контакты</b><small>Позвонить специалисту</small></span>
      </a>
    </div>`;

  let activeSection = '';
  if (!store.ready) {
    activeSection = `<section class="sec">${skeletons(1)}</section>`;
  } else if (active.length) {
    activeSection = `
      <section class="sec">
        <div class="sec-head">
          <h2>${isSpecialist ? 'Ожидают обработки' : 'Активные заявки'}</h2>
          <a href="#tickets">Смотреть всё <span class="arrow-line"></span></a>
        </div>
        <div class="tlist">
          ${active.slice(0, 3).map((t) => ticketCard(t, { showClient: isSpecialist })).join('')}
        </div>
      </section>`;
  }

  const tip = ARTICLES[new Date().getDate() % ARTICLES.length];
  const tipSection = `
    <section class="sec">
      <div class="sec-head">
        <h2>Совет дня</h2>
        <a href="#materials">Все статьи <span class="arrow-line"></span></a>
      </div>
      <a class="card tip" href="#article-${tip.id}">
        <span class="tip-ico">${icon('bulb')}</span>
        <span>
          <b>${esc(tip.title)}</b>
          <small>${tip.minutes} мин чтения</small><br>
          <span class="pill-link">Читать <span class="arrow-line"></span></span>
        </span>
      </a>
    </section>`;

  return {
    showLogo: true,
    tab: 'home',
    live: true,
    html: connectionNotice() + hero + quickButtons + activeSection + tipSection
  };
}
