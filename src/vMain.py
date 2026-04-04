#!/usr/bin/env python3
"""
7 Segment Display HTML Builder

Generates a custom 7-segment countdown display HTML file from modular components.
Supports GitHub-backed config for runtime updates.
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
import subprocess
import sys
import time
from argparse import ArgumentParser
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# Script directory
SCRIPT_DIR = Path(__file__).parent

# Load build configuration
CONFIG_FILE = SCRIPT_DIR / '../config/build.json'
with open(CONFIG_FILE, 'r') as f:
    BUILD_CONFIG = json.load(f)

# Extract config values
VERSION = BUILD_CONFIG['version']
GITHUB_REPO = BUILD_CONFIG['github']['repo']
GITHUB_BRANCH = BUILD_CONFIG['github']['branch']
TIMERS_PATH = BUILD_CONFIG['paths']['timers']
TIMERS_DIR = SCRIPT_DIR / '../' / BUILD_CONFIG['paths']['timers']
OUTPUT_DIR = SCRIPT_DIR / '../' / BUILD_CONFIG['paths']['output']
COMPONENTS_DIR = SCRIPT_DIR / BUILD_CONFIG['paths']['components']
DEFAULT_TARGET_TIME = BUILD_CONFIG['build']['default_target_time']
OUTPUT_PATTERN = BUILD_CONFIG['build']['output_pattern']
INCLUDE_UNUSED_SCRIPTS = BUILD_CONFIG['build']['include_unused_scripts']

# Schema validation (optional - only if jsonschema is installed)
try:
    import jsonschema
    SCHEMA_FILE = SCRIPT_DIR / '../config/schema.json'
    with open(SCHEMA_FILE, 'r') as f:
        TIMER_SCHEMA = json.load(f)
    HAS_SCHEMA = True
except ImportError:
    HAS_SCHEMA = False
    TIMER_SCHEMA = None

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Build statistics
class BuildStats:
    """Track build statistics."""
    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.timers_built = 0
        self.timers_failed = 0
        self.total_size = 0
        self.errors = []
    
    def start(self):
        self.start_time = time.time()
    
    def stop(self):
        self.end_time = time.time()
    
    def add_success(self, size: int):
        self.timers_built += 1
        self.total_size += size
    
    def add_error(self, timer_id: str, error: str):
        self.timers_failed += 1
        self.errors.append(f"{timer_id}: {error}")
    
    def get_duration(self) -> float:
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return 0.0
    
    def print_summary(self):
        """Print build summary."""
        duration = self.get_duration()
        avg_size = self.total_size / max(1, self.timers_built)
        
        logger.info("=" * 50)
        logger.info("BUILD SUMMARY")
        logger.info("=" * 50)
        logger.info(f"  Duration: {duration:.2f}s")
        logger.info(f"  Timers built: {self.timers_built}")
        logger.info(f"  Timers failed: {self.timers_failed}")
        logger.info(f"  Total size: {self.total_size:,} bytes")
        logger.info(f"  Average size: {avg_size:,.0f} bytes")
        
        if self.errors:
            logger.warning(f"  Errors: {len(self.errors)}")
            for error in self.errors:
                logger.warning(f"    - {error}")
        
        logger.info("=" * 50)


stats = BuildStats()


def load_component(filepath: Path) -> str:
    """Load a component file and return its content."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def load_html_components() -> dict[str, str]:
    """Load all HTML components."""
    html_dir = COMPONENTS_DIR / 'html'
    return {
        'doctype': load_component(html_dir / 'doctype.html'),
        'html_open': load_component(html_dir / 'html_open.html'),
        'head': load_component(html_dir / 'head.html'),
        'body': load_component(html_dir / 'body.html'),
        'closing': load_component(html_dir / 'closing.html'),
    }


def load_style_components() -> str:
    """Load all CSS style components."""
    styles_dir = COMPONENTS_DIR / 'styles'
    style_files = [
        'reset.css',
        'body.css',
        'display.css',
        'segment.css',
        'segments.css',
        'colon.css',
        'decimal.css',
    ]

    combined_styles = []
    for style_file in style_files:
        style_path = styles_dir / style_file
        if style_path.exists():
            combined_styles.append(load_component(style_path))

    return '\n'.join(combined_styles)


def load_script_components() -> str:
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


def replace_placeholders(
    content: str,
    target_time: str,
    days_at_full_brightness: int,
    config_url: str,
    start_time: str,
    direction: str = 'down',
    min_value: int = 0,
    max_value: Optional[int | str] = 'null',
    version_type: str = 'STABLE',
    build_date: Optional[str] = None,
    display_name: str = ''
) -> str:
    """Replace configuration placeholders in content."""
    if build_date is None:
        now = datetime.now()
        timestamp = now.strftime('%Y%m%d%H%M%S')
        build_date = f"{VERSION}.{timestamp}.{version_type.lower()}"

    replacements = {
        '{{TARGET_TIME}}': target_time,
        '{{DAYS_AT_FULL_BRIGHTNESS}}': str(days_at_full_brightness),
        '{{CONFIG_URL}}': config_url,
        '{{START_TIME}}': start_time,
        '{{DIRECTION}}': direction,
        '{{MIN_VALUE}}': str(min_value),
        '{{MAX_VALUE}}': str(max_value) if max_value is not None else 'null',
        '{{VERSION_TYPE}}': version_type,
        '{{BUILD_DATE}}': build_date,
        '{{DISPLAY_NAME}}': display_name,
    }

    for placeholder, value in replacements.items():
        content = content.replace(placeholder, value)

    return content


def get_config_url(config_id: str, relative_path: str = None) -> str:
    """Generate GitHub raw URL for a config file."""
    if relative_path:
        return f"https://raw.githubusercontent.com/{GITHUB_REPO}/refs/heads/{GITHUB_BRANCH}/{relative_path}"
    return f"https://raw.githubusercontent.com/{GITHUB_REPO}/refs/heads/{GITHUB_BRANCH}/{TIMERS_PATH}/{config_id}.json"


def fetch_config_from_url(config_url: str) -> Optional[dict[str, Any]]:
    """Fetch config from a URL (GitHub raw URL, etc.)."""
    try:
        req = Request(config_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=10) as response:
            data = response.read().decode('utf-8')
            return json.loads(data)
    except (URLError, HTTPError, json.JSONDecodeError) as e:
        logger.debug(f"Could not fetch config from {config_url}: {e}")
        return None


def validate_timer_config(config: dict[str, Any], config_id: str) -> bool:
    """Validate timer configuration against schema."""
    if not HAS_SCHEMA:
        logger.debug("Schema validation skipped (jsonschema not installed)")
        return True

    try:
        jsonschema.validate(instance=config, schema=TIMER_SCHEMA)
        return True
    except jsonschema.ValidationError as e:
        logger.error(f"Validation error for {config_id}: {e.message}")
        return False
    except jsonschema.SchemaError as e:
        logger.error(f"Schema error for {config_id}: {e.message}")
        return False


def build_html(
    target_time_str: Optional[str] = None,
    config_url: str = '',
    config_id: str = 'default',
    auto_config: bool = True,
    start_time_str: Optional[str] = None,
    use_local_config: bool = False,
    config_relative_path: str = None
) -> None:
    """Generate the HTML file from components."""
    if target_time_str is None:
        target_time_str = DEFAULT_TARGET_TIME

    if auto_config and not config_url:
        config_url = get_config_url(config_id, config_relative_path)
        logger.info(f"Auto-generated config URL: {config_url}")

    if config_url and not use_local_config:
        config = fetch_config_from_url(config_url)
        if config:
            if 'target_time' in config and target_time_str is None:
                target_time_str = config['target_time']
                logger.info(f"Fetched target_time from config: {target_time_str}")
            if 'start_time' in config and start_time_str is None:
                start_time_str = config['start_time']
                logger.info(f"Fetched start_time from config: {start_time_str}")

    target_dt = datetime.fromisoformat(target_time_str)
    now = datetime.now()
    time_diff = target_dt - now
    milliseconds_at_full_brightness = max(0, int(time_diff.total_seconds() * 1000))

    if start_time_str is None:
        start_time_str = now.isoformat(timespec='seconds')

    html = load_html_components()
    styles = load_style_components()
    scripts = load_script_components()

    direction = 'down'
    min_value = 0
    max_value = 'null'
    version_type = 'STABLE'
    display_name = ''

    if config_url:
        config = fetch_config_from_url(config_url)
        if config:
            direction = config.get('direction', 'down')
            min_value = config.get('min_value', 0)
            max_val = config.get('max_value', None)
            max_value = 'null' if max_val is None else str(max_val)
            display_name = config.get('display_name', '')

    scripts = replace_placeholders(
        scripts, target_time_str, milliseconds_at_full_brightness,
        config_url, start_time_str, direction, min_value, max_value, version_type, display_name=display_name
    )
    html['body'] = replace_placeholders(
        html['body'], target_time_str, milliseconds_at_full_brightness,
        config_url, start_time_str, direction, min_value, max_value, version_type, display_name=display_name
    )
    html['html_open'] = html['html_open'].replace('{{CONFIG_URL}}', config_url)

    final_html = (
        html['doctype'] +
        html['html_open'] +
        html['head'].replace('/* STYLES_INJECT */', styles) +
        html['body'].replace('/* CONFIG_INJECT */', '').replace('/* SCRIPTS_INJECT */', scripts) +
        html['closing']
    )

    output_filename = OUTPUT_PATTERN.format(config_id=config_id)
    output_path = OUTPUT_DIR / output_filename

    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(final_html)
        
        file_size = output_path.stat().st_size
        stats.add_success(file_size)
        
        logger.info(f"Generated {output_path} ({file_size:,} bytes)")
        logger.info(f"  TARGET_TIME = {target_time_str}")
        logger.info(f"  START_TIME = {start_time_str}")
        logger.info(f"  CONFIG_URL = {config_url}")
    except Exception as e:
        stats.add_error(config_id, str(e))
        logger.error(f"Failed to generate {output_path}: {e}")


def build_batch(batch_file: str) -> None:
    """Build multiple HTML files from a batch configuration file."""
    with open(batch_file, 'r', encoding='utf-8') as f:
        batch_configs = json.load(f)

    if not isinstance(batch_configs, list):
        batch_configs = [batch_configs]

    logger.info(f"Building {len(batch_configs)} HTML file(s)...")

    for i, cfg in enumerate(batch_configs, 1):
        config_id = cfg.get('config_id', f'config_{i}')
        config_url = cfg.get('config_url', '')
        target_time = cfg.get('target_time', None)

        logger.info(f"[{i}/{len(batch_configs)}] Building {config_id}...")
        build_html(
            target_time_str=target_time,
            config_url=config_url,
            config_id=config_id
        )


def build_all_timers() -> None:
    """Build all timers from timers.json file."""
    timers_file = SCRIPT_DIR / 'timers.json'

    if not timers_file.exists():
        logger.error(f"timers.json not found at {timers_file}")
        return

    with open(timers_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    timers = data.get('timers', data if isinstance(data, list) else [])

    if not timers:
        logger.error("No timers found in timers.json")
        return

    logger.info(f"Building {len(timers)} timer(s) from timers.json...")

    for i, timer in enumerate(timers, 1):
        config_id = timer.get('id', f'timer_{i}')
        target_time = timer.get('target_time', None)

        logger.info(f"[{i}/{len(timers)}] Building {config_id}...")
        build_html(
            target_time_str=target_time,
            config_id=config_id,
            auto_config=True
        )


def classify_timer(timer: dict[str, Any], now: datetime) -> str:
    """
    Classify a timer based on its status.
    
    Returns:
        'active' - Currently running (start < now < target)
        'inactive' - Expired and hidden, or disabled
        'unknown' - Upcoming or expired but still displayed
    """
    # Check if disabled
    if not timer.get('enabled', True):
        return 'inactive'
    
    target_time_str = timer.get('target_time', '')
    start_time_str = timer.get('start_time', '')
    display_on_expire = timer.get('display_on_expire', True)
    
    try:
        target_dt = datetime.fromisoformat(target_time_str)
        start_dt = datetime.fromisoformat(start_time_str) if start_time_str else now
        
        if now > target_dt:
            # Timer has expired
            if not display_on_expire:
                return 'inactive'
            return 'unknown'  # Expired but still displayed
        elif now < start_dt:
            # Timer hasn't started yet
            return 'unknown'
        else:
            # Currently running
            return 'active'
    except (ValueError, TypeError):
        return 'unknown'


def organize_timers(timer_ids: set[str]) -> None:
    """
    Organize timer files into appropriate subdirectories based on status.
    """
    now = datetime.now()
    
    # Status folders
    status_folders = ['active', 'inactive', 'unknown']
    
    # Ensure status folders exist
    for folder in status_folders:
        (TIMERS_DIR / folder).mkdir(parents=True, exist_ok=True)
    
    # Scan all timer files (including subdirectories)
    all_timer_files = list(TIMERS_DIR.glob('**/*.json'))
    
    for timer_file in all_timer_files:
        # Skip TEMPLATE.json and README.md
        if timer_file.name.startswith('TEMPLATE') or timer_file.name == 'README.md':
            continue
        
        # Skip files already in status folders
        if timer_file.parent.name in status_folders:
            continue
        
        # Read timer config
        try:
            with open(timer_file, 'r', encoding='utf-8') as f:
                timer = json.load(f)
            
            # Classify timer
            status = classify_timer(timer, now)
            
            # Move file to appropriate folder
            dest_file = TIMERS_DIR / status / timer_file.name
            if timer_file != dest_file:
                dest_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(timer_file), str(dest_file))
                logger.info(f"Moved {timer_file.name} → {status}/")
        except Exception as e:
            logger.warning(f"Failed to organize {timer_file.name}: {e}")


def build_timers_folder(generate_selector_page: bool = False, organize: bool = True) -> None:
    """Build all timers from the timers/ folder."""
    stats.start()

    if not TIMERS_DIR.exists():
        logger.error(f"timers/ folder not found at {TIMERS_DIR}")
        return

    # Scan all subdirectories recursively
    timer_files = sorted([
        f for f in TIMERS_DIR.glob('**/*.json')
        if not f.name.startswith('TEMPLATE') and f.name != 'README.md'
    ])

    if not timer_files:
        logger.error(f"No .json files found in {TIMERS_DIR}")
        return

    logger.info(f"Building {len(timer_files)} timer(s) from timers/ folder...")

    timers_list = []
    timer_ids = set()

    for i, timer_file in enumerate(timer_files, 1):
        with open(timer_file, 'r', encoding='utf-8') as f:
            timer = json.load(f)

        # Check if enabled
        if not timer.get('enabled', True):
            logger.info(f"Skipping {timer_file.stem} (disabled)")
            continue

        # Validate timer config
        if HAS_SCHEMA:
            if not validate_timer_config(timer, timer_file.stem):
                logger.warning(f"Skipping {timer_file.stem} due to validation errors")
                continue

        config_id = timer.get('id', timer_file.stem)
        target_time = timer.get('target_time', None)

        # Skip expired timers with display_on_expire=false
        display_on_expire = timer.get('display_on_expire', True)
        if target_time:
            try:
                target_dt = datetime.fromisoformat(target_time)
                now = datetime.now()
                if now >= target_dt and not display_on_expire:
                    logger.info(f"Skipping {config_id} (expired, display_on_expire=false)")
                    continue
            except (ValueError, TypeError):
                pass

        # Calculate relative path from TIMERS_DIR for GitHub URL
        try:
            relative_path = timer_file.relative_to(TIMERS_DIR)
            config_relative_path = f"{TIMERS_PATH}/{relative_path}"
        except ValueError:
            config_relative_path = None

        timer_ids.add(config_id)

        logger.info(f"[{i}/{len(timer_files)}] Building {config_id}...")
        build_html(
            target_time_str=target_time,
            config_id=config_id,
            auto_config=True,
            config_relative_path=config_relative_path
        )

        timers_list.append(timer)

    clean_orphaned_outputs(timer_ids)

    # Organize timers into status folders
    if organize:
        logger.info("Organizing timers by status...")
        organize_timers(timer_ids)

    if generate_selector_page:
        generate_selector(timers_list)

    stats.stop()
    stats.print_summary()


def deploy(generate_selector_page: bool = True) -> None:
    """Clean output folder, rebuild all timers, and push to GitHub."""
    if OUTPUT_DIR.exists():
        logger.info(f"Deleting {OUTPUT_DIR}...")
        shutil.rmtree(OUTPUT_DIR)

    logger.info("Rebuilding all timers...")
    build_timers_folder(generate_selector_page=generate_selector_page)

    logger.info("Pushing to GitHub...")

    # Check if there are any changes (including deletions)
    result = subprocess.run(
        ['git', '-C', str(SCRIPT_DIR), 'status', '--porcelain'],
        capture_output=True, text=True
    )

    if result.stdout.strip():
        # Use git add -A to stage all changes including deletions
        subprocess.run(['git', '-C', str(SCRIPT_DIR), 'add', '-A', '.'], check=True)

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        subprocess.run(
            ['git', '-C', str(SCRIPT_DIR), 'commit', '-m', f'Auto-deploy: {timestamp}'],
            check=True
        )

        subprocess.run(['git', '-C', str(SCRIPT_DIR), 'push'], check=True)

        logger.info("✅ Deployed successfully!")
    else:
        logger.info("No changes to commit.")


def clean_orphaned_outputs(timer_ids: set[str]) -> None:
    """Delete HTML files that don't have corresponding timer JSON configs."""
    if not OUTPUT_DIR.exists():
        return

    html_files = list(OUTPUT_DIR.glob('*.html'))

    deleted_count = 0
    for html_file in html_files:
        config_id = html_file.stem

        if config_id == 'index':
            continue

        if config_id not in timer_ids:
            html_file.unlink()
            logger.info(f"Deleted orphaned HTML: {html_file.name}")
            deleted_count += 1

    if deleted_count > 0:
        logger.info(f"Cleaned {deleted_count} orphaned HTML file(s)")


def generate_selector(timers_list: list[dict[str, Any]]) -> None:
    """Generate an index.html selector page with links to all timers."""
    # Place index.html at project root for GitHub Pages
    output_path = SCRIPT_DIR / '../index.html'

    version_type = 'STABLE'
    now = datetime.now()
    timestamp = now.strftime('%Y%m%d%H%M%S')
    build_date = f"{VERSION}.{timestamp}.{version_type.lower()}"

    timers_data = []

    for timer in timers_list:
        config_id = timer.get('id', 'unknown')
        target_time = timer.get('target_time', 'Unknown')
        start_time = timer.get('start_time', 'Unknown')
        display_name = timer.get('display_name', config_id.replace('-', ' ').title())

        try:
            start_dt = datetime.fromisoformat(start_time)
            target_dt = datetime.fromisoformat(target_time)
            total_duration = (target_dt - start_dt).total_seconds()
            elapsed = (now - start_dt).total_seconds()

            if now > target_dt:
                status = 'ended'
                status_label = 'Ended'
                progress = 100
                progress_text = '100.00%'
            elif now < start_dt:
                status = 'upcoming'
                status_label = 'Upcoming'
                progress = 0
                progress_text = '???.??%'
            else:
                status = 'running'
                status_label = 'Running'
                progress = min(100, max(0, (elapsed / total_duration) * 100)) if total_duration > 0 else 0
                progress_text = f'{progress:06.2f}%'
        except Exception:
            progress = 0
            status = 'running'
            status_label = 'Running'
            progress_text = '???.??%'

        html_file = f'{config_id}.html'
        html_path = OUTPUT_DIR / html_file

        display_on_expire = timer.get('display_on_expire', True)
        if status == 'ended' and not display_on_expire:
            logger.info(f"  Skipping {config_id} (expired, display_on_expire=false)")
            continue

        if html_path.exists():
            timers_data.append({
                'id': config_id,
                'name': display_name,
                'target_time': target_time,
                'start_time': start_time,
                'progress': progress,
                'progress_text': progress_text,
                'status': status,
                'status_label': status_label,
                'html_file': html_file,
                'display_on_expire': display_on_expire
            })

    status_order = {'running': 0, 'upcoming': 1, 'ended': 2}
    timers_data.sort(key=lambda x: (status_order.get(x['status'], 3), -x['progress'], x['name']))

    total_timers = len(timers_data)
    running_count = sum(1 for t in timers_data if t['status'] == 'running')
    upcoming_count = sum(1 for t in timers_data if t['status'] == 'upcoming')
    ended_count = sum(1 for t in timers_data if t['status'] == 'ended')

    timer_cards = ''
    for timer in timers_data:
        timer_cards += f'''
        <div class="timer-card" data-status="{timer['status']}" data-name="{timer['id']}">
            <div class="card-header">
                <h3>{timer['name']}</h3>
                <span class="status-badge status-{timer['status']}">{timer['status_label']}</span>
            </div>
            <div class="timer-preview">
                <iframe src="output/{timer['html_file']}" loading="lazy" sandbox="allow-scripts allow-same-origin"></iframe>
            </div>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {timer['progress']:.1f}%"></div>
                </div>
                <span class="progress-text">{timer['progress_text']}</span>
            </div>
            <p class="time-info">
                <span class="start">📅 Start: {timer['start_time']}</span>
                <span class="target">🎯 Target: {timer['target_time']}</span>
            </p>
            <div class="card-actions">
                <a href="output/{timer['html_file']}" class="timer-link" target="_blank">
                    <span>Open Timer</span>
                    <span>→</span>
                </a>
                <a href="output/{timer['html_file']}" class="download-link" download="{timer['html_file']}" title="Download">⬇️</a>
            </div>
        </div>'''

    html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>7 Segment Display - Timer Selector</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-primary: #0a0a0f;
            --bg-secondary: #12121a;
            --bg-card: rgba(20, 20, 30, 0.6);
            --bg-glass: rgba(255, 255, 255, 0.03);
            --accent-primary: #00ff88;
            --accent-secondary: #00cc6a;
            --accent-glow: rgba(0, 255, 136, 0.3);
            --text-primary: #ffffff;
            --text-secondary: #a0a0b0;
            --text-muted: #606070;
            --border-subtle: rgba(255, 255, 255, 0.08);
            --border-accent: rgba(0, 255, 136, 0.2);
            --gradient-primary: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
            --gradient-glow: linear-gradient(135deg, rgba(0, 255, 136, 0.15) 0%, rgba(0, 204, 106, 0.05) 100%);
        }}

        *, *::before, *::after {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        html {{
            font-size: 16px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }}

        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: var(--bg-primary);
            min-height: 100vh;
            color: var(--text-primary);
            line-height: 1.5;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem 1.5rem 3rem;
        }}

        /* ===== HEADER ===== */
        .header-section {{
            text-align: center;
            margin-bottom: 2.5rem;
            padding-top: 2rem;
        }}

        .header-section h1 {{
            font-size: clamp(2rem, 5vw, 3rem);
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff 0%, var(--accent-primary) 50%, #00cc6a 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.5rem;
            letter-spacing: -0.02em;
        }}

        .header-section .subtitle {{
            font-size: 1rem;
            color: var(--text-secondary);
            font-weight: 400;
        }}

        /* ===== STATS BAR ===== */
        .stats-bar {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-bottom: 2.5rem;
        }}

        .stat-item {{
            background: var(--bg-glass);
            border: 1px solid var(--border-subtle);
            border-radius: 16px;
            padding: 1.25rem 1rem;
            text-align: center;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            transition: transform 0.3s ease, border-color 0.3s ease;
        }}

        .stat-item:hover {{
            transform: translateY(-2px);
            border-color: var(--border-accent);
        }}

        .stat-item .stat-value {{
            font-size: 2rem;
            font-weight: 700;
            color: var(--accent-primary);
            margin-bottom: 0.25rem;
            line-height: 1.2;
        }}

        .stat-item .stat-label {{
            font-size: 0.75rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 600;
        }}

        /* ===== TIMER GRID ===== */
        .timers-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }}

        @media (max-width: 480px) {{
            .timers-grid {{
                grid-template-columns: 1fr;
            }}
        }}

        /* ===== TIMER CARD ===== */
        .timer-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: 16px;
            padding: 1.5rem;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }}

        .timer-card:hover {{
            transform: translateY(-4px);
            border-color: var(--border-accent);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }}

        .timer-card.hidden {{
            display: none;
        }}

        /* Card Header */
        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid var(--border-subtle);
        }}

        .card-header h3 {{
            color: var(--text-primary);
            font-size: 1.25rem;
            font-weight: 700;
            line-height: 1.3;
        }}

        /* Status Badge */
        .status-badge {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 0.35rem 0.75rem;
            border-radius: 999px;
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            white-space: nowrap;
            flex-shrink: 0;
        }}

        .status-running {{
            background: rgba(0, 255, 136, 0.12);
            color: var(--accent-primary);
            border: 1px solid rgba(0, 255, 136, 0.25);
        }}

        .status-running::before {{
            content: '';
            width: 6px;
            height: 6px;
            background: var(--accent-primary);
            border-radius: 50%;
            animation: pulse 2s ease-in-out infinite;
        }}

        @keyframes pulse {{
            0%, 100% {{ opacity: 1; }}
            50% {{ opacity: 0.4; }}
        }}

        .status-upcoming {{
            background: rgba(156, 39, 176, 0.12);
            color: #e040fb;
            border: 1px solid rgba(224, 64, 251, 0.25);
        }}

        .status-ended {{
            background: rgba(244, 67, 54, 0.12);
            color: #f44336;
            border: 1px solid rgba(244, 67, 54, 0.25);
        }}

        /* Timer Preview */
        .timer-preview {{
            background: rgba(0, 0, 0, 0.4);
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 1rem;
            border: 1px solid var(--border-subtle);
        }}

        .timer-preview iframe {{
            width: 100%;
            height: 120px;
            border: none;
            display: block;
            pointer-events: none;
        }}

        @media (max-width: 768px) {{
            .timer-preview iframe {{
                height: 90px;
            }}
        }}

        /* Progress Bar */
        .progress-container {{
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }}

        .progress-bar {{
            flex: 1;
            height: 6px;
            background: rgba(255, 255, 255, 0.06);
            border-radius: 999px;
            overflow: hidden;
        }}

        .progress-fill {{
            height: 100%;
            background: var(--gradient-primary);
            border-radius: 999px;
            transition: width 0.5s ease;
            box-shadow: 0 0 12px rgba(0, 255, 136, 0.3);
        }}

        .progress-text {{
            color: var(--accent-primary);
            font-weight: 600;
            min-width: 60px;
            text-align: right;
            font-size: 0.85rem;
            font-family: 'JetBrains Mono', 'Courier New', monospace;
        }}

        /* Time Info */
        .time-info {{
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 1.25rem;
            font-size: 0.8rem;
            color: var(--text-secondary);
            background: var(--bg-glass);
            padding: 0.75rem 1rem;
            border-radius: 10px;
            border: 1px solid var(--border-subtle);
        }}

        .time-info span {{
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}

        /* Card Actions */
        .card-actions {{
            display: flex;
            gap: 0.75rem;
            align-items: center;
        }}

        .timer-link {{
            flex: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            background: var(--gradient-primary);
            color: var(--bg-primary);
            text-decoration: none;
            padding: 0.75rem 1.25rem;
            border-radius: 10px;
            font-weight: 700;
            font-size: 0.85rem;
            transition: box-shadow 0.3s ease, transform 0.3s ease;
        }}

        .timer-link:hover {{
            box-shadow: 0 8px 24px rgba(0, 255, 136, 0.35);
            transform: translateY(-1px);
        }}

        .download-link {{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 42px;
            height: 42px;
            background: var(--bg-glass);
            border-radius: 10px;
            text-decoration: none;
            font-size: 1.2rem;
            transition: background 0.3s ease, transform 0.3s ease, border-color 0.3s ease;
            border: 1px solid var(--border-subtle);
            flex-shrink: 0;
        }}

        .download-link:hover {{
            background: rgba(0, 255, 136, 0.12);
            border-color: var(--border-accent);
            transform: translateY(-1px);
        }}

        /* ===== FOOTER ===== */
        .footer {{
            text-align: center;
            padding: 1.5rem;
            border-top: 1px solid var(--border-subtle);
            color: var(--text-muted);
            font-size: 0.8rem;
        }}

        /* ===== SCROLLBAR ===== */
        ::-webkit-scrollbar {{
            width: 8px;
            height: 8px;
        }}
        ::-webkit-scrollbar-track {{
            background: var(--bg-secondary);
        }}
        ::-webkit-scrollbar-thumb {{
            background: rgba(0, 255, 136, 0.25);
            border-radius: 999px;
        }}
        ::-webkit-scrollbar-thumb:hover {{
            background: rgba(0, 255, 136, 0.4);
        }}

        /* ===== REDUCED MOTION ===== */
        @media (prefers-reduced-motion: reduce) {{
            *, *::before, *::after {{
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header class="header-section">
            <h1>⏱️ Timer Selector</h1>
            <p class="subtitle">Monitor and manage your countdown timers in real-time</p>
        </header>

        <div class="stats-bar">
            <div class="stat-item">
                <div class="stat-value">{total_timers}</div>
                <div class="stat-label">Total Timers</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: #00ff88;">{running_count}</div>
                <div class="stat-label">Active</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: #ffc107;">{upcoming_count}</div>
                <div class="stat-label">Upcoming</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: #f44336;">{ended_count}</div>
                <div class="stat-label">Ended</div>
            </div>
        </div>

        <div class="timers-grid" id="timersGrid">
            {timer_cards}
        </div>

        <footer class="footer">
            <p>7 Segment Display Timer System &copy; 2026</p>
        </footer>
    </div>

    <div class="version-watermark-selector" data-version="__VERSION_TYPE__" data-build="__BUILD_DATE__">
        <span class="version-label">__VERSION_TYPE__</span>
        <span class="version-date">__BUILD_DATE__</span>
    </div>

    <script src="src/index/script.js"></script>
</body>
</html>'''

    with open(output_path, 'w', encoding='utf-8') as f:
        html_content = html_content.replace('__VERSION_TYPE__', version_type).replace('__BUILD_DATE__', build_date)
        f.write(html_content)

    logger.info(f"Generated selector page: {output_path}")


def main() -> None:
    """Main entry point."""
    parser = ArgumentParser(
        description='7 Segment Display HTML Builder - Generate countdown timers with GitHub-backed config',
        epilog='Examples:\n'
               '  python3 vMain.py 2026-12-31T23:59:59 --config-id newyear\n'
               '  python3 vMain.py --timers-dir --selector\n'
               '  python3 vMain.py --deploy\n'
               '  python3 vMain.py --timers-dir --no-organize  # Don\'t auto-sort timers\n',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        'target_time',
        nargs='?',
        default=None,
        help='Target time in ISO format (e.g., 2026-03-31T05:00:00)'
    )
    parser.add_argument(
        '--config-url',
        default='',
        help='GitHub raw URL for config.json'
    )
    parser.add_argument(
        '--config-id',
        default='default',
        help='Config identifier for output filename (default: default)'
    )
    parser.add_argument(
        '--batch',
        metavar='FILE',
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
    parser.add_argument(
        '--selector',
        action='store_true',
        help='Generate index.html selector page (use with --timers-dir)'
    )
    parser.add_argument(
        '--deploy',
        action='store_true',
        help='Clean output, rebuild all, and push to GitHub'
    )
    parser.add_argument(
        '--no-organize',
        action='store_true',
        help='Don\'t auto-sort timers into status folders'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose output'
    )

    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    if args.deploy:
        deploy(generate_selector_page=True)
    elif args.batch:
        build_batch(args.batch)
    elif args.all:
        build_all_timers()
    elif args.timers_dir:
        build_timers_folder(
            generate_selector_page=args.selector,
            organize=not args.no_organize
        )
    else:
        build_html(
            target_time_str=args.target_time,
            config_url=args.config_url,
            config_id=args.config_id
        )


if __name__ == '__main__':
    main()
