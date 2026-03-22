// Timer state
let isPaused = false;
let pausedAt = null;
let pauseOffset = 0;
let updateInterval;
let colorInterval;

function updateCountdown() {
    const target = new Date(TARGET_TIME).getTime();
    let now = Date.now();
    
    // Adjust for pause time
    if (isPaused && pausedAt) {
        now = pausedAt;
    } else if (pauseOffset > 0) {
        now = now - pauseOffset;
    }
    
    const remaining = target - now;
    const timeStr = formatTime(Math.max(0, remaining));
    updateDisplay(timeStr);
    
    // Update document title
    document.title = timeStr.split('.')[0] + ' - 7 Segment Timer';
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
    
    // Add control buttons to the page
    addControlButtons();
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

// Start initialization
init();
