import { $, esc } from './utils.js';
import { icon } from './icons.js';
import { APP, COMPANY } from './config.js';
import { request, session, onUnauthorized, onSlowServer } from './api.js';
import { store } from './store.js';
import { currentRoute, onNavigate, back } from './nav.js';
import { toast, isModalOpen, closeModal } from './ui.js';

import authScreen from './screens/auth.js';
import homeScreen from './screens/home.js';
import newTicketScreen from './screens/new-ticket.js';
import createdScreen from './screens/created.js';
import ticketsScreen from './screens/tickets.js';
import ticketScreen from './screens/ticket.js';
import materialsScreen from './screens/materials.js';
import articleScreen from './screens/article.js';
import contactsScreen from './screens/contacts.js';
import profileScreen from './screens/profile.js';

const SCREENS = {
  home: homeScreen,
  new: newTicketScreen,
  created: createdScreen,
  tickets: ticketsScreen,
  ticket: ticketScreen,
  materials: materialsScreen,
  article: articleScreen,
  contacts: contactsScreen,
  settings: profileScreen
};

const main = $('#main');
const topbar = $('#topbar');
const tabbar = $('#tabbar');

let current = null;

function renderTopbar(screen) {
  topbar.hidden = Boolean(screen.fullscreen);
  if (screen.fullscreen) return;

  const specialistBadge = session.isSpecialist ? '<span class="spec-pill">Специалист</span>' : '';

  if (screen.showLogo) {
    topbar.innerHTML = `
      <div class="brand">
        <span class="brand-mark">${icon('logo', 22)}</span>
        <span>
          <div class="brand-name">1С: <span class="red">Помощник</span></div>
          <div class="brand-sub">${esc(COMPANY.name)}</div>
        </span>
      </div>
      ${specialistBadge}
      <a class="icon-btn round-yellow" href="#settings" aria-label="Профиль">${icon('user', 20)}</a>`;
    return;
  }

  topbar.innerHTML = `
    ${screen.back ? `<button class="icon-btn" id="backButton" type="button" aria-label="Назад">${icon('back')}</button>` : ''}
    <h1>${esc(screen.title)}</h1>
    ${specialistBadge}`;
  $('#backButton')?.addEventListener('click', () => back(screen.back));
}

function renderTabbar() {
  tabbar.hidden = !session.isLoggedIn;
  if (!session.isLoggedIn) return;

  const activeTab = current?.screen.tab;
  const badge = store.unreadCount() || store.newCount();

  const tab = (id, label, iconName, count = 0) => `
    <a class="tab ${activeTab === id ? 'active' : ''}" href="#${id}" ${activeTab === id ? 'aria-current="page"' : ''}>
      <span class="tab-ico">${icon(iconName, 22)}</span>${label}
      ${count ? `<span class="badge-num">${count > 99 ? '99+' : count}</span>` : ''}
    </a>`;

  tabbar.innerHTML = `
    ${tab('home', 'Главная', 'home')}
    ${tab('tickets', 'Заявки', 'list', badge)}
    <a class="tab-fab" href="#new" aria-label="Создать заявку">${icon('plus', 28)}</a>
    ${tab('materials', 'Материалы', 'book')}
    ${tab('contacts', 'Контакты', 'phone')}`;
}

function render(scrollToTop = false) {
  const route = session.isLoggedIn ? currentRoute() : { name: 'auth' };
  const createScreen = route.name === 'auth' ? authScreen : SCREENS[route.name];
  const screen = createScreen(route, () => render(false));
  current = { route, screen };

  if (session.isLoggedIn && store.timer && Date.now() - store.lastLoadAt > 4000) store.load();

  const scrollY = main.scrollTop;
  renderTopbar(screen);
  main.innerHTML = `<div class="view">${screen.html}</div>`;
  screen.mount?.(main);
  renderTabbar();
  main.scrollTop = scrollToTop ? 0 : scrollY;
  document.title = screen.title ? `${screen.title} — ${APP.name}` : APP.name;
}

function isTyping() {
  const el = document.activeElement;
  return el && main.contains(el) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

store.subscribe((kind) => {
  if (!current || !session.isLoggedIn) return;
  if (kind === 'data') {
    if (current.screen.update) {
      current.screen.update(main);
    } else if (current.screen.live && !isTyping() && !isModalOpen()) {
      render(false);
      main.firstElementChild?.style.setProperty('animation', 'none');
    }
  }
  renderTabbar();
});

onNavigate(render);

onUnauthorized(() => {
  session.clear();
  store.reset();
  toast('Сеанс завершён — войдите снова');
  render(true);
});

onSlowServer((isSlow) => {
  $('#wakeNotice').hidden = !isSlow;
});

main.addEventListener('scroll', () => topbar.classList.toggle('scrolled', main.scrollTop > 4), { passive: true });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isModalOpen()) closeModal();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && session.isLoggedIn) store.load();
});

render(true);

if (session.isLoggedIn) {
  store.start();

  request('GET', '/auth/me')
    .then((data) => { session.updateUser(data.user); renderTopbar(current.screen); renderTabbar(); })
    .catch(() => {});
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
