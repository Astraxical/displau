// Timer state
let isPaused = false;
let pausedAt = null;
let updateInterval;
let colorInterval;
let lastRealTime = Date.now();

// Three-time model for smooth pause/catchup
let displayTime = 0;   // What's being displayed (freezes on pause)
let actualTime = 0;    // Real time value (always updates)
let maximumTime = 0;   // Original remaining when timer started

// Catchup state
let catchupRemaining = 0; // Time gap to close (display vs actual)
let catchupDuration = 5000; // Total catchup duration (5 seconds)
let catchupStartTime = 0; // When catchup started

// Expiry state
let hasExpired = false;
let expiryNotified = false;
let expiryHandled = false;

// Page visibility state
let isDocumentVisible = true;
let updateIntervalMs = 10;
let colorIntervalMs = 30;

// Check if embedded in iframe
const isEmbedded = window.self !== window.top;

// Add embedded class to body if in iframe
if (isEmbedded) {
    document.body.classList.add('embedded');
}

// Hide display name by default
let displayNameVisible = false;

/**
 * Handle timer expiry - called once when timer reaches zero
 */
function handleExpiry() {
    if (expiryHandled) return;
    expiryHandled = true;
    hasExpired = true;

    console.log('[Timer] Timer expired!');

    // Add expired class for visual effects
    document.body.classList.add('expired');

    // Update document title
    const displayName = DISPLAY_NAME || '7 Segment Timer';
    document.title = `EXPIRED - ${displayName}`;

    // Send browser notification if enabled
    if (!expiryNotified) {
        sendExpiryNotification();
        expiryNotified = true;
    }

    // Handle on_expire behavior
    const onExpire = ON_EXPIRE || 'stop';
    
    if (onExpire === 'hide') {
        // Hide display, show message
        showExpiredMessage();
    } else if (onExpire === 'continue') {
        // Continue showing negative time
        console.log('[Timer] Continuing with negative time display');
    }
    // 'stop' is default - just freeze at 00:00:00:00
}

/**
 * Update countdown display
 */
function updateCountdown() {
    // Skip update if paused
    if (isPaused) return;

    // Update actual time (always runs, even during catchup)
    actualTime = getCurrentTimeValue();

    // Apply catchup with smooth fade - display catches up to actual
    if (catchupRemaining > 0) {
        const elapsed = Date.now() - catchupStartTime;
        const progress = Math.min(1, elapsed / catchupDuration);
        
        // Smooth ease-in-out curve: starts slow, peaks in middle, ends slow
        const speedCurve = Math.sin(progress * Math.PI);
        
        // Calculate how much to reduce the remaining catchup
        const baseAmount = catchupRemaining / (catchupDuration / 10);
        const reduceAmount = baseAmount * speedCurve * 1.5;
        
        catchupRemaining = Math.max(0, catchupRemaining - reduceAmount);
        
        if (catchupRemaining <= 0 || progress >= 1) {
            console.log('[Timer] Catchup complete');
            catchupRemaining = 0;
            displayTime = actualTime;
        } else {
            // Display time is actual minus remaining gap
            displayTime = actualTime - catchupRemaining;
        }
    } else {
        // No catchup, display follows actual
        displayTime = actualTime;
    }

    // Use displayTime for visual output
    const timeStr = formatTime(Math.max(0, displayTime));
    updateDisplay(timeStr);

    // Recurring timers: mark when class is currently in session
    if (RECUR) {
        const inClass = getClassEnd() !== null;
        document.body.classList.toggle('in-class', inClass);
    }

    // Window / checkpoints modes: phase label line + checkpoint rail + title
    let phaseText = '';
    if (DISPLAY_MODE === 'window' || DISPLAY_MODE === 'checkpoints') {
        phaseText = updatePhaseLabel();
    }

    // Update document title
    const displayName = DISPLAY_NAME || '7 Segment Timer';
    document.title = phaseText
        ? `${timeStr.split('.')[0]} · ${phaseText} - ${displayName}`
        : `${timeStr.split('.')[0]} - ${displayName}`;

    // Handle expiry (down direction only)
    if (DIRECTION === 'down' && isExpired() && !hasExpired) {
        handleExpiry();
    }
}

// Listen for fullscreen changes
document.addEventListener('fullscreenchange', () => {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (!document.fullscreenElement) {
        if (fullscreenBtn) {
            fullscreenBtn.textContent = '⛶';
            fullscreenBtn.title = 'Enter fullscreen';
        }
    }
});

// Page Visibility API - throttle updates when tab is hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        isDocumentVisible = false;
        // Reduce update frequency when hidden
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = setInterval(updateCountdown, 1000); // Update once per second
        }
        if (colorInterval) {
            clearInterval(colorInterval);
            colorInterval = setInterval(updateColorTransition, 1000); // Update once per second
        }
        console.log('[Timer] Tab hidden, reducing update frequency');
    } else {
        isDocumentVisible = true;
        // Restore normal update frequency
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = setInterval(updateCountdown, updateIntervalMs);
        }
        if (colorInterval) {
            clearInterval(colorInterval);
            colorInterval = setInterval(updateColorTransition, colorIntervalMs);
        }
        lastRealTime = Date.now();
        console.log('[Timer] Tab visible, restoring normal frequency');
    }
});

// Initialize after config is loaded
async function init() {
    // Wait for config to load
    await loadConfig();

    // Initialize three-time model
    actualTime = getCurrentTimeValue();
    displayTime = actualTime;
    maximumTime = actualTime;

    // For static display mode, just show the static_time_ms value and skip countdown
    if (DISPLAY_MODE === 'static') {
        console.log(`[Timer] Static display mode - showing ${STATIC_TIME_MS}ms`);
        displayTime = STATIC_TIME_MS;
        actualTime = STATIC_TIME_MS;
        
        const timeStr = formatTime(Math.max(0, displayTime));
        updateDisplay(timeStr);
        
        // Update document title
        const displayName = DISPLAY_NAME || '7 Segment Timer';
        document.title = `${timeStr.split('.')[0]} - ${displayName}`;
        
        // Apply initial color (use 1.0 ratio since it's static)
        currentColor = getColorForRemainingRatio(1.0);
        targetColor = currentColor;
        applyColor(currentColor);
        
        // Add display name
        addDisplayName();
        
        // Setup keyboard shortcuts
        setupKeyboardShortcuts();
        
        return; // Don't start countdown intervals
    }

    const remainingRatio = calculateRemainingRatio();
    currentColor = getColorForRemainingRatio(remainingRatio);
    targetColor = currentColor;
    applyColor(currentColor);
    updateCountdown();

    // Start intervals
    updateInterval = setInterval(updateCountdown, updateIntervalMs);
    colorInterval = setInterval(updateColorTransition, colorIntervalMs);
    lastRealTime = Date.now();

    // Add display name
    addDisplayName();

    // Keyboard shortcuts (no visible buttons)
    setupKeyboardShortcuts();
}

function setupKeyboardShortcuts() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Space - Pause/Resume (only if not typing in input)
        if (e.code === 'Space' && e.target === document.body) {
            e.preventDefault();
            togglePause();
        }
        // F - Fullscreen
        if (e.code === 'KeyF') {
            e.preventDefault();
            toggleFullscreen();
        }
        // H - Hide/Show display name
        if (e.code === 'KeyH') {
            e.preventDefault();
            toggleHide();
        }
    });
}

/**
 * Toggle notification permission
 */
async function toggleNotifications() {
    const notifBtn = document.getElementById('notifBtn');
    if (!notifBtn) return;

    const currentPermission = getNotificationPermission();
    
    if (currentPermission === 'granted') {
        // Can't revoke, but we can indicate it's enabled
        notifBtn.textContent = '🔔 Notify';
        notifBtn.title = 'Notifications enabled';
        alert('Notifications are already enabled. To disable, use browser settings.');
    } else {
        const result = await requestNotificationPermission();
        if (result === 'granted') {
            notifBtn.textContent = '🔔 Notify';
            notifBtn.title = 'Notifications enabled';
            // Send a test notification
            try {
                new Notification('Notifications Enabled!', {
                    body: 'You will be notified when the timer expires.',
                    tag: 'test-notification'
                });
            } catch (e) {
                console.log('Test notification error:', e);
            }
        } else {
            notifBtn.textContent = '🔕 Notify';
            notifBtn.title = 'Notifications denied';
        }
    }
}

function addDisplayName() {
    // Display name is already in HTML template, just update visibility
    if (!DISPLAY_NAME) return;
    
    const nameEl = document.getElementById('displayName');
    if (nameEl) {
        nameEl.style.opacity = displayNameVisible ? '1' : '0';
    }
}

/**
 * Ensure the phase label line exists (window / checkpoints modes).
 * @returns {HTMLElement} The label element
 */
function ensurePhaseLabel() {
    let el = document.getElementById('phaseLabel');
    if (!el) {
        el = document.createElement('div');
        el.id = 'phaseLabel';
        el.className = 'phase-label';
        const display = document.getElementById('display');
        if (display && display.parentNode) {
            display.parentNode.insertBefore(el, display);
        } else {
            document.body.prepend(el);
        }
    }
    return el;
}

/**
 * Update the phase label + checkpoint rail. Returns the label text.
 * @returns {string} Current phase label text
 */
function updatePhaseLabel() {
    const el = ensurePhaseLabel();
    const info = getPhaseLabel();
    if (el.textContent !== info.text) el.textContent = info.text;
    el.dataset.phase = info.phase;
    document.body.dataset.modePhase = info.phase;
    if (DISPLAY_MODE === 'checkpoints') updateCheckpointRail();
    return info.text;
}

/**
 * Render/update the checkpoint rail (one row per trigger: done/next/todo).
 */
function updateCheckpointRail() {
    let rail = document.getElementById('checkpointRail');
    if (!rail) {
        rail = document.createElement('div');
        rail.id = 'checkpointRail';
        rail.className = 'checkpoint-rail';
        const display = document.getElementById('display');
        if (display && display.parentNode) {
            display.parentNode.insertBefore(rail, display.nextSibling);
        } else {
            document.body.appendChild(rail);
        }
    }
    const legs = getCheckpoints();
    const now = Date.now();
    const nextIdx = legs.findIndex(l => l.at > now);

    if (rail.children.length !== legs.length) {
        rail.innerHTML = '';
        legs.forEach((leg) => {
            const row = document.createElement('div');
            row.className = 'checkpoint';
            const dot = document.createElement('span');
            dot.className = 'checkpoint-dot';
            const lbl = document.createElement('span');
            lbl.className = 'checkpoint-label';
            row.appendChild(dot);
            row.appendChild(lbl);
            rail.appendChild(row);
        });
    }

    legs.forEach((leg, i) => {
        const row = rail.children[i];
        const state = leg.at <= now ? 'done' : (i === nextIdx ? 'next' : 'todo');
        if (row.dataset.state !== state) {
            row.dataset.state = state;
            row.className = `checkpoint is-${state}`;
        }
        const d = new Date(leg.at);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const text = `${hh}:${mm}${leg.label ? ' · ' + leg.label : ''}`;
        const lbl = row.querySelector('.checkpoint-label');
        if (lbl && lbl.textContent !== text) lbl.textContent = text;
    });
}

/**
 * Update watermark color based on build age
 * Fresh (built today) = cyan/green, Old = orange/red
 */
function updateWatermarkAge() {
    const watermark = document.querySelector('.version-watermark');
    if (!watermark) return;
    
    const buildDate = watermark.dataset.build;
    if (!buildDate) return;
    
    // Parse: 2.0.0.20260325123452.stable
    const parts = buildDate.split('.');
    if (parts.length < 3) return;
    
    const timestamp = parts[2]; // 20260325123452
    try {
        // Parse timestamp: YYYYMMDDHHMMSS
        const year = parseInt(timestamp.slice(0, 4));
        const month = parseInt(timestamp.slice(4, 6));
        const day = parseInt(timestamp.slice(6, 8));
        
        const now = new Date();
        
        // Check if built today (same calendar day)
        const isToday = (day === now.getDate() && 
                        month === (now.getMonth() + 1) && 
                        year === now.getFullYear());
        
        if (isToday) {
            watermark.dataset.age = 'fresh';
        } else {
            watermark.dataset.age = 'old';
        }
    } catch (e) {
        console.log('Watermark age check error:', e);
    }
}

/**
 * Show/hide watermark based on cursor proximity to bottom-right corner
 */
function setupWatermarkVisibility() {
    const watermark = document.querySelector('.version-watermark');
    if (!watermark) return;

    const showThreshold = 200; // pixels from corner

    document.addEventListener('mousemove', (e) => {
        const rect = watermark.getBoundingClientRect();
        const distX = Math.abs(e.clientX - rect.left);
        const distY = Math.abs(e.clientY - rect.top);

        // Show if cursor is near the watermark
        if (distX < showThreshold && distY < showThreshold) {
            watermark.classList.add('visible');
        } else {
            watermark.classList.remove('visible');
        }
    });
}

/**
 * Toggle pause/resume
 */
function togglePause() {
    isPaused = !isPaused;

    if (isPaused) {
        pausedAt = Date.now();
        console.log('[Timer] Paused');
        document.body.classList.add('paused');
        document.title = '⏸️ PAUSED';
    } else {
        const pauseDuration = Date.now() - pausedAt;
        
        // Calculate gap between display (frozen) and actual (kept running)
        const currentActual = getCurrentTimeValue();
        catchupRemaining = Math.max(0, currentActual - displayTime);
        
        if (catchupRemaining > 1000 && pauseDuration > 1000) {
            // Smooth catchup over 5 seconds
            catchupStartTime = Date.now();
            console.log(`[Timer] Resumed, catching up ${catchupRemaining}ms over 5s`);
        } else {
            // Short pause, sync immediately
            displayTime = currentActual;
            catchupRemaining = 0;
            console.log('[Timer] Resumed');
        }
        
        document.body.classList.remove('paused');
        // Restore title with display name
        const displayName = DISPLAY_NAME || '7 Segment Timer';
        document.title = displayName;
    }
}

/**
 * Toggle hide/show display name
 */
function toggleHide() {
    const displayName = document.querySelector('.timer-display-name');

    displayNameVisible = !displayNameVisible;

    if (displayName) {
        displayName.style.opacity = displayNameVisible ? '1' : '0';
    }

    console.log('[Timer] Display name', displayNameVisible ? 'shown' : 'hidden');
}

/**
 * Toggle fullscreen
 */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('[Fullscreen] Error:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// Start initialization
init();

// Update watermark age and setup visibility after a short delay
setTimeout(() => {
    updateWatermarkAge();
    setupWatermarkVisibility();
}, 500);
