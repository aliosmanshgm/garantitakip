/* GarantiTakip - Faz 3. Firebase + Drive, checked restores and record integrity. */
import {validateBackup} from './integrity.js';
import {makeDocumentFilename, filenameParts, renamedDocumentFilename, historicalUploadName} from './filename.js';
import {documentLinksFor, removeDocumentLink, removeDocumentCompletely, canTrashAppDocument} from './document-delete.mjs';
import {extractInvoice} from './invoice.mjs';
import {makeReport,reportCSV} from './reports.mjs';
import {createNotificationFeed} from './notification-feed.mjs';
(() => {
  'use strict';
  const services=window.GTServices;
  const cloud=services.cloud,drive=services.drive;
  let ready=false, busy=false, committed=null, pickedDriveFile=null, checkingDocuments=false, stagedUpload=null, bulkNaming=false, deletingDocument=false, invoiceSuggestion=null, notificationSyncing=false, pendingNotificationSync=false, notificationSyncError="";
  const emptyDb=()=>({schemaVersion:2,products:[],purchases:[],warranties:[],serviceCases:[],serviceEvents:[],documents:[],documentLinks:[],reminders:[],settings:{warningDays:[90,30,7]}});
  const clone=x=>JSON.parse(JSON.stringify(x));
  const ICONS = {
    'layout-dashboard':'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    package:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/>',
    wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1A6 6 0 0 1 13 13.4l-7.5 7.5a2 2 0 0 1-2.8-2.8l7.5-7.5A6 6 0 0 1 17.4 3l-2.7 3.3Z"/>',
    files:'<path d="M16 2H6a2 2 0 0 0-2 2v14"/><rect x="8" y="6" width="13" height="16" rx="2"/><path d="M12 11h5M12 15h5"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    settings:'<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19.5 13.4a1.7 1.7 0 0 0 .1-2.8l-1-1.1.2-1.4a1.7 1.7 0 0 0-2.2-1.8L15.3 7 14 6.4 13.3 5a1.7 1.7 0 0 0-2.7-.1l-1 1.1-1.4-.2a1.7 1.7 0 0 0-1.8 2.2L7 9.3l-.6 1.3-1.4.7a1.7 1.7 0 0 0-.1 2.7l1.1 1-.2 1.4a1.7 1.7 0 0 0 2.2 1.8l1.3-.7 1.3.6.7 1.4a1.7 1.7 0 0 0 2.7.1l1-1.1 1.4.2a1.7 1.7 0 0 0 1.8-2.2l-.7-1.3.6-1.3 1.4-.7Z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', 'plus-circle':'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    'arrow-up-right':'<path d="M7 17 17 7M8 7h9v9"/>','arrow-left':'<path d="m12 19-7-7 7-7M5 12h14"/>','chevron-right':'<path d="m9 18 6-6-6-6"/>','chevron-down':'<path d="m6 9 6 6 6-6"/>',
    search:'<circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/>',
    'shield-check':'<path d="M12 22c6-2.1 9-5.7 9-11V5l-9-3-9 3v6c0 5.3 3 8.9 9 11Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    'clock-3':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'calendar-days':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h1M12 14h1M16 14h1"/>',
    'cloud-off':'<path d="m2 2 20 20M7.9 7A7 7 0 0 1 20 12.2a4.5 4.5 0 0 1-1.5 8.7H8a5 5 0 0 1-2.2-9.5"/>',
    'hard-drive':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 13h18M7 16h.01M11 16h.01"/>',
    'external-link':'<path d="M13 4h7v7M20 4l-9 9M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/>',
    'file-text':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    'file-plus':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M12 12v7M8.5 15.5h7"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 16v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',
    'folder-open':'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2l1-12Z"/>',
    'smartphone':'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
    laptop:'<rect x="5" y="4" width="14" height="12" rx="1"/><path d="M2 19h20l-2 2H4l-2-2Z"/>',
    watch:'<circle cx="12" cy="12" r="5"/><path d="M9 7 10 2h4l1 5M9 17l1 5h4l1-5M12 9v3l2 1"/>',
    headphones:'<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 14h4v7H5a2 2 0 0 1-2-2v-5ZM17 14h4v5a2 2 0 0 1-2 2h-2v-7Z"/>',
    monitor:'<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    camera:'<path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/>',
    box:'<rect x="3" y="7" width="18" height="14" rx="1"/><path d="M3 7 5 3h14l2 4M12 7v14"/>',
    'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    alert:'<path d="m12 3 10 18H2L12 3ZM12 9v5M12 18h.01"/>',
    'circle-help':'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>',
    'more-horizontal':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    'trash-2':'<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    'archive':'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8M10 12h4"/>',
    edit:'<path d="M12 20h9M16.5 4.5l3 3L8 19l-4 1 1-4L16.5 4.5Z"/>',
    'refresh-cw':'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 14-2l1 5M4 12l1 5a8 8 0 0 0 14-2"/>',
    x:'<path d="M5 5 19 19M19 5 5 19"/>',
    'list-checks':'<path d="m3 7 2 2 3-4M11 7h10m-18 9 2 2 3-4M11 16h10"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>'
  };
  const icon = (name, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${ICONS[name] || ICONS.package}</svg>`;
  const escape = x => String(x ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const iso = dt => {const d=new Date(dt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const localDate = s => s ? new Date(`${s}T12:00:00`) : null;
  const daysFrom = (n, date=new Date()) => {const d=new Date(date);d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return iso(d);};
  const addMonths = (dateStr, months) => {if(!dateStr || !Number.isFinite(Number(months)))return '';const d=localDate(dateStr);if(!d||isNaN(d))return '';const dom=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+Number(months));const endLast=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(dom,endLast));return iso(d);};
  const dateFormat=s=>{if(!s)return 'Belirtilmemiş';const d=localDate(s);return isNaN(d)?'—':new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);};
  const daysTo = s=> s ? Math.ceil((localDate(s)-localDate(iso(new Date())))/(86400000)) : null;
  const money = (n,c='TRY') => n===null||n===undefined||n===''?'—':new Intl.NumberFormat('tr-TR',{style:'currency',currency:c||'TRY',maximumFractionDigits:2}).format(Number(n)||0);
  const uid=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const OPTIONS={categories:['Telefon / Tablet','Bilgisayar','Giyilebilir Teknoloji','Ses / Görüntü','Ev Aletleri','Elektronik','Mobilya','Araç / Aksesuar','Diğer'], productStatus:['Kullanımda','Yedek','Devredildi','Satıldı','Arşivlendi'], warrantyTypes:['Üretici Garantisi','Satıcı Garantisi','Ek Garanti','Servis Garantisi','Diğer'],serviceStatuses:['Başvuru Açıldı','Serviste / İncelemede','Yanıt / İşlem Bekleniyor','Sonuçlandı','Kapatıldı'], documentKinds:['Fatura','Garanti Belgesi','Ürün Fotoğrafı','Servis Formu','Kargo Belgesi','Yazışma','Diğer'],eventTypes:['Başvuru','Görüşme','Ürün Gönderimi','Servis İncelemesi','Onarım','Parça Değişimi','Ürün Değişimi','Bedel İadesi','Diğer']};
  const choices=(arr,current,blank='Seçiniz')=>`${blank===null?'':`<option value="">${escape(blank)}</option>`}${arr.map(x=>`<option value="${escape(x)}" ${x===current?'selected':''}>${escape(x)}</option>`).join('')}`;
  function validDb(obj){return !!obj&&typeof obj==='object'&&['products','purchases','warranties','serviceCases','serviceEvents','documents','documentLinks','reminders'].every(k=>Array.isArray(obj[k]))&&obj.settings&&typeof obj.settings==='object';}
  let db=emptyDb();
  async function persist(){
    if(!ready || !cloud) throw Error('Bulut verisi henüz hazır değil.');
    if(busy)throw Error('Önce devam eden kaydın tamamlanmasını bekleyin.');
    busy=true;
    try {
      await cloud.saveDiff(committed,db);
      committed=clone(db);
      if(db.settings.emailNoticesEnabled && db.settings.notificationFeedFileId && drive?.connected()) {
        Promise.resolve().then(()=>syncNotificationFeed(false)).catch(err=>{notificationSyncError=err.message;console.warn('Hatırlatma Drive eşitlemesi başarısız',err);});
      }
      return true;
    } catch(error){
      try {const fresh=await cloud.readOnce();db=fresh;committed=clone(fresh);}
      catch {db=clone(committed);}
      render();throw new Error(`Firebase kayıt hatası: ${error.message}`);
    }
    finally{busy=false;}
  }
  function gate(message,canSignIn=true){
    const root=document.getElementById('authGate');root.hidden=false;
    root.innerHTML=`<div class="auth-card"><span class="auth-mark">✓</span><h1>GarantiTakip</h1><p>${escape(message)}</p><button id="loginButton" class="btn btn-primary" ${!canSignIn?'disabled':''}>${icon('shield-check')} Google hesabıyla giriş yap</button><small>Veriler Firebase'de, kanıtlar özel Google Drive hesabınızda saklanır.</small></div>`;
  }
  function showApp(){document.getElementById('authGate').hidden=true;document.querySelector('.mode-card').innerHTML='<span class="mode-dot"></span><div><strong>Firebase bağlı</strong><small>Kişisel bulut arşivi</small></div>';document.querySelector('.prototype-chip').innerHTML='<span></span> Bulut sürümü';const user=cloud.user();document.querySelector('.profile strong').textContent=user?.displayName||'Google hesabı';document.querySelector('.profile small').textContent=user?.email||'';document.querySelector('.top-actions .avatar-small').title=user?.email||'Oturum';}
  function initialize(){
    if(!services.configured){gate('Kurulum tamamlanmamış. GitHub Pages yayını öncesinde config.js dosyasını düzenleyin ve KURULUM.md adımlarını uygulayın.',false);return;}
    cloud.observeLogin((user,error)=>{
      ready=false;
      if(error){gate(error.message,true);return;}
      if(!user){drive.disconnect();db=emptyDb();committed=null;gate('Kişisel ürün kayıtlarını açmak için yetkili Google hesabınızla giriş yapın.');return;}
      gate('Firebase kayıtları güvenli biçimde yükleniyor…',false);
      cloud.listen(remote=>{
        if(busy)return;
        db=remote;committed=clone(remote);ready=true;showApp();render();
      },err=>{ready=false;gate(`Firebase bağlantı hatası: ${err.message}. Veritabanı kurallarını ve URL bilgisini kontrol edin.`,false);});
    });
  }
  const ui={route:'dashboard',productId:null,caseId:null,tab:'general',filter:'all',search:'',sort:'updated',docFilter:'all',docSearch:'',serviceFilter:'all',reportFrom:'',reportTo:'',reportProduct:''};
  const getProduct=id=>db.products.find(p=>p.id===id);
  const getPurchase=id=>db.purchases.find(p=>p.id===id);
  const getWarranty=id=>db.warranties.filter(w=>w.productId===id);
  const getCase=id=>db.serviceCases.find(c=>c.id===id);
  const relatedDocs=(pid,cid)=>db.documentLinks.filter(l=>l.productId===pid && (cid===undefined || l.caseId===cid)).map(l=>db.documents.find(d=>d.id===l.documentId)).filter(Boolean);
  const productName=id=>getProduct(id)?.name||'Bilinmeyen ürün';
  const isActiveCase=c=>c.status!=='Kapatıldı'&&c.status!=='Sonuçlandı';
  const warrantyStatus=pid=>{const w=getWarranty(pid).filter(w=>w.end);if(!w.length)return {text:'Bilinmiyor',cls:'neutral',value:null};const best=Math.max(...w.map(x=>daysTo(x.end)));if(best<0)return {text:'Süresi doldu',cls:'bad',value:best};if(best<=90)return {text:`${best} gün kaldı`,cls:'warn',value:best};return {text:'Aktif',cls:'good',value:best};};
  const tag=(txt,kind='neutral')=>`<span class="tag ${kind}">${escape(txt)}</span>`;
  const iconFor=p=>({'Telefon / Tablet':'smartphone','Bilgisayar':'laptop','Giyilebilir Teknoloji':'watch','Ses / Görüntü':'headphones','Ev Aletleri':'box','Elektronik':'camera','Araç / Aksesuar':'monitor'}[p?.category]||'package');
  const shortText=(txt,len=40)=>String(txt||'').length>len?String(txt).slice(0,len-1)+'…':String(txt||'');
  const actionableReminders=()=>{
    const arr=[];
    db.products.filter(p=>p.status!=='Arşivlendi').forEach(p=>{
      getWarranty(p.id).filter(w=>w.end).forEach(w=>{const d=daysTo(w.end);if(d>=0&&d<=90)arr.push({id:`w_${w.id}`,type:'warranty',productId:p.id,title:`${p.name} garantisi bitiyor`,detail:`${w.type} · ${dateFormat(w.end)}`,days:d,date:w.end});});
    });
    db.serviceCases.filter(isActiveCase).forEach(c=>{if(c.nextActionDate){const d=daysTo(c.nextActionDate);if(d<=30)arr.push({id:`s_${c.id}`,type:'service',caseId:c.id,title:`${productName(c.productId)} servis takibi`,detail:`${c.status} · ${dateFormat(c.nextActionDate)}`,days:d,date:c.nextActionDate});}});
    db.reminders.filter(r=>!r.completed).forEach(r=>{const d=daysTo(r.date);if(d!==null&&d<=30)arr.push({id:r.id,type:'manual',productId:r.productId,title:r.title,detail:`Kişisel hatırlatma · ${dateFormat(r.date)}`,days:d,date:r.date});});
    return arr.sort((a,b)=>a.days-b.days);
  };
  const dateRelative=d=>d<0?`${Math.abs(d)} gün gecikti`:d===0?'Bugün':`${d} gün kaldı`;
  const navItems=[['dashboard','Genel Bakış','layout-dashboard'],['products','Ürünlerim','package'],['services','Servis İşlemleri','wrench'],['documents','Belge Arşivi','files'],['reminders','Hatırlatmalar','bell'],['reports','Raporlar','list-checks'],['settings','Ayarlar','settings']];
  function navigate(route,id){ui.route=route;if(route==='detail'&&id){ui.productId=id;ui.tab='general';}if(route==='case'&&id)ui.caseId=id;window.scrollTo(0,0);render();}
  const btn=(txt,action,args='',variant='')=>`<button type="button" class="btn ${variant}" data-action="${action}" ${args}>${txt}</button>`;
  const simpleEmpty=(i,h,s,btnHtml='')=>`<div class="empty-state">${icon(i)}<strong>${escape(h)}</strong><p>${escape(s)}</p>${btnHtml}</div>`;
  const titleHeader=(eyebrow,title,desc,actions='')=>`<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div>${actions?`<div class="page-actions">${actions}</div>`:''}</div>`;
  function recentActivity(){const events=[...db.products.map(p=>({type:'Ürün',title:p.name,subtitle:'Ürün kaydı güncellendi',date:p.updatedAt||p.createdAt,id:p.id,nav:'detail'})),...db.serviceEvents.map(e=>({type:'Servis',title:productName(getCase(e.caseId)?.productId),subtitle:e.type,date:e.date,id:e.caseId,nav:'case'})),...db.documents.map(d=>({type:'Belge',title:d.name,subtitle:d.kind,date:d.createdAt,id:null,nav:'documents'}))];return events.filter(x=>x.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);}
  const activeProducts=()=>db.products.filter(x=>x.status!=='Arşivlendi');
  function render(){
    const active=ui.route==='detail'?'products':ui.route==='case'?'services':ui.route;
    document.getElementById('sideNav').innerHTML=navItems.map(n=>`<button data-route="${n[0]}" class="nav-button ${active===n[0]?'active':''}">${icon(n[2])}<span>${n[1]}</span>${n[0]==='reminders'&&actionableReminders().length?`<span class="nav-count">${actionableReminders().length}</span>`:''}</button>`).join('');
    document.getElementById('bottomNav').innerHTML=[...navItems.slice(0,4),navItems[6]].map(n=>`<button class="mobile-nav-btn ${active===n[0]?'active':''}" data-route="${n[0]}">${icon(n[2])}<span>${n[0]==='dashboard'?'Ana Sayfa':n[0]==='products'?'Ürünler':n[0]==='services'?'Servisler':n[0]==='documents'?'Belgeler':'Ayarlar'}</span></button>`).join('');
    document.getElementById('breadcrumbs').textContent=(ui.route==='detail'?'Ürünlerim / Ürün Detayı':ui.route==='case'?'Servis İşlemleri / İşlem Detayı':navItems.find(n=>n[0]===ui.route)?.[1])||'Genel Bakış';
    document.getElementById('notificationDot').classList.toggle('show',actionableReminders().length>0);
    const pages={dashboard:dashboardPage,products:productsPage,detail:detailPage,services:servicesPage,case:casePage,documents:documentsPage,reminders:remindersPage,reports:reportsPage,settings:settingsPage};
    document.getElementById('main').innerHTML=`<div class="page">${(pages[ui.route]||dashboardPage)()}</div>`;
    document.title=`${ui.route==='detail'?productName(ui.productId):ui.route==='case'?'Servis Detayı':document.getElementById('breadcrumbs').textContent} | GarantiTakip`;
    document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  }
  function dashboardPage(){
    const prods=activeProducts(),upcoming=actionableReminders(),expiring=db.products.filter(p=>p.status!=='Arşivlendi'&&getWarranty(p.id).some(w=>daysTo(w.end)>=0&&daysTo(w.end)<=90)).length,services=db.serviceCases.filter(isActiveCase).length,covered=prods.filter(p=>getWarranty(p.id).some(w=>daysTo(w.end)>=0)).length;
    const stats=[['Toplam Ürün',prods.length,'package','products'],['Aktif Garantili',covered,'shield-check','active'],['90 Gün İçinde Biten',expiring,'clock-3','expiring'],['Açık Servis',services,'wrench','services']];
    return `${titleHeader('Kişisel yönetim paneli','Genel Bakış','Ürünlerinizi, garantilerinizi ve servis süreçlerinizi tek yerden yönetin.',btn('Raporlar','goto','data-route-to="reports"','btn-secondary')+btn(`${icon('plus')} Yeni Ürün`,'new-product','','btn-primary'))}
    <div class="intro-layout"><div class="hero"><small>HER ŞEY TEK YERDE</small><h2>Ürünlerin güvende,<br>kayıtların düzenli.</h2><p>Satın alma bilgilerinizi, garanti sürelerinizi ve servis geçmişinizi kaybetmeden takip edin.</p>${btn(`${icon('plus')} Ürün kaydet`,'new-product')}</div>
    <div class="connection-card"><div><div class="connection-top"><span class="connection-icon">${icon(drive?.connected()?'check-circle':'folder-open')}</span>${tag(drive?.connected()?'Drive bağlı':'Drive bağlantısı gerekli',drive?.connected()?'good':'warn')}</div><h3>Özel belge arşivin</h3><p>${drive?.connected()?'Fatura ve servis kanıtları kişisel Google Drive hesabınıza yüklenmeye hazır.':'Belge yüklemek ve mevcut dosyaları seçmek için Ayarlar sayfasından Google Drive bağlantısını etkinleştirin.'}</p></div><div class="connection-bottom"><span class="light-pill">${icon('shield-check')} Firebase korumalı veriler</span><span class="light-pill">${icon('folder-open')} Drive belge arşivi</span></div></div></div>
    <div class="stat-grid">${stats.map(s=>`<button class="stat-card" data-action="stat-filter" data-filter="${s[3]}"><div class="stat-row"><span class="stat-icon">${icon(s[2])}</span><span class="stat-value">${s[1]}</span></div><span class="stat-label">${s[0]}</span></button>`).join('')}</div>
    <div class="section-grid"><section class="panel"><div class="panel-head"><div><h3 class="panel-title">Dikkat gerektirenler</h3><p class="panel-desc">Garanti bitişleri ve servis takip tarihleri</p></div><button class="text-link" data-route="reminders">Tümünü gör ${icon('arrow-up-right')}</button></div>${upcoming.length?`<div class="activity-list">${upcoming.slice(0,4).map(r=>`<div class="activity-row"><span class="list-icon">${icon(r.type==='warranty'?'shield-check':r.type==='service'?'wrench':'bell')}</span><div class="activity-main"><strong>${escape(r.title)}</strong><small>${escape(r.detail)}</small></div>${tag(dateRelative(r.days),r.days<=7?'bad':'warn')}</div>`).join('')}</div>`:simpleEmpty('check-circle','Bekleyen kritik işlem yok','Yaklaşan garanti bitişi veya servis takip tarihi bulunamadı.')}</section>
    <section class="panel"><div class="panel-head"><div><h3 class="panel-title">Son hareketler</h3><p class="panel-desc">Kayıtlardaki en son değişiklikler</p></div></div>${recentActivity().length?`<div class="activity-list">${recentActivity().map(a=>`<div class="activity-row" ${a.id?`data-action="goto" data-route-to="${a.nav}" data-id="${escape(a.id)}" style="cursor:pointer"`:''}><span class="activity-dot"></span><div class="activity-main"><strong class="truncate">${escape(shortText(a.title,34))}</strong><small>${escape(a.subtitle)}</small></div><span class="activity-date">${dateFormat(a.date)}</span></div>`).join('')}</div>`:simpleEmpty('list-checks','Henüz hareket yok','Yeni bir ürün ekleyerek başlayın.')}</section></div>
    <section class="panel"><div class="panel-head"><div><h3 class="panel-title">Ürünlerimden seçmeler</h3><p class="panel-desc">Kayıtlı ürünlere hızlı erişim</p></div><button class="text-link" data-route="products">Ürünlerin tümü ${icon('arrow-up-right')}</button></div>${productTable([...prods].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,4))}</section>
    `;
  }
  function productTable(items){if(!items.length)return simpleEmpty('package','Ürün bulunamadı','Filtreyi değiştirin veya yeni ürün ekleyin.',btn(`${icon('plus')} Yeni Ürün`,'new-product','','btn-primary'));
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Ürün</th><th>Satın Alma</th><th>Garanti</th><th>Durum</th><th></th></tr></thead><tbody>${items.map(p=>{const pur=getPurchase(p.purchaseId),ws=getWarranty(p.id),last=ws.filter(w=>w.end).sort((a,b)=>b.end.localeCompare(a.end))[0],s=warrantyStatus(p.id);return `<tr class="clickable" data-action="goto" data-route-to="detail" data-id="${escape(p.id)}"><td><div class="cell-flex"><span class="product-thumb">${icon(iconFor(p))}</span><span><span class="item-name">${escape(p.name)}</span><span class="item-sub">${escape([p.brand,p.model].filter(Boolean).join(' · ')||p.category)}</span></span></div></td><td>${dateFormat(pur?.date)}</td><td>${last?dateFormat(last.end):'—'}</td><td>${tag(s.text,s.cls)}</td><td class="right">${icon('chevron-right')}</td></tr>`;}).join('')}</tbody></table></div>`;}
  function productsPage(){let products=[...db.products];if(ui.filter==='archive')products=products.filter(p=>p.status==='Arşivlendi');else products=products.filter(p=>p.status!=='Arşivlendi');if(ui.filter==='active')products=products.filter(p=>warrantyStatus(p.id).value!==null&&warrantyStatus(p.id).value>=0);if(ui.filter==='expiring')products=products.filter(p=>warrantyStatus(p.id).value!==null&&warrantyStatus(p.id).value>=0&&warrantyStatus(p.id).value<=90);if(ui.filter==='expired')products=products.filter(p=>warrantyStatus(p.id).value!==null&&warrantyStatus(p.id).value<0);if(ui.filter==='missing')products=products.filter(p=>!relatedDocs(p.id).some(d=>d.kind==='Fatura'));const q=ui.search.toLocaleLowerCase('tr-TR').trim();if(q)products=products.filter(p=>[p.name,p.brand,p.model,p.serial,p.category,getPurchase(p.purchaseId)?.vendor].some(v=>String(v||'').toLocaleLowerCase('tr-TR').includes(q)));if(ui.sort==='name')products.sort((a,b)=>a.name.localeCompare(b.name,'tr'));else if(ui.sort==='warranty')products.sort((a,b)=>(warrantyStatus(a.id).value??99999)-(warrantyStatus(b.id).value??99999));else products.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
    return `${titleHeader('Ürün envanteri','Ürünlerim',`${db.products.filter(p=>p.status!=='Arşivlendi').length} aktif kayıt · Garanti ve satın alma bilgileri`,btn(`${icon('plus')} Ürün Ekle`,'new-product','','btn-primary'))}<div class="toolbar"><label class="searchbox">${icon('search')}<input id="productSearch" type="search" value="${escape(ui.search)}" placeholder="Ürün, marka, model, seri numarası ara" aria-label="Ürünlerde ara"></label><select class="filter-select" id="productSort" aria-label="Sıralama">${[['updated','Son güncellenen'],['name','Ürün adı'],['warranty','Garanti bitişi']].map(([v,n])=>`<option ${ui.sort===v?'selected':''} value="${v}">${n}</option>`).join('')}</select></div><div class="filter-bar"><div class="filters">${[['all','Tümü'],['active','Aktif'],['expiring','90 gün içinde'],['expired','Süresi dolmuş'],['missing','Faturası eksik'],['archive','Arşiv']].map(([v,n])=>`<button class="chip ${ui.filter===v?'active':''}" data-action="product-filter" data-filter="${v}">${n}</button>`).join('')}</div><span class="subtle">${products.length} ürün</span></div><div class="panel table-panel">${productTable(products)}</div><p class="fineprint">“Faturası eksik” filtresi fatura belgesiyle ilişkilendirilmemiş ürünleri gösterir.</p>`;
  }
  function detailPage(){const p=getProduct(ui.productId);if(!p)return `${titleHeader('Ürün','Kayıt bulunamadı','İlgili ürün silinmiş veya henüz oluşturulmamış.')}${btn('Ürünlerim','goto','data-route-to="products"')}`;
    const s=warrantyStatus(p.id),pur=getPurchase(p.purchaseId),ws=getWarranty(p.id),cases=db.serviceCases.filter(c=>c.productId===p.id),docs=relatedDocs(p.id);const tabs=[['general','Genel Bilgiler'],['warranties','Garantiler'],['services','Servis Geçmişi'],['documents','Belgeler'],['timeline','Zaman Çizelgesi']];
    let body='';
    if(ui.tab==='general')body=`<div class="kv-grid">${[['Ürün adı',p.name],['Kategori',p.category],['Marka',p.brand],['Model',p.model],['Seri / IMEI',p.serial],['Kullanım durumu',p.status],['Satın alma tarihi',dateFormat(pur?.date)],['Teslim tarihi',dateFormat(pur?.deliveryDate)],['Satıcı',pur?.vendor],['Platform',pur?.platform],['Fatura numarası',pur?.invoiceNo],['Sipariş numarası',pur?.orderNo],['Satın alma fiyatı',money(pur?.price,pur?.currency)],['Notlar',p.notes]].map(([a,b])=>`<div class="kv"><label>${escape(a)}</label><p>${escape(b||'—')}</p></div>`).join('')}</div>`;
    if(ui.tab==='warranties')body=`<div class="line-header"><h3>Kayıtlı garantiler (${ws.length})</h3>${btn(`${icon('plus')} Garanti ekle`,'new-warranty',`data-pid="${escape(p.id)}"`,'btn-secondary btn-sm')}</div>${ws.length?ws.map(w=>{const n=daysTo(w.end);return `<div class="list-card warranty-card"><span class="list-icon">${icon('shield-check')}</span><div class="grow"><strong>${escape(w.type)}</strong><small>${escape(w.provider||'Sağlayıcı belirtilmedi')} · ${dateFormat(w.start)} – ${dateFormat(w.end)}</small><small>${escape(w.notes)}</small></div><div class="warranty-actions">${tag(n===null?'Tarih belirsiz':n<0?'Süresi doldu':dateRelative(n),n===null?'neutral':n<0?'bad':n<=90?'warn':'good')}<button class="btn btn-sm btn-secondary" type="button" data-action="edit-warranty" data-wid="${escape(w.id)}" title="Garanti kaydını düzenle">${icon('edit')} Düzenle</button><button class="btn btn-sm btn-danger" type="button" data-action="delete-warranty" data-wid="${escape(w.id)}" title="Garanti kaydını sil">${icon('trash-2')} Sil</button></div></div>`;}).join(''):simpleEmpty('shield-check','Garanti kaydı yok','Bu ürün için üretici, satıcı veya ek garanti tanımlayın.')}`;
    if(ui.tab==='services')body=`<div class="line-header"><h3>Servis dosyaları (${cases.length})</h3>${btn(`${icon('plus')} Servis aç`,'new-service',`data-pid="${escape(p.id)}"`,'btn-secondary btn-sm')}</div>${cases.length?cases.map(c=>`<div class="list-card clickable" data-action="goto" data-route-to="case" data-id="${escape(c.id)}"><span class="list-icon">${icon('wrench')}</span><div class="grow"><strong>${escape(c.issue)}</strong><small>${dateFormat(c.date)} · ${escape(c.provider||'Servis belirtilmedi')}</small></div>${tag(c.status,c.status==='Kapatıldı'?'good':c.status==='Sonuçlandı'?'blue':'warn')}</div>`).join(''):simpleEmpty('wrench','Servis geçmişi yok','Her arıza ve servis başvurusunu ayrı dosya olarak kaydedebilirsiniz.')}`;
    if(ui.tab==='documents')body=`<div class="line-header"><h3>İlişkili belgeler (${docs.length})</h3>${btn(`${icon('plus')} Belge ekle`,'new-document',`data-pid="${escape(p.id)}"`,'btn-secondary btn-sm')}</div>${docs.length?docs.map(documentRow).join(''):simpleEmpty('files','Belge bağlanmadı','Faturayı, garanti belgesini veya servis kanıtını ilişkilendirin.')}`;
    if(ui.tab==='timeline'){const events=[...db.serviceEvents.filter(e=>cases.some(c=>c.id===e.caseId)).map(e=>({date:e.date,title:e.type,desc:e.description})),...docs.map(d=>({date:d.createdAt,title:'Belge kaydı',desc:d.name})),{date:p.createdAt,title:'Ürün kaydı açıldı',desc:p.name}];body=`<div class="timeline">${events.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<div class="timeline-item"><time>${dateFormat(e.date)}</time><h4>${escape(e.title)}</h4><p>${escape(e.desc)}</p></div>`).join('')}</div>`;}
    const last=ws.filter(w=>w.end).sort((a,b)=>b.end.localeCompare(a.end))[0];
    return `<div class="page-head"><div><button class="btn btn-ghost btn-sm" data-route="products" style="padding-left:0">${icon('arrow-left')} Ürünlerim</button><div class="details-title" style="margin-top:17px"><span class="details-large-icon">${icon(iconFor(p))}</span><div><h1>${escape(p.name)}</h1><div class="detail-summary"><span class="muted mini">${escape([p.brand,p.model].filter(Boolean).join(' · ')||p.category)}</span>${tag(s.text,s.cls)}${p.status==='Arşivlendi'?tag('Arşivlendi'):''}</div></div></div></div><div class="page-actions">${btn(`${icon('edit')} Düzenle`,'edit-product',`data-pid="${escape(p.id)}"`)}${btn(`${icon('wrench')} Servis kaydı`,'new-service',`data-pid="${escape(p.id)}"`,'btn-primary')}</div></div>
    <div class="details-layout"><div class="panel"><div class="detail-tab-row">${tabs.map(t=>`<button class="detail-tab ${ui.tab===t[0]?'active':''}" data-action="detail-tab" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div>${body}</div>
    <aside class="detail-side"><div class="panel"><h3 class="panel-title">Garanti özeti</h3><div class="mini-divider"></div><div class="aside-info"><div><span class="subtle">Garanti bitişi</span><div class="aside-value">${dateFormat(last?.end)}</div></div><div>${tag(s.text,s.cls)}</div><div><span class="subtle">Garanti kaydı</span><div class="aside-value">${ws.length} adet</div></div></div></div>
    <div class="panel"><h3 class="panel-title">Hızlı işlemler</h3><div class="mini-divider"></div><div style="display:flex;flex-direction:column;gap:8px">${btn(`${icon('plus')} Garanti ekle`,'new-warranty',`data-pid="${escape(p.id)}"`)}${btn(`${icon('file-plus')} Belge ilişkilendir`,'new-document',`data-pid="${escape(p.id)}"`)}${btn(`${icon('archive')} ${p.status==='Arşivlendi'?'Arşivden çıkar':'Arşivle'}`,'toggle-archive',`data-pid="${escape(p.id)}"`)}</div></div>
    <div class="info-strip">${icon('info')} Belgeler özel Google Drive hesabınızda tutulur. Drive bağlantısı Ayarlar ekranından yönetilir.</div></aside></div>`;
  }
  function servicesPage(){let cases=[...db.serviceCases];if(ui.serviceFilter==='open')cases=cases.filter(isActiveCase);if(ui.serviceFilter==='closed')cases=cases.filter(c=>!isActiveCase(c));cases.sort((a,b)=>(b.date||'').localeCompare(a.date||''));return `${titleHeader('Servis ve başvurular','Servis İşlemleri',`${db.serviceCases.filter(isActiveCase).length} açık servis · Arıza, onarım ve değişim süreçleri`,btn(`${icon('plus')} Yeni servis kaydı`,'new-service','','btn-primary'))}<div class="filter-bar"><div class="filters">${[['all','Tümü'],['open','Açık işlemler'],['closed','Sonuçlananlar']].map(([v,n])=>`<button class="chip ${ui.serviceFilter===v?'active':''}" data-action="service-filter" data-filter="${v}">${n}</button>`).join('')}</div><span class="subtle">${cases.length} servis dosyası</span></div>${cases.length?`<div class="case-grid">${cases.map(c=>`<article class="case-card" data-action="goto" data-route-to="case" data-id="${escape(c.id)}"><div class="case-head"><span class="subtle">${escape(c.reference||c.id.slice(0,12))}</span>${tag(c.status,c.status==='Kapatıldı'?'good':c.status==='Sonuçlandı'?'blue':c.status==='Yanıt / İşlem Bekleniyor'?'warn':'neutral')}</div><h3>${escape(productName(c.productId))}</h3><p>${escape(c.issue)}</p><div class="case-foot"><span>${icon('calendar-days')} ${dateFormat(c.date)}</span><span>${c.nextActionDate&&isActiveCase(c)?`Takip: ${dateFormat(c.nextActionDate)}`:'Detayı gör →'}</span></div></article>`).join('')}</div>`: `<div class="panel">${simpleEmpty('wrench','Bu filtrede servis kaydı yok','Yeni bir servis kaydı oluşturabilirsiniz.')}</div>`}`;}
  function casePage(){const c=getCase(ui.caseId);if(!c)return `${titleHeader('Servis','Kayıt bulunamadı','Servis dosyası bulunamadı.')}${btn('Servislere dön','goto','data-route-to="services"')}`;const events=db.serviceEvents.filter(e=>e.caseId===c.id).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),docs=relatedDocs(c.productId,c.id),p=getProduct(c.productId);
    return `${titleHeader('Servis dosyası',`Servis Detayı`,`${p?`${escape(p.name)} · `:''}${escape(c.reference||'Başvuru numarası girilmedi')}`,`${btn(`${icon('edit')} Durumu güncelle`,'edit-service',`data-cid="${escape(c.id)}"`)}${btn(`${icon('plus')} İşlem ekle`,'new-event',`data-cid="${escape(c.id)}"`,'btn-primary')}`)}
    <div class="details-layout"><div><section class="panel" style="margin-bottom:17px"><div class="panel-head"><h3 class="panel-title">Başvuru ve işlem bilgileri</h3>${tag(c.status,c.status==='Kapatıldı'?'good':c.status==='Sonuçlandı'?'blue':'warn')}</div><div class="kv-grid">${[['Ürün',productName(c.productId)],['Arıza / Talep',c.issue],['Başvuru tarihi',dateFormat(c.date)],['Servis kuruluşu',c.provider],['Başvuru numarası',c.reference],['Garanti değerlendirmesi',c.decision],['İşlem sonucu',c.outcome],['Maliyet',money(c.cost)],['Takip tarihi',dateFormat(c.nextActionDate)],['Kapanış tarihi',dateFormat(c.closedAt)]].map(([k,v])=>`<div class="kv"><label>${escape(k)}</label><p>${escape(v||'—')}</p></div>`).join('')}</div></section>
    <section class="panel"><div class="panel-head"><div><h3 class="panel-title">İşlem geçmişi</h3><p class="panel-desc">Yapılan tüm başvurular, görüşmeler ve değişiklikler</p></div>${btn(`${icon('plus')} İşlem ekle`,'new-event',`data-cid="${escape(c.id)}"`,'btn-sm')}</div>${events.length?`<div class="timeline">${events.map(e=>`<div class="timeline-item"><time>${dateFormat(e.date)}</time><h4>${escape(e.type)}</h4><p>${escape(e.description||'Açıklama yok')}</p></div>`).join('')}</div>`:simpleEmpty('list-checks','Henüz işlem bulunmuyor','Servis başvurusu için ilk işlemi ekleyin.')}</section></div><aside class="detail-side"><section class="panel"><div class="panel-head"><h3 class="panel-title">Dosya belgeleri</h3>${btn(`${icon('plus')} Ekle`,'new-document',`data-pid="${escape(c.productId)}" data-cid="${escape(c.id)}"`,'btn-sm')}</div>${docs.length?docs.map(documentRow).join(''):simpleEmpty('files','Belge yok','Servis raporu veya teslim belgesi ilişkilendirin.')}</section><section class="panel"><h3 class="panel-title">İlgili ürün</h3><p class="panel-desc" style="margin:12px 0">${escape(p?.name||'Kayıt bulunamadı')}</p>${btn(`${icon('arrow-up-right')} Ürün kartına git`,'goto',`data-route-to="detail" data-id="${escape(c.productId)}"`)}</section></aside></div>`;
  }
  function documentRow(d){
    const links=db.documentLinks.filter(l=>l.documentId===d.id);
    const health = !d.driveFileId ? ['Eksik bağlantı','warn'] : d.driveStatus==='ok'?['Erişim doğrulandı','good'] : d.driveStatus==='unavailable'?['Erişilemiyor','bad'] : d.driveStatus==='error'?['Kontrol hatası','warn'] : ['Drive dosyası','neutral'];
    const checked=d.driveCheckedAt?` · Kontrol: ${escape(d.driveCheckedAt.slice(0,10))}`:'';
    return `<div class="document-row"><span class="doc-symbol">${icon('file-text')}</span><div class="grow"><strong title="${escape(d.name)}">${escape(d.name)}</strong><small>${escape(d.kind)} · ${dateFormat(d.createdAt)} · ${links.length} bağlantı${checked}</small></div>${tag(health[0],health[1])}${d.driveFileId?`<button class="icon-button" data-action="doc-open" data-docid="${escape(d.id)}" title="Drive üzerinde aç">${icon('external-link')}</button>`:''}<button class="icon-button" data-action="doc-info" data-docid="${escape(d.id)}" aria-label="Belge ayrıntısı" title="Belge ayrıntısı">${icon('info')}</button><button class="icon-button doc-remove-icon" data-action="doc-delete-options" data-docid="${escape(d.id)}" title="Kanıtı kaldır / sil" aria-label="Kanıtı kaldır / sil">${icon('trash-2')}</button></div>`;
  }
  async function verifyDocuments(){
    if(checkingDocuments)throw new Error('Belge kontrolü zaten devam ediyor.');
    if(!drive.connected())throw new Error('Belge kontrolü için Ayarlar üzerinden Google Drive hesabını bağlayın.');
    const docs=db.documents.filter(d=>d.driveFileId);
    if(!docs.length){toast('Kontrol edilecek Drive belgesi bulunamadı.','warn');return;}
    if(docs.length>150)throw new Error('Toplu belge kontrolü ilk sürümde 150 kayıtla sınırlandırıldı.');
    checkingDocuments=true;
    const updates=new Map(); let ok=0,unavailable=0,failed=0;
    try{
      for(const item of docs){
        let status='ok';
        try{
          const meta=await drive.getMetadata(item.driveFileId);
          if(meta.trashed)status='unavailable';
        } catch(e){
          if(/401|erişim süresi doldu/i.test(e.message))throw new Error('Drive oturumunun süresi doldu. Yeniden bağlayıp kontrolü tekrar başlatın.');
          if(/HTTP (403|404)/.test(e.message))status='unavailable';
          else if(/HTTP 429/.test(e.message))throw new Error('Drive istek sınırına ulaşıldı. Daha sonra yeniden deneyin.');
          else status='error';
        }
        updates.set(item.id,{driveStatus:status,driveCheckedAt:new Date().toISOString()});
        if(status==='ok')ok++;else if(status==='unavailable')unavailable++;else failed++;
      }
      for(const d of db.documents){const u=updates.get(d.id);if(u)Object.assign(d,u);}
      await persist();render();
      toast(`Drive belge kontrolü: ${ok} erişilebilir, ${unavailable} erişilemiyor, ${failed} kontrol hatası.`,unavailable||failed?'warn':'success');
    }finally{checkingDocuments=false;}
  }
  function documentsPage(){let docs=[...db.documents].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));if(ui.docFilter!=='all')docs=docs.filter(d=>d.kind===ui.docFilter);const q=ui.docSearch.toLocaleLowerCase('tr-TR').trim();if(q)docs=docs.filter(d=>[d.name,d.kind].some(t=>String(t||'').toLocaleLowerCase('tr-TR').includes(q)));return `${titleHeader('Kanıt ve evraklar','Belge Arşivi',`${db.documents.length} Drive belge kaydı`,btn(`${icon('refresh-cw')} Erişimi kontrol et`,'verify-documents','','btn-secondary')+btn(`${icon('edit')} Eski belgeleri adlandır`,'bulk-names','','btn-secondary')+btn(`${icon('plus')} Belge ilişkilendir`,'new-document','','btn-primary'))}
    <div class="info-strip" style="margin-bottom:18px">${icon('cloud-off')} Drive bağlantısı varsa «Erişimi kontrol et» ile kayıtların durumunu doğrulayabilirsiniz. Erişilemiyor işareti dosyanın silindiğini kesin olarak göstermez. Yüklenen dosyalar özel Google Drive alanınızda saklanır. Belge açmak ve yüklemek için Drive bağlantısı gerekebilir.</div><div class="toolbar"><label class="searchbox">${icon('search')}<input id="docSearch" type="search" value="${escape(ui.docSearch)}" placeholder="Belge adı veya türü ara" aria-label="Belgelerde ara"></label><select id="docFilter" class="filter-select" aria-label="Belge türü filtresi"><option value="all">Tüm belge türleri</option>${choices(OPTIONS.documentKinds,ui.docFilter,null)}</select></div><div class="panel"><div class="panel-head"><h3 class="panel-title">Tüm belgeler</h3><span class="subtle">${docs.length} sonuç</span></div>${docs.length?docs.map(documentRow).join(''):simpleEmpty('files','Belge bulunamadı','Dosya ekleyebilir veya filtreleri değiştirebilirsiniz.')}</div>`;}
  function remindersPage(){const alerts=actionableReminders();return `${titleHeader('Uyarılar ve takip','Hatırlatmalar',`Uygulama açıldığında hesaplanan ${alerts.length} dikkat gerektiren kayıt`,btn(`${icon('plus')} Hatırlatma ekle`,'new-reminder','','btn-primary'))}
    <div class="info-strip" style="margin-bottom:20px">${icon('info')} Henüz arka plan servisi yoktur. Bu uyarılar yalnızca uygulamayı açtığınızda veya sayfa içindeki işlemler sonrasında hesaplanır.</div>
    <div class="panel"><div class="panel-head"><div><h3 class="panel-title">Yaklaşan tarihler</h3><p class="panel-desc">Garanti için 90 gün, servis ve özel hatırlatmalar için 30 gün penceresi</p></div></div>${alerts.length?alerts.map(a=>`<div class="reminder-card"><span class="reminder-indicator">${icon(a.type==='warranty'?'shield-check':a.type==='service'?'wrench':'bell')}</span><div class="grow"><h3>${escape(a.title)}</h3><p>${escape(a.detail)}</p></div>${tag(dateRelative(a.days),a.days<=7?'bad':'warn')}<button class="icon-button" title="İlgili kayda git" data-action="goto" data-route-to="${a.type==='service'?'case':a.productId?'detail':'reminders'}" data-id="${escape(a.caseId||a.productId||'')}">${icon('chevron-right')}</button>${a.type==='manual'?`<button class="icon-button" title="Tamamla" data-action="complete-reminder" data-rid="${escape(a.id)}">${icon('check-circle')}</button>`:''}</div>`).join(''):simpleEmpty('check-circle','Şimdilik bir uyarı yok','Biten garantiler ve yaklaşan servis takipleri burada görünecek.')}</div>
    <p class="fineprint">Garanti bitişi 90 gün veya daha az olan aktif ürünler gösterilir. Süresi dolmuş garantiler Ürünlerim filtresinde yer alır.</p>`;}
  function downloadText(filename,text,mime='text/plain;charset=utf-8'){
    const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function reportsPage(){
    const report=makeReport(db,{from:ui.reportFrom,to:ui.reportTo,productId:ui.reportProduct});
    const summary=report.summary;
    const number=n=>new Intl.NumberFormat('tr-TR').format(n);
    const stat=[['Servis Dosyaları',number(summary.cases)],['Açık İşlemler',number(summary.open)],['Ürün Değişimi',number(summary.replacements)],['Parça Değişimi',number(summary.partChanges)],['Toplam Onarım Gideri',money(summary.totalCost)],['Ortalama Servis Süresi',summary.averageDays===null?'Veri yok':summary.averageDays+' gün']];
    return `${titleHeader('Servis geçmişi ve analiz','Raporlar','İşlemleri ürün ve tarih aralığına göre inceleyin. Raporlar yalnızca Firebase kayıtlarını kullanır.',btn(`${icon('download')} CSV indir`,'report-csv','','btn-primary')+btn('Yazdır / PDF','report-print','','btn-secondary'))}
    <section class="panel report-filters"><div class="form-grid">${field('reportFrom','Başlangıç tarihi',ui.reportFrom,'date')}${field('reportTo','Bitiş tarihi',ui.reportTo,'date')}<div class="field span-2"><label>Ürün</label><select name="reportProduct"><option value="">Tüm ürünler</option>${db.products.map(p=>`<option value="${escape(p.id)}" ${ui.reportProduct===p.id?'selected':''}>${escape(p.name)}</option>`).join('')}</select></div></div></section>
    <div class="stat-grid report-kpi">${stat.map(([a,b])=>`<div class="stat-card"><div class="stat-value report-value">${escape(b)}</div><div class="stat-label">${escape(a)}</div></div>`).join('')}</div>
    <section class="panel"><div class="panel-head"><div><h3 class="panel-title">Servis ve değişim kayıtları</h3><p class="panel-desc">${report.rows.length} kayıt · tarihler başvuru tarihine göre filtrelenir</p></div></div>
    ${report.rows.length?`<div class="nowrap-scroll"><table class="report-table"><thead><tr><th>Ürün</th><th>Tarih</th><th>Talep</th><th>Durum</th><th>İşlem</th><th>Maliyet</th><th>Süre</th></tr></thead><tbody>${report.rows.map(r=>`<tr><td>${escape(r.product)}</td><td>${escape(dateFormat(r.date))}</td><td>${escape(shortText(r.issue,55))}</td><td>${escape(r.status)}</td><td>${r.replacement?'Ürün değişimi':r.parts?'Parça değişimi':escape(shortText(r.outcome||r.decision,35))}</td><td>${escape(r.cost===''?'—':money(r.cost))}</td><td>${escape(r.days===''?'—':r.days+' gün')}</td></tr>`).join('')}</tbody></table></div>`:simpleEmpty('list-checks','Bu filtrede servis kaydı yok','Tarih veya ürün filtresini değiştirebilirsiniz.')}</section>
    <p class="fineprint">Ürün değişimi ve parça değişimi sayıları, geçmişe kaydettiğiniz ilgili işlem türlerinden hesaplanır. Ortalama süre yalnızca kapanış tarihi girilmiş sonuçlanmış dosyalardan hesaplanır. Eksik alanlar tahmin edilmez.</p>`;
  }
  async function syncNotificationFeed(notify=true){
    if(notificationSyncing){pendingNotificationSync=true;return;}
    if(!drive.connected())throw Error('Önce Google Drive hesabınızı Ayarlar menüsünden bağlayın.');
    notificationSyncing=true;
    try{
      const folders=await drive.ensureFolders(db.settings);
      // Only write the settings to Firebase when the initial file ID needs registering.
      const feed=createNotificationFeed(db,new Date().toISOString());
      const oldId=db.settings.notificationFeedFileId||'';
      const saved=await drive.syncNotificationFeed(oldId,folders.driveRootId,feed);
      notificationSyncError='';
      if(saved?.id && saved.id!==oldId){
        Object.assign(db.settings,folders,{notificationFeedFileId:saved.id,notificationFeedUpdatedAt:new Date().toISOString(),emailNoticesEnabled:true});
        await persist();
      }else if(notify){
        db.settings.notificationFeedUpdatedAt=new Date().toISOString();
        // Persist the timestamp only after an explicit sync; automated sync does not modify Firebase settings.
        await persist();
      }
      if(notify){render();toast('Hatırlatma listesi Drive ile eşitlendi. E-posta göndermek için Apps Script tetikleyicisini ayrıca kurun.');}
      return saved?.id;
    }finally{
      notificationSyncing=false;
      if(pendingNotificationSync){pendingNotificationSync=false;Promise.resolve().then(()=>syncNotificationFeed(false)).catch(err=>{notificationSyncError=err.message;});}
    }
  }
  function settingsPage(){const user=cloud?.user();const driveOn=!!drive?.connected();return `${titleHeader('Hesap ve sistem','Ayarlar','Google hesabı, Drive bağlantısı ve veri yedekleme')}
    <div class="two-cols"><section class="panel"><div class="panel-head"><h3 class="panel-title">Hesap ve bağlantılar</h3></div><div class="setting-row"><div><h3>Google hesabı</h3><p>${escape(user?.email||'Bağlı değil')} · UID: ${escape(user?.uid||'—')}</p></div>${tag('Doğrulandı','good')}</div><div class="setting-row"><div><h3>Google Drive</h3><p>${driveOn?'Aynı Google hesabı doğrulandı; dosyalara erişebilirsiniz.':'Dosya yüklemek veya seçmek için Drive bağlantısını etkinleştirin.'}</p></div>${driveOn?tag('Bağlı','good'):btn(`${icon('folder-open')} Drive'ı bağla`,'connect-drive','','btn-sm btn-primary')}</div><div class="setting-row"><div><h3>Drive arşiv klasörü</h3><p>${db.settings.driveRootId?`Arşiv: ${escape(db.settings.driveRootName||'GarantiTakip')}${db.settings.driveParentName?` · Üst klasör: ${escape(db.settings.driveParentName)}`:''}`:'İlk dosya yüklemesinde GarantiTakip klasörü oluşturulur.'} · Faturalar ve ürün belgeleri bunun altında tutulur.</p></div><div class="setting-actions">${btn('Klasörü aç','open-archive','','btn-sm')}${btn('Konum değiştir','change-archive-folder','','btn-sm')}${btn('Adını değiştir','rename-archive-folder','','btn-sm')}</div></div><div class="setting-row"><div><h3>Firebase Realtime Database</h3><p>Gerçek kayıtlar kullanıcı UID altında saklanır.</p></div>${tag('Bulutta','good')}</div><div class="setting-row"><div><h3>Oturum</h3><p>Google oturumundan çıkış yapabilirsiniz.</p></div>${btn('Çıkış yap','sign-out','','btn-sm')}</div></section>
    <section class="panel"><div class="panel-head"><h3 class="panel-title">Veri yönetimi</h3></div><div class="setting-row"><div><h3>JSON yedeğini indir</h3><p>Ürün, garanti, servis ve Drive dosya referanslarını içerir; PDF içermez.</p></div>${btn(`${icon('download')} Dışa aktar`,'export-json','','btn-sm')}</div><div class="setting-row"><div><h3>JSON yedeğini içe aktar</h3><p>İsteğe bağlı geri yükleme; mevcut bulut kayıtlarının üzerine yazar.</p></div>${btn(`${icon('upload')} İçe aktar`,'import-json','','btn-sm')}</div><div class="info-strip">${icon('info')} JSON dosyası seri numaraları ve fatura bilgileri içerir; güvenli yerde saklayın. Drive belgeleri ayrıca yedeklenmelidir.</div></section></div>
    <section class="panel" style="margin-top:18px"><div class="panel-head"><h3 class="panel-title">Otomatik e-posta hatırlatmaları</h3>${tag(db.settings.notificationFeedFileId?'Drive listesi hazır':'Kurulum gerekli',db.settings.notificationFeedFileId?'good':'warn')}</div><p class="panel-desc">Ürün isimleri, garanti bitişleri ve servis takip tarihleri Google Drive'ınızdaki özel JSON dosyasına aktarılır. Uygulama açıkken ve Drive bağlıyken değişiklikler eşitlenir. E-posta gönderimi için Google Apps Script'te ayrıca günlük zamanlayıcı kurulur.</p><div class="setting-row"><div><h3>Hatırlatma listesi</h3><p>Drive dosya kimliği: <code>${escape(db.settings.notificationFeedFileId||'Henüz oluşturulmadı')}</code></p><p>${db.settings.notificationFeedUpdatedAt?'Son eşitleme: '+escape(db.settings.notificationFeedUpdatedAt):'Eşitleme yapılmadı.'}</p>${notificationSyncError?`<p class="sync-alert">Son eşitleme hatası: ${escape(notificationSyncError)}</p>`:''}</div>${btn('Drive ile eşitle','sync-reminder-feed','','btn-sm btn-primary')}</div><p class="fineprint">E-posta içeriği fatura, fiyat ve seri numarası içermez. Drive erişimi kapalıyken veya eşitleme başarısızsa listede güncel olmayan bilgiler bulunabilir. Bu işlem tek başına e-posta göndermez.</p></section>
    <section class="panel" style="margin-top:18px"><div class="panel-head"><h3 class="panel-title">Sürüm ve kapsam</h3>${tag('Faz 7','blue')}</div><div class="kv-grid">${[['Arayüz','HTML + CSS + JavaScript'],['Kimlik doğrulama','Firebase Google Auth'],['Veritabanı','Firebase Realtime Database'],['Dosyalar','Google Drive API + Google Picker'],['Dosya yetkisi','drive.file (kısıtlı erişim)'],['Yedekleme','JSON dışa aktarma / geri yükleme'],['Sürüm','Faz 7 Fatura + Rapor + E-posta']].map(([a,b])=>`<div class="kv"><label>${a}</label><p>${escape(b)}</p></div>`).join('')}</div></section>`;}
  const field=(name,label,value='',type='text',attrs='',span='')=>`<div class="field ${span}"><label for="f_${name}">${label}</label><input id="f_${name}" name="${name}" type="${type}" ${attrs} value="${escape(value)}"></div>`;
  const selectField=(name,label,list,current='',blank='Seçiniz',span='')=>`<div class="field ${span}"><label for="f_${name}">${label}</label><select id="f_${name}" name="${name}">${choices(list,current,blank)}</select></div>`;
  const textareaField=(name,label,value='',span='span-2')=>`<div class="field ${span}"><label for="f_${name}">${label}</label><textarea id="f_${name}" name="${name}" rows="3">${escape(value)}</textarea></div>`;
  function showModal(title,body,footer='',size='',subtitle=''){document.getElementById('modalLayer').innerHTML=`<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${escape(title)}"><div class="modal-head"><div><h2>${escape(title)}</h2>${subtitle?`<p>${escape(subtitle)}</p>`:''}</div><button class="icon-button" data-action="close-modal" title="Kapat">${icon('x')}</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</div></div>`;const el=document.querySelector('#modalLayer input:not([type=hidden]),#modalLayer select');if(el)el.focus();}
  function closeModal(){stagedUpload=null;document.getElementById('modalLayer').innerHTML='';}
  const footer=(form,label='Kaydet')=>`${btn('Vazgeç','close-modal') }<button class="btn btn-primary" type="submit" form="${form}">${icon('check-circle')} ${label}</button>`;
  function productModal(id){const p=id?getProduct(id):null,pu=p?getPurchase(p.purchaseId):null,already=p?.purchaseId||'';
    const body=`<form id="productForm" data-form="product" data-edit-id="${escape(id||'')}"><div class="form-section">01 · Ürün bilgileri</div><div class="form-grid">${field('name','Ürün adı <span class="required">*</span>',p?.name||'','text','required maxlength="140"')}${selectField('category','Kategori <span class="required">*</span>',OPTIONS.categories,p?.category||'','Seçiniz')}${field('brand','Marka',p?.brand||'')}${field('model','Model',p?.model||'')}${field('serial','Seri No / IMEI',p?.serial||'')}${selectField('status','Kullanım durumu',OPTIONS.productStatus,p?.status||'Kullanımda',null)}${textareaField('notes','Notlar',p?.notes||'')}</div>
    <hr class="form-divider"><div class="form-section">02 · Satın alma ve fatura</div><div class="form-grid">${selectField('existingPurchase','Mevcut fatura / alış kaydı',db.purchases.map(x=>`${x.id} | ${x.invoiceNo||x.vendor||'Faturasız'}`),already?`${already} | ${pu?.invoiceNo||pu?.vendor||'Faturasız'}`:'','Yeni satın alma kaydı oluştur / boş bırak','span-2')}${field('vendor','Satıcı',pu?.vendor||'')}${field('platform','Mağaza / Platform',pu?.platform||'')}${field('date','Satın alma tarihi',pu?.date||'','date')}${field('deliveryDate','Teslim tarihi',pu?.deliveryDate||'','date')}${field('price','Satın alma fiyatı',pu?.price??'','number','min="0" step="0.01"')}${selectField('currency','Para birimi',['TRY','USD','EUR','GBP'],pu?.currency||'TRY',null)}${field('invoiceNo','Fatura numarası',pu?.invoiceNo||'')}${field('orderNo','Sipariş numarası',pu?.orderNo||'')}</div><div class="fineprint">Aynı faturayı birden fazla ürüne bağlamak için mevcut alış kaydını seçin. Bu durumda yeni satın alma alanları dikkate alınmaz.</div><div class="invoice-tool"><h3>Faturadan bilgileri öner</h3><p>PDF/JPG/PNG yükleyerek satıcı, fatura tarihi, numarası ve tutarı çıkarabilirsiniz. İşlem tarayıcınızda yapılır; bilgiler onayınız olmadan kaydedilmez. Çok ürünlü faturada genel tutar ürün fiyatı olmayabilir.</p><div class="invoice-buttons"><input type="file" name="invoicePdf" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" aria-label="Okunacak faturayı seç"><button type="button" class="btn btn-secondary" data-action="analyze-invoice">${icon('file-text')} Faturayı oku</button></div><div id="invoicePreview" role="status"></div></div></form>`;
    showModal(p?'Ürün Bilgilerini Düzenle':'Yeni Ürün Kaydı',body,footer('productForm',p?'Değişiklikleri kaydet':'Ürünü kaydet'),'wide','Eksik bilgiler sonradan tamamlanabilir.');
  }
  function warrantyModal(pid,wid){
    const w=wid?db.warranties.find(x=>x.id===wid):null;
    if(wid&&!w)throw new Error('Düzenlenecek garanti kaydı bulunamadı.');
    if(w && w.productId!==pid)throw new Error('Garanti farklı ürüne ait.');
    const body=`<form id="warrantyForm" data-form="warranty" data-edit-id="${escape(wid||'')}"><input type="hidden" name="productId" value="${escape(pid)}"><div class="form-grid">${selectField('type','Garanti türü',OPTIONS.warrantyTypes,w?.type||'Üretici Garantisi',null)}${field('provider','Garanti sağlayıcısı',w?.provider||'')}${field('start','Başlangıç tarihi',w?.start||'','date')}${field('durationMonths','Süre (ay)',w?.durationMonths??'','number','min="0" max="240" step="1"')}${field('end','Bitiş tarihi',w?.end||'','date')}${textareaField('notes','Garanti koşulları / açıklama',w?.notes||'')}</div><p class="fineprint">Başlangıç ve süre girilirse bitiş otomatik önerilir. Bitişi ayrıca elle değiştirebilirsiniz; kaydedilen tarih garanti durumunu ve uyarıları günceller.</p></form>`;
    showModal(w?'Garanti Kaydını Düzenle':'Yeni Garanti Kaydı',body,footer('warrantyForm',w?'Değişiklikleri kaydet':'Garantiyi kaydet'),'','Ürün: '+productName(pid));
  }
  function serviceModal(pid,cid){const c=cid?getCase(cid):null;const selectedPid=c?.productId||pid||db.products.filter(p=>p.status!=='Arşivlendi')[0]?.id||'';const productOpts=db.products.filter(p=>p.status!=='Arşivlendi'||p.id===selectedPid).map(p=>`<option value="${escape(p.id)}" ${p.id===selectedPid?'selected':''}>${escape(p.name)}</option>`).join('');const body=`<form id="serviceForm" data-form="service" data-edit-id="${escape(cid||'')}"><div class="form-grid"><div class="field span-2"><label>İlişkili ürün <span class="required">*</span></label><select name="productId" required>${productOpts}</select></div>${textareaField('issue','Arıza / talep açıklaması <span class="required">*</span>',c?.issue||'')}${field('date','Başvuru tarihi',c?.date||iso(new Date()),'date','required')}${field('reference','Başvuru numarası',c?.reference||'')}${field('provider','Servis kuruluşu',c?.provider||'')}${selectField('status','İşlem durumu',OPTIONS.serviceStatuses,c?.status||'Başvuru Açıldı',null)}${field('nextActionDate','Takip tarihi',c?.nextActionDate||'','date')}${field('decision','Garanti değerlendirmesi',c?.decision||'')}${textareaField('outcome','Yapılan işlem / sonuç',c?.outcome||'')}${field('cost','Ödenen tutar (TRY)',c?.cost??0,'number','min="0" step="0.01"')}${field('closedAt','Kapanış tarihi',c?.closedAt||'','date')}</div></form>`;showModal(c?'Servis Dosyasını Güncelle':'Yeni Servis Kaydı',body,footer('serviceForm',c?'Değişiklikleri kaydet':'Servis kaydı aç'),'wide');}
  function eventModal(cid){const body=`<form id="eventForm" data-form="event"><input type="hidden" name="caseId" value="${escape(cid)}"><div class="form-grid">${selectField('type','İşlem türü',OPTIONS.eventTypes,'Görüşme',null)}${field('date','İşlem tarihi',iso(new Date()),'date','required')}${textareaField('description','Yapılan işlem / açıklama <span class="required">*</span>')}</div></form>`;showModal('Servis İşlemi Ekle',body,footer('eventForm'),'','Her yeni işlem geçmişe ayrı bir kayıt olarak eklenir.');}
  function documentNamePreview(){
    const f=document.getElementById('documentForm'),out=document.getElementById('documentNamePreview');
    if(!f||!out)return;
    if(f.querySelector('[name=existingDoc]')?.value){out.textContent='Kayıtlı belge yeniden yüklenmez ve adı değiştirilmez.';return;}
    if(f.dataset.docMode==='drive'){out.textContent='Drive’dan seçilen dosyanın mevcut adı korunur. İlişkilendirdikten sonra belge ayrıntısından yeniden adlandırabilirsiniz.';return;}
    const file=f.querySelector('[name=localFile]')?.files?.[0];
    if(!file){out.textContent='Fotoğraf veya PDF seçtiğinizde Drive’a kaydedilecek anlaşılır dosya adı burada görünecek.';return;}
    const pid=f.querySelector('[name=productId]')?.value, kind=f.querySelector('[name=kind]')?.value;
    const date=f.querySelector('[name=documentDate]')?.value, description=f.querySelector('[name=documentDescription]')?.value;
    try{out.textContent=makeDocumentFilename({productName:productName(pid),documentDate:date,kind,description,fileName:file.name,mimeType:file.type,uniqueCode:f.dataset.fileCode});}
    catch(err){out.textContent=err.message;}
  }
  function documentModal(pid,cid){pickedDriveFile=null;stagedUpload=null;const p=pid||db.products.filter(x=>x.status!=='Arşivlendi')[0]?.id||'';const productOpts=db.products.filter(x=>x.status!=='Arşivlendi'||x.id===p).map(x=>`<option value="${escape(x.id)}" ${x.id===p?'selected':''}>${escape(x.name)}</option>`).join('');
    const body=`<div class="info-strip">${icon('info')} Belgeler Google Drive hesabınıza yüklenir veya Picker ile mevcut Drive dosyasından seçilir. Kaynak dosyası Firebase'e kopyalanmaz.</div><div class="radio-tabs"><button class="radio-tab active" type="button" data-action="doc-mode" data-mode="device">${icon('upload')} Cihazdan yükle</button><button class="radio-tab" type="button" data-action="doc-mode" data-mode="drive">${icon('folder-open')} Drive'dan seç</button></div><form id="documentForm" data-form="document" data-doc-mode="device"><div class="form-grid"><div class="field span-2"><label>İlişkili ürün <span class="required">*</span></label><select name="productId" required>${productOpts}</select></div><div class="field span-2"><label>İlişkili servis (isteğe bağlı)</label><select name="caseId"><option value="">Ürün belgesi</option>${db.serviceCases.filter(c=>c.productId===p).map(c=>`<option value="${escape(c.id)}" ${c.id===cid?'selected':''}>${escape(c.issue)}</option>`).join('')}</select></div><div class="field span-2"><label>Önceden kayıtlı belgeyi başka ürüne bağla</label><select name="existingDoc"><option value="">Yeni Drive dosya kaydı oluştur</option>${db.documents.filter(d=>d.driveFileId).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(d=>{const links=db.documentLinks.filter(l=>l.documentId===d.id),linkedNames=[...new Set(links.map(l=>productName(l.productId)))].slice(0,2).join(', ');return `<option value="${escape(d.id)}">${escape(`[${linkedNames||'Ürün yok'}] [${d.kind||'Belge'}] ${d.name}`)}</option>`;}).join('')}</select></div><div class="field span-2"><label>Belge türü</label><select name="kind">${choices(OPTIONS.documentKinds,'Fatura',null)}</select></div>${field('documentDate','Belge tarihi',getPurchase(getProduct(p)?.purchaseId)?.date||iso(new Date()),'date','required')}${field('documentDescription','Kısa açıklama (isteğe bağlı)','','text','maxlength="70" placeholder="Örn. Teknosa veya ekran arızası"')}</div><div class="filename-preview"><span>${icon('file-text')} Drive dosya adı önizlemesi</span><strong id="documentNamePreview"></strong></div><div id="devicePicker" style="margin-top:16px"><label class="upload-zone" style="display:block">${icon('upload')}<strong>PDF veya fotoğraf seçin</strong><small>Azami ${Number(services.config.maxUploadMB||25)} MB · Dosya özel Drive klasörüne aktarılır</small><input type="file" name="localFile" accept="application/pdf,image/*,.doc,.docx,.txt" /></label></div><div id="drivePicker" style="display:none;margin-top:16px"><div class="info-strip">${icon('info')} Drive bağlantısını önce Ayarlar sayfasından açmış olmalısınız.</div><button type="button" class="btn btn-secondary" data-action="pick-drive">${icon('folder-open')} Google Picker ile dosya seç</button><p class="fineprint" id="selectedDriveFile">Henüz Drive dosyası seçilmedi.</p></div></form>`;
    showModal('Belge İlişkilendir',body,footer('documentForm','Belgeyi kaydet'),'wide','Dosyalar sadece sizin Google Drive hesabınızda saklanır.');
    const form=document.getElementById('documentForm');form.dataset.fileCode=crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
    documentNamePreview();
  }
  function reminderModal(){const opts=db.products.map(p=>`<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('');const body=`<form id="reminderForm" data-form="reminder"><div class="form-grid">${field('title','Hatırlatma konusu <span class="required">*</span>','','text','required')}${field('date','Hatırlatma tarihi <span class="required">*</span>',daysFrom(7),'date','required')}<div class="field span-2"><label>İlgili ürün (isteğe bağlı)</label><select name="productId"><option value="">Genel hatırlatma</option>${opts}</select></div></div></form>`;showModal('Hatırlatma Oluştur',body,footer('reminderForm'),'','Uyarı uygulama içinde gösterilir; push bildirim gönderilmez.');}
  function toast(message,level='success'){const host=document.getElementById('toastLayer');if(!host)return;const e=document.createElement('div');e.className='toast';e.innerHTML=`${icon(level==='warn'?'alert':'check-circle')}<span>${escape(message)}</span>`;host.appendChild(e);window.setTimeout(()=>{if(e.isConnected)e.remove();},4200);}
  function exportJson(prefix='Yedek'){const content=JSON.stringify({app:'GarantiTakip',exportedAt:new Date().toISOString(),ownerUid:cloud?.user()?.uid||null,data:db,description:'Firebase kayıtları ve Drive dosya referanslarıdır; Drive dosyalarının kendisini içermez.'},null,2);const blob=new Blob([content],{type:'application/json'}),href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=`GarantiTakip_${prefix}_${iso(new Date())}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),5000);toast('JSON yedeği indirildi. Belgelerin dosya içerikleri dahil değildir.');}
  function infoDocument(id){const d=db.documents.find(x=>x.id===id);if(!d)return;const links=db.documentLinks.filter(l=>l.documentId===id);showModal('Belge Bilgileri',`<div class="kv-grid">${[['Dosya adı',d.name],['Orijinal dosya adı',d.originalName||'—'],['Belge tarihi',dateFormat(d.documentDate)],['Belge türü',d.kind],['Kaynak',d.source==='drive-picker'?'Mevcut Drive dosyası':"Uygulamadan Drive'a yükleme"],['Eklenme tarihi',dateFormat(d.createdAt)],['Drive dosya kimliği',d.driveFileId||'—'],['Bağlandığı ürünler',[...new Set(links.map(l=>productName(l.productId)))].join(', ')||'—'],['Servis dosyası',links.filter(l=>l.caseId).map(l=>getCase(l.caseId)?.issue||l.caseId).join(', ')||'—']].map(([k,v])=>`<div class="kv"><label>${escape(k)}</label><p>${escape(v)}</p></div>`).join('')}</div><div class="info-strip" style="margin-top:20px">${icon('folder-open')} Belge Google Drive'ın erişim izinleri kapsamında görüntülenir. JSON yedeği dosya içeriğini kapsamaz.</div>`,`${btn('Kapat','close-modal')}${d.driveFileId?btn(`${icon('edit')} Yeniden adlandır`,'rename-document',`data-docid="${escape(d.id)}"`):''}${d.driveFileId?btn("Drive'da aç",'doc-open',`data-docid="${escape(d.id)}"`,'btn-primary'):''}${btn(`${icon('trash-2')} Kaldır / sil`,'doc-delete-options',`data-docid="${escape(d.id)}"`,'btn-danger')}`,'narrow');}
  function deleteDocumentOptions(id){
    const d=db.documents.find(x=>x.id===id);
    if(!d)throw new Error('Belge kaydı artık mevcut değil.');
    const links=documentLinksFor(db,id);
    const canTrash=canTrashAppDocument(db,d);
    const rows=links.map(l=>{const caseName=l.caseId?` · Servis: ${getCase(l.caseId)?.issue||l.caseId}`:' · Ürün belgesi';return `<div class="document-link-item"><div><strong>${escape(productName(l.productId))}</strong><small>${escape(caseName)}</small></div><button class="btn btn-sm btn-secondary" data-action="doc-unlink-request" data-docid="${escape(d.id)}" data-pid="${escape(l.productId)}" data-cid="${escape(l.caseId||'')}">Bağlantıyı kaldır</button></div>`;}).join('');
    const intro=`<div class="doc-delete-intro"><strong>${escape(d.name)}</strong><p>${links.length} ürün/servis bağlantısı bulunuyor. Bir bağlantıyı kaldırmak diğerlerini etkilemez.</p></div>`;
    const body=`${intro}<div class="doc-delete-links"><h3>İlişkili kayıtlar</h3>${rows||'<p class="fineprint">Belge hiçbir ürüne bağlı değil.</p>'}</div><div class="doc-delete-notice">${icon('info')} <span><strong>GarantiTakip'ten kaldır:</strong> Firebase'deki belge referansını ve tüm ilişkilerini siler; dosya Drive'da kalır. <strong>Drive çöp kutusu:</strong> yalnızca uygulamadan yüklenmiş ve başka kayda bağlı olmayan dosyalar için kullanılabilir. Drive'dan seçilen diğer belgeler asla otomatik silinmez.</span></div>`;
    const footerHtml=`${btn('Vazgeç','close-modal')}${btn('Tüm kayıt bağlantılarını kaldır','doc-remove-all-request',`data-docid="${escape(d.id)}"`,'btn-secondary')}${canTrash?btn(`${icon('trash-2')} Drive çöp kutusuna taşı`,'doc-trash-request',`data-docid="${escape(d.id)}"`,'btn-danger'):''}`;
    showModal('Kanıtı Kaldır / Sil',body,footerHtml,'wide','Drive dosyaları yanlışlıkla silinmesin diye işlemler ayrılmıştır.');
  }
  async function applyDocumentRemoval(kind,id,productId='',caseId=''){
    if(deletingDocument)throw new Error('Belge işlemi zaten devam ediyor.');
    deletingDocument=true;
    let trashedFileId=null;
    try{
      const d=db.documents.find(x=>x.id===id);
      if(!d)throw new Error('Belge kaydı bulunamadı.');
      if(kind==='unlink'){
        removeDocumentLink(db,{documentId:id,productId,caseId});
      }else if(kind==='all'){
        removeDocumentCompletely(db,id);
      }else if(kind==='trash'){
        if(!canTrashAppDocument(db,d))throw new Error('Drive silme yalnızca uygulamadan yüklenen, tek bağlantılı ve başka belge kaydınca kullanılmayan dosyalar için mümkündür.');
        if(!drive.connected())throw new Error('Drive çöp kutusu işlemi için Ayarlar bölümünden Drive hesabını bağlayın.');
        const meta=await drive.getMetadata(d.driveFileId);
        if(meta.trashed)throw new Error('Dosya zaten Drive çöp kutusunda. Sadece GarantiTakip kaydını kaldırabilirsiniz.');
        if(meta.capabilities?.canTrash!==true)throw new Error('Drive bu dosya için çöp kutusuna taşıma yetkisi doğrulamadı. Kaydı kaldırabilir veya Drive üzerinden yönetebilirsiniz.');
        await drive.setTrashed(d.driveFileId,true);
        trashedFileId=d.driveFileId;
        removeDocumentCompletely(db,id);
      }else throw new Error('Bilinmeyen silme işlemi.');
      try{await persist();}
      catch(err){
        if(trashedFileId){
          try{await drive.setTrashed(trashedFileId,false);throw new Error(`Firebase kaydı silinemedi; dosya Drive çöp kutusundan geri alındı. ${err.message}`);}
          catch(restoreErr){
            if(restoreErr.message.startsWith('Firebase kaydı silinemedi;'))throw restoreErr;
            throw new Error(`Firebase kaydı silinemedi ve Drive dosyası otomatik geri alınamadı. Drive çöp kutusundan dosyayı geri yükleyin. ${err.message} / ${restoreErr.message}`);
          }
        }
        throw err;
      }
      closeModal();render();
      toast(kind==='unlink'?'Seçilen belge bağlantısı kaldırıldı. Drive dosyası korundu.':kind==='all'?'Kanıt kayıtları kaldırıldı. Drive dosyası korundu.':'Belge Drive çöp kutusuna taşındı ve GarantiTakip kaydı kaldırıldı.');
    }finally{deletingDocument=false;}
  }
  function renameDocumentModal(id){
    const d=db.documents.find(x=>x.id===id);if(!d)throw new Error('Belge bulunamadı.');
    const linked=db.documentLinks.filter(x=>x.documentId===id);
    const {base,extension}=filenameParts(d.name,d.mimeType,false);
    const body=`<form id="renameDocumentForm" data-form="rename-document" data-doc-id="${escape(d.id)}"><div class="form-grid">${field('nameBase','Yeni dosya adı',base,'text','required maxlength="160"','span-2')}</div><p class="fineprint">Dosya uzantısı (${escape(extension||'uzantısız')}) değiştirilmeyecek. Yeniden adlandırma Google Drive üzerinde de yapılır. ${linked.length>1?`${linked.length} ürün/servis bağlantısı aynı dosyaya işaret ediyor; değişiklik hepsine yansır.`:'Dosya içeriği ve bağlantıları korunur.'}</p></form>`;
    showModal('Drive Dosyasını Yeniden Adlandır',body,footer('renameDocumentForm','Dosya adını güncelle'),'','Mevcut dosya: '+d.name);
  }
  function bulkRenameCandidates() {
    // Only documents uploaded by GarantiTakip. External Picker documents are never modified in bulk.
    const items=[];
    for(const d of db.documents){
      if(d.source!=='drive-upload'||!d.driveFileId)continue;
      const linked=db.documentLinks.find(l=>l.documentId===d.id);
      const p=linked&&getProduct(linked.productId);
      if(!p)continue;
      try{
        const proposed=historicalUploadName({document:d,productName:p.name});
        // Leave names generated by the current application as-is, rather than appending a second code.
        if(d.name===proposed||/ - [A-F0-9]{8,12}\.[a-z0-9]{1,10}$/i.test(d.name))continue;
        items.push({id:d.id,previous:d.name,proposed});
      }catch(err){ /* Unknown extension/date: user may rename individually. */ }
    }
    return items;
  }
  function bulkNamesPreview(){
    const items=bulkRenameCandidates().slice(0,20);
    if(!items.length){toast('Standart ada dönüştürülecek eski uygulama yüklemesi yok. Drive’dan bağlanan dosyalar için Belge Bilgileri > Yeniden adlandır kullanın.','warn');return;}
    const body=`<p class="fineprint">Yalnızca GarantiTakip ile yüklenen eski dosyalar işlenir. Önceki Drive'dan seçilen dış belgeler etkilenmez. Her dosyanın kimliği ve ürün bağlantıları korunur. Bir işlem başarısız olursa yapılanlar geri alınmaz; kalan belgeler daha sonra tekrar denenebilir.</p><div class="bulk-preview">${items.map(item=>`<div class="bulk-row"><small>${escape(item.previous)}</small><strong>→ ${escape(item.proposed)}</strong></div>`).join('')}</div><p class="fineprint">Bu turda ${items.length} belge işlenecek (en fazla 20). Dosyalar taşınmayacak veya silinmeyecek.</p>`;
    showModal('Eski Drive Dosyaları — Ad Önizlemesi',body,`${btn('Vazgeç','close-modal')}${btn('Bu isimlerle güncelle','bulk-names-confirm','','btn-primary')}`,'wide');
  }
  async function bulkNamesApply(){
    if(bulkNaming)throw Error('Toplu adlandırma zaten devam ediyor.');
    if(!drive.connected())throw Error('Önce Google Drive hesabını bağlayın.');
    const items=bulkRenameCandidates().slice(0,20);
    if(!items.length){closeModal();toast('Adlandırılacak belge kalmadı.');return;}
    if(!window.confirm(`${items.length} dosyanın Drive adı güncellenecek. Devam edilsin mi?`))return;
    bulkNaming=true;closeModal();let changed=0,failed=0;
    try{
      for(const item of items){
        const d=db.documents.find(x=>x.id===item.id);
        if(!d)continue;
        try{
          const current=await drive.getMetadata(d.driveFileId);
          if(current.trashed)throw new Error('Dosya Drive çöp kutusunda.');
          if(current.name!==d.name)throw new Error('Drive dosya adı uygulamadakinden farklı; önce tekil belge bilgisini kontrol edin.');
          const meta=await drive.renameFile(d.driveFileId,item.proposed);
          d.name=meta.name;d.renamedAt=new Date().toISOString();
          await persist();changed++;
        }catch(err){
          failed++;console.warn('Toplu adlandırma hatası',item.id,err);
          // Do not continue after a Firebase conflict or save error: Drive may already have changed.
          if(/Firebase|bulut|ÇAKIŞMA|Veri yazma|kayıt/i.test(err.message))throw new Error(`Drive'da değişiklik yapılmış olabilir. ${changed} kayıt kaydedildi. Kalanlar için yeniden denemeden önce sayfayı yenileyin. ${err.message}`);
          if(/401|erişim süresi|429/i.test(err.message))throw err;
        }
      }
      render();toast(`${changed} dosya yeniden adlandırıldı${failed?`, ${failed} dosyada işlem başarısız`:''}.`,failed?'warn':'success');
    }finally{bulkNaming=false;}
  }
  async function openArchive(){
    if(!drive.connected())throw Error('Önce Google Drive hesabınızı bağlayın.');
    let id=db.settings.driveRootId;
    if(!id){const folders=await drive.ensureFolders(db.settings);Object.assign(db.settings,folders);await persist();id=folders.driveRootId;}
    window.open(`https://drive.google.com/drive/u/0/folders/${encodeURIComponent(id)}`,'_blank','noopener,noreferrer');
  }
  async function changeArchiveLocation(){
    if(!drive.connected())throw Error('Önce Google Drive hesabınızı bağlayın.');
    const selected=await drive.pickFolder();if(!selected?.id)return;
    const target=await drive.getMetadata(selected.id);
    if(target.trashed||target.mimeType!=='application/vnd.google-apps.folder')throw Error('Hedef klasör geçersiz.');
    if(!window.confirm(`Drive arşiviniz ${target.name} klasörünün altına taşınacak. Bu işlem GarantiTakip klasörünü alt klasörleri ve mevcut yüklenen dosyalarıyla birlikte taşır; Google Picker ile ilişkilendirilen dış dosyalar taşınmaz. Devam edilsin mi?`))return;
    let root;
    if(db.settings.driveRootId){root=await drive.moveArchiveRoot(db.settings.driveRootId,target.id);}
    else{root=await drive.createArchiveIn(target.id,'GarantiTakip');}
    db.settings.driveRootId=root.id;
    db.settings.driveRootName=root.name||'GarantiTakip';
    db.settings.driveParentId=target.id;
    db.settings.driveParentName=target.name;
    try{await persist();}catch(err){throw new Error(`Drive klasörünün konumu değiştirildi ancak Firebase ayarı kaydedilemedi. Yeniden taşımayın; önce sayfayı yenileyip Drive'ı kontrol edin. ${err.message}`);}
    render();toast('GarantiTakip arşiv klasörü yeni konumuna taşındı.');
  }
  function archiveRenameModal(){
    if(!drive.connected())throw Error('Önce Google Drive hesabınızı bağlayın.');
    if(!db.settings.driveRootId)throw Error('Önce Klasörü aç seçeneğiyle arşivi oluşturun.');
    showModal('Drive Arşiv Klasörünü Adlandır',`<form id="archiveRenameForm" data-form="archive-rename"><div class="form-grid">${field('archiveName','Klasör adı',db.settings.driveRootName||'GarantiTakip','text','required maxlength="100"','span-2')}</div><p class="fineprint">Yalnızca üst klasörün adı değişir. Faturalar, ürün klasörleri ve belgelerin dosya kimlikleri korunur.</p></form>`,footer('archiveRenameForm','Klasör adını güncelle'));
  }
  function openDocument(id){const d=db.documents.find(x=>x.id===id);if(!d?.driveFileId){toast('Bu belgenin geçerli bir Drive dosya kimliği yok.','warn');return;}window.open(drive.openUrl({...d,id:d.driveFileId}), '_blank','noopener,noreferrer');}
  function confirmBox(title,text,yesLabel,action,attributes=''){showModal(title,`<div class="demo-warning">${icon('alert')}${escape(text)}</div>`,`${btn('Vazgeç','close-modal')}<button class="btn btn-danger" data-action="${action}" ${attributes}>${escape(yesLabel)}</button>`,'narrow');}
  async function eventAction(el){const a=el.dataset.action;
    if(a==='close-modal'){closeModal();return;}
    if(a==='modal-backdrop'){closeModal();return;}
    if(a==='goto'){navigate(el.dataset.routeTo,el.dataset.id);return;}
    if(a==='analyze-invoice'){
      const f=document.getElementById('productForm');if(!f)throw Error('Ürün formu açık değil.');
      const file=f.querySelector('[name=invoicePdf]')?.files?.[0];if(!file)throw Error('Önce bir fatura PDF veya fotoğrafı seçin.');
      const out=document.getElementById('invoicePreview');out.textContent='Fatura okunuyor; taranmış belgeler için OCR daha uzun sürebilir…';
      try{
        invoiceSuggestion=await extractInvoice(file,{ocr:true});
        const fields=[['Satıcı',invoiceSuggestion.vendor||'Belirlenemedi'],['Fatura numarası',invoiceSuggestion.invoiceNo||'Belirlenemedi'],['Fatura tarihi',invoiceSuggestion.date||'Belirlenemedi'],['Genel tutar',invoiceSuggestion.price===null?'Belirlenemedi':money(invoiceSuggestion.price,invoiceSuggestion.currency)]];
        out.innerHTML=`<div class="invoice-proposal">${fields.map(([label,value])=>`<div><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('')}<p>Okuma yöntemi: ${invoiceSuggestion.method==='ocr'?'OCR (fotoğraf veya tarama)':'PDF metni'}. Lütfen alanları faturayla karşılaştırın; otomatik okuma hata yapabilir.</p>${btn('Önerileri forma uygula','invoice-apply','','btn-sm btn-primary')}</div>`;
      }catch(err){invoiceSuggestion=null;out.textContent=err.message;}
      return;
    }
    if(a==='invoice-apply'){
      const f=document.getElementById('productForm');if(!f||!invoiceSuggestion)throw Error('Fatura önerisi bulunamadı.');
      if(f.elements.existingPurchase?.value)throw Error('Mevcut fatura seçili. Yeni bilgiler uygulamak için önce “Yeni satın alma kaydı” seçin.');
      if(!window.confirm('Okunan fatura bilgileri formdaki ilgili alanlara aktarılacak. Tutar, birden fazla ürünün toplamı olabilir. Devam edilsin mi?'))return;
      const vals={vendor:invoiceSuggestion.vendor,invoiceNo:invoiceSuggestion.invoiceNo,date:invoiceSuggestion.date,price:invoiceSuggestion.price??'',currency:invoiceSuggestion.currency};
      for(const [name,value] of Object.entries(vals))if(value!==''&&value!==null&&f.elements[name])f.elements[name].value=value;
      toast('Öneriler forma aktarıldı. Kaydetmeden önce kontrol edin.');return;
    }
    if(a==='report-csv'){
      const report=makeReport(db,{from:ui.reportFrom,to:ui.reportTo,productId:ui.reportProduct});
      downloadText(`GarantiTakip_Servis_Raporu_${iso(new Date())}.csv`,reportCSV(report.rows),'text/csv;charset=utf-8');return;
    }
    if(a==='report-print'){window.print();return;}
    if(a==='sync-reminder-feed'){await syncNotificationFeed(true);return;}
    if(a==='new-product'){productModal();return;}if(a==='edit-product'){productModal(el.dataset.pid);return;}
    if(a==='new-warranty'){warrantyModal(el.dataset.pid);return;}
    if(a==='edit-warranty'){const w=db.warranties.find(x=>x.id===el.dataset.wid);if(!w)throw new Error('Garanti kaydı bulunamadı.');warrantyModal(w.productId,w.id);return;}
    if(a==='delete-warranty'){const w=db.warranties.find(x=>x.id===el.dataset.wid);if(!w)throw new Error('Garanti kaydı bulunamadı.');confirmBox('Garanti kaydını sil',`${productName(w.productId)} ürününün “${w.type}” garanti kaydı kalıcı olarak silinecek. Servis ve Drive belgeleri korunur. Bu işlem garanti bitiş uyarılarını günceller.`,'Garantiyi sil','delete-warranty-confirm',`data-wid="${escape(w.id)}"`);return;}
    if(a==='delete-warranty-confirm'){const w=db.warranties.find(x=>x.id===el.dataset.wid);if(!w)throw new Error('Garanti kaydı bulunamadı.');db.warranties=db.warranties.filter(x=>x.id!==w.id);const p=getProduct(w.productId);if(p)p.updatedAt=iso(new Date());await persist();closeModal();ui.productId=w.productId;ui.tab='warranties';ui.route='detail';render();toast('Garanti kaydı silindi. İlişkili Drive belgeleri korunuyor.');return;}
    if(a==='new-service'){if(!db.products.length){toast('Önce ürün ekleyin.','warn');productModal();return;}serviceModal(el.dataset.pid);return;}
    if(a==='edit-service'){serviceModal(null,el.dataset.cid);return;}
    if(a==='new-event'){eventModal(el.dataset.cid);return;}
    if(a==='new-document'){if(!db.products.length){toast('Önce ürün ekleyin.','warn');return;}documentModal(el.dataset.pid,el.dataset.cid);return;}
    if(a==='new-reminder'){reminderModal();return;}
    if(a==='doc-info'){infoDocument(el.dataset.docid);return;}
    if(a==='doc-delete-options'){deleteDocumentOptions(el.dataset.docid);return;}
    if(a==='doc-unlink-request'){
      const id=el.dataset.docid,pid=el.dataset.pid,cid=el.dataset.cid||'';
      const d=db.documents.find(x=>x.id===id),links=documentLinksFor(db,id);
      if(!d || !links.some(l=>l.productId===pid&&(l.caseId||'')===cid))throw new Error('Bu belge bağlantısı artık mevcut değil.');
      confirmBox('Belge bağlantısını kaldır',`“${d.name}” dosyasının ${productName(pid)}${cid?` / ${getCase(cid)?.issue||'Servis'}`:''} bağlantısı kaldırılacak. ${links.length===1?'Bu, son bağlantı olduğundan GarantiTakip belge kaydı da silinecek.':'Diğer bağlantılar korunacak.'} Drive dosyası silinmez.`,'Bağlantıyı kaldır','doc-unlink-confirm',`data-docid="${escape(id)}" data-pid="${escape(pid)}" data-cid="${escape(cid)}"`);
      return;
    }
    if(a==='doc-unlink-confirm'){await applyDocumentRemoval('unlink',el.dataset.docid,el.dataset.pid,el.dataset.cid||'');return;}
    if(a==='doc-remove-all-request'){
      const d=db.documents.find(x=>x.id===el.dataset.docid);if(!d)throw new Error('Belge bulunamadı.');
      const total=documentLinksFor(db,d.id).length;
      confirmBox('Tüm belge kaydını kaldır',`“${d.name}” için ${total} bağlantı ve Firebase belge kaydı silinecek. Diğer ürün veya servislerden de kaybolacak! Google Drive dosyasına dokunulmaz. Bu işlemi geri almak için yeniden ilişkilendirme gerekir.`,'Tüm bağlantıları kaldır','doc-remove-all-confirm',`data-docid="${escape(d.id)}"`);return;
    }
    if(a==='doc-remove-all-confirm'){await applyDocumentRemoval('all',el.dataset.docid);return;}
    if(a==='doc-trash-request'){
      const d=db.documents.find(x=>x.id===el.dataset.docid);if(!d || !canTrashAppDocument(db,d))throw new Error('Bu dosya Drive çöp kutusuna taşınamaz.');
      confirmBox('Drive dosyasını çöp kutusuna taşı',`“${d.name}” Drive Çöp Kutusu'na taşınacak; GarantiTakip'teki belge ve tek ürün bağlantısı da kaldırılacak. Dosya Drive çöp kutusundan geri alınabilir. Devam edilsin mi?`,'Çöp kutusuna taşı','doc-trash-confirm',`data-docid="${escape(d.id)}"`);return;
    }
    if(a==='doc-trash-confirm'){await applyDocumentRemoval('trash',el.dataset.docid);return;}
    if(a==='rename-document'){renameDocumentModal(el.dataset.docid);return;}
    if(a==='doc-open'){openDocument(el.dataset.docid);return;}
    if(a==='verify-documents'){await verifyDocuments();return;}
    if(a==='bulk-names'){bulkNamesPreview();return;}
    if(a==='bulk-names-confirm'){await bulkNamesApply();return;}
    if(a==='open-archive'){await openArchive();return;}
    if(a==='change-archive-folder'){await changeArchiveLocation();return;}
    if(a==='rename-archive-folder'){archiveRenameModal();return;}
    if(a==='connect-drive'){await drive.connect();toast('Aynı Google Drive hesabı doğrulandı.');render();if(db.settings.emailNoticesEnabled&&db.settings.notificationFeedFileId)syncNotificationFeed(false).catch(err=>{notificationSyncError=err.message;console.warn(err);});return;}
    if(a==='sign-out'){await cloud.signOut();return;}
    if(a==='pick-drive'){if(!drive.connected())throw Error('Önce Ayarlar ekranından Drive hesabınızı bağlayın.');const picked=await drive.pick();if(!picked)return;pickedDriveFile=await drive.getMetadata(picked.id);const status=document.getElementById('selectedDriveFile');if(status)status.textContent=`Seçilen dosya: ${pickedDriveFile.name}`;documentNamePreview();return;}
    if(a==='doc-mode'){const drive=el.dataset.mode==='drive';const form=document.getElementById('documentForm');form.dataset.docMode=drive?'drive':'device';document.getElementById('devicePicker').style.display=drive?'none':'block';document.getElementById('drivePicker').style.display=drive?'block':'none';document.querySelectorAll('.radio-tab').forEach(t=>t.classList.toggle('active',t.dataset.mode===el.dataset.mode));documentNamePreview();return;}
    if(a==='detail-tab'){ui.tab=el.dataset.tab;render();return;}
    if(a==='product-filter'){ui.filter=el.dataset.filter;render();return;}
    if(a==='service-filter'){ui.serviceFilter=el.dataset.filter;render();return;}
    if(a==='stat-filter'){if(el.dataset.filter==='services'){navigate('services');ui.serviceFilter='open';render();}else{ui.filter=el.dataset.filter;navigate('products');}return;}
    if(a==='toggle-archive'){const p=getProduct(el.dataset.pid);if(!p)return;if(p.status==='Arşivlendi'){p.status='Kullanımda';p.updatedAt=iso(new Date());await persist();toast('Ürün arşivden çıkarıldı.');render();}else{confirmBox('Ürünü arşivle',`${p.name} arşivlendiğinde garantileri, servis ve belge kayıtları silinmez.`,'Arşivle','archive-confirm',`data-pid="${escape(p.id)}"`);}return;}
    if(a==='archive-confirm'){const p=getProduct(el.dataset.pid);if(p){p.status='Arşivlendi';p.updatedAt=iso(new Date());await persist();toast('Ürün arşivlendi.');}closeModal();render();return;}
    if(a==='complete-reminder'){const r=db.reminders.find(x=>x.id===el.dataset.rid);if(r){r.completed=true;await persist();toast('Hatırlatma tamamlandı.');render();}return;}
    if(a==='export-json'){exportJson();return;}
    if(a==='import-json'){confirmBox('Bulut JSON yedeğini içe aktar','Bu işlem, Firebase üzerindeki mevcut TÜM ürün, garanti ve servis kayıtlarının yerine JSON içeriğini koyacaktır. Önce bir yedek indirin.','Yedek dosyası seç','import-confirm');return;}
    if(a==='import-confirm'){closeModal();const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{if(f.size>10*1024*1024)throw new Error('JSON dosyası 10 MB üzerinde.');const value=JSON.parse(await f.text());const d=value.data||value;const stats=validateBackup(d);if(value.ownerUid&&value.ownerUid!==cloud.user()?.uid)throw new Error('Bu yedek farklı bir kullanıcıya ait.');const confirmText=`SON ONAY: ${stats.productCount} ürün, ${stats.documentCount} belge referansı ve ${stats.serviceCount} servis kaydı içeri alınacak. Mevcut bütün bulut kayıtları değiştirilecek. İşlem öncesi ayrıca JSON yedeği indirilecek. Devam edilsin mi?`;if(!window.confirm(confirmText))return;exportJson('Geri_Yukleme_Oncesi');await cloud.replaceAll({...d,schemaVersion:2},committed);toast('JSON geri yükleme tamamlandı. Drive belge içeriklerini ayrıca doğrulayın.');}catch(err){toast(`İçe aktarma başarısız: ${err.message}`,'warn');}};input.click();return;}
  }
  document.addEventListener('click', e=>{const r=e.target.closest('[data-route]');if(r){navigate(r.dataset.route);return;}const act=e.target.closest('[data-action]');if(act){if(act.dataset.action==='modal-backdrop'&&e.target!==act)return;eventAction(act).catch(err=>toast(err.message||String(err),'warn'));}});
  document.getElementById('headerNotifications').addEventListener('click',()=>navigate('reminders'));
  document.getElementById('headerSettings').addEventListener('click',()=>navigate('settings'));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.modal-backdrop'))closeModal();});
  document.addEventListener('input',e=>{
    if(e.target.id==='productSearch'||e.target.id==='docSearch'){
      const searchId=e.target.id, value=e.target.value, pos=e.target.selectionStart;
      if(searchId==='productSearch')ui.search=value;else ui.docSearch=value;
      render();const el=document.getElementById(searchId);if(el){el.focus();try{el.setSelectionRange(pos,pos);}catch(err){}}
    }
    if(e.target.closest('#documentForm')&&e.target.name==='documentDescription')documentNamePreview();
    if(e.target.name==='start'||e.target.name==='durationMonths'){
      const form=e.target.closest('#warrantyForm');if(form){const st=form.querySelector('[name=start]').value,dur=form.querySelector('[name=durationMonths]').value,end=form.querySelector('[name=end]');if(st&&dur)end.value=addMonths(st,Number(dur));}
    }
  });
  document.addEventListener('change',e=>{
    if(['reportFrom','reportTo','reportProduct'].includes(e.target.name)){ui[e.target.name]=e.target.value;render();}
    if(e.target.id==='productSort'){ui.sort=e.target.value;render();}
    if(e.target.id==='docFilter'){ui.docFilter=e.target.value;render();}
    if(e.target.name==='productId'&&e.target.closest('#documentForm')){
      const form=e.target.closest('form'), select=form.querySelector('[name=caseId]');select.innerHTML='<option value="">Ürün belgesi</option>'+db.serviceCases.filter(c=>c.productId===e.target.value).map(c=>`<option value="${escape(c.id)}">${escape(c.issue)}</option>`).join('');
      if(form.querySelector('[name=kind]').value==='Fatura'&&!form.dataset.dateManuallyChanged)form.querySelector('[name=documentDate]').value=getPurchase(getProduct(e.target.value)?.purchaseId)?.date||iso(new Date());
    }
    if(e.target.closest('#documentForm')){
      if(e.target.name==='documentDate')e.target.closest('form').dataset.dateManuallyChanged='yes';
      if(e.target.name==='kind'&&!e.target.closest('form').dataset.dateManuallyChanged){const form=e.target.closest('form');form.querySelector('[name=documentDate]').value=e.target.value==='Fatura'?(getPurchase(getProduct(form.querySelector('[name=productId]').value)?.purchaseId)?.date||iso(new Date())):iso(new Date());}
      documentNamePreview();
    }
  });
  document.addEventListener('submit',async e=>{
    const f=e.target;if(!f.dataset.form)return;e.preventDefault();const data=Object.fromEntries(new FormData(f).entries()), today=iso(new Date());
    try{
      if(f.dataset.form==='product'){
        const name=String(data.name||'').trim(),category=String(data.category||'');if(!name||!category){toast('Ürün adı ve kategori zorunludur.','warn');return;}
        const editId=f.dataset.editId;let p=editId?getProduct(editId):null;const oldPurchase=p?.purchaseId||null;
        const purchasePayload={vendor:String(data.vendor||'').trim(),platform:String(data.platform||'').trim(),orderNo:String(data.orderNo||'').trim(),invoiceNo:String(data.invoiceNo||'').trim(),date:data.date||'',deliveryDate:data.deliveryDate||'',price:data.price===''?null:Number(data.price),currency:data.currency||'TRY'};
        const selectedPurchase=String(data.existingPurchase||'').split(' | ')[0];let purchaseId=selectedPurchase&&getPurchase(selectedPurchase)?selectedPurchase:null;
        if(purchaseId&&purchaseId===oldPurchase){const old=getPurchase(purchaseId);Object.assign(old,purchasePayload);}
        else if(!purchaseId){if(Object.entries(purchasePayload).some(([k,v])=>!['currency','price'].includes(k)&&!!v)||purchasePayload.price!==null){if(oldPurchase&&getPurchase(oldPurchase)&&db.products.filter(x=>x.purchaseId===oldPurchase).length===1){purchaseId=oldPurchase;Object.assign(getPurchase(purchaseId),purchasePayload);}else{purchaseId=uid('pur');db.purchases.push({id:purchaseId,...purchasePayload});}}}
        const productData={name,category,brand:String(data.brand||'').trim(),model:String(data.model||'').trim(),serial:String(data.serial||'').trim(),notes:String(data.notes||'').trim(),status:data.status||'Kullanımda',purchaseId,updatedAt:today};
        if(p)Object.assign(p,productData);else{p={id:uid('prd'),createdAt:today,...productData};db.products.unshift(p);}
        await persist();closeModal();ui.productId=p.id;ui.route='detail';ui.tab='general';render();toast(editId?'Ürün bilgileri güncellendi.':'Ürün kaydı eklendi.');return;
      }
      if(f.dataset.form==='warranty'){
        const pid=data.productId;if(!getProduct(pid))throw Error('Ürün bulunamadı.');
        if(data.durationMonths!==''&&(!Number.isInteger(Number(data.durationMonths))||Number(data.durationMonths)<0||Number(data.durationMonths)>240))throw Error('Garanti süresi 0–240 ay arasında tam sayı olmalıdır.');
        const end=data.end||(data.start&&data.durationMonths!==''?addMonths(data.start,Number(data.durationMonths)):'');
        if(data.start&&end&&end<data.start)throw Error('Bitiş tarihi başlangıç tarihinden önce olamaz.');
        const payload={type:data.type||'Üretici Garantisi',provider:String(data.provider||'').trim(),start:data.start||'',durationMonths:data.durationMonths===''?null:Number(data.durationMonths),end:end||'',notes:String(data.notes||'').trim(),updatedAt:new Date().toISOString()};
        const editId=f.dataset.editId,w=editId?db.warranties.find(x=>x.id===editId):null;
        if(editId){if(!w||w.productId!==pid)throw Error('Düzenlenecek garanti kaydı bulunamadı.');Object.assign(w,payload);}
        else db.warranties.push({id:uid('war'),productId:pid,...payload});
        getProduct(pid).updatedAt=today;
        await persist();closeModal();ui.productId=pid;ui.tab='warranties';ui.route='detail';render();toast(editId?'Garanti kaydı güncellendi.':'Garanti kaydı eklendi.');return;
      }
      if(f.dataset.form==='service'){
        if(!data.productId||!getProduct(data.productId))throw Error('Önce bir ürün seçin.');if(!String(data.issue||'').trim())throw Error('Arıza açıklaması gerekli.');const cid=f.dataset.editId;let c=cid?getCase(cid):null;const payload={productId:data.productId,issue:String(data.issue||'').trim(),date:data.date||today,reference:String(data.reference||'').trim(),provider:String(data.provider||'').trim(),status:data.status||'Başvuru Açıldı',nextActionDate:data.nextActionDate||'',decision:String(data.decision||'').trim(),outcome:String(data.outcome||'').trim(),cost:data.cost===''?null:Number(data.cost),closedAt:data.closedAt||''};if(!cid){c={id:uid('srv'),createdAt:today,...payload};db.serviceCases.unshift(c);db.serviceEvents.push({id:uid('evt'),caseId:c.id,date:c.date,type:'Başvuru',description:c.issue});}else if(c){const oldStatus=c.status;Object.assign(c,payload);if(oldStatus!==c.status)db.serviceEvents.push({id:uid('evt'),caseId:c.id,date:today,type:'Durum Güncellemesi',description:`${oldStatus} → ${c.status}`});}else throw Error('Servis dosyası bulunamadı.');if(c.status==='Kapatıldı'&&!c.closedAt)c.closedAt=today;await persist();closeModal();navigate('case',c.id);toast(cid?'Servis dosyası güncellendi.':'Servis dosyası oluşturuldu.');return;
      }
      if(f.dataset.form==='event'){
        const c=getCase(data.caseId);if(!c)throw Error('Servis dosyası bulunamadı.');if(!String(data.description||'').trim())throw Error('İşlem açıklaması gerekli.');db.serviceEvents.push({id:uid('evt'),caseId:c.id,type:data.type||'Diğer',date:data.date||today,description:String(data.description||'').trim()});await persist();closeModal();navigate('case',c.id);toast('Servis işlem geçmişine eklendi.');return;
      }
      if(f.dataset.form==='archive-rename'){
        if(!drive.connected()||!db.settings.driveRootId)throw Error('Drive arşiv klasörü bulunamadı.');
        const name=String(data.archiveName||'').trim();
        if(!name||name.length>100)throw Error('Klasör adı 1-100 karakter olmalı.');
        const meta=await drive.renameFile(db.settings.driveRootId,name);
        db.settings.driveRootName=meta.name;
        try{await persist();}catch(err){throw new Error(`Drive klasörü yeniden adlandırıldı ancak Firebase kaydedilemedi: ${err.message}`);}
        closeModal();render();toast('Drive arşiv klasörünün adı değiştirildi.');return;
      }
      if(f.dataset.form==='rename-document'){
        const d=db.documents.find(x=>x.id===f.dataset.docId);
        if(!d?.driveFileId)throw Error('Belge veya Drive dosya kimliği bulunamadı.');
        if(!drive.connected())throw Error('Yeniden adlandırmak için Ayarlar bölümünden Drive hesabını bağlayın.');
        const newName=renamedDocumentFilename(data.nameBase,d.name,d.mimeType);
        if(newName===d.name){closeModal();toast('Dosya adı zaten bu şekilde.');return;}
        const meta=await drive.renameFile(d.driveFileId,newName);
        d.name=meta.name;d.renamedAt=new Date().toISOString();
        try{await persist();}catch(err){throw new Error(`Drive dosyası yeniden adlandırıldı; Firebase ad kaydı güncellenemedi. Dosyanın yeni adı: ${meta.name}. ${err.message}`);}
        closeModal();render();toast('Belge Google Drive üzerinde yeniden adlandırıldı.');return;
      }
      if(f.dataset.form==='document'){
        const pid=data.productId,cid=data.caseId||null;if(!getProduct(pid))throw Error('Ürün seçmelisiniz.');if(cid&&getCase(cid)?.productId!==pid)throw Error('Servis dosyası bu ürüne ait değil.');
        let documentId=data.existingDoc;if(documentId&&!db.documents.some(d=>d.id===documentId&&d.driveFileId))documentId=null;
        if(!documentId){
          if(!drive.connected())throw Error('Önce Ayarlar bölümünden Google Drive hesabını bağlayın.');
          const mode=f.dataset.docMode, file=f.querySelector('[name=localFile]')?.files?.[0];let meta;
          if(mode==='drive'){
            if(!pickedDriveFile?.id)throw Error('Google Picker üzerinden dosya seçin.');
            meta=pickedDriveFile;
          } else {
            if(!file)throw Error('Önce dosya seçin.');
            const folders=await drive.ensureFolders(db.settings);
            Object.assign(db.settings,folders);await persist();
            let parentId=folders.driveInvoicesId;
            if(data.kind!=='Fatura'){
              parentId=await drive.ensureProductFolder(db.settings,pid,productName(pid));
              db.settings.driveProductFolderIds ||= {};
              db.settings.driveProductFolderIds[pid]=parentId;
              await persist();
            }
            const fileName=makeDocumentFilename({productName:productName(pid),documentDate:data.documentDate,kind:data.kind,description:data.documentDescription,fileName:file.name,mimeType:file.type,uniqueCode:f.dataset.fileCode});
            const signature=[file.name,file.size,file.lastModified,file.type,pid,data.kind,data.documentDate,data.documentDescription,parentId,fileName].join('|');
            if(stagedUpload?.signature===signature)meta=stagedUpload.meta;
            else {meta=await drive.upload(file,parentId,Number(services.config.maxUploadMB||25),fileName);stagedUpload={signature,meta};}
          }
          const existing=db.documents.find(d=>d.driveFileId===meta.id);
          if(existing)documentId=existing.id;
          else {documentId=uid('doc');db.documents.push({id:documentId,name:meta.name,kind:data.kind||'Diğer',source:mode==='drive'?'drive-picker':'drive-upload',driveFileId:meta.id,webViewLink:meta.webViewLink||'',mimeType:meta.mimeType||'',originalName:mode==='device'?file?.name||'':meta.name,documentDate:data.documentDate||today,description:String(data.documentDescription||'').trim(),createdAt:today,size:Number(meta.size||file?.size||0)});}
        }
        if(!db.documentLinks.some(l=>l.documentId===documentId&&l.productId===pid&&l.caseId===cid))db.documentLinks.push({documentId,productId:pid,caseId:cid});
        try{await persist();}
        catch(err){throw new Error(`${err.message}. Dosya Drive'a yüklenmiş olabilir; tekrar yüklemeyin, önce Drive'daki GarantiTakip klasörünü kontrol edin.`);}
        closeModal();ui.productId=pid;if(ui.route==='detail')ui.tab='documents';render();toast('Belge Google Drive ile ilişkilendirildi.');return;
      }
      if(f.dataset.form==='reminder'){
        if(!String(data.title||'').trim()||!data.date)throw Error('Başlık ve tarih gerekli.');db.reminders.push({id:uid('rem'),title:String(data.title||'').trim(),date:data.date,productId:data.productId||null,completed:false});await persist();closeModal();ui.route='reminders';render();toast('Hatırlatma oluşturuldu.');return;
      }
    }catch(err){console.error('submit error',err?.stack||err);toast(err.message||'Kayıt sırasında beklenmeyen bir hata oldu.','warn');}
  });
  render();
  initialize();
  document.addEventListener('click',e=>{if(e.target.id==='loginButton'){if(!services.configured)return;cloud.signIn().catch(err=>gate(`Google giriş hatası: ${err.message}`));}});
})();
