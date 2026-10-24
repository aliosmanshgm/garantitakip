# GarantiTakip - Faz 8 Baslangic Onarimi

## Neden
"Baglanti hazirlaniyor..." ilk HTML bekleme ekranidir. Google ile giris/Firebase hatasindan farkli olarak bir veya daha fazla JavaScript modulunun baslatilamamasi sonucunda kalabilir. Mevcut sorunun kesin nedeni canli GitHub Pages Console kaydi olmadan dogrulanamaz.

## Guvenli kurulum
1. GitHub `garantitakip` reposunda en son CALISAN commit'i not edin. Firebase ve Google Drive verilerine dokunmayin.
2. Paket icerisindeki su 6 dosyayi reposunun ana dizininde **aynı commit** ile degistirin: index.html, bootstrap.js, app.js, app.css, reports.mjs, notification-feed.mjs.
3. Kesinlikle `config.js`, `cloud.js`, `drive.js`, `integrity.js`, `filename.js`, `invoice.mjs`, `document-delete.mjs`, Firebase Rules veya Apps Script dosyalarini degistirmeyin.
4. GitHub Pages > Actions (veya Pages ayarlari) uzerinden yayinlamanin tamamlandigini kontrol edin.
5. Tarayicida Ctrl+Shift+R ile sayfayi zorla yenileyin. Olmazsa gizli pencerede acin.
6. Acilis ekrani kalirsa artik mesajda "Kaynak yuklenemedi", "Eksik ... dosyalar" veya bir JavaScript hatasi gorunebilir. Bu mesaji ve F12 > Console'daki ilk kirmizi hatayi paylasin.

## Hizli geri donus
Faz 8 oncesi son calisan GitHub commit'ine donerek uygulamayi acabilirsiniz. Repo'da sadece dosya degisikligi oldugundan bu islem Firebase/Drive kayitlarinizi silmez.

## Test
- Eski bir urun acilir ve belge baglantisi calisir.
- Ayakkabi kategorisinde beden/renk gorunur.
- Ayipli mal basvurusu kaydedilir ve rapora yansir.

## Guvenlik
Kod Firebase'e toplu yazma, silme veya yedek geri yukleme yapmaz. `config.js` bu pakete dahil edilmemistir.
