// ChatGPT Bulk Delete - Popup Script
document.addEventListener('DOMContentLoaded', () => {
  const addCheckboxesBtn = document.getElementById('addCheckboxes');
  const removeCheckboxesBtn = document.getElementById('removeCheckboxes');
  const toggleAllBtn = document.getElementById('toggleAll');
  const bulkArchiveBtn = document.getElementById('bulkArchive');
  const bulkDeleteBtn = document.getElementById('bulkDelete');
  const statusDiv = document.getElementById('status');
  const progressContainer = document.getElementById('progress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  function updateStatus(message, type = '') {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
  }

  function updateProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    progressFill.style.width = percent + '%';
    progressText.textContent = `${current}/${total} (${percent}%)`;
  }

  function setButtonsDisabled(disabled) {
    addCheckboxesBtn.disabled = disabled;
    removeCheckboxesBtn.disabled = disabled;
    toggleAllBtn.disabled = disabled;
    bulkArchiveBtn.disabled = disabled;
    bulkDeleteBtn.disabled = disabled;
  }

  async function sendMessage(action, data = {}) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url.includes('chat.openai.com') && !tab.url.includes('chatgpt.com')) {
        updateStatus('⚠️ Please open ChatGPT first!', 'error');
        return null;
      }

      // Inject the content script if needed
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (e) {
        // Script already injected or error
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
      return response;
    } catch (error) {
      console.error('Error:', error);
      updateStatus('⚠️ Error: Refresh the ChatGPT page', 'error');
      return null;
    }
  }

  // Add Checkboxes
  addCheckboxesBtn.addEventListener('click', async () => {
    updateStatus('Adding checkboxes...', 'info');
    const response = await sendMessage('addCheckboxes');
    if (response && response.success) {
      updateStatus(`✅ Added ${response.count} checkboxes`, 'success');
    } else if (response && response.error) {
      updateStatus(`⚠️ ${response.error}`, 'error');
    }
  });

  // Remove Checkboxes
  removeCheckboxesBtn.addEventListener('click', async () => {
    updateStatus('Removing checkboxes...', 'info');
    const response = await sendMessage('removeCheckboxes');
    if (response && response.success) {
      updateStatus('✅ Checkboxes removed', 'success');
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

  // Bulk Archive
  bulkArchiveBtn.addEventListener('click', async () => {
    const countResponse = await sendMessage('getSelectedCount');

    if (!countResponse || countResponse.count === 0) {
      updateStatus('⚠️ No chats selected!', 'error');
      return;
    }

    if (!confirm(`Archive ${countResponse.count} chats? They will be moved to archive.`)) {
      return;
    }

    updateStatus(`Archiving ${countResponse.count} chats...`, 'info');
    progressContainer.style.display = 'block';
    updateProgress(0, countResponse.count);
    setButtonsDisabled(true);

    const response = await sendMessage('bulkArchive');

    if (response) {
      updateProgress(response.processed, response.total);
      if (response.success > 0) {
        updateStatus(`✅ Archived ${response.success} chats!`, 'success');
      } else {
        updateStatus(`⚠️ Archive failed. Please try again.`, 'error');
      }
    } else {
      updateStatus('⚠️ Archive failed', 'error');
    }

    setButtonsDisabled(false);
  });

  // Bulk Delete
  bulkDeleteBtn.addEventListener('click', async () => {
    const countResponse = await sendMessage('getSelectedCount');

    if (!countResponse || countResponse.count === 0) {
      updateStatus('⚠️ No chats selected!', 'error');
      return;
    }

    if (!confirm(`DELETE ${countResponse.count} chats permanently?\n\nThis cannot be undone!`)) {
      return;
    }

    updateStatus(`Deleting ${countResponse.count} chats...`, 'warning');
    progressContainer.style.display = 'block';
    updateProgress(0, countResponse.count);
    setButtonsDisabled(true);

    const response = await sendMessage('bulkDelete');

    if (response) {
      updateProgress(response.processed, response.total);
      if (response.success > 0) {
        updateStatus(`✅ Deleted ${response.success} chats!`, 'success');
      } else {
        updateStatus(`⚠️ Delete failed. Please try again.`, 'error');
      }
    } else {
      updateStatus('⚠️ Delete failed', 'error');
    }

    setButtonsDisabled(false);
  });

  // Initial status
  updateStatus('Click "Add Checkboxes" to start', 'info');
});
