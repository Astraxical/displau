// ============ PAGE LOCK (privacy screen) ============
// Active only when LOCK_HASH is non-empty (injected at build time).
// Deterrent-grade privacy for static hosting: keeps casual snoopers out,
// but the underlying files remain publicly fetchable by design.
var LOCK_HASH = '{{LOCK_HASH}}';
var LOCK_HINT = '{{LOCK_HINT}}';
var LOCK_SESSION_KEY = 'displau_unlocked';

/**
 * Compact synchronous SHA-256 (hex). Works on http/https/file:// alike.
 */
function sha256Hex(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var maxWord = Math.pow(2, 32), result = '';
    var words = [], asciiBitLength = ascii.length * 8;
    var hash = sha256Hex.h = sha256Hex.h || [], k = sha256Hex.k = sha256Hex.k || [];
    var primeCounter = k.length, isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (var i = 0; i < 313; i += candidate) isComposite[i] = candidate;
            hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
            k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
        }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (var i = 0; i < ascii.length; i++) {
        var j = ascii.charCodeAt(i);
        if (j >> 8) return '';
        words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (var j = 0; j < words.length;) {
        var w = words.slice(j, j += 16), oldHash = hash;
        hash = hash.slice(0, 8);
        for (var i = 0; i < 64; i++) {
            var w15 = w[i - 15], w2 = w[i - 2];
            var a = hash[0], e = hash[4];
            var temp1 = hash[7]
                + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
                + ((e & hash[5]) ^ (~e & hash[6]))
                + k[i]
                + (w[i] = (i < 16) ? w[i] : (w[i - 16]
                    + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
                    + w[i - 7]
                    + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
            var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
            hash = [(temp1 + temp2) | 0].concat(hash);
            hash[4] = (hash[4] + temp1) | 0;
        }
        for (var i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (var i = 0; i < 8; i++) {
        for (var j = 3; j + 1; j--) {
            var b = (hash[i] >> (j * 8)) & 255;
            result += ((b < 16) ? '0' : '') + b.toString(16);
        }
    }
    return result;
}

function lockIsEnabled() {
    return typeof LOCK_HASH === 'string' && LOCK_HASH.length >= 8 && LOCK_HASH !== '{{LOCK_H' + 'ASH}}';
}

function lockIsUnlocked() {
    try {
        return window.sessionStorage && sessionStorage.getItem(LOCK_SESSION_KEY) === LOCK_HASH;
    } catch (e) {
        return false;
    }
}

function buildLockScreen() {
    var old = document.getElementById('lockScreen');
    if (old) old.remove();
    var scr = document.createElement('div');
    scr.id = 'lockScreen';
    scr.className = 'lock-screen';
    scr.innerHTML =
        '<div class="lock-card">' +
        '<div class="lock-icon">\uD83D\uDD12</div>' +
        '<div class="lock-title">Private timers</div>' +
        '<div class="lock-sub">Enter PIN to peek \u2665</div>' +
        '<div class="lock-dots" id="lockDots"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>' +
        '<div class="lock-pad" id="lockPad">' +
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '\u232B'].map(function (k) {
            return '<button type="button" data-key="' + k + '">' + k + '</button>';
        }).join('') +
        '</div>' +
        (LOCK_HINT ? '<div class="lock-hint">' + LOCK_HINT.replace(/</g, '&lt;') + '</div>' : '') +
        '</div>';
    document.body.appendChild(scr);

    var pin = '';
    var dots = scr.querySelectorAll('#lockDots span');
    function paint() {
        dots.forEach(function (d, i) { d.classList.toggle('on', i < pin.length); });
    }
    function submit() {
        if (!pin.length) return;
        if (sha256Hex(pin) === LOCK_HASH) {
            try { sessionStorage.setItem(LOCK_SESSION_KEY, LOCK_HASH); } catch (e) { /* noop */ }
            document.body.classList.remove('locked');
            scr.remove();
        } else {
            scr.classList.remove('shake');
            void scr.offsetWidth;
            scr.classList.add('shake');
            pin = '';
            paint();
        }
    }
    scr.querySelectorAll('#lockPad button').forEach(function (b) {
        b.addEventListener('click', function () {
            var k = b.getAttribute('data-key');
            if (k === 'C') { pin = ''; }
            else if (k === '\u232B') { pin = pin.slice(0, -1); }
            else if (pin.length < 8) { pin += k; }
            paint();
            if (pin.length >= 4) submit();
        });
    });
    document.addEventListener('keydown', function lockKeys(e) {
        if (!document.getElementById('lockScreen')) {
            document.removeEventListener('keydown', lockKeys);
            return;
        }
        if (/^[0-9]$/.test(e.key) && pin.length < 8) {
            pin += e.key;
            paint();
            if (pin.length >= 4) submit();
        } else if (e.key === 'Backspace') {
            pin = pin.slice(0, -1);
            paint();
        } else if (e.key === 'Escape') {
            pin = '';
            paint();
        }
    });
    paint();
}

/** Show the lock screen immediately (page just loaded). */
function lockShow() {
    if (!lockIsEnabled()) return;
    document.body.classList.add('locked');
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildLockScreen);
    } else {
        buildLockScreen();
    }
}

/** Re-lock now (forgets this tab's unlock). Bound to the L key + lock buttons. */
function lockNow() {
    if (!lockIsEnabled()) return;
    try { sessionStorage.removeItem(LOCK_SESSION_KEY); } catch (e) { /* noop */ }
    lockShow();
}

document.addEventListener('keydown', function (e) {
    if ((e.code === 'KeyL' || e.key === 'l' || e.key === 'L') && e.target === document.body && lockIsEnabled()) {
        e.preventDefault();
        lockNow();
    }
});

// Auto-gate on script load.
(function () {
    if (!lockIsEnabled() || lockIsUnlocked()) return;
    lockShow();
})();
