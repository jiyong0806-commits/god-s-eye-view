import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { accountClient, accountUser, accountRedirect } from './plasmaAccount.js';
import { safeAccountReturn } from '../packages/plasma-account/config.js';
import './plasmaAuth.css';

const params = new URLSearchParams(location.search);
const next = safeAccountReturn(params.get('next'));
const form = document.getElementById('account-form');
const status = document.getElementById('account-status');
const send = document.getElementById('account-submit');
const retry = document.getElementById('retry-account');
const signin = document.getElementById('signin-tab');
const register = document.getElementById('register-tab');
const resetMode = document.getElementById('reset-mode');
let client, mode = params.get('mode') === 'recovery' ? 'recovery' : 'signin', busy = false;
const iconRoot = createRoot(document.getElementById('password-visible'));
function passwordIcon() { iconRoot.render(createElement(form.elements.password.type === 'password' ? Eye : EyeOff, { size: 18, strokeWidth: 1.5 })); }
document.getElementById('password-visible').onclick = () => { const input = form.elements.password; input.type = input.type === 'password' ? 'text' : 'password'; passwordIcon(); };
function setMode(value) {
  mode = value;
  for (const name of ['password', 'passwordConfirm']) form.elements[name].value = '';
  form.elements.password.type = 'password'; passwordIcon();
  const signup = mode === 'signup', recovery = mode === 'recovery', reset = mode === 'reset';
  for (const id of ['name-field', 'consent-field']) document.getElementById(id).hidden = !signup;
  document.getElementById('confirm-field').hidden = !(signup || recovery);
  document.getElementById('password-field').hidden = reset;
  document.getElementById('email-field').hidden = recovery;
  form.elements.email.required = !recovery;
  form.elements.password.required = !reset;
  form.elements.password.minLength = signup || recovery ? 12 : 1;
  form.elements.password.autocomplete = signup || recovery ? 'new-password' : 'current-password';
  form.elements.passwordConfirm.required = signup || recovery;
  form.elements.consent.required = signup;
  signin.setAttribute('aria-pressed', String(!signup)); register.setAttribute('aria-pressed', String(signup));
  send.textContent = signup ? '회원가입' : reset ? '재설정 메일 보내기' : recovery ? '새 비밀번호 저장' : '로그인';
  status.textContent = '';
}
signin.onclick = () => { if (!busy) setMode('signin'); }; register.onclick = () => { if (!busy) setMode('signup'); };
resetMode.onclick = () => { if (!busy) setMode('reset'); };
const authError = error => {
  if (/invalid login credentials/i.test(error.message)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/email not confirmed/i.test(error.message)) return '이메일 인증 후 로그인하세요.';
  if (/rate limit|too many requests/i.test(error.message) || error.status === 429) return '계정 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.';
  return error.message || '계정 서버 응답을 확인하지 못했습니다.';
};
async function connect() {
  send.disabled = true; retry.hidden = true; status.textContent = '계정 서버 연결 중…';
  try {
    client = await accountClient();
    client.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') setMode('recovery'); });
    const user = await accountUser();
    if (user && mode !== 'recovery') { location.replace(next); return; }
    if (!user && mode === 'recovery') { setMode('reset'); status.textContent = '재설정 링크가 만료되었거나 다른 브라우저에서 열렸습니다. 새 링크를 요청하세요.'; }
    else status.textContent = '';
    send.disabled = false;
  } catch { status.textContent = 'PLASMA 계정 서버에 연결하지 못했습니다.'; retry.hidden = false; }
}
retry.onclick = () => void connect();
form.onsubmit = async event => {
  event.preventDefault(); if (busy || !client || !form.reportValidity()) return;
  if (['signup', 'recovery'].includes(mode) && form.elements.password.value !== form.elements.passwordConfirm.value) { status.textContent = '비밀번호가 서로 일치하지 않습니다.'; return; }
  busy = true; send.disabled = true; signin.disabled = true; register.disabled = true; resetMode.disabled = true;
  const submittedMode = mode;
  const email = form.elements.email.value.trim(), password = form.elements.password.value;
  try {
    const result = submittedMode === 'signup' ? await client.auth.signUp({ email, password,
      options: { emailRedirectTo: accountRedirect(), data: { display_name: form.elements.name.value.trim(), account_brand: 'PLASMA' } } })
      : submittedMode === 'reset' ? await client.auth.resetPasswordForEmail(email, { redirectTo: accountRedirect('recovery') })
      : submittedMode === 'recovery' ? await client.auth.updateUser({ password }) : await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (submittedMode === 'reset') status.textContent = '등록된 계정이라면 재설정 메일이 도착합니다.';
    else if (submittedMode === 'signup' && !result.data.session) { setMode('signin'); status.textContent = '인증 메일을 확인한 뒤 로그인하세요.'; }
    else { const user = await accountUser(); if (!user) throw new Error('로그인 세션을 확인하지 못했습니다.'); location.replace(next); }
  } catch (error) { status.textContent = authError(error); }
  finally { form.elements.password.value = ''; form.elements.passwordConfirm.value = ''; busy = false; send.disabled = false; signin.disabled = false; register.disabled = false; resetMode.disabled = false; }
};
setMode(mode);
void connect();
