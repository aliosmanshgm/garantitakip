/* Minimal, non-sensitive notification feed to be saved in the user's own Drive. */
export function createNotificationFeed(db,nowISO){
  const items=[];
  const ps=new Map((db.products||[]).filter(p=>p.status!=='Arşivlendi').map(p=>[p.id,p]));
  for(const w of db.warranties||[]){
    const p=ps.get(w.productId);
    if(p&&/^\d{4}-\d{2}-\d{2}$/.test(w.end||''))items.push({id:w.id,type:'warranty',name:p.name,detail:w.type||'Garanti',date:w.end});
  }
  for(const c of db.serviceCases||[]){
    const p=ps.get(c.productId);
    if(p&&!['Kapatıldı','Sonuçlandı'].includes(c.status)&&/^\d{4}-\d{2}-\d{2}$/.test(c.nextActionDate||''))items.push({id:c.id,type:'service',name:p.name,detail:c.issue||'Servis takibi',date:c.nextActionDate});
  }
  for(const r of db.reminders||[]){
    if(!r.completed&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||''))items.push({id:r.id,type:'manual',name:r.title||'Hatırlatma',detail:'Kişisel hatırlatma',date:r.date});
  }
  return {version:1,generatedAt:nowISO,timezone:'Europe/Istanbul',thresholds:[90,30,7],items};
}
