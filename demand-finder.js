/* Smart Buyer Guide — zero-cost client-side Demand Finder
   Public-data only. No contact, profiling, scraping, database or paid API.
   Safety: max 4 source refreshes per browser per rolling 24h + 30min cache.
*/
(function(){
  'use strict';
  const CONFIG = window.SBG_CONFIG || {};
  const STORAGE_KEY='sbg_opportunities_v2';
  const RUNS_KEY='sbg_run_times_v1';
  const BACKOFF_KEY='sbg_api_backoff_until_v1';
  const CACHE_MS=30*60*1000;
  const MAX_RUNS_24H=4;
  const MAX_ITEMS=50;
  const KEYWORDS={
    strong:["buy","purchase","need to buy","looking for","which should i choose","where can i buy","price","under €","under $","pricing","vs","alternative","replacement","switch from","cost per month","worth buying"],
    medium:["best","recommend","recommendation","alternative to","compare","comparison","which tool","which software","what should i use","suggest a tool"],
    urgent:["today","now","asap","this week","urgent","soon","need it quickly"],
    info:["what is","definition","history","how does","meaning of","what does","explain"]
  };
  function scoreIntent(text){
    const t=String(text||'').toLowerCase();
    const matched={strong:KEYWORDS.strong.filter(k=>t.includes(k)),medium:KEYWORDS.medium.filter(k=>t.includes(k)),urgent:KEYWORDS.urgent.filter(k=>t.includes(k)),info:KEYWORDS.info.filter(k=>t.includes(k))};
    let score=10+22*matched.strong.length+12*matched.medium.length+15*matched.urgent.length-25*matched.info.length;
    if(t.length>45) score+=5;
    if(/\b(i need|we need|our company|my business|for work)\b/.test(t)) score+=8;
    score=Math.max(0,Math.min(100,score));
    const status=score>=60?'TEST NOW':score>=20?'RESEARCH':'DROP';
    return {score,status,matched};
  }
  function topicFor(text){
    const t=String(text||'').toLowerCase();
    if(/\b(crm|customer relationship|sales pipeline|lead management|salesforce|hubspot|contact management)\b/.test(t)) return 'crm';
    if(/\b(hosting|web host|wordpress host|website host|hosting provider|server hosting)\b/.test(t)) return 'hosting';
    return 'business-software';
  }
  function isSafeUrl(url){return /^https:\/\/[^\s"'<>]+$/i.test(String(url||''));}
  function affiliateLink(topic){
    const specific=(CONFIG.links||{})[topic]||'';
    return isSafeUrl(specific)?specific:(isSafeUrl(CONFIG.defaultAffiliateLink)?CONFIG.defaultAffiliateLink:'');
  }
  function cleanText(html){const d=document.createElement('div');d.innerHTML=html||'';return (d.textContent||html||'').replace(/\s+/g,' ').trim();}
  function readRuns(){try{return JSON.parse(localStorage.getItem(RUNS_KEY)||'[]').filter(x=>Date.now()-x<86400000)}catch{return[]}}
  function canRun(){const backoff=Number(localStorage.getItem(BACKOFF_KEY)||0);if(Date.now()<backoff)return {ok:false,reason:'The public source asked us to wait before another request.'};const runs=readRuns();if(runs.length>=MAX_RUNS_24H)return {ok:false,reason:'Safe free limit reached: 4 Demand Finder refreshes per browser per 24 hours.'};return {ok:true,remaining:MAX_RUNS_24H-runs.length};}
  function recordRun(){const runs=readRuns();runs.push(Date.now());localStorage.setItem(RUNS_KEY,JSON.stringify(runs));}
  function fetchJsonp(url){return new Promise((resolve,reject)=>{const cb='sbgJsonp_'+Date.now()+'_'+Math.random().toString(36).slice(2);const script=document.createElement('script');const timer=setTimeout(()=>{cleanup();reject(new Error('Demand source timed out'));},15000);function cleanup(){clearTimeout(timer);delete window[cb];script.remove();}window[cb]=data=>{cleanup();resolve(data)};script.onerror=()=>{cleanup();reject(new Error('Demand source unavailable'))};script.src=url+'&callback='+encodeURIComponent(cb);document.head.appendChild(script);});}
  async function fetchSignals(){
    const gate=canRun(); if(!gate.ok) throw new Error(gate.reason);
    const u=new URL('https://api.stackexchange.com/2.3/questions');
    u.searchParams.set('site','softwarerecs');u.searchParams.set('order','desc');u.searchParams.set('sort','creation');u.searchParams.set('pagesize','50');
    let d;
    try{
      const r=await fetch(u.toString(),{headers:{Accept:'application/json'}});
      if(!r.ok) throw new Error('HTTP '+r.status);
      d=await r.json();
    }catch(_){d=await fetchJsonp(u.toString());}
    if(d.backoff) localStorage.setItem(BACKOFF_KEY,String(Date.now()+Number(d.backoff)*1000));
    if(d.error_id) throw new Error(d.error_message||'Demand source error');
    recordRun();
    return (d.items||[]).map(x=>{
      const text=cleanText(x.title); const s=scoreIntent(text); const topic=topicFor(text);
      return {id:String(x.question_id),text,url:x.link,source:'Stack Exchange / Software Recommendations',createdAt:x.creation_date?new Date(x.creation_date*1000).toISOString():new Date().toISOString(),topic,score:s.score,status:s.status,matched:s.matched,affiliateLink:affiliateLink(topic)};
    }).filter(x=>x.status!=='DROP').sort((a,b)=>b.score-a.score).slice(0,MAX_ITEMS);
  }
  async function runDemandFinder(force){
    const cached=loadCached();
    if(!force && cached.generatedAt && Date.now()-Date.parse(cached.generatedAt)<CACHE_MS) return cached;
    const signals=await fetchSignals();
    const result={generatedAt:new Date().toISOString(),mode:'live-public-api',source:'Stack Exchange API v2.3 / Software Recommendations',opportunities:signals,safety:{maxRefreshesPer24h:MAX_RUNS_24H,cacheMinutes:30}};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(result));
    return result;
  }
  function loadCached(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{"opportunities":[]}')}catch{return {opportunities:[]}}}
  window.SBG={KEYWORDS,scoreIntent,topicFor,affiliateLink,isSafeUrl,fetchSignals,runDemandFinder,loadCached,canRun,MAX_RUNS_24H,CACHE_MS};
})();
