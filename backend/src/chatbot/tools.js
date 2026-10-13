import { readFileSync } from 'fs';

/**
 * Tools the chatbot can call to look up HDB data.
 *
 * To add a tool: append an object with a name, description, input_schema
 * (JSON schema) and run(input) that returns something JSON-serialisable.
 *
 * TODO: add tools for the rest of CHATBOT_001, e.g.
 *   - get_block_details (price, lease, nearest schools / MRT / dengue)
 *   - compare_flats (alternative flow AF-C1)
 *   - get_price_statistics (by town / region / flat type)
 */

// Same file the frontend serves, so answers match what the map shows.
const hdbFlats = JSON.parse(
    readFileSync(new URL('../../../frontend/public/hdb.json', import.meta.url), 'utf8')
);

const tools = [
    {
        // Example tool - copy this shape for new tools.
        name: 'search_flats',
        description:
            'Search HDB resale transactions by town, flat type and maximum price. ' +
            'Returns the number of matches and a few of the cheapest.',
        input_schema: {
            type: 'object',
            properties: {
                town: { type: 'string', description: 'HDB town, e.g. "TAMPINES"' },
                flat_type: { type: 'string', description: 'e.g. "4 ROOM", "EXECUTIVE"' },
                max_price: { type: 'number', description: 'Maximum resale price in SGD' },
            },
        },
        run: ({ town, flat_type, max_price }) => {
            const matches = hdbFlats.filter((flat) =>
                (!town || flat.town === town.toUpperCase()) &&
                (!flat_type || flat.flat_type === flat_type.toUpperCase()) &&
                (!max_price || flat.resale_price <= max_price)
            );
            return {
                total_matches: matches.length,
                cheapest: [...matches]
                    .sort((a, b) => a.resale_price - b.resale_price)
                    .slice(0, 5)
                    .map(({ address, flat_type, month, resale_price, remaining_lease }) =>
                        ({ address, flat_type, month, resale_price, remaining_lease })),
            };
        },
    },
];

/** Tool definitions in the format the Claude API expects. */
export const toolDefinitions = tools.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
}));

/** Runs a tool call from the model and returns a tool_result block. */
export const runTool = (toolUse) => {
    const tool = tools.find((t) => t.name === toolUse.name);
    try {
        if (!tool) throw new Error(`Unknown tool: ${toolUse.name}`);
        return {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(tool.run(toolUse.input)),
        };
    } catch (error) {
        return { type: 'tool_result', tool_use_id: toolUse.id, content: error.message, is_error: true };
    }
};
