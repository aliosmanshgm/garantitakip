/* GarantiTakip - Baslangic hata yakalama (Faz 8 uyumlu).
   Bu dosya Firebase/Drive verilerini degistirmez. */
const config = window.GT_CONFIG || {};
const missing = value => !value || /FIREBASE_|GOOGLE_|YOUR_GOOGLE_|PROJECT_NUMBER/.test(String(value));
const configReady = !!(config.firebase && ![
  config.firebase.apiKey,
  config.firebase.authDomain,
  config.firebase.databaseURL,
  config.firebase.projectId,
  config.firebase.appId,
  config.allowedEmail
].some(missing));

function startupFailure(error) {
  console.error('[GarantiTakip] Baslangic hatasi:', error);
  window.__GT_BOOT_DONE__ = true;
  const root = document.getElementById('authGate');
  if (!root) return;
  root.hidden = false;
  root.replaceChildren();
  const card = document.createElement('div');
  card.className = 'auth-card';
  const title = document.createElement('h1');
  title.textContent = 'GarantiTakip';
  const intro = document.createElement('p');
  intro.textContent = 'Uygulama baslatilamadi. Firebase kayitlariniz bu nedenle silinmis degildir.';
  const detail = document.createElement('p');
  detail.style.cssText = 'font-size:13px;overflow-wrap:anywhere;color:#b45309;';
  detail.textContent = String(error?.message || error || 'Bilinmeyen hata').slice(0,450);
  const advice = document.createElement('small');
  advice.textContent = 'GitHub Pages dosyalarini ve tarayici Console ekranini kontrol edin. Hatayi oldugu gibi paylasabilirsiniz.';
  card.append(title,intro,detail,advice);
  root.appendChild(card);
}

try {
  let cloud = null, drive = null;
  const [{ createCloud }, { createDrive }] = await Promise.all([
    import('./cloud.js?v=8_1'),
    import('./drive.js?v=8_1')
  ]);
  if (configReady) {
    cloud = createCloud(config);
    drive = createDrive(config, () => cloud.user());
  }
  window.GTServices = {
    configured: !!cloud,
    cloud, drive, config,
    bootError: null
  };
  await import('./app.js?v=8_1');
  window.__GT_BOOT_DONE__ = true;
} catch (error) {
  startupFailure(error);
}
