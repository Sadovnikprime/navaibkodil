const RENDER_SERVER_URL = 'https://ИМЯ-ВАШЕГО-СЕРВИСА.onrender.com';

const isGithubPages = location.hostname.endsWith('github.io');

export const SERVER_URL = isGithubPages ? RENDER_SERVER_URL : '';

export const SERVER_NOT_CONFIGURED = isGithubPages && SERVER_URL.includes('ИМЯ-ВАШЕГО-СЕРВИСА');

export const APP = {
  name: '1С: Помощник',
  version: '3.0.0'
};

export const COMPANY = {
  name: 'ООО «Сервис-Софт»',
  subtitle: '1С: Франчайзи · внедрение и сопровождение 1С',
  phone: '+7 (000) 000-00-00',
  phoneForCall: '+70000000000',
  email: 'support@service-soft.example',
  site: 'service-soft.example',
  address: 'г. Владивосток, ул. Примерная, д. 1, офис 1',
  hoursText: 'Пн–Пт, 9:00–18:00',
  workDays: [1, 2, 3, 4, 5],
  workFrom: 9,
  workTo: 18,
  timezoneOffset: 10
};
