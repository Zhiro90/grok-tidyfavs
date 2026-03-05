// ==UserScript==
// @name         Grok TidyFavs
// @namespace    https://github.com/Zhiro90
// @version      1.1
// @description  Hides images in "All" from your imagine collection that are already assigned to folders.
// @author       Zhiro90
// @match        *://grok.com/*
// @icon         https://grok.com/favicon.ico
// @homepageURL  https://github.com/Zhiro90/grok-tidyfavs
// @supportURL   https://github.com/Zhiro90/grok-tidyfavs/issues
// @downloadURL  https://raw.githubusercontent.com/Zhiro90/grok-tidyfavs/main/grok-tidyfavs.user.js
// @updateURL    https://raw.githubusercontent.com/Zhiro90/grok-tidyfavs/main/grok-tidyfavs.user.js
// @license      MIT
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let savedMemory = JSON.parse(localStorage.getItem('grok_tagged_memory') || '{}');
    let hideTagged = localStorage.getItem('grok_hide_tagged') !== 'false';

    console.log("%c🚀 GROK TIDYFAVS V1.1 (HYBRID ENGINE: NETWORK + DOM) LOADED", "color: #00ff00; font-weight: bold;");

    // ==========================================
    // 🛡️ 1. NETWORK INTERCEPTOR
    // Intercepts Grok's API calls for Infinite Scroll
    // ==========================================
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = args[0] && typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');

        // Exclude fast assets
        if (url.includes('.woff') || url.includes('.css') || url.includes('.jpg') || url.includes('.png')) {
            return response;
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const isAllView = window.location.href.endsWith('/saved') || window.location.href.endsWith('/favorites') || window.location.href.endsWith('/all');

            if (hideTagged && isAllView) {
                try {
                    const clone = response.clone();
                    let text = await clone.text();

                    const hiddenIds = Object.keys(savedMemory);
                    if (hiddenIds.length > 0) {
                        // Quick heuristic search
                        const hasHidden = hiddenIds.some(id => text.includes(id));

                        if (hasHidden) {
                            let data = JSON.parse(text);

                            // Deep recursive filter to erase info before Grok renders it
                            const filterNode = (obj) => {
                                if (!obj || typeof obj !== 'object') return false;
                                let changed = false;
                                if (Array.isArray(obj)) {
                                    for (let i = obj.length - 1; i >= 0; i--) {
                                        let item = obj[i];
                                        if (item && item.id && hiddenIds.includes(item.id)) {
                                            obj.splice(i, 1);
                                            changed = true;
                                        }
                                    }
                                }
                                for (let key in obj) {
                                    if (filterNode(obj[key])) changed = true;
                                }
                                return changed;
                            };

                            if (filterNode(data)) {
                                console.log("%c🛡️ Archivist: Images filtered from network root.", "color: #00ffff");
                                return new Response(JSON.stringify(data), {
                                    status: response.status,
                                    statusText: response.statusText,
                                    headers: response.headers
                                });
                            }
                        }
                    }
                } catch (e) {
                    // Ignore errors silently to avoid breaking the site
                }
            }
        }
        return response;
    };

    // ==========================================
    // 🖥️ 2. DOM MANAGER & LEARNING MODE
    // ==========================================
    const SYSTEM_TAB_NAMES = new Set([
        'All', 'Todas', 'Todos', 'Tout', 'Tous', 'Alle', 'Tutti', 'すべて', '全て', '全部',
        'Favorites', 'Favourites', 'Guardados', 'Favoritos', 'Favoris', 'Favoriten', 'Preferiti', 'Saved',
    ]);

    function getMediaId(node) {
        if (node.dataset.grokMediaId) return node.dataset.grokMediaId;
        try {
            const key = Object.keys(node).find(k => k.startsWith('__reactFiber$'));
            if (!key) return null;
            let curr = node[key];
            for (let i = 0; i < 25; i++) {
                if (!curr) break;
                const props = curr.memoizedProps;
                const data = props?.data || props?.post || props?.item;
                if (data?.id && typeof data.id === 'string' && data.id.length > 20) {
                    node.dataset.grokMediaId = data.id;
                    return data.id;
                }
                curr = curr.return;
            }
        } catch (e) {}
        return null;
    }

    function getActiveFolderName() {
        const activeBtn = document.querySelector('button.bg-primary');
        if (!activeBtn) return null;
        const name = activeBtn.textContent.trim();
        return SYSTEM_TAB_NAMES.has(name) ? null : (name || null);
    }

    function showToast(message, type = 'info') {
        const existingToasts = document.querySelectorAll('.grok-tidyfavs-toast');
        existingToasts.forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = 'grok-tidyfavs-toast';
        toast.textContent = message;

        let bgColor = 'rgba(0, 0, 0, 0.9)';
        let borderColor = '#444';

        if (type === 'success') {
            bgColor = 'rgba(20, 80, 40, 0.95)';
            borderColor = '#2ecc71';
        } else if (type === 'warning') {
            bgColor = 'rgba(100, 30, 30, 0.95)';
            borderColor = '#ff4d4d';
        }

        Object.assign(toast.style, {
            position: 'fixed', bottom: '85px', right: '20px', zIndex: '9999999',
            backgroundColor: bgColor, color: '#fff',
            padding: '12px 18px', borderRadius: '8px', border: `1px solid ${borderColor}`,
            fontSize: '14px', fontFamily: 'sans-serif', fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', pointerEvents: 'none',
            transition: 'opacity 0.3s ease-in-out', opacity: '0'
        });
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => { toast.style.opacity = '0'; }, 2000);
        setTimeout(() => { toast.remove(); }, 2300);
    }

    function updateDOM() {
        const url = window.location.href;
        if (!url.includes('favorites') && !url.includes('collection') && !url.includes('saved')) return;

        const folderName = getActiveFolderName();
        const cards = document.querySelectorAll('.group\\/media-post-masonry-card');

        let learnedCount = 0;

        cards.forEach(card => {
            const wrapper = card.parentElement;
            const mediaId = getMediaId(card);

            // Remove any old CSS translation leftovers
            card.style.translate = '';

            if (!mediaId) return;

            // 1. LEARNING MODE (Inside folders)
            if (folderName) {
                wrapper.style.removeProperty('display');
                if (!savedMemory[mediaId]) {
                    savedMemory[mediaId] = folderName;
                    learnedCount++;
                }
            }
            // 2. FILTER MODE (Only to hide the initial batch loaded before the Interceptor catches on)
            else if (hideTagged && savedMemory[mediaId]) {
                wrapper.style.setProperty('display', 'none', 'important');
            }
            else {
                wrapper.style.removeProperty('display');
            }
        });

        if (learnedCount > 0) {
            localStorage.setItem('grok_tagged_memory', JSON.stringify(savedMemory));
            showToast(`✅ ${learnedCount} new images added to memory`, 'success');
        }
    }

    // ==========================================
    // 🎛️ 3. USER INTERFACE
    // ==========================================
    function createUI() {
        if (document.getElementById('grok-filter-container')) return;

        const containerUI = document.createElement('div');
        containerUI.id = 'grok-filter-container';
        Object.assign(containerUI.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '999999',
            display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center'
        });

        const resetBtn = document.createElement('button');
        resetBtn.title = "Clear memory and reset filters";
        Object.assign(resetBtn.style, {
            width: '38px', height: '38px', borderRadius: '50%',
            backgroundColor: 'rgba(20,20,20,0.9)', border: '1px solid #555',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#aaa', fontSize: '18px', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', transition: 'all 0.2s'
        });
        resetBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        `;

        resetBtn.onmouseover = () => { resetBtn.style.color = '#ff4d4d'; resetBtn.style.borderColor = '#ff4d4d'; };
        resetBtn.onmouseout = () => { resetBtn.style.color = '#aaa'; resetBtn.style.borderColor = '#555'; };
        resetBtn.onclick = () => {
            savedMemory = {};
            localStorage.setItem('grok_tagged_memory', '{}');
            hideTagged = false;
            localStorage.setItem('grok_hide_tagged', false);
            showToast("Memory wiped. Reloading network...", 'warning');
            setTimeout(() => window.location.reload(), 800);
        };

        const toggleBtn = document.createElement('button');
        Object.assign(toggleBtn.style, {
            width: '50px', height: '50px', borderRadius: '50%',
            backgroundColor: 'rgba(0,0,0,0.9)', border: '2px solid #444',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: hideTagged ? '#ff4d4d' : '#fff', fontSize: '24px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', transition: 'color 0.2s'
        });

        toggleBtn.innerHTML = hideTagged ? '👁️‍🗨️' : '👁️';
        toggleBtn.title = hideTagged ? 'Show organized images' : 'Hide organized images';

        toggleBtn.onclick = () => {
            hideTagged = !hideTagged;
            localStorage.setItem('grok_hide_tagged', hideTagged);
            toggleBtn.style.color = hideTagged ? '#ff4d4d' : '#fff';
            toggleBtn.innerHTML = hideTagged ? '👁️‍🗨️' : '👁️';

            showToast(hideTagged ? "Applying Network Filter..." : "Disabling Filter...", "info");

            // Reload the page so the Interceptor catches clean data from the server
            setTimeout(() => window.location.reload(), 600);
        };

        containerUI.appendChild(resetBtn);
        containerUI.appendChild(toggleBtn);
        document.body.appendChild(containerUI);
    }

    setInterval(() => {
        createUI();
        updateDOM();
    }, 150);
})();