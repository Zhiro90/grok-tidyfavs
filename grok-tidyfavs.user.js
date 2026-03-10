// ==UserScript==
// @name         Grok TidyFavs
// @namespace    https://github.com/Zhiro90
// @version      1.2
// @description  Hides tagged images in the "All" section of your saved creations. 
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

    console.log("%c🚀 GROK TIDYFAVS V1.2 (MICRO-SHRINK ENGINE) LOADED", "color: #00ff00; font-weight: bold;");

    // ==========================================
    // 🛡️ 1. NETWORK INTERCEPTOR (El Cadenero)
    // ==========================================
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = args[0] && typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');

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
                        if (hiddenIds.some(id => text.includes(id))) {
                            let data = JSON.parse(text);
                            let removedCount = 0;

                            const filterNode = (obj) => {
                                if (!obj || typeof obj !== 'object') return false;
                                let changed = false;
                                if (Array.isArray(obj)) {
                                    for (let i = obj.length - 1; i >= 0; i--) {
                                        let item = obj[i];
                                        if (item && item.id && hiddenIds.includes(item.id)) {
                                            obj.splice(i, 1);
                                            changed = true;
                                            if (DEBUG_MODE) removedCount++;
                                        }
                                    }
                                }
                                for (let key in obj) {
                                    if (filterNode(obj[key])) changed = true;
                                }
                                return changed;
                            };

                            if (filterNode(data)) {
                                logDebug("NETWORK", `Intercepted and destroyed ${removedCount} images before reaching React!`, "#e74c3c");
                                return new Response(JSON.stringify(data), {
                                    status: response.status,
                                    statusText: response.statusText,
                                    headers: response.headers
                                });
                            }
                        }
                    }
                } catch (e) {
                    // Silenciar errores de parseo
                }
            }
        }
        return response;
    };

    // ==========================================
    // 🕹️ 2. SCROLL GUARD (La Tregua)
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
    // 🖥️ 3. DOM MANAGER & HACKS
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

    // 🔥 LA MAGIA DEL ANT-MAN: Ocultar engañando a React
    function applyShrinkHide(wrapper) {
        if (wrapper.dataset.tidyShrink === 'true') return false; 
        
        wrapper.style.removeProperty('display'); 
        
        // La aplastamos a nivel molecular
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

    // Restaurar a la normalidad
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
        const url = window.location.href;
        if (!url.includes('favorites') && !url.includes('collection') && !url.includes('saved')) return;

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

            // Evitar conflictos con viejos scripts
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
                
                // Medimos la altura total para poner el freno al contenedor
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
            requestLayoutSync();
        }

        let currentTargetHeight = "100vh";
        
        // Freno del contenedor para evitar scrolls infinitos
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
    // 🎛️ 4. USER INTERFACE
    // ==========================================
    function createUI() {
        if (document.getElementById('grok-filter-container')) return;

        const containerUI = document.createElement('div');
        containerUI.id = 'grok-filter-container';
        Object.assign(containerUI.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '999999',
            display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center'
        });

        const refreshBtn = document.createElement('button');
        refreshBtn.title = "Blinking images? Refresh to stabilize saves";
        Object.assign(refreshBtn.style, {
            width: '38px', height: '38px', borderRadius: '50%',
            backgroundColor: 'rgba(20,20,20,0.9)', border: '1px solid #555',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#aaa', fontSize: '18px', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', transition: 'all 0.2s'
        });
        refreshBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
        `;
        refreshBtn.onmouseover = () => { refreshBtn.style.color = '#3498db'; refreshBtn.style.borderColor = '#3498db'; };
        refreshBtn.onmouseout = () => { refreshBtn.style.color = '#aaa'; refreshBtn.style.borderColor = '#555'; };
        refreshBtn.onclick = () => {
            showToast("Stabilizing layout...", 'info');
            setTimeout(() => window.location.reload(), 200);
        };

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
            
            const tb = document.getElementById('grok-toggle-btn');
            if(tb) {
                tb.style.color = '#fff';
                tb.innerHTML = '👁️';
            }
            showToast("Memory wiped. Layout resetting...", 'warning');
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
            logDebug("UI", `Visibility Toggled -> Now Hide is: ${hideTagged}`);
            localStorage.setItem('grok_hide_tagged', hideTagged);
            toggleBtn.style.color = hideTagged ? '#ff4d4d' : '#fff';
            toggleBtn.innerHTML = hideTagged ? '👁️‍🗨️' : '👁️';
            showToast(hideTagged ? "Applying Filter..." : "Disabling Filter...", "info");
            fireTripleTapSequence();
        };

        containerUI.appendChild(refreshBtn);
        containerUI.appendChild(resetBtn);
        containerUI.appendChild(toggleBtn);
        document.body.appendChild(containerUI);
    }

    setInterval(() => {
        createUI();
        updateDOM();
    }, 150);
})();