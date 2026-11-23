'use strict';

const PROGRAMS = [
  '1С:Бухгалтерия предприятия',
  '1С:Зарплата и управление персоналом',
  '1С:Управление торговлей',
  '1С:Розница',
  '1С:Управление нашей фирмой',
  '1С:Комплексная автоматизация',
  '1С:ERP Управление предприятием',
  '1С:Документооборот',
  'Другая программа 1С'
];
const TYPES = ['error', 'consult', 'dev', 'update', 'report', 'other'];
const URGENCY = ['low', 'normal', 'high', 'critical'];
const STATUSES = ['new', 'accepted', 'in_progress', 'done'];

class ValidationError extends Error {
  constructor(fields) {
    super('Проверьте правильность заполнения полей');
    this.status = 400;
    this.fields = fields;
  }
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const digits = (s) => String(s).replace(/\D/g, '');
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const isPhone = (s) => /^[+\d\s()\-]+$/.test(s) && digits(s).length >= 10 && digits(s).length <= 15;

function isContact(s) {
  return s.includes('@') ? isEmail(s) : isPhone(s);
}

function normalizeLogin(raw) {
  const s = str(raw);
  if (!s) return null;
  if (s.includes('@')) return isEmail(s) ? s.toLowerCase() : null;
  if (!isPhone(s)) return null;
  let d = digits(s);
  if (d.length === 10) d = '7' + d;
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  return '+' + d;
}

function validatePassword(p, errors) {
  if (typeof p !== 'string' || p.length < 6) errors.password = 'Пароль — не меньше 6 символов';
  else if (p.length > 100) errors.password = 'Слишком длинный пароль';
}

function validateRegister(body) {
  const errors = {};
  const data = {
    name: str(body.name),
    company: str(body.company),
    login: normalizeLogin(body.login),
    password: body.password
  };
  if (data.name.length < 2 || data.name.length > 80) errors.name = 'Укажите имя';
  if (data.company.length < 2 || data.company.length > 120) errors.company = 'Укажите название компании';
  if (!data.login) errors.login = 'Укажите телефон или email';
  validatePassword(data.password, errors);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  data.contact = str(body.login);
  return data;
}

function validateProfile(body) {
  const errors = {};
  const data = { name: str(body.name), company: str(body.company), contact: str(body.contact) };
  if (data.name.length < 2 || data.name.length > 80) errors.name = 'Укажите имя';
  if (data.company.length > 120) errors.company = 'Слишком длинное название';
  if (data.contact && (!isContact(data.contact) || data.contact.length > 80)) errors.contact = 'Проверьте телефон или email';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return data;
}

function validateTicket(body) {
  const errors = {};
  const data = {
    name: str(body.name),
    company: str(body.company),
    contact: str(body.contact),
    program: str(body.program),
    type: str(body.type),
    description: str(body.description),
    urgency: str(body.urgency) || 'normal'
  };
  if (data.name.length < 2 || data.name.length > 80) errors.name = 'Укажите имя';
  if (data.company.length < 2 || data.company.length > 120) errors.company = 'Укажите название компании';
  if (!data.contact) errors.contact = 'Укажите телефон или email для связи';
  else if (!isContact(data.contact) || data.contact.length > 80) errors.contact = 'Проверьте номер телефона или email';
  if (!PROGRAMS.includes(data.program)) errors.program = 'Выберите программу 1С';
  if (!TYPES.includes(data.type)) errors.type = 'Выберите тип проблемы';
  if (data.description.length < 10) errors.description = 'Опишите проблему подробнее (не меньше 10 символов)';
  else if (data.description.length > 2000) errors.description = 'Не больше 2000 символов';
  if (!URGENCY.includes(data.urgency)) errors.urgency = 'Неверное значение срочности';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return data;
}

function validateTicketUpdate(body) {
  const errors = {};
  const data = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) errors.status = 'Неверный статус';
    else data.status = body.status;
  }
  if (body.comment !== undefined) {
    if (typeof body.comment !== 'string' || body.comment.length > 2000) errors.comment = 'Комментарий — не больше 2000 символов';
    else data.comment = body.comment.trim();
  }
  if (!Object.keys(errors).length && data.status === undefined && data.comment === undefined) {
    errors.status = 'Нет данных для изменения';
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return data;
}

function validateSpecialist(body) {
  const errors = {};
  const data = { name: str(body.name), login: normalizeLogin(body.login), password: body.password };
  if (data.name.length < 2 || data.name.length > 80) errors.name = 'Укажите имя';
  if (!data.login) errors.login = 'Укажите телефон или email';
  validatePassword(data.password, errors);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return data;
}

function parseId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 2147483647 ? n : null;
}

module.exports = {
  PROGRAMS, TYPES, URGENCY, STATUSES, ValidationError,
  normalizeLogin, validateRegister, validateProfile, validateTicket, validateTicketUpdate, validateSpecialist, parseId
};
