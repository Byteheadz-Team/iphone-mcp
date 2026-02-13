# iphone-mcp

MCP server that controls a physical iPhone from macOS. Take screenshots, tap, swipe, type text, and more -- all through the [Model Context Protocol](https://modelcontextprotocol.io/).

Uses **iPhone Mirroring** (macOS Sequoia 15+) instead of WebDriverAgent, so there's no Xcode setup, no provisioning profiles, no XCTest sessions to keep alive. Just plug in your iPhone and go.

## Quick start

```bash
# 1. Clone and build
git clone https://github.com/yev-yev-yev/iphone-mcp.git
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
MCP Client  ──stdio──>  iphone-mcp  ──>  iPhone Mirroring window
                                              ├── screencapture + sips (PNG screenshot, 1x default)
                                              ├── CGEvent injection (clicks, drags, scroll wheel)
                                              └── AppleScript keystroke (text input)
```

**iPhone Mirroring** is a macOS Sequoia app that mirrors your iPhone's screen to a macOS window. This server programmatically interacts with that window:

- **Screenshots** via `screencapture` + `sips` -- captures the mirroring window as PNG, resampled to the configured scale (default 1x)
- **Taps & swipes** via `CGEvent` (JXA/osascript) -- injects mouse events at the right screen coordinates
- **Scrolling** via `CGEventCreateScrollWheelEvent` -- trackpad-style scroll wheel events for smooth content scrolling (auto-corrected for the macOS "Natural scrolling" preference)
- **Text input** via AppleScript `keystroke` -- types into whatever field is focused

## Requirements

- **macOS Sequoia 15+** (iPhone Mirroring requires it)
- **iOS 18+** on the iPhone
- **Node.js 24+**
- **Same Apple ID** signed in on both Mac and iPhone
- **Bluetooth & WiFi** enabled on both devices
- **iPhone connected via USB**, trusted ("Trust This Computer?" accepted)

### Permissions

The application hosting the MCP server (e.g. Terminal, VS Code, Claude Desktop) needs two macOS permissions:

| Permission           | What it enables                              | Where to grant                                          |
| -------------------- | -------------------------------------------- | ------------------------------------------------------- |
| **Accessibility**    | Tap, swipe, scroll, type (CGEvent injection) | System Settings > Privacy & Security > Accessibility    |
| **Screen Recording** | Screenshots (screencapture)                  | System Settings > Privacy & Security > Screen Recording |

The server **automatically prompts** for Accessibility permission on first launch -- macOS will open System Settings where you can toggle the switch for the host application. Screen Recording permission is checked silently. If either permission isn't granted, tool responses will include a warning message identifying which application needs access (e.g. "Accessibility permission is not granted for Terminal").

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
- "Scroll down in Settings"
- "Swipe left to the next home screen page"
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

### Screen Info

| Tool              | Description                            | Parameters |
| ----------------- | -------------------------------------- | ---------- |
| `get_screen_info` | Get screen dimensions and scale factor | none       |

### Screenshot

| Tool         | Description                           | Parameters |
| ------------ | ------------------------------------- | ---------- |
| `screenshot` | Take a screenshot (returns PNG image) | none       |

### UI Automation

| Tool           | Description                                                                                                                   | Parameters                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `tap`          | Tap at coordinates (in screenshot pixels)                                                                                     | `x`, `y`, `screenshotDelay?`                                                   |
| `long_press`   | Press and hold at coordinates for a duration                                                                                  | `x`, `y`, `duration` (seconds), `screenshotDelay?`                             |
| `swipe`        | Swipe between two points -- best for directional gestures (dismissing, pull-to-refresh, drag-and-drop)                        | `startX`, `startY`, `endX`, `endY`, `duration?`, `easing?`, `screenshotDelay?` |
| `scroll`       | Scroll content at a point -- best for scrolling lists, web pages, feeds, and home screen pages (trackpad-style scroll events) | `x`, `y`, `deltaX?`, `deltaY?`, `speed?`, `screenshotDelay?`                   |
| `type_text`    | Type text into the focused input field                                                                                        | `text`, `screenshotDelay?`                                                     |
| `press_button` | Press a device button (home, app_switcher, spotlight)                                                                         | `button`, `screenshotDelay?`                                                   |

### Clipboard

| Tool            | Description                              | Parameters                    |
| --------------- | ---------------------------------------- | ----------------------------- |
| `get_clipboard` | Get clipboard text (Universal Clipboard) | none                          |
| `set_clipboard` | Set clipboard text (Universal Clipboard) | `content`, `screenshotDelay?` |

### Utility

| Tool              | Description                                                         | Parameters                              |
| ----------------- | ------------------------------------------------------------------- | --------------------------------------- |
| `get_coordinates` | Convert grid labels to exact pixel coordinates for tap/swipe/scroll | `column`, `row`, `xPercent`, `yPercent` |

### How the AI navigates

Unlike traditional automation frameworks, there's no `find_element` or accessibility tree. The AI uses **vision**: it takes a screenshot, sees the screen, and taps at the coordinates of what it wants to interact with. This is simpler, more robust, and matches how multimodal AI agents actually work.

### Coordinate grid overlay

Raw vision-based coordinate estimation is the Achilles' heel of every multimodal agent — LLMs are notoriously imprecise when translating "tap the Settings icon" into exact pixel coordinates. We solve this with a **reference grid** that is composited onto every screenshot before it reaches the model.

```
┌──────────────────────────────────┐
│  margin    A     B     C     D   │  <- column labels (X axis)
│         ┌─────────────────────┐  │
│  A ─────│─ ─ ─ ─ ─ ─ ─ ─ ─ ─│  │  <- labeled reference lines
│         │                     │  │     at fixed intervals
│  B ─────│─ ─ ─ ─ ─ ─ ─ ─ ─ ─│  │
│         │    iPhone screen    │  │
│  C ─────│─ ─ ─ ─ ─ ─ ─ ─ ─ ─│  │
│         │                     │  │
│  D ─────│─ ─ ─ ─ ─ ─ ─ ─ ─ ─│  │
│         └─────────────────────┘  │
└──────────────────────────────────┘
   ^
   row labels (Y axis)
```

Every screenshot is wrapped in a dark margin on all four sides with **labeled grid lines** at fixed intervals. The grid layout (spacing, padding) is computed dynamically based on the image dimensions and the configured number of divisions. The MCP server instructions tell the model the exact pixel value of each label, giving it a spatial coordinate system it can read directly from the image instead of guessing. The model identifies the nearest grid labels and calls `get_coordinates` with a percentage offset to get exact pixel values deterministically.

The result: the AI goes from "somewhere around the middle of the screen" to "between grid lines C and D on the X axis, right on line F on the Y axis" and calls `get_coordinates` to compute the exact pixel coordinates. This practically eliminates mis-taps on small targets like icons, buttons, and text fields.

This turns out to be one of the most impactful parts of the whole system. Without the grid, vision-based agents miss small tap targets constantly -- buttons, icons, text fields all become a guessing game. The grid gives the model a shared spatial language it can reason about precisely, turning a fuzzy "tap roughly here" into a deterministic coordinate lookup. It's a simple idea, but it makes a surprisingly big difference in practice.

## Scripts

| Command                                      | Description                                                      |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `yarn build`                                 | Bundle with tsup to `dist/`                                      |
| `yarn start`                                 | Run the compiled server                                          |
| `yarn dev`                                   | Run with auto-restart on changes                                 |
| `yarn doctor`                                | Preflight check (macOS, permissions, device)                     |
| `yarn screenshot`                            | Capture iPhone screen with grid overlay, save to `_screenshots/` |
| `yarn tap <x> <y>`                           | Tap at screenshot coordinates                                    |
| `yarn scroll <x> <y> <deltaY>`               | Scroll at a point (positive deltaY = scroll down)                |
| `yarn scroll <x> <y> <deltaX> <deltaY>`      | Scroll with both horizontal and vertical deltas                  |
| `yarn swipe <startX> <startY> <endX> <endY>` | Swipe between two points                                         |
| `yarn test`                                  | Run all tests                                                    |
| `yarn typecheck`                             | Type-check without emitting                                      |
| `yarn lint`                                  | Lint with ESLint                                                 |
| `yarn format`                                | Format with Prettier                                             |
| `yarn check`                                 | Format + lint fix + typecheck                                    |

## Configuration

Configuration is via environment variables (all prefixed with `IPHONE_MCP_`):

| Variable                           | Default | Description                                                                            |
| ---------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `IPHONE_MCP_LOG_LEVEL`             | `info`  | Log level (`debug`, `info`, `warn`, `error`, `silent`)                                 |
| `IPHONE_MCP_SCREENSHOT_SCALE`      | `1`     | Screenshot resolution multiplier. Higher values increase detail and token usage        |
| `IPHONE_MCP_GRID_DIVISIONS`        | `9`     | Number of grid divisions on the coordinate overlay. More divisions = finer precision   |
| `IPHONE_MCP_PNG_PALETTE`           | `true`  | Enable palette-based PNG (256 colors) for smaller screenshots (`true`/`false`/`1`/`0`) |
| `IPHONE_MCP_PNG_COMPRESSION_LEVEL` | `6`     | PNG zlib compression level, 0-9 (higher = smaller file but slower)                     |
| `IPHONE_MCP_LAUNCH_TIMEOUT_MS`     | `10000` | How long to wait for iPhone Mirroring to launch (milliseconds)                         |

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

- The server checks for Screen Recording permission on startup. Grant it manually if missing:
- System Settings > Privacy & Security > Screen Recording -- enable the application hosting the MCP server (e.g. Terminal, VS Code, Claude Desktop)
- You may need to restart the server after granting Screen Recording

**Taps/swipes don't work**

- The server prompts for Accessibility permission on startup. If you dismissed it, grant it manually:
- System Settings > Privacy & Security > Accessibility — enable the application hosting the MCP server (e.g. Terminal, VS Code, Claude Desktop)

## Notes

- **Tested models**: This MCP server has primarily been tested with **Claude Sonnet 4.5** and **Claude Opus 4.6**. It should work with other multimodal models that support MCP, but your mileage may vary.
- **Scrolling and swiping**: Gesture-based interactions (scrolling and swiping) can be finicky -- they go through macOS event injection which doesn't always map 1:1 to how a real finger behaves on glass. We're actively working on improving reliability here. If a scroll or swipe doesn't land right, the AI will usually retry or adjust on its own.

## Disclaimer

This software enables AI-driven control of a physical iPhone. By using it, you acknowledge and agree that:

- **You are solely responsible** for all actions performed through this tool, whether initiated manually or autonomously by an AI agent.
- **Unintended actions may occur** AI models can misinterpret screen content, tap wrong targets, send unintended messages, delete data, make purchases, or perform other irreversible actions on your device. The author is not responsible for any such outcomes.
- **You assume all risk** associated with granting an automated system control over your device, including but not limited to data loss, unintended communications, financial transactions, privacy breaches, and account modifications.
- **This software is not designed for unsupervised use** You should monitor all AI-initiated actions and be prepared to disconnect your device at any time.
- **Do not use this software for malicious purposes**, including unauthorized access to devices, surveillance, harassment, fraud, or any activity that violates applicable laws.

THE AUTHOR DISCLAIMS ALL LIABILITY FOR ANY DAMAGES, LOSSES, OR CONSEQUENCES ARISING FROM THE USE OR MISUSE OF THIS SOFTWARE. USE AT YOUR OWN RISK.

## License

MIT
