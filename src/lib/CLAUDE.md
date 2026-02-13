# lib/ — Low-level protocol implementations

## mirroring/

Stateless client for interacting with the macOS iPhone Mirroring window. Uses `child_process.execFile` to run:

- `open -a "iPhone Mirroring"` to launch the app
- `osascript -l JavaScript` (JXA) to query window position/size via System Events, post mouse events via `CGEvent`, check Accessibility permission via `AXIsProcessTrustedWithOptions`, and resolve the host app name by walking the process tree
- `screencapture -l <windowId>` to capture the window as PNG, then `sips --resampleWidth` to resample to the caller's target width (configurable via `config.mirroring.screenshotScale`, default 1x)
- `osascript` (AppleScript) to activate the iPhone Mirroring window and type text via `keystroke` (regular characters) and `key code` (special keys like backspace, tab, forward delete, escape)

The window is activated before every input event (click, drag, scroll, type) to ensure `CGEvent` posts are received by the correct window.

`postScroll()` posts `CGEventCreateScrollWheelEvent` events (pixel-based units, 2 axes) to simulate trackpad-style scrolling. It moves the cursor to the target position first, then targets ~300ms total gesture duration by dynamically scaling step size (minimum 2px per step, 8ms apart). The last step accounts for rounding remainder to ensure exact total delta. Accepts a `speed` parameter (default 1) that scales the inter-step delay (higher = faster animation, lower = slower/more precise). The effective scroll distance is controlled by `config.mirroring.scrollSpeed` (default 1), which `MirroringService.scroll()` applies as a multiplier to the deltas before passing them to `postScroll()`. This is preferred over `postDrag()` for content scrolling (lists, web pages, feeds) and home screen page navigation (horizontal deltaX). `postDrag()` remains the right choice for directional gestures (dismissing cards, pull-to-refresh, fling-to-delete, drag-and-drop). Note: `CGEventCreateScrollWheelEvent` posted at `kCGHIDEventTap` is subject to the macOS "Natural scrolling" preference — `MirroringService` handles this by detecting the setting and negating deltas when needed. Continuous/phase flags are intentionally avoided — iPhone Mirroring misinterprets trackpad gesture phases as an active touch, which blocks subsequent taps.

`MirroringClient` is not a `Module` — it's a stateless utility. The `MirroringService` in `services/` wraps it with lifecycle and coordinate mapping.

Permission and preference methods: `checkAccessibilityPermission()` calls `AXIsProcessTrustedWithOptions` with `kAXTrustedCheckOptionPrompt` which opens System Settings to the Accessibility pane if not granted. `checkScreenRecordingPermission()` does a probe `screencapture` to a temp file and checks if the output is non-empty. `getHostAppName()` walks the process tree via `ps` to find the outermost `.app` bundle name (e.g. "Terminal", "Visual Studio Code") for user-facing permission messages. `isNaturalScrolling()` reads `defaults read -g com.apple.swipescrolldirection` — returns `true` if the key is missing or non-zero (macOS default is natural scrolling ON).

`grid-overlay.ts` composites a labeled reference grid onto screenshots using `sharp` (SVG overlay). `computeGridLayout({ shortSide, targetDivisions })` derives `spacing`, `padding`, `fontSize`, `strokeWidth`, and `tick` from the image's short side and target number of divisions. The grid adds a dark margin on **all four sides** of the image (`totalWidth = width + 2 * padding`, `totalHeight = height + 2 * padding`) with grid lines and letter labels (A-Z, up to 26) in the margin. `overlayGrid({ imageBuffer, targetDivisions, compressPngPalette?, pngCompressionLevel? })` takes a PNG buffer and returns a new PNG buffer with the grid composited -- used internally by `MirroringClient.captureWindow()`. When `compressPngPalette` is true, sharp outputs a palette-based PNG (`{ palette: true }`). `pngCompressionLevel` is passed to sharp's `.png({ compressionLevel })`. Barrel exports: `computeGridLayout`, `buildGridInstructions`, `gridLabel`, `labelToIndex`, `GridLayout` (type).

## utils/

Shared utilities used across all layers. Exports a promisified `execFile` from `node:child_process`, the `Module` base class (lifecycle + scoped logger), and `createLogger`. Import from `@lib/utils`.
