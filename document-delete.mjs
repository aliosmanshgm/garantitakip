/* Faz 6 - Pure helpers for proof-reference deletion; Google Drive is managed separately. */
export function documentLinksFor(db,id){return db.documentLinks.filter(x=>x.documentId===id);}
export function canTrashAppDocument(db,doc){
  if(!doc||doc.source!=='drive-upload'||!doc.driveFileId)return false;
  if(documentLinksFor(db,doc.id).length>1)return false;
  return !db.documents.some(other=>other.id!==doc.id&&other.driveFileId===doc.driveFileId);
}
export function removeDocumentLink(db,{documentId,productId,caseId=''}){
  const exact=db.documentLinks.filter(x=>x.documentId===documentId&&x.productId===productId&&(x.caseId||'')===(caseId||''));
  if(exact.length!==1)throw new Error('Kaldırılacak tekil belge bağlantısı bulunamadı.');
  db.documentLinks=db.documentLinks.filter(x=>!(x.documentId===documentId&&x.productId===productId&&(x.caseId||'')===(caseId||'')));
  const remaining=documentLinksFor(db,documentId).length;
  if(remaining===0)db.documents=db.documents.filter(x=>x.id!==documentId);
  return {remaining,documentRemoved:remaining===0};
}
export function removeDocumentCompletely(db,documentId){
  if(!db.documents.some(x=>x.id===documentId))throw new Error('Belge kaydı bulunamadı.');
  const links=documentLinksFor(db,documentId).length;
  db.documentLinks=db.documentLinks.filter(x=>x.documentId!==documentId);
  db.documents=db.documents.filter(x=>x.id!==documentId);
  return {linksRemoved:links};
}
