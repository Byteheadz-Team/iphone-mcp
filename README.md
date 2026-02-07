# iphone-mcp

MCP server that controls a physical iPhone connected via USB. Think browser automation, but for a real iOS device -- take screenshots, tap buttons, launch apps, swipe, type text, and more.

Works with any MCP client: Claude Desktop, Claude Code, MCP Inspector, or anything that speaks the [Model Context Protocol](https://modelcontextprotocol.io/).

## How it works

```
MCP Client  <--stdio-->  iphone-mcp  <--usbmuxd-->  iPhone (USB)
                              |                         |
                              +-- lockdown protocol ----+  (device info, pairing)
                              +-- WDA HTTP (tunneled) --+  (UI automation)
```

macOS ships a daemon called **usbmuxd** that multiplexes USB connections to iOS devices. This server implements a client for its protocol (Unix socket at `/var/run/usbmuxd`), then layers Apple's **lockdown protocol** on top for device info and service discovery.

For UI automation, the server talks to **WebDriverAgent (WDA)** -- an XCTest app running on the iPhone that exposes an HTTP API. HTTP traffic is tunneled through usbmuxd so no Wi-Fi or network configuration is needed.

All Apple protocols are implemented from scratch in TypeScript using only Node.js built-in modules (`node:net`, `node:tls`, `node:crypto`, `node:buffer`). Zero native dependencies.

## Prerequisites

- **macOS** (usbmuxd is a macOS system daemon)
- **Node.js 24+**
- **Xcode** installed (for building WebDriverAgent)
- **iPhone** connected via USB, trusted ("Trust This Computer?" accepted)

## One-time setup: WebDriverAgent

WDA is an XCTest runner that exposes an HTTP API on the device. You need to build and install it once:

```bash
# Clone WebDriverAgent
git clone https://github.com/appium/WebDriverAgent.git
cd WebDriverAgent

# Open in Xcode
open WebDriverAgent.xcodeproj
```

In Xcode:

1. Select the **WebDriverAgentRunner** scheme
2. Select your **physical iPhone** as the run target
3. Under **Signing & Capabilities**, set a valid signing team
4. Press **Cmd+U** (Product > Test)

WDA will install and run on your device. You should see `ServerURLHere->http://...:8100` in the Xcode console. WDA stays running as long as the Xcode test session is active.

## Install

```bash
# Enable Corepack for Yarn 4
corepack enable

# Install dependencies
yarn install

# Build
yarn build
```

## Usage

### With Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "iphone": {
      "command": "node",
      "args": ["/absolute/path/to/iphone-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. You can then ask things like:

- "Take a screenshot of my iPhone"
- "Open Safari and navigate to example.com"
- "What apps are installed on my phone?"
- "Tap the Settings icon"

### With Claude Code

```bash
claude mcp add iphone-mcp node /absolute/path/to/iphone-mcp/dist/index.js
```

### With MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

This opens a web UI where you can browse and invoke all tools interactively.

### Development mode

```bash
yarn dev
```

Runs the server with `tsx watch` for automatic restarts on file changes.

## Tools

### Device

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_devices` | List all connected iOS devices | none |
| `device_info` | Get detailed device information (model, OS version, etc.) | `udid?` |
| `get_screen_info` | Get screen dimensions and scale factor | none |

### Screenshot

| Tool | Description | Parameters |
|------|-------------|------------|
| `screenshot` | Take a screenshot (returns PNG image) | none |

### UI Automation

| Tool | Description | Parameters |
|------|-------------|------------|
| `tap` | Tap at coordinates or on an element | `x?, y?, element?` |
| `swipe` | Swipe in a direction or between points | `direction?, startX?, startY?, endX?, endY?, duration?` |
| `type_text` | Type text into the focused input field | `text` |
| `press_button` | Press a physical button | `button` (`home`, `volumeUp`, `volumeDown`) |
| `find_element` | Find a UI element by search strategy | `using`, `value` |
| `get_page_source` | Get the full UI element tree (accessibility hierarchy) | none |

**`find_element` strategies:** `accessibility id`, `class name`, `xpath`, `predicate string`, `class chain`, `-ios predicate string`, `-ios class chain`

### App Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `launch_app` | Launch an app | `bundleId` |
| `terminate_app` | Terminate a running app | `bundleId` |
| `list_apps` | List installed apps | none |
| `open_url` | Open a URL on the device | `url` |
| `get_app_state` | Get app state (foreground, background, not running) | `bundleId` |

### Device Control

| Tool | Description | Parameters |
|------|-------------|------------|
| `lock_device` | Lock the screen | none |
| `unlock_device` | Unlock the screen | none |
| `device_is_locked` | Check if screen is locked | none |
| `get_clipboard` | Get clipboard text | none |
| `set_clipboard` | Set clipboard text | `content` |
| `get_battery_info` | Get battery level and charging state | none |

## Project structure

```
src/
  lib/                          # Low-level protocol implementations
    plist/                      # XML plist parser/serializer (from scratch)
      xml-parser.ts             # Recursive descent XML plist parser
      xml-serializer.ts         # JS values -> XML plist
      types.ts                  # PlistValue type union
    usbmux/                     # usbmuxd Unix socket client
      usbmux-client.ts          # Message framing, device listing, tunneling
      types.ts                  # Protocol types and constants
    lockdown/                   # Apple lockdown protocol
      lockdown-client.ts        # Device info, pairing, TLS upgrade, services
      types.ts                  # Lockdown types
  services/                     # Domain services
    device/                     # Device discovery and info (usbmux + lockdown)
      device.service.ts
      device.types.ts
    wda/                        # WebDriverAgent HTTP client
      wda-client.ts             # Full WDA API: screenshots, elements, actions, apps
      wda.types.ts
    screenshot/                 # Screenshot capture
      screenshot.service.ts
    automation/                 # UI automation (tap, swipe, type, find)
      automation.service.ts
      automation.types.ts
    app/                        # App management (launch, terminate, list)
      app.service.ts
  mcp/                          # MCP protocol layer
    server.ts                   # MCP server with stdio transport
    tools/
      device-tools.ts           # list_devices, device_info, get_screen_info
      screenshot-tools.ts       # screenshot
      automation-tools.ts       # tap, swipe, type_text, press_button, find_element
      app-tools.ts              # launch_app, terminate_app, list_apps, open_url
      device-control-tools.ts   # lock, unlock, clipboard, battery
  container.ts                  # Dependency injection container
  config.ts                     # Environment-based configuration
  log.ts                        # Scoped console logger
  types.ts                      # Base Module class
  index.ts                      # Entry point
```

## Scripts

| Command | Description |
|---------|-------------|
| `yarn build` | Compile TypeScript to `dist/` |
| `yarn start` | Run the compiled server |
| `yarn dev` | Run with auto-restart on changes |
| `yarn test` | Run all tests |
| `yarn typecheck` | Type-check without emitting |
| `yarn lint` | Lint with ESLint |
| `yarn format` | Format with Prettier |
| `yarn check` | Format + lint fix + typecheck |

## Configuration

Configuration is via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `local` | Environment (`test`, `local`, `dev`, `prod`) |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `silent`) |
| `USBMUX_SOCKET_PATH` | `/var/run/usbmuxd` | Path to usbmuxd socket |
| `WDA_PORT` | `8100` | WebDriverAgent port on device |

## Troubleshooting

**"No devices connected"**
- Check the iPhone is plugged in via USB: `system_profiler SPUSBDataType | grep -A5 iPhone`
- Make sure you tapped "Trust" on the iPhone when prompted

**WDA errors / timeouts**
- Make sure the Xcode test session is still running (WDA stops when the test stops)
- Re-run the test with Cmd+U in Xcode
- Check WDA is on port 8100: look for `ServerURLHere` in the Xcode console

**Pairing errors**
- Unplug the iPhone, re-plug, tap "Trust This Computer?" again
- Check pairing records exist: `ls /var/db/lockdown/`

## License

MIT
