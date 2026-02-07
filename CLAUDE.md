# iphone-mcp

MCP server that controls a physical iPhone via USB. See @README.md for full project overview.

## Commands

- `yarn build` — compile TypeScript to dist/
- `yarn dev` — run with tsx watch (auto-restart)
- `yarn test` — run all tests (vitest)
- `yarn typecheck` — type-check without emitting
- `yarn lint` — eslint with cache
- `yarn check` — format + lint fix + typecheck (run before committing)

Run a single test file: `yarn vitest run src/path/to/file.test.ts`

## Code style

- ESM only (`import`/`export`, never `require`). All local imports use `.js` extension.
- Strict TypeScript — `no-explicit-any` is an error. Use `unknown` and narrow.
- `type` imports must use inline syntax: `import { type Foo } from './bar.js'`
- Import order enforced by eslint: builtins, externals, internals, parent, sibling — with blank lines between groups, alphabetized.
- Node built-in imports always use `node:` prefix (e.g. `node:net`, `node:tls`).
- Single quotes, 2-space indent, trailing commas (prettier handles this).

## Architecture

Three layers — `lib/` (protocols) → `services/` (domain) → `mcp/` (tools). All services extend the `Module` base class in `src/types.ts` which provides `start()`/`stop()` lifecycle and a scoped logger.

Dependencies flow one direction: mcp → services → lib. Never import upward.

`src/container.ts` wires everything via constructor injection (no DI framework). Modules start in order, stop in reverse.

## iPhone communication

IMPORTANT: Zero npm dependencies for iPhone protocols. Everything uses Node built-ins (`node:net`, `node:tls`, `node:buffer`).

- **usbmuxd**: Unix socket at `/var/run/usbmuxd`. 16-byte LE header + XML plist payload. Port numbers sent in network byte order (byte-swapped).
- **lockdown**: Connects via usbmux to device port 62078. 4-byte BE length prefix + XML plist. TLS upgrade uses pairing certificates.
- **WDA**: HTTP over a TCP proxy tunneled through usbmux to device port 8100. Uses native `fetch()`.

## Testing

- Tests live next to source in `__tests__/` directories.
- Mock WDA/usbmux clients with plain objects + `vi.fn()` — avoid `mockResolvedValue(undefined)` (triggers `unicorn/no-useless-undefined`). Use `vi.fn().mockReturnValue(Promise.resolve())` instead.
- Mock objects should be typed via `as unknown as WdaClient` pattern to avoid `@typescript-eslint/unbound-method` on mock assertions.
- No real device needed for unit tests. Integration tests require iPhone + WDA running.

## Common gotchas

- `Module.start()` and `Module.stop()` return `Promise<void> | void` — always `await` them to avoid `@typescript-eslint/no-floating-promises`.
- Plist `PlistDict` values are `PlistValue`, not `PlistValue | undefined` — interfaces extending it can't have optional properties of plist types.
- usbmuxd port encoding is byte-swapped: `((port & 0xff) << 8) | ((port >> 8) & 0xff)`.
