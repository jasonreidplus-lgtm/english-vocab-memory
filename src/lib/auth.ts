/* 应用内「软登录」：仅用于挡住随手打开链接的人。
   注意：前端校验的口令会被打进 JS 包，懂技术的人可看到/绕过，并非真正的访问控制。
   登录态存在本机 localStorage，登录一次后记住。 */
const KEY = 'wordquest:auth';
const USER = 'pilgrim';
const PASS = '123456';

export function isAuthed() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function tryLogin(user, pass) {
  if (String(user).trim().toLowerCase() === USER && String(pass) === PASS) {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* localStorage 不可用则本次会话内仍可用 */
    }
    return true;
  }
  return false;
}

export function logout() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
