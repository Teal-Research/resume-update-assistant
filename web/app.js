// Resume Update Assistant - Frontend

const messagesEl = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingEl = document.getElementById('typing');
const statusEl = document.getElementById('status');

let isStreaming = false;

// Add a message to the chat
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
  
  // Scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
  
  return bubble;
}

// Format message content (basic markdown support)
function formatMessage(content) {
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// Show/hide typing indicator
function setTyping(show) {
  typingEl.classList.toggle('hidden', !show);
  if (show) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

// Set UI state
function setLoading(loading) {
  isStreaming = loading;
  sendBtn.disabled = loading;
  messageInput.disabled = loading;
  statusEl.textContent = loading ? 'AI is responding...' : 'Ready to chat';
}

// Send message to API
async function sendMessage(message) {
  // Add user message to chat
  addMessage(message, 'user');
  
  setLoading(true);
  setTyping(true);
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    // Create assistant message bubble
    const assistantBubble = addMessage('', 'assistant');
    setTyping(false);
    
    // Read the stream
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
            } else if (data.type === 'error') {
              assistantBubble.innerHTML = `<span class="text-red-300">Error: ${data.error}</span>`;
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

  } catch (error) {
    console.error('Chat error:', error);
    setTyping(false);
    addMessage('Sorry, there was an error. Please try again.', 'assistant');
  } finally {
    setLoading(false);
  }
}

// Handle form submission
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const message = messageInput.value.trim();
  if (!message || isStreaming) return;
  
  messageInput.value = '';
  sendMessage(message);
});

// Handle Enter key
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

// Focus input on load
messageInput.focus();
