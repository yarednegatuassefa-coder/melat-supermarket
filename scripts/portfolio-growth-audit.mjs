import { writeFile } from 'node:fs/promises';
const base = process.env.GROWTH_SITE_URL;
const expected = (process.env.GROWTH_INDEX_POLICY || 'index').toLowerCase();
const forbidden = (process.env.GROWTH_FORBIDDEN_SITEMAP_TERMS || 'admin,account,checkout,api,private,preview,staging,dashboard').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
if (!base) throw new Error('GROWTH_SITE_URL is required');
const origin = new URL(base).origin;
const checks = [];
const add = (name,status,detail,severity='warning') => checks.push({name,status,detail,severity});
async function get(url) {
  try { const r = await fetch(url,{redirect:'follow',headers:{'user-agent':'PortfolioGrowthAudit/1.0 (public technical checks)'}}); return {r,body:await r.text()}; }
  catch(e) { return {error:String(e)}; }
}
const page = await get(base);
if (!page.r) add('homepage','fail',page.error,'critical');
else {
  const html=page.body.slice(0,2000000);
  const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.replace(/<[^>]+>/g,' ').trim()||'';
  const description=(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)||html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)||[])[1]||'';
  const canonical=(html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)||html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical/i)||[])[1]||'';
  const robots=(html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i)||[])[1]||'';
  const h1=(html.match(/<h1\b/gi)||[]).length;
  const meta=(name)=>{const a=html.match(new RegExp('<meta[^>]+(?:name|property)=["\\']'+name+'["\\'][^>]+content=["\\']([^"\\']*)["\\']','i'));return a?.[1]||'';};
  add('homepage',page.r.ok?'pass':'fail','HTTP '+page.r.status+'; '+page.r.url,'critical');
  add('title',title.length>=10&&title.length<=70?'pass':'fail',title?'length '+title.length:'missing or too short','high');
  add('meta-description',description.length>=50&&description.length<=180?'pass':'fail',description?'length '+description.length:'missing or outside 50–180 characters','high');
  add('canonical',canonical?'pass':'fail',canonical||'missing','high');
  if(canonical){try{const c=new URL(canonical,base);add('canonical-origin',c.origin===origin?'pass':'fail',c.origin,'high')}catch{add('canonical-origin','fail','invalid URL','high')}}
  add('h1',h1===1?'pass':'fail','found '+h1+' H1 elements','medium');
  add('viewport',/name=["']viewport["']/i.test(html)?'pass':'fail','viewport meta tag','medium');
  add('open-graph',meta('og:title')&&meta('og:description')?'pass':'warning','og:title and og:description','low');
  add('structured-data',/application\/ld\+json/i.test(html)?'pass':'warning','JSON-LD presence only; correctness requires review','low');
  const noindex=/noindex/i.test(robots);
  add('page-indexability',(expected==='index'?!noindex:noindex)?'pass':'fail','policy='+expected+'; robots='+(robots||'default'),'critical');
}
const robots=await get(origin+'/robots.txt');
add('robots-txt',robots.r?.ok?'pass':'warning',robots.r?'HTTP '+robots.r.status:(robots.error||'unavailable'),'medium');
if(robots.body){
  const bots=['GPTBot','OAI-SearchBot','ClaudeBot','PerplexityBot','Google-Extended'];
  const blocked=bots.filter(bot=>new RegExp('User-agent:\\s*'+bot+'[\\s\\S]{0,300}?Disallow:\\s*\\/','i').test(robots.body));
  add('ai-crawler-policy',blocked.length?'warning':'pass',blocked.length?'Potential blanket blocks: '+blocked.join(', '):'No blanket disallow detected; route rules need review','medium');
}
const sitemap=await get(origin+'/sitemap.xml');
add('sitemap',sitemap.r?.ok?'pass':'warning',sitemap.r?'HTTP '+sitemap.r.status:(sitemap.error||'unavailable'),'medium');
if(sitemap.body){
  const locs=[...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m=>m[1].trim());
  const risky=locs.filter(u=>{try{return forbidden.some(t=>new URL(u,origin).pathname.toLowerCase().split('/').includes(t))}catch{return true}});
  add('sitemap-private-paths',risky.length?'fail':'pass',risky.length?'Potential private paths: '+risky.slice(0,10).join(', '):'checked '+locs.length+' URL(s)','critical');
}
const agent=await get(origin+'/.well-known/search?q=about');
add('search-for-agents',agent.r?.ok?'pass':'warning',agent.r?'HTTP '+agent.r.status+'; '+(agent.r.headers.get('content-type')||'unknown'):(agent.error||'unavailable'),'low');
const findings=checks.filter(c=>c.status==='fail');
const report={site:origin,policy:expected,generatedAt:new Date().toISOString(),checks,findings};
const md=['# Portfolio Growth Audit — '+origin,'Generated: '+report.generatedAt,'Index policy: '+expected,'','| Check | Status | Severity | Evidence |','|---|---|---|---|',...checks.map(c=>'| '+c.name+' | '+c.status+' | '+c.severity+' | '+c.detail.replaceAll('|','\\|')+' |'),'',
findings.length?'## Remediation required\n'+findings.map(f=>'- [ ] **'+f.name+'** ('+f.severity+'): '+f.detail).join('\n'):'No failed checks. Warnings still require contextual review.'].join('\n');
await writeFile('growth-audit.json',JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY,md);
console.log(md);
if(findings.some(f=>f.severity==='critical'||f.severity==='high')) process.exitCode=1;
