import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Loads the static datasets that the frontend already serves (HDB resale
 * records, schools, MRT exits, dengue clusters) and indexes them once at
 * startup so the chatbot tools can query them quickly.
 *
 * The files are read from the frontend folder so the chatbot always answers
 * from exactly the same data the user sees on the map.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(here, '../../../frontend');

const readJson = (relativePath) =>
    JSON.parse(readFileSync(path.join(FRONTEND_DIR, relativePath), 'utf8'));

/** Same approximation as Hdb.getDistanceFromHDBinKM() on the frontend. */
const KM_PER_DEGREE = 111;

export const distanceKm = (a, b) => {
    const dx = a.longitude - b.longitude;
    const dy = a.latitude - b.latitude;
    return Math.sqrt(dx * dx + dy * dy) * KM_PER_DEGREE;
};

/** "61 years 04 months" -> 61.33 */
const parseLeaseYears = (lease) => {
    const years = Number(/(\d+)\s*year/.exec(lease)?.[1] ?? 0);
    const months = Number(/(\d+)\s*month/.exec(lease)?.[1] ?? 0);
    return Math.round((years + months / 12) * 100) / 100;
};

/**
 * HDB street names use fixed abbreviations ("AVE", "ST", "BT" ...). Users
 * type the long forms, so both sides are normalised before matching.
 */
const ABBREVIATIONS = {
    AVENUE: 'AVE', STREET: 'ST', ROAD: 'RD', DRIVE: 'DR', CRESCENT: 'CRES',
    CLOSE: 'CL', CENTRAL: 'CTRL', NORTH: 'NTH', SOUTH: 'STH', UPPER: 'UPP',
    LORONG: 'LOR', JALAN: 'JLN', BUKIT: 'BT', KAMPONG: 'KG', TANJONG: 'TG',
    PLACE: 'PL', TERRACE: 'TER', HEIGHTS: 'HTS', PARK: 'PK', GARDENS: 'GDNS',
    SQUARE: 'SQ', COMMONWEALTH: "C'WEALTH", MARKET: 'MKT', LINK: 'LK',
};

export const normaliseAddress = (text) =>
    String(text)
        .toUpperCase()
        .replace(/[.,#]/g, ' ')
        .replace(/\b(BLK|BLOCK)\b/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ABBREVIATIONS[word] ?? word)
        .join(' ');

const median = (sorted) => {
    if (sorted.length === 0) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const quantile = (sorted, q) => {
    if (sorted.length === 0) return null;
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

/** Summary statistics for a list of numbers, rounded for display. */
export const summarise = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    return {
        min: sorted[0],
        p25: quantile(sorted, 0.25),
        median: median(sorted),
        p75: quantile(sorted, 0.75),
        max: sorted[sorted.length - 1],
        mean: Math.round(mean),
    };
};

const loadDatasets = () => {
    const townToRegion = readJson('src/TownToRegion.json');
    const currentYear = new Date().getFullYear();

    const flats = readJson('public/hdb.json').map((item, index) => {
        const leaseCommence = Number(item.lease_commence_date);
        return {
            id: index,
            month: item.month,
            town: item.town,
            // A few towns are missing from TownToRegion.json; the app's region
            // filter never matches them either.
            region: townToRegion[item.town.toUpperCase()] ?? 'Not mapped in app',
            flat_type: item.flat_type,
            block: item.block,
            street_name: item.street_name,
            address: item.address,
            storey_range: item.storey_range,
            floor_area_sqm: Number(item.floor_area_sqm),
            flat_model: item.flat_model,
            lease_commence_year: leaseCommence,
            remaining_lease_at_sale: item.remaining_lease,
            remaining_lease_at_sale_years: parseLeaseYears(item.remaining_lease),
            est_remaining_lease_now_years: Math.max(0, 99 - (currentYear - leaseCommence)),
            resale_price: Number(item.resale_price),
            latitude: Number(item.latitude),
            longitude: Number(item.longitude),
        };
    });

    const flatsByAddress = new Map();
    for (const flat of flats) {
        const key = normaliseAddress(flat.address);
        if (!flatsByAddress.has(key)) flatsByAddress.set(key, []);
        flatsByAddress.get(key).push(flat);
    }

    const schools = readJson('public/schools.json').map((item) => ({
        name: item.school_name,
        level: item.mainlevel_code,
        address: item.address?.replace(/\s+/g, ' ').trim(),
        nearest_mrt: item.mrt_desc,
        website: item.url_address,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
    }));

    // The LTA file lists every station exit; keep one point per exit but
    // report distances per station.
    const mrtExits = readJson('public/LTAMRTStationExitUpdated.json').features.map((feature) => ({
        name: feature.properties.Name,
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
    }));

    const dengueClusters = readJson('public/dengue.json').map((item) => ({
        locality: item.properties.LOCALITY?.trim(),
        case_size: item.properties.CASE_SIZE,
        updated: String(item.properties.FMEL_UPD_D ?? ''),
        latitude: item.latitude,
        longitude: item.longitude,
    }));
    // FMEL_UPD_D looks like "20250317160506"
    const dengueSnapshot =
        dengueClusters
            .map((cluster) => cluster.updated)
            .sort()
            .at(-1)
            ?.replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3') ?? null;

    const months = flats.map((f) => f.month).sort();
    const towns = [...new Set(flats.map((f) => f.town))].sort();

    return {
        flats,
        flatsByAddress,
        schools,
        mrtExits,
        dengueClusters,
        townToRegion,
        towns,
        meta: {
            firstMonth: months[0],
            lastMonth: months.at(-1),
            flatCount: flats.length,
            blockCount: flatsByAddress.size,
            dengueSnapshot,
        },
    };
};

let datasets = null;

/** Lazily loads and caches the datasets (hdb.json is ~70MB). */
export const getData = () => {
    if (!datasets) {
        const started = Date.now();
        datasets = loadDatasets();
        console.log(
            `[chatbot] loaded ${datasets.meta.flatCount} resale records ` +
            `(${datasets.meta.blockCount} blocks) in ${Date.now() - started}ms`
        );
    }
    return datasets;
};

/** Nearest MRT stations (deduplicated by station, using the closest exit). */
export const nearestMrtStations = (point, n) => {
    const best = new Map();
    for (const exit of getData().mrtExits) {
        const km = distanceKm(point, exit);
        if (!best.has(exit.name) || km < best.get(exit.name)) best.set(exit.name, km);
    }
    return [...best.entries()]
        .sort((a, b) => a[1] - b[1])
        .slice(0, n)
        .map(([name, km]) => ({ name, distance_km: round2(km) }));
};

export const nearestSchools = (point, n, level) =>
    getData()
        .schools.filter((school) => !level || school.level === level)
        .map((school) => ({ school, km: distanceKm(point, school) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, n)
        .map(({ school, km }) => ({
            name: school.name,
            level: school.level,
            address: school.address,
            distance_km: round2(km),
        }));

export const nearestDengueClusters = (point, n) =>
    getData()
        .dengueClusters.map((cluster) => ({ cluster, km: distanceKm(point, cluster) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, n)
        .map(({ cluster, km }) => ({
            locality: cluster.locality,
            case_size: cluster.case_size,
            distance_km: round2(km),
        }));

export const round2 = (x) => Math.round(x * 100) / 100;
