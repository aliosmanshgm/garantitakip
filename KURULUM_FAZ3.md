# GarantiTakip - Faz 3 Güvenilirlik Güncellemesi

## Durum
Bu paket, önceki Faz 2 sürümünün yerini almak üzere hazırlanmış **istemci kodu güncellemesidir**. Gerçek Firebase ve Google Drive hesabınız üzerinde uzaktan işlem yapılmadı. Bu güncellemede hem `app.js` hem de `cloud.js` değişir ve **yeni `integrity.js` dosyası şarttır**.

## Güncellemeden ÖNCE
1. GitHub Pages üzerindeki çalışan GarantiTakip'i açın.
2. **Ayarlar > JSON yedeğini indir** bölümünden bir yedek alın. Dosyayı güvenli bir yerde saklayın.
3. Google Drive içindeki fatura ve belge dosyalarının **JSON dosyasının içinde bulunmadığını** unutmayın. Gerektiğinde ayrıca Drive klasörlerinizin bir kopyasını alın.
4. Mevcut GitHub commit'inizi geri dönüş noktası olarak saklayın.

## Hızlı Güncelleme (önerilen)
GitHub `garantitakip` deposunun `main` dalının kök dizinine aşağıdaki **üç dosyayı** aynı commit kapsamında yükleyin / mevcut olanları değiştirin:

- `app.js` (değiştir)
- `cloud.js` (değiştir)
- `integrity.js` (**yeni**, kök dizine ekle)

**Değiştirmeyin:** `config.js`, `drive.js`, `bootstrap.js`, `index.html`, `app.css` ve mevcut Firebase güvenlik kuralları. Mevcut çalışan kimlik doğrulama ve Drive ayarları aynen kullanılacak.

GitHub'da `Add file > Upload files` ile bu üç dosyayı sürükleyip `Commit changes` yapın. GitHub Pages yayını tamamlanınca sayfayı `Ctrl+F5` ile yenileyin; telefonda gerekirse sekmeyi kapatıp yeniden açın.

## Yeni özellikler
- **Belge Arşivi > Erişimi kontrol et:** Google Drive API üzerinden bağlı belgelerin erişilebilir olup olmadığını isteğe bağlı kontrol eder. **Dosyaları silmez/taşımaz.** Kontrol edilen belge kayıtlarına sonuç ve kontrol zamanı eklenir. 403/404 yanıtları, dosyanın kesin silindiği anlamına gelmeyebilir; yetki kaybı da olabilir.
- **JSON içe aktarma:** İlişkili ürün, servis ve belge referansları doğrulanır. Geri yükleme öncesinde otomatik olarak ek JSON yedeği indirme girişimi yapılır. Son onay gerekir. Başka sekmede değişiklik oluşmuşsa geri yükleme iptal edilir.
- **Çakışma koruması:** Aynı kayıt iki sekmede eşzamanlı değişirse eski kopyanın sessizce üzerine yazılması yerine işlem durdurulur ve buluttaki son veri yeniden yüklenir.
- **Dosya yükleme:** Firebase kaydı başarısız olup aynı pencerede tekrar denenirse, tarayıcı sekmesi açık kaldığı sürece aynı dosyanın yeniden Drive'a yüklenmemesi için geçici eşleştirme tutulur.

## İşlem sonrası testler
1. Dashboard ve Ürünlerim açılıyor mu?
2. Mevcut test ürününüz ve PDF'niz görünüyor mu?
3. Belge Arşivi'nde `Erişimi kontrol et` tıklandığında bilinen PDF için `Erişim doğrulandı` sonucunu görüyor musunuz?
4. Ayarlar'dan yeni bir JSON dışa aktarımı yapabiliyor musunuz?
5. Deneme amaçlı ürün oluşturma ve sayfa yenilemede kayıt korunuyor mu?

**JSON içe aktarma özelliğini test etmek için canlı veri üzerinde geri yükleme yapmanızı önermiyoruz.** Bu işlev için ayrıca yalıtılmış test kullanıyoruz.

## Geri dönüş
Sorunla karşılaşırsanız önceki GitHub commit'ini geri alarak Faz 2 uygulama sürümüne dönebilirsiniz. Bu paket veri şemasını değiştirmez (`schemaVersion: 2`) ve Firebase'deki kayıtların topluca taşınmasını gerektirmez. Ancak Faz 3 ile kaydedilen isteğe bağlı belge sağlık alanları Faz 2 tarafından görüntülenmez.

## Güvenlik ve sınırlar
- `config.js` istemci tarafında açıktır; OAuth client secret, servis hesabı anahtarı veya erişim token'ı eklemeyin.
- Tek kullanıcı yetkisini asıl zorlayan katman Firebase Realtime Database kurallarıdır. Faz 3 güncellemesi bu kuralları değiştirmez.
- Drive API 404/403 hatası yetkisizlik veya dosya yokluğu nedeniyle oluşabilir. Bu kontrol kesin bir silinme tespiti değildir.
- Bu sürümde otomatik yedekleme, sunucu tarafında arka plan görevleri veya Drive dosyalarının otomatik ikinci kopyası **yoktur**.
- Aynı kaydın farklı sekmelerde değiştirilmesi artık tespit edilmeye çalışılır; bununla birlikte tek kullanıcılı kişisel bir uygulamadır. Kritik kayıtları açıp düzenlerken aynı anda birden çok sekme kullanmamak en güvenli yöntemdir.

## Geliştirme testleri
- Node.js veri bütünlüğü, çakışma ve JSON doğrulama testleri başarılı.
- Chromium üzerinde Firebase/Drive **taklit servisleriyle** ürün, garanti, servis, belge, belge kontrolü, JSON alma/geri yükleme, mobil navigasyon testleri başarılı.
- Üretim hesabıyla Faz 3 canlı uçtan uca testi henüz kullanıcı tarafında yapılmalıdır.
