import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type MirroringService } from '@services/mirroring/mirroring.service';

import { screenshotDelaySchema, withScreenshotAfter } from './screenshot-after';

const pokemonSearchQuerySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[\x20-\x7e]+$/,
    'Use printable ASCII characters only. This keeps the helper from falling back to clipboard-based text entry.',
  );

export const registerPokemonGoTools = (
  server: McpServer,
  mirroringService: MirroringService,
): void => {
  server.registerTool(
    'pokemon_search',
    {
      description:
        'Replace the Pokémon GO Pokémon-storage search query with a filter string such as "cp1200-1500" or "0-1attack&3-4defense&3-4hp". This helper is deliberately limited to printable ASCII search text and automatically focuses the Pokémon-storage search field. ONLY use it after a fresh screenshot visibly confirms that Pokémon GO is on the Pokémon storage screen. Prefer this over repetitive swiping when narrowing the roster.',
      inputSchema: {
        query: pokemonSearchQuerySchema.describe(
          'Pokémon GO inventory search/filter query, maximum 100 printable ASCII characters.',
        ),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ query, screenshotDelay }) => {
      try {
        await mirroringService.pokemonSearch(query);
        return withScreenshotAfter(
          mirroringService,
          screenshotDelay,
          [{ type: 'text', text: `Applied Pokémon GO search filter: "${query}"` }],
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
};
