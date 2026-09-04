// ============================================
// RECURRING SCHEDULE ENGINE (weekly multi-slot / daily / interval)
// ============================================

function recurTimeToParts(t) {
    const p = String(t || '00:00:00').split(':').map(Number);
    return { h: p[0] || 0, m: p[1] || 0, s: p[2] || 0 };
}

function recurAtTime(day, t) {
    const p = recurTimeToParts(t);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), p.h, p.m, p.s, 0);
}

function recurNextWeekday(from, wd, t) {
    const p = recurTimeToParts(t);
    const diff = (wd - from.getDay() + 7) % 7;
    const n = new Date(from.getFullYear(), from.getMonth(), from.getDate() + diff, p.h, p.m, p.s, 0);
    if (n <= from) n.setDate(n.getDate() + 7);
    return n;
}

function recurPrevWeekday(from, wd, t) {
    const p = recurTimeToParts(t);
    const diff = (from.getDay() - wd + 7) % 7;
    const pr = new Date(from.getFullYear(), from.getMonth(), from.getDate() - diff, p.h, p.m, p.s, 0);
    if (pr > from) pr.setDate(pr.getDate() - 7);
    return pr;
}

/**
 * Progress across the current recurrence cycle.
 * @param {{rule: string, slots: Array, interval: number|null, anchor: string|null}|null} src
 * @returns {{progress: number, text: string}}
 */
function recurProgress(src, now) {
    const fmt = (p) => `${p.toFixed(2).toString().padStart(6, '0')}%`;
    if (!src) return { progress: 0, text: fmt(0) };
    const rule = src.rule || 'weekly';

    if (rule === 'interval') {
        const mins = Number(src.interval);
        if (!isFinite(mins) || mins <= 0) return { progress: 0, text: fmt(0) };
        const iv = mins * 60000;
        const anchor = src.anchor ? new Date(src.anchor) : now;
        const a = isNaN(anchor) ? now : anchor;
        let target;
        if (now < a) target = new Date(a.getTime());
        else {
            const k = Math.ceil((now - a) / iv);
            target = new Date(a.getTime() + k * iv);
            if (target <= now) target = new Date(target.getTime() + iv);
        }
        const prev = new Date(target.getTime() - iv);
        const p = ((now - prev) / iv) * 100;
        return { progress: p, text: fmt(p) };
    }

    const slots = (src.slots || []).filter(s => rule === 'weekly' ? (s.weekday !== null && s.weekday !== undefined) : !!s.start);
    if (!slots.length) return { progress: 0, text: fmt(0) };

    let best = null; // {target, prev}
    const consider = (target, prev) => {
        if (target > now && (!best || target < best.target)) best = { target, prev };
    };

    if (rule === 'daily') {
        slots.forEach(s => {
            const st = recurAtTime(now, s.start);
            let en = s.end ? recurAtTime(now, s.end) : null;
            if (en && en <= st) en = new Date(en.getTime() + 86400000);
            if (en && now >= st && now < en) {
                const p = ((now - st) / (en - st)) * 100;
                if (!best || en < best.target) best = { target: en, prev: st, forced: p };
            } else if (now < st) {
                consider(st, new Date(st.getTime() - 86400000));
            } else {
                consider(new Date(st.getTime() + 86400000), st);
            }
        });
    } else {
        slots.forEach(s => {
            const nx = recurNextWeekday(now, s.weekday, s.start);
            const pr = recurPrevWeekday(now, s.weekday, s.start);
            let en = s.end ? recurAtTime(pr, s.end) : null;
            if (en && en <= pr) en = new Date(en.getTime() + 86400000);
            if (en && now >= pr && now < en) {
                const p = ((now - pr) / (en - pr)) * 100;
                if (!best || en < best.target) best = { target: en, prev: pr, forced: p };
            } else {
                consider(nx, pr);
            }
        });
    }

    if (!best) return { progress: 0, text: fmt(0) };
    const p = best.forced !== undefined
        ? best.forced
        : ((now - best.prev) / (best.target - best.prev)) * 100;
    return { progress: p, text: fmt(p) };
}

// ============================================
// REAL-TIME PROGRESS BAR UPDATES
// ============================================

/**
 * Update all progress bars based on current time
 */
function updateProgressBars() {
    const now = new Date();

    document.querySelectorAll('.timer-card').forEach(card => {
        // Recurring timers: progress from the embedded schedule blob
        // {rule, slots:[{weekday,start,end}], interval, anchor}.
        if (card.dataset.recur) {
            let src = null;
            try { src = JSON.parse(card.dataset.recurSrc || 'null'); } catch (e) { src = null; }
            const res = recurProgress(src, new Date());

            if (card.dataset.status !== 'running') {
                card.dataset.status = 'running';
                const statusBadge = card.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.textContent = 'Running';
                    statusBadge.className = 'status-badge status-running';
                }
            }

            const progressFill = card.querySelector('.progress-fill');
            const progressTextEl = card.querySelector('.progress-text');
            if (progressFill) progressFill.style.width = `${res.progress}%`;
            if (progressTextEl) progressTextEl.textContent = res.text;
            return;
        }

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
