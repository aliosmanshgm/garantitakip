# GarantiTakip - Faz 4 (Garanti Düzenleme ve Akıllı Belge Adları)

Bu paket, **mevcut GarantiTakip v1.0 / Faz 3** sürümüne uygulanacak dar kapsamlı bir güncellemedir.

## Değişiklikler

### 1. Garanti kayıtlarını düzenleme ve silme
- Ürün Detayı > Garantiler sekmesindeki her kaydın yanında **Düzenle** ve **Sil** düğmeleri bulunur.
- Düzenle: mevcut garanti türü, sağlayıcı, başlangıç, süre, bitiş, açıklama doldurulur ve Firebase'de aynı kayıt kimliğiyle güncellenir.
- Sil: öncesinde onay alınır ve sadece ilgili garanti kaydı silinir. **İlgili ürün, servis dosyaları ve Drive belgeleri silinmez.**
- Garanti özeti ve uygulama içi bitiş uyarıları kaydedilen güncel garanti verisine göre yeniden hesaplanır.

### 2. Cihazdan Drive'a yüklemede dosya adı
- Şema: `Ürün Adı - YYYY-AA-GG - Belge Türü - [Kısa Açıklama] - KısaKod.uzantı`
- Örnek: `Samsung Galaxy S24 - 2026-10-12 - Fatura - Teknosa - A1B2C3D4.pdf`
- Yeni yükleme formunda **Belge tarihi** ve **Kısa açıklama (isteğe bağlı)** alanları eklendi.
- Belge türü `Fatura` ise tarih satın alma kaydından önerilir; diğer türlerde bugünün tarihi önerilir. İstenirse tarih değiştirilebilir.
- Form, dosya seçildikten sonra Drive'a yüklenecek yeni adı önceden gösterir.
- Dosya uzantısı (`.pdf`, `.heic`, `.jpg` vb.) korunur; Firebase belgesine hem Drive dosya adı hem de orijinal dosya adı (varsa) kaydedilir.
- Bir başka ürüne **önceden kayıtlı belgeyi bağlama** açılır listesindeki seçeneklerde bağlı ürün ve belge türü bilgileri gösterilir.

### 3. Mevcut belgeleri yeniden adlandırma
- Belge Arşivi veya Ürün Detayı > Belgeler bölümünden belgenin **Bilgi (i)** düğmesini açın.
- **Yeniden adlandır** seçeneğiyle dosya adını düzenleyin.
- Değişiklik Google Drive API'sine iletilir, sonra Firebase'de belge adı güncellenir.
- Dosya kimliği ve diğer ürünlerle bağlantılar değişmez. Aynı dosya birden fazla ürünle ilişkiliyse yeni adı her birinde görünür.
- Mevcut Drive dosyalarının adları kendiliğinden değişmez. Drive'dan yeni seçilen bir dosya da seçim esnasında yeniden adlandırılmaz.
- Drive'ın düzenleme izni vermediği bir dosyada API hata verebilir; böyle bir durumda Firebase ad kaydı da değiştirilmez.

## GitHub kurulumu

1. Önce **Ayarlar > JSON dışa aktar** ile güncel verilerinizin yedeğini alın. JSON, Drive dosyalarının kendisini içermez.
2. Projenin ana dizininde aşağıdaki **üç dosyayı değiştirin**:
   - `app.js`
   - `app.css`
   - `drive.js`
3. Ana dizine aşağıdaki **yeni dosyayı ekleyin**:
   - `filename.js`
4. Dört dosyayı mümkünse **aynı commit** ile yükleyin. Güncel `config.js`, `cloud.js`, `integrity.js`, `bootstrap.js`, Firebase kuralları ve OAuth ayarlarını **değiştirmeyin**.
5. GitHub Pages yayınlandıktan sonra tarayıcıyı sert yenileyin (masaüstünde Ctrl+F5). iPhone'da Safari sekmesini kapatıp yeniden açın.
6. Deneme amaçlı bir garanti kaydını düzenleyin; sonra başka bir deneme garanti kaydını onaylayarak silin.
7. Deneme fotoğrafı yükleyin; önizlenen adın Drive'daki ad ile aynı olduğunu, PDF/HEIC/JPG uzantısının korunduğunu doğrulayın.
8. Belgeyi başka bir ürüne bağlayın; aynı belgeyi iki üründe de açabildiğinizi doğrulayın.
9. Mevcut bir **deneme belgesini** uygulamadaki Bilgi > Yeniden adlandır üzerinden güncelleyip Drive'da kontrol edin.

## Güvenlik ve veri bütünlüğü

- Garanti silinmesi geri alınamaz; yanlışlık halinde önceki JSON yedeğinden **tam geri yükleme** gerekir. Ancak tam geri yükleme diğer son değişiklikleri de etkileyebilir.
- Drive yeniden adlandırma, fiziksel dosyayı taşımaz/silmez. Sadece dosyanın `name` alanı güncellenir.
- Drive dosyalarını uygulama hesabından erişilebilir tutun; OAuth izinlerinin süresi dolarsa yeniden bağlanmak gerekir.
- Gerçek Firebase ve Drive hesaplarına bu ortamdan bağlanılmadı. Kodun tarayıcı testi mock servislerle yapıldı; uygulamanın kendi hesabınızda test edilmesi gerekir.

## Değişiklik günlüğü

Faz 4: `app.js`, `app.css`, `drive.js` değiştirildi; `filename.js` eklendi. Veritabanı şema sürümü aynı kalır; mevcut ürün/garanti/belge kayıtlarının aktarımı gerekmez.
