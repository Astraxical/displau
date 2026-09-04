# 7 Segment Display Timers

Countdown timers with a 7-segment display aesthetic. This project generates standalone HTML timer files that count down to specific target dates.

## Features

- 🎯 Multiple countdown timers with configurable target times
- 🎨 Beautiful 7-segment display styling
- 🔄 GitHub-backed configuration for runtime updates
- 📊 Timer selector page with progress tracking
- ⚡ Real-time progress bar updates
- 🔍 Search and filter timers by status
- 📱 Responsive design for mobile and desktop
- ✅ JSON schema validation for timer configs
- 🪵 Structured logging with verbose mode
- 🧪 Comprehensive test suite

## Project Structure

```
displau/
├── src/
│   ├── vMain.py                # Main build script
│   ├── components/             # HTML/CSS/JS components
│   │   ├── html/               # HTML structure fragments
│   │   ├── styles/             # CSS stylesheets
│   │   └── scripts/            # JavaScript modules
│   └── index/                  # Selector page assets (styles.css, script.js)
├── timers/                     # Timer JSON configurations
├── output/                     # Generated HTML files
├── config/
│   ├── build.json              # Build configuration
│   └── schema.json             # Timer validation schema
├── tests/                      # Test suite
├── index.html                  # Timer selector page (at root for GitHub Pages)
└── pyproject.toml              # Project metadata & dependencies
```

## Quick Start

### Install Dependencies (Optional)

```bash
# Install with dev dependencies (includes pytest and jsonschema)
pip install -e ".[dev]"

# Or just install for validation support
pip install -e ".[validation]"
```

### Build All Timers

```bash
cd src
python3 vMain.py --timers-dir --selector
```

This will:
1. Build all timer HTML files from `timers/*.json`
2. Generate the selector page (`index.html`)
3. Output files to `output/`

### Deploy to GitHub Pages

```bash
cd src
python3 vMain.py --deploy
```

This will:
1. Clean the output folder
2. Rebuild all timers
3. Git add, commit, and push changes

## Timer Configuration

Each timer is defined by a JSON file in `timers/`:

```json
{
    "id": "my-timer",
    "display_name": "My Timer",
    "description": "A description of this timer",
    "target_time": "2026-12-31T23:59:59",
    "start_time": "2026-01-01T00:00:00",
    "direction": "down",
    "min_value": 0,
    "max_value": null,
    "on_expire": "stop",
    "display_on_expire": true,
    "tags": ["event", "countdown"],
    "category": "personal",
    "color_theme": "progress",
    "show_milliseconds": true,
    "timezone": "UTC"
}
```

### Configuration Options

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | **Required.** Unique identifier (lowercase, numbers, hyphens only) |
| `target_time` | string | **Required.** ISO 8601 datetime when timer ends (`YYYY-MM-DDTHH:MM:SS`) |
| `display_name` | string | Human-readable name shown in the selector |
| `description` | string | Description of the timer |
| `start_time` | string | ISO 8601 datetime when timer starts |
| `direction` | string | Timer direction: `"down"` or `"up"` (default: `down`) |
| `min_value` | number | Minimum value for countdown (default: `0`) |
| `max_value` | number | Maximum value (null for unlimited, default: `null`) |
| `on_expire` | string | Action on expiry: `"stop"`, `"continue"`, `"hide"` (default: `stop`) |
| `display_on_expire` | boolean | Whether to show in selector after expiry (default: `true`) |
| `recur` | boolean | Enable recurring mode (default: `false`) |
| `recur_rule` | string | `"weekly"` (weekday slots), `"daily"` (time-of-day slots), `"interval"` (every N minutes) |
| `recur_schedule` | array | Multi-slot schedule: `[{"weekday": "Monday", "start": "08:30", "end": "12:30", "label": "Lecture"}]`. `"time"` works as an alias of `"start"`. Legacy `recur_weekday`/`recur_time`/`recur_end` still work as a single slot |
| `recur_interval_minutes` | number | Interval in minutes (required when `recur_rule` is `"interval"`) |
| `recur_anchor` | string | ISO 8601 anchor datetime for interval recurrence (defaults to `start_time`) |
| `display_mode` | string | `"countdown"` (default), `"static"`, `"window"` (START-END event: counts down to start, then to end), `"checkpoints"` (START-TRIGGER-…-TRIGGER-END: each checkpoint is its own mini-timer) |
| `window_start` / `window_end` | string | ISO 8601 open/close datetimes (required for `"window"`; default to `start_time`/`target_time`) |
| `checkpoints` | array | `[{"at": "2026-09-11T20:30:00", "label": "Doors open"}, …]` sorted legs (required for `"checkpoints"`) |
| `tags` | array | Tags for categorization |
| `category` | string | Category name |
| `color_theme` | string | Color theme identifier (default: `progress`) |
| `color_transition_table` | array | Custom color transition table |
| `show_milliseconds` | boolean | Show milliseconds in display (default: `true`) |
| `timezone` | string | Timezone identifier (default: `UTC`) |

### Recurring timers

Weekly multi-slot example (counts down to the next class start, and to the
session end while a class is in session):

```json
{
    "id": "mat-202-algebra",
    "recur": true,
    "recur_rule": "weekly",
    "recur_schedule": [
        {"weekday": "Monday", "start": "08:30", "end": "12:30", "label": "Lecture"},
        {"weekday": "Thursday", "start": "12:00", "end": "16:00", "label": "Lab"}
    ]
}
```

Daily and interval examples:

```json
{"id": "standup", "recur": true, "recur_rule": "daily",
 "recur_schedule": [{"start": "09:00", "end": "09:15", "label": "Standup"}]}

{"id": "water-break", "recur": true, "recur_rule": "interval",
 "recur_interval_minutes": 90, "recur_anchor": "2026-01-01T08:00:00"}
```

### Event windows & checkpoints

START-END — one countdown to the start (8:30pm), then one to the end (11pm):

```json
{"id": "gig", "display_mode": "window",
 "window_start": "2026-09-11T20:30:00", "window_end": "2026-09-11T23:00:00"}
```

START-TRIGGER-…-TRIGGER-END — every checkpoint is its own timer; the display
rolls from one to the next, with a done/next rail under the digits:

```json
{"id": "gig-legs", "display_mode": "checkpoints", "checkpoints": [
  {"at": "2026-09-11T20:30:00", "label": "Doors open"},
  {"at": "2026-09-11T21:45:00", "label": "Main set"},
  {"at": "2026-09-11T23:00:00", "label": "End"}
]}
```

### Auto clock + API

Every `--timers-dir` build also generates:

- `output/up-next.html` — standalone yandere auto clock that picks the closest
  countdown every second. Fetches `api/up-next.json` / `api/timers.json` live
  at load and every minute (built-in snapshot is the instant offline fallback;
  sync status shows under the display). Supports `?timer=<id>` (lock to one
  timer), `?embed=1` (minimal view), `?json=1` (raw JSON), and a runtime API at
  `window.DisplauAPI` (`getTimers()`, `getUpcoming(n)`, `getCurrent()`,
  `getSyncState()`, `onSwitch(fn)`, `refresh()` + a `displau:switch` DOM event).
- `output/api/timers.json` — full manifest, closest-first, with precomputed
  `next_target` / `next_in_s` / `next_phase` per timer.
- `output/api/up-next.json` — current pick + next 10 upcoming.
- `output/api/status.json` — counts + build info.

### Privacy lock (PIN screen)

Keep annoying people out of your timers with a PIN gate over every page
(selector, timer pages, auto clock). Unlock lasts for the tab session; press
`L` or the 🔒 button to re-lock.

```bash
# 1. Hash your PIN (demo PIN is 2468)
python3 src/vMain.py --hash-pin 2468

# 2. Put it in config/build.json
"lock": {"enabled": true, "pin_sha256": "<hash>", "hint": "optional hint"}

# 3. Rebuild + push
python3 src/vMain.py --timers-dir --selector
```

Set `enabled: false` to ship without the gate. Note: this is a deterrent, not
vault security — static hosting means the raw files stay publicly fetchable.

### Kiosk mode

One-tap distraction-free display: press `K` on any timer page, the ⛶ button
on the auto clock, or open with `?kiosk=1`. Hides chrome + watermark, hides
the cursor after 3s idle (moves to wake), `ESC` exits.

### Custom themes

Per-timer color journey + page background via `"theme"`:
`toxic` (default), `yandere`, `amber`, `ice`, `blood`, `violet`, `midnight`.
An explicit `color_transition_table` always wins over the theme. The auto
clock follows each timer's theme as it switches.

## Build Script Usage

```bash
python3 vMain.py [target_time] [options]

Positional Arguments:
  target_time           Target time in ISO format (optional)

Options:
  --config-url URL      GitHub raw URL for config.json
  --config-id ID        Config identifier for output filename (default: default)
  --batch FILE          Build multiple HTMLs from a JSON batch file
  --all                 Build all timers from timers.json
  --timers-dir          Build all timers from the timers/ folder
  --selector            Generate index.html selector page (use with --timers-dir)
  --deploy              Clean output, rebuild all, and push to GitHub
  -v, --verbose         Enable verbose/debug output
  -h, --help            Show help message

Examples:
  python3 vMain.py 2026-12-31T23:59:59 --config-id newyear
  python3 vMain.py --timers-dir --selector
  python3 vMain.py --deploy
  python3 vMain.py --timers-dir -v  # Verbose mode
```

## Examples

### Build a Single Timer

```bash
python3 vMain.py 2026-12-31T23:59:59 --config-id newyear
```

### Build with GitHub Config

```bash
python3 vMain.py --config-url https://raw.githubusercontent.com/user/repo/gh-pages/timers/event.json --config-id event
```

### Build All Timers with Selector

```bash
python3 vMain.py --timers-dir --selector
```

### Enable Verbose Logging

```bash
python3 vMain.py --timers-dir --selector -v
```

## Development

### Running Tests

```bash
# Install dev dependencies first
pip install -e ".[dev]"

# Run tests
pytest
```

### Component System

The build system uses modular components:

- `components/html/` - HTML structure fragments
- `components/styles/` - CSS stylesheets
- `components/scripts/` - JavaScript modules

Components are combined and injected with configuration values during build.

### Configuration Files

- `config/build.json` - Build settings (version, GitHub repo, paths)
- `config/schema.json` - JSON Schema for timer validation

### Modifying Build Settings

Edit `config/build.json`:

```json
{
    "version": "2.0.0",
    "github": {
        "repo": "your-username/displau",
        "branch": "main"
    },
    "paths": {
        "timers": "timers",
        "output": "output"
    }
}
```

## GitHub Pages Setup

1. Enable GitHub Pages on your repository
2. Set source to `master` branch `/ (root)`
3. Configure `_config.yml` with your repository details
4. Run `python3 vMain.py --deploy` to build and push

## License

MIT License - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pytest`
5. Build and verify: `python3 vMain.py --timers-dir --selector`
6. Submit a pull request
