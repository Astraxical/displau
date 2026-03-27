/**
 * Get the current time value based on direction (up or down)
 * @returns {number} Current time value in milliseconds
 */
function getCurrentTimeValue() {
    const start = new Date(START_TIME).getTime();
    const target = new Date(TARGET_TIME).getTime();
    const now = Date.now();

    // Apply pause offset (for catchup after pause)
    const adjustedNow = now - pauseOffset;

    if (DIRECTION === 'up') {
        // Counting up from start_time (stopwatch mode)
        const elapsed = adjustedNow - start;

        // Apply max_value limit if set
        if (MAX_VALUE !== null && elapsed > MAX_VALUE) {
            return MAX_VALUE;
        }

        // Apply min_value limit if set
        if (MIN_VALUE !== null && elapsed < MIN_VALUE) {
            return MIN_VALUE;
        }

        return elapsed;
    } else {
        // Counting down to target_time (classic mode)
        const remaining = target - adjustedNow;

        // Apply min_value limit if set
        if (MIN_VALUE !== null && remaining < MIN_VALUE) {
            return MIN_VALUE;
        }

        // Apply max_value limit if set
        if (MAX_VALUE !== null && remaining > MAX_VALUE) {
            return MAX_VALUE;
        }

        return remaining;
    }
}

/**
 * Check if the timer has expired (only applies to down direction)
 * @returns {boolean} True if current time is past target time
 */
function isExpired() {
    if (DIRECTION === 'up') {
        return false; // Up direction never expires
    }
    const target = new Date(TARGET_TIME).getTime();
    const now = Date.now();
    return now >= target;
}

/**
 * Calculate the ratio of time remaining (1 = full time, 0 = expired)
 * @returns {number} Remaining ratio between 0 and 1
 */
function calculateRemainingRatio() {
    const start = new Date(START_TIME).getTime();
    const target = new Date(TARGET_TIME).getTime();
    const now = Date.now();
    
    if (DIRECTION === 'up') {
        // For up direction, ratio increases from 0 to 1
        const totalDuration = target - start;
        const elapsed = now - start;
        const progress = elapsed / totalDuration;
        return Math.min(1, Math.max(0, progress));
    } else {
        // For down direction, ratio decreases from 1 to 0
        const totalDuration = target - start;
        const elapsed = now - start;
        const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
        return 1 - progress; // 1 = full time remaining, 0 = no time
    }
}

/**
 * Format time in milliseconds to display string
 * @param {number} ms - Milliseconds remaining
 * @returns {string} Formatted time string
 */
function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    if (days >= 1000) {
        return `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else if (days >= 100) {
        return `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else if (days >= 10) {
        return `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else if (days >= 1) {
        return `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else if (hours >= 10) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else if (hours >= 1) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(Math.floor(milliseconds / 100))}`;
    } else if (minutes >= 10) {
        return `${String(minutes)}:${String(seconds).padStart(2, '0')}.${String(Math.floor(milliseconds / 10)).padStart(2, '0')}`;
    } else {
        return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    }
}

/**
 * Format negative time (for post-expiry display when on_expire is 'continue')
 * @param {number} ms - Milliseconds past target (negative value)
 * @returns {string} Formatted negative time string with minus sign
 */
function formatNegativeTime(ms) {
    const absMs = Math.abs(ms);
    const totalSeconds = Math.floor(absMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = absMs % 1000;

    let timeStr;
    if (days >= 1) {
        timeStr = `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else if (hours >= 10) {
        timeStr = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else if (hours >= 1) {
        timeStr = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(Math.floor(milliseconds / 100))}`;
    } else if (minutes >= 10) {
        timeStr = `${String(minutes)}:${String(seconds).padStart(2, '0')}.${String(Math.floor(milliseconds / 10)).padStart(2, '0')}`;
    } else {
        timeStr = `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    }
    return `-${timeStr}`;
}

/**
 * Get time elapsed since expiry
 * @returns {number} Milliseconds since target time was reached
 */
function getTimeSinceExpiry() {
    const target = new Date(TARGET_TIME).getTime();
    const now = Date.now();
    return now - target;
}
