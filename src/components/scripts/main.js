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

    // Update document title
    const displayName = DISPLAY_NAME || '7 Segment Timer';
    document.title = `${timeStr.split('.')[0]} - ${displayName}`;

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
