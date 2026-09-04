// ============ KIOSK MODE (distraction-free fullscreen display) ============
// Toggle with the K key, a ?kiosk=1 URL, or toggleKiosk() from page buttons.
// Hides chrome + cursor (reappears on mouse move, hides after 3s idle).
var kioskOn = false;
var kioskCursorTimer = null;

function setKiosk(on) {
    kioskOn = !!on;
    document.body.classList.toggle('kiosk', kioskOn);
    if (kioskOn) {
        try {
            var p = document.documentElement.requestFullscreen
                ? document.documentElement.requestFullscreen() : null;
            if (p && p.catch) p.catch(function () { /* needs a user gesture */ });
        } catch (e) { /* noop */ }
        kioskHideCursorSoon();
    } else {
        try {
            if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen();
        } catch (e) { /* noop */ }
        document.body.style.cursor = '';
    }
}

function toggleKiosk() {
    setKiosk(!kioskOn);
}

function kioskHideCursorSoon() {
    if (kioskCursorTimer) clearTimeout(kioskCursorTimer);
    kioskCursorTimer = setTimeout(function () {
        if (kioskOn) document.body.style.cursor = 'none';
    }, 3000);
}

document.addEventListener('mousemove', function () {
    if (!kioskOn) return;
    document.body.style.cursor = '';
    kioskHideCursorSoon();
});

document.addEventListener('keydown', function (e) {
    if ((e.code === 'KeyK' || e.key === 'k' || e.key === 'K') && e.target === document.body) {
        e.preventDefault();
        toggleKiosk();
    }
});

document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && kioskOn) setKiosk(false);
});

// ?kiosk=1 drops chrome immediately (fullscreen still needs one tap/click).
(function () {
    try {
        var q = new URLSearchParams(window.location.search || '');
        if (q.get('kiosk') === '1') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () { setKiosk(true); });
            } else {
                setKiosk(true);
            }
        }
    } catch (e) { /* noop */ }
})();
