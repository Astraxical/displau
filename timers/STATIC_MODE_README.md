# Static Display Mode

Display a fixed time value without any countdown. Perfect for showing a specific time on the 7-segment display.

## Quick Start

1. Set `"display_mode": "static"` in your timer config
2. Set `"static_time_ms"` to the time value in milliseconds
3. Build the timer

## Examples

### Show 2.5 hours (2:30:00.000)
```json
{
    "id": "my-static-display",
    "display_name": "2.5 Hours",
    "display_mode": "static",
    "static_time_ms": 9000000
}
```

### Show 1 hour (1:00:00.000)
```json
{
    "id": "one-hour",
    "display_name": "1 Hour",
    "display_mode": "static",
    "static_time_ms": 3600000
}
```

### Show 30 minutes (30:00.000)
```json
{
    "id": "thirty-min",
    "display_name": "30 Minutes",
    "display_mode": "static",
    "static_time_ms": 1800000
}
```

### Show 5 minutes (5:00.000)
```json
{
    "id": "five-min",
    "display_name": "5 Minutes",
    "display_mode": "static",
    "static_time_ms": 300000
}
```

## Milliseconds Reference

| Time | Milliseconds |
|------|--------------|
| 1 second | 1,000 |
| 1 minute | 60,000 |
| 5 minutes | 300,000 |
| 10 minutes | 600,000 |
| 30 minutes | 1,800,000 |
| 1 hour | 3,600,000 |
| 2 hours | 7,200,000 |
| 2.5 hours | 9,000,000 |
| 5 hours | 18,000,000 |
| 10 hours | 36,000,000 |
| 24 hours | 86,400,000 |

**Formula**: `milliseconds = time_in_seconds × 1000`

## Notes

- The display uses the same formatting as normal countdown timers (auto-selects best format based on value)
- No countdown occurs - the value stays fixed
- The display color will use the "full time" color from your color transition table
