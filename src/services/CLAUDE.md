# services/ — Domain services

All services extend `Module` (from `@lib/utils`) and receive dependencies via constructor injection.

## mirroring/

`MirroringService` wraps `MirroringClient` (from `lib/mirroring/`) with `Module` lifecycle and coordinate mapping. On `start()`, it checks accessibility permissions, launches iPhone Mirroring, and caches window info.

Key responsibility: **coordinate mapping**. Screenshots are captured at 2x resolution (configurable via `config.mirroring.screenshotScale`) with a grid overlay that adds padding on the top and left. The AI sends coordinates in the padded screenshot pixel space; the service subtracts the padding offset and divides by the scale factor to convert to macOS screen points: `screen_x = window.x + (pixel_x - COORD_OFFSET) / scale`. Coordinates are validated as finite numbers via zod before being passed to CGEvent.

Also provides clipboard via `pbpaste`/`pbcopy` (Universal Clipboard) and button simulation via keyboard shortcuts (⌘1 home, ⌘2 app switcher, ⌘3 spotlight).

The MCP tool layer calls `MirroringService` directly for screenshots, tap, swipe, type, and button press — there are no intermediate wrapper services.
