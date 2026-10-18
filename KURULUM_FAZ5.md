# GarantiTakip - Faz 5: Drive arşiv düzeni ve eski belge adları

Bu güncelleme **halihazırda çalışan Faz 4 sürümüne** uygulanır. Mevcut Firebase/Google hesabı, güvenlik kuralları, API izinleri ve veritabanı şeması değişmez.

## Ne eklendi?

### 1. Drive'daki eski yüklemelerin toplu adlandırılması

- **Belge Arşivi → Eski belgeleri adlandır** düğmesini kullanın.
- Önizlemede eski ad ve önerilen yeni ad ayrı ayrı gösterilir.
- Kullanıcı onayından sonra Drive API'siyle dosyanın **name** alanı değiştirilir; daha sonra Firebase'deki belge adı güncellenir.
- Adlandırma şeması: `Ürün Adı - YYYY-AA-GG - Belge Türü - Kısa Açıklama - KısaKod.uzantı`.
- Bir işlemde en fazla **20** eski dosya işlenir. Daha çok dosya varsa işlemi yeniden başlatın.
- Yalnızca GarantiTakip tarafından Drive'a yüklenmiş ve eski şemada olan belgeler toplu işleme alınır (`source: drive-upload`).
- Google Picker aracılığıyla **başka klasörlerden bağlanan belgeler otomatik yeniden adlandırılmaz**. Bunları tek tek **Belge Bilgileri → Yeniden adlandır** ile düzenleyebilirsiniz.
- Belgenin dosya ID'si, içeriği ve Firebase'deki diğer ürün/servis bağlantıları korunur.
- Drive'daki gerçek ad, uygulamanın sakladığı adla eşleşmiyorsa toplu işlem o belgeyi atlar; Drive'da elle yapılan bir değişikliğin üzerine yazmaz.
- Eksik tarih veya tespit edilemeyen uzantı varsa dosya toplu işlemde atlanır; tekil adlandırma kullanılabilir.

### 2. Drive klasörünü yönetme

Zaten uygulama yüklemelerini `GarantiTakip` ana klasörü altında `Faturalar` ve `Urunler` alt klasörlerine kaydediyordu. Yeni **Ayarlar → Drive arşiv klasörü** bölümünden:

- **Klasörü aç:** Arşivi yeni Drive sekmesinde açar. Henüz oluşmamışsa yeni bir arşiv klasörü oluşturabilir.
- **Konum değiştir:** Google Picker üzerinden **hedef üst klasörü** seçin. Mevcut `GarantiTakip` ana klasörü **bütün alt klasörleriyle beraber** bu üst klasöre taşınır; dosyaları ayrı ayrı taşımaz. Dosya ID'leri değişmez.
- **Adını değiştir:** Ana arşiv klasörünü `Garanti Belgelerim` gibi istediğiniz bir adla değiştirebilirsiniz.

Örnek yeni Drive konumu:

```
Drive'ım/
  Kişisel Arşiv/
    Garanti Belgelerim/
      Faturalar/
      Urunler/
        PRD-... - Urun Adi/
```

**Önemli:** Google Picker ile uygulamaya yalnızca ilişkilendirdiğiniz başka klasörlerdeki dış dosyalar **taşınmaz**. Bunların orijinal konumu korunur. Onları da arşive almak isterseniz kendi Drive arayüzünüzden kontrollü biçimde taşıyabilirsiniz. Drive API, yetki verilmeyen bir dış belgeyi taşıyamaz. Yanlış hedef veya klasörün kendi altına taşınması halinde Drive hata verebilir; taşıma yapılmaz.

## GitHub güncellemesi

1. Önce **Ayarlar → JSON yedeğini indir** ile güncel Firebase verilerinizi yedekleyin. Bu yedek Drive dosyalarının **kendilerini** kapsamaz. Kritik belgeleri ayrıca Drive'dan yedekleyin.
2. Repodaki şu dört dosyayı ZIP içindekilerle **aynı commit'te** değiştirin:
   - `app.js`
   - `app.css`
   - `drive.js`
   - `filename.js`
3. `config.js`, `cloud.js`, `integrity.js`, `bootstrap.js`, `index.html` ve Firebase güvenlik kuralları **değişmeyecek**.
4. GitHub Pages yayımlandıktan sonra sayfayı Ctrl+F5 ile yenileyin; mobil Safari'de sekmeyi kapatıp yeniden açın.

## Önerilen canlı test

1. Ayarlar'dan Drive'a bağlı olduğunuzu doğrulayın ve **Klasörü aç** işlevini kullanın.
2. Eski isimli bir deneme belgesi için **Belge Arşivi → Eski belgeleri adlandır** önizlemesini açın. Uygun görünüyorsa onaylayın; Drive'da yeni dosya adını kontrol edin.
3. Drive'ınızda deneme amacıyla `Kişisel Arşiv` gibi bir **hedef üst klasör** oluşturun. **Konum değiştir** ile onu seçin. `GarantiTakip` klasörünün hedefin altına taşındığını ve PDF bağlantılarının hâlâ açıldığını kontrol edin.
4. **Adını değiştir** ile ana klasör adını güncelleyin, yine PDF erişimini doğrulayın.
5. Bir deneme dosyası daha yükleyerek yeni konuma kaydolduğunu kontrol edin.

## Notlar

- Arşiv taşıma, Drive API `files.update` `addParents` / `removeParents` üzerinden yapılır. Dosyaların içerikleri kopyalanmaz.
- `drive.file` erişim kapsamı değişmez; yeni Google Cloud kapsamı veya Firebase kuralı gerekmez.
- Dosya adları Drive üzerinde değiştirildiği için Google Drive'daki adlar da güncellenir.
- Google OAuth erişim süresi bittiğinde **Drive'ı bağla** ile yeniden giriş yapmanız gerekebilir.
- Gerçek hesap üzerinde taşıma testi bu ortamda yapılmadı; Playwright testleri taklit Drive/Firebase servisleriyle yapıldı. Bu nedenle önce yedek alın, ilk taşıma için deneme klasörü kullanın.
