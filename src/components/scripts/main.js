// Timer state
let isPaused = false;
let pausedAt = null;
let pauseOffset = 0;
let updateInterval;
let colorInterval;
let lastRealTime = Date.now();

// Speed adjustment for sync
let speedFactor = 1.0;

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
    // Use the new direction-aware time value function
    const currentTimeValue = getCurrentTimeValue();
    
    // For down direction, check if expired
    if (DIRECTION === 'down' && isExpired()) {
        if (!hasExpired) {
            handleExpiry();
        }

        // Handle different expiry behaviors
        const onExpire = ON_EXPIRE || 'stop';

        if (onExpire === 'continue') {
            // Show negative time
            const elapsed = getTimeSinceExpiry();
            const timeStr = formatNegativeTime(elapsed);
            updateDisplay(timeStr);
            document.title = `${timeStr.split('.')[0]} - ${DISPLAY_NAME || 'Timer'}`;
        } else if (onExpire !== 'hide') {
            // Stop at zero (default behavior)
            updateDisplay('00:00:00:00');
        }
        // 'hide' is handled by showExpiredMessage()
        return;
    }

    // For up direction, just display elapsed time
    if (DIRECTION === 'up') {
        const timeStr = formatTime(currentTimeValue);
        updateDisplay(timeStr);
        document.title = `${timeStr.split('.')[0]} - ${DISPLAY_NAME || 'Timer'}`;
        return;
    }

    // For down direction (not expired yet)
    const timeStr = formatTime(Math.max(0, currentTimeValue));
    updateDisplay(timeStr);

    // Update document title
    const displayName = DISPLAY_NAME || '7 Segment Timer';
    document.title = `${timeStr.split('.')[0]} - ${displayName}`;
}

function togglePause() {
    const pauseBtn = document.getElementById('pauseBtn');
    if (!pauseBtn) return;
    
    if (isPaused) {
        // Resume - calculate how much time we missed
        isPaused = false;
        const resumeTime = Date.now();
        const pauseDuration = resumeTime - pausedAt;
        
        // Add the paused duration to offset so we don't lose time
        pauseOffset -= pauseDuration;
        pausedAt = null;
        
        // Set high speed factor for exponential catchup
        speedFactor = 1.5; // Start at 50% faster
        
        pauseBtn.textContent = '⏸️ Pause';
        pauseBtn.title = 'Pause timer';
        
        // Restart intervals
        updateInterval = setInterval(updateCountdown, 10);
        colorInterval = setInterval(updateColorTransition, 30);
        lastRealTime = Date.now();
    } else {
        // Pause
        isPaused = true;
        pausedAt = Date.now();
        
        pauseBtn.textContent = '▶️ Resume';
        pauseBtn.title = 'Resume timer';
        
        // Clear intervals
        if (updateInterval) clearInterval(updateInterval);
        if (colorInterval) clearInterval(colorInterval);
    }
}

function toggleFullscreen() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('Fullscreen error:', err);
        });
        if (fullscreenBtn) {
            fullscreenBtn.textContent = '⛶ Exit Fullscreen';
            fullscreenBtn.title = 'Exit fullscreen';
        }
    } else {
        document.exitFullscreen();
        if (fullscreenBtn) {
            fullscreenBtn.textContent = '⛶ Fullscreen';
            fullscreenBtn.title = 'Enter fullscreen';
        }
    }
}

// Listen for fullscreen changes
document.addEventListener('fullscreenchange', () => {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (!document.fullscreenElement) {
        if (fullscreenBtn) {
            fullscreenBtn.textContent = '⛶ Fullscreen';
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

    const remainingRatio = calculateRemainingRatio();
    currentColor = getColorForRemainingRatio(remainingRatio);
    targetColor = currentColor;
    applyColor(currentColor);
    updateCountdown();

    // Start intervals
    updateInterval = setInterval(updateCountdown, updateIntervalMs);
    colorInterval = setInterval(updateColorTransition, colorIntervalMs);
    lastRealTime = Date.now();

    // Add control buttons (only if not embedded)
    if (!isEmbedded) {
        addControlButtons();
        addDisplayName();
    }
}

function addControlButtons() {
    const controls = document.createElement('div');
    controls.className = 'timer-controls';
    
    // Check initial notification permission
    const notifPermission = getNotificationPermission();
    const notifBtnTitle = notifPermission === 'granted' ? 'Notifications enabled' : 'Enable notifications';
    const notifBtnIcon = notifPermission === 'granted' ? '🔔' : '🔕';
    
    controls.innerHTML = `
        <button id="pauseBtn" class="control-btn" title="Pause timer">⏸️ Pause</button>
        <button id="notifBtn" class="control-btn" title="${notifBtnTitle}">${notifBtnIcon} Notify</button>
        <button id="fullscreenBtn" class="control-btn" title="Enter fullscreen">⛶ Fullscreen</button>
    `;
    document.body.appendChild(controls);

    // Add event listeners
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('notifBtn').addEventListener('click', toggleNotifications);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target === document.body) {
            e.preventDefault();
            togglePause();
        }
        if (e.code === 'KeyF') {
            toggleFullscreen();
        }
        if (e.code === 'KeyN') {
            toggleNotifications();
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
    if (!DISPLAY_NAME) return;

    const nameEl = document.createElement('div');
    nameEl.className = 'timer-display-name';
    nameEl.textContent = DISPLAY_NAME;
    document.body.appendChild(nameEl);
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

// Start initialization
init();

// Update watermark age and setup visibility after a short delay
setTimeout(() => {
    updateWatermarkAge();
    setupWatermarkVisibility();
}, 500);
