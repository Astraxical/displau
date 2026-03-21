#!/usr/bin/env python3
"""
7 Segment Display HTML Builder

Generates a custom 7-segment countdown display HTML file from modular components.
Configure the parameters below and run this script.
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# ============ CONFIGURATION ============
DEFAULT_TARGET_TIME = '2026-03-31T05:00:00'
OUTPUT_DIR = 'output'
OUTPUT_PATTERN = 'v1_{timestamp}.html'

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


def replace_placeholders(content, target_time, days_at_full_brightness):
    """Replace configuration placeholders in content."""
    return content.replace(
        '{{TARGET_TIME}}', target_time
    ).replace(
        '{{DAYS_AT_FULL_BRIGHTNESS}}', str(days_at_full_brightness)
    )


def build_html():
    """Generate the HTML file from components."""
    # Get target time from command line arg or use default
    target_time_str = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TARGET_TIME
    
    # Calculate milliseconds at full brightness based on time difference
    target_dt = datetime.fromisoformat(target_time_str)
    now = datetime.now()
    time_diff = target_dt - now
    milliseconds_at_full_brightness = max(0, int(time_diff.total_seconds() * 1000))  # Convert to milliseconds

    # Load all components
    html = load_html_components()
    styles = load_style_components()
    scripts = load_script_components()

    # Replace placeholders in scripts
    scripts = replace_placeholders(scripts, target_time_str, milliseconds_at_full_brightness)
    
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
    output_filename = OUTPUT_PATTERN.format(timestamp=timestamp)
    output_path = SCRIPT_DIR / OUTPUT_DIR / output_filename

    # Write the final HTML
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_html)

    print(f"Generated {output_path} with:")
    print(f"  TARGET_TIME = {target_time_str}")
    print(f"  MILLISECONDS_AT_FULL_BRIGHTNESS = {milliseconds_at_full_brightness}")
    print(f"  INCLUDE_UNUSED_SCRIPTS = {INCLUDE_UNUSED_SCRIPTS}")


if __name__ == '__main__':
    build_html()
