import fs from 'node:fs/promises';

const API = process.env.DEMAND_API_URL || 'https://api.stackexchange.com/2.3/search/advanced?site=stackoverflow&pagesize=25&order=desc&sort=activity&q=hosting%20OR%20crm%20OR%20software';
const OUT = new URL('../data/opportunities.json', import.meta.url);

const KEYWORDS = {
  strong: ['buy', 'purchase', 'need to buy', 'looking for', 'which should i choose', 'where can i buy'],
  medium: ['best', 'recommend', 'recommendation', 'alternative to', 'compare', 'comparison', 'which is better'],
  urgent: ['today', 'now', 'asap', 'this week', 'urgent', 'soon', 'need it quickly']
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

  // Sla marktdata op als data
  const result = { generatedAt: new Date().toISOString(), mode: 'market-insights', opportunities };
  await fs.writeFile(OUT, JSON.stringify(result, null, 2) + '\n');

  console.log(`Marktdata bijgewerkt (${opportunities.length} inzichten opgeslagen in data/opportunities.json)`);
}

run().catch(console.error);
