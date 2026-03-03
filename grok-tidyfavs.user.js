// ==UserScript==
// @name         Grok TidyFavs
// @namespace    https://github.com/Zhiro90
// @version      1.0
// @description  Hides images in "All" that are already assigned to folders. Features learning mode, auto-resize, and memory wipe.
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
    let toggleBtn = null;
    let resetBtn = null;
    let container = null;
    let lastHiddenCount = -1;

    console.log("%c🚀 GROK SCRIPT V15 (RELEASE EDITION) LOADED", "color: #00ff00; font-weight: bold;");

    // Force Masonry to redraw by simulating a microscopic resize
    function triggerMicroShake() {
        window.dispatchEvent(new UIEvent('resize', { view: window, bubbles: true, cancelable: true }));

        const body = document.body;
        const origWidth = body.style.width;
        body.style.width = 'calc(100% - 1px)';

        setTimeout(() => {
            body.style.width = origWidth;
            window.dispatchEvent(new Event('resize'));
        }, 40);
    }

    // Listen for clicks on the "All" tab to force a redraw when returning to the main view
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn && btn.textContent.trim() === 'All') {
            setTimeout(triggerMicroShake, 100);
            setTimeout(triggerMicroShake, 400);
        }
    });

    // Extract the React Fiber ID without causing lag
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
        const buttons = Array.from(document.querySelectorAll('button'));
        const activeBtn = buttons.find(b => b.classList.contains('bg-primary'));
        const name = activeBtn ? activeBtn.textContent.trim() : "";
        return (name === "All" || name === "Favorites") ? null : name;
    }

    // Elegant Toast Notification System
    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed', bottom: '85px', right: '20px', zIndex: '9999999',
            backgroundColor: 'rgba(0, 0, 0, 0.9)', color: '#fff',
            padding: '12px 18px', borderRadius: '8px', border: '1px solid #444',
            fontSize: '14px', fontFamily: 'sans-serif', fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', pointerEvents: 'none',
            transition: 'opacity 0.4s ease-in-out', opacity: '0'
        });
        document.body.appendChild(toast);

        // Fade In
        requestAnimationFrame(() => { toast.style.opacity = '1'; });

        // Fade Out and Remove
        setTimeout(() => { toast.style.opacity = '0'; }, 3500);
        setTimeout(() => { toast.remove(); }, 4000);
    }

    function updateCards() {
        if (!window.location.href.includes('favorites') && !window.location.href.includes('collection')) return;

        const folderName = getActiveFolderName();
        const cards = document.querySelectorAll('.group\\/media-post-masonry-card');
        let learnedCount = 0;
        let currentHiddenCount = 0;

        cards.forEach(card => {
            const mediaId = getMediaId(card);
            if (!mediaId) return;

            const wrapper = card.parentElement;

            // LEARNING MODE: Save IDs if we are inside a custom folder
            if (folderName) {
                if (!savedMemory[mediaId]) {
                    savedMemory[mediaId] = folderName;
                    learnedCount++;
                }
                wrapper.style.removeProperty('display');
            }
            // FILTER MODE: Hide if we are in "All" and the ID is in memory
            else if (hideTagged && savedMemory[mediaId]) {
                if (wrapper.style.display !== 'none') {
                    wrapper.style.setProperty('display', 'none', 'important');
                }
                currentHiddenCount++;
            } else {
                if (wrapper.style.display === 'none') {
                    wrapper.style.removeProperty('display');
                }
            }
        });

        if (learnedCount > 0) {
            localStorage.setItem('grok_tagged_memory', JSON.stringify(savedMemory));
            console.log(`%c✅ Archivist: Memorized ${learnedCount} new images from "${folderName}"`, "color: #ffaa00");
        }

        if (currentHiddenCount !== lastHiddenCount && folderName === null) {
            lastHiddenCount = currentHiddenCount;
            triggerMicroShake();
        }
    }

    function createUI() {
        if (document.getElementById('grok-filter-container')) return;

        // Main Container
        container = document.createElement('div');
        container.id = 'grok-filter-container';
        Object.assign(container.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '999999',
            display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center'
        });

        // Reset/Trash Button
        resetBtn = document.createElement('button');
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

        // Hover effects for Reset Button
        resetBtn.onmouseover = () => { resetBtn.style.color = '#ff4d4d'; resetBtn.style.borderColor = '#ff4d4d'; };
        resetBtn.onmouseout = () => { resetBtn.style.color = '#aaa'; resetBtn.style.borderColor = '#555'; };

        resetBtn.onclick = () => {
            savedMemory = {};
            localStorage.setItem('grok_tagged_memory', '{}');
            lastHiddenCount = -1;
            updateCards();
            showToast("Memory cleared. Visit your folders to save them again.");
            console.log("%c🗑️ Archivist: Memory wiped completely.", "color: #ff4d4d");
        };

        // Main Toggle Button
        toggleBtn = document.createElement('button');
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
            toggleBtn.title = hideTagged ? 'Show organized images' : 'Hide organized images';

            lastHiddenCount = -1;
            updateCards();
        };

        container.appendChild(resetBtn);
        container.appendChild(toggleBtn);
        document.body.appendChild(container);
    }

    // Ultra-fast loop: 100ms to keep UI up to date
    setInterval(() => {
        createUI();
        updateCards();
    }, 100);
})();