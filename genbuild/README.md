# 7 Segment Display HTML Builder

Generates a custom 7-segment countdown display HTML file from modular components.

Features **GitHub-backed configuration** for runtime updates without rebuilding.

## Quick Start

```bash
# Build single timer with auto-generated GitHub config URL
python vMain.py --config-id assembly

# Build with custom target time
python vMain.py 2026-12-31T23:59:59 --config-id my-event

# Build all timers from timers/ folder
python vMain.py --timers-dir

# Build all timers from timers.json
python vMain.py --all
```

## Timers System

### Using `timers/` Folder (Recommended)

Create individual timer config files in the `timers/` folder:

```
timers/
├── assembly.json
├── graduation.json
└── limerance-dead.json
```

Each file contains:
```json
{
    "id": "assembly",
    "target_time": "2026-03-24T05:30:00",
    "start_time": "2026-03-21T23:54:57"
}
```

**Config URL is auto-generated!** The build script creates the GitHub raw URL from:
- Your GitHub repo (configured in `vMain.py`)
- Timer ID → `{repo}/genbuild/timers/{id}.json`

Build all timers:
```bash
python vMain.py --timers-dir
```

### Using `timers.json`

Create a `timers.json` file with multiple timer configurations:

```json
{
    "timers": [
        {
            "id": "assembly",
            "target_time": "2026-03-24T05:30:00",
            "start_time": "2026-03-21T23:54:57"
        },
        {
            "id": "graduation",
            "target_time": "2026-03-31T05:00:00",
            "start_time": "2026-03-21T23:55:38"
        }
    ]
}
```

Build all timers:
```bash
python vMain.py --all
```

## Timer Selector Page

Generate an index.html selector page that lists all timers:

```bash
python vMain.py --timers-dir --selector
```

This creates `output/index.html` with links to all built timers.

## GitHub Configuration Setup

### 1. Configure Repository in vMain.py

Edit the top of `vMain.py`:
```python
GITHUB_REPO = 'Astraxical/displau'  # Your GitHub username/repo
GITHUB_BRANCH = 'master'            # Your branch name
TIMERS_PATH = 'genbuild/timers'     # Path to timers folder
```

### 2. Create Timer Configs

Create timer JSON files in `timers/`:
```json
{
    "id": "my-timer",
    "target_time": "2026-12-31T23:59:59",
    "start_time": "2026-01-01T00:00:00"
}
```

### 3. Build and Push

```bash
# Build all timers
python vMain.py --timers-dir

# Commit and push
git add . && git commit -m "Build timers" && git push
```

### 4. Enable GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Source: Deploy from branch → `master` (or `main`)
3. Save

### 5. Access Your Timers

- **Selector Page**: `https://youruser.github.io/yourrepo/genbuild/output/`
- **Individual Timer**: `https://youruser.github.io/yourrepo/genbuild/output/assembly_*.html`

## Runtime Behavior

When the HTML loads:

1. **Check localStorage cache** - Uses cached config if not expired (5 min)
2. **Fetch from GitHub** - Gets latest config from the raw URL
3. **Fallback to defaults** - Uses hardcoded values if fetch fails

## Sync Behavior

| Action | Result |
|--------|--------|
| Edit timer JSON on GitHub | ✅ All HTMLs sync on next load |
| Open downloaded HTML | ✅ Fetches latest from GitHub |
| Offline (no internet) | ✅ Uses cached config |
| After 5 minutes | ✅ Auto-refetches from GitHub |

## Batch Build (Multiple HTMLs)

Create a batch config file `batch.json`:

```json
[
    {
        "config_id": "newyear",
        "target_time": "2026-12-31T23:59:59",
        "start_time": "2026-01-01T00:00:00"
    },
    {
        "config_id": "launch",
        "target_time": "2026-06-15T10:00:00",
        "start_time": "2026-03-01T00:00:00"
    }
]
```

Build all:
```bash
python vMain.py --batch batch.json
```

## Command Line Options

| Option | Description |
|--------|-------------|
| `target_time` | Target time in ISO format (positional, optional) |
| `--config-url` | GitHub raw URL for config.json (manual override) |
| `--config-id` | Timer identifier for output filename |
| `--batch` | Build multiple HTMLs from a JSON batch file |
| `--all` | Build all timers from `timers.json` |
| `--timers-dir` | Build all timers from `timers/` folder |
| `--selector` | Generate index.html selector page |

## Project Structure

```
genbuild/
├── vMain.py              # Build script
├── README.md             # This file
├── timers.json           # Multiple timer configs (optional)
├── timers/               # Individual timer configs
│   ├── assembly.json
│   ├── graduation.json
│   └── limerance-dead.json
├── components/
│   ├── html/             # HTML fragments
│   ├── styles/           # CSS files
│   └── scripts/          # JavaScript files
├── output/               # Generated HTML files
│   ├── index.html        # Timer selector (if generated)
│   ├── assembly_*.html
│   ├── graduation_*.html
│   └── limerance-dead_*.html
└── old-timers/           # Original HTMLs (reference)
    ├── assembly.html
    ├── graduation.html
    └── limerance-dead.html
```

## Editing Components

- **HTML**: Modify files in `components/html/`
- **Styles**: Modify files in `components/styles/`
- **Scripts**: Modify files in `components/scripts/`

Then rebuild:
```bash
python vMain.py --timers-dir
```

## Cache Configuration

Browser cache duration is set to **5 minutes** by default. To change:

Edit `components/scripts/config.js`:
```javascript
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes
```

## Config Schema

Each timer JSON supports:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Timer identifier |
| `target_time` | string | Yes | ISO 8601 datetime |
| `start_time` | string | No | ISO 8601 datetime (defaults to build time) |

Example:
```json
{
    "id": "event",
    "target_time": "2026-12-31T23:59:59",
    "start_time": "2026-01-01T00:00:00"
}
```

## License

MIT
