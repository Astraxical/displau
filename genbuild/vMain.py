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
import shutil
import subprocess
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
OUTPUT_PATTERN = '{config_id}.html'  # Output filename pattern (no timestamp)

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


def replace_placeholders(content, target_time, days_at_full_brightness, config_url, start_time):
    """Replace configuration placeholders in content."""
    return content.replace(
        '{{TARGET_TIME}}', target_time
    ).replace(
        '{{DAYS_AT_FULL_BRIGHTNESS}}', str(days_at_full_brightness)
    ).replace(
        '{{CONFIG_URL}}', config_url
    ).replace(
        '{{START_TIME}}', start_time
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


def build_html(target_time_str=None, config_url='', config_id='default', auto_config=True, start_time_str=None):
    """Generate the HTML file from components."""
    # Get target time from arg or use default
    if target_time_str is None:
        target_time_str = DEFAULT_TARGET_TIME
    
    # Auto-generate config URL if enabled and not provided
    if auto_config and not config_url:
        config_url = get_config_url(config_id)
        print(f"Auto-generated config URL: {config_url}")

    # If config_url is provided, try to fetch config from it
    if config_url:
        config = fetch_config_from_url(config_url)
        if config:
            if 'target_time' in config:
                target_time_str = config['target_time']
                print(f"Fetched target_time from config: {target_time_str}")
            if 'start_time' in config:
                start_time_str = config['start_time']
                print(f"Fetched start_time from config: {start_time_str}")

    # Calculate milliseconds at full brightness based on time difference
    target_dt = datetime.fromisoformat(target_time_str)
    now = datetime.now()
    time_diff = target_dt - now
    milliseconds_at_full_brightness = max(0, int(time_diff.total_seconds() * 1000))
    
    # Use provided start_time or default to now
    if start_time_str is None:
        start_time_str = now.isoformat(timespec='seconds')

    # Load all components
    html = load_html_components()
    styles = load_style_components()
    scripts = load_script_components()

    # Replace placeholders in scripts
    scripts = replace_placeholders(scripts, target_time_str, milliseconds_at_full_brightness, config_url, start_time_str)

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
    output_filename = OUTPUT_PATTERN.format(config_id=config_id)
    output_path = SCRIPT_DIR / OUTPUT_DIR / output_filename

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write the final HTML
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_html)

    print(f"Generated {output_path} with:")
    print(f"  TARGET_TIME = {target_time_str}")
    print(f"  START_TIME = {start_time_str}")
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


def build_timers_folder(generate_selector_page=False):
    """Build all timers from the timers/ folder."""
    timers_dir = SCRIPT_DIR / 'timers'

    if not timers_dir.exists():
        print(f"Error: timers/ folder not found at {timers_dir}")
        return

    # Exclude TEMPLATE.json and README.md
    timer_files = sorted([f for f in timers_dir.glob('*.json') if not f.name.startswith('TEMPLATE') and f.name != 'README.md'])

    if not timer_files:
        print(f"Error: No .json files found in {timers_dir}")
        return

    print(f"Building {len(timer_files)} timer(s) from timers/ folder...")
    
    timers_list = []
    timer_ids = set()

    for i, timer_file in enumerate(timer_files, 1):
        with open(timer_file, 'r', encoding='utf-8') as f:
            timer = json.load(f)

        config_id = timer.get('id', timer_file.stem)
        target_time = timer.get('target_time', None)
        timer_ids.add(config_id)

        print(f"\n[{i}/{len(timer_files)}] Building {config_id}...")
        build_html(
            target_time_str=target_time,
            config_id=config_id,
            auto_config=True  # Auto-generate config URL
        )
        
        timers_list.append(timer)
    
    # Clean up orphaned HTML files
    clean_orphaned_outputs(timer_ids)
    
    if generate_selector_page:
        generate_selector(timers_list)


def deploy(generate_selector_page=True):
    """Clean output folder, rebuild all timers, and push to GitHub."""
    output_dir = SCRIPT_DIR / OUTPUT_DIR
    
    # Step 1: Delete output folder
    if output_dir.exists():
        print(f"Deleting {output_dir}...")
        shutil.rmtree(output_dir)
    
    # Step 2: Rebuild all timers
    print("\nRebuilding all timers...\n")
    build_timers_folder(generate_selector_page=generate_selector_page)
    
    # Step 3: Git add, commit, and push
    print("\n--- Pushing to GitHub ---")
    
    # Check if there are changes to commit
    result = subprocess.run(
        ['git', '-C', str(SCRIPT_DIR), 'status', '--porcelain'],
        capture_output=True, text=True
    )
    
    if result.stdout.strip():
        # Add all changes
        subprocess.run(['git', '-C', str(SCRIPT_DIR), 'add', '.'], check=True)
        
        # Commit
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        subprocess.run(
            ['git', '-C', str(SCRIPT_DIR), 'commit', '-m', f'Auto-deploy: {timestamp}'],
            check=True
        )
        
        # Push
        subprocess.run(['git', '-C', str(SCRIPT_DIR), 'push'], check=True)
        
        print("\n✅ Deployed successfully!")
    else:
        print("\nNo changes to commit.")


def clean_orphaned_outputs(timer_ids):
    """Delete HTML files that don't have corresponding timer JSON configs."""
    output_dir = SCRIPT_DIR / OUTPUT_DIR
    if not output_dir.exists():
        return
    
    # Get all timer HTML files
    html_files = list(output_dir.glob('*.html'))
    
    deleted_count = 0
    for html_file in html_files:
        # Extract config_id from filename (e.g., "assembly.html" -> "assembly")
        config_id = html_file.stem
        
        # Skip index.html (selector page)
        if config_id == 'index':
            continue
        
        # If this config_id is not in the current timers list, delete the HTML
        if config_id not in timer_ids:
            html_file.unlink()
            print(f"Deleted orphaned HTML: {html_file.name}")
            deleted_count += 1
    
    if deleted_count > 0:
        print(f"Cleaned {deleted_count} orphaned HTML file(s)")


def generate_selector(timers_list):
    """Generate an index.html selector page with links to all timers."""
    # Place index.html in the parent directory (genbuild/) for cleaner URL
    output_path = SCRIPT_DIR / 'index.html'

    # Process timers with status and progress
    timers_data = []
    now = datetime.now()
    
    for timer in timers_list:
        config_id = timer.get('id', 'unknown')
        target_time = timer.get('target_time', 'Unknown')
        start_time = timer.get('start_time', 'Unknown')
        
        # Calculate status and progress
        try:
            start_dt = datetime.fromisoformat(start_time)
            target_dt = datetime.fromisoformat(target_time)
            total_duration = (target_dt - start_dt).total_seconds()
            elapsed = (now - start_dt).total_seconds()
            progress = min(100, max(0, (elapsed / total_duration) * 100)) if total_duration > 0 else 0
            
            if now > target_dt:
                status = 'ended'
                status_label = 'Ended'
            elif now < start_dt:
                status = 'upcoming'
                status_label = 'Upcoming'
            else:
                status = 'running'
                status_label = 'Running'
        except:
            progress = 0
            status = 'running'
            status_label = 'Running'
        
        html_file = f'{config_id}.html'
        html_path = SCRIPT_DIR / OUTPUT_DIR / html_file
        
        if html_path.exists():
            timers_data.append({
                'id': config_id,
                'name': config_id.replace('-', ' ').title(),
                'target_time': target_time,
                'start_time': start_time,
                'progress': progress,
                'status': status,
                'status_label': status_label,
                'html_file': html_file
            })
    
    # Sort timers: running first, then upcoming, then ended
    status_order = {'running': 0, 'upcoming': 1, 'ended': 2}
    timers_data.sort(key=lambda x: (status_order.get(x['status'], 3), -x['progress'], x['name']))
    
    # Calculate stats
    total_timers = len(timers_data)
    running_count = sum(1 for t in timers_data if t['status'] == 'running')
    upcoming_count = sum(1 for t in timers_data if t['status'] == 'upcoming')
    ended_count = sum(1 for t in timers_data if t['status'] == 'ended')
    
    # Generate timer cards
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
                <span class="progress-text">{timer['progress']:.1f}%</span>
            </div>
            <p class="time-info">
                <span class="start">📅 Start: {timer['start_time']}</span>
                <span class="target">🎯 Target: {timer['target_time']}</span>
            </p>
            <div class="card-actions">
                <a href="output/{timer['html_file']}" class="timer-link" target="_blank">Open Full Timer →</a>
                <a href="output/{timer['html_file']}" class="download-link" download="{timer['html_file']}" title="Download">⬇️</a>
            </div>
        </div>'''

    html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>7 Segment Display - Timer Selector</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            padding: 2rem;
            color: #fff;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}

        h1 {{
            text-align: center;
            margin-bottom: 0.5rem;
            font-size: 2.5rem;
            color: #00ff88;
            text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
        }}

        .subtitle {{
            text-align: center;
            color: #888;
            margin-bottom: 2rem;
        }}

        /* Stats Bar */
        .stats-bar {{
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }}

        .stat-item {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 1rem 2rem;
            text-align: center;
            min-width: 120px;
        }}

        .stat-value {{
            font-size: 2rem;
            font-weight: bold;
            color: #00ff88;
        }}

        .stat-label {{
            color: #888;
            font-size: 0.9rem;
            margin-top: 0.25rem;
        }}

        /* Controls */
        .controls {{
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }}

        .search-box {{
            padding: 0.75rem 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            font-size: 1rem;
            min-width: 250px;
        }}

        .search-box:focus {{
            outline: none;
            border-color: #00ff88;
        }}

        .control-btn {{
            padding: 0.75rem 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s;
        }}

        .control-btn:hover {{
            background: rgba(0, 255, 136, 0.2);
            border-color: #00ff88;
        }}

        .control-btn.active {{
            background: rgba(0, 255, 136, 0.3);
            border-color: #00ff88;
        }}

        select.control-btn {{
            cursor: pointer;
        }}

        /* Timers Grid */
        .timers-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 1.5rem;
        }}

        .timers-grid.list-view {{
            grid-template-columns: 1fr;
        }}

        .timer-card {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 1.5rem;
            transition: transform 0.3s, box-shadow 0.3s;
        }}

        .timer-card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 255, 136, 0.2);
            border-color: #00ff88;
        }}

        .timer-card.hidden {{
            display: none;
        }}

        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }}

        .card-header h3 {{
            color: #00ff88;
            font-size: 1.5rem;
        }}

        /* Status Badges */
        .status-badge {{
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
            text-transform: uppercase;
        }}

        .status-running {{
            background: rgba(0, 255, 136, 0.2);
            color: #00ff88;
            border: 1px solid #00ff88;
        }}

        .status-upcoming {{
            background: rgba(255, 193, 7, 0.2);
            color: #ffc107;
            border: 1px solid #ffc107;
        }}

        .status-ended {{
            background: rgba(244, 67, 54, 0.2);
            color: #f44336;
            border: 1px solid #f44336;
        }}

        /* Timer Preview */
        .timer-preview {{
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 1rem;
            border: 1px solid rgba(0, 255, 136, 0.2);
        }}

        .timer-preview iframe {{
            width: 100%;
            height: 120px;
            border: none;
            display: block;
        }}

        /* Progress Bar */
        .progress-container {{
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1rem;
        }}

        .progress-bar {{
            flex: 1;
            height: 8px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            overflow: hidden;
        }}

        .progress-fill {{
            height: 100%;
            background: linear-gradient(90deg, #00ff88 0%, #00cc6a 100%);
            border-radius: 4px;
            transition: width 0.5s ease;
        }}

        .progress-text {{
            color: #00ff88;
            font-weight: bold;
            min-width: 50px;
            text-align: right;
        }}

        /* Time Info */
        .time-info {{
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
            font-size: 0.9rem;
            color: #aaa;
        }}

        .time-info span {{
            display: flex;
            justify-content: space-between;
        }}

        /* Card Actions */
        .card-actions {{
            display: flex;
            gap: 1rem;
            align-items: center;
        }}

        .timer-link {{
            flex: 1;
            display: inline-block;
            background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
            color: #1a1a2e;
            text-decoration: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: bold;
            text-align: center;
            transition: box-shadow 0.3s;
        }}

        .timer-link:hover {{
            box-shadow: 0 5px 20px rgba(0, 255, 136, 0.4);
        }}

        .download-link {{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            text-decoration: none;
            font-size: 1.2rem;
            transition: all 0.3s;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }}

        .download-link:hover {{
            background: rgba(0, 255, 136, 0.2);
            border-color: #00ff88;
        }}

        /* Footer */
        .footer {{
            text-align: center;
            margin-top: 3rem;
            color: #666;
            font-size: 0.9rem;
        }}

        /* Responsive */
        @media (max-width: 768px) {{
            body {{
                padding: 1rem;
            }}

            .stats-bar {{
                gap: 1rem;
            }}

            .stat-item {{
                min-width: 80px;
                padding: 0.75rem 1rem;
            }}

            .controls {{
                flex-direction: column;
                align-items: stretch;
            }}

            .search-box {{
                min-width: 100%;
            }}

            .timers-grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>⏱️ Timer Selector</h1>
        <p class="subtitle">Select a countdown timer to view</p>

        <!-- Stats Bar -->
        <div class="stats-bar">
            <div class="stat-item">
                <div class="stat-value">{total_timers}</div>
                <div class="stat-label">Total</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" style="color: #00ff88;">{running_count}</div>
                <div class="stat-label">Running</div>
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

        <!-- Controls -->
        <div class="controls">
            <input type="text" class="search-box" id="searchBox" placeholder="🔍 Search timers...">
            <select class="control-btn" id="sortSelect">
                <option value="status">Sort: Status</option>
                <option value="name">Sort: Name</option>
                <option value="progress">Sort: Progress</option>
                <option value="target">Sort: Target Date</option>
            </select>
            <button class="control-btn active" id="gridBtn" title="Grid View">▦</button>
            <button class="control-btn" id="listBtn" title="List View">☰</button>
        </div>

        <!-- Timers Grid -->
        <div class="timers-grid" id="timersGrid">
            {timer_cards}
        </div>

        <div class="footer">
            <p>7 Segment Display Timer System</p>
        </div>
    </div>

    <script>
        // Search functionality
        const searchBox = document.getElementById('searchBox');
        const timersGrid = document.getElementById('timersGrid');
        const sortSelect = document.getElementById('sortSelect');
        const gridBtn = document.getElementById('gridBtn');
        const listBtn = document.getElementById('listBtn');

        searchBox.addEventListener('input', (e) => {{
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.timer-card').forEach(card => {{
                const name = card.dataset.name;
                if (name.includes(query)) {{
                    card.classList.remove('hidden');
                }} else {{
                    card.classList.add('hidden');
                }}
            }});
        }});

        // Sort functionality
        sortSelect.addEventListener('change', (e) => {{
            const cards = Array.from(timersGrid.querySelectorAll('.timer-card'));
            const sortType = e.target.value;

            cards.sort((a, b) => {{
                if (sortType === 'name') {{
                    return a.dataset.name.localeCompare(b.dataset.name);
                }} else if (sortType === 'progress') {{
                    const aProgress = parseFloat(a.querySelector('.progress-text').textContent);
                    const bProgress = parseFloat(b.querySelector('.progress-text').textContent);
                    return bProgress - aProgress;
                }} else if (sortType === 'target') {{
                    const aTarget = a.querySelector('.target').textContent;
                    const bTarget = b.querySelector('.target').textContent;
                    return aTarget.localeCompare(bTarget);
                }}
                // Default: status order
                const statusOrder = {{'running': 0, 'upcoming': 1, 'ended': 2}};
                return (statusOrder[a.dataset.status] || 3) - (statusOrder[b.dataset.status] || 3);
            }});

            cards.forEach(card => timersGrid.appendChild(card));
        }});

        // Grid/List toggle
        gridBtn.addEventListener('click', () => {{
            timersGrid.classList.remove('list-view');
            gridBtn.classList.add('active');
            listBtn.classList.remove('active');
        }});

        listBtn.addEventListener('click', () => {{
            timersGrid.classList.add('list-view');
            listBtn.classList.add('active');
            gridBtn.classList.remove('active');
        }});
    </script>
</body>
</html>'''
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"Generated selector page: {output_path}")


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
    parser.add_argument(
        '--selector',
        action='store_true',
        help='Generate index.html selector page (use with --timers-dir)'
    )
    parser.add_argument(
        '--deploy',
        action='store_true',
        help='Clean output, rebuild all timers, and push to GitHub automatically'
    )

    args = parser.parse_args()

    if args.deploy:
        deploy(generate_selector_page=True)
    elif args.batch:
        build_batch(args.batch)
    elif args.all:
        build_all_timers()
    elif args.timers_dir:
        build_timers_folder(generate_selector_page=args.selector)
    else:
        build_html(
            target_time_str=args.target_time,
            config_url=args.config_url,
            config_id=args.config_id
        )
