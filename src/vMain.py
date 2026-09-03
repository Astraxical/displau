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
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# Script directory
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent

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


WEEKDAYS = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
}


def weekday_to_number(weekday: Any, default: Optional[int] = None) -> Optional[int]:
    """Convert a weekday name (or 0-6 number) to JS Date.getDay() convention (0=Sunday)."""
    if weekday is None:
        return default
    if isinstance(weekday, bool):
        return default
    if isinstance(weekday, int):
        return weekday if 0 <= weekday <= 6 else default
    name = str(weekday).strip().lower()
    if name in WEEKDAYS:
        return WEEKDAYS[name]
    try:
        n = int(name)
        if 0 <= n <= 6:
            return n
    except (ValueError, TypeError):
        pass
    return default


def normalize_hms(value: Any, fallback: str = '00:00:00') -> str:
    """Normalize an HH:MM(:SS) string to canonical HH:MM:SS."""
    raw = value if value not in (None, '') else fallback
    try:
        parts = [int(p) for p in str(raw).split(':')]
    except (ValueError, TypeError):
        parts = [0, 0, 0]
    while len(parts) < 3:
        parts.append(0)
    h, m, s = parts[0], parts[1], parts[2]
    return f"{h:02d}:{m:02d}:{s:02d}"


def normalize_recur_schedule(timer: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the canonical multi-slot schedule for a timer.

    Prefers ``recur_schedule``; falls back to legacy
    ``recur_weekday``/``recur_time``/``recur_end`` as a single slot.
    """
    sched = timer.get('recur_schedule')
    if isinstance(sched, list) and sched:
        out: list[dict[str, Any]] = []
        for slot in sched:
            if not isinstance(slot, dict):
                continue
            start = slot.get('start', slot.get('time', '00:00:00'))
            end = slot.get('end')
            if end in ('', 'null'):
                end = None
            out.append({
                'weekday': weekday_to_number(slot.get('weekday')),
                'start': normalize_hms(start),
                'end': normalize_hms(end) if end else None,
                'label': str(slot.get('label', '') or ''),
            })
        return out
    wd = weekday_to_number(timer.get('recur_weekday'))
    rt = timer.get('recur_time', '00:00:00')
    re_ = timer.get('recur_end')
    if re_ in ('', 'null'):
        re_ = None
    if wd is None and not rt and not re_:
        return []
    if wd is None and rt is None:
        return []
    return [{
        'weekday': wd,
        'start': normalize_hms(rt or '00:00:00'),
        'end': normalize_hms(re_) if re_ else None,
        'label': '',
    }]


def _parse_hms_to_time(value: str) -> tuple[int, int, int]:
    parts = normalize_hms(value).split(':')
    return int(parts[0]), int(parts[1]), int(parts[2])


def compute_recur_state(timer: dict[str, Any], now: datetime) -> Optional[dict[str, Any]]:
    """Compute the next boundary for a recurring timer (mirrors time_utils.js).

    Returns dict with keys: target, prev_boundary, slot, phase, in_class.
    """
    rule = str(timer.get('recur_rule', 'weekly') or 'weekly').lower()
    if rule not in ('weekly', 'daily', 'interval'):
        rule = 'weekly'

    if rule == 'interval':
        try:
            mins = float(timer.get('recur_interval_minutes') or 0)
        except (TypeError, ValueError):
            return None
        if not mins or mins <= 0:
            return None
        interval = timedelta(minutes=mins)
        anchor_raw = timer.get('recur_anchor') or timer.get('start_time')
        try:
            anchor = datetime.fromisoformat(str(anchor_raw)) if anchor_raw else now
        except (ValueError, TypeError):
            anchor = now
        if now < anchor:
            target = anchor
        else:
            elapsed = (now - anchor).total_seconds()
            step = interval.total_seconds()
            import math
            k = math.ceil(elapsed / step)
            target = anchor + timedelta(seconds=k * step)
            if target <= now:
                target += interval
        return {
            'target': target,
            'prev_boundary': target - interval,
            'slot': {'weekday': None, 'start': '', 'end': None, 'label': 'interval'},
            'phase': 'waiting',
            'in_class': False,
        }

    slots = [s for s in normalize_recur_schedule(timer)
             if (s['weekday'] is not None if rule == 'weekly' else s['start'])]
    if not slots:
        return None

    best: Optional[dict[str, Any]] = None
    prev_boundary: Optional[datetime] = None

    if rule == 'daily':
        for slot in slots:
            h, m, s = _parse_hms_to_time(slot['start'])
            start_today = now.replace(hour=h, minute=m, second=s, microsecond=0)
            end_today = None
            if slot['end']:
                eh, em, es = _parse_hms_to_time(slot['end'])
                end_today = now.replace(hour=eh, minute=em, second=es, microsecond=0)
                if end_today <= start_today:
                    end_today += timedelta(days=1)
            if end_today and start_today <= now < end_today:
                cand = {'target': end_today, 'slot': slot, 'phase': 'in-class', 'in_class': True}
            elif now < start_today:
                cand = {'target': start_today, 'slot': slot, 'phase': 'waiting', 'in_class': False}
            else:
                cand = {'target': start_today + timedelta(days=1), 'slot': slot,
                        'phase': 'waiting', 'in_class': False}
            if best is None or cand['target'] < best['target']:
                best = cand
            bounds = [start_today]
            if end_today and end_today <= now:
                bounds.append(end_today)
            bounds.append(start_today - timedelta(days=1))
            for b in bounds:
                if b <= now and (prev_boundary is None or b > prev_boundary):
                    prev_boundary = b
        if best is None:
            return None
        if prev_boundary is None:
            prev_boundary = best['target'] - timedelta(days=1)
        best['prev_boundary'] = prev_boundary
        return best

    # Weekly (default): multi-slot aware.
    for slot in slots:
        assert slot['weekday'] is not None
        py_weekday = (slot['weekday'] + 6) % 7  # datetime.weekday(): Monday=0..Sunday=6
        h, m, s = _parse_hms_to_time(slot['start'])
        days_ahead = (py_weekday - now.weekday()) % 7
        nxt = (now + timedelta(days=days_ahead)).replace(hour=h, minute=m, second=0, microsecond=0)
        if nxt <= now:
            nxt += timedelta(days=7)
        prev = nxt - timedelta(days=7)
        end_dt = None
        if slot['end']:
            eh, em, es = _parse_hms_to_time(slot['end'])
            end_dt = prev.replace(hour=eh, minute=em, second=es, microsecond=0)
            if end_dt <= prev:
                end_dt += timedelta(days=1)
        if end_dt and prev <= now < end_dt:
            cand = {'target': end_dt, 'slot': slot, 'phase': 'in-class', 'in_class': True}
        else:
            cand = {'target': nxt, 'slot': slot, 'phase': 'waiting', 'in_class': False}
        if best is None or cand['target'] < best['target']:
            best = cand
        for b in ([prev] + ([end_dt] if end_dt and end_dt <= now else [])):
            if b <= now and (prev_boundary is None or b > prev_boundary):
                prev_boundary = b
    if best is None:
        return None
    if prev_boundary is None:
        prev_boundary = best['target'] - timedelta(days=7)
    best['prev_boundary'] = prev_boundary
    return best


def next_event_for_timer(timer: dict[str, Any], now: datetime) -> Optional[dict[str, Any]]:
    """Next upcoming event for any timer (recurring slot/end or one-shot target).

    Returns dict with keys: target, phase ('in-class'|'waiting'|'one-shot'|'expired'),
    slot (or None), time_until_s.
    """
    if timer.get('recur', False):
        st = compute_recur_state(timer, now)
        if not st:
            return None
        return {
            'target': st['target'],
            'phase': st['phase'],
            'slot': st['slot'],
            'time_until_s': (st['target'] - now).total_seconds(),
        }
    try:
        target = datetime.fromisoformat(str(timer.get('target_time', '')))
    except (ValueError, TypeError):
        return None
    delta = (target - now).total_seconds()
    return {
        'target': target,
        'phase': 'one-shot' if delta > 0 else 'expired',
        'slot': None,
        'time_until_s': delta,
    }


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
    display_name: str = '',
    display_mode: str = 'countdown',
    static_time_ms: int = 0,
    recur: bool = False,
    recur_weekday: Optional[int] = None,
    recur_time: str = '00:00:00',
    recur_end: Optional[str] = None,
    recur_rule: str = 'weekly',
    recur_schedule_json: str = '[]',
    recur_interval: Optional[Any] = None,
    recur_anchor: str = ''
) -> str:
    """Replace configuration placeholders in content."""
    if build_date is None:
        now = datetime.now()
        timestamp = now.strftime('%Y%m%d%H%M%S')
        build_date = f"{VERSION}.{timestamp}.{version_type.lower()}"

    if recur_end is None:
        recur_end_js = 'null'
    else:
        recur_end_js = f"'{recur_end}'"

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
        '{{DISPLAY_MODE}}': display_mode,
        '{{STATIC_TIME_MS}}': str(static_time_ms),
        '{{RECUR}}': 'true' if recur else 'false',
        '{{RECUR_RULE}}': recur_rule or 'weekly',
        '{{RECUR_WEEKDAY}}': str(recur_weekday if recur_weekday is not None else 0),
        '{{RECUR_TIME}}': recur_time,
        '{{RECUR_END}}': recur_end_js,
        '{{RECUR_SCHEDULE_JSON}}': recur_schedule_json or '[]',
        '{{RECUR_INTERVAL}}': 'null' if recur_interval is None else str(recur_interval),
        '{{RECUR_ANCHOR}}': recur_anchor or '',
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
    config_relative_path: str = None,
    local_config: Optional[dict] = None
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
    display_mode = 'countdown'
    static_time_ms = 0
    recur = False
    recur_weekday = None
    recur_time = '00:00:00'
    recur_end = None
    recur_rule = 'weekly'
    recur_schedule: list[dict[str, Any]] = []
    recur_interval = None
    recur_anchor = ''

    def apply_timer_config(config: dict[str, Any]) -> None:
        """Extract runtime settings from a timer config."""
        nonlocal direction, min_value, max_value, display_name, display_mode, static_time_ms
        nonlocal recur, recur_weekday, recur_time, recur_end
        nonlocal recur_rule, recur_schedule, recur_interval, recur_anchor
        direction = config.get('direction', direction)
        min_value = config.get('min_value', min_value)
        max_val = config.get('max_value', None)
        max_value = 'null' if max_val is None else str(max_val)
        display_name = config.get('display_name', display_name)
        display_mode = config.get('display_mode', display_mode)
        static_time_ms = config.get('static_time_ms', static_time_ms)
        recur = config.get('recur', recur)
        recur_weekday = weekday_to_number(config.get('recur_weekday'), recur_weekday)
        recur_time = normalize_hms(config.get('recur_time', recur_time))
        recur_end_raw = config.get('recur_end', recur_end)
        if recur_end_raw in (None, '', 'null'):
            recur_end = None
        else:
            recur_end = normalize_hms(recur_end_raw)
        recur_rule = str(config.get('recur_rule', recur_rule) or 'weekly').lower()
        if recur_rule not in ('weekly', 'daily', 'interval'):
            recur_rule = 'weekly'
        if isinstance(config.get('recur_schedule'), list):
            recur_schedule = normalize_recur_schedule(config)
        elif recur:
            # Materialize the canonical schedule from legacy fields so the
            # built page embeds the same slots the builder computed with.
            recur_schedule = normalize_recur_schedule({
                'recur_weekday': recur_weekday,
                'recur_time': recur_time,
                'recur_end': recur_end,
            })
        recur_interval = config.get('recur_interval_minutes', recur_interval)
        recur_anchor = config.get('recur_anchor', recur_anchor) or ''

    # Try fetching from URL first
    if config_url and not use_local_config:
        config = fetch_config_from_url(config_url)
        if config:
            apply_timer_config(config)

    # Fall back to local config if provided (e.g., when building from timers folder)
    if local_config:
        apply_timer_config(local_config)

    scripts = replace_placeholders(
        scripts, target_time_str, milliseconds_at_full_brightness,
        config_url, start_time_str, direction, min_value, max_value, version_type,
        display_name=display_name, display_mode=display_mode, static_time_ms=static_time_ms,
        recur=recur, recur_weekday=recur_weekday, recur_time=recur_time, recur_end=recur_end,
        recur_rule=recur_rule, recur_schedule_json=json.dumps(recur_schedule),
        recur_interval=recur_interval, recur_anchor=recur_anchor
    )
    html['body'] = replace_placeholders(
        html['body'], target_time_str, milliseconds_at_full_brightness,
        config_url, start_time_str, direction, min_value, max_value, version_type,
        display_name=display_name, display_mode=display_mode, static_time_ms=static_time_ms,
        recur=recur, recur_weekday=recur_weekday, recur_time=recur_time, recur_end=recur_end,
        recur_rule=recur_rule, recur_schedule_json=json.dumps(recur_schedule),
        recur_interval=recur_interval, recur_anchor=recur_anchor
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

    # Recurring weekly timers are always active (they roll over each week)
    if timer.get('recur', False):
        return 'active'

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

        # Skip expired timers with display_on_expire=false (recurring timers never expire)
        display_on_expire = timer.get('display_on_expire', True)
        is_recurring = timer.get('recur', False)
        if target_time and not is_recurring:
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
            config_relative_path=config_relative_path,
            local_config=timer
        )

        timers_list.append(timer)

    clean_orphaned_outputs(timer_ids)

    # Manifest powers the standalone auto-switching clock + JSON API.
    manifest_now = datetime.now()
    manifest = build_timer_manifest(timers_list, manifest_now)
    write_json_api(manifest, manifest_now)
    build_up_next_page(manifest, manifest_now)

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
        ['git', '-C', str(REPO_ROOT), 'status', '--porcelain'],
        capture_output=True, text=True
    )

    if result.stdout.strip():
        # Use git add -A to stage all changes including deletions
        subprocess.run(['git', '-C', str(REPO_ROOT), 'add', '-A', '.'], check=True)

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        subprocess.run(
            ['git', '-C', str(REPO_ROOT), 'commit', '-m', f'Auto-deploy: {timestamp}'],
            check=True
        )

        subprocess.run(['git', '-C', str(REPO_ROOT), 'push'], check=True)

        logger.info("✅ Deployed successfully!")
    else:
        logger.info("No changes to commit.")


def clean_orphaned_outputs(timer_ids: set[str]) -> None:
    """Delete HTML files that don't have corresponding timer JSON configs."""
    if not OUTPUT_DIR.exists():
        return

    # Generated pages that have no timer JSON but must be kept.
    keep = {'index', 'up-next'}

    html_files = list(OUTPUT_DIR.glob('*.html'))

    deleted_count = 0
    for html_file in html_files:
        config_id = html_file.stem

        if config_id in keep:
            continue

        if config_id not in timer_ids:
            html_file.unlink()
            logger.info(f"Deleted orphaned HTML: {html_file.name}")
            deleted_count += 1

    if deleted_count > 0:
        logger.info(f"Cleaned {deleted_count} orphaned HTML file(s)")


def recurring_timer_stats(timer: dict[str, Any], now: datetime) -> dict[str, Any]:
    """Compute selector stats for a recurring timer (weekly/daily/interval).

    Returns progress (0-100), status, and display strings for the card.
    """
    rule = str(timer.get('recur_rule', 'weekly') or 'weekly').lower()
    if rule not in ('weekly', 'daily', 'interval'):
        rule = 'weekly'
    slots = normalize_recur_schedule(timer)

    status = 'running'
    status_label = 'Running'
    progress = 0.0
    state = compute_recur_state(timer, now)

    if state is None:
        return {
            'status': status,
            'status_label': status_label,
            'progress': 0.0,
            'progress_text': '000.00%',
            'start_display': f"Recurring · {rule.title()}",
            'target_display': 'Next occurrence unknown',
        }

    target = state['target']
    prev = state['prev_boundary']
    total = (target - prev).total_seconds()
    elapsed = (now - prev).total_seconds()
    if total > 0:
        progress = min(100, max(0, (elapsed / total) * 100))
    progress_text = f'{progress:06.2f}%'

    day_name = ''
    slot = state.get('slot') or {}
    if slot.get('weekday') is not None:
        day_name = next((name for name, num in WEEKDAYS.items() if num == slot['weekday']), '')

    if rule == 'interval':
        mins = timer.get('recur_interval_minutes')
        try:
            mins_f = float(mins)
            start_display = f"Every {mins_f:g} min"
        except (TypeError, ValueError):
            start_display = 'Recurring · Interval'
    elif rule == 'daily':
        if len(slots) > 1:
            start_display = f"Daily · {slot.get('start', '')} +{len(slots) - 1} more"
        else:
            start_display = f"Daily · {slot.get('start', '')}"
    else:
        label = slot.get('label') or ''
        base = f"{day_name.title() + ' ' if day_name else ''}{slot.get('start', '')}"
        if len(slots) > 1:
            base += f" +{len(slots) - 1} more"
        if label:
            base += f" · {label}"
        start_display = f"Recurring · {base}"

    verb = 'Ends' if state.get('in_class') else 'Next'
    target_display = f"{verb} · {target.isoformat(timespec='minutes')}"

    return {
        'status': status,
        'status_label': status_label,
        'progress': progress,
        'progress_text': progress_text,
        'start_display': start_display,
        'target_display': target_display,
    }


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

        is_recurring = timer.get('recur', False)

        if is_recurring:
            recur_stats = recurring_timer_stats(timer, now)
            status = recur_stats['status']
            status_label = recur_stats['status_label']
            progress = recur_stats['progress']
            progress_text = recur_stats['progress_text']
            start_time = recur_stats['start_display']
            target_time = recur_stats['target_display']
        else:
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
            timer_entry = {
                'id': config_id,
                'name': display_name,
                'target_time': target_time,
                'start_time': start_time,
                'progress': progress,
                'progress_text': progress_text,
                'status': status,
                'status_label': status_label,
                'html_file': html_file,
                'display_on_expire': display_on_expire,
                'recur': is_recurring,
            }
            if is_recurring:
                timer_entry['recur_weekday'] = weekday_to_number(timer.get('recur_weekday'))
                timer_entry['recur_time'] = timer.get('recur_time', '00:00')
                timer_entry['recur_end'] = timer.get('recur_end')
            timers_data.append(timer_entry)

    status_order = {'running': 0, 'upcoming': 1, 'ended': 2}
    timers_data.sort(key=lambda x: (status_order.get(x['status'], 3), -x['progress'], x['name']))

    total_timers = len(timers_data)
    running_count = sum(1 for t in timers_data if t['status'] == 'running')
    upcoming_count = sum(1 for t in timers_data if t['status'] == 'upcoming')
    ended_count = sum(1 for t in timers_data if t['status'] == 'ended')

    timer_cards = ''
    for timer in timers_data:
        recur_attrs = ''
        if timer.get('recur'):
            recur_attrs = (
                f' data-recur="1"'
                f' data-recur-weekday="{timer.get("recur_weekday", 0)}"'
                f' data-recur-time="{timer.get("recur_time", "00:00")}"'
                f' data-recur-end="{timer.get("recur_end") or ""}"'
            )
        timer_cards += f'''
        <div class="timer-card" data-status="{timer['status']}" data-name="{timer['id']}"{recur_attrs}>
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


def build_timer_manifest(timers_list: list[dict[str, Any]], now: datetime) -> list[dict[str, Any]]:
    """Build a sorted manifest of all timers with their next event precomputed.

    Sorted closest-first (expired one-shot timers sink to the bottom).
    This manifest powers the standalone up-next clock and the JSON API.
    """
    entries: list[dict[str, Any]] = []
    for timer in timers_list:
        config_id = timer.get('id', 'unknown')
        is_recur = bool(timer.get('recur', False))
        rule = str(timer.get('recur_rule', 'weekly') or 'weekly').lower()
        if rule not in ('weekly', 'daily', 'interval'):
            rule = 'weekly'
        entry: dict[str, Any] = {
            'id': config_id,
            'name': timer.get('display_name', config_id.replace('-', ' ').title()),
            'description': timer.get('description', ''),
            'html_file': f'{config_id}.html',
            'target_time': timer.get('target_time'),
            'start_time': timer.get('start_time'),
            'timezone': timer.get('timezone', 'UTC'),
            'recur': is_recur,
            'recur_rule': rule if is_recur else None,
            'recur_schedule': normalize_recur_schedule(timer) if is_recur else [],
            'recur_interval_minutes': timer.get('recur_interval_minutes') if is_recur else None,
            'recur_anchor': timer.get('recur_anchor') if is_recur else None,
            'tags': timer.get('tags', []),
            'category': timer.get('category'),
        }
        ev = next_event_for_timer(timer, now)
        if ev and ev['target'] is not None:
            entry['next_target'] = ev['target'].isoformat(timespec='seconds')
            entry['next_in_s'] = ev['time_until_s']
            entry['next_phase'] = ev['phase']
            if ev.get('slot'):
                entry['next_slot'] = ev['slot']
        entries.append(entry)

    def _sort_key(e: dict[str, Any]) -> tuple[int, float]:
        s = e.get('next_in_s')
        if s is None:
            return (2, 0.0)
        if s < 0:
            return (1, abs(float(s)))
        return (0, float(s))

    entries.sort(key=_sort_key)
    return entries


def write_json_api(manifest: list[dict[str, Any]], now: datetime) -> None:
    """Write the static JSON API under output/api/.

    - api/timers.json  — full manifest, closest-first
    - api/up-next.json — current pick + next 10 upcoming
    - api/status.json  — counts + build info
    """
    api_dir = OUTPUT_DIR / 'api'
    api_dir.mkdir(parents=True, exist_ok=True)
    generated_at = now.isoformat(timespec='seconds')

    upcoming = [e for e in manifest if e.get('next_in_s') is not None and e['next_in_s'] >= 0]
    expired = [e for e in manifest if e.get('next_in_s') is not None and e['next_in_s'] < 0]
    recurring = [e for e in manifest if e.get('recur')]

    with open(api_dir / 'timers.json', 'w', encoding='utf-8') as f:
        json.dump({'generated_at': generated_at, 'count': len(manifest), 'timers': manifest}, f, indent=2)

    with open(api_dir / 'up-next.json', 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': generated_at,
            'current': upcoming[0] if upcoming else None,
            'upcoming': upcoming[:10],
        }, f, indent=2)

    with open(api_dir / 'status.json', 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': generated_at,
            'version': VERSION,
            'total': len(manifest),
            'recurring': len(recurring),
            'one_shot': len(manifest) - len(recurring),
            'upcoming': len(upcoming),
            'expired': len(expired),
        }, f, indent=2)

    logger.info(f"Generated JSON API: {api_dir}/timers.json, up-next.json, status.json")


def build_up_next_page(manifest: list[dict[str, Any]], now: datetime) -> None:
    """Generate output/up-next.html — the standalone auto-switching clock.

    Picks the closest upcoming countdown across all timers (recurring slots,
    session ends, and one-shot targets) and auto-switches when the lead
    changes. Exposes a runtime JS API as ``window.DisplauAPI`` and supports
    ``?timer=<id>`` (lock), ``?embed=1`` (minimal chrome), ``?json=1`` (raw).
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / 'up-next.html'

    version_type = 'STABLE'
    timestamp = now.strftime('%Y%m%d%H%M%S')
    build_date = f"{VERSION}.{timestamp}.{version_type.lower()}"

    styles = load_style_components()
    scripts_dir = COMPONENTS_DIR / 'scripts'
    color_js = load_component(scripts_dir / 'color_utils.js')
    dom_js = load_component(scripts_dir / 'dom_utils.js')
    render_js = load_component(scripts_dir / 'render.js')
    manifest_json = json.dumps(manifest)

    auto_js = r'''
// ================= UP-NEXT AUTO CLOCK =================
(function () {
  'use strict';
  var MANIFEST = /*__MANIFEST__*/[];
  var params = new URLSearchParams(window.location.search || '');

  // ---- live data: fetch the JSON API at runtime, embedded manifest is instant fallback ----
  var liveEntries = null;
  var lastSyncAt = 0;
  var syncState = 'embedded'; // 'live' | 'stale' | 'embedded'
  function getEntries() { return liveEntries || MANIFEST; }
  function fetchLive() {
    var urls = ['api/up-next.json', 'api/timers.json'];
    var chain = Promise.resolve(false);
    urls.forEach(function (url) {
      chain = chain.then(function (done) {
        if (done) return true;
        return fetch(url, { cache: 'no-store' }).then(function (res) {
          if (!res.ok) return false;
          return res.json().then(function (data) {
            var list = (data && (data.timers || data.upcoming)) || data;
            if (Array.isArray(list) && list.length) {
              liveEntries = list;
              lastSyncAt = Date.now();
              syncState = 'live';
              return true;
            }
            return false;
          });
        }).catch(function () { return false; });
      });
    });
    return chain.then(function (ok) {
      if (!ok) syncState = liveEntries ? 'stale' : 'embedded';
      return ok;
    });
  }
  function syncLabel() {
    if (syncState === 'live') {
      var s = Math.floor((Date.now() - lastSyncAt) / 1000);
      return 'fetched fresh data ' + (s < 5 ? 'just now' : s + 's ago') + ' \u2665';
    }
    if (syncState === 'stale') return 'offline — holding onto the last data I fetched for you\u2026';
    return 'offline — counting from built-in data, still thinking of you\u2026';
  }

  // ?json=1 -> raw API dump instead of the clock UI.
  if (params.get('json') === '1') {
    document.addEventListener('DOMContentLoaded', function () {
      var up = computeUpcoming(new Date());
      document.title = 'up-next.json - Displau';
      document.body.innerHTML = '<pre id="api-dump"></pre>';
      document.getElementById('api-dump').textContent = JSON.stringify({
        generated_at: new Date().toISOString(),
        current: up.length ? up[0] : null,
        upcoming: up.slice(0, 10)
      }, null, 2);
    });
    window.DisplauAPI = apiSurface([]);
    return;
  }

  var WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  function normWeekday(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number' && isFinite(v)) { v = Math.trunc(v); return (v >= 0 && v <= 6) ? v : null; }
    var s = String(v).trim().toLowerCase();
    var i = WEEKDAYS.indexOf(s);
    if (i !== -1) return i;
    var n = Number(s);
    if (isFinite(n)) { n = Math.trunc(n); if (n >= 0 && n <= 6) return n; }
    return null;
  }
  function parseHMS(t) {
    var p = String(t || '00:00:00').split(':').map(Number);
    return { h: p[0] || 0, m: p[1] || 0, s: p[2] || 0 };
  }
  function atTime(day, t) {
    var p = parseHMS(t);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), p.h, p.m, p.s, 0);
  }
  function nextWeekday(from, wd, t) {
    var p = parseHMS(t);
    var diff = (wd - from.getDay() + 7) % 7;
    var n = new Date(from.getFullYear(), from.getMonth(), from.getDate() + diff, p.h, p.m, p.s, 0);
    if (n.getTime() <= from.getTime()) n.setDate(n.getDate() + 7);
    return n;
  }
  function prevWeekday(from, wd, t) {
    var p = parseHMS(t);
    var diff = (from.getDay() - wd + 7) % 7;
    var pr = new Date(from.getFullYear(), from.getMonth(), from.getDate() - diff, p.h, p.m, p.s, 0);
    if (pr.getTime() > from.getTime()) pr.setDate(pr.getDate() - 7);
    return pr;
  }
  // Next boundary for one manifest entry. Returns null when it has no future.
  function entryState(entry, now) {
    if (entry.recur) {
      var rule = entry.recur_rule || 'weekly';
      if (rule === 'interval') {
        var mins = Number(entry.recur_interval_minutes);
        if (!isFinite(mins) || mins <= 0) return null;
        var iv = mins * 60000;
        var anchor = entry.recur_anchor ? new Date(entry.recur_anchor)
          : (entry.start_time ? new Date(entry.start_time) : now);
        if (isNaN(anchor.getTime())) anchor = now;
        var target;
        if (now.getTime() < anchor.getTime()) target = new Date(anchor.getTime());
        else {
          var k = Math.ceil((now.getTime() - anchor.getTime()) / iv);
          target = new Date(anchor.getTime() + k * iv);
          if (target.getTime() <= now.getTime()) target = new Date(target.getTime() + iv);
        }
        return { entry: entry, target: target, prev: new Date(target.getTime() - iv), phase: 'waiting', slot: null };
      }
      var slots = (entry.recur_schedule || []).filter(function (s) {
        return rule === 'weekly' ? normWeekday(s.weekday) !== null : !!s.start;
      });
      if (!slots.length) return null;
      var best = null, prevB = null;
      if (rule === 'daily') {
        slots.forEach(function (s) {
          var st = atTime(now, s.start);
          var en = s.end ? atTime(now, s.end) : null;
          if (en && en.getTime() <= st.getTime()) en = new Date(en.getTime() + 86400000);
          var cand;
          if (en && now.getTime() >= st.getTime() && now.getTime() < en.getTime()) {
            cand = { target: en, phase: 'in-class' };
          } else if (now.getTime() < st.getTime()) {
            cand = { target: st, phase: 'waiting' };
          } else {
            cand = { target: new Date(st.getTime() + 86400000), phase: 'waiting' };
          }
          if (!best || cand.target.getTime() < best.target.getTime()) best = { target: cand.target, phase: cand.phase, slot: s };
          [st, (en && en.getTime() <= now.getTime() ? en : null), new Date(st.getTime() - 86400000)].forEach(function (b) {
            if (b && b.getTime() <= now.getTime() && (!prevB || b.getTime() > prevB.getTime())) prevB = b;
          });
        });
        if (!best) return null;
        return { entry: entry, target: best.target, prev: prevB || new Date(best.target.getTime() - 86400000), phase: best.phase, slot: best.slot };
      }
      slots.forEach(function (s) {
        var wd = normWeekday(s.weekday);
        var nx = nextWeekday(now, wd, s.start);
        var pr = prevWeekday(now, wd, s.start);
        var en = s.end ? atTime(pr, s.end) : null;
        if (en && en.getTime() <= pr.getTime()) en = new Date(en.getTime() + 86400000);
        var cand;
        if (en && now.getTime() >= pr.getTime() && now.getTime() < en.getTime()) {
          cand = { target: en, phase: 'in-class' };
        } else {
          cand = { target: nx, phase: 'waiting' };
        }
        if (!best || cand.target.getTime() < best.target.getTime()) best = { target: cand.target, phase: cand.phase, slot: s };
        [pr, (en && en.getTime() <= now.getTime() ? en : null)].forEach(function (b) {
          if (b && b.getTime() <= now.getTime() && (!prevB || b.getTime() > prevB.getTime())) prevB = b;
        });
      });
      if (!best) return null;
      return { entry: entry, target: best.target, prev: prevB || new Date(best.target.getTime() - 7 * 86400000), phase: best.phase, slot: best.slot };
    }
    if (!entry.target_time) return null;
    var t = new Date(entry.target_time);
    if (isNaN(t.getTime())) return null;
    var d = t.getTime() - now.getTime();
    if (d <= 0) return null; // one-shot past: not eligible for the auto clock
    var prevOne = entry.start_time ? new Date(entry.start_time) : new Date(t.getTime() - 86400000);
    if (isNaN(prevOne.getTime()) || prevOne.getTime() >= t.getTime()) prevOne = new Date(t.getTime() - 86400000);
    return { entry: entry, target: t, prev: prevOne, phase: 'one-shot', slot: null };
  }
  function computeUpcoming(now, pool) {
    var out = [];
    (pool || getEntries()).forEach(function (e) {
      var st = entryState(e, now);
      if (st) out.push({
        id: e.id, name: e.name, description: e.description, html_file: e.html_file,
        target: st.target, prev: st.prev, phase: st.phase, slot: st.slot || null,
        in_s: (st.target.getTime() - now.getTime()) / 1000
      });
    });
    out.sort(function (a, b) { return a.target - b.target; });
    return out;
  }
  function fmtDur(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
    if (m > 0) return m + 'm ' + String(sec).padStart(2, '0') + 's';
    return sec + '.' + String(Math.floor((ms % 1000) / 100)) + 's';
  }
  function fmtClock(ms) {
    if (ms < 0) ms = 0;
    var totalS = Math.floor(ms / 1000);
    var d = Math.floor(totalS / 86400), h = Math.floor((totalS % 86400) / 3600),
        m = Math.floor((totalS % 3600) / 60), s = totalS % 60, milli = ms % 1000;
    function p2(n) { return String(n).padStart(2, '0'); }
    if (d >= 1) return d + ':' + p2(h) + ':' + p2(m) + ':' + p2(s);
    if (h >= 1) return h + ':' + p2(m) + ':' + p2(s) + '.' + Math.floor(milli / 100);
    return m + ':' + p2(s) + '.' + String(milli).padStart(3, '0');
  }

  // ---- runtime JS API ----
  var switchHandlers = [];
  var currentId = null;
  function apiSurface(snapshot) {
    return {
      version: '2.2.0',
      getTimers: function () { return getEntries().slice(); },
      getUpcoming: function (n) { return computeUpcoming(new Date()).slice(0, n || 10); },
      getCurrent: function () {
        var up = computeUpcoming(new Date());
        return up.length ? up[0] : null;
      },
      getCurrentId: function () { return currentId; },
      getSyncState: function () { return { state: syncState, lastSyncAt: lastSyncAt }; },
      onSwitch: function (fn) { if (typeof fn === 'function') switchHandlers.push(fn); },
      refresh: function () { return fetchLive().then(function () { tick(true); }); }
    };
  }

  // ---- UI wiring ----
  var lockedId = params.get('timer');
  function findLocked(pool) {
    if (!lockedId) return null;
    var list = pool || getEntries();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === lockedId) return list[i];
    }
    return null;
  }
  var elName, elPhase, elMeta, elList, elDisplay, elSub, elSync;
  var lastTarget = 0;

  function ratioFor(up) {
    var total = up.target.getTime() - up.prev.getTime();
    var el = Date.now() - up.prev.getTime();
    if (!(total > 0)) return 0;
    return Math.max(0, Math.min(1, 1 - el / total));
  }
  function paintCountdown(up) {
    var remain = Math.max(0, up.target.getTime() - Date.now());
    if (typeof updateDisplay === 'function') updateDisplay(fmtClock(remain));
    if (typeof currentColor !== 'undefined') {
      try {
        var c = getColorForRemainingRatio(ratioFor(up));
        if (c !== targetColor) { targetColor = c; colorTransitionProgress = 0; }
        colorTransitionProgress = Math.min(1, colorTransitionProgress + 0.1);
        currentColor = lerpColor(currentColor, targetColor, colorTransitionProgress);
        if (colorTransitionProgress >= 1) currentColor = targetColor;
        applyColor(currentColor);
      } catch (e) { /* non-fatal */ }
    }
    return remain;
  }
  function describe(up) {
    var when = up.target.toLocaleString();
    if (up.phase === 'in-class') {
      var lbl = up.slot && up.slot.label ? ' \u00b7 ' + up.slot.label : '';
      return 'Ends ' + when + lbl + " — don't go anywhere";
    }
    if (up.phase === 'waiting' && up.slot && up.slot.label) return 'Starts ' + when + ' \u00b7 ' + up.slot.label + " — I'm waiting";
    return ((up.phase === 'one-shot') ? 'Target ' : 'Starts ') + when + ' — once in a lifetime';
  }
  function setPhaseBadge(up) {
    var txt = up.phase === 'in-class' ? '\u25cf WITH YOU RIGHT NOW'
      : up.phase === 'one-shot' ? '\u25cb ONCE IN A LIFETIME' : '\u25cb COUNTING DOWN FOR YOU';
    elPhase.textContent = txt;
    elPhase.dataset.phase = up.phase;
  }
  function renderList(upcoming) {
    elList.innerHTML = '';
    upcoming.slice(0, 5).forEach(function (u, i) {
      var li = document.createElement('li');
      li.className = 'up-row' + (i === 0 ? ' is-current' : '');
      var left = document.createElement('span');
      left.className = 'up-name';
      left.textContent = (i === 0 ? '\u2665 ' : '') + u.name;
      var right = document.createElement('span');
      right.className = 'up-in';
      right.textContent = fmtDur(Math.max(0, u.target.getTime() - Date.now()));
      li.appendChild(left);
      li.appendChild(right);
      li.title = describe(u);
      elList.appendChild(li);
    });
  }
  function fireSwitch(up) {
    switchHandlers.forEach(function (fn) {
      try { fn(up); } catch (e) { console.warn('[up-next] onSwitch handler error', e); }
    });
    try {
      window.dispatchEvent(new CustomEvent('displau:switch', { detail: up }));
    } catch (e) { /* older browsers */ }
  }
  function tick(force) {
    var now = new Date();
    var pool = getEntries();
    var upcoming = computeUpcoming(now, pool);
    var up = upcoming.length ? upcoming[0] : null;
    var locked = findLocked(pool);
    if (lockedId) {
      var st = locked ? entryState(locked, now) : null;
      up = st ? {
        id: locked.id, name: locked.name, description: locked.description,
        html_file: locked.html_file, target: st.target, prev: st.prev,
        phase: st.phase, slot: st.slot || null, in_s: (st.target - now) / 1000
      } : null;
    }
    if (elSync) elSync.textContent = syncLabel();
    if (!up) {
      elName.textContent = lockedId ? 'Nobody by that name\u2026' : 'Nothing to obsess over\u2026 yet';
      elPhase.textContent = '\u25cb ALL ALONE';
      elPhase.dataset.phase = 'idle';
      elMeta.textContent = lockedId
        ? 'No timer with id "' + lockedId + '" in my heart (or the API).'
        : "Add a timer JSON and rebuild — I'll be waiting.";
      if (typeof updateDisplay === 'function') updateDisplay('0:00.000');
      document.title = 'Up Next \u2665 all alone';
      renderList([]);
      return;
    }
    if (up.id !== currentId || force) {
      currentId = up.id;
      lastTarget = up.target.getTime();
      elName.textContent = up.name;
      elSub.textContent = up.description || '';
      setPhaseBadge(up);
      var card = document.querySelector('.up-card');
      if (card) {
        card.classList.remove('switched');
        void card.offsetWidth; // restart CSS animation
        card.classList.add('switched');
      }
      fireSwitch(up);
    } else if (up.target.getTime() !== lastTarget) {
      lastTarget = up.target.getTime(); // rolled over to next occurrence
      setPhaseBadge(up);
    }
    var remain = paintCountdown(up);
    elMeta.textContent = describe(up) + ' — ' + fmtDur(remain) + ' left';
    document.title = fmtClock(remain).split('.')[0] + ' \u2665 ' + up.name;
    renderList(upcoming);
  }

  function spawnHearts() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) { /* noop */ }
    var box = document.getElementById('hearts');
    if (!box) return;
    var glyphs = ['\u2665', '\u2661', '\u2665', '\u2727'];
    for (var i = 0; i < 14; i++) {
      var s = document.createElement('span');
      s.textContent = glyphs[i % glyphs.length];
      s.style.left = (Math.random() * 100).toFixed(2) + '%';
      s.style.animationDuration = (7 + Math.random() * 8).toFixed(2) + 's';
      s.style.animationDelay = (-Math.random() * 12).toFixed(2) + 's';
      s.style.fontSize = (12 + Math.random() * 22).toFixed(0) + 'px';
      box.appendChild(s);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    elName = document.getElementById('upName');
    elPhase = document.getElementById('upPhase');
    elMeta = document.getElementById('upMeta');
    elList = document.getElementById('upList');
    elDisplay = document.getElementById('display');
    elSub = document.getElementById('upSub');
    elSync = document.getElementById('upSync');
    if ((params.get('embed') === '1')) document.body.classList.add('embed');
    spawnHearts();
    if (lockedId && !findLocked()) {
      elName.textContent = 'Nobody by that name\u2026 (' + lockedId + ')';
      elMeta.textContent = 'Still fetching — maybe they just haven\u2019t been added yet.';
    }
    try {
      if (typeof getColorForRemainingRatio !== 'function' || typeof updateDisplay !== 'function') {
        throw new Error('display engine failed to load');
      }
      currentColor = getColorForRemainingRatio(1.0);
      targetColor = currentColor;
      applyColor(currentColor);
      tick(true); // instant paint from built-in data
      window.__upBooted = true;
      // Then fetch the live API and re-paint; keep feelings fresh every minute.
      fetchLive().then(function () { tick(true); });
      setInterval(function () { fetchLive().then(function () { tick(true); }); }, 60000);
    } catch (err) {
      elName.textContent = 'Could not start the clock';
      elMeta.textContent = 'Error: ' + ((err && err.message) || err) + ' — try ?json=1 to inspect the data.';
      return;
    }
    setInterval(function () { tick(false); }, 1000);
    // Smooth sub-second display refresh.
    setInterval(function () {
      var up = window.DisplauAPI.getCurrent();
      if (up) paintCountdown(up);
    }, 53);
  });

  // Surface late runtime errors in the meta line instead of failing silently.
  window.addEventListener('error', function (e) {
    if (window.__upBooted || !elMeta) return;
    try {
      elMeta.textContent = 'Error: ' + (e.message || e.error) + ' — try ?json=1 to inspect the data.';
    } catch (_) { /* noop */ }
  });

  window.DisplauAPI = apiSurface([]);
})();
// =============== /UP-NEXT AUTO CLOCK ===============
''';

    auto_js = auto_js.replace('/*__MANIFEST__*/[]', manifest_json)

    page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Up Next &#9825; Auto Clock</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
{styles}
:root {{
    --up-bg: #0d0208;
    --up-pink: #ff2d78;
    --up-red: #ff0f3f;
    --up-soft: #ffd6e7;
    --up-violet: #b967ff;
    --up-card: rgba(30, 6, 18, 0.72);
    --up-border: rgba(255, 45, 120, 0.28);
}}
body {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: #fff;
    background:
        radial-gradient(1100px 550px at 50% -8%, rgba(255, 45, 120, 0.16), transparent 60%),
        radial-gradient(900px 500px at 92% 108%, rgba(185, 103, 255, 0.12), transparent 60%),
        radial-gradient(700px 420px at 8% 100%, rgba(255, 15, 63, 0.10), transparent 60%),
        var(--up-bg);
    overflow-x: hidden;
}}
body::after {{
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.55) 100%);
    z-index: 1;
}}
.hearts {{ position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }}
.hearts span {{
    position: absolute;
    top: 105%;
    color: rgba(255, 45, 120, 0.35);
    animation: heartrise linear infinite;
    text-shadow: 0 0 12px rgba(255, 45, 120, 0.6);
}}
@keyframes heartrise {{
    0% {{ transform: translateY(0) rotate(0deg); opacity: 0; }}
    10% {{ opacity: 1; }}
    90% {{ opacity: 0.8; }}
    100% {{ transform: translateY(-115vh) rotate(24deg); opacity: 0; }}
}}
.up-wrap {{ position: relative; z-index: 2; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 3rem; min-height: 100vh; display: flex; flex-direction: column; gap: 1.25rem; }}
.up-eyebrow {{ text-align: center; color: #e89bb8; font-size: 0.78rem; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 700; }}
.up-eyebrow a {{ color: var(--up-pink); text-decoration: none; border-bottom: 1px dotted var(--up-pink); }}
.up-card {{
    background: var(--up-card);
    border: 1px solid var(--up-border);
    border-radius: 22px;
    padding: 2.2rem 2rem;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    text-align: center;
    box-shadow: 0 0 60px rgba(255, 45, 120, 0.12), 0 24px 60px rgba(0, 0, 0, 0.5);
}}
.up-card.switched {{ animation: upflash 0.9s ease; }}
@keyframes upflash {{
    0% {{ border-color: var(--up-pink); box-shadow: 0 0 0 2px rgba(255, 45, 120, 0.5), 0 0 80px rgba(255, 45, 120, 0.35); }}
    100% {{ border-color: var(--up-border); box-shadow: 0 0 60px rgba(255, 45, 120, 0.12), 0 24px 60px rgba(0, 0, 0, 0.5); }}
}}
#upName {{
    font-size: clamp(1.8rem, 4.5vw, 2.6rem);
    font-weight: 800;
    letter-spacing: -0.01em;
    margin-bottom: 0.25rem;
    background: linear-gradient(120deg, #fff 20%, var(--up-pink) 55%, var(--up-red) 80%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 22px rgba(255, 45, 120, 0.35));
}}
#upSub {{ color: #e89bb8; margin-bottom: 1rem; min-height: 1.2em; }}
#upSub:empty::before {{ content: 'I\\2019m watching this one just for you \\2665'; opacity: 0.7; }}
#upPhase {{
    display: inline-block;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    border: 1px solid var(--up-border);
    margin-bottom: 1.25rem;
    background: rgba(255, 45, 120, 0.08);
    color: var(--up-soft);
}}
#upPhase[data-phase="in-class"] {{
    background: rgba(255, 15, 63, 0.18);
    color: #ff8fa8;
    border-color: rgba(255, 15, 63, 0.55);
    animation: heartbeat 1.2s ease-in-out infinite;
}}
@keyframes heartbeat {{
    0%, 100% {{ transform: scale(1); }}
    14% {{ transform: scale(1.12); }}
    28% {{ transform: scale(1); }}
    42% {{ transform: scale(1.1); }}
}}
#upPhase[data-phase="waiting"] {{
    background: rgba(255, 45, 120, 0.12);
    color: #ff7dae;
    border-color: rgba(255, 45, 120, 0.4);
}}
#upPhase[data-phase="one-shot"] {{
    background: rgba(185, 103, 255, 0.12);
    color: #d3a6ff;
    border-color: rgba(185, 103, 255, 0.4);
}}
#upMeta {{ margin-top: 1rem; color: #f3c6d8; font-size: 0.92rem; }}
.up-sync {{ margin-top: 0.35rem; font-size: 0.72rem; color: #a06a85; letter-spacing: 0.04em; }}
.up-list-card {{
    background: rgba(30, 6, 18, 0.55);
    border: 1px solid var(--up-border);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}}
.up-list-card h2 {{ font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.16em; color: #e89bb8; margin-bottom: 0.75rem; }}
#upList {{ list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }}
.up-row {{
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 0.8rem;
    border-radius: 10px;
    background: rgba(255, 45, 120, 0.05);
    border: 1px solid transparent;
    font-size: 0.9rem;
}}
.up-row.is-current {{ border-color: rgba(255, 45, 120, 0.45); background: rgba(255, 45, 120, 0.09); }}
.up-in {{ font-family: 'JetBrains Mono', 'Courier New', monospace; color: var(--up-pink); white-space: nowrap; }}
.up-foot {{ text-align: center; color: #a06a85; font-size: 0.75rem; line-height: 1.7; }}
.up-foot code {{ background: rgba(255, 45, 120, 0.1); border: 1px solid rgba(255, 45, 120, 0.2); padding: 0.1rem 0.4rem; border-radius: 6px; color: #ff9ec2; }}
body.embed .up-list-card, body.embed .up-foot, body.embed .up-eyebrow, body.embed .hearts {{ display: none; }}
#api-dump {{ white-space: pre-wrap; word-break: break-word; padding: 2rem; font-size: 0.85rem; }}
@media (prefers-reduced-motion: reduce) {{
    *, *::before, *::after {{ animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }}
    .hearts {{ display: none; }}
}}
</style>
</head>
<body>
<div class="hearts" id="hearts" aria-hidden="true"></div>
<div class="up-wrap">
<div class="up-eyebrow">&#9825; your darling clock &#9825; &middot; <a href="api/up-next.json">api/up-next.json</a></div>
<div class="up-card">
<div id="upPhase" data-phase="waiting">&#9675; COUNTING DOWN FOR YOU</div>
<h1 id="upName">Loading&hellip;</h1>
<p id="upSub"></p>
<div class="display" id="display"></div>
<p id="upMeta"></p>
<p class="up-sync" id="upSync"></p>
</div>
<div class="up-list-card">
<h2>Also on my mind</h2>
<ul id="upList"></ul>
</div>
<div class="up-foot">
<p>I check every second for whoever needs you next — and I refresh my feelings from the API every minute. Lock onto one with <code>?timer=&lt;id&gt;</code> · just us with <code>?embed=1</code> · raw data with <code>?json=1</code> · <code>window.DisplauAPI</code> for your own scripts.</p>
<p>7 Segment Display Timer System &copy; 2026 · build {build_date} · I&apos;ll always be watching the clock for you &#9825;</p>
</div>
</div>
<script>
var currentColor = '#00ff00';
var targetColor = '#00ff00';
var colorTransitionProgress = 1;
var COLOR_TRANSITION_TABLE = null;
</script>
<script>
{color_js}
</script>
<script>
{dom_js}
</script>
<script>
{render_js}
</script>
<script>
{auto_js}
</script>
</body>
</html>'''

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(page)
    logger.info(f"Generated auto clock page: {output_path} ({len(manifest)} timers)")


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
