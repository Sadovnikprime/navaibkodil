export const PROGRAMS = [
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

export const TYPES = [
  { id: 'error',   label: 'Ошибка в 1С',          icon: 'alert' },
  { id: 'consult', label: 'Нужна консультация',   icon: 'chat' },
  { id: 'dev',     label: 'Требуется доработка',  icon: 'wrench' },
  { id: 'update',  label: 'Обновление программы', icon: 'refresh' },
  { id: 'report',  label: 'Настройка отчёта',     icon: 'chart' },
  { id: 'other',   label: 'Другое',               icon: 'dots' }
];

export const URGENCY = [
  { id: 'low',      label: 'Низкая',    hint: 'Вопрос не срочный, можно решить в плановом порядке' },
  { id: 'normal',   label: 'Обычная',   hint: 'Обычный рабочий вопрос' },
  { id: 'high',     label: 'Высокая',   hint: 'Мешает работе, нужно решить как можно скорее' },
  { id: 'critical', label: 'Критичная', hint: 'Работа остановлена — специалист возьмёт заявку в первую очередь' }
];

export const STATUSES = [
  { id: 'new',         label: 'Новая' },
  { id: 'accepted',    label: 'Принята' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'done',        label: 'Выполнена' }
];

export const CATEGORIES = [
  { id: 'instr',   label: 'Инструкции',      icon: 'file' },
  { id: 'errors',  label: 'Частые ошибки',   icon: 'alert' },
  { id: 'updates', label: 'Обновления',      icon: 'refresh' },
  { id: 'keys',    label: 'Горячие клавиши', icon: 'keyboard' },
  { id: 'service', label: 'О сервисе',       icon: 'info' }
];

const indexById = (list) => Object.fromEntries(list.map((item) => [item.id, item]));

export const TYPE_BY_ID = indexById(TYPES);
export const URGENCY_BY_ID = indexById(URGENCY);
export const STATUS_BY_ID = indexById(STATUSES);
export const CATEGORY_BY_ID = indexById(CATEGORIES);
