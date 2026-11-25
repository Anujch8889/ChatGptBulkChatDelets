// ChatGPT Bulk Delete - Content Script v3.1.0
// Optimized for 1,000 - 10,000+ chats: token refresh on 401, adaptive 429 backoff,
// O(1) sidebar cleanup, resumable job state, and cancellation support.

(function () {
    'use strict';

    if (window.__chatgptBulkDeleteLoaded) {
        return;
    }
    window.__chatgptBulkDeleteLoaded = true;

    const BASE_URL = window.location.origin;
    const INITIAL_BATCH_SIZE = 10;
    const MIN_BATCH_SIZE = 3;
    const BATCH_DELAY = 250;
    const DEFAULT_COOLDOWN_MS = 10000;

    let deviceId = null;
    let activePort = null;

    let jobState = {
        active: false,
        action: null,
        status: 'idle', // idle | fetching | processing | complete | error | cancelled
        message: '',
        processed: 0,
        total: 0,
        success: 0,
        failed: 0,
        percent: 0,
        cancelled: false,
        succeededIds: []
    };

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function emitProgress(update) {
        Object.assign(jobState, update);
        if (activePort) {
            try {
                activePort.postMessage({ ...jobState });
            } catch (e) {
                activePort = null;
            }
        }
    }

    async function getDeviceId() {
        try {
            const storedId = localStorage.getItem('oai-did');
            if (storedId) {
                deviceId = storedId;
                return deviceId;
            }
            if (!deviceId) {
                deviceId = crypto.randomUUID();
            }
            return deviceId;
        } catch (error) {
            return crypto.randomUUID();
        }
    }

    async function getAccessToken() {
        try {
            await getDeviceId();
            const response = await fetch(`${BASE_URL}/api/auth/session`, {
                credentials: 'include'
            });
            if (!response.ok) return null;
            const data = await response.json();
            return data.accessToken || null;
        } catch (error) {
            console.error('[BulkDelete] Failed to get access token:', error);
            return null;
        }
    }

    function buildHeaders(accessToken) {
        return {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'oai-device-id': deviceId || '',
            'oai-language': 'en-US'
        };
    }

    function getRetryAfterMs(response, attempt) {
        const retryHeader = response.headers.get('Retry-After');
        if (retryHeader) {
            const seconds = Number(retryHeader);
            if (!Number.isNaN(seconds) && seconds > 0) {
                return Math.min(seconds * 1000, 60000);
            }
        }
        return Math.min(DEFAULT_COOLDOWN_MS * Math.max(1, attempt), 45000);
    }

    // ===========================================
    // FETCH ALL CONVERSATIONS (10k+ SAFE)
    // ===========================================

    async function fetchAllConversations() {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            return { error: 'Please sign in to ChatGPT and refresh the page.' };
        }

        const seenIds = new Set();
        const allConversations = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;
        let retryCount = 0;
        let currentToken = accessToken;

        emitProgress({
            active: true,
            action: 'fetchAll',
            status: 'fetching',
            message: 'Loading chats...',
            processed: 0,
            total: 0,
            percent: 10,
            cancelled: false
        });

        while (hasMore) {
            if (jobState.cancelled) {
                return { cancelled: true, conversations: allConversations };
            }

            try {
                const url = `${BASE_URL}/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: buildHeaders(currentToken),
                    credentials: 'include'
                });

                if (response.status === 401) {
                    retryCount++;
                    const refreshed = await getAccessToken();
                    if (refreshed && retryCount <= 2) {
                        currentToken = refreshed;
                        continue;
                    }
                    return { error: 'Session expired. Please refresh ChatGPT and try again.' };
                }

                if (response.status === 429) {
                    retryCount++;
                    if (retryCount > 5) {
                        return { error: `Rate limited by ChatGPT after ${allConversations.length} chats. Please wait a minute and retry.` };
                    }
                    const cooldown = getRetryAfterMs(response, retryCount);
                    emitProgress({
                        status: 'fetching',
                        message: `Rate limited. Waiting ${Math.round(cooldown / 1000)}s... (${allConversations.length} loaded)`
                    });
                    await wait(cooldown);
                    continue;
                }

                if (!response.ok) {
                    return { error: `Failed to fetch chats (HTTP ${response.status}). Try refreshing ChatGPT.` };
                }

                retryCount = 0;
                const data = await response.json();
                const items = Array.isArray(data)
                    ? data
                    : (Array.isArray(data.items) ? data.items : []);

                if (items.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const item of items) {
                    if (item && item.id && !seenIds.has(item.id)) {
                        seenIds.add(item.id);
                        allConversations.push({
                            id: item.id,
                            title: item.title || 'New chat',
                            update_time: item.update_time || item.create_time || null
                        });
                    }
                }

                emitProgress({
                    status: 'fetching',
                    message: `Loading chats... (${allConversations.length} found)`
                });

                if (data.has_more === false) {
                    hasMore = false;
                } else if (typeof data.total === 'number' && offset + items.length >= data.total) {
                    hasMore = false;
                } else {
                    offset += items.length;
                }

                await wait(120);
            } catch (error) {
                console.error('[BulkDelete] Error fetching conversations:', error);
                return { error: 'Network error while fetching chats.' };
            }
        }

        return { success: true, conversations: allConversations };
    }

    // ===========================================
    // SIDEBAR DOM CACHE (O(1) CLEANUP)
    // ===========================================

    function buildSidebarLinkMap() {
        const map = new Map();
        const links = document.querySelectorAll('nav a[href*="/c/"], aside a[href*="/c/"], a[href*="/c/"]');
        links.forEach(link => {
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/c\/([a-zA-Z0-9-]+)/);
            if (match && !map.has(match[1])) {
                map.set(match[1], link);
            }
        });
        return map;
    }

    function removeChatFromMap(sidebarMap, conversationId) {
        const link = sidebarMap.get(conversationId);
        if (!link) return;
        sidebarMap.delete(conversationId);
        try {
            const listItem = link.closest('li');
            if (listItem && listItem.querySelectorAll('a[href*="/c/"]').length <= 1) {
                listItem.remove();
            } else {
                link.remove();
            }
        } catch (e) {
            // Ignore DOM cleanup errors
        }
    }

    // ===========================================
    // BATCHED DELETE / ARCHIVE (10k+ SAFE)
    // ===========================================

    async function patchConversation(conversationId, accessToken, payload) {
        try {
            const response = await fetch(`${BASE_URL}/backend-api/conversation/${conversationId}`, {
                method: 'PATCH',
                headers: buildHeaders(accessToken),
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            return { success: response.ok, status: response.status, response };
        } catch (error) {
            return { success: false, status: 0, response: null };
        }
    }

    async function processIdsInBatches(ids, mode) {
        if (jobState.active) {
            return { error: 'Another operation is already running.' };
        }
        if (!Array.isArray(ids) || ids.length === 0) {
            return { error: 'No chats selected.' };
        }

        let accessToken = await getAccessToken();
        if (!accessToken) {
            return { error: 'Could not get access token. Please refresh ChatGPT.' };
        }

        const actionName = mode === 'archive' ? 'archiveSelected' : 'deleteSelected';
        const payload = mode === 'archive' ? { is_archived: true } : { is_visible: false };
        const total = ids.length;
        const sidebarMap = buildSidebarLinkMap();

        let batchSize = INITIAL_BATCH_SIZE;
        let currentDelay = BATCH_DELAY;
        let success = 0;
        let processed = 0;
        let consecutive429 = 0;
        const succeededIds = [];
        let pendingIds = ids.slice();

        emitProgress({
            active: true,
            action: actionName,
            status: 'processing',
            message: `Starting (${total} chats)...`,
            processed: 0,
            total,
            success: 0,
            failed: 0,
            percent: 0,
            cancelled: false,
            succeededIds: []
        });

        try {
            for (let pass = 0; pass < 3 && pendingIds.length > 0; pass++) {
                const isRetry = pass > 0;
                const nextRetryIds = [];

                for (let i = 0; i < pendingIds.length; i += batchSize) {
                    if (jobState.cancelled) {
                        return {
                            cancelled: true,
                            success,
                            failed: total - success,
                            total,
                            processed,
                            succeededIds
                        };
                    }

                    const batch = pendingIds.slice(i, i + batchSize);
                    const results = await Promise.all(
                        batch.map(id => patchConversation(id, accessToken, payload))
                    );

                    let rateLimitResponse = null;
                    let saw401 = false;

                    results.forEach((res, idx) => {
                        const id = batch[idx];
                        if (!isRetry) processed++;

                        if (res.success) {
                            success++;
                            succeededIds.push(id);
                            removeChatFromMap(sidebarMap, id);
                        } else {
                            nextRetryIds.push(id);
                            if (res.status === 429 && !rateLimitResponse) {
                                rateLimitResponse = res.response;
                            }
                            if (res.status === 401) {
                                saw401 = true;
                            }
                        }
                    });

                    // Refresh token if 401 occurred
                    if (saw401) {
                        const refreshed = await getAccessToken();
                        if (refreshed) {
                            accessToken = refreshed;
                        }
                    }

                    const currentProcessed = Math.min(processed, total);
                    const percent = Math.round((currentProcessed / total) * 100);

                    if (rateLimitResponse) {
                        consecutive429++;
                        batchSize = Math.max(MIN_BATCH_SIZE, Math.floor(batchSize / 2));
                        currentDelay = Math.min(800, currentDelay + 150);
                        const cooldown = getRetryAfterMs(rateLimitResponse, consecutive429);

                        emitProgress({
                            status: 'processing',
                            message: `Rate limited — pausing ${Math.round(cooldown / 1000)}s (${currentProcessed}/${total})...`,
                            processed: currentProcessed,
                            total,
                            success,
                            percent
                        });
                        await wait(cooldown);
                    } else {
                        consecutive429 = 0;
                        emitProgress({
                            status: 'processing',
                            message: `${mode === 'archive' ? 'Archiving' : 'Deleting'} ${currentProcessed}/${total} (${percent}%)...`,
                            processed: currentProcessed,
                            total,
                            success,
                            percent
                        });
                        await wait(currentDelay);
                    }
                }

                pendingIds = nextRetryIds;
                if (pendingIds.length > 0 && pass < 2) {
                    await wait(2000);
                }
            }

            return {
                success,
                failed: total - success,
                total,
                processed: total,
                succeededIds
            };
        } finally {
            jobState.active = false;
        }
    }

    // ===========================================
    // MESSAGE & PORT LISTENERS
    // ===========================================

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getJobState') {
            sendResponse({ ...jobState });
        } else if (request.action === 'cancelJob') {
            jobState.cancelled = true;
            sendResponse({ ok: true });
        }
    });

    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== 'bulk-delete-port') return;
        activePort = port;

        port.onDisconnect.addListener(() => {
            if (activePort === port) activePort = null;
        });

        port.onMessage.addListener(async (msg) => {
            if (msg.action === 'fetchAll') {
                jobState.active = true;
                jobState.cancelled = false;
                let result;
                try {
                    result = await fetchAllConversations();
                } finally {
                    jobState.active = false;
                }
                emitProgress({ status: 'complete', action: 'fetchAll', ...result });
            } else if (msg.action === 'deleteSelected') {
                const result = await processIdsInBatches(msg.ids, 'delete');
                emitProgress({ status: 'complete', action: 'deleteSelected', ...result });
            } else if (msg.action === 'archiveSelected') {
                const result = await processIdsInBatches(msg.ids, 'archive');
                emitProgress({ status: 'complete', action: 'archiveSelected', ...result });
            }
        });
    });

    console.log('[BulkDelete] ChatGPT Bulk Delete v3.1.0 loaded (10k+ optimized)');
})();
