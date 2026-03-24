// Search functionality
const searchBox = document.getElementById('searchBox');
const timersGrid = document.getElementById('timersGrid');
const sortSelect = document.getElementById('sortSelect');
const gridBtn = document.getElementById('gridBtn');
const listBtn = document.getElementById('listBtn');

// Modal elements
const createBtn = document.getElementById('createBtn');
const createModal = document.getElementById('createModal');
const closeModal = document.getElementById('closeModal');
const timerIdInput = document.getElementById('timerId');
const targetTimeInput = document.getElementById('targetTime');
const startTimeInput = document.getElementById('startTime');
const generateBtn = document.getElementById('generateBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const copyInstructionsBtn = document.getElementById('copyInstructionsBtn');

// Preview elements
const previewName = document.getElementById('previewName');
const previewTime = document.getElementById('previewTime');
const previewStart = document.getElementById('previewStart');
const previewTarget = document.getElementById('previewTarget');
const jsonOutput = document.getElementById('jsonOutput');

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

// Modal controls
createBtn.addEventListener('click', () => {
    createModal.classList.add('active');
    // Set default times
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    startTimeInput.value = now.toISOString().slice(0, 16);
    targetTimeInput.value = tomorrow.toISOString().slice(0, 16);
    updatePreview();
});

closeModal.addEventListener('click', () => {
    createModal.classList.remove('active');
});

createModal.addEventListener('click', (e) => {
    if (e.target === createModal) {
        createModal.classList.remove('active');
    }
});

// Live preview update
[timerIdInput, targetTimeInput, startTimeInput].forEach(input => {
    input.addEventListener('input', updatePreview);
});

function updatePreview() {
    const id = timerIdInput.value || 'my-event';
    const target = targetTimeInput.value;
    const start = startTimeInput.value;

    // Update preview name
    previewName.textContent = id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Format dates for display
    const targetFmt = target ? new Date(target).toLocaleString() : '-';
    const startFmt = start ? new Date(start).toLocaleString() : '-';
    previewTarget.textContent = targetFmt;
    previewStart.textContent = startFmt;

    // Update JSON output
    const config = {
        id: id,
        target_time: target ? new Date(target).toISOString().slice(0, 19) : '2026-12-31T23:59:59',
        start_time: start ? new Date(start).toISOString().slice(0, 19) : new Date().toISOString().slice(0, 19)
    };
    jsonOutput.textContent = `// Timer config will appear here...
{
    "id": "${config.id}",
    "target_time": "${config.target_time}",
    "start_time": "${config.start_time}"
}`;

    // Update download link
    const blob = new Blob([JSON.stringify(config, null, 4)], { type: 'application/json' });
    downloadJsonBtn.href = URL.createObjectURL(blob);
    downloadJsonBtn.download = config.id + '.json';
    downloadJsonBtn.style.display = 'inline-block';
    copyInstructionsBtn.style.display = 'inline-block';
}

// Generate timer
generateBtn.addEventListener('click', () => {
    const id = timerIdInput.value || 'my-event';
    const target = targetTimeInput.value;
    const start = startTimeInput.value;

    if (!target) {
        alert('Please select a target time!');
        return;
    }

    const config = {
        id: id,
        target_time: new Date(target).toISOString().slice(0, 19),
        start_time: start ? new Date(start).toISOString().slice(0, 19) : new Date().toISOString().slice(0, 19)
    };

    // Show instructions
    const instructions = `To add this timer:

1. Save this JSON as genbuild/timers/${id}.json:

${JSON.stringify(config, null, 4)}

2. Run: python vMain.py --deploy

3. Your timer will be live at: output/${id}.html`;

    alert(instructions);
});

// Copy instructions
copyInstructionsBtn.addEventListener('click', () => {
    const id = timerIdInput.value || 'my-event';
    const target = targetTimeInput.value;
    const start = startTimeInput.value;

    const config = {
        id: id,
        target_time: new Date(target).toISOString().slice(0, 19),
        start_time: start ? new Date(start).toISOString().slice(0, 19) : new Date().toISOString().slice(0, 19)
    };

    const instructions = `To add this timer:

1. Save this JSON as genbuild/timers/${id}.json:

${JSON.stringify(config, null, 4)}

2. Run: python vMain.py --deploy

3. Your timer will be live at: output/${id}.html`;

    navigator.clipboard.writeText(instructions).then(() => {
        alert('Instructions copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
});

// ============================================
// STATUS FILTER FUNCTIONALITY
// ============================================

const statusFilter = document.getElementById('statusFilter');

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
// EXPORT/IMPORT FUNCTIONALITY
// ============================================

const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');

// Export all timer configurations
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        // Collect all timer data from cards
        const timers = [];
        document.querySelectorAll('.timer-card').forEach(card => {
            const name = card.dataset.name;
            const status = card.dataset.status;
            const progressEl = card.querySelector('.progress-text');
            const startEl = card.querySelector('.start');
            const targetEl = card.querySelector('.target');
            
            // Extract times from display
            const startMatch = startEl?.textContent?.match(/📅 Start: (.+)/);
            const targetMatch = targetEl?.textContent?.match(/🎯 Target: (.+)/);
            
            const timerData = {
                id: name,
                display_name: card.querySelector('.card-header h3')?.textContent || name,
                target_time: targetMatch ? targetMatch[1].trim() : '',
                start_time: startMatch ? startMatch[1].trim() : '',
                status: status,
                progress: progressEl ? parseFloat(progressEl.textContent) : 0
            };
            timers.push(timerData);
        });

        const exportData = {
            exported_at: new Date().toISOString(),
            total_timers: timers.length,
            timers: timers
        };

        const blob = new Blob([JSON.stringify(exportData, null, 4)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timers-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`Exported ${timers.length} timer(s) to ${a.download}`);
    });
}

// Import timer configurations
if (importBtn && importInput) {
    importBtn.addEventListener('click', () => {
        importInput.click();
    });

    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                // Support both array format and {timers: [...]} format
                const timers = Array.isArray(data) ? data : (data.timers || []);
                
                if (timers.length === 0) {
                    alert('No timers found in import file');
                    return;
                }

                // Show import summary
                let summary = `Import ${timers.length} timer(s)?\n\n`;
                timers.forEach(t => {
                    summary += `• ${t.display_name || t.id}: ${t.target_time}\n`;
                });
                summary += `\nThis will download the timer JSON files and show instructions.`;

                if (confirm(summary)) {
                    // Show instructions for each timer
                    timers.forEach(timer => {
                        const config = {
                            id: timer.id,
                            display_name: timer.display_name || timer.id,
                            target_time: timer.target_time,
                            start_time: timer.start_time,
                            on_expire: timer.on_expire || 'stop'
                        };

                        const instructions = `Timer: ${config.display_name}

Save this as genbuild/timers/${config.id}.json:

${JSON.stringify(config, null, 4)}

Then run: python vMain.py --deploy`;

                        console.log(instructions);
                    });

                    alert(`Import instructions logged to console. Copy each timer config to genbuild/timers/ and run: python vMain.py --deploy`);
                }
            } catch (err) {
                alert('Error parsing import file: ' + err.message);
            }
        };
        reader.readAsText(file);
        
        // Reset input so same file can be selected again
        importInput.value = '';
    });
}
