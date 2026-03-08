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
  resetState();
}

function showGenerationMode() {
  selectionMode.style.display = 'none';
  generationMode.style.display = 'flex';
  completionMode.style.display = 'none';
}

function showCompletionMode() {
  selectionMode.style.display = 'none';
  generationMode.style.display = 'none';
  completionMode.style.display = 'flex';

  // Combine all contents
  let allContent = '';
  for (let i = 1; i <= state.maxStep; i++) {
    if (state.contents[i]) {
      allContent += state.contents[i] + '\n\n';
    }
  }

  completionContent.innerHTML = allContent.replace(/\n/g, '<br>');
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
  alert('PDF 생성 기능은 준비 중입니다.');
  // TODO: Implement PDF generation
}

function resetAndShowSelection() {
  showSelectionMode();
}

function goToMypage() {
  alert('마이페이지 기능은 준비 중입니다.');
  // TODO: Redirect to mypage or show mypage UI
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
