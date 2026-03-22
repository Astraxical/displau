// ============ CONFIGURATION ============
// Hardcoded defaults (fallback if fetch/cache fail)
const DEFAULTS = {
    target_time: '{{TARGET_TIME}}',
    config_id: 'default'
};
const MILLISECONDS_AT_FULL_BRIGHTNESS = {{DAYS_AT_FULL_BRIGHTNESS}};
const CONFIG_URL = '{{CONFIG_URL}}'; // Injected by build script
// =======================================

// Cache configuration
const CACHE_KEY = 'seven_segment_config';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Color state
let currentColor = '#00ff00';
let targetColor = '#00ff00';
let colorTransitionProgress = 1;

// Runtime config (will be populated)
let TARGET_TIME = DEFAULTS.target_time;
let START_TIME;

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
    // Calculate START_TIME
    const targetDate = new Date(TARGET_TIME);
    const startDate = new Date(targetDate.getTime() - MILLISECONDS_AT_FULL_BRIGHTNESS);
    START_TIME = startDate.toISOString().slice(0, 19);
}

// Initialize config on script load
loadConfig();
