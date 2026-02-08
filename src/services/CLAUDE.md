# services/ — Domain services

All services extend `Module` (from `src/types.ts`) and receive dependencies via constructor injection.

## device/

Uses `UsbmuxClient` to list attached devices and `LockdownClient` to fetch device info (model, OS version, etc.) and battery status. Creates fresh usbmux/lockdown connections per call and closes them in `finally` blocks.

## mirroring/

`MirroringService` wraps `MirroringClient` (from `lib/mirroring/`) with `Module` lifecycle and coordinate mapping. On `start()`, it checks accessibility permissions, launches iPhone Mirroring, and caches window info.

Key responsibility: **coordinate mapping**. Screenshots are captured at 1x (nominal resolution), so screenshot pixels = macOS screen points. Mapping is simply `screen_x = window.x + pixel_x`. The AI sends coordinates in screenshot pixels; the service translates them to macOS screen coordinates for CGEvent injection.

Also provides clipboard via `pbpaste`/`pbcopy` (Universal Clipboard) and home button simulation via swipe-up gesture.

## screenshot/

Thin wrapper around `MirroringService.takeScreenshot()` that adds logging and returns `{ data: Buffer, format: 'png' }`.

## automation/

Thin wrapper around `MirroringService` for tap, swipe, type, and button press. Delegates all coordinate math and input injection to `MirroringService`.
