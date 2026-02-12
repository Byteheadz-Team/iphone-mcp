# mcp/ — MCP server and tool definitions

## server.ts

Creates an `McpServer` from `@modelcontextprotocol/sdk` with `StdioServerTransport`. Tool registration happens in the constructor — each tool file exports a `register*Tools()` function that takes the server and relevant service dependencies.

Dependencies: `MirroringService`.

## tools/

Each file registers a group of related tools using `server.registerTool(name, config, handler)` where config is `{ description, inputSchema?, annotations? }` and `inputSchema` is a record of parameter names to zod schemas (e.g. `{ x: z.number(), y: z.number() }`). Tool handlers return `{ content: [...] }` where content is either `{ type: 'text', text }` or `{ type: 'image', data, mimeType }` (for screenshots). All tools set `annotations` with `readOnlyHint` (for query tools) or `destructiveHint: false` (for UI actions) and `openWorldHint: false`.

All tool handlers wrap their logic in `try/catch` and return `{ content: [{ type: 'text', text: 'Error: ...' }], isError: true }` on failure — this gives the MCP client a readable error message instead of a stack trace.

Files:

- `screenshot-tools.ts` — `screenshot`, `get_screen_info`. Depends on `MirroringService`. The `screenshot` tool prepends a Screen Recording permission warning (from `mirroringService.permissionWarnings.screenRecording`) as a text content block before the image when the permission is missing.
- `automation-tools.ts` — `tap`, `long_press`, `swipe`, `type_text`, `press_button`. `press_button` accepts `"home"`, `"app_switcher"`, and `"spotlight"`. All automation tools prepend an Accessibility permission warning (from `mirroringService.permissionWarnings.accessibility`) via a local `actionContent()` helper when the permission is missing.
- `mirroring-control-tools.ts` — `get_clipboard`, `set_clipboard`. Depends on `MirroringService`.
- `math-tools.ts` — `calculate`. Safe expression evaluator (recursive descent parser, no `eval`). Supports `+`, `-`, `*`, `/`, `%`, parentheses, and functions (`round`, `floor`, `ceil`, `abs`, `sqrt`, `pow`, `min`, `max`). No service dependencies. For general arithmetic only — coordinate math should use `get_coordinates` instead.
- `coordinate-tools.ts` — `get_coordinates`. Converts grid labels (column/row) and percentage offsets to exact pixel coordinates for `tap`/`swipe`/`long_press`. `registerCoordinateTools` takes `{ server, getGridLayout }` where `getGridLayout` is a callback to `MirroringService.getGridLayout()` (returns computed `GridLayout` based on current window dimensions, or a reference fallback before start). Accepts `column`, `row`, `xPercent`, `yPercent` — percentage fields accept numbers or strings (trailing `%` stripped).
- `screenshot-after.ts` — shared `withScreenshotAfter()` helper and `screenshotDelaySchema`. Action tools use this to optionally return a screenshot after the action by accepting a `screenshotDelay` parameter.

When adding a new tool:

1. Add the handler in the appropriate `*-tools.ts` file (or create a new one)
2. If new file, import and call the register function in `server.ts`
3. Tool parameters use zod schemas — the MCP SDK validates inputs automatically
