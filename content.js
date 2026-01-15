// ChatGPT Bulk Delete - Content Script v2.3
// Real-time progress updates for lifetime operations

(function () {
    'use strict';

    let selectedChats = new Map();
    let checkboxesVisible = false;
    let isProcessing = false;

    const CHAT_ITEM_SELECTOR = 'a[href^="/c/"]';
    const SIDEBAR_SELECTOR = 'nav';

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function getConversationIdFromElement(element) {
        const href = element.getAttribute('href');
        if (href && href.startsWith('/c/')) {
            return href.replace('/c/', '').split('?')[0];
        }
        return null;
    }

    async function getAccessToken() {
        try {
            const response = await fetch('https://chatgpt.com/api/auth/session', {
                credentials: 'include'
            });
            const data = await response.json();
            return data.accessToken || null;
        } catch (error) {
            console.error('[BulkDelete] Failed to get access token:', error);
            return null;
        }
    }

    // ===========================================
    // FETCH ALL CONVERSATIONS
    // ===========================================

    async function fetchAllConversations(accessToken) {
        let allConversations = [];
        let offset = 0;
        const limit = 28;
        let hasMore = true;

        console.log('[BulkDelete] Starting to fetch all conversations...');

        while (hasMore) {
            try {
                const url = `https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated`;

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    console.error('[BulkDelete] API error:', response.status);
                    break;
                }

                const data = await response.json();

                let items = [];
                if (Array.isArray(data)) {
                    items = data;
                } else if (data.items && Array.isArray(data.items)) {
                    items = data.items;
                }

                if (items.length === 0) {
                    hasMore = false;
                    break;
                }

                allConversations = allConversations.concat(items);
                console.log('[BulkDelete] Fetched:', allConversations.length, 'conversations');

                if (data.has_more === false || items.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }

                await wait(200);
            } catch (error) {
                console.error('[BulkDelete] Error fetching:', error);
                hasMore = false;
            }
        }

        return allConversations;
    }

    // ===========================================
    // CHECKBOX MANAGEMENT
    // ===========================================

    function addCheckboxes() {
        const chatItems = document.querySelectorAll(CHAT_ITEM_SELECTOR);
        let count = 0;

        chatItems.forEach((item) => {
            if (item.querySelector('.bulk-delete-checkbox')) return;

            const conversationId = getConversationIdFromElement(item);
            if (!conversationId) return;

            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'bulk-delete-checkbox-wrapper';
            checkboxWrapper.style.cssText = `
                position: absolute;
                left: 4px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 100;
                display: flex;
                align-items: center;
            `;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bulk-delete-checkbox';
            checkbox.dataset.conversationId = conversationId;
            checkbox.style.cssText = `
                width: 16px;
                height: 16px;
                cursor: pointer;
                accent-color: #7c4dff;
                margin: 0;
            `;

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                if (checkbox.checked) {
                    selectedChats.set(conversationId, item);
                    item.style.backgroundColor = 'rgba(124, 77, 255, 0.15)';
                } else {
                    selectedChats.delete(conversationId);
                    item.style.backgroundColor = '';
                }
            });

            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });

            checkboxWrapper.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });

            item.style.position = 'relative';
            item.style.paddingLeft = '28px';

            checkboxWrapper.appendChild(checkbox);
            item.insertBefore(checkboxWrapper, item.firstChild);
            count++;
        });

        checkboxesVisible = true;
        return { success: true, count };
    }

    function removeCheckboxes() {
        const checkboxes = document.querySelectorAll('.bulk-delete-checkbox-wrapper');
        checkboxes.forEach(wrapper => {
            const item = wrapper.parentElement;
            if (item) {
                item.style.paddingLeft = '';
                item.style.backgroundColor = '';
            }
            wrapper.remove();
        });

        selectedChats.clear();
        checkboxesVisible = false;
        return { success: true };
    }

    function toggleAllCheckboxes() {
        const checkboxes = document.querySelectorAll('.bulk-delete-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);

        checkboxes.forEach(checkbox => {
            const conversationId = checkbox.dataset.conversationId;
            const item = checkbox.closest('a');

            if (allChecked) {
                checkbox.checked = false;
                selectedChats.delete(conversationId);
                if (item) item.style.backgroundColor = '';
            } else {
                checkbox.checked = true;
                if (item) {
                    selectedChats.set(conversationId, item);
                    item.style.backgroundColor = 'rgba(124, 77, 255, 0.15)';
                }
            }
        });

        return { selected: selectedChats.size };
    }

    function getSelectedCount() {
        return { count: selectedChats.size };
    }

    // ===========================================
    // API OPERATIONS
    // ===========================================

    async function archiveConversation(conversationId, accessToken) {
        try {
            const response = await fetch(`https://chatgpt.com/backend-api/conversation/${conversationId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                credentials: 'include',
                body: JSON.stringify({ is_archived: true })
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async function deleteConversation(conversationId, accessToken) {
        try {
            const response = await fetch(`https://chatgpt.com/backend-api/conversation/${conversationId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                credentials: 'include',
                body: JSON.stringify({ is_visible: false })
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // ===========================================
    // BULK OPERATIONS (Selected Chats)
    // ===========================================

    async function bulkArchive() {
        if (isProcessing) return { error: 'Already processing' };
        isProcessing = true;

        const accessToken = await getAccessToken();
        if (!accessToken) {
            isProcessing = false;
            return { success: 0, failed: selectedChats.size, total: selectedChats.size, processed: 0, error: 'Could not get access token' };
        }

        const conversations = Array.from(selectedChats.entries());
        let success = 0;
        let processed = 0;

        for (const [conversationId, element] of conversations) {
            const result = await archiveConversation(conversationId, accessToken);
            processed++;

            if (result) {
                success++;
                if (element && element.parentElement) {
                    element.parentElement.remove();
                }
                selectedChats.delete(conversationId);
            }
            await wait(300);
        }

        isProcessing = false;
        return { success, failed: conversations.length - success, total: conversations.length, processed };
    }

    async function bulkDelete() {
        if (isProcessing) return { error: 'Already processing' };
        isProcessing = true;

        const accessToken = await getAccessToken();
        if (!accessToken) {
            isProcessing = false;
            return { success: 0, failed: selectedChats.size, total: selectedChats.size, processed: 0, error: 'Could not get access token' };
        }

        const conversations = Array.from(selectedChats.entries());
        let success = 0;
        let processed = 0;

        for (const [conversationId, element] of conversations) {
            const result = await deleteConversation(conversationId, accessToken);
            processed++;

            if (result) {
                success++;
                if (element && element.parentElement) {
                    element.parentElement.remove();
                }
                selectedChats.delete(conversationId);
            }
            await wait(300);
        }

        isProcessing = false;
        return { success, failed: conversations.length - success, total: conversations.length, processed };
    }

    // ===========================================
    // LIFETIME OPERATIONS WITH PROGRESS CALLBACK
    // ===========================================

    async function deleteAllConversations(sendProgress) {
        if (isProcessing) return { error: 'Already processing' };
        isProcessing = true;

        const accessToken = await getAccessToken();
        if (!accessToken) {
            isProcessing = false;
            return { success: 0, failed: 0, total: 0, error: 'Could not get access token. Please refresh the page.' };
        }

        // Send initial progress
        if (sendProgress) sendProgress({ status: 'fetching', message: 'Fetching all conversations...' });

        const allConversations = await fetchAllConversations(accessToken);
        const total = allConversations.length;

        if (total === 0) {
            isProcessing = false;
            return { success: 0, failed: 0, total: 0, error: 'No conversations found' };
        }

        let success = 0;
        let processed = 0;

        for (const conversation of allConversations) {
            const conversationId = conversation.id;
            const result = await deleteConversation(conversationId, accessToken);
            processed++;

            if (result) success++;

            // Send progress update
            if (sendProgress) {
                sendProgress({
                    status: 'processing',
                    processed,
                    total,
                    success,
                    percent: Math.round((processed / total) * 100)
                });
            }

            await wait(200);
        }

        // Refresh the page
        if (success > 0) {
            if (sendProgress) sendProgress({ status: 'refreshing', success, total });
            setTimeout(() => window.location.reload(), 1500);
        }

        isProcessing = false;
        return { success, failed: total - success, total, processed };
    }

    async function archiveAllConversations(sendProgress) {
        if (isProcessing) return { error: 'Already processing' };
        isProcessing = true;

        const accessToken = await getAccessToken();
        if (!accessToken) {
            isProcessing = false;
            return { success: 0, failed: 0, total: 0, error: 'Could not get access token. Please refresh the page.' };
        }

        if (sendProgress) sendProgress({ status: 'fetching', message: 'Fetching all conversations...' });

        const allConversations = await fetchAllConversations(accessToken);
        const total = allConversations.length;

        if (total === 0) {
            isProcessing = false;
            return { success: 0, failed: 0, total: 0, error: 'No conversations found' };
        }

        let success = 0;
        let processed = 0;

        for (const conversation of allConversations) {
            const conversationId = conversation.id;
            const result = await archiveConversation(conversationId, accessToken);
            processed++;

            if (result) success++;

            if (sendProgress) {
                sendProgress({
                    status: 'processing',
                    processed,
                    total,
                    success,
                    percent: Math.round((processed / total) * 100)
                });
            }

            await wait(200);
        }

        if (success > 0) {
            if (sendProgress) sendProgress({ status: 'refreshing', success, total });
            setTimeout(() => window.location.reload(), 1500);
        }

        isProcessing = false;
        return { success, failed: total - success, total, processed };
    }

    // ===========================================
    // MESSAGE LISTENER WITH LONG-LIVED CONNECTION
    // ===========================================

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('[BulkDelete] Received:', request.action);

        switch (request.action) {
            case 'addCheckboxes':
                sendResponse(addCheckboxes());
                break;
            case 'removeCheckboxes':
                sendResponse(removeCheckboxes());
                break;
            case 'toggleAll':
                sendResponse(toggleAllCheckboxes());
                break;
            case 'getSelectedCount':
                sendResponse(getSelectedCount());
                break;
            case 'bulkArchive':
                bulkArchive().then(sendResponse);
                return true;
            case 'bulkDelete':
                bulkDelete().then(sendResponse);
                return true;
            case 'deleteAll':
                deleteAllConversations(null).then(sendResponse);
                return true;
            case 'archiveAll':
                archiveAllConversations(null).then(sendResponse);
                return true;
            default:
                sendResponse({ error: 'Unknown action' });
        }
    });

    // Long-lived connection for progress updates
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'lifetime-operation') {
            port.onMessage.addListener(async (msg) => {
                const sendProgress = (data) => {
                    try {
                        port.postMessage(data);
                    } catch (e) {
                        console.log('[BulkDelete] Port closed');
                    }
                };

                if (msg.action === 'deleteAll') {
                    const result = await deleteAllConversations(sendProgress);
                    sendProgress({ status: 'complete', ...result });
                } else if (msg.action === 'archiveAll') {
                    const result = await archiveAllConversations(sendProgress);
                    sendProgress({ status: 'complete', ...result });
                }
            });
        }
    });

    // ===========================================
    // MUTATION OBSERVER & STYLES
    // ===========================================

    function setupObserver() {
        const nav = document.querySelector(SIDEBAR_SELECTOR);
        if (!nav) return;

        const observer = new MutationObserver(() => {
            if (checkboxesVisible) {
                setTimeout(() => addCheckboxes(), 500);
            }
        });

        observer.observe(nav, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupObserver);
    } else {
        setupObserver();
    }

    const style = document.createElement('style');
    style.textContent = `
        .bulk-delete-checkbox:focus {
            outline: 2px solid #7c4dff;
            outline-offset: 2px;
        }
        .bulk-delete-checkbox-wrapper:hover {
            background: rgba(124, 77, 255, 0.1);
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);

    console.log('[BulkDelete] ChatGPT Bulk Delete v2.3 loaded - with real-time progress');
})();
