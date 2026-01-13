// ChatGPT Bulk Deleter - Content Script
(function () {
    let selectedChats = new Set();

    // Create checkbox for each chat item
    function addCheckboxes() {
        const chatItems = document.querySelectorAll('nav ol > li > div > a');

        chatItems.forEach((item, index) => {
            if (item.querySelector('.bulk-delete-checkbox')) return;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bulk-delete-checkbox';
            checkbox.dataset.index = index;

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                if (checkbox.checked) {
                    selectedChats.add(item);
                    item.classList.add('bulk-selected');
                } else {
                    selectedChats.delete(item);
                    item.classList.remove('bulk-selected');
                }
            });

            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            item.style.position = 'relative';
            item.insertBefore(checkbox, item.firstChild);
        });
    }

    // Select all visible chats
    function selectAll() {
        const checkboxes = document.querySelectorAll('.bulk-delete-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = true;
            const chatItem = cb.closest('a');
            if (chatItem) {
                selectedChats.add(chatItem);
                chatItem.classList.add('bulk-selected');
            }
        });
        return { count: selectedChats.size };
    }

    // Deselect all
    function deselectAll() {
        const checkboxes = document.querySelectorAll('.bulk-delete-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = false;
            const chatItem = cb.closest('a');
            if (chatItem) {
                chatItem.classList.remove('bulk-selected');
            }
        });
        selectedChats.clear();
        return { success: true };
    }

    // Get selected count
    function getSelectedCount() {
        return { count: selectedChats.size };
    }

    // Helper function to wait
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Delete a single chat
    async function deleteSingleChat(chatItem) {
        try {
            // Click on the chat to select it
            chatItem.click();
            await wait(500);

            // Find and click the 3-dot menu button
            const menuButton = chatItem.querySelector('button[data-state]') ||
                chatItem.parentElement.querySelector('button');

            if (!menuButton) {
                // Try hovering to reveal menu
                chatItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                await wait(300);
            }

            // Look for menu button again after hover
            const allButtons = chatItem.querySelectorAll('button');
            for (const btn of allButtons) {
                btn.click();
                await wait(300);

                // Look for delete option in dropdown
                const deleteOption = document.querySelector('[role="menuitem"]');
                const menuItems = document.querySelectorAll('[role="menuitem"]');

                for (const menuItem of menuItems) {
                    if (menuItem.textContent.toLowerCase().includes('delete')) {
                        menuItem.click();
                        await wait(300);

                        // Confirm deletion if there's a confirmation modal
                        const confirmBtn = document.querySelector('button[class*="danger"]') ||
                            document.querySelector('button.btn-danger') ||
                            Array.from(document.querySelectorAll('button')).find(b =>
                                b.textContent.toLowerCase().includes('delete') &&
                                b.closest('[role="dialog"]')
                            );

                        if (confirmBtn) {
                            confirmBtn.click();
                            await wait(500);
                        }
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('Delete error:', error);
            return false;
        }
    }

    // Delete all selected chats
    async function deleteSelected() {
        const chatsToDelete = Array.from(selectedChats);
        let deleted = 0;

        for (const chat of chatsToDelete) {
            const success = await deleteSingleChat(chat);
            if (success) {
                deleted++;
                selectedChats.delete(chat);
            }
            await wait(1000); // Wait between deletions
        }

        return { deleted, total: chatsToDelete.length };
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        addCheckboxes(); // Refresh checkboxes

        switch (request.action) {
            case 'selectAll':
                sendResponse(selectAll());
                break;
            case 'deselectAll':
                sendResponse(deselectAll());
                break;
            case 'getSelectedCount':
                sendResponse(getSelectedCount());
                break;
            case 'deleteSelected':
                deleteSelected().then(sendResponse);
                return true; // Keep channel open for async response
        }
    });

    // Initialize checkboxes when page loads
    function init() {
        addCheckboxes();

        // Watch for DOM changes (lazy loading of chats)
        const observer = new MutationObserver(() => {
            setTimeout(addCheckboxes, 500);
        });

        const nav = document.querySelector('nav');
        if (nav) {
            observer.observe(nav, { childList: true, subtree: true });
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
