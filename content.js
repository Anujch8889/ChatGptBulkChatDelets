// ChatGPT Bulk Delete - Content Script v2.0
// Uses ChatGPT API for reliable delete/archive operations

(function () {
    'use strict';

    let selectedChats = new Map(); // Map of conversationId -> chatElement
    let checkboxesVisible = false;

    // ===========================================
    // SELECTORS - Updated for current ChatGPT DOM
    // ===========================================

    // Chat items are links that start with /c/ (conversation links)
    const CHAT_ITEM_SELECTOR = 'a[href^="/c/"]';

    // The sidebar nav container
    const SIDEBAR_SELECTOR = 'nav';

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================

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

    function getAccessToken() {
        // Try to get the access token from the page
        return new Promise((resolve) => {
            // Method 1: Try to get from session storage or cookies
            const cookies = document.cookie;

            // Method 2: Fetch from the session endpoint
            fetch('https://chatgpt.com/api/auth/session', {
                credentials: 'include'
            })
                .then(res => res.json())
                .then(data => {
                    if (data.accessToken) {
                        resolve(data.accessToken);
                    } else {
                        resolve(null);
                    }
                })
                .catch(() => resolve(null));
        });
    }

    // ===========================================
    // CHECKBOX MANAGEMENT
    // ===========================================

    function addCheckboxes() {
        const chatItems = document.querySelectorAll(CHAT_ITEM_SELECTOR);
        let count = 0;

        chatItems.forEach((item) => {
            // Skip if already has checkbox
            if (item.querySelector('.bulk-delete-checkbox')) return;

            const conversationId = getConversationIdFromElement(item);
            if (!conversationId) return;

            // Create checkbox container
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

            // Create checkbox
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

            // Handle checkbox change
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

            // Prevent click from navigating
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });

            checkboxWrapper.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });

            // Add padding to chat item for checkbox
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
                // Uncheck all
                checkbox.checked = false;
                selectedChats.delete(conversationId);
                if (item) item.style.backgroundColor = '';
            } else {
                // Check all
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
            console.error('Archive error:', error);
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
            console.error('Delete error:', error);
            return false;
        }
    }

    async function bulkArchive() {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            return { success: 0, failed: selectedChats.size, total: selectedChats.size, processed: 0, error: 'Could not get access token. Please refresh the page.' };
        }

        const conversations = Array.from(selectedChats.entries());
        let success = 0;
        let processed = 0;

        for (const [conversationId, element] of conversations) {
            const result = await archiveConversation(conversationId, accessToken);
            processed++;

            if (result) {
                success++;
                // Remove the element from DOM
                if (element && element.parentElement) {
                    element.parentElement.remove();
                }
                selectedChats.delete(conversationId);
            }

            // Small delay to avoid rate limiting
            await wait(300);
        }

        return {
            success,
            failed: conversations.length - success,
            total: conversations.length,
            processed
        };
    }

    async function bulkDelete() {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            return { success: 0, failed: selectedChats.size, total: selectedChats.size, processed: 0, error: 'Could not get access token. Please refresh the page.' };
        }

        const conversations = Array.from(selectedChats.entries());
        let success = 0;
        let processed = 0;

        for (const [conversationId, element] of conversations) {
            const result = await deleteConversation(conversationId, accessToken);
            processed++;

            if (result) {
                success++;
                // Remove the element from DOM
                if (element && element.parentElement) {
                    element.parentElement.remove();
                }
                selectedChats.delete(conversationId);
            }

            // Small delay to avoid rate limiting
            await wait(300);
        }

        return {
            success,
            failed: conversations.length - success,
            total: conversations.length,
            processed
        };
    }

    // ===========================================
    // MESSAGE LISTENER
    // ===========================================

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
                return true; // Keep channel open for async response
            case 'bulkDelete':
                bulkDelete().then(sendResponse);
                return true; // Keep channel open for async response
            default:
                sendResponse({ error: 'Unknown action' });
        }
    });

    // ===========================================
    // MUTATION OBSERVER
    // ===========================================

    function setupObserver() {
        const nav = document.querySelector(SIDEBAR_SELECTOR);
        if (!nav) return;

        const observer = new MutationObserver(() => {
            if (checkboxesVisible) {
                // Re-add checkboxes to new chat items
                setTimeout(() => addCheckboxes(), 500);
            }
        });

        observer.observe(nav, { childList: true, subtree: true });
    }

    // Initialize observer when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupObserver);
    } else {
        setupObserver();
    }

    // Add some global styles
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

    console.log('ChatGPT Bulk Delete v2.0 loaded');
})();
