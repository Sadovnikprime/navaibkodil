import { $, esc, isContact, storage, KEYS } from '../utils.js';
import { icon } from '../icons.js';
import { session } from '../api.js';
import { store } from '../store.js';
import { replace } from '../nav.js';
import { PROGRAMS, TYPES, URGENCY, URGENCY_BY_ID } from '../data.js';
import { toast, showFieldErrors, clearErrorsOnInput } from '../ui.js';

function initialValues() {
  const user = session.user || {};
  return {
    name: user.name || '',
    company: user.company || '',
    contact: user.contact || user.login || '',
    program: '',
    type: '',
    description: '',
    urgency: 'normal',
    ...storage.get(KEYS.draft, {})
  };
}

function readForm(form) {
  const data = new FormData(form);
  const text = (name) => (data.get(name) || '').trim();
  return {
    name: text('name'),
    company: text('company'),
    contact: text('contact'),
    program: data.get('program') || '',
    type: data.get('type') || '',
    description: text('description'),
    urgency: data.get('urgency') || 'normal'
  };
}

function validate(v) {
  const errors = {};
  if (v.name.length < 2) errors.name = 'Укажите имя';
  if (v.company.length < 2) errors.company = 'Укажите название компании';
  if (!v.contact) errors.contact = 'Укажите телефон или email для связи';
  else if (!isContact(v.contact)) errors.contact = 'Проверьте номер телефона или email';
  if (!v.program) errors.program = 'Выберите программу 1С';
  if (!v.type) errors.type = 'Выберите тип проблемы';
  if (v.description.length < 10) errors.description = 'Опишите проблему подробнее (не меньше 10 символов)';
  return errors;
}

export default function newTicketScreen() {
  const v = initialValues();

  const programOptions = PROGRAMS.map((p) =>
    `<option value="${esc(p)}" ${p === v.program ? 'selected' : ''}>${esc(p)}</option>`).join('');

  const typeOptions = TYPES.map((t) => `
    <label class="opt">
      <input type="radio" name="type" value="${t.id}" ${t.id === v.type ? 'checked' : ''}>
      <span>${icon(t.icon, 20)}${t.label}</span>
    </label>`).join('');

  const urgencyOptions = URGENCY.map((u) => `
    <label class="u-${u.id}">
      <input type="radio" name="urgency" value="${u.id}" ${u.id === v.urgency ? 'checked' : ''}>
      <span>${u.label}</span>
    </label>`).join('');

  const html = `
    <form id="ticketForm" novalidate>
      <p class="form-intro">
        Опишите вопрос — специалист возьмёт заявку в работу, а статус вы увидите в разделе «Мои заявки».
      </p>

      <fieldset class="group">
        <legend>Контактные данные</legend>

        <label class="field" data-f="name">
          <span class="lbl">Имя <i>*</i></span>
          <input name="name" autocomplete="name" maxlength="80" placeholder="Например, Иван Петров" value="${esc(v.name)}">
          <span class="err"></span>
        </label>

        <label class="field" data-f="company">
          <span class="lbl">Компания <i>*</i></span>
          <input name="company" autocomplete="organization" maxlength="120" placeholder="ООО «Ромашка»" value="${esc(v.company)}">
          <span class="err"></span>
        </label>

        <label class="field" data-f="contact">
          <span class="lbl">Телефон или email <i>*</i></span>
          <input name="contact" autocomplete="tel" maxlength="80" placeholder="+7 900 000-00-00 или mail@company.ru" value="${esc(v.contact)}">
          <span class="err"></span>
        </label>
      </fieldset>

      <fieldset class="group">
        <legend>Обращение</legend>

        <label class="field" data-f="program">
          <span class="lbl">Программа 1С <i>*</i></span>
          <select name="program">
            <option value="" disabled ${v.program ? '' : 'selected'}>Выберите программу</option>
            ${programOptions}
          </select>
          <span class="err"></span>
        </label>

        <div class="field" data-f="type" role="radiogroup" aria-label="Тип проблемы">
          <span class="lbl">Тип проблемы <i>*</i></span>
          <div class="type-grid">${typeOptions}</div>
          <span class="err"></span>
        </div>

        <label class="field" data-f="description">
          <span class="lbl">Описание <i>*</i></span>
          <textarea name="description" rows="5" maxlength="2000"
            placeholder="Что делали, что произошло, текст ошибки. Чем подробнее — тем быстрее решим.">${esc(v.description)}</textarea>
          <span class="counter" id="charCounter">${v.description.length} / 2000</span>
          <span class="err"></span>
        </label>

        <div class="field" data-f="urgency" role="radiogroup" aria-label="Срочность">
          <span class="lbl">Срочность</span>
          <div class="seg">${urgencyOptions}</div>
          <span class="hint" id="urgencyHint">${esc(URGENCY_BY_ID[v.urgency]?.hint || '')}</span>
          <span class="err"></span>
        </div>
      </fieldset>

      <button class="btn btn-primary btn-block" type="submit" id="submitButton">
        ${icon('send', 20)}Отправить заявку
      </button>
    </form>`;

  function mount(root) {
    const form = $('#ticketForm', root);
    const submitButton = $('#submitButton', root);
    let draftTimer = null;

    clearErrorsOnInput(form);

    const saveDraft = () => {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        storage.set(KEYS.draft, { ...readForm(form), description: form.description.value });
      }, 300);
    };

    form.addEventListener('input', (event) => {
      if (event.target.name === 'description') {
        $('#charCounter', root).textContent = `${event.target.value.length} / 2000`;
      }
      saveDraft();
    });

    form.addEventListener('change', (event) => {
      if (event.target.name === 'urgency') {
        $('#urgencyHint', root).textContent = URGENCY_BY_ID[event.target.value].hint;
      }
      saveDraft();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = readForm(form);

      if (showFieldErrors(form, validate(values))) {
        toast('Заполните обязательные поля');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Отправляем…';
      try {
        const ticket = await store.create(values);
        clearTimeout(draftTimer);
        storage.remove(KEYS.draft);
        replace(`created-${ticket.id}`);
      } catch (error) {
        submitButton.disabled = false;
        submitButton.innerHTML = `${icon('send', 20)}Отправить заявку`;
        if (error.fields) showFieldErrors(form, error.fields);
        toast(error.message);
      }
    });
  }

  return { title: 'Новая заявка', back: 'home', tab: 'new', html, mount };
}
