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
- `screencapture -l <windowId>` to capture the window as PNG, then `sips --resampleWidth` to downscale to 1x (nominal resolution)
- `osascript` (AppleScript) to activate the iPhone Mirroring window, type text via `keystroke`, and special keys via `key code`

The window is activated before every input event (click, drag, type) to ensure `CGEvent` posts are received by the correct window.

`MirroringClient` is not a `Module` — it's a stateless utility (like `UsbmuxClient`). The `MirroringService` in `services/` wraps it with lifecycle and coordinate mapping.
