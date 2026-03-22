// Timer state
let isPaused = false;
let pausedAt = null;
let pauseOffset = 0;
let updateInterval;
let colorInterval;
let lastRealTime = Date.now();

// Speed adjustment for sync
let speedFactor = 1.0;

// Check if embedded in iframe
const isEmbedded = window.self !== window.top;

function updateCountdown() {
    const target = new Date(TARGET_TIME).getTime();
    const start = new Date(START_TIME).getTime();
    const realNow = Date.now();
    
    // Calculate actual elapsed time since last update
    const deltaTime = realNow - lastRealTime;
    lastRealTime = realNow;
    
    // If paused, don't accumulate time
    if (isPaused) {
        pausedAt = realNow;
        return;
    }
    
    // Apply speed factor to elapsed time
    const adjustedDelta = deltaTime * speedFactor;
    pauseOffset += adjustedDelta - deltaTime;
    
    // Calculate current time with offset
    let now = realNow + pauseOffset;
    
    const remaining = target - now;
    const total = target - start;
    const timeStr = formatTime(Math.max(0, remaining));
    updateDisplay(timeStr);
    
    // Update document title
    const displayName = DISPLAY_NAME || '7 Segment Timer';
    document.title = `${timeStr.split('.')[0]} - ${displayName}`;
    
    // Exponential speed adjustment based on how far off we are
    const expectedRemaining = total - (realNow - start);
    const diff = expectedRemaining - remaining;
    
    if (Math.abs(diff) > 100) { // Only adjust if off by more than 100ms
        // Exponential factor: larger diff = faster catchup
        const catchupFactor = Math.min(0.5, Math.abs(diff) / 10000); // Max 50% speed change
        speedFactor = 1.0 + Math.sign(diff) * catchupFactor;
    } else {
        // Gradually return to normal speed
        speedFactor = speedFactor * 0.95 + 1.0 * 0.05;
        if (Math.abs(speedFactor - 1.0) < 0.0001) {
            speedFactor = 1.0;
        }
    }
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

function addDisplayName() {
    if (!DISPLAY_NAME) return;
    
    const nameEl = document.createElement('div');
    nameEl.className = 'timer-display-name';
    nameEl.textContent = DISPLAY_NAME;
    document.body.appendChild(nameEl);
}

// Start initialization
init();
