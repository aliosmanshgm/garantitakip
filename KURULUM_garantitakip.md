# GarantiTakip - Firebase ve Google Drive kurulumu (projenize ozel)

## Kesinlesmis bilgiler

- Firebase Project ID: `garantitakip`
- Realtime Database: `https://garantitakip-default-rtdb.europe-west1.firebasedatabase.app/`
- Firebase standart Authentication Domain: `garantitakip.firebaseapp.com` (**web config ile karsilastirin**)
- Firebase bolgesi: `europe-west1`

Tum Firebase Web App bilgileri `config.js` icine islenmistir. Google Picker App ID icin kullanilacak `projectNumber` da `565168900553` olarak doldurulmustur. **Eksik:** tek kullaniciya ait `allowedEmail`, Google OAuth Web Client ID ve Google Picker API key. Firebase Web API key bir browser config degeridir; sunucu veya kullanici sifresi degildir.
## A - Ilk giris / UID ogrenme

1. Firebase Web App yapilandirmasi pakete eklendi. Firebase Console > Project settings > General > Your apps bolumunden gerekirse dogrulayin.
2. `config.js` icinde `allowedEmail`: `YOUR_GOOGLE_EMAIL@gmail.com` ifadesini kullanacaginiz tek Google hesabi ile degistirin. Bu degisim yapilmadan uygulamanin kimlik dogrulama katmani baslamaz.
3. Firebase Console > Authentication > Sign-in method > Google > Enable ayarini acin.
4. Firebase Console > Authentication > Settings > Authorized domains listesine GitHub Pages hostunuzu ekleyin, ornegin `kullanici.github.io`; basina `https://` ve sonuna `/repo` eklemeyin. Yerel test icin `localhost` ancak gelistirme asamasinda gerekirse ekleyin.
5. `index.html`, `app.css`, `app.js`, `config.js`, `bootstrap.js`, `cloud.js`, `drive.js` dosyalarini GitHub Pages repo kokune koyup HTTPS sayfasini acin.
6. Kendi Google hesabiniza ait **Google ile giris yap** butonuna basin. Firebase Authentication > Users alaninda UID olusacak. Bu asamada Realtime Database izin hatasi gormek **beklenen** bir durumdur; veri tabani erisimi henuz acilmadi.

**GitHub Pages'i kullanmadan test edecekseniz:** Yetkilendirilmis `localhost` icin HTTP sunucusu acin; HTML dosyasini `file://` ile baslatmayin.

## B - Realtime Database kurallarini kilitleme

1. Firebase Console > Authentication > Users bolumunden kendi **UID** bilginizi alin.
2. `database.rules.json` dosyasinda `REPLACE_WITH_YOUR_FIREBASE_UID` ifadesinin iki gecisini bu UID ile degistirin.
3. `YOUR_GOOGLE_EMAIL@gmail.com` ifadesinin iki gecisini `config.js`'deki ayni e-posta ile degistirin.
4. Firebase Console > Realtime Database > Rules ekranina duzenlenmis JSON icini yapistirip **Publish** yapin. *Test mode veya herkese acik okuma/yazma kullanmayin.*
5. GarantiTakip sayfasini yenileyin; giris yapin. Kayit ekleyip sayfayi yenileyerek Firebase'de saklandigini kontrol edin.

Kurallar yalnizca `users/{uid}` altina, `auth.uid` eslesip e-posta dogrulanmissa okuma/yazma verir. UID, google hesabinin Firebase icindeki benzersiz kullanici numarasidir; Project ID degildir.

## C - Google Cloud / Drive

1. [Google Cloud Console](https://console.cloud.google.com/) icinde **ayni `garantitakip` Cloud projesini** secin.
2. API Library'den **Google Drive API** ve **Google Picker API** hizmetlerini acin.
3. Google Auth Platform > Branding / Audience bolumunde uygulamayi tanimlayin. External/Testing kullaniyorsaniz kendi Google hesabinizi **Test users** bolumune ekleyin. Bu durumda Drive izni 7 gun sonra sona erebilir ve yeniden izin gerekebilir.
4. Clients > Create client > **Web application** > Authorized JavaScript origins: `https://KULLANICI.github.io`. Repo yolunu eklemeyin; kullanici adini kendi GitHub hostunuzla degistirin.
5. Web Client ID degerini `config.js -> google.clientId` alanina girin. Web Client Secret'ini **asla HTML/JS veya GitHub'a eklemeyin**.
6. Credentials > Create credentials > API key: `config.js -> google.pickerApiKey`. Uygulama kisitlamasi Websites: `https://KULLANICI.github.io/*` ve `https://docs.google.com/*`. API kisitlamalari: Google Picker API ve Google Drive API.
7. `config.js -> google.projectNumber` alanina proje numarasi **565168900553** zaten girildi. Firebase Console > Project settings > General alanindan dogrulayabilirsiniz.
8. GitHub'da `config.js`'i guncelleyip yayini yenileyin. GarantiTakip > Ayarlar > **Drive'i bagla** ile yine ayni Google hesabini secin.

**Yetki:** `drive.file` kapsami ile uygulamanin yukledigi ve Google Picker uzerinden kullanicinin secerek izin verdigi dosyalar yonetilir. Drive genelini listeleme yetkisi istenmez.

## D - Ilk canli test

1. Google girisi ve Kayitli Urun ekleme; sayfa yenilenince urun hala gorunmeli.
2. Garanti ekleme; servis acma ve servis olayi ekleme.
3. Ayarlar > Drive baglantisi > kucuk bir deneme PDF'ini yukleme. Drive'da `GarantiTakip/Faturalar` veya `GarantiTakip/Urunler` klasoru olusmali.
4. Mevcut Drive dosyasini Picker'dan secip urunle baglama. Ayni belge tekrar kopyalanmamali.
5. Ayarlar > JSON disa aktar. **JSON'da dosya icerikleri bulunmaz.**

## Onemli uyarilar

- `config.js` browser icin herkese acik bir dosyadir. `apiKey` Firebase Web API key'dir, sir degildir; veritabani guvenligi **kurallarla** saglanir. Ancak OAuth client secret, service account JSON/private key, access token eklemeyin.
- Tek kullanici guvenligini hem `allowedEmail` (arayuz) hem de Firebase Rules (sunucu) uygular. Kurallar disinda client kontrolu yeterli olmaz.
- Drive token'i sadece tarayici belleginde saklanir; sayfa yenilenince yeniden izin gerekebilir.
- Ilk projede gizlilik icin **Locked mode** uygun. Database Rules dogrulanana kadar gercek fatura yuklemeyin.
- Canli Google/Firebase testi ancak hesabinizdaki OAuth/API ayarlari tamamlaninca yapilabilir.

Resmi rehberler:
- https://firebase.google.com/docs/web/learn-more
- https://firebase.google.com/docs/database/security/rules-conditions
- https://developers.google.com/workspace/drive/picker/guides/web-picker
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
