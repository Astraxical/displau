/**
 * Recurrence engine v2 — weekly (multi-slot), daily, and fixed-interval.
 *
 * Backward compatible: legacy single-slot fields (RECUR_WEEKDAY / RECUR_TIME /
 * RECUR_END) are auto-converted into a one-entry schedule when no
 * RECUR_SCHEDULE is provided.
 *
 * Slot shape: { weekday: 0-6 | null, start: 'HH:MM:SS', end: 'HH:MM:SS' | null, label: string }
 * Rule: RECUR_RULE = 'weekly' | 'daily' | 'interval'
 */

var WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Normalize any weekday representation to 0=Sunday ... 6=Saturday.
 * Accepts numbers, numeric strings, and day names. Returns null when unknown.
 */
function normalizeWeekday(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        var n = Math.trunc(value);
        return (n >= 0 && n <= 6) ? n : null;
    }
    var s = String(value).trim().toLowerCase();
    var idx = WEEKDAY_NAMES.indexOf(s);
    if (idx !== -1) return idx;
    var asNum = Number(s);
    if (Number.isFinite(asNum)) {
        var m = Math.trunc(asNum);
        if (m >= 0 && m <= 6) return m;
    }
    return null;
}

/**
 * Normalize a 'HH:MM' / 'HH:MM:SS' string (missing parts default to 0).
 * @returns {{h: number, m: number, s: number}}
 */
function parseTimeParts(timeStr) {
    var parts = String(timeStr || '00:00:00').split(':').map(Number);
    return { h: parts[0] || 0, m: parts[1] || 0, s: parts[2] || 0 };
}

/** Normalize a time string to canonical 'HH:MM:SS'. */
function normalizeTimeStr(timeStr, fallback) {
    var raw = (timeStr === undefined || timeStr === null || timeStr === '') ? (fallback || '00:00:00') : timeStr;
    var p = parseTimeParts(raw);
    function pad(n) { return String(n).padStart(2, '0'); }
    return pad(p.h) + ':' + pad(p.m) + ':' + pad(p.s);
}

/**
 * Canonical slot list for the current timer.
 * Prefers RECUR_SCHEDULE; falls back to legacy single-slot fields.
 * @returns {Array<{weekday: number|null, start: string, end: string|null, label: string}>}
 */
function getRecurSlots() {
    var raw = (typeof RECUR_SCHEDULE !== 'undefined') ? RECUR_SCHEDULE : [];
    if (Array.isArray(raw) && raw.length > 0) {
        var out = [];
        for (var i = 0; i < raw.length; i++) {
            var s = raw[i] || {};
            var start = normalizeTimeStr(s.start !== undefined ? s.start : s.time, '00:00:00');
            var end = (s.end === undefined || s.end === null || s.end === '' || s.end === 'null')
                ? null : normalizeTimeStr(s.end, null);
            out.push({
                weekday: normalizeWeekday(s.weekday),
                start: start,
                end: end,
                label: (s.label !== undefined && s.label !== null) ? String(s.label) : ''
            });
        }
        return out;
    }
    // Legacy single-slot fallback
    var wd = normalizeWeekday((typeof RECUR_WEEKDAY !== 'undefined') ? RECUR_WEEKDAY : null);
    var legacyTime = (typeof RECUR_TIME !== 'undefined' && RECUR_TIME) ? RECUR_TIME : null;
    var legacyEnd = (typeof RECUR_END !== 'undefined') ? RECUR_END : null;
    if (wd === null && !legacyTime && (legacyEnd === null || legacyEnd === undefined || legacyEnd === 'null')) {
        return [];
    }
    return [{
        weekday: wd,
        start: normalizeTimeStr(legacyTime, '00:00:00'),
        end: (legacyEnd === null || legacyEnd === undefined || legacyEnd === '' || legacyEnd === 'null')
            ? null : normalizeTimeStr(legacyEnd, null),
        label: ''
    }];
}

function getRecurRule() {
    var r = (typeof RECUR_RULE !== 'undefined' && RECUR_RULE) ? String(RECUR_RULE).toLowerCase() : 'weekly';
    if (r === 'daily' || r === 'interval' || r === 'weekly') return r;
    return 'weekly';
}

/**
 * Build a Date for the next occurrence of a weekday+time on/after `from`.
 * @param {Date} from Reference date
 * @param {number} weekday 0=Sunday ... 6=Saturday
 * @param {string} timeStr 'HH:MM:SS' start time
 * @returns {Date} Next occurrence (strictly after `from` unless exactly equal)
 */
function nextWeekdayFrom(from, weekday, timeStr) {
    var p = parseTimeParts(timeStr);
    var diff = (weekday - from.getDay() + 7) % 7;
    var next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + diff, p.h, p.m, p.s, 0);
    if (next.getTime() <= from.getTime()) {
        next.setDate(next.getDate() + 7);
    }
    return next;
}

/**
 * Build a Date for the previous (most recent) occurrence of a weekday+time.
 * @param {Date} from Reference date
 * @param {number} weekday 0=Sunday ... 6=Saturday
 * @param {string} timeStr 'HH:MM:SS' start time
 * @returns {Date} Previous occurrence (at or before `from`)
 */
function previousWeekdayFrom(from, weekday, timeStr) {
    var p = parseTimeParts(timeStr);
    var diff = (from.getDay() - weekday + 7) % 7;
    var prev = new Date(from.getFullYear(), from.getMonth(), from.getDate() - diff, p.h, p.m, p.s, 0);
    if (prev.getTime() > from.getTime()) {
        prev.setDate(prev.getDate() - 7);
    }
    return prev;
}

function dateAtTime(day, timeStr) {
    var p = parseTimeParts(timeStr);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), p.h, p.m, p.s, 0);
}

/**
 * Core state computation for recurring timers.
 * @param {Date} [nowObj] Reference time (defaults to now)
 * @returns {{target: Date, prevBoundary: Date, slot: object|null, phase: string, inClass: boolean}|null}
 */
function computeRecurState(nowObj) {
    var now = nowObj || new Date();
    var rule = getRecurRule();

    if (rule === 'interval') {
        var mins = (typeof RECUR_INTERVAL_MINUTES !== 'undefined') ? Number(RECUR_INTERVAL_MINUTES) : NaN;
        if (!Number.isFinite(mins) || mins <= 0) return null;
        var intervalMs = mins * 60000;
        var anchorRaw = (typeof RECUR_ANCHOR !== 'undefined' && RECUR_ANCHOR) ? RECUR_ANCHOR : null;
        if (!anchorRaw && typeof START_TIME !== 'undefined' && START_TIME) anchorRaw = START_TIME;
        var anchor = anchorRaw ? new Date(anchorRaw) : now;
        if (isNaN(anchor.getTime())) anchor = now;
        var target;
        if (now.getTime() < anchor.getTime()) {
            target = new Date(anchor.getTime());
        } else {
            var k = Math.ceil((now.getTime() - anchor.getTime()) / intervalMs);
            target = new Date(anchor.getTime() + k * intervalMs);
            if (target.getTime() <= now.getTime()) {
                target = new Date(target.getTime() + intervalMs);
            }
        }
        return {
            target: target,
            prevBoundary: new Date(target.getTime() - intervalMs),
            slot: { weekday: null, start: '', end: null, label: 'interval' },
            phase: 'waiting',
            inClass: false
        };
    }

    var slots = getRecurSlots().filter(function (s) {
        if (rule === 'weekly') return s.weekday !== null;
        return !!s.start;
    });
    if (slots.length === 0) return null;

    var best = null; // closest target strictly after now
    var prevBoundary = null;

    if (rule === 'daily') {
        for (var i = 0; i < slots.length; i++) {
            var slot = slots[i];
            var startToday = dateAtTime(now, slot.start);
            var endToday = slot.end ? dateAtTime(now, slot.end) : null;
            // Overnight ranges (end <= start) roll the end to the next day.
            if (endToday && endToday.getTime() <= startToday.getTime()) {
                endToday = new Date(endToday.getTime() + 86400000);
            }
            if (now.getTime() >= startToday.getTime() && endToday && now.getTime() < endToday.getTime()) {
                var candIn = { target: endToday, slot: slot, phase: 'in-class', inClass: true };
                if (!best || candIn.target.getTime() < best.target.getTime()) best = candIn;
            } else if (now.getTime() < startToday.getTime()) {
                var candWait = { target: startToday, slot: slot, phase: 'waiting', inClass: false };
                if (!best || candWait.target.getTime() < best.target.getTime()) best = candWait;
            } else {
                var startTomorrow = new Date(startToday.getTime() + 86400000);
                var candNext = { target: startTomorrow, slot: slot, phase: 'waiting', inClass: false };
                if (!best || candNext.target.getTime() < best.target.getTime()) best = candNext;
            }
            // Track most recent boundary at or before now.
            var bounds = [startToday];
            if (endToday && endToday.getTime() <= now.getTime()) bounds.push(endToday);
            var yStart = new Date(startToday.getTime() - 86400000);
            bounds.push(yStart);
            if (slot.end) {
                var yEnd = dateAtTime(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), slot.end);
                if (yEnd.getTime() <= startToday.getTime() && yEnd.getTime() > yStart.getTime()) bounds.push(yEnd);
            }
            for (var b = 0; b < bounds.length; b++) {
                if (bounds[b].getTime() <= now.getTime() && (!prevBoundary || bounds[b].getTime() > prevBoundary.getTime())) {
                    prevBoundary = bounds[b];
                }
            }
        }
        if (!best) return null;
        if (!prevBoundary) prevBoundary = new Date(best.target.getTime() - 86400000);
        return { target: best.target, prevBoundary: prevBoundary, slot: best.slot, phase: best.phase, inClass: best.inClass };
    }

    // Weekly (default): multi-slot aware.
    for (var w = 0; w < slots.length; w++) {
        var ws = slots[w];
        var next = nextWeekdayFrom(now, ws.weekday, ws.start);
        var prev = previousWeekdayFrom(now, ws.weekday, ws.start);
        var endDt = null;
        if (ws.end) {
            endDt = dateAtTime(prev, ws.end);
            if (endDt.getTime() <= prev.getTime()) endDt = new Date(endDt.getTime() + 86400000);
        }
        if (endDt && now.getTime() >= prev.getTime() && now.getTime() < endDt.getTime()) {
            var candInW = { target: endDt, slot: ws, phase: 'in-class', inClass: true, prevStart: prev };
            if (!best || candInW.target.getTime() < best.target.getTime()) best = candInW;
        } else {
            var candWaitW = { target: next, slot: ws, phase: 'waiting', inClass: false, prevStart: prev };
            if (!best || candWaitW.target.getTime() < best.target.getTime()) best = candWaitW;
        }
        var cands = [prev];
        if (endDt && endDt.getTime() <= now.getTime()) cands.push(endDt);
        for (var c = 0; c < cands.length; c++) {
            if (cands[c].getTime() <= now.getTime() && (!prevBoundary || cands[c].getTime() > prevBoundary.getTime())) {
                prevBoundary = cands[c];
            }
        }
    }
    if (!best) return null;
    if (!prevBoundary) prevBoundary = new Date(best.target.getTime() - 7 * 86400000);
    return { target: best.target, prevBoundary: prevBoundary, slot: best.slot, phase: best.phase, inClass: best.inClass };
}

/**
 * Get the next class start time for a recurring timer.
 * For interval rule this is the next tick; while in-class it is the end time.
 * @returns {Date}
 */
function getNextOccurrence() {
    var st = computeRecurState(new Date());
    if (st) return st.target;
    return new Date(Date.now() + 7 * 86400000);
}

/**
 * Get the previous class start time for a recurring timer.
 * @returns {Date}
 */
function getPreviousOccurrence() {
    var now = new Date();
    var rule = getRecurRule();
    if (rule === 'interval') {
        var st = computeRecurState(now);
        if (st) return st.prevBoundary;
        return now;
    }
    var slots = getRecurSlots();
    var best = null;
    for (var i = 0; i < slots.length; i++) {
        var s = slots[i];
        var cand = null;
        if (rule === 'daily') {
            var t = dateAtTime(now, s.start);
            cand = (t.getTime() <= now.getTime()) ? t : new Date(t.getTime() - 86400000);
        } else {
            if (s.weekday === null) continue;
            cand = previousWeekdayFrom(now, s.weekday, s.start);
        }
        if (!best || cand.getTime() > best.getTime()) best = cand;
    }
    return best || now;
}

/**
 * Build the class start Date for a given occurrence day (legacy helper).
 * @param {Date} occ Date on the correct weekday
 * @returns {Date} Class start time on that day
 */
function classStartFrom(occ) {
    var legacy = normalizeTimeStr((typeof RECUR_TIME !== 'undefined' && RECUR_TIME) ? RECUR_TIME : '00:00:00');
    return dateAtTime(occ, legacy);
}

/**
 * If now is inside the current class/session period, return the end time.
 * @returns {Date|null}
 */
function getClassEnd() {
    var st = computeRecurState(new Date());
    if (st && st.inClass) return st.target;
    return null;
}

/**
 * Get the current time value based on direction (up or down)
 * @returns {number} Current time value in milliseconds
 */
function getCurrentTimeValue() {
    // Recurring timers always count down to the next boundary (start or end)
    if (typeof RECUR !== 'undefined' && RECUR) {
        var st = computeRecurState(new Date());
        if (st) return st.target.getTime() - Date.now();
        return 0;
    }

    var start = new Date(START_TIME).getTime();
    var target = new Date(TARGET_TIME).getTime();
    var now = Date.now();

    if (DIRECTION === 'up') {
        // Counting up from start_time (stopwatch mode)
        var elapsed = now - start;

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
        var remaining = target - now;

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
    // Recurring timers never expire - they roll over to the next occurrence
    if (typeof RECUR !== 'undefined' && RECUR) {
        return false;
    }
    if (DIRECTION === 'up') {
        return false; // Up direction never expires
    }
    var target = new Date(TARGET_TIME).getTime();
    var now = Date.now();
    return now >= target;
}

/**
 * Calculate the ratio of time remaining (1 = full time, 0 = expired)
 * For recurring timers the window is prevBoundary -> target so multi-slot,
 * daily, and interval cycles all report meaningful progress.
 * @returns {number} Remaining ratio between 0 and 1
 */
function calculateRemainingRatio() {
    if (typeof RECUR !== 'undefined' && RECUR) {
        var st = computeRecurState(new Date());
        if (!st) return 0;
        var now = Date.now();
        var total = st.target.getTime() - st.prevBoundary.getTime();
        var elapsed = now - st.prevBoundary.getTime();
        return Math.max(0, Math.min(1, 1 - (total > 0 ? elapsed / total : 1)));
    }

    var start = new Date(START_TIME).getTime();
    var target = new Date(TARGET_TIME).getTime();
    var nowMs = Date.now();

    if (DIRECTION === 'up') {
        // For up direction, ratio increases from 0 to 1
        var totalDuration = target - start;
        var elapsedUp = nowMs - start;
        var progress = elapsedUp / totalDuration;
        return Math.min(1, Math.max(0, progress));
    } else {
        // For down direction, ratio decreases from 1 to 0
        var totalDurationDown = target - start;
        var elapsedDown = nowMs - start;
        var progressDown = Math.max(0, Math.min(1, elapsedDown / totalDurationDown));
        return 1 - progressDown; // 1 = full time remaining, 0 = no time
    }
}

/**
 * Format time in milliseconds to display string
 * @param {number} ms - Milliseconds remaining
 * @returns {string} Formatted time string
 */
function formatTime(ms) {
    if (ms < 0) ms = 0;
    var totalSeconds = Math.floor(ms / 1000);
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var milliseconds = ms % 1000;

    if (days >= 1000) {
        return days + ':' + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    } else if (days >= 100) {
        return days + ':' + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    } else if (days >= 10) {
        return days + ':' + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    } else if (days >= 1) {
        return days + ':' + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    } else if (hours >= 10) {
        return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    } else if (hours >= 1) {
        return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + '.' + String(Math.floor(milliseconds / 100));
    } else if (minutes >= 10) {
        return String(minutes) + ':' + String(seconds).padStart(2, '0') + '.' + String(Math.floor(milliseconds / 10)).padStart(2, '0');
    } else {
        return minutes + ':' + String(seconds).padStart(2, '0') + '.' + String(milliseconds).padStart(3, '0');
    }
}

/**
 * Format negative time (for post-expiry display when on_expire is 'continue')
 * @param {number} ms - Milliseconds past target (negative value)
 * @returns {string} Formatted negative time string with minus sign
 */
function formatNegativeTime(ms) {
    var absMs = Math.abs(ms);
    var totalSeconds = Math.floor(absMs / 1000);
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var milliseconds = absMs % 1000;

    var timeStr;
    if (days >= 1) {
        timeStr = days + ':' + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    } else if (hours >= 10) {
        timeStr = hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    } else if (hours >= 1) {
        timeStr = hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + '.' + String(Math.floor(milliseconds / 100));
    } else if (minutes >= 10) {
        timeStr = String(minutes) + ':' + String(seconds).padStart(2, '0') + '.' + String(Math.floor(milliseconds / 10)).padStart(2, '0');
    } else {
        timeStr = minutes + ':' + String(seconds).padStart(2, '0') + '.' + String(milliseconds).padStart(3, '0');
    }
    return '-' + timeStr;
}

/**
 * Get time elapsed since expiry
 * @returns {number} Milliseconds since target time was reached
 */
function getTimeSinceExpiry() {
    var target = new Date(TARGET_TIME).getTime();
    var now = Date.now();
    return now - target;
}
