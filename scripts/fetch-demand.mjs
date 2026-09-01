import fs from 'node:fs/promises';

const API = process.env.DEMAND_API_URL || 'https://api.stackexchange.com/2.3/questions?site=softwareengineering&pagesize=10&order=desc&sort=activity';
const OUT = new URL('../data/opportunities.json', import.meta.url);
const PAGES_DIR = new URL('../pages/', import.meta.url);
const SITEMAP_OUT = new URL('../sitemap.xml', import.meta.url);

const KEYWORDS = {
  strong: ['buy', 'purchase', 'need to buy', 'looking for', 'which should i choose', 'where can i buy'],
  medium: ['best', 'recommend', 'recommendation', 'alternative to', 'compare', 'comparison', 'which to use'],
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
  const title = htmlToText(item.title);
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Smart Buyer Guide</title>
  <meta name="description" content="Analyse en advies over: ${title}">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 0.875rem; margin-bottom: 12px; }
    .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">${item.topic}</span>
    <h1>${title}</h1>
    <p><strong>Intentie Score:</strong> ${item.intentScore}/100 (${item.intentStatus})</p>
    <p>Zoek je naar oplossingen rondom softwareontwikkeling of bedrijfsapplicaties? Bekijk onze uitgebreide vergelijkingen en gidsen.</p>
    <a href="../guide-business-software.html" class="btn">Bekijk Beste Software Keuzes</a>
  </div>
</body>
</html>`;
}

async function run() {
  let opportunities = [];

  try {
    const res = await fetch(API, {
      headers: { 'User-Agent': 'SmartBuyerGuide-Bot/1.0' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    opportunities = (data.items || []).map(q => {
      const intent = scoreIntent(q.title);
      return {
        id: q.question_id,
        title: q.title,
        link: q.link,
        score: intent.score,
        intentScore: intent.score,
        intentStatus: intent.status,
        topic: topicFor(q.title)
      };
    });
  } catch (err) {
    console.warn('API Fetch failed, fallback to local data:', err.message);
    opportunities = [
      { id: 101, title: 'What is the best CRM software for small business?', intentScore: 85, intentStatus: 'TEST NOW', topic: 'CRM Software' },
      { id: 102, title: 'Which hosting provider to choose for high traffic?', intentScore: 78, intentStatus: 'TEST NOW', topic: 'Web Hosting' }
    ];
  }

  // Sla JSON op
  const result = { generatedAt: new Date().toISOString(), mode: 'scheduled-public-api', opportunities };
  await fs.writeFile(OUT, JSON.stringify(result, null, 2) + '\n');

  // Genereer HTML-bestanden in pages/
  const sitemapUrls = [];
  for (const item of opportunities) {
    const filename = `question-${item.id}.html`;
    const filePath = new URL(filename, PAGES_DIR);
    await fs.writeFile(filePath, generatePageHTML(item));
    sitemapUrls.push(`https://smart-buyer-guide.pages.dev/pages/${filename}`);
  }

  // Genereer sitemap.xml
  const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${sitemapUrls.map(url => `<url><loc>${url}</loc><changefreq>daily</changefreq></url>`).join('\n  ')}
</urlset>`;
  await fs.writeFile(SITEMAP_OUT, sitemapXML);

  console.log(`Updated ${opportunities.length} pages successfully.`);
}

run().catch(console.error);
