# mcp/ — MCP server and tool definitions

## server.ts

Creates an `McpServer` from `@modelcontextprotocol/sdk` with `StdioServerTransport`. Tool registration happens in the constructor — each tool file exports a `register*Tools()` function that takes the server and relevant service dependencies.

Dependencies: `DeviceService`, `MirroringService`.

## tools/

Each file registers a group of related tools using `server.tool(name, description, zodSchema, handler)`. Tool handlers return `{ content: [...] }` where content is either `{ type: 'text', text }` or `{ type: 'image', data, mimeType }` (for screenshots).

Error responses set `isError: true` in the return value rather than throwing — this gives the MCP client a readable error message instead of a stack trace.

Files:

- `device-tools.ts` — `list_devices`, `device_info`, `get_screen_info`
- `screenshot-tools.ts` — `screenshot`
- `automation-tools.ts` — `tap`, `long_press`, `swipe`, `type_text`, `press_button`
- `mirroring-control-tools.ts` — `get_clipboard`, `set_clipboard`, `get_battery_info`

When adding a new tool:

1. Add the handler in the appropriate `*-tools.ts` file (or create a new one)
2. If new file, import and call the register function in `server.ts`
3. Tool parameters use zod schemas — the MCP SDK validates inputs automatically
