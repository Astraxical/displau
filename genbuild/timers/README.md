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

---

## Examples

### New Year Countdown
```json
{
    "id": "newyear",
    "display_name": "New Year 2027",
    "target_time": "2027-01-01T00:00:00",
    "start_time": "2026-01-01T00:00:00",
    "on_expire": "stop",
    "display_on_expire": true
}
```

### Event Countdown (Continue After Expiry)
```json
{
    "id": "product-launch",
    "display_name": "Product Launch",
    "target_time": "2026-06-15T10:00:00",
    "start_time": "2026-03-01T00:00:00",
    "on_expire": "continue",
    "display_on_expire": true
}
```

### Birthday Timer (Hide After Expiry)
```json
{
    "id": "birthday",
    "display_name": "Birthday Celebration",
    "target_time": "2026-08-20T18:00:00",
    "start_time": "2026-01-01T00:00:00",
    "on_expire": "hide",
    "display_on_expire": true
}
```

### Wedding Countdown (Hide from Selector After Expiry)
```json
{
    "id": "wedding",
    "display_name": "Wedding Day",
    "target_time": "2026-12-25T14:00:00",
    "start_time": "2026-06-01T00:00:00",
    "on_expire": "stop",
    "display_on_expire": false
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
