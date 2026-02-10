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

Run a single test file: `yarn vitest run src/path/to/file.test.ts`

## Code style

- ESM only (`import`/`export`, never `require`). No `.js` extensions on imports.
- Path aliases for cross-layer imports: `~/*`, `@lib/*`, `@services/*`, `@mcp/*`. Relative imports (extensionless) for siblings/parents within the same module.
- Strict TypeScript — `no-explicit-any` is an error. Use `unknown` and narrow.
- `type` imports must use inline syntax: `import { type Foo } from '@lib/bar'`
- Import order enforced by eslint: builtins, externals, internals (aliases), parent, sibling — with blank lines between groups, alphabetized.
- Node built-in imports always use `node:` prefix (e.g. `node:net`, `node:tls`).
- Single quotes, 2-space indent, trailing commas (prettier handles this).

## Architecture

Three layers — `lib/` (protocols) → `services/` (domain) → `mcp/` (tools). All services extend the `Module` base class in `src/types.ts` which provides `start()`/`stop()` lifecycle and a scoped logger.

Dependencies flow one direction: mcp → services → lib. Never import upward.

`src/container.ts` wires everything via constructor injection (no DI framework). Modules start in order, stop in reverse.

Build uses `tsup` (esbuild) which bundles everything into a single `dist/index.js`. Path aliases from `tsconfig.json` are resolved at build time. `moduleResolution: "bundler"` allows extensionless imports.

`src/lib/utils/index.ts` exports a shared promisified `execFile` — import from `@lib/utils` instead of duplicating `promisify(execFileCb)` in each file.

## iPhone communication

Two channels to the iPhone:

- **usbmuxd + lockdown** (device info, battery): Zero npm dependencies. Uses Node built-ins (`node:net`, `node:tls`, `node:buffer`). Unix socket at `/var/run/usbmuxd`. 16-byte LE header + XML plist. Lockdown on device port 62078: 4-byte BE length + XML plist. TLS upgrade uses pairing certificates.
- **iPhone Mirroring** (UI automation): macOS Sequoia's `com.apple.ScreenContinuity` mirrors the iPhone screen to a macOS window. The server takes screenshots via `screencapture` (resampled to 2x via `sips`), injects clicks/drags via `CGEvent` (JXA/osascript), and types via AppleScript `keystroke`. The window is activated before each input event. Zero setup beyond what Apple provides.

## Testing

- Tests live next to source in `__tests__/` directories.
- Mock `MirroringClient`/`MirroringService` with plain objects + `vi.fn()` — avoid `mockResolvedValue(undefined)` (triggers `unicorn/no-useless-undefined`). Use `vi.fn().mockReturnValue(Promise.resolve())` instead.
- Mock objects should be typed via `as unknown as MirroringClient` pattern to avoid `@typescript-eslint/unbound-method` on mock assertions.
- Use `beforeEach(() => vi.clearAllMocks())` when mocking `node:child_process` to prevent call count accumulation across tests.
- No real device needed for unit tests.

## Common gotchas

- `Module.start()` and `Module.stop()` return `Promise<void> | void` — always `await` them to avoid `@typescript-eslint/no-floating-promises`.
- Plist `PlistDict` values are `PlistValue`, not `PlistValue | undefined` — interfaces extending it can't have optional properties of plist types.
- usbmuxd port encoding is byte-swapped: `((port & 0xff) << 8) | ((port >> 8) & 0xff)`.
- Coordinate mapping: screenshots are captured at 2x resolution (configurable via `config.mirroring.screenshotScale`), then a grid overlay is composited via `sharp` (SVG over the image). The grid adds a black margin (`config.mirroring.overlayGridPadding`, default 40px) around the screenshot with labeled reference lines every `config.mirroring.overlayGridSpacing` (default 80px). The AI sends coordinates in the padded image space; `MirroringService.toScreenCoords()` subtracts the padding offset and divides by the scale factor: `screen_x = window.x + (pixel_x - gridPadding) / scale`.
- The screenshot output includes the window title bar. Coordinates the AI provides from the screenshot already account for it.
- `sharp` is the only native npm dependency. It's marked `external` in `tsup.config.ts` so it's not bundled — it must be installed in `node_modules` at runtime. Ships prebuilt binaries for macOS arm64/x64.
- `MirroringClient` activates the iPhone Mirroring window before every input event (click, drag, type). Without this, `CGEvent` posts may be silently ignored if the window isn't frontmost.
- Swipes always require explicit start/end coordinates (no direction-based mode). `postDrag()` applies easing curves (default `'ease-out'`); the `SwipeEasing` type is defined in `lib/mirroring/mirroring.types.ts`.
- Swiping up from the bottom edge does not trigger the iOS home gesture via iPhone Mirroring. Use `press_button` with `"home"` instead.
- The `calculate` tool uses a hand-written recursive descent parser (no `eval`). It has no service dependencies — `registerMathTools` only takes the `McpServer`. The handler is synchronous.
