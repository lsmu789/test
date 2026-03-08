import { requireAuth, signOut, getSupabase } from './main.js';

// Require authentication
const session = await requireAuth();
if (!session) {
  throw new Error('Not authenticated');
}

const sb = await getSupabase();

// ========================================
// DOM Elements
// ========================================

// Mode containers
const selectionMode = document.getElementById('selection-mode');
const generationMode = document.getElementById('generation-mode');
const completionMode = document.getElementById('completion-mode');
const mypageMode = document.getElementById('mypage-mode');

// Selection mode elements
const themeButtons = document.querySelectorAll('.theme-btn');
const freedomSlider = document.getElementById('freedom-slider');
const freedomValue = document.getElementById('freedom-value');
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');
const startBtn = document.getElementById('start-btn');

// Generation mode elements
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const contentDisplay = document.getElementById('content-display');
const finishBtn = document.getElementById('finish-btn');
const nextBtn = document.getElementById('next-btn');
const tokenDisplay = document.getElementById('token-display');

// Completion mode elements
const completionContent = document.getElementById('completion-content');
const pdfBtn = document.getElementById('pdf-btn');
const newBtn = document.getElementById('new-btn');
const mypageBtn = document.getElementById('mypage-btn');

// Mypage mode elements
const mypageContent = document.getElementById('mypage-content');
const mypageNewBtn = document.getElementById('mypage-new-btn');

// Sidebar elements
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');
const signOutBtn = document.getElementById('sign-out-btn');

// ========================================
// State
// ========================================

let state = {
  theme: null,
  freedom: 0.5,
  volume: 0.5,
  currentStep: 0,
  maxStep: 5,
  fairytaleId: null,
  contents: {}, // { 1: content, 2: content, ... }
  totalTokens: 0,
  totalCost: { usd: 0, krw: 0 },
  isGenerating: false,
};

// ========================================
// Initialization
// ========================================

function init() {
  // Set user info
  userEmail.textContent = session.user.email;
  userAvatar.textContent = session.user.email.charAt(0).toUpperCase();

  // Event listeners
  signOutBtn.addEventListener('click', signOut);

  // Selection mode
  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.theme = btn.dataset.theme;
      updateStartBtn();
    });
  });

  freedomSlider.addEventListener('input', (e) => {
    state.freedom = parseFloat(e.target.value);
    freedomValue.textContent = state.freedom.toFixed(1);
  });

  volumeSlider.addEventListener('input', (e) => {
    state.volume = parseFloat(e.target.value);
    volumeValue.textContent = state.volume.toFixed(1);
  });

  startBtn.addEventListener('click', startGeneration);

  // Generation mode
  finishBtn.addEventListener('click', finishFairytale);
  nextBtn.addEventListener('click', generateNextStep);

  // Completion mode
  pdfBtn.addEventListener('click', generatePdf);
  newBtn.addEventListener('click', resetAndShowSelection);
  mypageBtn.addEventListener('click', goToMypage);

  // Mypage mode
  mypageNewBtn.addEventListener('click', resetAndShowSelection);

  // Show selection mode
  showSelectionMode();
}

// ========================================
// Mode switching
// ========================================

function showSelectionMode() {
  selectionMode.style.display = 'flex';
  generationMode.style.display = 'none';
  completionMode.style.display = 'none';
  mypageMode.style.display = 'none';
  resetState();
}

function showGenerationMode() {
  selectionMode.style.display = 'none';
  generationMode.style.display = 'flex';
  completionMode.style.display = 'none';
  mypageMode.style.display = 'none';
}

function showCompletionMode() {
  selectionMode.style.display = 'none';
  generationMode.style.display = 'none';
  completionMode.style.display = 'flex';
  mypageMode.style.display = 'none';

  // Combine all contents
  let allContent = '';
  for (let i = 1; i <= state.maxStep; i++) {
    if (state.contents[i]) {
      allContent += state.contents[i] + '\n\n';
    }
  }

  completionContent.innerHTML = allContent.replace(/\n/g, '<br>');
}

function showMypageMode() {
  selectionMode.style.display = 'none';
  generationMode.style.display = 'none';
  completionMode.style.display = 'none';
  mypageMode.style.display = 'flex';

  loadFairytales();
}

// ========================================
// Selection mode
// ========================================

function updateStartBtn() {
  if (state.theme) {
    startBtn.style.display = 'block';
  } else {
    startBtn.style.display = 'none';
  }
}

// ========================================
// Generation mode
// ========================================

async function startGeneration() {
  state.currentStep = 1;
  state.fairytaleId = 'fairytale_' + Date.now(); // Temporary ID
  state.contents = {};
  state.totalTokens = 0;
  state.totalCost = { usd: 0, krw: 0 };

  showGenerationMode();
  await generateStep();
}

async function generateStep() {
  if (state.currentStep > state.maxStep) {
    showCompletionMode();
    return;
  }

  const stepNames = ['', '콘셉트', '플롯', '캐릭터', '본문', '마무리'];

  state.isGenerating = true;
  updateProgressBar();
  updateGenerationUI();

  try {
    // Get access token
    const { data: { session: currentSession }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !currentSession) {
      throw new Error('Session expired');
    }

    const accessToken = currentSession.access_token;

    // Call API
    const response = await fetch('/api/generate-fairytale', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        theme: state.theme,
        freedom: state.freedom,
        volume: state.volume,
        step: state.currentStep,
        fairytaleId: state.fairytaleId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API request failed');
    }

    const data = await response.json();

    // Store content
    state.contents[state.currentStep] = data.content;

    // Update tokens and cost
    state.totalTokens += data.tokens.total;
    state.totalCost.usd += parseFloat(data.cost.usd);
    state.totalCost.krw += parseFloat(data.cost.krw);

    // Display content
    contentDisplay.classList.remove('loading');
    contentDisplay.innerHTML = data.content.replace(/\n/g, '<br>');
    updateTokenDisplay();

    // Show buttons
    finishBtn.style.display = 'block';
    if (state.currentStep < state.maxStep) {
      const nextStepName = stepNames[state.currentStep + 1];
      nextBtn.textContent = `다음 (Step ${state.currentStep + 1})`;
      nextBtn.style.display = 'block';
    } else {
      nextBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Error:', error);
    contentDisplay.classList.remove('loading');
    contentDisplay.innerHTML = `오류가 발생했습니다: ${error.message}`;
    contentDisplay.style.color = '#d32f2f';
  } finally {
    state.isGenerating = false;
  }
}

function generateNextStep() {
  state.currentStep++;
  contentDisplay.classList.add('loading');
  contentDisplay.textContent = '생성 중입니다...';
  finishBtn.style.display = 'none';
  nextBtn.style.display = 'none';
  generateStep();
}

function finishFairytale() {
  showCompletionMode();
}

function updateProgressBar() {
  const steps = progressBar.querySelectorAll('.progress-step');
  steps.forEach((step, index) => {
    const stepNum = index + 1;
    step.classList.remove('active', 'completed');
    if (stepNum < state.currentStep) {
      step.classList.add('completed');
    } else if (stepNum === state.currentStep) {
      step.classList.add('active');
    }
  });

  const stepNames = ['', '콘셉트', '플롯', '캐릭터', '본문', '마무리'];
  progressText.textContent = `Step ${state.currentStep}/${state.maxStep} - ${stepNames[state.currentStep]} 생성 중...`;
}

function updateGenerationUI() {
  // Could add animations or other UI updates here
}

function updateTokenDisplay() {
  const tokens = state.totalTokens;
  const costUsd = state.totalCost.usd.toFixed(6);
  const costKrw = state.totalCost.krw.toFixed(0);
  tokenDisplay.textContent = `토큰: ${tokens}개 | 비용: $${costUsd} | ₩${costKrw}`;
}

// ========================================
// Completion mode
// ========================================

async function generatePdf() {
  try {
    pdfBtn.disabled = true;
    pdfBtn.textContent = '생성 중...';

    // Combine all contents
    let allContent = '';
    for (let i = 1; i <= state.maxStep; i++) {
      if (state.contents[i]) {
        allContent += state.contents[i] + '\n\n';
      }
    }

    // Create HTML for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.8; color: #333; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #4CAF50; padding-bottom: 20px; }
          .header h1 { margin: 0; color: #4CAF50; font-size: 24px; }
          .header .meta { font-size: 12px; color: #999; margin-top: 10px; }
          .content { white-space: pre-wrap; word-wrap: break-word; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999; text-align: center; }
          page { page-break-after: always; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${state.theme} 동화</h1>
          <div class="meta">
            <p>주제: ${state.theme} | 자유도: ${state.freedom} | 내용양: ${state.volume}</p>
            <p>생성일: ${new Date().toLocaleString('ko-KR')} | 총 토큰: ${state.totalTokens}개</p>
          </div>
        </div>
        <div class="content">${allContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <div class="footer">
          <p>조선왕조실록 기반 AI 동화 | 조직 모름 · 기술 모름</p>
        </div>
      </body>
      </html>
    `;

    // Generate PDF using html2pdf
    const element = document.createElement('div');
    element.innerHTML = html;

    const opt = {
      margin: 10,
      filename: `동화_${state.theme}_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };

    await html2pdf().set(opt).from(html).save();

    // Try to save to Supabase (optional)
    saveFairytaleToSupabase();

    pdfBtn.textContent = '📥 PDF 생성 & 다운로드';
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('PDF 생성 중 오류가 발생했습니다: ' + error.message);
    pdfBtn.textContent = '📥 PDF 생성 & 다운로드';
  } finally {
    pdfBtn.disabled = false;
  }
}

async function saveFairytaleToSupabase() {
  try {
    const { data: { session: currentSession } } = await sb.auth.getSession();
    if (!currentSession) return;

    const accessToken = currentSession.access_token;

    // Create fairytale record
    const response = await fetch('https://vygjcktxdvqdvftjzvur.supabase.co/rest/v1/fairytales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Z2pja3R4ZHZxZHZmdGp6dnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjY3NzAsImV4cCI6MjA4NzM0Mjc3MH0.XGNRM3I5JB9W2BpkrU0Z9C9e-UUSml2WTSTWCSrVfYo',
      },
      body: JSON.stringify({
        title: `${state.theme} 동화`,
        theme: state.theme,
        freedom: state.freedom,
        volume: state.volume,
        status: 'completed',
        total_tokens: state.totalTokens,
        total_cost_usd: state.totalCost.usd,
      }),
    });

    if (!response.ok) {
      console.error('Failed to save fairytale');
    }
  } catch (error) {
    console.error('Error saving fairytale:', error);
  }
}

function resetAndShowSelection() {
  showSelectionMode();
}

async function goToMypage() {
  showMypageMode();
}

// ========================================
// Mypage mode
// ========================================

async function loadFairytales() {
  try {
    mypageContent.innerHTML = '<div style="text-align: center; color: #999;">동화를 불러오는 중...</div>';

    const { data: { session: currentSession } } = await sb.auth.getSession();
    if (!currentSession) {
      mypageContent.innerHTML = '<div style="color: #d32f2f;">세션 만료. 다시 로그인해주세요.</div>';
      return;
    }

    const accessToken = currentSession.access_token;

    // Fetch fairytales from Supabase
    const response = await fetch(
      'https://vygjcktxdvqdvftjzvur.supabase.co/rest/v1/fairytales?order=created_at.desc',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Z2pja3R4ZHZxZHZmdGp6dnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjY3NzAsImV4cCI6MjA4NzM0Mjc3MH0.XGNRM3I5JB9W2BpkrU0Z9C9e-UUSml2WTSTWCSrVfYo',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch fairytales');
    }

    const fairytales = await response.json();

    if (fairytales.length === 0) {
      mypageContent.innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">아직 생성한 동화가 없습니다.</div>';
      return;
    }

    // Render fairytales
    mypageContent.innerHTML = fairytales.map(ft => `
      <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${ft.title || '제목 없음'}</h3>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
              <span>주제: ${ft.theme}</span> |
              <span>자유도: ${ft.freedom}</span> |
              <span>양: ${ft.volume}</span>
            </div>
            <div style="font-size: 12px; color: #999;">
              생성일: ${new Date(ft.created_at).toLocaleString('ko-KR')}
              ${ft.total_tokens ? ` | 토큰: ${ft.total_tokens}개` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="viewFairytale('${ft.id}')" style="padding: 6px 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">보기</button>
            <button onclick="deleteFairytale('${ft.id}')" style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
          </div>
        </div>
      </div>
    `).join('');

    // Make functions global for onclick handlers
    window.viewFairytale = viewFairytale;
    window.deleteFairytale = deleteFairytale;

  } catch (error) {
    console.error('Error loading fairytales:', error);
    mypageContent.innerHTML = `<div style="color: #d32f2f;">오류: ${error.message}</div>`;
  }
}

async function viewFairytale(fairytaleId) {
  alert('동화 상세보기는 준비 중입니다.');
  // TODO: Implement fairytale details view
}

async function deleteFairytale(fairytaleId) {
  if (!confirm('이 동화를 삭제하시겠습니까?')) {
    return;
  }

  try {
    const { data: { session: currentSession } } = await sb.auth.getSession();
    if (!currentSession) {
      alert('세션 만료. 다시 로그인해주세요.');
      return;
    }

    const accessToken = currentSession.access_token;

    const response = await fetch(
      `https://vygjcktxdvqdvftjzvur.supabase.co/rest/v1/fairytales?id=eq.${fairytaleId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Z2pja3R4ZHZxZHZmdGp6dnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjY3NzAsImV4cCI6MjA4NzM0Mjc3MH0.XGNRM3I5JB9W2BpkrU0Z9C9e-UUSml2WTSTWCSrVfYo',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete fairytale');
    }

    alert('동화가 삭제되었습니다.');
    loadFairytales();
  } catch (error) {
    console.error('Error deleting fairytale:', error);
    alert('삭제 중 오류가 발생했습니다: ' + error.message);
  }
}

// ========================================
// Utility functions
// ========================================

function resetState() {
  state = {
    theme: null,
    freedom: 0.5,
    volume: 0.5,
    currentStep: 0,
    maxStep: 5,
    fairytaleId: null,
    contents: {},
    totalTokens: 0,
    totalCost: { usd: 0, krw: 0 },
    isGenerating: false,
  };

  // Reset UI
  themeButtons.forEach(btn => btn.classList.remove('active'));
  freedomSlider.value = 0.5;
  freedomValue.textContent = '0.5';
  volumeSlider.value = 0.5;
  volumeValue.textContent = '0.5';
  startBtn.style.display = 'none';
}

// ========================================
// Initialize
// ========================================

init();
