# mcp/ — MCP server and tool definitions

## server.ts

Creates an `McpServer` from `@modelcontextprotocol/sdk` with `StdioServerTransport`. Tool registration happens in the constructor — each tool file exports a `register*Tools()` function that takes the server and relevant service dependencies.

## tools/

Each file registers a group of related tools using `server.tool(name, description, zodSchema, handler)`. Tool handlers return `{ content: [...] }` where content is either `{ type: 'text', text }` or `{ type: 'image', data, mimeType }` (for screenshots).

Error responses set `isError: true` in the return value rather than throwing — this gives the MCP client a readable error message instead of a stack trace.

When adding a new tool:
1. Add the handler in the appropriate `*-tools.ts` file (or create a new one)
2. If new file, import and call the register function in `server.ts`
3. Tool parameters use zod schemas — the MCP SDK validates inputs automatically
