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
    // Default color transition: Blue→Green→Yellow→Orange→Red (Violet for negative)
    color_transition_table: [
        { ratio: 1.0, color: '#0088ff' },   // Blue: Yet to start (100%)
        { ratio: 0.75, color: '#00ff00' },  // Green: 0-25% done
        { ratio: 0.5, color: '#ffff00' },   // Yellow: 50% done
        { ratio: 0.25, color: '#ff8800' },  // Orange: 75% done
        { ratio: 0.0, color: '#ff0000' }    // Red: Zero
    ]
};
const NEGATIVE_TIME_COLOR = '#ee82ee';  // Violet: Beyond zero (negative time)
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
}

// Initialize config on script load
loadConfig();

// Check notification permission on load
if ('Notification' in window) {
    notificationPermission = Notification.permission;
    console.log('[Config] Notification permission:', notificationPermission);
}
