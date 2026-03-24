// Search functionality
const searchBox = document.getElementById('searchBox');
const timersGrid = document.getElementById('timersGrid');
const sortSelect = document.getElementById('sortSelect');
const gridBtn = document.getElementById('gridBtn');
const listBtn = document.getElementById('listBtn');
const statusFilter = document.getElementById('statusFilter');

// Search
searchBox.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.timer-card').forEach(card => {
        const name = card.dataset.name;
        if (name.includes(query)) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
});

// Sort
sortSelect.addEventListener('change', (e) => {
    const cards = Array.from(timersGrid.querySelectorAll('.timer-card'));
    const sortType = e.target.value;

    cards.sort((a, b) => {
        if (sortType === 'name') {
            return a.dataset.name.localeCompare(b.dataset.name);
        } else if (sortType === 'progress') {
            const aProgress = parseFloat(a.querySelector('.progress-text').textContent) || 0;
            const bProgress = parseFloat(b.querySelector('.progress-text').textContent) || 0;
            return bProgress - aProgress;
        } else if (sortType === 'target') {
            const aTarget = a.querySelector('.target').textContent;
            const bTarget = b.querySelector('.target').textContent;
            return aTarget.localeCompare(bTarget);
        }
        const statusOrder = {'running': 0, 'upcoming': 1, 'ended': 2};
        return (statusOrder[a.dataset.status] || 3) - (statusOrder[b.dataset.status] || 3);
    });

    cards.forEach(card => timersGrid.appendChild(card));
});

// Grid/List toggle
gridBtn.addEventListener('click', () => {
    timersGrid.classList.remove('list-view');
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
});

listBtn.addEventListener('click', () => {
    timersGrid.classList.add('list-view');
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
});

// Status filter
if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
        const filterValue = e.target.value;
        document.querySelectorAll('.timer-card').forEach(card => {
            const status = card.dataset.status;
            if (filterValue === 'all' || status === filterValue) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    });
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
            // Format as ###.##%
            progressText = `${progress.toFixed(2).padStart(6, '0')}%`;
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
