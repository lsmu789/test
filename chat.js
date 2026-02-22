import { requireAuth, signOut, getSupabase } from './main.js';

// Require authentication
const session = await requireAuth();
if (!session) {
  throw new Error('Not authenticated');
}

const sb = await getSupabase();

// DOM elements
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const userInfo = document.getElementById('user-info');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');
const signOutBtn = document.getElementById('sign-out-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const conversationsList = document.getElementById('conversations-list');

// State
let conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
let currentConversationId = localStorage.getItem('currentConversationId') || null;
let currentMessages = [];
let isLoading = false;

// Initialize
function init() {
  // Set user info
  userEmail.textContent = session.user.email;
  userAvatar.textContent = session.user.email.charAt(0).toUpperCase();

  // Load conversations from localStorage
  renderConversations();

  // Load current conversation or start new one
  if (currentConversationId) {
    const conv = conversations.find(c => c.id === currentConversationId);
    if (conv) {
      currentMessages = conv.messages || [];
      renderMessages();
    } else {
      newConversation();
    }
  } else {
    newConversation();
  }

  // Event listeners
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
  });

  signOutBtn.addEventListener('click', signOut);
  newChatBtn.addEventListener('click', newConversation);
}

function newConversation() {
  const id = 'conv_' + Date.now();
  currentConversationId = id;
  currentMessages = [];

  conversations.push({
    id,
    title: '새로운 대화',
    messages: [],
    createdAt: new Date().toISOString(),
  });

  saveConversations();
  renderConversations();
  renderMessages();
  messageInput.focus();
}

function renderConversations() {
  conversationsList.innerHTML = '';

  conversations.forEach((conv) => {
    const item = document.createElement('div');
    item.className = 'conversation-item';
    if (conv.id === currentConversationId) {
      item.classList.add('active');
    }

    // Get first message as preview
    const firstMessage = conv.messages?.[0];
    const preview = firstMessage
      ? (firstMessage.content || '').substring(0, 30) + '...'
      : '새로운 대화';

    item.textContent = preview;
    item.addEventListener('click', () => {
      currentConversationId = conv.id;
      currentMessages = conv.messages || [];
      renderConversations();
      renderMessages();
    });

    conversationsList.appendChild(item);
  });
}

function renderMessages() {
  messagesContainer.innerHTML = '';

  if (currentMessages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="empty-state">
        <h2>무엇을 도와드릴까요?</h2>
        <p>안녕하세요! 한국 AI 챗봇입니다. 궁금한 점을 물어봐주세요.</p>
      </div>
    `;
    return;
  }

  currentMessages.forEach((msg) => {
    const msgEl = document.createElement('div');
    msgEl.className = `message ${msg.role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = msg.role === 'user' ? 'U' : 'AI';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = msg.content;

    if (msg.role === 'user') {
      msgEl.appendChild(content);
      msgEl.appendChild(avatar);
    } else {
      msgEl.appendChild(avatar);
      msgEl.appendChild(content);
    }

    messagesContainer.appendChild(msgEl);
  });

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isLoading) return;

  isLoading = true;
  sendBtn.disabled = true;
  messageInput.disabled = true;

  // Add user message
  currentMessages.push({ role: 'user', content: text });
  renderMessages();
  messageInput.value = '';
  messageInput.style.height = 'auto';

  try {
    // Get access token
    const { data: { session: currentSession }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !currentSession) {
      throw new Error('Session expired');
    }

    const accessToken = currentSession.access_token;

    // Call API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: text,
        conversationHistory: currentMessages.slice(0, -1), // Exclude the user message we just added
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API request failed');
    }

    const data = await response.json();

    // Update conversation title if first message
    const conv = conversations.find(c => c.id === currentConversationId);
    if (conv && (!conv.messages || conv.messages.length === 0)) {
      // Use first 30 chars of user message as title
      conv.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
    }

    // Add assistant message
    currentMessages.push({ role: 'assistant', content: data.reply });
    saveConversations();
    renderConversations();
    renderMessages();
  } catch (error) {
    console.error('Error:', error);
    // Add error message
    currentMessages.push({
      role: 'assistant',
      content: `오류가 발생했습니다: ${error.message}`,
    });
    renderMessages();
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

function saveConversations() {
  // Update current conversation messages
  const conv = conversations.find(c => c.id === currentConversationId);
  if (conv) {
    conv.messages = currentMessages;
  }

  localStorage.setItem('conversations', JSON.stringify(conversations));
  localStorage.setItem('currentConversationId', currentConversationId);
}

// Initialize
init();
