# GarantiTakip Faz 8.3 — Açılış Hatası Onarımı ve Teşhis

Amaç: `Uncaught SyntaxError: Unexpected token 'class'` hatasında kaynak dosyayı belirlemek ve önbellek kaynaklı sürüm karışıklığını önlemek.

## Yükleme

1. Firebase verileriyle ilgili hiçbir işlem yapmayın. Uygulamaya erişiminiz varsa önce JSON yedeği alın; erişiminiz yoksa veritabanını sıfırlamayın.
2. Bu ZIP içindeki **12 uygulama dosyasını**, GitHub `garantitakip` reposunun **ana dizinine** aynı commit ile yükleyin. Var olanları değiştirin. Alt klasöre yüklemeyin.
3. **config.js dosyanızı KESİNLİKLE değiştirmeyin** (pakette bulunmuyor); UID güvenlik kuralları ve Drive dosyalarına dokunmayın.
4. GitHub Actions/Pages yayın sonucu başarılı olduktan sonra siteyi gizli sekmede açın. Windows için `Ctrl+Shift+R` ile yenileyin.
5. Açılırsa Firebase'deki ürün ve belgeleri doğrulayın. Hata devam ederse **Hata bilgisini kopyala** düğmesiyle satır/dosya bilgisini paylaşın.

## Önemli

- Önceki pakette bütün bağımlılıkları birlikte yayımlamamıştık. Bu paket çalışma dizininin o ana kadarki son kaynaklarını tek sürüm olarak içerir.
- `v=8_3` sorgu parametreleri, tarayıcının eski JS dosyalarını kullanmasını azaltır; JavaScript kodunun hatalı kaydedilmesi halinde dosya ve satır bilgisini ekrana çıkarır.
- 12 dosya: `index.html`, `bootstrap.js`, `app.js`, `app.css`, `cloud.js`, `drive.js`, `integrity.js`, `filename.js`, `document-delete.mjs`, `invoice.mjs`, `reports.mjs`, `notification-feed.mjs`.
- Bu düzeltme henüz sizin canlı GitHub yayınınızda doğrulanmadı. Belge/garanti işlemleri sorun giderilince tekrar kontrol edilmeli.
