import { $, $$, isContact } from '../utils.js';
import { icon } from '../icons.js';
import { request, session } from '../api.js';
import { store } from '../store.js';
import { replace } from '../nav.js';
import { toast, showFieldErrors, clearErrorsOnInput } from '../ui.js';
import { SERVER_NOT_CONFIGURED } from '../config.js';

let mode = 'login';

function field(name, label, { type = 'text', placeholder = '', autocomplete = 'off', maxlength = 100 } = {}) {
  return `
    <label class="field" data-f="${name}">
      <span class="lbl">${label}</span>
      <input name="${name}" type="${type}" placeholder="${placeholder}" autocomplete="${autocomplete}" maxlength="${maxlength}">
      <span class="err"></span>
    </label>`;
}

const LOGIN_FIELDS = `
  ${field('login', 'Телефон или email', { placeholder: '+7 900 000-00-00 или mail@company.ru', autocomplete: 'username', maxlength: 80 })}
  ${field('password', 'Пароль', { type: 'password', placeholder: 'Ваш пароль', autocomplete: 'current-password' })}`;

const REGISTER_FIELDS = `
  ${field('name', 'Имя <i>*</i>', { placeholder: 'Например, Иван Петров', autocomplete: 'name', maxlength: 80 })}
  ${field('company', 'Компания <i>*</i>', { placeholder: 'ООО «Ромашка»', autocomplete: 'organization', maxlength: 120 })}
  ${field('login', 'Телефон или email <i>*</i>', { placeholder: '+7 900 000-00-00 или mail@company.ru', autocomplete: 'username', maxlength: 80 })}
  ${field('password', 'Пароль <i>*</i>', { type: 'password', placeholder: 'Не меньше 6 символов', autocomplete: 'new-password' })}
  <div class="field" data-f="consent">
    <label class="check">
      <input type="checkbox" name="consent">
      <span>Согласен на обработку персональных данных для работы с моими обращениями</span>
    </label>
    <span class="err"></span>
  </div>`;

function validate(data, isRegister) {
  const errors = {};
  if (!data.login) errors.login = 'Укажите телефон или email';
  if (!isRegister) {
    if (!data.password) errors.password = 'Введите пароль';
    return errors;
  }
  if (data.name.length < 2) errors.name = 'Укажите имя';
  if (data.company.length < 2) errors.company = 'Укажите название компании';
  if (data.login && !isContact(data.login)) errors.login = 'Проверьте телефон или email';
  if (data.password.length < 6) errors.password = 'Пароль — не меньше 6 символов';
  if (!data.consent) errors.consent = 'Нужно согласие на обработку данных';
  return errors;
}

export default function authScreen(params, rerender) {
  const isRegister = mode === 'register';

  const html = `
    <div class="auth">
      <div class="auth-brand">
        <span class="auth-logo">${icon('logo', 42)}</span>
        <h2>1С: <span class="red">Помощник</span></h2>
        <p>Заявки специалистам, статусы обращений и полезные материалы</p>
      </div>

      ${SERVER_NOT_CONFIGURED ? `
        <div class="notice">${icon('alert', 18)}
          <span>Сервер ещё не подключён: укажите адрес сервера Render в файле <b>docs/js/config.js</b>.</span>
        </div>` : ''}

      <div class="seg seg-2" role="tablist">
        <button type="button" role="tab" data-mode="login" class="${isRegister ? '' : 'on'}">Вход</button>
        <button type="button" role="tab" data-mode="register" class="${isRegister ? 'on' : ''}">Регистрация</button>
      </div>

      <form id="authForm" class="group" novalidate>
        ${isRegister ? REGISTER_FIELDS : LOGIN_FIELDS}
        <button class="btn btn-primary btn-block" type="submit" id="authButton">
          ${isRegister ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </form>

      <p class="hint" style="text-align:center;margin-top:4px">
        ${isRegister
          ? 'Уже есть аккаунт? Перейдите на вкладку «Вход».'
          : 'Сотрудники компании входят под учётной записью, которую выдал администратор.'}
      </p>
    </div>`;

  function mount(root) {
    $$('[data-mode]', root).forEach((button) => {
      button.addEventListener('click', () => {
        mode = button.dataset.mode;
        rerender();
      });
    });

    const form = $('#authForm', root);
    clearErrorsOnInput(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const data = {
        login: (formData.get('login') || '').trim(),
        password: formData.get('password') || ''
      };
      if (isRegister) {
        data.name = (formData.get('name') || '').trim();
        data.company = (formData.get('company') || '').trim();
        data.consent = formData.get('consent') === 'on';
      }

      if (showFieldErrors(form, validate(data, isRegister))) return;

      const button = $('#authButton', root);
      button.disabled = true;
      button.textContent = isRegister ? 'Регистрируем…' : 'Входим…';

      try {
        const { consent, ...payload } = data;
        const result = await request('POST', isRegister ? '/auth/register' : '/auth/login', payload);
        session.save(result.token, result.user);
        store.reset();
        store.start();
        mode = 'login';
        toast(isRegister ? `Добро пожаловать, ${result.user.name}!` : `Вы вошли как ${result.user.name}`);
        replace('home');
      } catch (error) {
        button.disabled = false;
        button.textContent = isRegister ? 'Зарегистрироваться' : 'Войти';
        if (error.fields) showFieldErrors(form, error.fields);
        toast(error.message);
      }
    });
  }

  return { fullscreen: true, html, mount };
}
