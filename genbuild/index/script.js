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
            const aProgress = parseFloat(a.querySelector('.progress-text').textContent);
            const bProgress = parseFloat(b.querySelector('.progress-text').textContent);
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
