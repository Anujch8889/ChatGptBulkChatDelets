// ChatGPT Bulk Delete - Claude-style Chat Manager v3.1.0
// Optimized for 1,000 - 10,000+ chats with incremental rendering & job resume

document.addEventListener('DOMContentLoaded', async () => {
  const totalBadge = document.getElementById('totalBadge');
  const refreshBtn = document.getElementById('refreshBtn');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const selectedCountText = document.getElementById('selectedCountText');
  const statusBanner = document.getElementById('statusBanner');
  const statusMessage = document.getElementById('statusMessage');
  const stopJobBtn = document.getElementById('stopJobBtn');
  const progressBarWrap = document.getElementById('progressBarWrap');
  const progressFill = document.getElementById('progressFill');
  const chatListEl = document.getElementById('chatList');

  const confirmBar = document.getElementById('confirmBar');
  const confirmText = document.getElementById('confirmText');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmYesBtn = document.getElementById('confirmYesBtn');

  const archiveBtn = document.getElementById('archiveBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const archiveCountEl = document.getElementById('archiveCount');
  const deleteCountEl = document.getElementById('deleteCount');

  const RENDER_CHUNK_SIZE = 150;

  let allChats = [];
  let filteredChats = [];
  let renderedCount = 0;
  let selectedIds = new Set();
  let isBusy = false;
  let pendingAction = null;
  let activeTabId = null;
  let searchDebounce = null;
  let resumeTimer = null;

  function isChatGptUrl(url) {
    return Boolean(url && (url.includes('chatgpt.com') || url.includes('chat.openai.com')));
  }

  function showBanner(text, type = '', showProgress = false, percent = 0, showStop = false) {
    statusBanner.style.display = 'flex';
    statusBanner.className = `status-banner ${type}`;
    statusMessage.textContent = text;
    progressBarWrap.style.display = showProgress ? 'block' : 'none';
    progressFill.style.width = `${percent}%`;
    stopJobBtn.style.display = showStop ? 'inline-block' : 'none';
  }

  function hideBanner() {
    statusBanner.style.display = 'none';
    stopJobBtn.style.display = 'none';
  }

  function formatDate(isoOrTimestamp) {
    if (!isoOrTimestamp) return '';
    const date = typeof isoOrTimestamp === 'number'
      ? new Date(isoOrTimestamp * 1000)
      : new Date(isoOrTimestamp);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function updateFilteredChats() {
    const query = searchInput.value.trim().toLowerCase();
    filteredChats = query
      ? allChats.filter(c => (c.title || '').toLowerCase().includes(query))
      : allChats;
  }

  function updateSelectionUI() {
    const count = selectedIds.size;
    selectedCountText.textContent = `${count} selected`;
    selectedCountText.classList.toggle('active', count > 0);
    archiveCountEl.textContent = count;
    deleteCountEl.textContent = count;

    archiveBtn.disabled = isBusy || count === 0;
    deleteBtn.disabled = isBusy || count === 0;

    if (filteredChats.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else {
      let selectedInView = 0;
      for (let i = 0; i < filteredChats.length; i++) {
        if (selectedIds.has(filteredChats[i].id)) selectedInView++;
      }
      selectAllCheckbox.checked = selectedInView === filteredChats.length;
      selectAllCheckbox.indeterminate = selectedInView > 0 && selectedInView < filteredChats.length;
    }
  }

  function createRowElement(chat) {
    const row = document.createElement('div');
    const isSelected = selectedIds.has(chat.id);
    row.className = `chat-row${isSelected ? ' selected' : ''}`;
    row.dataset.id = chat.id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'custom-checkbox';
    cb.checked = isSelected;

    const info = document.createElement('div');
    info.className = 'chat-info';

    const title = document.createElement('span');
    title.className = 'chat-title';
    title.textContent = chat.title || 'New chat';

    const date = document.createElement('span');
    date.className = 'chat-date';
    date.textContent = formatDate(chat.update_time);

    info.appendChild(title);
    info.appendChild(date);
    row.appendChild(cb);
    row.appendChild(info);
    return row;
  }

  function appendNextChunk() {
    if (renderedCount >= filteredChats.length) return;
    const end = Math.min(renderedCount + RENDER_CHUNK_SIZE, filteredChats.length);
    const fragment = document.createDocumentFragment();
    for (let i = renderedCount; i < end; i++) {
      fragment.appendChild(createRowElement(filteredChats[i]));
    }
    chatListEl.appendChild(fragment);
    renderedCount = end;
  }

  function renderChats(resetScroll = true) {
    updateFilteredChats();
    totalBadge.textContent = allChats.length;
    renderedCount = 0;

    if (filteredChats.length === 0) {
      const msg = allChats.length === 0
        ? 'No conversations found.'
        : 'No chats match your search.';
      chatListEl.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
      updateSelectionUI();
      return;
    }

    chatListEl.innerHTML = '';
    if (resetScroll) chatListEl.scrollTop = 0;
    appendNextChunk();
    updateSelectionUI();
  }

  function syncVisibleRowsSelection() {
    const rows = chatListEl.querySelectorAll('.chat-row');
    rows.forEach(row => {
      const id = row.dataset.id;
      const checked = selectedIds.has(id);
      row.classList.toggle('selected', checked);
      const cb = row.querySelector('.custom-checkbox');
      if (cb) cb.checked = checked;
    });
    updateSelectionUI();
  }

  function setBusy(busy) {
    isBusy = busy;
    refreshBtn.disabled = busy;
    selectAllCheckbox.disabled = busy;
    searchInput.disabled = busy;
    updateSelectionUI();
  }

  async function ensureContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
    } catch (e) {
      // Already injected or restricted
    }
  }

  function runPortAction(action, payload = {}) {
    return new Promise((resolve) => {
      const port = chrome.tabs.connect(activeTabId, { name: 'bulk-delete-port' });

      port.onMessage.addListener((msg) => {
        if (msg.status === 'fetching') {
          showBanner(msg.message, '', true, 25, true);
        } else if (msg.status === 'processing') {
          showBanner(msg.message, '', true, msg.percent, true);
        } else if (msg.status === 'complete') {
          try {
            port.disconnect();
          } catch (e) { }
          resolve(msg);
        }
      });

      port.onDisconnect.addListener(() => {
        resolve({ error: 'Disconnected from ChatGPT tab. Please refresh the page.' });
      });

      port.postMessage({ action, ...payload });
    });
  }

  async function loadAllChats() {
    setBusy(true);
    confirmBar.style.display = 'none';
    chatListEl.innerHTML = `
      <div class="empty-state">
        <div class="spinner"></div>
        <p>Fetching all chats...</p>
      </div>
    `;
    showBanner('Connecting to ChatGPT...', '', true, 10, true);

    await ensureContentScript(activeTabId);
    const result = await runPortAction('fetchAll');

    setBusy(false);

    if (result.cancelled) {
      allChats = result.conversations || [];
      selectedIds.clear();
      showBanner(`Stopped. Loaded ${allChats.length} chats.`, '', false);
      renderChats();
      return;
    }

    if (result.error) {
      showBanner(result.error, 'error', false);
      chatListEl.innerHTML = `<div class="empty-state"><p>${result.error}</p></div>`;
      return;
    }

    allChats = result.conversations || [];
    selectedIds.clear();
    hideBanner();
    renderChats();
  }

  async function resumeRunningJobIfAny() {
    try {
      await ensureContentScript(activeTabId);
      const state = await chrome.tabs.sendMessage(activeTabId, { action: 'getJobState' });
      if (!state || !state.active) return false;

      setBusy(true);
      showBanner(state.message || 'Operation in progress...', '', true, state.percent || 0, true);

      resumeTimer = setInterval(async () => {
        try {
          const s = await chrome.tabs.sendMessage(activeTabId, { action: 'getJobState' });
          if (!s) return;
          if (s.active) {
            showBanner(s.message || 'Processing...', '', true, s.percent || 0, true);
          } else {
            clearInterval(resumeTimer);
            resumeTimer = null;
            setBusy(false);
            await loadAllChats();
          }
        } catch (e) {
          clearInterval(resumeTimer);
          resumeTimer = null;
          setBusy(false);
        }
      }, 600);

      return true;
    } catch (e) {
      return false;
    }
  }

  // Delegated click listener for fast 10k-row handling
  chatListEl.addEventListener('click', (e) => {
    if (isBusy) return;
    const row = e.target.closest('.chat-row');
    if (!row) return;

    const id = row.dataset.id;
    const cb = row.querySelector('.custom-checkbox');
    const nextState = e.target === cb ? cb.checked : !selectedIds.has(id);

    if (cb) cb.checked = nextState;
    if (nextState) {
      selectedIds.add(id);
      row.classList.add('selected');
    } else {
      selectedIds.delete(id);
      row.classList.remove('selected');
    }
    updateSelectionUI();
  });

  // Incremental rendering on scroll
  chatListEl.addEventListener('scroll', () => {
    if (chatListEl.scrollTop + chatListEl.clientHeight >= chatListEl.scrollHeight - 120) {
      appendNextChunk();
    }
  });

  stopJobBtn.addEventListener('click', async () => {
    if (!activeTabId) return;
    stopJobBtn.disabled = true;
    stopJobBtn.textContent = 'Stopping...';
    try {
      await chrome.tabs.sendMessage(activeTabId, { action: 'cancelJob' });
    } catch (e) { }
  });

  refreshBtn.addEventListener('click', () => {
    if (!isBusy && activeTabId) loadAllChats();
  });

  searchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => renderChats(), 120);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    renderChats();
  });

  selectAllCheckbox.addEventListener('change', () => {
    if (isBusy) return;
    if (selectAllCheckbox.checked) {
      for (let i = 0; i < filteredChats.length; i++) {
        selectedIds.add(filteredChats[i].id);
      }
    } else {
      for (let i = 0; i < filteredChats.length; i++) {
        selectedIds.delete(filteredChats[i].id);
      }
    }
    syncVisibleRowsSelection();
  });

  function showConfirm(action) {
    const count = selectedIds.size;
    if (count === 0) return;
    pendingAction = action;
    if (action === 'deleteSelected') {
      confirmText.textContent = `Permanently delete ${count} chat${count > 1 ? 's' : ''}?`;
      confirmYesBtn.textContent = 'Yes, Delete';
    } else {
      confirmText.textContent = `Archive ${count} chat${count > 1 ? 's' : ''}?`;
      confirmYesBtn.textContent = 'Yes, Archive';
    }
    confirmBar.style.display = 'flex';
  }

  archiveBtn.addEventListener('click', () => showConfirm('archiveSelected'));
  deleteBtn.addEventListener('click', () => showConfirm('deleteSelected'));

  confirmCancelBtn.addEventListener('click', () => {
    pendingAction = null;
    confirmBar.style.display = 'none';
  });

  confirmYesBtn.addEventListener('click', async () => {
    if (!pendingAction || isBusy) return;
    const action = pendingAction;
    const ids = Array.from(selectedIds);
    pendingAction = null;
    confirmBar.style.display = 'none';

    stopJobBtn.disabled = false;
    stopJobBtn.textContent = 'Stop';
    setBusy(true);
    showBanner(`Starting (${ids.length} chats)...`, '', true, 0, true);

    const result = await runPortAction(action, { ids });
    setBusy(false);

    if (result.error) {
      showBanner(result.error, 'error', false);
      return;
    }

    const removedSet = new Set(result.succeededIds || []);
    allChats = allChats.filter(c => !removedSet.has(c.id));
    removedSet.forEach(id => selectedIds.delete(id));

    const verb = action === 'archiveSelected' ? 'Archived' : 'Deleted';
    if (result.cancelled) {
      showBanner(`Stopped. ${verb} ${result.success}/${result.total} chats.`, '', false);
    } else {
      const failNote = result.failed > 0 ? ` (${result.failed} failed)` : '';
      showBanner(`${verb} ${result.success}/${result.total} chats${failNote}`, result.success > 0 ? 'success' : 'error', false);
    }
    renderChats(false);
  });

  // Init
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isChatGptUrl(tab.url)) {
    chatListEl.innerHTML = `
      <div class="empty-state">
        <p>Open ChatGPT to view and delete your chats.</p>
        <button id="openChatGptBtn" class="btn btn-danger btn-sm">Open ChatGPT</button>
      </div>
    `;
    document.getElementById('openChatGptBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://chatgpt.com/' });
    });
    refreshBtn.disabled = true;
    selectAllCheckbox.disabled = true;
    searchInput.disabled = true;
    return;
  }

  activeTabId = tab.id;
  const isResuming = await resumeRunningJobIfAny();
  if (!isResuming) {
    await loadAllChats();
  }
});
