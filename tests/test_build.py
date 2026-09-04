"""
Tests for 7 Segment Display HTML Builder
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from vMain import (
    replace_placeholders,
    get_config_url,
    validate_timer_config,
    normalize_recur_schedule,
    normalize_checkpoints,
    window_bounds,
    next_event_for_timer,
    minify_js_safe,
    minify_css,
    obfuscate_html,
    HAS_SCHEMA,
    GITHUB_REPO,
    GITHUB_BRANCH,
    TIMERS_PATH,
    VERSION,
)


class TestReplacePlaceholders:
    """Tests for the replace_placeholders function."""

    def test_replace_target_time(self):
        """Test that TARGET_TIME placeholder is replaced."""
        content = "Target: {{TARGET_TIME}}"
        result = replace_placeholders(content, "2026-12-31T23:59:59", 0, "", "2026-01-01T00:00:00")
        assert "Target: 2026-12-31T23:59:59" in result

    def test_replace_multiple_placeholders(self):
        """Test multiple placeholder replacements."""
        content = "{{TARGET_TIME}} - {{START_TIME}} - {{DIRECTION}}"
        result = replace_placeholders(
            content,
            "2026-12-31T23:59:59",
            1000,
            "http://example.com/config.json",
            "2026-01-01T00:00:00",
            direction="up"
        )
        assert "2026-12-31T23:59:59" in result
        assert "2026-01-01T00:00:00" in result
        assert "up" in result

    def test_replace_min_max_values(self):
        """Test min and max value replacements."""
        content = "Min: {{MIN_VALUE}}, Max: {{MAX_VALUE}}"
        result = replace_placeholders(content, "2026-12-31T23:59:59", 0, "", "2026-01-01T00:00:00", min_value=10, max_value=100)
        assert "Min: 10" in result
        assert "Max: 100" in result

    def test_replace_null_max_value(self):
        """Test null max value replacement."""
        content = "Max: {{MAX_VALUE}}"
        result = replace_placeholders(content, "2026-12-31T23:59:59", 0, "", "2026-01-01T00:00:00", max_value='null')
        assert "Max: null" in result

    def test_custom_build_date(self):
        """Test custom build date."""
        content = "Build: {{BUILD_DATE}}"
        custom_date = "2.0.0.20260101120000.stable"
        result = replace_placeholders(content, "2026-12-31T23:59:59", 0, "", "2026-01-01T00:00:00", build_date=custom_date)
        assert f"Build: {custom_date}" in result

    def test_version_type_replacement(self):
        """Test version type replacement."""
        content = "Version: {{VERSION_TYPE}}"
        result = replace_placeholders(content, "2026-12-31T23:59:59", 0, "", "2026-01-01T00:00:00", version_type="EXPERIMENTAL")
        assert "Version: EXPERIMENTAL" in result


class TestGetConfigUrl:
    """Tests for get_config_url function."""

    def test_generates_correct_url(self):
        """Test that config URL is generated correctly."""
        url = get_config_url("my-timer")
        expected = f"https://raw.githubusercontent.com/{GITHUB_REPO}/refs/heads/{GITHUB_BRANCH}/{TIMERS_PATH}/my-timer.json"
        assert url == expected

    def test_url_with_special_chars(self):
        """Test URL generation with special characters in config_id."""
        url = get_config_url("my-timer-123")
        assert "my-timer-123.json" in url


class TestTimerConfigValidation:
    """Tests for timer configuration validation."""

    @pytest.mark.skipif(not HAS_SCHEMA, reason="jsonschema not installed")
    def test_valid_config(self):
        """Test validation of a valid timer config."""
        config = {
            "id": "test-timer",
            "target_time": "2026-12-31T23:59:59",
            "display_name": "Test Timer",
            "direction": "down",
            "min_value": 0,
            "max_value": None,
            "on_expire": "stop",
            "display_on_expire": True,
        }
        assert validate_timer_config(config, "test-timer") is True

    @pytest.mark.skipif(not HAS_SCHEMA, reason="jsonschema not installed")
    def test_config_missing_required_id(self):
        """Test validation fails when required 'id' is missing."""
        config = {
            "target_time": "2026-12-31T23:59:59",
        }
        assert validate_timer_config(config, "test-timer") is False

    @pytest.mark.skipif(not HAS_SCHEMA, reason="jsonschema not installed")
    def test_config_missing_required_target_time(self):
        """Test validation fails when required 'target_time' is missing."""
        config = {
            "id": "test-timer",
        }
        assert validate_timer_config(config, "test-timer") is False

    @pytest.mark.skipif(not HAS_SCHEMA, reason="jsonschema not installed")
    def test_config_invalid_direction(self):
        """Test validation fails with invalid direction value."""
        config = {
            "id": "test-timer",
            "target_time": "2026-12-31T23:59:59",
            "direction": "invalid",
        }
        assert validate_timer_config(config, "test-timer") is False

    @pytest.mark.skipif(not HAS_SCHEMA, reason="jsonschema not installed")
    def test_config_invalid_on_expire(self):
        """Test validation fails with invalid on_expire value."""
        config = {
            "id": "test-timer",
            "target_time": "2026-12-31T23:59:59",
            "on_expire": "invalid",
        }
        assert validate_timer_config(config, "test-timer") is False

    @pytest.mark.skipif(not HAS_SCHEMA, reason="jsonschema not installed")
    def test_config_invalid_id_pattern(self):
        """Test validation fails with invalid id pattern."""
        config = {
            "id": "Invalid_ID_With_Uppercase!",
            "target_time": "2026-12-31T23:59:59",
        }
        assert validate_timer_config(config, "test-timer") is False

    @pytest.mark.skipif(not HAS_SCHEMA, reason="jsonschema not installed")
    def test_config_invalid_target_time_format(self):
        """Test validation fails with invalid target_time format."""
        config = {
            "id": "test-timer",
            "target_time": "2026/12/31 23:59:59",
        }
        assert validate_timer_config(config, "test-timer") is False

    @pytest.mark.skipif(not HAS_SCHEMA, reason="jsonschema not installed")
    def test_config_with_all_optional_fields(self):
        """Test validation with all optional fields."""
        config = {
            "id": "complete-timer",
            "target_time": "2026-12-31T23:59:59",
            "start_time": "2026-01-01T00:00:00",
            "display_name": "Complete Timer",
            "description": "A timer with all fields",
            "direction": "down",
            "min_value": 0,
            "max_value": 1000000,
            "on_expire": "stop",
            "display_on_expire": False,
            "tags": ["event", "countdown"],
            "category": "personal",
            "color_theme": "progress",
            "show_milliseconds": True,
            "timezone": "UTC+8",
        }
        assert validate_timer_config(config, "complete-timer") is True

    @pytest.mark.skipif(not HAS_SCHEMA, reason="jsonschema not installed")
    def test_config_with_color_transition_table(self):
        """Test validation with custom color transition table."""
        config = {
            "id": "color-timer",
            "target_time": "2026-12-31T23:59:59",
            "color_transition_table": [
                {"ratio": 1.0, "color": "#0088ff"},
                {"ratio": 0.0, "color": "#ff0000"},
            ],
        }
        assert validate_timer_config(config, "color-timer") is True

    @pytest.mark.skipif(not HAS_SCHEMA, reason="jsonschema not installed")
    def test_config_additional_properties_rejected(self):
        """Test that additional properties are rejected."""
        config = {
            "id": "test-timer",
            "target_time": "2026-12-31T23:59:59",
            "unknown_field": "should_fail",
        }
        assert validate_timer_config(config, "test-timer") is False


class TestBuildConfig:
    """Tests for build configuration loading."""
    def test_version_loaded(self):
        """Test that version is loaded from config."""
        assert VERSION is not None
        assert isinstance(VERSION, str)

    def test_github_config_loaded(self):
        """Test that GitHub config is loaded."""
        assert GITHUB_REPO is not None
        assert GITHUB_BRANCH is not None

    def test_paths_config_loaded(self):
        """Test that paths config is loaded."""
        assert TIMERS_PATH is not None


class TestIntegration:
    """Integration tests."""

    def test_timer_files_exist(self):
        """Test that timer JSON files exist and are valid."""
        timers_dir = Path(__file__).parent.parent / 'timers'
        timer_files = list(timers_dir.glob('*.json'))
        
        # Should have at least some timer files
        assert len(timer_files) > 0

        # Each timer file should be valid JSON
        for timer_file in timer_files:
            if timer_file.name.startswith('TEMPLATE'):
                continue
            with open(timer_file, 'r') as f:
                data = json.load(f)
                assert 'id' in data
                assert 'target_time' in data


class TestRecurNormalize:
    """Tests for recurrence normalization helpers."""

    def test_legacy_single_slot(self):
        timer = {'recur_weekday': 'Thursday', 'recur_time': '12:00', 'recur_end': '16:00'}
        slots = normalize_recur_schedule(timer)
        assert slots == [{'weekday': 4, 'start': '12:00:00', 'end': '16:00:00', 'label': ''}]

    def test_schedule_passthrough(self):
        timer = {'recur_schedule': [
            {'weekday': 'Monday', 'start': '08:30', 'end': '12:30', 'label': 'Lecture'},
            {'weekday': 4, 'time': '12:00'},
        ]}
        slots = normalize_recur_schedule(timer)
        assert slots[0] == {'weekday': 1, 'start': '08:30:00', 'end': '12:30:00', 'label': 'Lecture'}
        assert slots[1]['start'] == '12:00:00'
        assert slots[1]['end'] is None

    def test_checkpoints_sorted(self):
        timer = {'checkpoints': [
            {'at': '2026-09-11T23:00:00', 'label': 'End'},
            {'at': '2026-09-11T20:30:00', 'label': 'Doors'},
            {'at': 'not-a-date'},
        ]}
        legs = normalize_checkpoints(timer)
        assert [l['label'] for l in legs] == ['Doors', 'End']

    def test_window_phases(self):
        timer = {'display_mode': 'window',
                 'window_start': '2026-09-11T20:30:00',
                 'window_end': '2026-09-11T23:00:00'}
        assert next_event_for_timer(timer, datetime(2026, 9, 4))['phase'] == 'starts'
        assert next_event_for_timer(timer, datetime(2026, 9, 11, 21, 0))['phase'] == 'ends'
        assert next_event_for_timer(timer, datetime(2026, 9, 12))['phase'] == 'expired'

    def test_window_bounds_fallback(self):
        start, end = window_bounds({'start_time': '2026-01-01T00:00:00',
                                    'target_time': '2026-01-01T02:00:00'})
        assert (end - start).total_seconds() == 7200


class TestObfuscation:
    """Tests for the one-way HTML obfuscation pass."""

    def test_minify_js_safe_keeps_strings_and_regex(self):
        js = ('// comment\n'
              'var url = "https://x.test/a"; /* block */\n'
              "var re = /^#?([a-f\\d]{2})+$/i;\n"
              'var t = `a${1 + 2}b`;\n'
              'function f(a, b) { return a + b; }\n')
        out = minify_js_safe(js)
        assert '//' not in out.replace('https://', '').replace('http://', '')
        assert 'https://x.test/a' in out
        assert '/^#?([a-f\\d]{2})+$/' in out
        assert '`a${1 + 2}b`' in out
        assert 'function f(a,b){return a+b;}' in out

    def test_minify_css(self):
        css = '/* c */ .a { color: red; margin: 0 auto; }'
        assert minify_css(css) == '.a{color:red;margin:0 auto;}'

    def test_obfuscate_html_preserves_src_scripts(self):
        html = ('<html><head><style>/* c */ .a { color: red; }</style></head>'
                '<body><script src="x.js"></script><script>var a = 1; // c\n</script></body></html>')
        out = obfuscate_html(html, 'test')
        assert '<script src="x.js"></script>' in out
        assert '/* c */' not in out
        assert len(out) < len(html)
