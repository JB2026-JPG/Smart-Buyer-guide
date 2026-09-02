import fs from 'node:fs/promises';
import path from 'node:path';

const SEARCH_QUERIES = [
  'best hosting for wordpress',
  'alternative to cpanel',
  'cheap vps hosting',
  'crm software for small business',
  'best email marketing software',
  'alternative to hubspot',
  'cloud hosting recommendations',
  'best invoicing software'
];

async function fetchDemand() {
  const opportunities = [];

  for (const query of SEARCH_QUERIES) {
    try {
      const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.items) {
        for (const item of data.items.slice(0, 3)) {
          let intentScore = 20; // Basisscore
          let intentStatus = "RESEARCH";

          // Verhoog score op basis van commerciële trefwoorden
          const title = item.title.toLowerCase();
          if (title.includes('best') || title.includes('alternative') || title.includes('vs') || title.includes('recommendation')) {
            intentScore += 30;
          }

          if (intentScore >= 40) {
            intentStatus = "BUY";
          } else if (intentScore >= 20) {
            intentStatus = "RESEARCH";
          } else {
            intentStatus = "DROP";
          }

          opportunities.push({
            id: item.question_id,
            title: item.title,
            link: item.link,
            score: item.score,
            intentScore: intentScore,
            intentStatus: intentStatus,
            topic: query.includes('hosting') ? "Web Hosting" : "Business Software"
          });
        }
      }
    } catch (err) {
      console.error(`Fout bij ophalen query "${query}":`, err);
    }
  }

  const outputData = {
    generatedAt: new Date().toISOString(),
    mode: "market-insights",
    opportunities: opportunities
  };

  const filePath = path.join(process.cwd(), 'data', 'opportunities.json');
  await fs.writeFile(filePath, JSON.stringify(outputData, null, 2));
  console.log('Opportunities succesvol bijgewerkt!');
}

fetchDemand();
