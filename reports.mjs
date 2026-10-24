/* GarantiTakip: deterministic reports; no network requests. */
const money=n=>Number.isFinite(Number(n))?Number(n):0;
const dayDiff=(a,b)=>{if(!a||!b)return null;const n=(Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000;return Number.isFinite(n)?Math.max(0,Math.round(n)):null;};
export function makeReport(db,{from='',to='',productId=''}={}){
  const products=(db.products||[]).filter(p=>!productId||p.id===productId);
  const pids=new Set(products.map(p=>p.id));
  const cases=(db.serviceCases||[]).filter(c=>pids.has(c.productId)&&(!from||c.date>=from)&&(!to||c.date<=to));
  const ids=new Set(cases.map(c=>c.id));
  const events=(db.serviceEvents||[]).filter(e=>ids.has(e.caseId));
  const closed=cases.filter(c=>['Sonuçlandı','Kapatıldı'].includes(c.status));
  const durations=closed.map(c=>dayDiff(c.date,c.closedAt)).filter(x=>x!==null);
  const replacements=events.filter(e=>e.type==='Ürün Değişimi').length;
  const partChanges=events.filter(e=>e.type==='Parça Değişimi').length;
  const repairs=events.filter(e=>e.type==='Onarım').length;
  const totalCost=cases.reduce((s,c)=>s+money(c.cost),0);
  const rows=cases.map(c=>({product:products.find(p=>p.id===c.productId)?.name||'Ürün bulunamadı',date:c.date||'',caseType:c.caseType||'Garanti / Servis',requestedRemedy:c.requestedRemedy||'',issue:c.issue||'',provider:c.provider||'',status:c.status||'',decision:c.decision||'',outcome:c.outcome||'',cost:c.cost??'',closedAt:c.closedAt||'',days:dayDiff(c.date,c.closedAt)??'',replacement:events.filter(e=>e.caseId===c.id&&e.type==='Ürün Değişimi').length,parts:events.filter(e=>e.caseId===c.id&&e.type==='Parça Değişimi').length}));
  return {summary:{products:products.length,cases:cases.length,open:cases.length-closed.length,closed:closed.length,totalCost,replacements,partChanges,repairs,averageDays:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null},rows};
}
const protectCsv=s=>{const str=String(s??'');return /^[\s]*[=+@\-]/.test(str)?"'"+str:str;};
export function reportCSV(rows){
  const cols=[['product','Ürün'],['date','Başvuru Tarihi'],['caseType','Başvuru Türü'],['requestedRemedy','Talep Edilen Çözüm'],['issue','Arıza / Talep'],['provider','Servis'],['status','Durum'],['decision','Garanti Kararı'],['outcome','Sonuç'],['cost','Tutar'],['closedAt','Kapanış'],['days','Süre (Gün)'],['replacement','Ürün Değişimi'],['parts','Parça Değişimi']];
  const quote=x=>'"'+protectCsv(x).replace(/"/g,'""')+'"';
  return '\uFEFF'+[cols.map(([,v])=>quote(v)).join(';'),...rows.map(r=>cols.map(([k])=>quote(r[k])).join(';'))].join('\r\n');
}
