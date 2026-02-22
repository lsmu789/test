import { getSupabase, getSession } from './main.js';

// Redirect if already logged in
const session = await getSession();
if (session) {
  window.location.href = '/chat.html';
}

const sb = await getSupabase();

// Tab switching
const tabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('.auth-form');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetForm = tab.dataset.tab;

    // Update active tab
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active form
    forms.forEach(form => form.classList.remove('active'));
    document.querySelector(`[data-form="${targetForm}"]`).classList.add('active');

    // Clear errors
    document.getElementById('login-error').classList.remove('show');
    document.getElementById('signup-error').classList.remove('show');
  });
});

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btnEl = document.getElementById('login-btn');

  errorEl.classList.remove('show');
  btnEl.disabled = true;

  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error(error.message);
    }

    // Redirect to chat on success
    window.location.href = '/chat.html';
  } catch (err) {
    let message = err.message;

    // Korean error messages
    if (message.includes('Invalid login credentials')) {
      message = '이메일 또는 비밀번호가 올바르지 않습니다';
    } else if (message.includes('Email not confirmed')) {
      message = '이메일 확인이 필요합니다';
    } else if (message.includes('Network error')) {
      message = '네트워크 오류가 발생했습니다';
    }

    errorEl.textContent = message;
    errorEl.classList.add('show');
    btnEl.disabled = false;
  }
});

// Signup form handler
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  const errorEl = document.getElementById('signup-error');
  const btnEl = document.getElementById('signup-btn');

  errorEl.classList.remove('show');

  // Validation
  if (password !== confirm) {
    errorEl.textContent = '비밀번호가 일치하지 않습니다';
    errorEl.classList.add('show');
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = '비밀번호는 최소 6자 이상이어야 합니다';
    errorEl.classList.add('show');
    return;
  }

  btnEl.disabled = true;

  try {
    const { error } = await sb.auth.signUp({ email, password });

    if (error) {
      throw new Error(error.message);
    }

    errorEl.textContent = '회원가입이 완료되었습니다. 로그인 탭에서 로그인해주세요.';
    errorEl.style.background = '#f0fdf4';
    errorEl.style.borderColor = '#bbf7d0';
    errorEl.style.color = '#15803d';
    errorEl.classList.add('show');

    // Clear form
    document.getElementById('signup-form').reset();
    btnEl.disabled = false;
  } catch (err) {
    let message = err.message;

    // Korean error messages
    if (message.includes('already registered')) {
      message = '이미 가입된 이메일입니다';
    } else if (message.includes('password')) {
      message = '비밀번호 형식이 올바르지 않습니다';
    } else if (message.includes('invalid email')) {
      message = '유효한 이메일 주소를 입력해주세요';
    }

    errorEl.textContent = message;
    errorEl.style.background = '#fef2f2';
    errorEl.style.borderColor = '#fecaca';
    errorEl.style.color = '#dc2626';
    errorEl.classList.add('show');
    btnEl.disabled = false;
  }
});
