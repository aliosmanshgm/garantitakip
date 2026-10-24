# GarantiTakip Faz 8 - Giyim, Ayakkabi ve Tuketici Talepleri

## Amac
Mevcut elektronik urun/garanti yonetiminin yani sira ayakkabi, giyim, canta ve aksesuar alisverislerini izlemek, kusurlu urun basvurularini, iadeleri ve degisimleri takip etmek. Firebase veya Drive verileri silinmez; mevcut kayitlar korunur.

## Guvenli GitHub guncellemesi
1. Canli GarantiTakip uygulamasinda Ayarlar > JSON yedegi indir islemini yapin. Drive belgelerinin kendisi JSON'a dahil degildir.
2. GitHub'da halen calisan son commit'i not edin.
3. ZIP icinden yalnizca `app.js`, `app.css`, `reports.mjs`, `notification-feed.mjs` dosyalarini `garantitakip` reposunun ana dizininde ayni commit ile degistirin.
4. `config.js`, `cloud.js`, `integrity.js`, `drive.js`, `filename.js`, Firebase Rules ve Google Apps Script `Code.gs` dosyasini degistirmeyin.
5. GitHub Pages yayini tamamlandiginda sayfayi zorla yenileyin.

## Kullanim
- Urunlerim > Yeni Urun > Kategori: Ayakkabi veya Giyim / Tekstil secin. Beden / Numara, Renk, Urun kodu / SKU ve Malzeme / Kumas alanlari gorunur. Bu alanlar opsiyoneldir.
- Urun Detayi > Servis ve Talepler > Basvuru ac: Ayipli Mal / Reklamasyon, Iade Talebi, Degisim Talebi veya Garanti / Servis secilebilir.
- Sorunun fark edildigi tarih, basvuru tarihi, istenen cozum, satatici/servis yaniti, takip ve kapanis tarihini kaydedin.
- Belge Arsivi'nde Satis Fisi / Makbuz, Kusur Fotografi, Iade / Degisim Formu veya Inceleme Raporu belge turu secilebilir. Diger Drive islemleri degismez.
- Raporlar > CSV'de basvuru turu ve talep edilen cozum alanlari gorunur.
- Mevcut Apps Script bildirim listesine yeni tur bilgisi detay metni olarak yansitilir. Apps Script'te gelen hatirlatmanin ust etiketi halen 'Servis' olabilir; bildirim mekanizmasi degistirilmemistir.

## Hukuki nitelik
Ayipli maldan dogan sorumluluk, uretici veya satici garantisiyle ayni sey degildir. 6502 sayili Kanun kapsaminda genel sorumluluk zamanasimi iki yildir; baslangic ve istisnalar somut olaya gore degerlendirilir. Bu sure yeni bir 'uretici garantisi' olarak otomatik kaydedilmez. Iade/değisim haklari da her alisveriste otomatik degildir.

## Kabul testleri
1. Daha once kayitli elektronik urunun karti acilmali.
2. Ayakkabi urununde beden/renk/SKU ve malzeme kaydedilip yenileme sonrasi gorunmeli.
3. Ayipli Mal / Reklamasyon basvurusu acilabilmeli, istenen cozum gorunmeli.
4. Kusur fotografi veya satis fisi belge turunde Drive kaydi iliskilendirilebilmeli.
5. Raporlar > CSV'de basvuru turu bulunmali.
6. Takip tarihi bulunan acik basvuru, Drive hatirlatma esitlemesinden sonra e-posta akisina dahil olabilmeli.

## Kontrol durumu
JavaScript sozdizimi testleri; rapor, CSV, bildirim feed, Firebase serialization, JSON backup ve eski veri modeli uyum testleri basarili. Tarayici-UI testi mevcut ortamda yerel sayfa erisimi kisiti nedeniyle calistirilamadi. Gercek Firebase/Drive hesabinda entegrasyon testleri kullanici tarafinda yapilmalidir.
