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

## Project Structure

```
displau/
├── genbuild/                    # Stable build system
│   ├── vMain.py                # Main build script
│   ├── components/             # HTML/CSS/JS components
│   ├── index/                  # Selector page assets
│   └── timers/                 # Timer configurations (stable)
├── genbuild-experimental/       # Experimental build system
│   └── ...                     # Same structure as genbuild
├── g-timers/
│   ├── stable/                 # Stable timer JSON configs
│   └── experimental/           # Experimental timer JSON configs
├── g-output/
│   ├── stable/                 # Generated stable HTML files
│   └── experimental/           # Generated experimental HTML files
└── index.html                  # Timer selector page
```

## Quick Start

### Build All Timers

```bash
cd genbuild
python3 vMain.py --timers-dir --selector
```

This will:
1. Build all timer HTML files from `g-timers/stable/*.json`
2. Generate the selector page (`index.html`)
3. Output files to `g-output/stable/`

### Build Experimental Timers

```bash
cd genbuild-experimental
python3 vMain.py --timers-dir --selector
```

### Deploy to GitHub Pages

```bash
cd genbuild
python3 vMain.py --deploy
```

This will:
1. Clean the output folder
2. Rebuild all timers
3. Git add, commit, and push changes

## Timer Configuration

Each timer is defined by a JSON file in `g-timers/stable/` or `g-timers/experimental/`:

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
| `id` | string | Unique identifier for the timer (used in filename) |
| `display_name` | string | Human-readable name shown in the selector |
| `description` | string | Description of the timer |
| `target_time` | string | ISO 8601 datetime when timer ends |
| `start_time` | string | ISO 8601 datetime when timer starts |
| `direction` | string | Timer direction: `"down"` or `"up"` |
| `min_value` | number | Minimum value for countdown |
| `max_value` | number | Maximum value (null for unlimited) |
| `on_expire` | string | Action on expiry: `"stop"`, `"reset"`, etc. |
| `display_on_expire` | boolean | Whether to show in selector after expiry |
| `tags` | array | Tags for categorization |
| `category` | string | Category name |
| `color_theme` | string | Color theme identifier |
| `show_milliseconds` | boolean | Show milliseconds in display |
| `timezone` | string | Timezone identifier |

## Build Script Usage

```bash
python3 vMain.py [options]

Options:
  target_time           Target time in ISO format (optional)
  --config-url URL      GitHub raw URL for config.json
  --config-id ID        Config identifier for output filename
  --batch FILE          Build multiple HTMLs from a JSON batch file
  --all                 Build all timers from timers.json
  --timers-dir          Build all timers from the timers/ folder
  --selector            Generate index.html selector page
  --deploy              Clean, rebuild, and push to GitHub
```

## Examples

### Build a Single Timer

```bash
python3 vMain.py 2026-12-31T23:59:59 --config-id newyear
```

### Build with GitHub Config

```bash
python3 vMain.py --config-url https://raw.githubusercontent.com/user/repo/gh-pages/g-timers/stable/event.json --config-id event
```

### Build All Timers with Selector

```bash
python3 vMain.py --timers-dir --selector
```

## Development

### Stable vs Experimental

- **Stable** (`genbuild/`): Production-ready timers
- **Experimental** (`genbuild-experimental/`): Testing new features

Both have identical structure but output to different folders.

### Component System

The build system uses modular components:

- `components/html/` - HTML structure fragments
- `components/styles/` - CSS stylesheets
- `components/scripts/` - JavaScript modules

Components are combined and injected with configuration values during build.

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
4. Test with `--timers-dir --selector`
5. Submit a pull request
