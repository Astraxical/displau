/**
 * Unified Button Panel Component
 * Handles interactions for button panels across all pages
 */

class ButtonPanel {
    constructor(options = {}) {
        this.panel = null;
        this.options = {
            position: 'bottom', // 'top', 'bottom', 'left', 'right'
            animate: true,
            autoHide: false,
            hideOnScroll: false,
            ...options
        };
        
        this.init();
    }

    init() {
        // Find existing panel or create new one
        this.panel = document.querySelector('.button-panel') || this.createPanel();
        
        // Apply position class
        this.panel.classList.add(`button-panel-${this.options.position}`);
        
        // Add animation if enabled
        if (this.options.animate) {
            this.panel.classList.add('button-panel-animate');
        }

        // Setup auto-hide behavior
        if (this.options.autoHide) {
            this.setupAutoHide();
        }

        // Setup hide on scroll
        if (this.options.hideOnScroll) {
            this.setupHideOnScroll();
        }

        // Bind button events
        this.bindButtonEvents();
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.className = 'button-panel';
        document.body.appendChild(panel);
        return panel;
    }

    setupAutoHide() {
        let hideTimeout;
        const showPanel = () => {
            this.panel.style.opacity = '1';
            this.panel.style.pointerEvents = 'auto';
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                if (!this.panel.matches(':hover')) {
                    this.panel.style.opacity = '0';
                    this.panel.style.pointerEvents = 'none';
                }
            }, 3000);
        };

        document.addEventListener('mousemove', showPanel);
        document.addEventListener('touchstart', showPanel);
        this.panel.addEventListener('mouseenter', showPanel);
        this.panel.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                this.panel.style.opacity = '0';
                this.panel.style.pointerEvents = 'none';
            }, 500);
        });
    }

    setupHideOnScroll() {
        let lastScroll = window.scrollY;
        
        window.addEventListener('scroll', () => {
            const currentScroll = window.scrollY;
            const delta = Math.abs(currentScroll - lastScroll);
            
            if (delta > 10) {
                if (currentScroll > lastScroll) {
                    // Scrolling down - hide
                    this.panel.style.transform = this.getHiddenTransform();
                } else {
                    // Scrolling up - show
                    this.panel.style.transform = this.getVisibleTransform();
                }
            }
            
            lastScroll = currentScroll;
        });
    }

    getHiddenTransform() {
        const pos = this.options.position;
        if (pos === 'top') return 'translateX(-50%) translateY(-100%)';
        if (pos === 'bottom') return 'translateX(-50%) translateY(100%)';
        if (pos === 'left') return 'translateY(-50%) translateX(-100%)';
        if (pos === 'right') return 'translateY(-50%) translateX(100%)';
        return 'translateX(-50%)';
    }

    getVisibleTransform() {
        const pos = this.options.position;
        if (pos === 'top' || pos === 'bottom') return 'translateX(-50%)';
        if (pos === 'left') return 'translateY(-50%)';
        if (pos === 'right') return 'translateY(-50%)';
        return 'translateX(-50%)';
    }

    bindButtonEvents() {
        // Global button click handler
        this.panel.addEventListener('click', (e) => {
            const btn = e.target.closest('.panel-btn');
            if (!btn) return;

            // Handle toggle buttons
            if (btn.dataset.toggle) {
                this.handleToggle(btn);
            }

            // Handle action buttons
            if (btn.dataset.action) {
                this.handleAction(btn);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            const shortcut = e.key.toLowerCase();
            const btn = this.panel.querySelector(`[data-shortcut="${shortcut}"]`);
            
            if (btn) {
                e.preventDefault();
                btn.click();
            }
        });
    }

    handleToggle(btn) {
        const toggleGroup = btn.dataset.toggle;
        if (!toggleGroup) return;

        // Find all buttons in the same toggle group
        const siblings = this.panel.querySelectorAll(`[data-toggle="${toggleGroup}"]`);
        siblings.forEach(sib => sib.classList.remove('active'));
        btn.classList.add('active');
    }

    handleAction(btn) {
        const action = btn.dataset.action;
        
        // Built-in actions
        const actions = {
            'fullscreen': () => this.toggleFullscreen(),
            'pause': () => this.triggerEvent('panel:pause'),
            'play': () => this.triggerEvent('panel:play'),
            'search': () => this.focusSearch(),
            'filter': () => this.toggleFilter(),
            'sort': () => this.toggleSort(),
            'grid': () => this.setView('grid'),
            'list': () => this.setView('list'),
        };

        if (actions[action]) {
            actions[action]();
        }

        // Custom action handler
        this.triggerEvent(`panel:action:${action}`, { button: btn });
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    focusSearch() {
        const searchInput = this.panel.querySelector('.panel-input[type="search"], .panel-input[type="text"]');
        if (searchInput) {
            searchInput.focus();
        }
    }

    toggleFilter() {
        const filterSelect = this.panel.querySelector('.panel-select');
        if (filterSelect) {
            filterSelect.showPicker?.();
        }
    }

    setView(view) {
        this.triggerEvent('panel:viewchange', { view });
    }

    triggerEvent(name, detail = {}) {
        const event = new CustomEvent(name, { detail });
        document.dispatchEvent(event);
    }

    // Public API
    addButton(config) {
        const btn = document.createElement('button');
        btn.className = `panel-btn ${config.variant ? `panel-btn-${config.variant}` : ''}`;
        btn.dataset.action = config.action || '';
        btn.dataset.toggle = config.toggle || '';
        btn.dataset.shortcut = config.shortcut || '';
        
        if (config.icon) {
            btn.innerHTML = `<span class="btn-icon">${config.icon}</span>`;
            if (config.text) {
                btn.innerHTML += `<span class="btn-text">${config.text}</span>`;
            }
        } else if (config.text) {
            btn.textContent = config.text;
        }

        if (config.active) {
            btn.classList.add('active');
        }

        this.panel.appendChild(btn);
        return btn;
    }

    addInput(config) {
        const input = document.createElement('input');
        input.className = 'panel-input';
        input.type = config.type || 'text';
        input.placeholder = config.placeholder || '';
        input.id = config.id || '';
        
        if (config.value) {
            input.value = config.value;
        }

        this.panel.appendChild(input);
        return input;
    }

    addSelect(config) {
        const select = document.createElement('select');
        select.className = 'panel-select';
        select.id = config.id || '';
        
        if (config.options && Array.isArray(config.options)) {
            config.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if (opt.selected) option.selected = true;
                select.appendChild(option);
            });
        }

        this.panel.appendChild(select);
        return select;
    }

    addDivider() {
        const divider = document.createElement('div');
        divider.className = 'panel-divider';
        this.panel.appendChild(divider);
        return divider;
    }

    show() {
        this.panel.style.opacity = '1';
        this.panel.style.pointerEvents = 'auto';
    }

    hide() {
        this.panel.style.opacity = '0';
        this.panel.style.pointerEvents = 'none';
    }

    destroy() {
        this.panel.remove();
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ButtonPanel;
}

// Auto-initialize if data attributes found
document.addEventListener('DOMContentLoaded', () => {
    const panels = document.querySelectorAll('[data-panel]');
    panels.forEach(panelEl => {
        const options = {
            position: panelEl.dataset.panelPosition || 'bottom',
            animate: panelEl.dataset.panelAnimate !== 'false',
            autoHide: panelEl.dataset.panelAutohide === 'true',
            hideOnScroll: panelEl.dataset.panelHideonscroll === 'true'
        };
        new ButtonPanel(options);
    });
});
