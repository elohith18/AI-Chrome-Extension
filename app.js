const $ = (selector) => document.querySelector(selector);

const conversation = $('#conversation');
const input = $('#question');
const form = $('#composer');
const sendButton = $('#ask');
const notice = $('#notice');

const isExtension = location.protocol === 'chrome-extension:';
const isFullTab = new URLSearchParams(location.search).get('view') === 'full';

const apiUrl = isExtension
  ? 'http://127.0.0.1:3000/api/ask'
  : '/api/ask';

if (isExtension && !isFullTab) {
  $('#openTab').hidden = false;

  $('#openTab').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('index.html?view=full')
    });
  });
}

if (isFullTab) {
  document.body.classList.add('full-tab');
}

let pointerFrame = 0;
let pointerX = '50%';
let pointerY = '50%';

window.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse') return;

  pointerX = `${(event.clientX / window.innerWidth) * 100}%`;
  pointerY = `${(event.clientY / window.innerHeight) * 100}%`;

  if (pointerFrame) return;

  pointerFrame = requestAnimationFrame(() => {
    document.body.style.setProperty('--pointer-x', pointerX);
    document.body.style.setProperty('--pointer-y', pointerY);
    pointerFrame = 0;
  });
});

function notify(message) {
  notice.textContent = message;
  notice.hidden = false;
}

function scrollToLatest() {
  conversation.scrollTop = conversation.scrollHeight;
}

function cleanAnswer(text) {
  return text
    .replace(/\r/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\*{1,2}/g, '')
    .replace(/__|`{1,3}/g, '');
}

function addMessage(role, text = '') {
  $('#welcome')?.remove();

  const row = document.createElement('div');
  row.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';

  if (role === 'user') {
    avatar.classList.add('user-avatar');
    avatar.setAttribute('aria-label', 'You');
    avatar.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20c.4-3.5 2.8-5.5 6.5-5.5s6.1 2 6.5 5.5" />
      </svg>`;
  } else {
    avatar.classList.add('bot-avatar');
    avatar.setAttribute('aria-label', 'Zoro AI bot');
    avatar.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3v2.2M9.5 3h5" />
        <rect x="4.2" y="6" width="15.6" height="13" rx="4" />
        <path d="M8 19v2m8-2v2M2.5 12h1.7m15.6 0h1.7" />
        <circle cx="9" cy="11.5" r="1" class="bot-eye" />
        <circle cx="15" cy="11.5" r="1" class="bot-eye" />
        <path d="M9 15h6" />
      </svg>`;
  }

  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap';

  const name = document.createElement('p');
  name.className = 'message-name';
  name.textContent = role === 'user' ? 'YOU' : 'ZORO AI';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  if (role === 'assistant' && !text) {
    const dots = document.createElement('span');
    dots.className = 'typing-dots';
    dots.setAttribute('aria-label', 'Zoro is thinking');
    dots.innerHTML = '<i></i><i></i><i></i>';
    bubble.append(dots);
  }

  wrap.append(name, bubble);
  row.append(avatar, wrap);
  conversation.append(row);
  scrollToLatest();

  return bubble;
}

async function askServer(prompt, bubble) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) {
    let message = `Server request failed (${response.status}).`;

    try {
      const body = await response.json();
      message = body.error || message;
    } catch {}

    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let answer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;

      const data = line.slice(5).trim();
      if (!data) continue;

      const event = JSON.parse(data);

      if (event.error) {
        throw new Error(event.error);
      }

      if (event.text) {
        if (!answer) {
          bubble.replaceChildren();
        }

        answer += event.text;
        bubble.textContent = cleanAnswer(answer);
        scrollToLatest();
      }
    }
  }

  if (!answer) {
    throw new Error('Groq returned an empty answer.');
  }

  return cleanAnswer(answer);
}

async function ask(prompt = input.value.trim()) {
  if (!prompt) {
    input.focus();
    notify('Type a message first.');
    return;
  }

  if (sendButton.disabled) return;

  notice.hidden = true;
  input.value = '';
  input.dispatchEvent(new Event('input'));

  addMessage('user', prompt);
  const replyBubble = addMessage('assistant');

  sendButton.disabled = true;
  input.disabled = true;

  try {
    const answer = await askServer(prompt, replyBubble);

    const copyButton = document.createElement('button');
    copyButton.className = 'copy-message';
    copyButton.type = 'button';
    copyButton.textContent = 'COPY ANSWER ↗';

    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(answer);
        copyButton.textContent = 'COPIED ✓';

        setTimeout(() => {
          copyButton.textContent = 'COPY ANSWER ↗';
        }, 1200);
      } catch {
        notify('Clipboard unavailable. Select the answer to copy it.');
      }
    });

    replyBubble.after(copyButton);
  } catch (error) {
    replyBubble.textContent = `I couldn’t reach Groq. ${error.message}`;
    notify('Check the local server, Groq API key, and model access.');
  } finally {
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
    scrollToLatest();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  ask();
});

input.addEventListener('input', () => {
  $('#count').textContent =
    `${input.value.length} / 4000 · Enter to send`;

  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    ask();
  }
});

document.querySelectorAll('.chips button').forEach((button) => {
  button.addEventListener('click', () => {
    ask(button.dataset.q);
  });
});