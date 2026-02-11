# lib/ — Low-level protocol implementations

## mirroring/

Stateless client for interacting with the macOS iPhone Mirroring window. Uses `child_process.execFile` to run:

- `open -a "iPhone Mirroring"` to launch the app
- `osascript -l JavaScript` (JXA) to query window position/size via System Events, post mouse events via `CGEvent`, and check accessibility with `AXIsProcessTrusted()`
- `screencapture -l <windowId>` to capture the window as PNG, then `sips --resampleWidth` to resample to the caller's target width (e.g. 2x for Retina)
- `osascript` (AppleScript) to activate the iPhone Mirroring window and type text via `keystroke`

The window is activated before every input event (click, drag, type) to ensure `CGEvent` posts are received by the correct window.

`MirroringClient` is not a `Module` — it's a stateless utility (like `UsbmuxClient`). The `MirroringService` in `services/` wraps it with lifecycle and coordinate mapping.

`grid-overlay.ts` composites a labeled reference grid onto screenshots using `sharp` (SVG overlay). It adds a black padding margin on the top and left of the image with grid lines every N pixels and letter labels (A–Z, up to 26) in the margin. The `buildGridInstructions()` function generates the label→pixel mapping text for MCP server instructions. The `overlayGrid()` function takes a PNG buffer, spacing, and padding, and returns a new PNG buffer with the grid composited. It is not exported from the barrel — it is used internally by `MirroringClient.captureWindow()`.

## utils/

Shared utilities used across all layers. Exports a promisified `execFile` from `node:child_process`, the `Module` base class (lifecycle + scoped logger), and `createLogger`. Import from `@lib/utils`.
