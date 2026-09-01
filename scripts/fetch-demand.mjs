import fs from 'node:fs/promises';

const API = process.env.DEMAND_API_URL || 'https://api.stackexchange.com/2.3/questions?site=softwarerecommendations&pagesize=50&order=desc&sort=creation';
const OUT = new URL('../data/opportunities.json', import.meta.url);
const PAGES_DIR = new URL('../pages/', import.meta.url);
const SITEMAP_OUT = new URL('../sitemap.xml', import.meta.url);

const KEYWORDS = {
  strong: ['buy', 'purchase', 'need to buy', 'looking for', 'which should i choose', 'where can i buy', 'best alternative'],
  medium: ['best', 'recommend', 'recommendation', 'alternative to', 'compare', 'comparison', 'which tool'],
  urgent: ['today', 'now', 'asap', 'this week', 'urgent', 'soon', 'need it quickly'],
  info: ['what is', 'definition', 'history', 'how does', 'meaning of', 'what does', 'explain']
};

function scoreIntent(text) {
  const t = String(text || '').toLowerCase();
  const matched = {
    strong: KEYWORDS.strong.filter(k => t.includes(k)),
    medium: KEYWORDS.medium.filter(k => t.includes(k)),
    urgent: KEYWORDS.urgent.filter(k => t.includes(k))
  };
  let score = 10 + 22 * matched.strong.length + 12 * matched.medium.length + 15 * matched.urgent.length;
  if (t.length > 45) score += 5;
  if (/\b(i need|our company|my business|for work)\b/.test(t)) score += 8;
  score = Math.max(0, Math.min(100, score));
  return { score, status: score >= 60 ? 'TEST NOW' : score >= 20 ? 'RESEARCH' : 'DROP', matched };
}

function topicFor(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(crm|customer relationship|sales pipeline|lead management)\b/.test(t)) return 'CRM Software';
  if (/\b(hosting|web host|wordpress host|server hosting)\b/.test(t)) return 'Web Hosting';
  return 'Business Software';
}

const htmlToText = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

function generatePageHTML(item) {
  const title = htmlToText(item.text);
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Smart Buyer Guide</title>
  <meta name="description" content="Analyse en advies over: ${title}">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 0.875rem; }
    .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .btn:hover { background: #1d4ed8; }
    .disclaimer { font-size: 0.8rem; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">${item.topic}</span>
    <h1>${title}</h1>
    <p><strong>Intent Score:</strong> ${item.score}/100 (${item.status})</p>
    <p>Er is een actieve vraag gedetecteerd rondom dit onderwerp. Bekijk het originele signaal en de bijbehorende oplossingen via de onderstaande link.</p>
    <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn">Bekijk Bron & Oplossingen</a>
  </div>
  <div class="disclaimer">
    <p>Transparentie: Smart Buyer Guide analyseert openbare vragen om actuele behoeftes in kaart te brengen. Deze pagina kan affiliate-links bevatten.</p>
  </div>
</body>
</html>`;
}

// Zorg dat de pages-map bestaat
await fs.mkdir(PAGES_DIR, { recursive: true });

const old = await fs.readFile(OUT, 'utf8').catch(() => '{"generatedAt":null,"opportunities":[]}');
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 15000);

try {
  const r = await fetch(API, { headers: { accept: 'application/json' }, signal: controller.signal });
  clearTimeout(timer);
  if (!r.ok) throw new Error(`Stack Exchange HTTP ${r.status}`);
  const d = await r.json();
  if (d.backoff) console.log(`API backoff requested: ${d.backoff}s`);
  if (d.error_id) throw new Error(d.error_message || 'Stack Exchange API error');

  const opportunities = (d.items || []).map(x => {
    const text = htmlToText(x.title);
    const s = scoreIntent(text);
    return {
      id: String(x.question_id),
      text,
      url: x.link,
      source: 'Stack Exchange / Software Recommendations',
      score: s.score,
      status: s.status,
      topic: topicFor(text)
    };
  }).filter(x => x.status !== 'DROP').sort((a, b) => b.score - a.score).slice(0, 50);

  const result = { generatedAt: new Date().toISOString(), mode: 'scheduled-public-api', source: 'Stack Exchange', opportunities };
  await fs.writeFile(OUT, JSON.stringify(result, null, 2) + '\n');

  // Genereer HTML-pagina's per kans
  const sitemapUrls = [];
  for (const item of opportunities) {
    const filename = `question-${item.id}.html`;
    const filePath = new URL(filename, PAGES_DIR);
    await fs.writeFile(filePath, generatePageHTML(item));
    sitemapUrls.push(`pages/${filename}`);
  }

  // Genereer Sitemap.xml voor Google
  const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${sitemapUrls.map(url => `<url><loc>${url}</loc><changefreq>daily</changefreq></url>`).join('\n  ')}
</urlset>`;
  await fs.writeFile(SITEMAP_OUT, sitemapXML);

  console.log(`Updated ${opportunities.length} qualified signals, generated HTML pages and sitemap.xml.`);
} catch (e) {
  console.error(`Demand Finder failed: ${e.message}`);
}
