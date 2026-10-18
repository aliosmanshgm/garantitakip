/* GarantiTakip - readable Drive file names (pure functions; no network access). */
const MIME_EXT = {
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png',
  'image/heic': '.heic', 'image/heif': '.heif', 'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt'
};

export function readablePart(input, maxLength=64, fallback='Belge') {
  const cleaned=String(input||'').normalize('NFC')
    .replace(/[\\/<>:"|?*\x00-\x1F\x7F]/g,' ')
    .replace(/[\u200B-\u200D\uFEFF]/g,'')
    .replace(/\s+/g,' ').trim()
    .replace(/^[.\s_-]+|[.\s_-]+$/g,'');
  return (cleaned||fallback).slice(0,maxLength).trim().replace(/[.\s_-]+$/g,'')||fallback;
}
export function filenameParts(originalName='', mimeType='', mimeFallback=false){
  const name=String(originalName||'');
  const m=name.match(/^(.*)(\.[a-zA-Z0-9]{1,10})$/);
  if(m)return {base:m[1],extension:m[2].toLowerCase()};
  return {base:name,extension:mimeFallback?(MIME_EXT[String(mimeType||'').toLowerCase()]||''):''};
}
export function makeDocumentFilename({productName,documentDate,kind,description,fileName,mimeType,uniqueCode}) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(documentDate||'')))throw new Error('Geçerli belge tarihi gerekli.');
  const extension=filenameParts(fileName,mimeType,true).extension;
  if(!extension)throw new Error('Dosyanın uzantısı belirlenemedi; uzantılı dosya seçin.');
  const parts=[readablePart(productName,53,'Urun'),documentDate,readablePart(kind,30,'Belge')];
  if(String(description||'').trim())parts.push(readablePart(description,42,''));
  const code=String(uniqueCode||'').replace(/[^A-Za-z0-9]/g,'').slice(0,12).toUpperCase();
  if(!code)throw new Error('Dosya için benzersiz kod üretilemedi.');
  parts.push(code);
  return `${parts.join(' - ').slice(0,185)}${extension}`;
}
export function renamedDocumentFilename(enteredName, previousName, mimeType) {
  const {extension}=filenameParts(previousName,mimeType,false);
  const raw=String(enteredName||'').trim();
  if(!raw)throw new Error('Dosya adı boş bırakılamaz.');
  // Users edit only the stem. The original extension is never removed/changed.
  return readablePart(raw,160,'Belge')+extension;
}

// Deterministic names for older Drive uploads. No new file ID is created.
export function historicalUploadName({document, productName}) {
  if(!document?.driveFileId) throw new Error('Drive dosya kimliği bulunamadı.');
  const rawDate=String(document.documentDate||document.createdAt||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(rawDate))throw new Error('Belgenin tarihi yok. Önce belgeyi tek tek düzenleyin.');
  const rawId=String(document.id||document.driveFileId);
  // Stable, non-secret disambiguator. Unrelated to the Drive file ID.
  let hash=2166136261;
  for (let i=0;i<rawId.length;i++){hash^=rawId.charCodeAt(i);hash=Math.imul(hash,16777619);}
  const code=(hash>>>0).toString(16).toUpperCase().padStart(8,'0');
  return makeDocumentFilename({productName,documentDate:rawDate,kind:document.kind||'Belge',description:document.description||'',fileName:document.name||document.originalName,mimeType:document.mimeType||'',uniqueCode:code});
}
