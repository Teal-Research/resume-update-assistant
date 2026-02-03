// Resume Update Assistant - Frontend

// DOM Elements
const uploadSection = document.getElementById('uploadSection');
const timelineSection = document.getElementById('timelineSection');
const methodologySection = document.getElementById('methodologySection');
const chatSection = document.getElementById('chatSection');
const bulletsSidebar = document.getElementById('bulletsSidebar');

const resumeFile = document.getElementById('resumeFile');
const uploadBtn = document.getElementById('uploadBtn');
const resumeText = document.getElementById('resumeText');
const parseTextBtn = document.getElementById('parseTextBtn');
const linkedinUrl = document.getElementById('linkedinUrl');
const linkedinBtn = document.getElementById('linkedinBtn');
const confirmTimelineBtn = document.getElementById('confirmTimelineBtn');
const timelineEl = document.getElementById('timeline');

const messagesEl = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingEl = document.getElementById('typing');
const statusEl = document.getElementById('status');

const bulletsList = document.getElementById('bulletsList');
const exportBulletsBtn = document.getElementById('exportBulletsBtn');

// Bullets state
let allBullets = [];

// State
let isStreaming = false;
let sessionId = null;
let parsedResume = null;
let selectedMethodology = 'Open';

// ============= Upload & Parse =============

uploadBtn.addEventListener('click', async () => {
  const file = resumeFile.files[0];
  if (!file) {
    alert('Please select a PDF file');
    return;
  }

  const formData = new FormData();
  formData.append('resume', file);

  setStatus('Uploading and parsing resume...');
  uploadBtn.disabled = true;

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    
    if (data.success && data.resume) {
      sessionId = data.sessionId;
      parsedResume = data.resume;
      showTimeline(data.resume, data.mostRecentRoleIndex);
      setStatus('Resume parsed! Review your timeline.');
    } else {
      alert(data.warning || data.error || 'Failed to parse resume');
      setStatus('Upload failed');
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('Failed to upload file');
    setStatus('Upload failed');
  } finally {
    uploadBtn.disabled = false;
  }
});

parseTextBtn.addEventListener('click', async () => {
  const text = resumeText.value.trim();
  if (!text) {
    alert('Please paste some resume text');
    return;
  }

  setStatus('Parsing text...');
  parseTextBtn.disabled = true;

  try {
    const response = await fetch('/api/parse-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();
    
    if (data.success && data.resume) {
      sessionId = data.sessionId;
      parsedResume = data.resume;
      showTimeline(data.resume, data.mostRecentRoleIndex);
      setStatus('Text parsed! Review your timeline.');
    } else {
      alert(data.error || 'Failed to parse text');
      setStatus('Parse failed');
    }
  } catch (error) {
    console.error('Parse error:', error);
    alert('Failed to parse text');
    setStatus('Parse failed');
  } finally {
    parseTextBtn.disabled = false;
  }
});

linkedinBtn.addEventListener('click', async () => {
  const url = linkedinUrl.value.trim();
  if (!url) {
    alert('Please enter a LinkedIn profile URL');
    return;
  }

  setStatus('Importing LinkedIn profile...');
  linkedinBtn.disabled = true;

  try {
    const response = await fetch('/api/linkedin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();
    
    if (data.success && data.resume) {
      sessionId = data.sessionId;
      parsedResume = data.resume;
      showTimeline(data.resume, data.mostRecentRoleIndex);
      setStatus(data.note || 'LinkedIn imported! Review your timeline.');
    } else {
      alert(data.error + (data.hint ? '\n\n' + data.hint : ''));
      setStatus('LinkedIn import failed');
    }
  } catch (error) {
    console.error('LinkedIn error:', error);
    alert('Failed to import LinkedIn profile. Try pasting your profile text instead.');
    setStatus('LinkedIn import failed');
  } finally {
    linkedinBtn.disabled = false;
  }
});

// ============= Timeline =============

function showTimeline(resume, mostRecentIndex) {
  uploadSection.classList.add('hidden');
  timelineSection.classList.remove('hidden');
  
  // Build timeline HTML
  let html = '';
  
  // Contact info
  if (resume.contact) {
    html += `
      <div class="bg-gray-700 rounded-lg p-3 mb-4">
        <p class="font-medium text-white">${resume.contact.name}</p>
        <p class="text-sm text-gray-400">
          ${[resume.contact.email, resume.contact.phone, resume.contact.location].filter(Boolean).join(' • ')}
        </p>
      </div>
    `;
  }
  
  // Experience
  resume.experience.forEach((exp, index) => {
    const isCurrent = index === mostRecentIndex || exp.isCurrentRole;
    html += `
      <div class="timeline-card ${isCurrent ? 'current' : ''} bg-gray-700 rounded-lg p-3 pl-4">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-medium text-white">${exp.title}</p>
            <p class="text-sm text-purple-300">${exp.company}</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-400">${exp.startDate} - ${exp.endDate}</p>
            ${isCurrent ? '<span class="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Current</span>' : ''}
          </div>
        </div>
        ${exp.bullets.length > 0 ? `
          <ul class="mt-2 text-sm text-gray-300 list-disc list-inside">
            ${exp.bullets.slice(0, 2).map(b => `<li class="truncate">${b}</li>`).join('')}
            ${exp.bullets.length > 2 ? `<li class="text-gray-500">+${exp.bullets.length - 2} more...</li>` : ''}
          </ul>
        ` : ''}
      </div>
    `;
  });
  
  // Skills summary
  if (resume.skills && resume.skills.length > 0) {
    html += `
      <div class="bg-gray-700 rounded-lg p-3 mt-4">
        <p class="text-sm text-gray-400 mb-1">Skills</p>
        <p class="text-sm text-white">${resume.skills.slice(0, 8).join(', ')}${resume.skills.length > 8 ? '...' : ''}</p>
      </div>
    `;
  }
  
  timelineEl.innerHTML = html;
}

confirmTimelineBtn.addEventListener('click', () => {
  timelineSection.classList.add('hidden');
  methodologySection.classList.remove('hidden');
  setStatus('Choose your preferred bullet format');
});

document.getElementById('wrongTimelineBtn').addEventListener('click', () => {
  timelineSection.classList.add('hidden');
  methodologySection.classList.remove('hidden');
  // Mark that we need correction
  parsedResume._needsCorrection = true;
  setStatus('Choose your preferred bullet format');
});

// Methodology selection
document.querySelectorAll('.methodology-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedMethodology = btn.dataset.method;
    methodologySection.classList.add('hidden');
    chatSection.classList.remove('hidden');
    bulletsSidebar.classList.remove('hidden');
    
    if (parsedResume?._needsCorrection) {
      startChatWithCorrection();
    } else {
      startChat();
    }
  });
});

function startChatWithCorrection() {
  const greeting = `I noticed the timeline might not be quite right. No worries! Let's start fresh.\n\n**What is your current or most recent job?** Please tell me:\n- Company name\n- Your job title\n- When you started (and ended, if applicable)`;
  
  addMessage(greeting, 'assistant');
  setStatus('Ready to chat - tell me about your current role');
  messageInput.focus();
}

// ============= Chat =============

function startChat() {
  // Add initial AI message based on resume
  const mostRecent = parsedResume.experience[0];
  const greeting = mostRecent 
    ? `Great! I see your most recent role was **${mostRecent.title}** at **${mostRecent.company}** (${mostRecent.startDate} - ${mostRecent.endDate}). Let's dig into what you accomplished there.\n\nTell me about a project or achievement you're particularly proud of from this role.`
    : `I've reviewed your resume. Let's work on uncovering accomplishments you might have forgotten to document.\n\nTell me about your most recent role - what project or achievement are you most proud of?`;
  
  addMessage(greeting, 'assistant');
  setStatus('Ready to chat');
  messageInput.focus();
}

function addMessage(content, role) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
  
  const bubble = document.createElement('div');
  bubble.className = role === 'user'
    ? 'bg-gray-600 text-white px-4 py-3 rounded-lg max-w-[80%]'
    : 'message-assistant text-white px-4 py-3 rounded-lg max-w-[80%]';
  
  bubble.innerHTML = formatMessage(content);
  messageDiv.appendChild(bubble);
  messagesEl.appendChild(messageDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  
  return bubble;
}

function formatMessage(content) {
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function setTyping(show) {
  typingEl.classList.toggle('hidden', !show);
  if (show) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setLoading(loading) {
  isStreaming = loading;
  sendBtn.disabled = loading;
  messageInput.disabled = loading;
}

function setStatus(text) {
  statusEl.textContent = text;
}

async function sendMessage(message) {
  addMessage(message, 'user');
  setLoading(true);
  setTyping(true);
  setStatus('AI is responding...');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId, methodology: selectedMethodology }),
    });

    if (!response.ok) throw new Error('Failed to send message');

    const assistantBubble = addMessage('', 'assistant');
    setTyping(false);
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              fullContent += data.content;
              // Remove bullet blocks from display
              const displayContent = fullContent.replace(/```bullet[\s\S]*?```/g, '').trim();
              assistantBubble.innerHTML = formatMessage(displayContent);
              messagesEl.scrollTop = messagesEl.scrollHeight;
            } else if (data.type === 'done' && data.bullet) {
              // Add extracted bullet to sidebar
              addBullet(data.bullet);
            } else if (data.type === 'error') {
              assistantBubble.innerHTML = `<span class="text-red-300">Error: ${data.error}</span>`;
            }
          } catch (e) {}
        }
      }
    }

    setStatus('Ready to chat');
  } catch (error) {
    console.error('Chat error:', error);
    setTyping(false);
    addMessage('Sorry, there was an error. Please try again.', 'assistant');
    setStatus('Error occurred');
  } finally {
    setLoading(false);
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message || isStreaming) return;
  messageInput.value = '';
  sendMessage(message);
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

// ============= Bullets Sidebar =============

function addBullet(bullet) {
  allBullets.push(bullet);
  renderBullets();
}

function renderBullets() {
  if (allBullets.length === 0) {
    bulletsList.innerHTML = '<p class="text-gray-500 text-sm">Bullets will appear here as you chat...</p>';
    exportBulletsBtn.classList.add('hidden');
    return;
  }

  // Group by company/title
  const groups = {};
  for (const bullet of allBullets) {
    const key = `${bullet.company}|${bullet.title}`;
    if (!groups[key]) {
      groups[key] = { company: bullet.company, title: bullet.title, bullets: [] };
    }
    groups[key].bullets.push(bullet);
  }

  let html = '';
  for (const group of Object.values(groups)) {
    html += `
      <div class="bg-gray-700 rounded-lg p-3">
        <p class="font-medium text-white text-sm">${group.company}</p>
        <p class="text-xs text-purple-300 mb-2">${group.title}</p>
        <ul class="space-y-2">
          ${group.bullets.map(b => `
            <li class="text-sm text-gray-200 flex items-start gap-2">
              ${b.isStrong ? '<span class="text-green-400 font-bold" title="Strong bullet">↑</span>' : '<span class="w-3"></span>'}
              <span>${b.text}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  bulletsList.innerHTML = html;
  exportBulletsBtn.classList.remove('hidden');
}

// Export bullets
exportBulletsBtn.addEventListener('click', () => {
  if (allBullets.length === 0) return;

  // Group and format
  const groups = {};
  for (const bullet of allBullets) {
    const key = `${bullet.company}|${bullet.title}`;
    if (!groups[key]) {
      groups[key] = { company: bullet.company, title: bullet.title, bullets: [] };
    }
    groups[key].bullets.push(bullet);
  }

  let text = 'GENERATED RESUME BULLETS\n========================\n\n';
  for (const group of Object.values(groups)) {
    text += `${group.title} | ${group.company}\n`;
    text += '-'.repeat(40) + '\n';
    for (const b of group.bullets) {
      text += `${b.isStrong ? '↑ ' : '• '}${b.text}\n`;
    }
    text += '\n';
  }

  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => {
    const originalText = exportBulletsBtn.textContent;
    exportBulletsBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      exportBulletsBtn.textContent = originalText;
    }, 2000);
  });
});
