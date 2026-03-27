// Color update throttling state
let lastColorUpdate = 0;
let colorUpdateCounter = 0;

function setTargetColor(color) {
    targetColor = color;
    colorTransitionProgress = 0;
}

function updateColorTransition() {
    const remainingRatio = calculateRemainingRatio();
    const calculatedColor = getColorForRemainingRatio(remainingRatio);

    if (calculatedColor !== targetColor) {
        setTargetColor(calculatedColor);
    }

    // Throttle color updates based on remaining time
    // When >50% time remaining, update less frequently (every 10 calls)
    // When <50% time remaining, update more frequently (every 3 calls)
    // When <10% time remaining, update every call for smooth transition
    const now = Date.now();
    let shouldUpdate = false;

    if (remainingRatio > 0.5) {
        // Far from expiry - update every 300ms
        shouldUpdate = (now - lastColorUpdate) > 300;
    } else if (remainingRatio > 0.1) {
        // Getting close - update every 100ms
        shouldUpdate = (now - lastColorUpdate) > 100;
    } else {
        // Very close - update every 30ms for smooth transition
        shouldUpdate = (now - lastColorUpdate) > 30;
    }

    if (!shouldUpdate) {
        return;
    }

    lastColorUpdate = now;

    if (colorTransitionProgress < 1) {
        colorTransitionProgress += 0.1;
        if (colorTransitionProgress > 1) colorTransitionProgress = 1;

        currentColor = lerpColor(currentColor, targetColor, colorTransitionProgress);

        if (colorTransitionProgress >= 1) {
            currentColor = targetColor;
        }

        applyColor(currentColor);
    }
}

/**
 * Request browser notification permission
 * @returns {Promise<string>} Permission status: 'granted', 'denied', or 'default'
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('[Notification] Browser does not support notifications');
        notificationPermission = 'denied';
        return 'denied';
    }

    if (Notification.permission === 'granted') {
        notificationPermission = 'granted';
        return 'granted';
    }

    if (Notification.permission === 'denied') {
        notificationPermission = 'denied';
        return 'denied';
    }

    try {
        const permission = await Notification.requestPermission();
        notificationPermission = permission;
        console.log('[Notification] Permission:', permission);
        return permission;
    } catch (e) {
        console.warn('[Notification] Error requesting permission:', e);
        notificationPermission = 'denied';
        return 'denied';
    }
}

/**
 * Send browser notification when timer expires
 */
function sendExpiryNotification() {
    if (!('Notification' in window)) {
        console.log('[Notification] Browser does not support notifications');
        return;
    }

    if (Notification.permission !== 'granted') {
        console.log('[Notification] Permission not granted');
        return;
    }

    const displayName = DISPLAY_NAME || 'Timer';
    
    try {
        const notification = new Notification('⏰ Timer Expired!', {
            body: `${displayName} has ended!`,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏱️</text></svg>',
            tag: 'timer-expired',
            requireInteraction: false
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        console.log('[Notification] Expiry notification sent');
    } catch (e) {
        console.warn('[Notification] Error sending notification:', e);
    }
}

/**
 * Get current notification permission status
 * @returns {string} Permission status: 'granted', 'denied', or 'default'
 */
function getNotificationPermission() {
    if (!('Notification' in window)) {
        return 'denied';
    }
    return Notification.permission;
}
