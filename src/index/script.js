// ============================================
// REAL-TIME PROGRESS BAR UPDATES
// ============================================

/**
 * Update all progress bars based on current time
 */
function updateProgressBars() {
    const now = new Date();

    document.querySelectorAll('.timer-card').forEach(card => {
        const timeInfo = card.querySelector('.time-info');
        if (!timeInfo) return;

        const startText = timeInfo.querySelector('.start')?.textContent;
        const targetText = timeInfo.querySelector('.target')?.textContent;

        if (!startText || !targetText) return;

        // Parse times (remove emojis and labels)
        const start = new Date(startText.replace('📅 Start: ', '').trim());
        const target = new Date(targetText.replace('🎯 Target: ', '').trim());

        // Calculate progress and update display
        let progress, progressText;

        if (now > target) {
            // Timer has ended
            progress = 100;
            progressText = '100.00%';

            // Update status if needed
            if (card.dataset.status !== 'ended') {
                card.dataset.status = 'ended';
                const statusBadge = card.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.textContent = 'Ended';
                    statusBadge.className = 'status-badge status-ended';
                }
            }
        } else if (now < start) {
            // Timer hasn't started yet
            progress = 0;
            progressText = '???.??%';
        } else {
            // Timer is running
            const total = (target - start);
            const elapsed = (now - start);
            progress = (elapsed / total) * 100;
            // Format as ###.##% (e.g., 033.00%, 100.00%)
            progressText = `${progress.toFixed(2).toString().padStart(6, '0')}%`;
        }

        // Update progress bar and text
        const progressFill = card.querySelector('.progress-fill');
        const progressTextEl = card.querySelector('.progress-text');

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        if (progressTextEl) {
            progressTextEl.textContent = progressText;
        }
    });
}

// Update progress bars every second
setInterval(updateProgressBars, 1000);

// Initial update
updateProgressBars();

/**
 * Update watermark color based on build age
 * Fresh (built today) = cyan/green, Old = orange/red
 */
function updateWatermarkAge() {
    const watermark = document.querySelector('.version-watermark-selector');
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
    const watermark = document.querySelector('.version-watermark-selector');
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

// Update watermark age after a short delay
setTimeout(() => {
    updateWatermarkAge();
    setupWatermarkVisibility();
}, 500);
