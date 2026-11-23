export function esc(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (ch) => map[ch]);
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const pad = (n) => String(n).padStart(2, '0');

export function formatTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(ts) {
  return `${formatDate(ts)}, ${formatTime(ts)}`;
}

export function formatShort(ts) {
  const d = new Date(ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${formatTime(ts)}`;
}

export function formatRelative(ts) {
  const date = new Date(ts);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

  if (daysAgo === 0) return `сегодня, ${formatTime(ts)}`;
  if (daysAgo === 1) return `вчера, ${formatTime(ts)}`;
  if (date.getFullYear() === now.getFullYear()) return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${formatTime(ts)}`;
  return formatDate(ts);
}

export function plural(n, one, few, many) {
  const n100 = Math.abs(n) % 100;
  const n10 = n100 % 10;
  if (n100 > 10 && n100 < 20) return many;
  if (n10 > 1 && n10 < 5) return few;
  if (n10 === 1) return one;
  return many;
}

export function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 17) return 'Добрый день';
  if (h >= 17 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export function isPhone(s) {
  const digits = s.replace(/\D/g, '');
  return /^[+\d\s()\-]+$/.test(s) && digits.length >= 10 && digits.length <= 15;
}

export const isContact = (s) => (s.includes('@') ? isEmail(s) : isPhone(s));

export const KEYS = {
  token: 'p1c.token',
  user: 'p1c.user',
  cache: 'p1c.cache',
  draft: 'p1c.draft'
};

export const storage = {
  get(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {  }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {  }
  }
};
