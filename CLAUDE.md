# iphone-mcp

MCP server that controls a physical iPhone via macOS iPhone Mirroring. See @README.md for full project overview.

## Commands

- `yarn build` — bundle with tsup to dist/
- `yarn dev` — run with tsx watch (auto-restart)
- `yarn test` — run all tests (vitest)
- `yarn typecheck` — type-check without emitting
- `yarn lint` — eslint with cache
- `yarn check` — format + lint fix + typecheck (run before committing)
- `yarn doctor` — preflight check (macOS version, permissions, device detection)
- `yarn screenshot` — capture iPhone screen with grid overlay, save to current directory

Run a single test file: `yarn vitest run src/path/to/file.test.ts`

## Code style

- ESM only (`import`/`export`, never `require`). No `.js` extensions on imports.
- Path aliases for cross-layer imports: `~/*`, `@lib/*`, `@services/*`, `@mcp/*`. Relative imports (extensionless) for siblings/parents within the same module.
- Strict TypeScript — `no-explicit-any` is an error. Use `unknown` and narrow.
- `type` imports must use inline syntax: `import { type Foo } from '@lib/bar'`
- Import order enforced by eslint: builtins, externals, internals (aliases), parent, sibling — with blank lines between groups, alphabetized.
- Node built-in imports always use `node:` prefix (e.g. `node:net`, `node:tls`).
- Arrow functions only — never use hoisted `function` declarations. Use `const fn = () => {}`.
- Single quotes, 2-space indent, trailing commas (prettier handles this).

## Architecture

Three layers — `lib/` (protocols) → `services/` (domain) → `mcp/` (tools). All services extend the `Module` base class in `src/lib/utils/module.ts` which provides `start()`/`stop()` lifecycle and a scoped logger.

Dependencies flow one direction: mcp → services → lib. Never import upward.

`src/app-container.ts` wires everything via constructor injection (no DI framework). Modules start in order, stop in reverse.

Build uses `tsup` (esbuild) which bundles everything into a single `dist/index.js`. Path aliases from `tsconfig.json` are resolved at build time. `moduleResolution: "bundler"` allows extensionless imports.

`src/lib/utils/index.ts` exports a shared promisified `execFile`, the `Module` base class, and `createLogger` — import from `@lib/utils`.

## iPhone communication

All interaction goes through **iPhone Mirroring** (macOS Sequoia's `com.apple.ScreenContinuity`), which mirrors the iPhone screen to a macOS window. The server takes screenshots via `screencapture` (resampled to 2x via `sips`), injects clicks/drags/scroll-wheel events via `CGEvent` (JXA/osascript), and types via AppleScript `keystroke`. The window is activated before each input event. Zero setup beyond what Apple provides. At startup, the server checks Accessibility permission via `AXIsProcessTrustedWithOptions` (which prompts the user if not granted) and Screen Recording permission by attempting a `screencapture` probe. Permission state is cached in `MirroringService.permissionWarnings` and surfaced as warning text in tool responses (e.g. "Accessibility permission is not granted for Terminal...") so the AI client can relay the message to the user.

## Testing

- Tests live next to source in `__tests__/` directories.
- Mock `MirroringClient`/`MirroringService` with plain objects + `vi.fn()` — avoid `mockResolvedValue(undefined)` (triggers `unicorn/no-useless-undefined`). Use `vi.fn().mockReturnValue(Promise.resolve())` instead.
- Mock objects should be typed via `as unknown as MirroringClient` pattern to avoid `@typescript-eslint/unbound-method` on mock assertions.
- Use `beforeEach(() => vi.clearAllMocks())` when mocking `node:child_process` to prevent call count accumulation across tests.
- No real device needed for unit tests.

## Common gotchas

- `Module.start()` and `Module.stop()` return `Promise<void> | void` — always `await` them to avoid `@typescript-eslint/no-floating-promises`.
- Coordinate mapping: screenshots are captured at 2x resolution (`config.mirroring.screenshotScale`), then a grid overlay is composited via `sharp` (SVG over the image). Grid layout is computed dynamically by `computeGridLayout()` based on the image's short side and `config.mirroring.overlayGridDivisions` (default 9). The grid adds a dark margin on **all four sides** of the screenshot with labeled reference lines every `spacing` pixels. The AI sends coordinates in the padded image space; `MirroringService.toScreenCoords()` subtracts the padding offset and divides by the scale factor: `screen_x = window.x + (pixel_x - padding) / scale`, where `padding` comes from the computed `GridLayout`.
- The screenshot output includes the window title bar. Coordinates the AI provides from the screenshot already account for it.
- `sharp` is the only native npm dependency. It's marked `external` in `tsup.config.ts` so it's not bundled — it must be installed in `node_modules` at runtime. Ships prebuilt binaries for macOS arm64/x64.
- `MirroringClient` activates the iPhone Mirroring window before every input event (click, drag, type). Without this, `CGEvent` posts may be silently ignored if the window isn't frontmost.
- **Scroll vs swipe**: `postScroll()` posts `CGEventCreateScrollWheelEvent` events (trackpad-style pixel scrolling) — best for scrolling content (lists, web pages, feeds). `postDrag()` posts mouse-down/drag/up events — best for directional gestures (page switching, dismissing cards, pull-to-refresh, drag-and-drop). The AI should prefer `scroll` for content scrolling and `swipe` for directional gestures.
- Swipes always require explicit start/end coordinates (no direction-based mode). `postDrag()` applies easing curves (default `'linear'`) and a 30ms initial dwell after touch-down to mimic natural finger contact; the `SwipeEasing` enum is defined in `lib/mirroring/mirroring.types.ts`. `MirroringService.swipe()` divides the duration by `config.mirroring.swipeSpeed` (default 2) before passing it to the client (base duration remains 500ms). The AI should avoid starting swipes directly on interactive elements (icons, buttons) to prevent triggering edit/jiggle mode.
- `postScroll()` breaks the total delta into small steps (~4px each, 8ms apart) to mimic natural trackpad scrolling. It moves the cursor to the target position first, then posts incremental scroll-wheel events. Scroll deltas are in pixel units. `MirroringService.scroll()` multiplies deltas by `config.mirroring.scrollSpeed` (default 2) before passing them to the client, and auto-detects the macOS "Natural scrolling" preference (`com.apple.swipescrolldirection`) at startup via `MirroringClient.isNaturalScrolling()` and negates deltas when natural scrolling is ON so the tool contract stays consistent: positive `deltaY` = scroll down (content moves up). The AI is also instructed to verify scroll direction and retry with the opposite sign as a fallback.
- Swiping up from the bottom edge does not trigger the iOS home gesture via iPhone Mirroring. Use `press_button` with `"home"` instead. Other supported buttons: `"app_switcher"` (⌘2) and `"spotlight"` (⌘3).
- The `get_coordinates` tool converts grid labels + percentage offsets to exact pixel coordinates. `registerCoordinateTools` takes `{ server, getGridLayout }` where `getGridLayout` is a callback to `MirroringService.getGridLayout()`. Accepts `column`, `row`, `xPercent`, `yPercent`; percentage fields accept numbers or strings with optional trailing `%`.
- Pre-commit hook runs `yarn lint --fix && yarn typecheck`. All log output goes to stderr — stdout is reserved for MCP protocol (stdio transport).
