import { SERVER_URL, SERVER_NOT_CONFIGURED } from './config.js';
import { storage, KEYS } from './utils.js';

export class ApiError extends Error {
  constructor(message, { status = 0, fields = null, network = false } = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.network = network;
  }
}

export const session = {
  token: storage.get(KEYS.token),
  user: storage.get(KEYS.user),

  get isLoggedIn() { return Boolean(this.token); },
  get isSpecialist() { return this.user?.role === 'specialist'; },

  save(token, user) {
    this.token = token;
    this.user = user;
    storage.set(KEYS.token, token);
    storage.set(KEYS.user, user);
  },

  updateUser(user) {
    this.user = user;
    storage.set(KEYS.user, user);
  },

  clear() {
    this.token = null;
    this.user = null;
    Object.values(KEYS).forEach((key) => storage.remove(key));
  }
};

let handleUnauthorized = () => {};
let handleSlowServer = () => {};

export function onUnauthorized(callback) { handleUnauthorized = callback; }

export function onSlowServer(callback) { handleSlowServer = callback; }

let pendingRequests = 0;
let slowTimer = null;

function requestStarted() {
  pendingRequests += 1;
  if (!slowTimer) slowTimer = setTimeout(() => handleSlowServer(true), 3000);
}

function requestFinished() {
  pendingRequests -= 1;
  if (pendingRequests === 0) {
    clearTimeout(slowTimer);
    slowTimer = null;
    handleSlowServer(false);
  }
}

export async function request(method, path, body) {
  if (SERVER_NOT_CONFIGURED) {
    throw new ApiError('Сервер не настроен: укажите адрес сервера Render в файле docs/js/config.js', { network: true });
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;

  let response;
  requestStarted();
  try {
    response = await fetch(`${SERVER_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError('Нет связи с сервером. Проверьте подключение к интернету', { network: true });
  } finally {
    requestFinished();
  }

  const data = await response.json().catch(() => null);

  if (response.status === 401 && session.token) handleUnauthorized();

  if (!response.ok) {
    throw new ApiError(data?.error || `Ошибка сервера (${response.status})`, {
      status: response.status,
      fields: data?.fields
    });
  }
  return data;
}
