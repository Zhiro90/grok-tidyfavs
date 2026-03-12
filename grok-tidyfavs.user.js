// ==UserScript==
// @name         Grok TidyFavs
// @namespace    https://github.com/Zhiro90
// @version      1.3
// @description  Hides tagged images in the "All" section of your saved imagine creations. 
// @author       Zhiro90
// @match        *://grok.com/*
// @icon         https://grok.com/images/favicon.ico
// @homepageURL  https://github.com/Zhiro90/grok-tidyfavs
// @supportURL   https://github.com/Zhiro90/grok-tidyfavs/issues
// @downloadURL  https://raw.githubusercontent.com/Zhiro90/grok-tidyfavs/main/grok-tidyfavs.user.js
// @updateURL    https://raw.githubusercontent.com/Zhiro90/grok-tidyfavs/main/grok-tidyfavs.user.js
// @license      MIT
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 🎛️ CONFIGURACIÓN DE DESARROLLO
    // ==========================================
    const DEBUG_MODE = false; // Cambiar a 'true' para ver la telemetría en consola

    let savedMemory = JSON.parse(localStorage.getItem('grok_tagged_memory') || '{}');
    let hideTagged = localStorage.getItem('grok_hide_tagged') !== 'false';
    
    let currentFolderState = undefined; 
    let zoomTimeout = null;
    let isScrolling = false;
    let scrollTimeout = null;
    let pendingLayoutFix = false;

    function logDebug(type, message, color = "#bdc3c7") {
        if (!DEBUG_MODE) return;
        console.log(`%c[DEBUG ${type}] ${message}`, `color: ${color}; font-size: 11px;`);
    }

    console.log("%c🚀 GROK TIDYFAVS V1.2.6 (PURE MICRO-SHRINK ENGINE) LOADED", "color: #00ff00; font-weight: bold;");

    // ==========================================
    // 🎨 CSS INJECTIONS (Global Scroll Lock)
    // ==========================================
    if (!document.getElementById('grok-tidy-css')) {
        const style = document.createElement('style');
        style.id = 'grok-tidy-css';
        style.textContent = `
            body.tidy-scroll-lock {
                overflow: hidden !important;
                overscroll-behavior: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ==========================================
    // 🕹️ 1. SCROLL GUARD (La Tregua)
    // ==========================================
    window.addEventListener('scroll', () => {
        isScrolling = true;
        clearTimeout(scrollTimeout);
        
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
            if (pendingLayoutFix) {
                logDebug("SCROLL", "Scroll stopped. Triggering sync.", "#2ecc71");
                pendingLayoutFix = false;
                requestLayoutSync();
            }
        }, 500);
    }, { capture: true, passive: true });

    // ==========================================
    // 🖥️ 2. DOM MANAGER & HACKS
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

    function triggerZoom() {
        const originalZoom = document.body.style.zoom || '';
        document.body.style.zoom = '0.999';
        setTimeout(() => {
            document.body.style.zoom = originalZoom;
            window.dispatchEvent(new Event('resize'));
        }, 50);
    }

    function requestLayoutSync() {
        if (isScrolling) {
            pendingLayoutFix = true;
            return;
        }
        if (zoomTimeout) clearTimeout(zoomTimeout);
        zoomTimeout = setTimeout(triggerZoom, 200); 
    }

    function fireTripleTapSequence() {
        setTimeout(triggerZoom, 100);
        setTimeout(triggerZoom, 500);
        setTimeout(triggerZoom, 1200);
    }

    function applyShrinkHide(wrapper) {
        if (wrapper.dataset.tidyShrink === 'true') return false; 
        
        wrapper.style.removeProperty('display'); 
        
        wrapper.style.setProperty('height', '1px', 'important');
        wrapper.style.setProperty('width', '1px', 'important');
        wrapper.style.setProperty('overflow', 'hidden', 'important');
        wrapper.style.setProperty('opacity', '0', 'important');
        wrapper.style.setProperty('margin', '0', 'important');
        wrapper.style.setProperty('padding', '0', 'important');
        wrapper.style.setProperty('pointer-events', 'none', 'important');
        wrapper.style.setProperty('border', 'none', 'important');
        
        wrapper.dataset.tidyShrink = 'true';
        return true; 
    }

    function removeShrinkHide(wrapper) {
        if (wrapper.dataset.tidyShrink !== 'true') return false; 
        
        wrapper.style.removeProperty('height');
        wrapper.style.removeProperty('width');
        wrapper.style.removeProperty('overflow');
        wrapper.style.removeProperty('opacity');
        wrapper.style.removeProperty('margin');
        wrapper.style.removeProperty('padding');
        wrapper.style.removeProperty('pointer-events');
        wrapper.style.removeProperty('border');
        
        delete wrapper.dataset.tidyShrink;
        return true; 
    }

    function updateDOM() {
        const folderName = getActiveFolderName();
        const cards = Array.from(document.querySelectorAll('.group\\/media-post-masonry-card'));
        if (cards.length === 0) return;

        let learnedCount = 0;
        let maxRelativeBottom = 0;
        let needsLayoutFix = false; 
        
        const isAllView = !folderName;
        const masonryContainer = cards[0].parentElement.parentElement;
        const containerRect = masonryContainer ? masonryContainer.getBoundingClientRect() : null;

        const newFolderState = isAllView ? 'ALL' : folderName;
        if (currentFolderState !== newFolderState) {
            currentFolderState = newFolderState;
            if (isAllView && hideTagged) {
                fireTripleTapSequence(); 
            }
        }

        cards.forEach(card => {
            const wrapper = card.parentElement;
            const mediaId = getMediaId(card);

            wrapper.style.removeProperty('display');

            if (!mediaId) return;

            if (!isAllView) {
                if (removeShrinkHide(wrapper)) needsLayoutFix = true;
                if (!savedMemory[mediaId]) {
                    savedMemory[mediaId] = folderName;
                    learnedCount++;
                }
            } else if (hideTagged && savedMemory[mediaId]) {
                if (applyShrinkHide(wrapper)) needsLayoutFix = true; 
            } else {
                if (removeShrinkHide(wrapper)) needsLayoutFix = true;
                
                if (hideTagged && isAllView && containerRect && wrapper.dataset.tidyShrink !== 'true') {
                    const reactTransformY = parseFloat(wrapper.style.translate?.split(' ')[1] || "0");
                    const relativeBottom = reactTransformY + wrapper.getBoundingClientRect().height;
                    if (relativeBottom > maxRelativeBottom) {
                        maxRelativeBottom = relativeBottom;
                    }
                }
            }
        });

        if (needsLayoutFix) {
            logDebug("RENDER", "Applying Zoom Jiggle to force React measurer update");
            
            if (window.scrollY === 0 && isAllView) {
                logDebug("HACK", "Scroll is 0. Nudging to break React thrashing loop.");
                window.scrollTo(0, 2);
            }
            
            requestLayoutSync();
        }

        let currentTargetHeight = "100vh";
        
        if (isAllView && hideTagged && masonryContainer) {
            if (maxRelativeBottom > 0) {
                let proposedHeight = Math.ceil(maxRelativeBottom) + 800; 
                let currentHeightVal = parseFloat(masonryContainer.dataset.tidyHeight || "0");
                
                if (Math.abs(proposedHeight - currentHeightVal) > 15) {
                    currentTargetHeight = `${proposedHeight}`;
                    masonryContainer.dataset.tidyHeight = currentTargetHeight;
                    masonryContainer.style.setProperty('height', `${currentTargetHeight}px`, 'important');
                    masonryContainer.dataset.tidyBrake = 'true';
                }
            } else {
                masonryContainer.style.setProperty('height', '100vh', 'important');
                masonryContainer.dataset.tidyHeight = "0";
            }
        } else if (masonryContainer && masonryContainer.dataset.tidyBrake) {
            masonryContainer.style.removeProperty('height');
            delete masonryContainer.dataset.tidyBrake;
            delete masonryContainer.dataset.tidyHeight;
        }

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
            position: 'fixed', bottom: '20px', right: '80px', zIndex: '999999',
            display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center'
        });

        // NOTA: Se ha eliminado el refreshBtn porque el motor Micro-Shrink
        // no requiere estabilización manual tras un reload.

        const resetBtn = document.createElement('button');
        resetBtn.title = "Clear memory (Already refreshed? Reload to show hidden)";
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
            
            const tb = document.getElementById('grok-toggle-btn');
            if(tb) {
                tb.style.color = '#fff';
                tb.innerHTML = '👁️';
                tb.title = 'Hide organized images'; 
            }
            showToast("Memory wiped. (Reload if images are missing)", 'warning');
            fireTripleTapSequence();
        };

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'grok-toggle-btn';
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
            showToast(hideTagged ? "Applying Filter..." : "Disabling Filter...", "info");
            fireTripleTapSequence();
        };

        containerUI.appendChild(resetBtn);
        containerUI.appendChild(toggleBtn);
        document.body.appendChild(containerUI);
    }

    // ==========================================
    // ⏰ MASTER LOOP
    // ==========================================
    setInterval(() => {
        const url = window.location.href;
        const isTargetPage = url.includes('favorites') || url.includes('collection') || url.includes('saved') || url.endsWith('/all');
        
        let uiContainer = document.getElementById('grok-filter-container');
        
        if (!isTargetPage) {
            if (uiContainer) uiContainer.style.display = 'none';
            document.body.classList.remove('tidy-scroll-lock');
            return; 
        } else {
            if (uiContainer) {
                uiContainer.style.display = 'flex';
            } else {
                createUI();
            }
            document.body.classList.add('tidy-scroll-lock');
            updateDOM();
        }
    }, 150);
})();