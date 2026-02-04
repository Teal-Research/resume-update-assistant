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

// Bullets and skills state
let allBullets = [];
let allSkills = [];
let pendingBullet = null; // Bullet being worked on, not yet confirmed

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

  setStatus('Uploading and parsing resume...', true);
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
      // Load imported bullets
      if (data.bullets && data.bullets.length > 0) {
        allBullets = data.bullets;
        renderBullets();
      }
      showTimeline(data.resume, data.mostRecentRoleIndex);
      setStatus('Resume parsed! Review your timeline.');
    } else {
      showError(data.warning || data.error || 'Failed to parse resume');
      setStatus('Upload failed');
    }
  } catch (error) {
    console.error('Upload error:', error);
    showError('Failed to upload file. Please try again.');
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

  setStatus('Parsing text...', true);
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
      // Load imported bullets
      if (data.bullets && data.bullets.length > 0) {
        allBullets = data.bullets;
        renderBullets();
      }
      showTimeline(data.resume, data.mostRecentRoleIndex);
      setStatus('Text parsed! Review your timeline.');
    } else {
      showError(data.error || 'Failed to parse text');
      setStatus('Parse failed');
    }
  } catch (error) {
    console.error('Parse error:', error);
    showError('Failed to parse text. Please try again.');
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

  setStatus('Importing LinkedIn profile...', true);
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
      // Load imported bullets
      if (data.bullets && data.bullets.length > 0) {
        allBullets = data.bullets;
        renderBullets();
      }
      showTimeline(data.resume, data.mostRecentRoleIndex);
      setStatus(data.note || 'LinkedIn imported! Review your timeline.');
    } else {
      showError(data.error + (data.hint ? ' ' + data.hint : ''));
      setStatus('LinkedIn import failed');
    }
  } catch (error) {
    console.error('LinkedIn error:', error);
    showError('Failed to import LinkedIn profile. Try pasting your profile text instead.');
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

function setStatus(text, isLoading = false) {
  statusEl.textContent = text;
  const spinner = document.getElementById('loadingSpinner');
  spinner.classList.toggle('hidden', !isLoading);
}

function showError(message) {
  const toast = document.getElementById('errorToast');
  const errorMsg = document.getElementById('errorMessage');
  errorMsg.textContent = message;
  toast.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => hideError(), 5000);
}

function hideError() {
  const toast = document.getElementById('errorToast');
  toast.classList.add('hidden');
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
              assistantBubble.innerHTML = formatMessage(fullContent);
              messagesEl.scrollTop = messagesEl.scrollHeight;
            } else if (data.type === 'bullet') {
              // Bullet streamed from tool call
              if (data.bullet) {
                addBullet(data.bullet);
              }
            } else if (data.type === 'skill') {
              // Skill streamed from tool call
              if (data.skill) {
                addSkill(data.skill);
              }
            } else if (data.type === 'done') {
              // Stream complete - counts available in data.bulletCount, data.skillCount
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
    messageInput.focus(); // Keep focus on input after response
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message || isStreaming) return;
  messageInput.value = '';
  messageInput.style.height = 'auto'; // Reset textarea height
  sendMessage(message);
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

// Auto-resize textarea as user types
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
});

// Reset height after sending
const originalSendMessage = sendMessage;
function sendMessageWrapper(message) {
  originalSendMessage(message);
  messageInput.style.height = 'auto';
}
// Note: sendMessage is called directly from form submit, so we reset in the submit handler

// ============= Bullets Sidebar =============

function addBullet(bullet) {
  // If it's an imported bullet, add directly
  if (bullet.isImported) {
    allBullets.push(bullet);
  } else {
    // AI-extracted bullets go to pending first
    pendingBullet = bullet;
  }
  renderBullets();
}

function confirmPendingBullet() {
  if (pendingBullet) {
    allBullets.push(pendingBullet);
    pendingBullet = null;
    renderBullets();
  }
}

function discardPendingBullet() {
  pendingBullet = null;
  renderBullets();
}

let isEditingPending = false;

function editPendingBullet() {
  isEditingPending = true;
  renderBullets();
}

function savePendingEdit(newText) {
  if (pendingBullet && newText.trim()) {
    pendingBullet.text = newText.trim();
  }
  isEditingPending = false;
  renderBullets();
}

function cancelPendingEdit() {
  isEditingPending = false;
  renderBullets();
}

function deleteBullet(bulletText) {
  const index = allBullets.findIndex(b => b.text === bulletText);
  if (index !== -1) {
    allBullets.splice(index, 1);
    renderBullets();
  }
}

function addSkill(skill) {
  // Avoid duplicates
  if (!allSkills.some(s => s.name.toLowerCase() === skill.name.toLowerCase())) {
    allSkills.push(skill);
    renderSkills();
  }
}

function renderSkills() {
  const skillsSection = document.getElementById('skillsSection');
  if (!skillsSection) return;
  
  if (allSkills.length === 0) {
    skillsSection.classList.add('hidden');
    return;
  }
  
  skillsSection.classList.remove('hidden');
  
  // Group by category
  const categories = {
    technical: { label: '💻 Technical', skills: [] },
    tool: { label: '🔧 Tools', skills: [] },
    soft: { label: '🤝 Soft Skills', skills: [] },
    methodology: { label: '📋 Methodology', skills: [] }
  };
  
  for (const skill of allSkills) {
    const cat = categories[skill.category] || categories.technical;
    cat.skills.push(skill.name);
  }
  
  let html = '<h3 class="text-white font-medium mb-2">🎯 Skills Identified</h3>';
  
  for (const [key, cat] of Object.entries(categories)) {
    if (cat.skills.length > 0) {
      html += `
        <div class="mb-2">
          <p class="text-xs text-gray-400 mb-1">${cat.label}</p>
          <div class="flex flex-wrap gap-1">
            ${cat.skills.map(s => `
              <span class="bg-purple-600/30 text-purple-200 text-xs px-2 py-0.5 rounded cursor-pointer hover:bg-purple-600/50 skill-tag" data-skill="${s}">${s}</span>
            `).join('')}
          </div>
        </div>
      `;
    }
  }
  
  html += `<button id="copyAllSkills" class="mt-2 text-xs text-gray-400 hover:text-white">Copy all skills</button>`;
  
  skillsSection.innerHTML = html;
  
  // Add click handlers
  document.querySelectorAll('.skill-tag').forEach(tag => {
    tag.addEventListener('click', async () => {
      const skill = tag.dataset.skill;
      await navigator.clipboard.writeText(skill);
      tag.classList.add('bg-green-600/30');
      setTimeout(() => tag.classList.remove('bg-green-600/30'), 1000);
    });
  });
  
  document.getElementById('copyAllSkills')?.addEventListener('click', async () => {
    const allSkillsText = allSkills.map(s => s.name).join(', ');
    await navigator.clipboard.writeText(allSkillsText);
    const btn = document.getElementById('copyAllSkills');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy all skills', 1500);
  });
}

function renderBullets() {
  let html = '';
  
  // Show pending bullet at top if exists
  if (pendingBullet) {
    if (isEditingPending) {
      // Edit mode
      html += `
        <div class="bg-purple-900/50 border-2 border-purple-500 rounded-lg p-3 mb-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-purple-300 font-medium">✏️ Editing Bullet</span>
            <div class="flex gap-1">
              <button id="cancelEditBtn" class="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-300" title="Cancel edit">Cancel</button>
              <button id="saveEditBtn" class="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white" title="Save changes">✓ Done</button>
            </div>
          </div>
          <p class="font-medium text-white text-sm">${pendingBullet.company}</p>
          <p class="text-xs text-purple-300 mb-2">${pendingBullet.title}</p>
          <textarea id="editBulletText" class="w-full bg-gray-800 text-gray-200 text-sm p-2 rounded border border-purple-400 focus:outline-none focus:border-purple-300 resize-none" rows="3">${pendingBullet.text}</textarea>
        </div>
      `;
    } else {
      // View mode
      html += `
        <div class="bg-purple-900/50 border-2 border-purple-500 rounded-lg p-3 mb-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-purple-300 font-medium">✏️ Working Bullet</span>
            <div class="flex gap-1">
              <button id="discardPendingBtn" class="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-300" title="Discard">✕</button>
              <button id="editPendingBtn" class="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white" title="Edit bullet">✎ Edit</button>
              <button id="confirmPendingBtn" class="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white" title="Save bullet">✓ Save</button>
            </div>
          </div>
          <p class="font-medium text-white text-sm">${pendingBullet.company}</p>
          <p class="text-xs text-purple-300 mb-2">${pendingBullet.title}</p>
          <p class="text-sm text-gray-200">${pendingBullet.text}</p>
        </div>
      `;
    }
  }
  
  if (allBullets.length === 0 && !pendingBullet) {
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

  for (const group of Object.values(groups)) {
    html += `
      <div class="bg-gray-700 rounded-lg p-3">
        <p class="font-medium text-white text-sm">${group.company}</p>
        <p class="text-xs text-purple-300 mb-2">${group.title}</p>
        <ul class="space-y-2">
          ${group.bullets.map((b, i) => `
            <li class="text-sm text-gray-200 flex items-start gap-2 group">
              <span class="shrink-0" title="${b.isImported ? 'Imported from resume' : 'AI-extracted'}">${b.isImported ? '📄' : '✨'}</span>
              <span class="flex-1">${b.text}</span>
              <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  class="copy-bullet-btn text-gray-400 hover:text-white p-1" 
                  data-bullet-text="${b.text.replace(/"/g, '&quot;')}"
                  title="Copy bullet">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button 
                  class="delete-bullet-btn text-gray-400 hover:text-red-400 p-1" 
                  data-bullet-text="${b.text.replace(/"/g, '&quot;')}"
                  title="Delete bullet">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  bulletsList.innerHTML = html;
  if (allBullets.length > 0) {
    exportBulletsBtn.classList.remove('hidden');
  }
  
  // Add click handlers for pending bullet buttons
  document.getElementById('confirmPendingBtn')?.addEventListener('click', confirmPendingBullet);
  document.getElementById('discardPendingBtn')?.addEventListener('click', discardPendingBullet);
  document.getElementById('editPendingBtn')?.addEventListener('click', editPendingBullet);
  document.getElementById('cancelEditBtn')?.addEventListener('click', cancelPendingEdit);
  document.getElementById('saveEditBtn')?.addEventListener('click', () => {
    const textarea = document.getElementById('editBulletText');
    if (textarea) {
      savePendingEdit(textarea.value);
    }
  });
  
  // Focus the edit textarea if in edit mode
  if (isEditingPending) {
    const textarea = document.getElementById('editBulletText');
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }
  
  // Add click handlers for copy buttons
  document.querySelectorAll('.copy-bullet-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = btn.dataset.bulletText;
      try {
        await navigator.clipboard.writeText(text);
        // Show brief feedback
        const originalTitle = btn.title;
        btn.title = 'Copied!';
        btn.classList.add('text-green-400');
        setTimeout(() => {
          btn.title = originalTitle;
          btn.classList.remove('text-green-400');
        }, 1500);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  });
  
  // Add click handlers for delete buttons
  document.querySelectorAll('.delete-bullet-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.dataset.bulletText;
      deleteBullet(text);
    });
  });
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
      text += `${b.isImported ? '📄 ' : '✨ '}${b.text}\n`;
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
