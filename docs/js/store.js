import { request, session } from './api.js';
import { storage, KEYS } from './utils.js';

const REFRESH_EVERY_MS = 20000;
const listeners = [];

export const store = {
  ready: false,
  error: null,
  loading: false,
  lastLoadAt: 0,
  tickets: [],
  details: {},
  timer: null,

  subscribe(callback) {
    listeners.push(callback);
  },

  notify(kind = 'data') {
    listeners.forEach((callback) => callback(kind));
  },

  reset() {
    clearInterval(this.timer);
    Object.assign(this, { ready: false, error: null, loading: false, lastLoadAt: 0, tickets: [], details: {}, timer: null });
  },

  start() {
    const cached = storage.get(KEYS.cache);
    if (cached && cached.userId === session.user?.id) {
      this.tickets = cached.tickets;
      this.ready = true;
    }
    this.load();
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') this.load();
    }, REFRESH_EVERY_MS);
  },

  async load() {
    if (!session.isLoggedIn || this.loading) return;
    this.loading = true;
    this.lastLoadAt = Date.now();
    try {
      const data = await request('GET', '/tickets');
      this.tickets = data.tickets;
      this.error = null;
      storage.set(KEYS.cache, { userId: session.user?.id, tickets: data.tickets });
    } catch (error) {
      this.error = error;
    }
    this.loading = false;
    this.ready = true;
    this.notify();
  },

  async loadDetail(id) {
    try {
      const data = await request('GET', `/tickets/${id}`);
      this.save(data.ticket);
      this.notify();
    } catch (error) {
      if (error.status === 404) {
        this.details[id] = { missing: true };
        this.notify();
      }
    }
  },

  save(ticket) {
    this.details[ticket.id] = ticket;
    const index = this.tickets.findIndex((t) => t.id === ticket.id);
    if (index >= 0) this.tickets[index] = ticket;
    else this.tickets.unshift(ticket);
  },

  async create(fields) {
    const data = await request('POST', '/tickets', fields);
    this.save(data.ticket);
    this.notify();
    return data.ticket;
  },

  async update(id, changes) {
    const data = await request('PATCH', `/tickets/${id}`, changes);
    this.save(data.ticket);
    this.notify();
    return data.ticket;
  },

  markSeen(ticket) {
    if (!ticket.unread) return;
    this.tickets.concat(Object.values(this.details))
      .filter((t) => t.id === ticket.id)
      .forEach((t) => { t.unread = false; });
    this.notify('badge');
    request('POST', `/tickets/${ticket.id}/seen`).catch(() => {});
  },

  get(id) {
    id = Number(id);
    const detail = this.details[id];
    if (detail && !detail.missing) return detail;
    return this.tickets.find((t) => t.id === id) || null;
  },

  isMissing(id) {
    return Boolean(this.details[Number(id)]?.missing);
  },

  sorted() {
    return [...this.tickets].sort((a, b) => b.createdAt - a.createdAt);
  },

  unreadCount() {
    return session.isSpecialist ? 0 : this.tickets.filter((t) => t.unread).length;
  },

  newCount() {
    return session.isSpecialist ? this.tickets.filter((t) => t.status === 'new').length : 0;
  }
};
