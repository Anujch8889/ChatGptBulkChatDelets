document.addEventListener('DOMContentLoaded', () => {
  const selectAllBtn = document.getElementById('selectAll');
  const deselectAllBtn = document.getElementById('deselectAll');
  const deleteSelectedBtn = document.getElementById('deleteSelected');
  const statusDiv = document.getElementById('status');
  const progressContainer = document.getElementById('progress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  function updateStatus(message, type = '') {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
  }

  async function sendMessage(action) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('chat.openai.com') && !tab.url.includes('chatgpt.com')) {
        updateStatus('Please open ChatGPT first!', 'error');
        return null;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action });
      return response;
    } catch (error) {
      updateStatus('Error: Refresh ChatGPT page', 'error');
      return null;
    }
  }

  selectAllBtn.addEventListener('click', async () => {
    updateStatus('Selecting all chats...', 'info');
    const response = await sendMessage('selectAll');
    if (response) {
      updateStatus(`Selected ${response.count} chats`, 'success');
    }
  });

  deselectAllBtn.addEventListener('click', async () => {
    updateStatus('Deselecting all...', 'info');
    const response = await sendMessage('deselectAll');
    if (response) {
      updateStatus('All deselected', 'success');
    }
  });

  deleteSelectedBtn.addEventListener('click', async () => {
    const response = await sendMessage('getSelectedCount');
    
    if (!response || response.count === 0) {
      updateStatus('No chats selected!', 'error');
      return;
    }

    if (!confirm(`Delete ${response.count} chats? This cannot be undone!`)) {
      return;
    }

    updateStatus('Deleting...', 'info');
    progressContainer.style.display = 'block';
    
    // Disable buttons during deletion
    selectAllBtn.disabled = true;
    deselectAllBtn.disabled = true;
    deleteSelectedBtn.disabled = true;

    const deleteResponse = await sendMessage('deleteSelected');
    
    if (deleteResponse) {
      progressFill.style.width = '100%';
      progressText.textContent = `Deleted ${deleteResponse.deleted} chats`;
      updateStatus(`Successfully deleted ${deleteResponse.deleted} chats!`, 'success');
    }

    // Re-enable buttons
    selectAllBtn.disabled = false;
    deselectAllBtn.disabled = false;
    deleteSelectedBtn.disabled = false;
  });

  // Initial status
  updateStatus('Ready! Select chats to delete', 'info');
});
