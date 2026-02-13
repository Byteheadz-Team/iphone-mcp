# mcp/ — MCP server and tool definitions

## server.ts

Creates an `McpServer` from `@modelcontextprotocol/sdk` with `StdioServerTransport`. The `McpServer` instance is created in `start()` (not the constructor) so that the grid layout can be derived from real device dimensions via `mirroringService.getGridLayout()`. The `server` field is nullable (`McpServer | null`). Tool registration happens in `start()` via `registerTools()` which uses a non-null assertion on `this.server` — each tool file exports a `register*Tools()` function that takes the server and relevant service dependencies.

Dependencies: `MirroringService`.

## tools/

Each file registers a group of related tools using `server.registerTool(name, config, handler)` where config is `{ description, inputSchema?, annotations? }` and `inputSchema` is a record of parameter names to zod schemas (e.g. `{ x: z.number(), y: z.number() }`). Tool handlers return `{ content: [...] }` where content is either `{ type: 'text', text }` or `{ type: 'image', data, mimeType }` (for screenshots). All tools set `annotations` with `readOnlyHint` (for query tools) or `destructiveHint: false` (for UI actions) and `openWorldHint: false`.

All tool handlers wrap their logic in `try/catch` and return `{ content: [{ type: 'text', text: 'Error: ...' }], isError: true }` on failure — this gives the MCP client a readable error message instead of a stack trace.

Files:

- `screenshot-tools.ts` — `screenshot`, `get_screen_info`. Depends on `MirroringService`. The `screenshot` tool prepends a Screen Recording permission warning (from `mirroringService.permissionWarnings.screenRecording`) as a text content block before the image when the permission is missing.
- `automation-tools.ts` — `tap`, `long_press`, `swipe`, `scroll`, `type_text`, `press_button`. `press_button` accepts `"home"`, `"app_switcher"`, and `"spotlight"`. `scroll` uses trackpad-style scroll wheel events and is preferred over `swipe` for content scrolling (lists, web pages, feeds) and home screen page navigation (horizontal deltaX). `scroll` accepts a `speed` parameter (0.1-5, default 1) that controls animation pace without changing distance. `swipe` is best for directional gestures (dismissing cards, pull-to-refresh, fling-to-delete, drag-and-drop). Scroll direction is auto-corrected by `MirroringService` for the macOS "Natural scrolling" setting — positive `deltaY` = scroll down (content moves up) regardless of user preference. The tool description also instructs the AI to retry with the opposite sign as a fallback. All automation tools prepend an Accessibility permission warning (from `mirroringService.permissionWarnings.accessibility`) via a local `actionContent()` helper when the permission is missing.
- `mirroring-control-tools.ts` — `get_clipboard`, `set_clipboard`. Depends on `MirroringService`.
- `coordinate-tools.ts` — `get_coordinates`. Converts grid labels (column/row) and percentage offsets to exact pixel coordinates for `tap`/`swipe`/`long_press`/`scroll`. `registerCoordinateTools` takes `{ server, getGridLayout }` where `getGridLayout` is a callback to `MirroringService.getGridLayout()` (returns computed `GridLayout` based on current window dimensions; throws if called before `start()`). Accepts `column`, `row`, `xPercent`, `yPercent` — percentage fields accept numbers or strings (trailing `%` stripped).
- `screenshot-after.ts` — shared `withScreenshotAfter()` helper and `screenshotDelaySchema`. Action tools use this to optionally return a screenshot after the action by accepting a `screenshotDelay` parameter.

When adding a new tool:

1. Add the handler in the appropriate `*-tools.ts` file (or create a new one)
2. If new file, import and call the register function in `server.ts`
3. Tool parameters use zod schemas — the MCP SDK validates inputs automatically
