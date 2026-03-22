// Timer state
let isPaused = false;
let pausedAt = null;
let pauseOffset = 0;
let updateInterval;
let colorInterval;

// Speed adjustment for sync
let speedFactor = 1.0;
const SYNC_THRESHOLD_MS = 1000; // Only adjust if off by more than 1 second
const MAX_SPEED_ADJUSTMENT = 0.1; // Max 10% speed change

// Check if embedded in iframe
const isEmbedded = window.self !== window.top;

function updateCountdown() {
    const target = new Date(TARGET_TIME).getTime();
    const start = new Date(START_TIME).getTime();
    let now = Date.now();
    
    // Adjust for pause time
    if (isPaused && pausedAt) {
        now = pausedAt;
    } else if (pauseOffset > 0) {
        now = now - pauseOffset;
    }
    
    // Apply speed factor for sync adjustment
    const elapsed = (now - start) * speedFactor;
    const adjustedNow = start + elapsed;
    
    const remaining = target - adjustedNow;
    const timeStr = formatTime(Math.max(0, remaining));
    updateDisplay(timeStr);
    
    // Update document title
    const displayName = DISPLAY_NAME || '7 Segment Timer';
    document.title = `${timeStr.split('.')[0]} - ${displayName}`;
    
    // Update progress ring
    updateProgressRing(remaining, target - start);
    
    // Gradually adjust speed to sync (if not paused)
    if (!isPaused && speedFactor !== 1.0) {
        speedFactor = speedFactor * 0.999 + 1.0 * 0.001; // Gradually return to 1.0
        if (Math.abs(speedFactor - 1.0) < 0.0001) {
            speedFactor = 1.0;
        }
    }
}

function adjustSpeedForSync(expectedRemaining, actualRemaining) {
    const diff = expectedRemaining - actualRemaining;
    
    // Only adjust if difference is significant
    if (Math.abs(diff) < SYNC_THRESHOLD_MS) return;
    
    // Calculate speed adjustment
    const adjustment = Math.sign(diff) * Math.min(MAX_SPEED_ADJUSTMENT, Math.abs(diff) / 60000);
    speedFactor = Math.max(0.9, Math.min(1.1, speedFactor + adjustment));
    
    console.log(`[Sync] Speed adjusted to ${(speedFactor * 100).toFixed(2)}% (diff: ${diff}ms)`);
}

function updateProgressRing(remaining, total) {
    const ring = document.getElementById('progressRing');
    const ringText = document.getElementById('progressPercent');
    
    if (!ring) return;
    
    const progress = Math.max(0, Math.min(1, 1 - (remaining / total)));
    const circumference = 2 * Math.PI * 45; // r=45
    const offset = circumference * (1 - progress);
    
    ring.style.strokeDashoffset = offset;
    
    if (ringText) {
        ringText.textContent = `${(progress * 100).toFixed(1)}%`;
    }
}

function togglePause() {
    const pauseBtn = document.getElementById('pauseBtn');
    if (!pauseBtn) return;
    
    if (isPaused) {
        // Resume
        isPaused = false;
        const resumeTime = Date.now();
        pauseOffset += resumeTime - pausedAt;
        pausedAt = null;
        
        pauseBtn.textContent = '⏸️ Pause';
        pauseBtn.title = 'Pause timer';
        
        // Restart intervals
        updateInterval = setInterval(updateCountdown, 10);
        colorInterval = setInterval(updateColorTransition, 30);
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
    updateInterval = setInterval(updateCountdown, 10);
    colorInterval = setInterval(updateColorTransition, 30);
    
    // Add control buttons and progress ring (only if not embedded)
    if (!isEmbedded) {
        addControlButtons();
        addProgressRing();
        addDisplayName();
    }
}

function addControlButtons() {
    const controls = document.createElement('div');
    controls.className = 'timer-controls';
    controls.innerHTML = `
        <button id="pauseBtn" class="control-btn" title="Pause timer">⏸️ Pause</button>
        <button id="fullscreenBtn" class="control-btn" title="Enter fullscreen">⛶ Fullscreen</button>
    `;
    document.body.appendChild(controls);
    
    // Add event listeners
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
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
    });
}

function addProgressRing() {
    const ringContainer = document.createElement('div');
    ringContainer.className = 'progress-ring-container';
    ringContainer.innerHTML = `
        <svg class="progress-ring" width="100" height="100" viewBox="0 0 100 100">
            <circle class="progress-ring-bg" cx="50" cy="50" r="45"></circle>
            <circle id="progressRing" class="progress-ring-fill" cx="50" cy="50" r="45"></circle>
        </svg>
        <span id="progressPercent" class="progress-percent">0%</span>
    `;
    document.body.appendChild(ringContainer);
}

function addDisplayName() {
    if (!DISPLAY_NAME) return;
    
    const nameEl = document.createElement('div');
    nameEl.className = 'timer-display-name';
    nameEl.textContent = DISPLAY_NAME;
    document.body.appendChild(nameEl);
}

// Start initialization
init();
