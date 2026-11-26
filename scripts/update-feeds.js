#!/usr/bin/env node
/*
 * Fetches RSS headlines (CBC + BBC) into news.json, a weather snapshot
 * (Open-Meteo) into weather.json and Environment Canada alerts into alerts.json.
 * Runs on GitHub Actions; Node 20+ built-ins only.
 *
 * - Keeps headline TEXT only (title, source, category, time, link). No descriptions,
 *   bodies or images are copied.
 * - If a feed fails, its previous headlines from the old news.json are kept.
 * - Files are only rewritten when their content actually changed.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NEWS_FILE = path.join(ROOT, 'news.json');
const WEATHER_FILE = path.join(ROOT, 'weather.json');
const ALERTS_FILE = path.join(ROOT, 'alerts.json');
const PER_FEED = 10;

const FEEDS = [
  { id: 'cbc-top',  source: 'CBC', cat: 'TOP',  url: 'https://www.cbc.ca/webfeed/rss/rss-topstories' },
  { id: 'bbc-top',  source: 'BBC', cat: 'TOP',  url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { id: 'cbc-tech', source: 'CBC', cat: 'TECH', url: 'https://www.cbc.ca/webfeed/rss/rss-technology' },
  { id: 'bbc-tech', source: 'BBC', cat: 'TECH', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' }
];

// CBC refuses requests that do not look like a browser.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5'
};

async function get(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 20000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally { clearTimeout(t); }
}

function decode(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? decode(m[1]) : '';
}

function parseRss(xml, feed) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const title = tag(b, 'title');
    if (!title) continue;
    const d = new Date(tag(b, 'pubDate') || tag(b, 'dc:date'));
    items.push({
      source: feed.source,
      cat: feed.cat,
      title: title.slice(0, 220),
      time: isNaN(d) ? null : d.toISOString(),
      link: tag(b, 'link').split('?')[0] || ''
    });
  }
  items.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  return items.slice(0, PER_FEED);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '');

async function updateNews() {
  const prev = readJson(NEWS_FILE);
  const prevItems = (prev && Array.isArray(prev.items)) ? prev.items : [];
  const lists = [];
  let okCount = 0;

  for (const feed of FEEDS) {
    try {
      const items = parseRss(await get(feed.url), feed);
      if (!items.length) throw new Error('no items');
      lists.push(items); okCount++;
      console.log(`ok   ${feed.id}: ${items.length} headlines`);
    } catch (e) {
      const kept = prevItems.filter((i) => i.source === feed.source && i.cat === feed.cat);
      lists.push(kept);
      console.warn(`FAIL ${feed.id}: ${e.message} (kept ${kept.length} previous)`);
    }
  }
  if (!okCount) { console.warn('All feeds failed; news.json left unchanged.'); return; }

  // Interleave sources round-robin, drop duplicates (same title or same link).
  const out = [], seen = new Set();
  for (let i = 0; i < PER_FEED; i++) {
    for (const list of lists) {
      const it = list[i];
      if (!it) continue;
      const k1 = 't:' + norm(it.title), k2 = it.link ? 'l:' + it.link : null;
      if (seen.has(k1) || (k2 && seen.has(k2))) continue;
      seen.add(k1); if (k2) seen.add(k2);
      out.push({ source: it.source, cat: it.cat, title: it.title, time: it.time, link: it.link });
    }
  }

  if (JSON.stringify(out) === JSON.stringify(prevItems)) { console.log('news: no change'); return; }
  fs.writeFileSync(NEWS_FILE, JSON.stringify({ updated: new Date().toISOString(), items: out }, null, 1) + '\n');
  console.log(`news: wrote ${out.length} headlines`);
}

// Read latitude/longitude/timezone straight from CONFIG in index.html (single source of truth).
function readConfig() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const num = (k) => { const m = html.match(new RegExp('\\b' + k + ':\\s*(-?\\d+(?:\\.\\d+)?)')); return m ? +m[1] : null; };
  const tz = (html.match(/\btimezone:\s*"([^"]+)"/) || [])[1] || 'America/Toronto';
  return { lat: num('latitude'), lon: num('longitude'), tz };
}

async function updateWeather() {
  const c = readConfig();
  if (c.lat === null || c.lon === null) { console.warn('weather: no coordinates in index.html'); return; }
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.lat.toFixed(2) + '&longitude=' + c.lon.toFixed(2) +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max' +
    '&minutely_15=precipitation,rain,snowfall&forecast_minutely_15=48' +
    '&hourly=precipitation,snowfall&forecast_hours=12' +
    '&timezone=' + encodeURIComponent(c.tz) + '&forecast_days=7';
  try {
    const data = JSON.parse(await get(url));
    if (!data.current || !data.daily) throw new Error('unexpected response');
    fs.writeFileSync(WEATHER_FILE, JSON.stringify({ updated: new Date().toISOString(), data }) + '\n');
    console.log('weather: updated');
  } catch (e) {
    console.warn('weather: FAIL ' + e.message + ' (kept previous file)');
  }
}

// Environment Canada alerts for the forecast region containing CONFIG's coordinates.
// Keeps only the alert name, type, colour, first sentence and times (no full bulletin text).
async function updateAlerts() {
  const c = readConfig();
  if (c.lat === null || c.lon === null) return;
  const d = 0.01;
  const url = 'https://api.weather.gc.ca/collections/weather-alerts/items?f=json&lang=en&limit=50&bbox=' +
    [c.lon - d, c.lat - d, c.lon + d, c.lat + d].map((n) => n.toFixed(3)).join(',');
  try {
    const j = JSON.parse(await get(url));
    if (!Array.isArray(j.features)) throw new Error('unexpected response');
    const now = Date.now(), seen = new Set(), alerts = [];
    for (const f of j.features) {
      const p = f.properties || {};
      if (/ended|cancel/i.test(p.status_en || '')) continue;
      if (p.expiration_datetime && Date.parse(p.expiration_datetime) < now) continue;
      const key = p.alert_code + '|' + p.alert_type;
      if (seen.has(key)) continue;
      seen.add(key);
      const text = String(p.alert_text_en || '').trim();
      alerts.push({
        type: p.alert_type || 'statement',               // warning | watch | advisory | statement
        name: p.alert_name_en || p.alert_short_name_en || 'Weather alert',
        headline: (text.split(/\n|(?<=\.)\s/)[0] || '').slice(0, 160),
        colour: p.risk_colour_en || null,
        region: p.feature_name_en || '',
        until: p.event_end_datetime || p.expiration_datetime || null
      });
    }
    const rank = { warning: 0, watch: 1, advisory: 2, statement: 3 };
    alerts.sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9));
    const prev = readJson(ALERTS_FILE);
    if (prev && JSON.stringify(prev.alerts) === JSON.stringify(alerts)) { console.log('alerts: no change'); return; }
    fs.writeFileSync(ALERTS_FILE, JSON.stringify({ updated: new Date().toISOString(), alerts }, null, 1) + '\n');
    console.log(`alerts: wrote ${alerts.length}`);
  } catch (e) {
    console.warn('alerts: FAIL ' + e.message + ' (kept previous file)');
  }
}

(async () => {
  await updateNews();
  await updateWeather();
  await updateAlerts();
})().catch((e) => { console.error(e); process.exitCode = 0; });
