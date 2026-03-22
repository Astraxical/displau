#!/usr/bin/env python3
"""
7 Segment Display HTML Builder

Generates a custom 7-segment countdown display HTML file from modular components.
Configure the parameters below and run this script.

Supports GitHub-backed config for runtime updates.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# ============ CONFIGURATION ============
DEFAULT_TARGET_TIME = '2026-03-31T05:00:00'
DEFAULT_CONFIG_URL = ''  # e.g., 'https://raw.githubusercontent.com/user/repo/gh-pages/config.json'
GITHUB_REPO = 'Astraxical/displau'  # Your GitHub username/repo
GITHUB_BRANCH = 'master'  # Your branch name
TIMERS_PATH = 'genbuild/timers'  # Path to timers folder in repo
OUTPUT_DIR = 'output'
OUTPUT_PATTERN = '{config_id}_{timestamp}.html'

# Components to include (set to False to exclude)
INCLUDE_UNUSED_SCRIPTS = False
# =======================================

# Get the directory where this script is located
SCRIPT_DIR = Path(__file__).parent
COMPONENTS_DIR = SCRIPT_DIR / 'components'


def load_component(filepath):
    """Load a component file and return its content."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def load_html_components():
    """Load all HTML components."""
    html_dir = COMPONENTS_DIR / 'html'
    return {
        'doctype': load_component(html_dir / 'doctype.html'),
        'html_open': load_component(html_dir / 'html_open.html'),
        'head': load_component(html_dir / 'head.html'),
        'body': load_component(html_dir / 'body.html'),
        'closing': load_component(html_dir / 'closing.html'),
    }


def load_style_components():
    """Load all CSS style components."""
    styles_dir = COMPONENTS_DIR / 'styles'
    style_files = [
        'reset.css',
        'body.css',
        'display.css',
        'segment.css',
        'segments_horiz.css',
        'segments_vert.css',
        'colon.css',
        'decimal.css',
    ]
    
    combined_styles = []
    for style_file in style_files:
        style_path = styles_dir / style_file
        if style_path.exists():
            combined_styles.append(load_component(style_path))
    
    return '\n'.join(combined_styles)


def load_script_components():
    """Load all JavaScript components."""
    scripts_dir = COMPONENTS_DIR / 'scripts'
    script_files = [
        'config.js',
        'color_utils.js',
        'time_utils.js',
        'dom_utils.js',
        'render.js',
        'animation.js',
        'main.js',
    ]
    
    if INCLUDE_UNUSED_SCRIPTS:
        script_files.append('unused.js')
    
    combined_scripts = []
    for script_file in script_files:
        script_path = scripts_dir / script_file
        if script_path.exists():
            combined_scripts.append(load_component(script_path))
    
    return '\n'.join(combined_scripts)


def replace_placeholders(content, target_time, days_at_full_brightness, config_url):
    """Replace configuration placeholders in content."""
    return content.replace(
        '{{TARGET_TIME}}', target_time
    ).replace(
        '{{DAYS_AT_FULL_BRIGHTNESS}}', str(days_at_full_brightness)
    ).replace(
        '{{CONFIG_URL}}', config_url
    )


def get_config_url(config_id):
    """Generate GitHub raw URL for a config file."""
    return f"https://raw.githubusercontent.com/{GITHUB_REPO}/refs/heads/{GITHUB_BRANCH}/{TIMERS_PATH}/{config_id}.json"


def fetch_config_from_url(config_url):
    """Fetch config from a URL (GitHub raw URL, etc.)."""
    try:
        req = Request(config_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=10) as response:
            data = response.read().decode('utf-8')
            return json.loads(data)
    except (URLError, HTTPError, json.JSONDecodeError) as e:
        print(f"Warning: Could not fetch config from {config_url}: {e}")
        return None


def build_html(target_time_str=None, config_url='', config_id='default', auto_config=True):
    """Generate the HTML file from components."""
    # Get target time from arg or use default
    if target_time_str is None:
        target_time_str = DEFAULT_TARGET_TIME
    
    # Auto-generate config URL if enabled and not provided
    if auto_config and not config_url:
        config_url = get_config_url(config_id)
        print(f"Auto-generated config URL: {config_url}")

    # If config_url is provided, try to fetch target_time from it
    if config_url:
        config = fetch_config_from_url(config_url)
        if config and 'target_time' in config:
            target_time_str = config['target_time']
            print(f"Fetched target_time from config: {target_time_str}")

    # Calculate milliseconds at full brightness based on time difference
    target_dt = datetime.fromisoformat(target_time_str)
    now = datetime.now()
    time_diff = target_dt - now
    milliseconds_at_full_brightness = max(0, int(time_diff.total_seconds() * 1000))

    # Load all components
    html = load_html_components()
    styles = load_style_components()
    scripts = load_script_components()

    # Replace placeholders in scripts
    scripts = replace_placeholders(scripts, target_time_str, milliseconds_at_full_brightness, config_url)

    # Also replace placeholder in html_open
    html['html_open'] = html['html_open'].replace('{{CONFIG_URL}}', config_url)

    # Assemble the final HTML
    final_html = (
        html['doctype'] +
        html['html_open'] +
        html['head'].replace('/* STYLES_INJECT */', styles) +
        html['body'].replace('/* CONFIG_INJECT */', '').replace('/* SCRIPTS_INJECT */', scripts) +
        html['closing']
    )

    # Determine output path
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_filename = OUTPUT_PATTERN.format(config_id=config_id, timestamp=timestamp)
    output_path = SCRIPT_DIR / OUTPUT_DIR / output_filename

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write the final HTML
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_html)

    print(f"Generated {output_path} with:")
    print(f"  TARGET_TIME = {target_time_str}")
    print(f"  MILLISECONDS_AT_FULL_BRIGHTNESS = {milliseconds_at_full_brightness}")
    print(f"  CONFIG_URL = {config_url}")


def build_batch(batch_file):
    """Build multiple HTML files from a batch configuration file."""
    with open(batch_file, 'r', encoding='utf-8') as f:
        batch_configs = json.load(f)

    if not isinstance(batch_configs, list):
        batch_configs = [batch_configs]

    print(f"Building {len(batch_configs)} HTML file(s)...")

    for i, cfg in enumerate(batch_configs, 1):
        config_id = cfg.get('config_id', f'config_{i}')
        config_url = cfg.get('config_url', '')
        target_time = cfg.get('target_time', None)

        print(f"\n[{i}/{len(batch_configs)}] Building {config_id}...")
        build_html(
            target_time_str=target_time,
            config_url=config_url,
            config_id=config_id
        )


def build_all_timers():
    """Build all timers from timers.json file."""
    timers_file = SCRIPT_DIR / 'timers.json'

    if not timers_file.exists():
        print(f"Error: timers.json not found at {timers_file}")
        return

    with open(timers_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Support both {timers: [...]} and direct array format
    timers = data.get('timers', data if isinstance(data, list) else [])

    if not timers:
        print("Error: No timers found in timers.json")
        return

    print(f"Building {len(timers)} timer(s) from timers.json...")

    for i, timer in enumerate(timers, 1):
        config_id = timer.get('id', f'timer_{i}')
        target_time = timer.get('target_time', None)

        print(f"\n[{i}/{len(timers)}] Building {config_id}...")
        build_html(
            target_time_str=target_time,
            config_id=config_id,
            auto_config=True  # Auto-generate config URL
        )


def build_timers_folder():
    """Build all timers from the timers/ folder."""
    timers_dir = SCRIPT_DIR / 'timers'

    if not timers_dir.exists():
        print(f"Error: timers/ folder not found at {timers_dir}")
        return

    timer_files = sorted(timers_dir.glob('*.json'))

    if not timer_files:
        print(f"Error: No .json files found in {timers_dir}")
        return

    print(f"Building {len(timer_files)} timer(s) from timers/ folder...")

    for i, timer_file in enumerate(timer_files, 1):
        with open(timer_file, 'r', encoding='utf-8') as f:
            timer = json.load(f)

        config_id = timer.get('id', timer_file.stem)
        target_time = timer.get('target_time', None)

        print(f"\n[{i}/{len(timer_files)}] Building {config_id}...")
        build_html(
            target_time_str=target_time,
            config_id=config_id,
            auto_config=True  # Auto-generate config URL
        )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='7 Segment Display HTML Builder - Generate countdown display with GitHub-backed config'
    )
    parser.add_argument(
        'target_time',
        nargs='?',
        default=None,
        help='Target time in ISO format (e.g., 2026-03-31T05:00:00). If omitted, uses default or fetches from config_url'
    )
    parser.add_argument(
        '--config-url',
        default='',
        help='GitHub raw URL for config.json (e.g., https://raw.githubusercontent.com/user/repo/gh-pages/config.json)'
    )
    parser.add_argument(
        '--config-id',
        default='default',
        help='Config identifier for output filename (default: default)'
    )
    parser.add_argument(
        '--batch',
        metavar='BATCH_FILE',
        help='Build multiple HTMLs from a JSON batch file'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Build all timers from timers.json'
    )
    parser.add_argument(
        '--timers-dir',
        action='store_true',
        help='Build all timers from the timers/ folder'
    )

    args = parser.parse_args()

    if args.batch:
        build_batch(args.batch)
    elif args.all:
        build_all_timers()
    elif args.timers_dir:
        build_timers_folder()
    else:
        build_html(
            target_time_str=args.target_time,
            config_url=args.config_url,
            config_id=args.config_id
        )
