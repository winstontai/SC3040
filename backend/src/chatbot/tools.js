import { z } from 'zod';
import {
    getData,
    distanceKm,
    normaliseAddress,
    summarise,
    nearestMrtStations,
    nearestSchools,
    nearestDengueClusters,
    round2,
} from './data.js';

/**
 * Tools the chatbot can call to look up HDB data. Each tool has a zod schema
 * (used both to generate the JSON schema sent to the LLM and to validate the
 * input before running) and a run() function that returns
 * { result, locations }. `locations` are blocks the frontend can offer as
 * "show on map" shortcuts.
 */

const REGIONS = ['Central', 'East', 'North', 'North-East', 'West'];
const FLAT_TYPES = ['1 ROOM', '2 ROOM', '3 ROOM', '4 ROOM', '5 ROOM', 'EXECUTIVE', 'MULTI-GENERATION'];
const MONTH = z.string().regex(/^\d{4}-\d{2}$/, 'Use the format YYYY-MM');

class ToolInputError extends Error {}

const flatFilterFields = {
    town: z.string().optional().describe('HDB town, e.g. "TAMPINES" or "ANG MO KIO"'),
    region: z.enum(REGIONS).optional(),
    flat_type: z.enum(FLAT_TYPES).optional(),
    min_price: z.number().nonnegative().optional().describe('Minimum resale price in SGD'),
    max_price: z.number().positive().optional().describe('Maximum resale price in SGD'),
    min_remaining_lease_years: z.number().min(0).max(99).optional()
        .describe('Minimum remaining lease recorded at the time of sale (this is what the app filter uses)'),
    max_remaining_lease_years: z.number().min(0).max(99).optional(),
    since_month: MONTH.optional().describe('Only include sales from this month onwards, YYYY-MM'),
    until_month: MONTH.optional().describe('Only include sales up to this month, YYYY-MM'),
};

const resolveTown = (town) => {
    const wanted = town.trim().toUpperCase();
    const { towns } = getData();
    const match = towns.find((t) => t === wanted) ?? towns.find((t) => t.includes(wanted));
    if (!match) {
        throw new ToolInputError(`Unknown town "${town}". Valid towns: ${towns.join(', ')}`);
    }
    return match;
};

const applyFlatFilters = (flats, filters) => {
    const town = filters.town ? resolveTown(filters.town) : null;
    return flats.filter((f) =>
        (!town || f.town === town) &&
        (!filters.region || f.region === filters.region) &&
        (!filters.flat_type || f.flat_type === filters.flat_type) &&
        (filters.min_price === undefined || f.resale_price >= filters.min_price) &&
        (filters.max_price === undefined || f.resale_price <= filters.max_price) &&
        (filters.min_remaining_lease_years === undefined ||
            f.remaining_lease_at_sale_years >= filters.min_remaining_lease_years) &&
        (filters.max_remaining_lease_years === undefined ||
            f.remaining_lease_at_sale_years <= filters.max_remaining_lease_years) &&
        (!filters.since_month || f.month >= filters.since_month) &&
        (!filters.until_month || f.month <= filters.until_month)
    );
};

/** Compact view of one resale transaction. */
const describeSale = (f) => ({
    address: f.address,
    town: f.town,
    region: f.region,
    flat_type: f.flat_type,
    storey_range: f.storey_range,
    floor_area_sqm: f.floor_area_sqm,
    flat_model: f.flat_model,
    month_sold: f.month,
    resale_price: f.resale_price,
    remaining_lease_at_sale: f.remaining_lease_at_sale,
    lease_commence_year: f.lease_commence_year,
    est_remaining_lease_now_years: f.est_remaining_lease_now_years,
});

const toLocation = (f) => ({
    address: f.address,
    town: f.town,
    latitude: f.latitude,
    longitude: f.longitude,
});

const SORTERS = {
    price_asc: (a, b) => a.resale_price - b.resale_price,
    price_desc: (a, b) => b.resale_price - a.resale_price,
    lease_desc: (a, b) => b.remaining_lease_at_sale_years - a.remaining_lease_at_sale_years,
    most_recent: (a, b) => b.month.localeCompare(a.month),
    area_desc: (a, b) => b.floor_area_sqm - a.floor_area_sqm,
};

/**
 * Finds the block matching a free-text address. Returns { flats } on a
 * confident match or { candidates } when the address is ambiguous.
 */
const findBlock = (address) => {
    const { flatsByAddress } = getData();
    const wanted = normaliseAddress(address);
    if (flatsByAddress.has(wanted)) return { flats: flatsByAddress.get(wanted) };

    const wantedTokens = wanted.split(' ');
    const blockNumber = wantedTokens.find((t) => /^\d+[A-Z]?$/.test(t));
    const scored = [];
    for (const [key, flats] of flatsByAddress) {
        const tokens = key.split(' ');
        if (blockNumber && tokens[0] !== blockNumber) continue;
        const overlap = wantedTokens.filter((t) => tokens.includes(t)).length;
        const score = overlap / Math.max(wantedTokens.length, tokens.length);
        if (score > 0.4) scored.push({ key, flats, score });
    }
    scored.sort((a, b) => b.score - a.score);
    if (scored.length === 1 || (scored.length > 1 && scored[0].score - scored[1].score >= 0.2)) {
        return { flats: scored[0].flats };
    }
    return { candidates: scored.slice(0, 6).map((s) => s.flats[0].address) };
};

/** Everything the app knows about one block, optionally for one flat type. */
const describeBlock = (flats, flatType, recentCount) => {
    const first = flats[0];
    const relevant = flatType ? flats.filter((f) => f.flat_type === flatType) : flats;

    const byType = {};
    for (const f of flats) (byType[f.flat_type] ??= []).push(f);
    const flatTypes = Object.fromEntries(
        Object.entries(byType).map(([type, sales]) => {
            const latest = [...sales].sort(SORTERS.most_recent)[0];
            return [type, {
                sales_recorded: sales.length,
                median_price: summarise(sales.map((s) => s.resale_price)).median,
                latest_price: latest.resale_price,
                latest_month: latest.month,
                floor_area_sqm: [...new Set(sales.map((s) => s.floor_area_sqm))].sort((a, b) => a - b),
            }];
        })
    );

    return {
        address: first.address,
        town: first.town,
        region: first.region,
        lease_commence_year: first.lease_commence_year,
        est_remaining_lease_now_years: first.est_remaining_lease_now_years,
        flat_types: flatTypes,
        requested_flat_type_found: flatType ? relevant.length > 0 : undefined,
        recent_sales: [...relevant]
            .sort(SORTERS.most_recent)
            .slice(0, recentCount)
            .map(describeSale),
        nearby: {
            primary_schools: nearestSchools(first, 3, 'PRIMARY'),
            mrt_stations: nearestMrtStations(first, 2),
            dengue_clusters: nearestDengueClusters(first, 2),
        },
    };
};

const MRT_WORDS = /\b(MRT|LRT|STATION|STN)\b/g;

/** Resolves an MRT station or school name to coordinates. */
const findPlace = (place) => {
    const { mrtExits, schools } = getData();
    const wanted = normaliseAddress(place).replace(MRT_WORDS, '').replace(/\s+/g, ' ').trim();
    if (!wanted) return { candidates: [] };

    const stations = new Map();
    for (const exit of mrtExits) {
        const name = normaliseAddress(exit.name).replace(MRT_WORDS, '').replace(/\s+/g, ' ').trim();
        if (name === wanted || name.includes(wanted)) {
            if (!stations.has(exit.name)) stations.set(exit.name, { exact: name === wanted, exits: [] });
            stations.get(exit.name).exits.push(exit);
        }
    }
    const stationMatches = [...stations.entries()].map(([name, { exact, exits }]) => ({
        name,
        type: 'MRT/LRT station',
        exact,
        latitude: exits.reduce((s, e) => s + e.latitude, 0) / exits.length,
        longitude: exits.reduce((s, e) => s + e.longitude, 0) / exits.length,
    }));
    const schoolMatches = schools
        .filter((s) => normaliseAddress(s.name).includes(wanted))
        .map((s) => ({
            name: s.name,
            type: `${s.level.toLowerCase()} school`,
            exact: normaliseAddress(s.name) === wanted,
            latitude: s.latitude,
            longitude: s.longitude,
        }));

    const all = [...stationMatches, ...schoolMatches];
    const exact = all.filter((p) => p.exact);
    if (exact.length === 1) return { place: exact[0] };
    if (all.length === 1) return { place: all[0] };
    return { candidates: all.slice(0, 8).map((p) => `${p.name} (${p.type})`) };
};

const tools = [
    {
        name: 'search_flats',
        description:
            'Search HDB resale transactions using the same criteria as the app filters (town, region, ' +
            'flat type, price range, remaining lease) and return the total match count, price summary ' +
            'and a sorted sample of matching sales. Use this for questions like "cheapest 4-room flats ' +
            'in Tampines" or "what can I get under $500k with at least 70 years lease".',
        schema: z.object({
            ...flatFilterFields,
            street_contains: z.string().optional().describe('Text the street name must contain, e.g. "AVE 10"'),
            sort_by: z.enum(Object.keys(SORTERS)).optional().describe('Defaults to most_recent'),
            limit: z.number().int().min(1).max(15).optional().describe('Number of sales to return, default 8'),
        }),
        run: (input) => {
            let matches = applyFlatFilters(getData().flats, input);
            if (input.street_contains) {
                const street = normaliseAddress(input.street_contains);
                matches = matches.filter((f) => normaliseAddress(f.street_name).includes(street));
            }
            const sample = [...matches]
                .sort(SORTERS[input.sort_by ?? 'most_recent'])
                .slice(0, input.limit ?? 8);
            return {
                result: {
                    total_matching_sales: matches.length,
                    distinct_blocks: new Set(matches.map((f) => f.address)).size,
                    price_summary_sgd: summarise(matches.map((f) => f.resale_price)),
                    sales: sample.map(describeSale),
                },
                locations: sample.map(toLocation),
            };
        },
    },
    {
        name: 'get_price_statistics',
        description:
            'Aggregate resale price statistics (count, min, quartiles, median, max, median price per sqm, ' +
            'median remaining lease at sale) grouped by town, region, flat type or year of sale. Use this ' +
            'for "which town is cheapest", "how have 5-room prices changed", or regional comparisons.',
        schema: z.object({
            group_by: z.enum(['town', 'region', 'flat_type', 'year']),
            ...flatFilterFields,
        }),
        run: (input) => {
            const matches = applyFlatFilters(getData().flats, input);
            const keyOf = {
                town: (f) => f.town,
                region: (f) => f.region,
                flat_type: (f) => f.flat_type,
                year: (f) => f.month.slice(0, 4),
            }[input.group_by];

            const groups = {};
            for (const f of matches) (groups[keyOf(f)] ??= []).push(f);
            const rows = Object.entries(groups).map(([group, sales]) => ({
                [input.group_by]: group,
                sales: sales.length,
                price_sgd: summarise(sales.map((s) => s.resale_price)),
                median_price_per_sqm: Math.round(
                    summarise(sales.map((s) => s.resale_price / s.floor_area_sqm)).median
                ),
                median_remaining_lease_at_sale_years:
                    round2(summarise(sales.map((s) => s.remaining_lease_at_sale_years)).median),
            }));
            rows.sort(input.group_by === 'year'
                ? (a, b) => a.year.localeCompare(b.year)
                : (a, b) => b.price_sgd.median - a.price_sgd.median);
            return { result: { total_matching_sales: matches.length, groups: rows }, locations: [] };
        },
    },
    {
        name: 'get_block_details',
        description:
            'Full details for one HDB block by address (e.g. "406 Ang Mo Kio Ave 10"): town, region, lease ' +
            'commencement, estimated remaining lease today, prices per flat type, recent sales, and the ' +
            'nearest primary schools, MRT stations and dengue clusters with straight-line distances. ' +
            'If the address is ambiguous, returns candidate addresses to choose from.',
        schema: z.object({
            address: z.string().min(3).describe('Block number and street name'),
            flat_type: z.enum(FLAT_TYPES).optional().describe('Focus recent sales on this flat type'),
        }),
        run: (input) => {
            const match = findBlock(input.address);
            if (!match.flats) {
                return {
                    result: {
                        found: false,
                        message: match.candidates.length
                            ? 'Address is ambiguous; ask the user which one they mean.'
                            : 'No HDB resale records found for this address.',
                        candidates: match.candidates,
                    },
                    locations: [],
                };
            }
            return {
                result: { found: true, ...describeBlock(match.flats, input.flat_type, 6) },
                locations: [toLocation(match.flats[0])],
            };
        },
    },
    {
        name: 'compare_blocks',
        description:
            'Side-by-side comparison of 2 to 4 HDB blocks by address: prices per flat type, lease, ' +
            'recent sales and nearby amenities (schools, MRT, dengue clusters).',
        schema: z.object({
            addresses: z.array(z.string().min(3)).min(2).max(4),
            flat_type: z.enum(FLAT_TYPES).optional(),
        }),
        run: (input) => {
            const matches = input.addresses.map((address) => ({ address, ...findBlock(address) }));
            const blocks = matches.map((match) => match.flats
                ? { query: match.address, found: true, ...describeBlock(match.flats, input.flat_type, 3) }
                : { query: match.address, found: false, candidates: match.candidates });
            const locations = matches.filter((m) => m.flats).map((m) => toLocation(m.flats[0]));
            return { result: { blocks }, locations };
        },
    },
    {
        name: 'find_flats_near_place',
        description:
            'Find HDB blocks within a radius of an MRT/LRT station or a school (e.g. "Tampines MRT", ' +
            '"Nanyang Primary"), with prices for the matching resale sales at each block, nearest first.',
        schema: z.object({
            place: z.string().min(2).describe('MRT/LRT station name or school name'),
            radius_km: z.number().min(0.1).max(3).optional().describe('Straight-line radius, default 1 km'),
            flat_type: z.enum(FLAT_TYPES).optional(),
            max_price: z.number().positive().optional(),
            min_remaining_lease_years: z.number().min(0).max(99).optional(),
            since_month: MONTH.optional(),
            limit: z.number().int().min(1).max(15).optional().describe('Number of blocks to return, default 8'),
        }),
        run: (input) => {
            const found = findPlace(input.place);
            if (!found.place) {
                return {
                    result: {
                        found: false,
                        message: found.candidates.length
                            ? 'Several places match; ask the user which one they mean.'
                            : 'No MRT station or school with that name in the app data.',
                        candidates: found.candidates,
                    },
                    locations: [],
                };
            }
            const { place } = found;
            const radius = input.radius_km ?? 1;
            const matches = applyFlatFilters(getData().flats, input)
                .filter((f) => distanceKm(place, f) <= radius);

            const byBlock = new Map();
            for (const f of matches) {
                if (!byBlock.has(f.address)) byBlock.set(f.address, []);
                byBlock.get(f.address).push(f);
            }
            const blocks = [...byBlock.values()]
                .map((sales) => {
                    const latest = [...sales].sort(SORTERS.most_recent)[0];
                    return {
                        address: latest.address,
                        town: latest.town,
                        distance_km: round2(distanceKm(place, latest)),
                        matching_sales: sales.length,
                        median_price: summarise(sales.map((s) => s.resale_price)).median,
                        latest_price: latest.resale_price,
                        latest_month: latest.month,
                        flat_types: [...new Set(sales.map((s) => s.flat_type))],
                        est_remaining_lease_now_years: latest.est_remaining_lease_now_years,
                        _flat: latest,
                    };
                })
                .sort((a, b) => a.distance_km - b.distance_km)
                .slice(0, input.limit ?? 8);

            return {
                result: {
                    found: true,
                    place: { name: place.name, type: place.type },
                    radius_km: radius,
                    blocks_in_radius: byBlock.size,
                    blocks: blocks.map(({ _flat, ...rest }) => rest),
                },
                locations: blocks.map((b) => toLocation(b._flat)),
            };
        },
    },
];

/** Tool definitions in the format the OpenAI Responses API expects. */
export const toolDefinitions = tools.map(({ name, description, schema }) => {
    const { $schema, ...parameters } = z.toJSONSchema(schema);
    // strict mode would require every field; optional filters are validated in runTool().
    return { type: 'function', name, description, parameters, strict: false };
});

/**
 * Parses, validates and executes a tool call from the model.
 *
 * @param {string} name - tool name
 * @param {string} args - the call's arguments as a JSON string
 * @return {{ output: string, locations: object[] }} output is sent back to the model
 */
export const runTool = (name, args) => {
    const fail = (message) => ({ output: `Error: ${message}`, locations: [] });

    const tool = tools.find((t) => t.name === name);
    if (!tool) return fail(`Unknown tool: ${name}`);

    let input;
    try {
        input = JSON.parse(args || '{}');
    } catch {
        return fail('Arguments were not valid JSON.');
    }
    const parsed = tool.schema.safeParse(input);
    if (!parsed.success) return fail(`Invalid input: ${z.prettifyError(parsed.error)}`);

    try {
        const { result, locations } = tool.run(parsed.data);
        return { output: JSON.stringify(result), locations };
    } catch (error) {
        if (error instanceof ToolInputError) return fail(error.message);
        throw error;
    }
};

/** Short user-facing description of what a tool call is doing. */
export const describeToolCall = (name) => ({
    search_flats: 'Searching resale records…',
    get_price_statistics: 'Crunching price statistics…',
    get_block_details: 'Looking up the block and nearby amenities…',
    compare_blocks: 'Comparing flats…',
    find_flats_near_place: 'Finding flats nearby…',
}[name] ?? 'Looking up HDB data…');
