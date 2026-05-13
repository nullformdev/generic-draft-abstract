/**
 * lang.ts — i18n strings.
 * Server bakes localized strings into per-part state.
 */

type Lang = 'en' | 'ru';

const strings: Record<Lang, Record<string, string>> = {
  en: {
    // Nav
    'nav.logout': 'Log out',
    'nav.manage': 'Manage',
    'nav.logs': 'Logs',
    'nav.controls': 'Controls',

    // Home
    'home.title': 'Home',

    // Auth
    'auth.login': 'Log in',
    'auth.register': 'Register',
    'auth.login.title': 'Log in - generic-draft-abstract',
    'auth.register.title': 'Register - generic-draft-abstract',
    'auth.field.invite': 'Invite code',
    'auth.field.login': 'Login',
    'auth.field.password': 'Password',
    'auth.invite': 'Invite code',
    'auth.password': 'Password',
    'auth.error.invalid': 'Invalid login or password',
    'auth.error.invite': 'Invalid invite code',
    'auth.error.taken': 'Login already taken',
    'auth.error.ratelimit': 'Too many attempts, try again later',

    // Admin
    'admin.title': 'Management',
    'admin.users': 'Users',
    'admin.col.id': 'ID',
    'admin.col.created_at': 'Created at',
    'admin.col.login': 'Login',
    'admin.col.admin': 'Admin',
    'admin.action.saving': 'Saving...',
    'admin.error.action_failed': 'Action failed',
    'admin.empty': 'No rows',

    // Logs
    'logs.title': 'Logs',
    'logs.empty': 'No logs',
    'logs.col.time': 'Time',
    'logs.col.level': 'Level',
    'logs.col.kind': 'Kind',
    'logs.col.route': 'Route',
    'logs.col.status': 'Status',
    'logs.col.user_id': 'User ID',
    'logs.col.request_id': 'Request ID',
    'logs.col.message': 'Message',
  },

  ru: {
    // Nav
    'nav.logout': 'Выйти',
    'nav.manage': 'Управление',
    'nav.logs': 'Логи',
    'nav.controls': 'Действия',

    // Home
    'home.title': 'Главная',

    // Auth
    'auth.login': 'Войти',
    'auth.register': 'Регистрация',
    'auth.login.title': 'Войти - generic-draft-abstract',
    'auth.register.title': 'Регистрация - generic-draft-abstract',
    'auth.field.invite': 'Инвайт-код',
    'auth.field.login': 'Логин',
    'auth.field.password': 'Пароль',
    'auth.invite': 'Инвайт-код',
    'auth.password': 'Пароль',
    'auth.error.invalid': 'Неверный логин или пароль',
    'auth.error.invite': 'Неверный инвайт-код',
    'auth.error.taken': 'Логин уже занят',
    'auth.error.ratelimit': 'Слишком много попыток, попробуйте позже',

    // Admin
    'admin.title': 'Управление',
    'admin.users': 'Пользователи',
    'admin.col.id': 'ID',
    'admin.col.created_at': 'Создано',
    'admin.col.login': 'Логин',
    'admin.col.admin': 'Админ',
    'admin.action.saving': 'Сохранение...',
    'admin.error.action_failed': 'Ошибка действия',
    'admin.empty': 'Нет данных',

    // Logs
    'logs.title': 'Логи',
    'logs.empty': 'Логов нет',
    'logs.col.time': 'Время',
    'logs.col.level': 'Уровень',
    'logs.col.kind': 'Тип',
    'logs.col.route': 'Маршрут',
    'logs.col.status': 'Статус',
    'logs.col.user_id': 'ID пользователя',
    'logs.col.request_id': 'ID запроса',
    'logs.col.message': 'Сообщение',
  },
};

export function t(lang: string, key: string): string {
  const l = (strings[lang as Lang] ? lang : 'en') as Lang;
  return strings[l][key] ?? key;
}
