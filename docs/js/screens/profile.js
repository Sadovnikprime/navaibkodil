import { $, esc, isContact, storage, KEYS } from '../utils.js';
import { icon } from '../icons.js';
import { request, session } from '../api.js';
import { store } from '../store.js';
import { replace } from '../nav.js';
import { APP, COMPANY } from '../config.js';
import { toast, confirmDialog, showFieldErrors, clearErrorsOnInput } from '../ui.js';

export default function profileScreen(params, rerender) {
  const user = session.user || {};
  const isSpecialist = session.isSpecialist;
  const initial = (user.name || '?').trim().charAt(0).toUpperCase();

  const adminLink = isSpecialist ? `
    <a class="card setting" href="admin/" style="margin-top:12px">
      <span class="c-ico">${icon('shield', 20)}</span>
      <div class="s-main"><b>Админ-панель</b><small>Все заявки, клиенты и специалисты в удобной таблице</small></div>
      ${icon('next', 20)}
    </a>` : '';

  const html = `
    <div class="card user-card">
      <span class="avatar">${esc(initial)}</span>
      <div class="s-main"><b>${esc(user.name)}</b><small>${esc(user.login)}</small></div>
      <span class="role-badge ${isSpecialist ? 'spec' : ''}">${isSpecialist ? 'Специалист' : 'Клиент'}</span>
    </div>

    ${adminLink}

    <form id="profileForm" class="group" novalidate style="margin-top:12px">
      <legend>Мои данные</legend>
      <label class="field" data-f="name">
        <span class="lbl">Имя</span>
        <input name="name" maxlength="80" autocomplete="name" value="${esc(user.name || '')}">
        <span class="err"></span>
      </label>
      <label class="field" data-f="company">
        <span class="lbl">Компания</span>
        <input name="company" maxlength="120" autocomplete="organization" placeholder="ООО «Ромашка»" value="${esc(user.company || '')}">
        <span class="err"></span>
      </label>
      <label class="field" data-f="contact">
        <span class="lbl">Телефон или email для связи</span>
        <input name="contact" maxlength="80" placeholder="+7 900 000-00-00" value="${esc(user.contact || '')}">
        <span class="err"></span>
      </label>
      <span class="hint">Эти данные подставляются в новые заявки автоматически.</span>
      <button class="btn btn-dark btn-block" type="submit">Сохранить</button>
    </form>

    <form id="passwordForm" class="group" novalidate>
      <legend>Смена пароля</legend>
      <label class="field" data-f="oldPassword">
        <span class="lbl">Текущий пароль</span>
        <input name="oldPassword" type="password" autocomplete="current-password" maxlength="100">
        <span class="err"></span>
      </label>
      <label class="field" data-f="newPassword">
        <span class="lbl">Новый пароль</span>
        <input name="newPassword" type="password" autocomplete="new-password" maxlength="100" placeholder="Не меньше 6 символов">
        <span class="err"></span>
      </label>
      <button class="btn btn-ghost btn-block" type="submit">Изменить пароль</button>
    </form>

    <button class="btn btn-danger btn-block" id="logoutButton" type="button">${icon('logout', 20)}Выйти из аккаунта</button>

    <div class="about">${APP.name} · версия ${APP.version}<br>${esc(COMPANY.name)}</div>`;

  function mount(root) {
    const profileForm = $('#profileForm', root);
    clearErrorsOnInput(profileForm);
    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(profileForm);
      const data = {
        name: (formData.get('name') || '').trim(),
        company: (formData.get('company') || '').trim(),
        contact: (formData.get('contact') || '').trim()
      };
      const errors = {};
      if (data.name.length < 2) errors.name = 'Укажите имя';
      if (data.contact && !isContact(data.contact)) errors.contact = 'Проверьте телефон или email';
      if (showFieldErrors(profileForm, errors)) return;

      try {
        const result = await request('PATCH', '/auth/me', data);
        session.updateUser(result.user);

        const draft = storage.get(KEYS.draft);
        if (draft) storage.set(KEYS.draft, { ...draft, name: data.name, company: data.company, contact: data.contact || draft.contact });
        toast('Данные сохранены');
        rerender();
      } catch (error) {
        if (error.fields) showFieldErrors(profileForm, error.fields);
        toast(error.message);
      }
    });

    const passwordForm = $('#passwordForm', root);
    clearErrorsOnInput(passwordForm);
    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(passwordForm);
      const data = { oldPassword: formData.get('oldPassword') || '', newPassword: formData.get('newPassword') || '' };
      const errors = {};
      if (!data.oldPassword) errors.oldPassword = 'Введите текущий пароль';
      if (data.newPassword.length < 6) errors.newPassword = 'Пароль — не меньше 6 символов';
      if (showFieldErrors(passwordForm, errors)) return;

      try {
        await request('POST', '/auth/password', data);
        passwordForm.reset();
        toast('Пароль изменён');
      } catch (error) {
        if (error.fields) showFieldErrors(passwordForm, error.fields);
        toast(error.message);
      }
    });

    $('#logoutButton', root).addEventListener('click', () => {
      confirmDialog({
        title: 'Выйти из аккаунта?',
        text: 'Чтобы снова увидеть свои заявки, нужно будет войти по логину и паролю.',
        ok: 'Выйти',
        danger: true,
        onOk() {
          session.clear();
          store.reset();
          replace('home');
        }
      });
    });
  }

  return { title: 'Профиль', back: 'home', tab: 'home', html, mount };
}
