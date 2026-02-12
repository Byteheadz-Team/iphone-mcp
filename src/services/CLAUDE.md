# services/ — Domain services

All services extend `Module` (from `@lib/utils`) and receive dependencies via constructor injection.

## mirroring/

`MirroringService` wraps `MirroringClient` (from `lib/mirroring/`) with `Module` lifecycle and coordinate mapping. On `start()`, it requests Accessibility and Screen Recording permissions (triggering macOS system prompts if not granted), resolves the host app name, caches permission warnings in the `permissionWarnings` property (`{ accessibility: string | null, screenRecording: string | null }`), launches iPhone Mirroring, and caches window info. Permission warnings include the host app name and are surfaced to the MCP client through tool responses.

Key responsibility: **coordinate mapping**. Screenshots are captured at 2x resolution (`config.mirroring.screenshotScale`) with a grid overlay that adds padding on all four sides. Grid layout is computed dynamically via `computeGridLayout()` using the image's short side and `config.mirroring.overlayGridDivisions`. The AI sends coordinates in the padded screenshot pixel space; the service subtracts the computed padding offset and divides by the scale factor to convert to macOS screen points: `screen_x = window.x + (pixel_x - padding) / scale`. Coordinates are validated as finite numbers via zod before being passed to CGEvent. `getGridLayout()` returns the current computed layout (or a reference fallback using `config.mirroring.referenceWidth` before the window is available).

Also provides clipboard via `pbpaste`/`pbcopy` (Universal Clipboard) and button simulation via keyboard shortcuts (⌘1 home, ⌘2 app switcher, ⌘3 spotlight).

The MCP tool layer calls `MirroringService` directly for screenshots, tap, swipe, type, and button press — there are no intermediate wrapper services.
