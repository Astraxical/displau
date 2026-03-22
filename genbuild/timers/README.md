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
       "target_time": "2026-12-31T23:59:59",
       "start_time": "2026-01-01T00:00:00"
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

---

## Examples

### New Year Countdown
```json
{
    "id": "newyear",
    "target_time": "2027-01-01T00:00:00",
    "start_time": "2026-01-01T00:00:00"
}
```

### Event Countdown
```json
{
    "id": "product-launch",
    "target_time": "2026-06-15T10:00:00",
    "start_time": "2026-03-01T00:00:00"
}
```

### Birthday Timer
```json
{
    "id": "birthday",
    "target_time": "2026-08-20T18:00:00",
    "start_time": "2026-01-01T00:00:00"
}
```

### Wedding Countdown
```json
{
    "id": "wedding",
    "target_time": "2026-12-25T14:00:00",
    "start_time": "2026-06-01T00:00:00"
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
