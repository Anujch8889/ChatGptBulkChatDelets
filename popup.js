// ChatGPT Bulk Delete - Popup Script v2.3
// Real-time progress updates using port connection

document.addEventListener('DOMContentLoaded', () => {
  const addCheckboxesBtn = document.getElementById('addCheckboxes');
  const removeCheckboxesBtn = document.getElementById('removeCheckboxes');
  const toggleAllBtn = document.getElementById('toggleAll');
  const bulkArchiveBtn = document.getElementById('bulkArchive');
  const bulkDeleteBtn = document.getElementById('bulkDelete');
  const archiveAllBtn = document.getElementById('archiveAll');
  const deleteAllBtn = document.getElementById('deleteAll');
  const statusDiv = document.getElementById('status');
  const progressContainer = document.getElementById('progress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  function updateStatus(message, type = '') {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
  }

  function updateProgress(current, total, percent) {
    progressContainer.style.display = 'block';
    if (total === 0) {
      progressFill.style.width = '0%';
      progressText.textContent = 'Fetching...';
      return;
    }
    progressFill.style.width = percent + '%';
    progressText.textContent = `${current}/${total} (${percent}%)`;
  }

  function setButtonsDisabled(disabled) {
    addCheckboxesBtn.disabled = disabled;
    removeCheckboxesBtn.disabled = disabled;
    toggleAllBtn.disabled = disabled;
    bulkArchiveBtn.disabled = disabled;
    bulkDeleteBtn.disabled = disabled;
    archiveAllBtn.disabled = disabled;
    deleteAllBtn.disabled = disabled;
  }

  async function sendMessage(action, data = {}) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url.includes('chat.openai.com') && !tab.url.includes('chatgpt.com')) {
        updateStatus('⚠️ Please open ChatGPT first!', 'error');
        return null;
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (e) { }

      const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
      return response;
    } catch (error) {
      console.error('Error:', error);
      updateStatus('⚠️ Error: ' + error.message, 'error');
      return null;
    }
  }

  // Long-lived connection for progress updates
  async function sendWithProgress(action) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('chatgpt.com') && !tab.url.includes('chat.openai.com')) {
      updateStatus('⚠️ Please open ChatGPT first!', 'error');
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) { }

    return new Promise((resolve) => {
      const port = chrome.tabs.connect(tab.id, { name: 'lifetime-operation' });

      port.onMessage.addListener((msg) => {
        console.log('Progress update:', msg);

        if (msg.status === 'fetching') {
          updateStatus('📋 ' + msg.message, 'info');
          updateProgress(0, 0, 0);
        } else if (msg.status === 'processing') {
          updateStatus(`🔄 Processing ${msg.processed}/${msg.total}...`, 'warning');
          updateProgress(msg.processed, msg.total, msg.percent);
        } else if (msg.status === 'refreshing') {
          updateStatus(`✅ Done! ${msg.success}/${msg.total} completed. Refreshing...`, 'success');
          updateProgress(msg.total, msg.total, 100);
        } else if (msg.status === 'complete') {
          if (msg.error) {
            updateStatus(`⚠️ Error: ${msg.error}`, 'error');
          } else {
            updateStatus(`✅ Completed: ${msg.success}/${msg.total} successful`, 'success');
          }
          updateProgress(msg.processed || msg.total, msg.total, 100);
          setButtonsDisabled(false);
          port.disconnect();
          resolve(msg);
        }
      });

      port.onDisconnect.addListener(() => {
        console.log('Port disconnected');
      });

      port.postMessage({ action: action });
    });
  }

  // Add Checkboxes
  addCheckboxesBtn.addEventListener('click', async () => {
    updateStatus('Adding checkboxes...', 'info');

    // Check if on ChatGPT
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes('chatgpt.com') && !tab.url.includes('chat.openai.com')) {
      chrome.tabs.create({ url: 'https://chatgpt.com/' });
      return;
    }

    const response = await sendMessage('addCheckboxes');
    if (response && response.success) {
      updateStatus(`✅ Added ${response.count} checkboxes`, 'success');
    } else if (response && response.error) {
      updateStatus(`⚠️ ${response.error}`, 'error');
    }
  });

  // Remove Checkboxes / Clear Selection
  removeCheckboxesBtn.addEventListener('click', async () => {
    updateStatus('Refreshing page...', 'info');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.reload(tab.id);
    }
  });

  // Toggle All
  toggleAllBtn.addEventListener('click', async () => {
    updateStatus('Toggling all checkboxes...', 'info');
    const response = await sendMessage('toggleAll');
    if (response) {
      updateStatus(`✅ ${response.selected} chats selected`, 'success');
    }
  });

  // Bulk Archive (selected only)
  bulkArchiveBtn.addEventListener('click', async () => {
    const countResponse = await sendMessage('getSelectedCount');

    if (!countResponse || countResponse.count === 0) {
      updateStatus('⚠️ No chats selected!', 'error');
      return;
    }

    // Auto archive without confirmation popup
    updateStatus(`Archiving ${countResponse.count} chats...`, 'info');
    progressContainer.style.display = 'block';
    updateProgress(0, countResponse.count, 0);
    setButtonsDisabled(true);

    const response = await sendMessage('bulkArchive');

    if (response) {
      updateProgress(response.processed || response.total, response.total, 100);
      if (response.success > 0 || response.processed > 0) {
        updateStatus(`✅ Archived ${response.success || response.processed}/${response.total} chats!`, 'success');
      } else if (response.error) {
        updateStatus(`⚠️ Archive failed. ${response.error}`, 'error');
      } else {
        updateStatus(`✅ Archive completed!`, 'success');
      }
    } else {
      updateStatus(`⚠️ No response received`, 'error');
    }

    setButtonsDisabled(false);
  });

  // Bulk Delete (selected only)
  bulkDeleteBtn.addEventListener('click', async () => {
    const countResponse = await sendMessage('getSelectedCount');

    if (!countResponse || countResponse.count === 0) {
      updateStatus('⚠️ No chats selected!', 'error');
      return;
    }

    // Auto delete without confirmation popup
    updateStatus(`Deleting ${countResponse.count} chats...`, 'warning');
    progressContainer.style.display = 'block';
    updateProgress(0, countResponse.count, 0);
    setButtonsDisabled(true);

    const response = await sendMessage('bulkDelete');

    if (response) {
      updateProgress(response.processed || response.total, response.total, 100);
      if (response.success > 0 || response.processed > 0) {
        updateStatus(`✅ Deleted ${response.success || response.processed}/${response.total} chats!`, 'success');
      } else if (response.error) {
        updateStatus(`⚠️ Delete failed. ${response.error}`, 'error');
      } else {
        updateStatus(`✅ Delete completed!`, 'success');
      }
    } else {
      updateStatus(`⚠️ No response received`, 'error');
    }

    setButtonsDisabled(false);
  });

  // ============================================
  // LIFETIME OPERATIONS WITH REAL-TIME PROGRESS
  // ============================================

  // Archive ALL Chats
  archiveAllBtn.addEventListener('click', async () => {
    // First confirmation
    if (!confirm(`⚠️ ARCHIVE ALL CHATS?\n\nThis will archive your ENTIRE chat history!\n\nClick OK to continue, then type ARCHIVE to confirm.`)) {
      return;
    }

    // Double confirmation
    const confirmText = prompt(`To confirm archiving ALL chats, type "ARCHIVE" (all caps):`);
    if (confirmText !== 'ARCHIVE') {
      updateStatus('❌ Cancelled - confirmation text did not match', 'error');
      return;
    }

    progressContainer.style.display = 'block';
    updateProgress(0, 0, 0);
    setButtonsDisabled(true);
    updateStatus(`🗂️ Archiving ALL chats...`, 'warning');

    await sendWithProgress('archiveAll');
  });

  // Delete ALL Chats
  deleteAllBtn.addEventListener('click', async () => {
    // First confirmation
    if (!confirm(`🚨 DELETE ALL CHATS PERMANENTLY?\n\n⚠️ THIS CANNOT BE UNDONE!\n\nYour ENTIRE chat history will be deleted forever!\n\nClick OK to continue, then type DELETE to confirm.`)) {
      return;
    }

    // Double confirmation
    const confirmText = prompt(`⚠️ FINAL WARNING!\n\nTo permanently delete ALL chats, type "DELETE" (all caps):`);
    if (confirmText !== 'DELETE') {
      updateStatus('❌ Cancelled - confirmation text did not match', 'error');
      return;
    }

    progressContainer.style.display = 'block';
    updateProgress(0, 0, 0);
    setButtonsDisabled(true);
    updateStatus(`🗑️ Deleting ALL chats...`, 'warning');

    await sendWithProgress('deleteAll');
  });

  // Initial status
  updateStatus('Click "Add Checkboxes" to start', 'info');
});
