// ============ CONFIGURATION ============
// Hardcoded defaults (fallback if fetch/cache fail)
const DEFAULTS = {
    target_time: '{{TARGET_TIME}}',
    start_time: '{{START_TIME}}',
    display_name: '',
    config_id: 'default',
    on_expire: 'stop',  // Options: 'stop', 'continue', 'hide'
    direction: '{{DIRECTION}}',  // Options: 'down', 'up'
    min_value: {{MIN_VALUE}},       // Minimum value in milliseconds (null for no limit)
    max_value: {{MAX_VALUE}},     // Maximum value in milliseconds (null for no limit)
    display_mode: '{{DISPLAY_MODE}}',  // Options: 'countdown', 'static'
    static_time_ms: {{STATIC_TIME_MS}},  // Fixed time value in ms for static display mode
    // Recurring mode: weekly multi-slot, daily, or fixed-interval countdowns.
    // Single-slot legacy fields (recur_weekday/time/end) still work and are
    // auto-converted into a one-entry recur_schedule.
    recur: {{RECUR}},                    // true = recurring timer
    recur_rule: '{{RECUR_RULE}}',        // 'weekly' | 'daily' | 'interval'
    recur_weekday: {{RECUR_WEEKDAY}},    // legacy single-slot: 0=Sunday ... 6=Saturday
    recur_time: '{{RECUR_TIME}}',        // legacy single-slot start 'HH:MM:SS'
    recur_end: {{RECUR_END}},            // legacy single-slot end 'HH:MM:SS' or null
    recur_schedule: {{RECUR_SCHEDULE_JSON}}, // canonical multi-slot list [{weekday,start,end,label}]
    recur_interval_minutes: {{RECUR_INTERVAL}}, // interval rule: minutes between occurrences or null
    recur_anchor: '{{RECUR_ANCHOR}}',    // interval rule anchor ISO datetime ('' = use start_time)
    // Smooth color transition: Blue→Cyan→Green→Yellow→Orange→Red→Violet→Deep Violet
    color_transition_table: [
        { ratio: 1.0, color: '#0088ff' },   // Blue: 100% remaining
        { ratio: 0.9, color: '#00aaff' },   // Blue-Cyan: 90%
        { ratio: 0.8, color: '#00ccff' },   // Cyan-Blue: 80%
        { ratio: 0.75, color: '#00ff00' },  // Green: 75%
        { ratio: 0.6, color: '#80ff00' },   // Lime-Green: 60%
        { ratio: 0.5, color: '#ffff00' },   // Yellow: 50%
        { ratio: 0.4, color: '#ffcc00' },   // Yellow-Orange: 40%
        { ratio: 0.3, color: '#ffaa00' },   // Orange-Yellow: 30%
        { ratio: 0.25, color: '#ff8800' },  // Orange: 25%
        { ratio: 0.2, color: '#ff6600' },   // Orange-Red: 20%
        { ratio: 0.1, color: '#ff4400' },   // Red-Orange: 10%
        { ratio: 0.0, color: '#ff0000' },   // Red: 0% (zero)
        { ratio: -0.25, color: '#ff0080' }, // Red-Magenta: -25%
        { ratio: -0.5, color: '#ee82ee' },  // Violet: -50%
        { ratio: -0.75, color: '#c060ff' }, // Violet-Purple: -75%
        { ratio: -1.0, color: '#8b00ff' }   // Deep Violet: -100%
    ]
};
const MILLISECONDS_AT_FULL_BRIGHTNESS = {{DAYS_AT_FULL_BRIGHTNESS}};
const CONFIG_URL = '{{CONFIG_URL}}'; // Injected by build script
// =======================================

// Cache configuration
const CACHE_KEY = 'seven_segment_config';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Notification state
let notificationPermission = 'default'; // 'default', 'granted', 'denied'

// Color state
let currentColor = '#00ff00';
let targetColor = '#00ff00';
let colorTransitionProgress = 1;

// Runtime config (will be populated)
let TARGET_TIME = DEFAULTS.target_time;
let START_TIME = DEFAULTS.start_time;
let DISPLAY_NAME = DEFAULTS.display_name;
let ON_EXPIRE = DEFAULTS.on_expire;
let DIRECTION = DEFAULTS.direction;
let MIN_VALUE = DEFAULTS.min_value;
let MAX_VALUE = DEFAULTS.max_value;
let COLOR_TRANSITION_TABLE = DEFAULTS.color_transition_table;
let DISPLAY_MODE = DEFAULTS.display_mode || 'countdown';
let STATIC_TIME_MS = DEFAULTS.static_time_ms || 0;
let RECUR = DEFAULTS.recur || false;
let RECUR_RULE = DEFAULTS.recur_rule || 'weekly';
let RECUR_WEEKDAY = DEFAULTS.recur_weekday;
let RECUR_TIME = DEFAULTS.recur_time || '00:00:00';
let RECUR_END = DEFAULTS.recur_end; // 'HH:MM:SS' or null (legacy single-slot)
let RECUR_SCHEDULE = DEFAULTS.recur_schedule || []; // canonical slots [{weekday,start,end,label}]
let RECUR_INTERVAL_MINUTES = DEFAULTS.recur_interval_minutes ?? null;
let RECUR_ANCHOR = DEFAULTS.recur_anchor || '';

/**
 * Load config from GitHub with localStorage caching
 * Falls back to hardcoded defaults if fetch fails
 */
async function loadConfig() {
    const now = Date.now();
    
    // Try localStorage cache first
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { config, timestamp } = JSON.parse(cached);
            if (now - timestamp < CACHE_DURATION_MS) {
                console.log('[Config] Using cached config');
                applyConfig(config);
                return config;
            }
        }
    } catch (e) {
        console.warn('[Config] Cache read error:', e);
    }
    
    // Try fetch from GitHub
    if (CONFIG_URL && CONFIG_URL !== '{{CONFIG_URL}}') {
        try {
            console.log('[Config] Fetching config from:', CONFIG_URL);
            const response = await fetch(CONFIG_URL, {
                cache: 'no-cache'
            });
            if (response.ok) {
                const config = await response.json();
                // Save to cache
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    config,
                    timestamp: now
                }));
                console.log('[Config] Loaded from GitHub');
                applyConfig(config);
                return config;
            }
        } catch (e) {
            console.warn('[Config] Fetch error, using fallback:', e);
        }
    }
    
    // Fallback to hardcoded defaults
    console.log('[Config] Using hardcoded defaults');
    applyConfig(DEFAULTS);
    return DEFAULTS;
}

/**
 * Apply loaded config to runtime variables
 */
function applyConfig(config) {
    if (config.target_time) {
        TARGET_TIME = config.target_time;
    }
    // Use start_time from config if available, otherwise keep embedded default
    if (config.start_time) {
        START_TIME = config.start_time;
    }
    // Use display_name from config if available
    if (config.display_name) {
        DISPLAY_NAME = config.display_name;
    }
    // Use on_expire from config if available
    if (config.on_expire) {
        ON_EXPIRE = config.on_expire;
    }
    // Use direction from config if available
    if (config.direction) {
        DIRECTION = config.direction;
    }
    // Use min_value from config if available
    if (config.min_value !== undefined) {
        MIN_VALUE = config.min_value;
    }
    // Use max_value from config if available
    if (config.max_value !== undefined) {
        MAX_VALUE = config.max_value;
    }
    // Use color_transition_table from config if available
    if (config.color_transition_table && Array.isArray(config.color_transition_table)) {
        COLOR_TRANSITION_TABLE = config.color_transition_table;
    }
    // Use display_mode from config if available
    if (config.display_mode) {
        DISPLAY_MODE = config.display_mode;
    }
    // Use static_time_ms from config if available
    if (config.static_time_ms !== undefined) {
        STATIC_TIME_MS = config.static_time_ms;
    }
    // Use recurring settings from config if available (legacy + v2 schedule rules)
    if (config.recur !== undefined) {
        RECUR = config.recur;
    }
    if (config.recur_rule !== undefined) {
        RECUR_RULE = config.recur_rule;
    }
    if (config.recur_weekday !== undefined) {
        RECUR_WEEKDAY = config.recur_weekday;
    }
    if (config.recur_time !== undefined) {
        RECUR_TIME = config.recur_time;
    }
    if (config.recur_end !== undefined) {
        RECUR_END = config.recur_end;
    }
    if (config.recur_schedule !== undefined) {
        RECUR_SCHEDULE = config.recur_schedule;
    }
    if (config.recur_interval_minutes !== undefined) {
        RECUR_INTERVAL_MINUTES = config.recur_interval_minutes;
    }
    if (config.recur_anchor !== undefined) {
        RECUR_ANCHOR = config.recur_anchor;
    }
}

// Initialize config on script load
loadConfig();

// Check notification permission on load
if ('Notification' in window) {
    notificationPermission = Notification.permission;
    console.log('[Config] Notification permission:', notificationPermission);
}
