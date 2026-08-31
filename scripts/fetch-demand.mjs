import fs from 'node:fs/promises';

const API = process.env.DEMAND_API_URL || 'https://api.stackexchange.com/2.3/questions?site=softwarerecs&order=desc&sort=creation&pagesize=50';
const OUT = new URL('../data/opportunities.json', import.meta.url);
const KEYWORDS = {
  strong: ['buy','purchase','need to buy','looking for','which should i choose','where can i buy','price','under €','under $','pricing','vs','alternative','replacement','switch from','cost per month','worth buying'],
  medium: ['best','recommend','recommendation','alternative to','compare','comparison','which tool','which software','what should i use','suggest a tool'],
  urgent: ['today','now','asap','this week','urgent','soon','need it quickly'],
  info: ['what is','definition','history','how does','meaning of','what does','explain']
};
function scoreIntent(text){
  const t=String(text||'').toLowerCase();
  const matched={strong:KEYWORDS.strong.filter(k=>t.includes(k)),medium:KEYWORDS.medium.filter(k=>t.includes(k)),urgent:KEYWORDS.urgent.filter(k=>t.includes(k)),info:KEYWORDS.info.filter(k=>t.includes(k))};
  let score=10+22*matched.strong.length+12*matched.medium.length+15*matched.urgent.length-25*matched.info.length;
  if(t.length>45) score+=5;
  if(/\b(i need|we need|our company|my business|for work)\b/.test(t)) score+=8;
  score=Math.max(0,Math.min(100,score));
  return {score,status:score>=60?'TEST NOW':score>=20?'RESEARCH':'DROP',matched};
}
function topicFor(text){
  const t=String(text||'').toLowerCase();
  if(/\b(crm|customer relationship|sales pipeline|lead management|salesforce|hubspot|contact management)\b/.test(t)) return 'crm';
  if(/\b(hosting|web host|wordpress host|website host|hosting provider|server hosting)\b/.test(t)) return 'hosting';
  return 'business-software';
}
const htmlToText = s => String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const old = JSON.parse(await fs.readFile(OUT,'utf8').catch(()=>'{"generatedAt":null,"opportunities":[]}'));
const controller = new AbortController();
const timer=setTimeout(()=>controller.abort(),15000);
try {
  const r=await fetch(API,{headers:{accept:'application/json'},signal:controller.signal});
  if(!r.ok) throw new Error(`Stack Exchange HTTP ${r.status}`);
  const d=await r.json();
  if(d.backoff) console.log(`API backoff requested: ${d.backoff}s`);
  if(d.error_id) throw new Error(d.error_message||'Stack Exchange API error');
  const opportunities=(d.items||[]).map(x=>{
    const text=htmlToText(x.title);
    const s=scoreIntent(text);
    return {id:String(x.question_id),text,url:x.link,source:'Stack Exchange / Software Recommendations',createdAt:new Date(x.creation_date*1000).toISOString(),topic:topicFor(text),score:s.score,status:s.status,matched:s.matched};
  }).filter(x=>x.status!=='DROP').sort((a,b)=>b.score-a.score).slice(0,50);
  const same = JSON.stringify(old.opportunities||[]) === JSON.stringify(opportunities);
  if (same) {
    console.log(`No new qualified signals. Existing published data remains unchanged (${opportunities.length}).`);
  } else {
    const result={generatedAt:new Date().toISOString(),mode:'scheduled-public-api',source:'Stack Exchange API v2.3 / Software Recommendations',opportunities,safety:{schedule:'every 30 minutes',maxItems:50,publicDataOnly:true}};
    await fs.writeFile(OUT,JSON.stringify(result,null,2)+'\n');
    console.log(`Updated ${OUT.pathname}: ${opportunities.length} qualified signals.`);
  }
} catch (e) {
  console.error(`Demand Finder failed: ${e.message}`);
  console.log(`Keeping existing data generated at ${old.generatedAt||'unknown'}.`);
  process.exit(1);
} finally { clearTimeout(timer); }
