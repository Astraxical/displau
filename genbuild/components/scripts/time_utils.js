/**
 * Check if the timer has expired
 * @returns {boolean} True if current time is past target time
 */
function isExpired() {
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
    const totalDuration = target - start;
    const elapsed = now - start;
    const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
    return 1 - progress; // 1 = full time remaining, 0 = no time
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
