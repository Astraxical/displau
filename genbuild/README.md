# 7 Segment Display HTML Builder

Generates a custom 7-segment countdown display HTML file from modular components.

Features **GitHub-backed configuration** for runtime updates without rebuilding.

## Quick Start

```bash
# Basic build with default config
python vMain.py

# Build with custom target time
python vMain.py 2026-12-31T23:59:59

# Build with GitHub config URL (recommended)
python vMain.py --config-url "https://raw.githubusercontent.com/youruser/yourrepo/gh-pages/config.json" --config-id my-event

# Build all timers from timers.json
python vMain.py --all

# Build all timers from timers/ folder
python vMain.py --timers-dir
```

## Timers System

### Using `timers.json`

Create a `timers.json` file with multiple timer configurations:

```json
{
    "timers": [
        {
            "id": "default",
            "target_time": "2026-03-31T05:00:00",
            "config_url": ""
        },
        {
            "id": "newyear",
            "target_time": "2027-01-01T00:00:00",
            "config_url": ""
        },
        {
            "id": "launch",
            "target_time": "2026-06-15T10:00:00",
            "config_url": "https://raw.githubusercontent.com/user/repo/gh-pages/configs/launch.json"
        }
    ]
}
```

Build all timers:
```bash
python vMain.py --all
```

### Using `timers/` Folder

Create individual timer config files in the `timers/` folder:

```
timers/
├── default.json
├── newyear.json
└── launch.json
```

Each file contains:
```json
{
    "id": "newyear",
    "target_time": "2027-01-01T00:00:00",
    "config_url": ""
}
```

Build all timers from folder:
```bash
python vMain.py --timers-dir
```

## GitHub Configuration Setup

### 1. Create a GitHub Repository

```bash
# Initialize git in your project (if not already)
git init
git remote add origin https://github.com/youruser/yourrepo.git
```

### 2. Create config.json

Create a `config.json` file in your repository:

```json
{
    "target_time": "2026-03-31T05:00:00",
    "config_id": "default"
}
```

### 3. Enable GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Source: Deploy from branch → `gh-pages` (or `main` if using `/docs` folder)
3. Save

### 4. Get Your Raw Config URL

The raw URL format is:
```
https://raw.githubusercontent.com/youruser/yourrepo/gh-pages/config.json
```

### 5. Build HTML with Config URL

```bash
python vMain.py --config-url "https://raw.githubusercontent.com/youruser/yourrepo/gh-pages/config.json"
```

### 6. Update Config on GitHub

Edit `config.json` on GitHub (via UI or push changes) → HTML picks up changes on next load (cached for 5 minutes).

## Runtime Behavior

When the HTML loads:

1. **Check localStorage cache** - Uses cached config if not expired (5 min)
2. **Fetch from GitHub** - Gets latest config from the raw URL
3. **Fallback to defaults** - Uses hardcoded values if fetch fails

## Batch Build (Multiple HTMLs)

Create a batch config file `batch.json`:

```json
[
    {
        "config_id": "newyear",
        "config_url": "https://raw.githubusercontent.com/user/repo/gh-pages/configs/newyear.json",
        "target_time": "2026-12-31T23:59:59"
    },
    {
        "config_id": "launch",
        "config_url": "https://raw.githubusercontent.com/user/repo/gh-pages/configs/launch.json",
        "target_time": "2026-06-15T10:00:00"
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
| `--config-url` | GitHub raw URL for config.json |
| `--config-id` | Identifier for output filename (default: `default`) |
| `--batch` | Build multiple HTMLs from a JSON batch file |
| `--all` | Build all timers from `timers.json` |
| `--timers-dir` | Build all timers from `timers/` folder |

## Project Structure

```
genbuild/
├── vMain.py              # Build script
├── config.json           # Local config template
├── timers.json           # Multiple timer configs
├── timers/               # Individual timer configs (folder)
├── components/
│   ├── html/             # HTML fragments
│   ├── styles/           # CSS files
│   └── scripts/          # JavaScript files
└── output/               # Generated HTML files
```

## Editing Components

- **HTML**: Modify files in `components/html/`
- **Styles**: Modify files in `components/styles/`
- **Scripts**: Modify files in `components/scripts/`

Then rebuild:

```bash
python vMain.py --config-url "your-github-config-url"
```

## Cache Configuration

Browser cache duration is set to **5 minutes** by default. To change:

Edit `components/scripts/config.js`:
```javascript
const CACHE_DURATION_MS = 5 * 60 * 1000; // Change this value
```

## License

MIT
