// Short-lived OAuth 2 token stays in memory, never in localStorage / Firebase / JSON export.
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const driveBase = 'https://www.googleapis.com/drive/v3';
const escapeName = file => (file?.name || '').replace(/[\\/]/g,'_').slice(0,180);

export function createDrive(config, getFirebaseUser) {
  let token = null;
  let expiresAt = 0;
  let tokenClient = null;
  let pickerReady = false;
  let authorizedEmail = '';
  const credentials = config.google || {};
  const script = (url) => new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=url;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Google hizmeti yüklenemedi. Ağ bağlantısını kontrol edin.'));document.head.appendChild(s);
  });
  let gsiLoad, pickerLoad;
  async function ensureGsi() {
    gsiLoad ||= script('https://accounts.google.com/gsi/client');
    await gsiLoad;
    if (!window.google?.accounts?.oauth2) throw new Error('Google OAuth yüklenemedi.');
    if(!tokenClient)tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:credentials.clientId,scope:DRIVE_SCOPE,callback:()=>{}});
  }
  async function ensurePicker() {
    if (pickerReady) return;
    pickerLoad ||= script('https://apis.google.com/js/api.js');
    await pickerLoad;
    await new Promise((resolve,reject)=>window.gapi.load('picker',{callback:resolve,onerror:()=>reject(new Error('Google Picker başlatılamadı.'))}));
    pickerReady=true;
  }
  async function fetchJson(url,{method='GET',body,headers={}}={}) {
    if (!token || Date.now()>=expiresAt-30_000) throw new Error('Drive erişim süresi doldu. Drive bağlantısını yenileyin.');
    let response;
    try{response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...headers},body});}
    catch{throw new Error('Google Drive isteği ağ hatası nedeniyle tamamlanamadı.');}
    if(!response.ok){
      if(response.status===401){token=null;expiresAt=0;}
      const detail=(await response.text()).slice(0,300);
      throw new Error(`Google Drive HTTP ${response.status}: ${detail}`);
    }
    return response.status===204?null:response.json();
  }
  async function verifyAccount() {
    const user=getFirebaseUser();
    if(!user?.email)throw new Error('Önce Firebase üzerinden oturum açın.');
    const about=await fetchJson(`${driveBase}/about?fields=user(emailAddress)`);
    const driveEmail=String(about?.user?.emailAddress||'').toLowerCase();
    if(!driveEmail||driveEmail!==String(user.email).toLowerCase()){
      const rejectedToken=token;token=null;expiresAt=0;authorizedEmail='';
      if(window.google?.accounts?.oauth2?.revoke&&rejectedToken)window.google.accounts.oauth2.revoke(rejectedToken,()=>{});
      throw new Error('Drive hesabı ile uygulama hesabı aynı değil. Lütfen aynı Google hesabını seçin.');
    }
    authorizedEmail=driveEmail;
  }
  async function connect({force=false}={}) {
    if (!credentials.clientId || /GOOGLE_OAUTH_WEB_CLIENT_ID/.test(String(credentials.clientId))) {
      throw new Error('Drive henuz yapilandirilmadi. Google Cloud OAuth Web Client ID degerini config.js dosyasina girin.');
    }
    if(!force && token && Date.now()<expiresAt-60_000 && authorizedEmail===getFirebaseUser()?.email?.toLowerCase())return true;
    await ensureGsi();
    const response=await new Promise((resolve,reject)=>{
      tokenClient.callback=r=>r?.error?reject(new Error(r.error_description||r.error)):resolve(r);
      tokenClient.error_callback=e=>reject(new Error(`Google izin penceresi başarısız: ${e.type || 'Bilinmeyen hata'}`));
      tokenClient.requestAccessToken({prompt:'select_account'});
    });
    token=response.access_token;
    expiresAt=Date.now()+(Number(response.expires_in||3600)*1000);
    try{await verifyAccount();}catch(e){token=null;expiresAt=0;throw e;}
    return true;
  }
  const connected=()=>!!token && Date.now()<expiresAt-30_000 && !!authorizedEmail;
  async function folder(name,parent=null) {
    return fetchJson(`${driveBase}/files?fields=id,name,webViewLink`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:FOLDER_MIME,...(parent?{parents:[parent]}:{})})});
  }
  async function getMetadata(id){
    if(!/^[a-zA-Z0-9_-]{8,}$/.test(id))throw new Error('Drive dosya kimliği geçersiz.');
    return fetchJson(`${driveBase}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,webViewLink,trashed,parents`);
  }
  async function safeFolder(savedId,name,parent) {
    if(savedId){try{const f=await getMetadata(savedId);if(f.mimeType===FOLDER_MIME&&!f.trashed)return f.id;}catch(e){if(!/404/.test(e.message))throw e;}}
    const f=await folder(name,parent);return f.id;
  }
  async function ensureFolders(settings) {
    if(!connected())throw new Error('Önce Google Drive hesabını bağlayın.');
    const root=await safeFolder(settings.driveRootId,'GarantiTakip');
    const purchases=await safeFolder(settings.driveInvoicesId,'Faturalar',root);
    const products=await safeFolder(settings.driveProductsId,'Urunler',root);
    return {driveRootId:root,driveInvoicesId:purchases,driveProductsId:products};
  }
  async function ensureProductFolder(settings,productId,productName) {
    const current=(settings.driveProductFolderIds||{})[productId];
    const existing=await safeFolder(current,`PRD-${productId.replace(/[^\w-]/g,'_').slice(-24)} - ${String(productName||'Urun').slice(0,80)}`,settings.driveProductsId);
    return existing;
  }
  async function upload(file,parentId, maxMB=25, friendlyName='') {
    if(!file?.size)throw new Error('Boş dosya yüklenemez.');
    if(file.size>maxMB*1024*1024)throw new Error(`Dosya ${maxMB} MB sınırını aşıyor.`);
    const boundary=`gt${crypto.randomUUID().replace(/-/g,'')}`;
    const meta={name:friendlyName||escapeName(file),mimeType:file.type||'application/octet-stream',parents:[parentId]};
    const blob=new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${file.type||'application/octet-stream'}\r\n\r\n`,
      file,`\r\n--${boundary}--`
    ],{type:`multipart/related; boundary=${boundary}`});
    return fetchJson(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink`,{
      method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body:blob
    });
  }
  async function renameFile(id,newName){
    if(!connected())throw new Error('Drive bağlantısı gerekli.');
    if(!/^[a-zA-Z0-9_-]{8,}$/.test(String(id||'')))throw new Error('Drive dosya kimliği geçersiz.');
    if(!newName || newName.length>210 || /[\/\x00-]/.test(newName))throw new Error('Yeni dosya adı uygun değil.');
    return fetchJson(`${driveBase}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,webViewLink`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newName})
    });
  }
  async function pickFolder() {
    if (!credentials.pickerApiKey || !credentials.projectNumber) throw new Error('Google Picker bilgileri eksik.');
    if (!connected()) throw new Error('Önce Drive hesabını bağlayın.');
    await ensurePicker();
    return new Promise((resolve,reject)=>{
      try {
        const view=new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS);
        view.setIncludeFolders(true);
        view.setSelectFolderEnabled(true);
        view.setMode(window.google.picker.DocsViewMode.LIST);
        const picker=new window.google.picker.PickerBuilder()
          .addView(view).setOAuthToken(token)
          .setDeveloperKey(credentials.pickerApiKey)
          .setAppId(String(credentials.projectNumber))
          .setCallback(data=>{
            if(data.action===window.google.picker.Action.CANCEL)resolve(null);
            if(data.action===window.google.picker.Action.PICKED)resolve(data.docs?.[0]||null);
          }).build();
        picker.setVisible(true);
      }catch(e){reject(e);}
    });
  }
  async function moveArchiveRoot(rootId,targetParentId) {
    if (!connected())throw new Error('Önce Google Drive hesabını bağlayın.');
    if(rootId===targetParentId)throw new Error('Arşiv klasörü kendi içine taşınamaz.');
    const root=await getMetadata(rootId),target=await getMetadata(targetParentId);
    if(root.trashed||root.mimeType!==FOLDER_MIME)throw new Error('Mevcut arşiv klasörü bulunamadı.');
    if(target.trashed||target.mimeType!==FOLDER_MIME)throw new Error('Hedef olarak geçerli bir klasör seçin.');
    if((root.parents||[]).includes(target.id))return root;
    const query=new URLSearchParams({addParents:target.id,fields:'id,name,parents,webViewLink'});
    if(root.parents?.length)query.set('removeParents',root.parents.join(','));
    return fetchJson(`${driveBase}/files/${encodeURIComponent(rootId)}?${query}`,{method:'PATCH'});
  }
  async function createArchiveIn(parentId,name='GarantiTakip') {
    if(!connected())throw new Error('Önce Google Drive hesabını bağlayın.');
    const parent=await getMetadata(parentId);
    if(parent.trashed||parent.mimeType!==FOLDER_MIME)throw new Error('Hedef klasör bulunamadı.');
    return folder(name,parent.id);
  }
  async function pick() {
    if (!credentials.pickerApiKey || /GOOGLE_PICKER_API_KEY/.test(String(credentials.pickerApiKey)) || !credentials.projectNumber || /GOOGLE_CLOUD_PROJECT_NUMBER/.test(String(credentials.projectNumber))) {
      throw new Error('Google Picker henuz yapilandirilmadi. API Key ve sayisal Project Number degerlerini config.js dosyasina girin.');
    }
    if(!connected())throw new Error('Önce Drive bağlantısını etkinleştirin.');
    await ensurePicker();
    return new Promise((resolve,reject)=>{
      try {
        const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
        view.setMode(window.google.picker.DocsViewMode.LIST);
        const picker = new window.google.picker.PickerBuilder()
          .addView(view).setOAuthToken(token)
          .setDeveloperKey(credentials.pickerApiKey)
          .setAppId(String(credentials.projectNumber))
          .setCallback(data=>{
            if(data.action===window.google.picker.Action.CANCEL)resolve(null);
            if(data.action===window.google.picker.Action.PICKED)resolve(data.docs?.[0]||null);
          }).build();
        picker.setVisible(true);
      }catch(e){reject(e);}
    });
  }
  const openUrl=file => file.webViewLink || (file.mimeType?.startsWith('application/vnd.google-apps.')?`https://drive.google.com/open?id=${encodeURIComponent(file.driveFileId||file.id)}`:`https://drive.google.com/file/d/${encodeURIComponent(file.driveFileId||file.id)}/view`);
  return {connect,connected,ensureFolders,ensureProductFolder,upload,renameFile,pick,pickFolder,moveArchiveRoot,createArchiveIn,getMetadata,openUrl, disconnect(){token=null;expiresAt=0;authorizedEmail='';}};
}
