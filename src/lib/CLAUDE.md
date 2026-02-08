# lib/ — Low-level protocol implementations

## plist/

Hand-written recursive descent XML plist parser and serializer. Handles Apple's XML plist format: `<dict>`, `<array>`, `<string>`, `<integer>`, `<real>`, `<true/>`, `<false/>`, `<data>` (base64), `<date>`.

`PlistValue` is the core union type — all protocol messages serialize to/from this.

## usbmux/

Zero npm dependencies. Built on `node:net`, `node:tls`, `node:buffer`.

Client for macOS `usbmuxd` daemon (Unix socket at `/var/run/usbmuxd`). Message format: 16-byte little-endian header + XML plist body. Header fields: length (u32 LE), version (u32 LE, always 1), type (u32 LE, 8 = plist), tag (u32 LE).

After a successful `Connect` call, the socket becomes a raw TCP tunnel to the device — the caller takes ownership and sets up their own data handler.

Port numbers are byte-swapped to network byte order before sending.

## lockdown/

Zero npm dependencies. Built on `node:tls`.

Apple lockdown protocol over a usbmux tunnel to device port 62078. Message format: 4-byte big-endian length prefix + XML plist body.

Supports TLS upgrade via `node:tls.connect()` with `socket` option using pairing certificates from the pair record. After TLS upgrade, the data handler is re-attached to the new TLS socket.

## mirroring/

Stateless client for interacting with the macOS iPhone Mirroring window. Uses `child_process.execFile` to run:

- `open -a "iPhone Mirroring"` to launch the app
- `osascript -l JavaScript` (JXA) to query window position/size via System Events, post mouse events via `CGEvent`, and check accessibility with `AXIsProcessTrusted()`
- `screencapture -l <windowId>` to capture the window as PNG, then `sips --resampleWidth` to resample to the caller's target width (e.g. 2x for Retina)
- `osascript` (AppleScript) to activate the iPhone Mirroring window and type text via `keystroke`

The window is activated before every input event (click, drag, type) to ensure `CGEvent` posts are received by the correct window.

`MirroringClient` is not a `Module` — it's a stateless utility (like `UsbmuxClient`). The `MirroringService` in `services/` wraps it with lifecycle and coordinate mapping.

`grid-overlay.ts` composites a labeled reference grid onto screenshots using `sharp` (SVG overlay). It adds a black padding margin around the image with grid lines every N pixels and letter labels (A, B, C, ...) in the margin. The `buildGridInstructions()` function generates the label→pixel mapping text for MCP server instructions. The `overlayGrid()` function takes a PNG buffer, spacing, and padding, and returns a new PNG buffer with the grid composited.

## utils/

Shared utilities used across all layers. Currently exports a promisified `execFile` from `node:child_process`. Import from `@lib/utils`.
