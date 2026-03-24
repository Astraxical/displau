# Timer Config Template

Copy this file and rename it to create a new timer.

## Quick Start

1. **Copy this file:**
   ```bash
   cp TEMPLATE.json my-timer.json
   ```

2. **Edit the values:**
   ```json
   {
       "id": "my-timer",
       "display_name": "My Timer",
       "target_time": "2026-12-31T23:59:59",
       "start_time": "2026-01-01T00:00:00",
       "on_expire": "stop"
   }
   ```

3. **Build and deploy:**
   ```bash
   python vMain.py --deploy
   ```
   This will:
   - Delete the `output/` folder
   - Rebuild all timers
   - Generate the selector page
   - Git add, commit, and push automatically!

4. **Commit and push:**
   ```bash
   git add . && git commit -m "Add my-timer" && git push
   ```

---

## Field Descriptions

### `id` (required)
- **Type:** String
- **Format:** lowercase, hyphens allowed
- **Example:** `"birthday"`, `"new-year-2027"`, `"product-launch"`
- **Note:** This becomes the filename: `output/{id}.html`

### `display_name` (optional)
- **Type:** String
- **Example:** `"Graduation Day"`, `"Product Launch"`, `"New Year 2027"`
- **Meaning:** Human-readable name shown in the timer display and browser title
- **Default:** If omitted, uses "7 Segment Timer"

### `target_time` (required)
- **Type:** String (ISO 8601 format)
- **Format:** `YYYY-MM-DDTHH:MM:SS`
- **Example:** `"2026-12-31T23:59:59"`
- **Meaning:** When the countdown ends

### `start_time` (optional)
- **Type:** String (ISO 8601 format)
- **Format:** `YYYY-MM-DDTHH:MM:SS`
- **Example:** `"2026-01-01T00:00:00"`
- **Meaning:** When the timer started (used for progress calculation)
- **Default:** If omitted, uses the build time

### `on_expire` (optional)
- **Type:** String
- **Options:** `"stop"` | `"continue"` | `"hide"`
- **Default:** `"stop"`
- **Meaning:** Behavior when timer reaches zero:
  - **`"stop"`**: Freeze at `00:00:00:00`, segments turn red and pulse
  - **`"continue"`**: Show negative time (e.g., `-00:05:30:00` counting up)
  - **`"hide"`**: Hide display, show "EXPIRED" message overlay

### `display_on_expire` (optional)
- **Type:** Boolean
- **Options:** `true` | `false`
- **Default:** `true`
- **Meaning:** Controls whether the timer card is shown on the selector page (index.html) after it expires:
  - **`true`**: Timer card remains visible on selector page even after expiry
  - **`false`**: Timer card is hidden from selector page once the timer ends
- **Use case:** Set to `false` for timers that should disappear after completion (e.g., one-time events)

### `direction` (optional)
- **Type:** String
- **Options:** `"down"` | `"up"`
- **Default:** `"down"`
- **Meaning:** Controls whether the timer counts down or up:
  - **`"down"`**: Classic countdown from start_time to target_time (decreases to zero)
  - **`"up"`**: Stopwatch mode, counts up from start_time (increases like elapsed time)
- **Use case:** Use `"up"` for session timers, meeting durations, or "time since" displays

### `min_value` (optional)
- **Type:** Number (milliseconds) or `null`
- **Default:** `0` (for down direction), `null` (for up direction)
- **Meaning:** Minimum value the timer will display
- **Use case:** Prevent countdown from going below zero or a specific value

### `max_value` (optional)
- **Type:** Number (milliseconds) or `null`
- **Default:** `null` (no limit)
- **Meaning:** Maximum value the timer will display
- **Use case:** Cap stopwatch at certain duration (e.g., 86400000 for 24 hours)

### `description` (optional)
- **Type:** String
- **Example:** `"Countdown to product launch event"`, `"Days until graduation"`
- **Meaning:** A brief description of the timer, shown on the selector page card

### `tags` (optional)
- **Type:** Array of strings
- **Example:** `["event", "work", "important"]`, `["personal", "birthday"]`
- **Meaning:** Tags for organizing and filtering timers on the selector page
- **Use case:** Add relevant keywords to help categorize and search timers

### `category` (optional)
- **Type:** String
- **Options:** Any string value
- **Example:** `"personal"`, `"work"`, `"events"`, `"holidays"`
- **Default:** `"general"`
- **Meaning:** Category for grouping timers on the selector page
- **Use case:** Group related timers together

### `color_theme` (optional)
- **Type:** String
- **Options:** `"green"` | `"blue"` | `"purple"` | `"orange"` | `"red"` | `"cyan"` | `"pink"`
- **Default:** `"green"`
- **Meaning:** Color theme for the timer display
- **Use case:** Customize the appearance of individual timers

### `show_milliseconds` (optional)
- **Type:** Boolean
- **Options:** `true` | `false`
- **Default:** `true`
- **Meaning:** Whether to show milliseconds in the countdown display
- **Use case:** Set to `false` for cleaner display when precision isn't needed

### `timezone` (optional)
- **Type:** String
- **Example:** `"UTC"`, `"America/New_York"`, `"Europe/London"`, `"Asia/Tokyo"`
- **Default:** `"UTC"`
- **Meaning:** Timezone for the target_time and start_time
- **Use case:** Ensure timer counts down correctly for viewers in different timezones

---

## Examples

### New Year Countdown
```json
{
    "id": "newyear",
    "display_name": "New Year 2027",
    "description": "Countdown to the new year",
    "target_time": "2027-01-01T00:00:00",
    "start_time": "2026-01-01T00:00:00",
    "direction": "down",
    "min_value": 0,
    "max_value": null,
    "on_expire": "stop",
    "display_on_expire": true,
    "tags": ["holiday", "celebration", "yearly"],
    "category": "holidays",
    "color_theme": "gold",
    "show_milliseconds": false,
    "timezone": "UTC"
}
```

### Event Countdown (Continue After Expiry)
```json
{
    "id": "product-launch",
    "display_name": "Product Launch",
    "description": "New product reveal event",
    "target_time": "2026-06-15T10:00:00",
    "start_time": "2026-03-01T00:00:00",
    "direction": "down",
    "min_value": 0,
    "max_value": null,
    "on_expire": "continue",
    "display_on_expire": true,
    "tags": ["work", "product", "important"],
    "category": "work",
    "color_theme": "blue",
    "show_milliseconds": true,
    "timezone": "America/New_York"
}
```

### Stopwatch Timer (Counts Up)
```json
{
    "id": "meeting-timer",
    "display_name": "Meeting Duration",
    "description": "Track meeting elapsed time",
    "start_time": "2026-03-24T09:00:00",
    "direction": "up",
    "min_value": 0,
    "max_value": 7200000,
    "on_expire": "stop",
    "display_on_expire": true,
    "tags": ["work", "meeting", "stopwatch"],
    "category": "work",
    "color_theme": "cyan",
    "show_milliseconds": true,
    "timezone": "UTC"
}
```

### Birthday Timer (Hide After Expiry)
```json
{
    "id": "birthday",
    "display_name": "Birthday Celebration",
    "description": "Annual birthday countdown",
    "target_time": "2026-08-20T18:00:00",
    "start_time": "2026-01-01T00:00:00",
    "direction": "down",
    "min_value": 0,
    "max_value": null,
    "on_expire": "hide",
    "display_on_expire": false,
    "tags": ["personal", "birthday", "celebration"],
    "category": "personal",
    "color_theme": "pink",
    "show_milliseconds": true,
    "timezone": "UTC"
}
```

### Wedding Countdown (Hide from Selector After Expiry)
```json
{
    "id": "wedding",
    "display_name": "Wedding Day",
    "description": "Wedding ceremony countdown",
    "target_time": "2026-12-25T14:00:00",
    "start_time": "2026-06-01T00:00:00",
    "direction": "down",
    "min_value": 0,
    "max_value": null,
    "on_expire": "stop",
    "display_on_expire": false,
    "tags": ["personal", "wedding", "special"],
    "category": "personal",
    "color_theme": "purple",
    "show_milliseconds": false,
    "timezone": "Europe/London"
}
```

---

## After Adding

1. Run: `python vMain.py --timers-dir --selector`
2. Check `output/` folder for new HTML file
3. Open `output/index.html` to see it in the selector
4. Commit and push to GitHub

## URLs

After pushing, your timer will be available at:
```
https://astraxical.github.io/displau/genbuild/output/{id}.html
```

Example: `https://astraxical.github.io/displau/genbuild/output/newyear.html`

---

## Features

### Expiry Behavior
- **Visual Feedback**: Red pulsing segments when timer expires
- **Browser Notification**: Desktop notification sent on expiry (requires permission)
- **Title Update**: Browser tab shows "EXPIRED" when timer ends
- **Page Visibility**: Reduces update frequency when tab is hidden (saves battery)

### Post-Expiry Options
- **stop**: Default - freezes at zero with red pulsing display
- **continue**: Shows elapsed time since expiry (e.g., "-00:00:05:00")
- **hide**: Shows large "EXPIRED" message overlay
