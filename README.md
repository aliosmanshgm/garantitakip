# GarantiTakip - Faz 2 / garantitakip proje konfigurasyonu

Bu paket Firebase **projectId: `garantitakip`** ve **Realtime Database URL: `https://garantitakip-default-rtdb.europe-west1.firebasedatabase.app`** icin hazirlanmistir.

## Durum

- [x] `config.js` icine kullanicinin paylastigi eksiksiz Firebase Web App yapilandirmasi (apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId) yerlestirildi.
- [x] Google Cloud Project Number (Firebase messagingSenderId ile ayni): `565168900553`.
- [ ] `allowedEmail` kullanicinin yetkili Google e-posta adresine degistirilmeli.
- [ ] Realtime Database Rules'da UID ve e-posta sahibine ozgu iki sabit deger degistirilerek **Publish** yapilmali.
- [ ] GitHub Pages origin Firebase Authentication -> Authorized domains'a eklenmeli.
- [ ] Drive icin ayrica Google OAuth Web client ID, Google Picker API key, Cloud project number tamamlanmali.

**Iyilestirme:** Google Drive ayarlari olmadan da Firebase Google oturumu acilabilir. Bu, ilk giristen sonra Firebase UID bilgisini ogrenmek icin gereklidir. Drive eklenince Ayarlar > Drive'i bagla etkinlesir.

## Paket icerigi
- `index.html`, `app.css`, `app.js` - arayuz
- `bootstrap.js`, `cloud.js`, `drive.js` - bulut baglanti kodlari
- `config.js` - **yayina alinacak** browser konfig dosyasi (kimlik dogrulama secrets koymayin)
- `database.rules.json` - **Firebase Console Rules** alanina yerlestirilecek sablon (GitHub Pages'te yayinlanmasi gerekmez)
- `KURULUM_garantitakip.md` - projenize ozel sirali kurulum ve canli test kontrol listesi

**Test kapsami:** Kod syntax ve sabit config degerleri yerelde dogrulandi. Bu paket, gercek Firebase veya Google Drive hesabi icin uzaktan baglanilmis/test edilmis olarak sunulmuyor.
