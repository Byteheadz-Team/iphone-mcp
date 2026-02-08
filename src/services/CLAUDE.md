# services/ — Domain services

All services extend `Module` (from `src/types.ts`) and receive dependencies via constructor injection.

## device/

Uses `UsbmuxClient` to list attached devices and `LockdownClient` to fetch device info (model, OS version, etc.) and battery status. The `withLockdownClient(udid, fn)` helper handles the usbmux→lockdown connection lifecycle so callers only provide the lockdown operation.

## mirroring/

`MirroringService` wraps `MirroringClient` (from `lib/mirroring/`) with `Module` lifecycle and coordinate mapping. On `start()`, it checks accessibility permissions, launches iPhone Mirroring, and caches window info.

Key responsibility: **coordinate mapping**. Screenshots are captured at 2x resolution (configurable via `config.mirroring.screenshotScale`). The AI sends coordinates in screenshot pixels; the service divides by the scale factor to convert to macOS screen points: `screen_x = window.x + pixel_x / scale`.

Also provides clipboard via `pbpaste`/`pbcopy` (Universal Clipboard) and home button simulation via ⌘1 shortcut.

The MCP tool layer calls `MirroringService` directly for screenshots, tap, swipe, type, and button press — there are no intermediate wrapper services.
