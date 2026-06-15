import fs from 'fs';
import path from 'path';

// Define directories
const STREAMS_DIR = path.resolve('iptv-master/streams');
const DATA_DIR = path.resolve('iptv-master/temp/data');
const OUTPUT_DIR = path.resolve('public');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'catalog.json');

// Interface declarations
interface ChannelMetadata {
  id: string;
  name: string;
  country: string;
  categories: string[];
  is_nsfw: boolean;
}

interface FeedMetadata {
  channel: string;
  languages?: string[];
}

interface LogoMetadata {
  channel: string;
  url: string;
}

interface CountryMetadata {
  name: string;
  code: string;
  languages?: string[];
  flag: string;
}

interface LanguageMetadata {
  code: string;
  name: string;
}

interface CategoryMetadata {
  id: string;
  name: string;
}

interface StreamData {
  url: string;
  quality: string;
  label: string;
  user_agent?: string;
  referrer?: string;
}

interface CatalogChannel {
  id: string;
  name: string;
  logo: string;
  categories: string[];
  countries: string[];
  languages: string[];
  streams: StreamData[];
}

interface Catalog {
  channels: CatalogChannel[];
  categories: Record<string, string>;
  countries: Record<string, { name: string; flag: string }>;
  languages: Record<string, string>;
}

// Simple regex parser helpers
function parseAttribute(line: string, attr: string): string {
  const match = line.match(new RegExp(`${attr}="([^"]*)"`));
  return match ? match[1] : '';
}

function parseName(name: string) {
  let title = name.trim();
  
  // Extract label e.g., [US]
  const labelMatch = title.match(/ \[(.*)\]$/);
  const label = labelMatch ? labelMatch[1] : '';
  if (labelMatch) {
    title = title.replace(/ \[[^\]]+\]$/, '');
  }

  // Extract quality e.g., (1080p)
  const qualityMatch = title.match(/ \(([0-9]+[p|i])\)$/);
  const quality = qualityMatch ? qualityMatch[1] : '';
  if (qualityMatch) {
    title = title.replace(/ \([^\)]+\)$/, '');
  }

  return { title: title.trim(), label, quality };
}

async function main() {
  console.log('--- Compiling IPTV Catalog (Fixed Resolution) ---');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Load Metadata
  console.log('Loading metadata from temp/data...');
  
  let channelsMetaList: ChannelMetadata[] = [];
  let feedsMetaList: FeedMetadata[] = [];
  let logosMetaList: LogoMetadata[] = [];
  let categoriesMetaList: CategoryMetadata[] = [];
  let countriesMetaList: CountryMetadata[] = [];
  let languagesMetaList: LanguageMetadata[] = [];

  try {
    channelsMetaList = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'channels.json'), 'utf8'));
    feedsMetaList = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'feeds.json'), 'utf8'));
    logosMetaList = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'logos.json'), 'utf8'));
    categoriesMetaList = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'categories.json'), 'utf8'));
    countriesMetaList = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'countries.json'), 'utf8'));
    languagesMetaList = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'languages.json'), 'utf8'));
  } catch (error) {
    console.error('Error loading metadata JSON files. Make sure metadata download has finished.', error);
    process.exit(1);
  }

  // Index metadata maps for fast lookup
  const channelsMap = new Map<string, ChannelMetadata>();
  for (const c of channelsMetaList) {
    channelsMap.set(c.id, c);
  }

  // Index feeds languages by channel ID
  const channelLanguagesMap = new Map<string, Set<string>>();
  for (const f of feedsMetaList) {
    if (!f.channel || !f.languages) continue;
    if (!channelLanguagesMap.has(f.channel)) {
      channelLanguagesMap.set(f.channel, new Set());
    }
    const set = channelLanguagesMap.get(f.channel)!;
    f.languages.forEach(l => set.add(l));
  }

  const logosMap = new Map<string, string>();
  for (const l of logosMetaList) {
    // Pick the first logo url for a channel
    if (!logosMap.has(l.channel)) {
      logosMap.set(l.channel, l.url);
    }
  }

  const categoriesMap = new Map<string, string>();
  for (const cat of categoriesMetaList) {
    categoriesMap.set(cat.id, cat.name);
  }

  const countriesMap = new Map<string, { name: string; flag: string; languages: string[] }>();
  for (const country of countriesMetaList) {
    countriesMap.set(country.code.toUpperCase(), { 
      name: country.name, 
      flag: country.flag,
      languages: country.languages || []
    });
  }

  const languagesMap = new Map<string, string>();
  for (const lang of languagesMetaList) {
    languagesMap.set(lang.code, lang.name);
  }

  // 2. Parse streams directory
  console.log('Parsing .m3u stream files...');
  if (!fs.existsSync(STREAMS_DIR)) {
    console.error(`Streams directory does not exist: ${STREAMS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(STREAMS_DIR).filter(file => file.endsWith('.m3u'));
  console.log(`Found ${files.length} playlist files.`);

  // We will group streams by channel ID
  const channelStreamsMap = new Map<string, {
    channelId: string;
    fallbackName: string;
    fallbackLogo: string;
    fallbackCategory: string;
    fallbackCountry: string;
    streams: StreamData[];
  }>();

  for (const file of files) {
    const filePath = path.join(STREAMS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    // Default country from file name (e.g. ar.m3u -> AR)
    const fileCountryCode = file.split('_')[0].split('.')[0].toUpperCase();

    let currentTvgId = '';
    let currentTvgLogo = '';
    let currentGroupTitle = '';
    let currentRawName = '';
    let currentUserAgent = '';
    let currentReferrer = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('#EXTINF:')) {
        currentTvgId = parseAttribute(trimmed, 'tvg-id');
        currentTvgLogo = parseAttribute(trimmed, 'tvg-logo');
        currentGroupTitle = parseAttribute(trimmed, 'group-title');
        
        const commaIdx = trimmed.lastIndexOf(',');
        currentRawName = commaIdx !== -1 ? trimmed.substring(commaIdx + 1).trim() : '';
        
        currentUserAgent = '';
        currentReferrer = '';
      } else if (trimmed.startsWith('#EXTVLCOPT:http-user-agent=')) {
        currentUserAgent = trimmed.replace('#EXTVLCOPT:http-user-agent=', '').trim();
      } else if (trimmed.startsWith('#EXTVLCOPT:http-referrer=')) {
        currentReferrer = trimmed.replace('#EXTVLCOPT:http-referrer=', '').trim();
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = trimmed;
        const { title, label, quality } = parseName(currentRawName || currentTvgId || 'Unknown Channel');
        
        // Split channel ID by @ to get the base ID matching the channel DB
        const baseId = currentTvgId ? currentTvgId.split('@')[0].trim() : '';
        const channelId = baseId || title.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (!channelId) continue;

        const streamEntry: StreamData = {
          url,
          quality: quality || 'SD',
          label: label || 'Default'
        };
        if (currentUserAgent) streamEntry.user_agent = currentUserAgent;
        if (currentReferrer) streamEntry.referrer = currentReferrer;

        if (!channelStreamsMap.has(channelId)) {
          channelStreamsMap.set(channelId, {
            channelId,
            fallbackName: title,
            fallbackLogo: currentTvgLogo,
            fallbackCategory: currentGroupTitle,
            fallbackCountry: fileCountryCode,
            streams: []
          });
        }
        
        // Prevent duplicate streams for same URL in same channel
        const existing = channelStreamsMap.get(channelId)!;
        if (!existing.streams.some(s => s.url === url)) {
          existing.streams.push(streamEntry);
        }
      }
    }
  }

  // 3. Merge streams with metadata and compile final list
  console.log('Merging streams with channels database...');
  const compiledChannels: CatalogChannel[] = [];
  const activeCategories = new Set<string>();
  const activeCountries = new Set<string>();
  const activeLanguages = new Set<string>();

  for (const [id, info] of channelStreamsMap.entries()) {
    const meta = channelsMap.get(id);
    
    // Skip NSFW content (we want SFW indexing by default as in indexGenerator)
    if (meta?.is_nsfw) continue;

    const name = meta ? meta.name : info.fallbackName;
    const logo = logosMap.get(id) || info.fallbackLogo || '';
    
    let categories = meta?.categories || [];
    if (categories.length === 0 && info.fallbackCategory) {
      // Slugify fallback category
      const catSlug = info.fallbackCategory.toLowerCase().trim();
      if (catSlug) categories = [catSlug];
    }
    // Clean categories
    categories = categories.map(c => c.toLowerCase()).filter(Boolean);

    let countries = meta?.country ? [meta.country.toUpperCase()] : [info.fallbackCountry];
    countries = countries.filter(Boolean);

    // Resolve languages (feeds -> fallback to country languages -> fallback to empty)
    let languages: string[] = [];
    const feedLanguages = channelLanguagesMap.get(id);
    if (feedLanguages && feedLanguages.size > 0) {
      languages = Array.from(feedLanguages);
    } else {
      // Fallback to the country languages
      const firstCountry = countries[0];
      if (firstCountry) {
        languages = countriesMap.get(firstCountry)?.languages || [];
      }
    }

    // Track active resources
    categories.forEach(c => activeCategories.add(c));
    countries.forEach(c => activeCountries.add(c));
    languages.forEach(l => activeLanguages.add(l));

    compiledChannels.push({
      id,
      name,
      logo,
      categories,
      countries,
      languages,
      streams: info.streams
    });
  }

  // 4. Build lookup maps for frontend
  const finalCategories: Record<string, string> = {};
  for (const catId of activeCategories) {
    finalCategories[catId] = categoriesMap.get(catId) || catId.charAt(0).toUpperCase() + catId.slice(1);
  }

  const finalCountries: Record<string, { name: string; flag: string }> = {};
  for (const countryCode of activeCountries) {
    const cMeta = countriesMap.get(countryCode);
    finalCountries[countryCode] = cMeta ? { name: cMeta.name, flag: cMeta.flag } : { name: countryCode, flag: '🏳️' };
  }

  const finalLanguages: Record<string, string> = {};
  for (const langCode of activeLanguages) {
    finalLanguages[langCode] = languagesMap.get(langCode) || langCode;
  }

  // Sort channels by name alphabetically
  compiledChannels.sort((a, b) => a.name.localeCompare(b.name));

  const catalog: Catalog = {
    channels: compiledChannels,
    categories: finalCategories,
    countries: finalCountries,
    languages: finalLanguages
  };

  console.log(`Writing catalog to ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2));
  console.log(`Successfully compiled catalog:`);
  console.log(`- Channels: ${compiledChannels.length}`);
  console.log(`- Categories: ${Object.keys(finalCategories).length}`);
  console.log(`- Countries: ${Object.keys(finalCountries).length}`);
  console.log(`- Languages: ${Object.keys(finalLanguages).length}`);
}

main();
