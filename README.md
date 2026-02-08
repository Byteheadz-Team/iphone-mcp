# iphone-mcp

MCP server that controls a physical iPhone from macOS. Take screenshots, tap, swipe, type text, and more -- all through the [Model Context Protocol](https://modelcontextprotocol.io/).

Uses **iPhone Mirroring** (macOS Sequoia 15+) instead of WebDriverAgent, so there's no Xcode setup, no provisioning profiles, no XCTest sessions to keep alive. Just plug in your iPhone and go.

## Quick start

```bash
# 1. Clone and build
git clone https://github.com/user/iphone-mcp.git
cd iphone-mcp
corepack enable
yarn install
yarn build

# 2. Check your setup
yarn doctor

# 3. Add to Claude Code
claude mcp add iphone-mcp node /absolute/path/to/iphone-mcp/dist/index.js
```

That's it. Ask Claude to "take a screenshot of my iPhone" to verify it works.

## How it works

```
MCP Client  ──stdio──>  iphone-mcp  ──usbmuxd──>  iPhone (device info, battery)
                              │
                              └── iPhone Mirroring window (screenshots, tap, swipe, type)
                                    ├── screencapture + sips (1x PNG screenshot)
                                    ├── CGEvent injection (clicks, drags)
                                    └── AppleScript keystroke (text input)
```

**iPhone Mirroring** is a macOS Sequoia app that mirrors your iPhone's screen to a macOS window. This server programmatically interacts with that window:

- **Screenshots** via `screencapture` + `sips` -- captures the mirroring window as PNG, downscaled to 1x resolution
- **Taps & swipes** via `CGEvent` (JXA/osascript) -- injects mouse events at the right screen coordinates
- **Text input** via AppleScript `keystroke` -- types into whatever field is focused

For device info and battery, the server speaks Apple's **usbmuxd** and **lockdown** protocols directly over USB -- implemented from scratch in TypeScript using only Node.js built-in modules. Zero native dependencies.

## Requirements

- **macOS Sequoia 15+** (iPhone Mirroring requires it)
- **iOS 18+** on the iPhone
- **Node.js 24+**
- **Same Apple ID** signed in on both Mac and iPhone
- **Bluetooth & WiFi** enabled on both devices
- **iPhone connected via USB**, trusted ("Trust This Computer?" accepted)

### Permissions

The host process (your terminal app) needs two macOS permissions:

| Permission           | What it enables                      | Where to grant                                          |
| -------------------- | ------------------------------------ | ------------------------------------------------------- |
| **Accessibility**    | Tap, swipe, type (CGEvent injection) | System Settings > Privacy & Security > Accessibility    |
| **Screen Recording** | Screenshots (screencapture)          | System Settings > Privacy & Security > Screen Recording |

Run `yarn doctor` to check if permissions are granted.

## Install

```bash
# Enable Corepack for Yarn 4
corepack enable

# Install dependencies
yarn install

# Build
yarn build

# Verify your environment
yarn doctor
```

## Usage

### With Claude Code

```bash
claude mcp add iphone-mcp node /absolute/path/to/iphone-mcp/dist/index.js
```

Then just talk to Claude:

- "Take a screenshot of my iPhone"
- "Tap the Settings icon"
- "Swipe up to go home"
- "Type 'hello world' into the search field"

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

Restart Claude Desktop.

### With MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Opens a web UI where you can browse and invoke all tools interactively.

### Development mode

```bash
yarn dev
```

Runs the server with `tsx watch` for automatic restarts on file changes.

## Tools

### Device

| Tool              | Description                                               | Parameters |
| ----------------- | --------------------------------------------------------- | ---------- |
| `list_devices`    | List all connected iOS devices                            | none       |
| `device_info`     | Get detailed device information (model, OS version, etc.) | `udid?`    |
| `get_screen_info` | Get screen dimensions and scale factor                    | none       |

### Screenshot

| Tool         | Description                           | Parameters |
| ------------ | ------------------------------------- | ---------- |
| `screenshot` | Take a screenshot (returns PNG image) | none       |

### UI Automation

| Tool           | Description                                             | Parameters                                                        |
| -------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `tap`          | Tap at coordinates (in screenshot pixels)               | `x`, `y`                                                          |
| `long_press`   | Press and hold at coordinates for a duration            | `x`, `y`, `duration` (seconds)                                    |
| `swipe`        | Swipe in a direction or between points                  | `direction?`, `startX?`, `startY?`, `endX?`, `endY?`, `duration?` |
| `type_text`    | Type text into the focused input field                  | `text`                                                            |
| `press_button` | Press a button (home only; simulated via swipe gesture) | `button`                                                          |

### Device Control

| Tool               | Description                              | Parameters |
| ------------------ | ---------------------------------------- | ---------- |
| `get_clipboard`    | Get clipboard text (Universal Clipboard) | none       |
| `set_clipboard`    | Set clipboard text (Universal Clipboard) | `content`  |
| `get_battery_info` | Get battery level and charging state     | none       |

### How the AI navigates

Unlike traditional automation frameworks, there's no `find_element` or accessibility tree. The AI uses **vision**: it takes a screenshot, sees the screen, and taps at the coordinates of what it wants to interact with. This is simpler, more robust, and matches how multimodal AI agents actually work.

## Project structure

```
src/
  lib/                          # Low-level protocol/client implementations
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
    mirroring/                  # iPhone Mirroring window interaction
      mirroring-client.ts       # screencapture + sips, CGEvent, AppleScript keystroke
      mirroring.types.ts        # WindowInfo, ContentBounds
  services/                     # Domain services (extend Module)
    device/                     # Device discovery and info (usbmux + lockdown)
      device.service.ts
      device.types.ts
    mirroring/                  # iPhone Mirroring coordination + coordinate mapping
      mirroring.service.ts
    screenshot/                 # Screenshot capture
      screenshot.service.ts
    automation/                 # UI automation (tap, swipe, type)
      automation.service.ts
      automation.types.ts
  mcp/                          # MCP protocol layer
    server.ts                   # MCP server with stdio transport
    tools/
      device-tools.ts           # list_devices, device_info, get_screen_info
      screenshot-tools.ts       # screenshot
      automation-tools.ts       # tap, swipe, type_text, press_button
      mirroring-control-tools.ts # get_clipboard, set_clipboard, get_battery_info
  container.ts                  # Dependency injection container
  config.ts                     # Environment-based configuration
  doctor.ts                     # Preflight environment checker
  log.ts                        # Scoped console logger
  types.ts                      # Base Module class
  index.ts                      # Entry point
```

## Scripts

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `yarn build`     | Compile TypeScript to `dist/`                |
| `yarn start`     | Run the compiled server                      |
| `yarn dev`       | Run with auto-restart on changes             |
| `yarn doctor`    | Preflight check (macOS, permissions, device) |
| `yarn test`      | Run all tests                                |
| `yarn typecheck` | Type-check without emitting                  |
| `yarn lint`      | Lint with ESLint                             |
| `yarn format`    | Format with Prettier                         |
| `yarn check`     | Format + lint fix + typecheck                |

## Configuration

Configuration is via environment variables:

| Variable             | Default            | Description                                   |
| -------------------- | ------------------ | --------------------------------------------- |
| `APP_ENV`            | `local`            | Environment (`test`, `local`, `dev`, `prod`)  |
| `LOG_LEVEL`          | `info`             | Log level (`debug`, `info`, `warn`, `silent`) |
| `USBMUX_SOCKET_PATH` | `/var/run/usbmuxd` | Path to usbmuxd socket                        |

## Troubleshooting

**`yarn doctor` fails**

- Start here. It checks macOS version, permissions, USB connection, and more.

**"No devices connected"**

- Check the iPhone is plugged in via USB: `system_profiler SPUSBDataType | grep -A5 iPhone`
- Make sure you tapped "Trust" on the iPhone when prompted

**"iPhone Mirroring window did not appear"**

- Open iPhone Mirroring manually first (`open -a "iPhone Mirroring"`) to ensure it works
- Both devices must be signed in with the same Apple ID
- Bluetooth and WiFi must be on
- The iPhone must be locked (iPhone Mirroring won't connect if the phone is unlocked and in use)

**Screenshots are blank or wrong**

- Grant Screen Recording permission to your terminal app
- System Settings > Privacy & Security > Screen Recording

**Taps/swipes don't work**

- Grant Accessibility permission to your terminal app
- System Settings > Privacy & Security > Accessibility

**Pairing errors (device info/battery)**

- Unplug the iPhone, re-plug, tap "Trust This Computer?" again
- Check pairing records exist: `ls /var/db/lockdown/`

## License

MIT
