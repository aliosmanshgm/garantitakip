/* GarantiTakip Faz 3: pure data validation and conflict-safe merge helpers.
 * Kept independent of Firebase SDK for offline regression tests. */
export const COLLECTIONS = ['products','purchases','warranties','serviceCases','serviceEvents','documents','documentLinks','reminders'];
export const emptyDb = () => ({schemaVersion:2,products:[],purchases:[],warranties:[],serviceCases:[],serviceEvents:[],documents:[],documentLinks:[],reminders:[],settings:{warningDays:[90,30,7]}});
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const stable = v => JSON.stringify(v, function(k, val) {
  return isObj(val) ? Object.keys(val).sort().reduce((o,key)=>(o[key]=val[key],o),{}) : val;
});
export const same = (a,b) => stable(a) === stable(b);
const linkKey = x => btoa(JSON.stringify([x.documentId,x.productId,x.caseId || ''])).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const recordKey = (collection,item) => collection==='documentLinks' ? linkKey(item) : String(item.id||'');
export function deserialize(raw) {
  const base=emptyDb(), value=isObj(raw)?raw:{};
  for(const key of COLLECTIONS) base[key]=Object.values(isObj(value[key])?value[key]:{}).filter(isObj);
  base.settings={...base.settings,...(isObj(value.settings)?value.settings:{})};
  return base;
}
export function serialize(source) {
  const output={schemaVersion:2,settings:source.settings||{warningDays:[90,30,7]}};
  for(const collection of COLLECTIONS){
    output[collection]={};
    for(const item of (source[collection]||[])){
      const key=recordKey(collection,item);
      if(!key || /[.#$\[\]/]/.test(key))throw new Error(`Geçersiz kayıt kimliği: ${collection}`);
      if(Object.hasOwn(output[collection],key))throw new Error(`Yinelenen kayıt kimliği: ${collection}`);
      output[collection][key]=item;
    }
  }
  return output;
}
// Reconcile only changed entities and preserve unrelated changes from other tabs.
export function mergeAgainstRemote(remote,before,after){
  const prev=serialize(before), next=serialize(after);
  const actual=serialize(deserialize(remote));
  let changed=false;
  const conflicts=[];
  for(const collection of COLLECTIONS){
    for(const key of new Set([...Object.keys(prev[collection]),...Object.keys(next[collection])])){
      const p=prev[collection][key], n=next[collection][key];
      if(same(p,n))continue;
      if(!same(p,actual[collection][key])){conflicts.push(`${collection}/${key}`);continue;}
      changed=true;
      if(n===undefined)delete actual[collection][key];else actual[collection][key]=n;
    }
  }
  if(!same(prev.settings,next.settings)){
    if(!same(prev.settings,actual.settings))conflicts.push('settings');
    else {changed=true;actual.settings=next.settings;}
  }
  actual.schemaVersion=2;
  return {value:actual,changed,conflicts};
}
export function validateBackup(source){
  if(!isObj(source)||![1,2].includes(source.schemaVersion))throw new Error('Desteklenmeyen JSON yedek sürümü.');
  for(const collection of COLLECTIONS)if(!Array.isArray(source[collection]))throw new Error(`JSON içinde ${collection} listesi eksik.`);
  if(!isObj(source.settings))throw new Error('JSON ayarları eksik.');
  const sets={};
  for(const collection of COLLECTIONS.filter(k=>k!=='documentLinks')){
    const seen=new Set();
    for(const item of source[collection]){
      if(!isObj(item)||typeof item.id!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(item.id))throw new Error(`${collection}: geçersiz kayıt kimliği.`);
      if(seen.has(item.id))throw new Error(`${collection}: yinelenen kayıt kimliği.`);
      seen.add(item.id);
    }
    sets[collection]=seen;
  }
  for(const item of source.products)if(item.purchaseId&&!sets.purchases.has(item.purchaseId))throw new Error('Ürün için satın alma kaydı bulunamadı.');
  for(const item of source.warranties)if(!sets.products.has(item.productId))throw new Error('Garanti için ürün kaydı bulunamadı.');
  for(const item of source.serviceCases)if(!sets.products.has(item.productId))throw new Error('Servis için ürün kaydı bulunamadı.');
  for(const item of source.serviceEvents)if(!sets.serviceCases.has(item.caseId))throw new Error('Servis olayına ait dosya bulunamadı.');
  for(const item of source.reminders)if(item.productId&&!sets.products.has(item.productId))throw new Error('Hatırlatma için ürün bulunamadı.');
  const caseProduct=Object.fromEntries(source.serviceCases.map(x=>[x.id,x.productId]));
  const links=new Set();
  for(const link of source.documentLinks){
    if(!isObj(link)||!sets.documents.has(link.documentId)||!sets.products.has(link.productId))throw new Error('Belge bağlantısında ürün veya belge eksik.');
    if(link.caseId && (!sets.serviceCases.has(link.caseId)||caseProduct[link.caseId]!==link.productId))throw new Error('Belge bağlantısında servis ile ürün eşleşmiyor.');
    const id=`${link.documentId}#${link.productId}#${link.caseId||''}`;
    if(links.has(id))throw new Error('Yinelenen belge bağlantısı var.');
    links.add(id);
  }
  for(const doc of source.documents)if(typeof doc.driveFileId!=='string'||!/^[a-zA-Z0-9_-]{8,}$/.test(doc.driveFileId))throw new Error('Belge kaydında geçerli Drive dosya kimliği bulunamadı.');
  serialize(source);
  return {productCount:source.products.length,documentCount:source.documents.length,serviceCount:source.serviceCases.length};
}
