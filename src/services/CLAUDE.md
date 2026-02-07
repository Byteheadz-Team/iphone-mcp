# services/ — Domain services

All services extend `Module` (from `src/types.ts`) and receive dependencies via constructor injection.

## device/

Uses `UsbmuxClient` to list attached devices and `LockdownClient` to fetch device info (model, OS version, etc.). Creates fresh usbmux/lockdown connections per call and closes them in `finally` blocks.

## wda/

`WdaClient` talks to WebDriverAgent over HTTP using native `fetch()`. It can create a local TCP proxy (`net.createServer`) that tunnels connections through usbmux to device port 8100 — this lets `fetch()` hit `http://127.0.0.1:<proxyPort>` without needing Wi-Fi.

Most WDA methods require an active session — call `createSession()` first. Methods that don't need a session: `getStatus()`, `takeScreenshot()`.

The WDA HTTP API follows WebDriver/W3C conventions: elements are identified by opaque IDs returned in the `ELEMENT` or `element-6066-11e4-a52e-4f735466cecf` field.

## screenshot/, automation/, app/

Thin wrappers around `WdaClient` that add logging and ergonomic method signatures. They don't hold state beyond what `WdaClient` provides.
