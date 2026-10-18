# GarantiTakip - Faz 6 / Kanit Silme

## Amac
Mevcut PDF, fotograf, fatura ve servis kanitlarinin uygulamadan kaldirilmasini saglar. Belgenin Drive'da fiziksel kalmasi veya cop kutusuna tasinmasi **ayri onay gerektiren** islemlerdir.

## Kurulum
1. **Canli GarantiTakip uygulamasinda Ayarlar > JSON yedegini indir** ile yeni bir yedek alin. Bu yedek Drive'daki dosyalarin kendilerini icermez.
2. GitHub `garantitakip` deposunun `main` dalindaki uygulama kok dizininde asagidaki 4 dosyayi ayni commit'te yukleyin / degistirin:
   - `app.js` (guncelle)
   - `app.css` (guncelle)
   - `drive.js` (guncelle)
   - `document-delete.mjs` (yeni dosya; dosya uzantisi aynen `.mjs` olmalidir)
3. GitHub Pages yayini bitince tarayicida hard refresh yapin (Windows `Ctrl + F5`).
4. `config.js`, `filename.js`, `cloud.js`, `integrity.js`, `bootstrap.js`, Firebase kurallari ve Google Cloud OAuth / Picker ayarlari **degismeyecek**.

## Yeni silme akisi
Belge Arsivi veya Urun Detayi / Belgeler veya Servis Detayi / Belgeler listesinde cop kutusu ikonuna basin; alternatif olarak Belge Bilgileri > Kaldir / Sil yolunu kullanin.

- **Baglantiyi kaldir**: Belgenin secilen urun/servis kaydiyla iliskisini kaldirir. Diger baglantilar kalir. Son baglanti kaldirildiginda Firebase belge kaydi da temizlenir. Google Drive dosyasina dokunulmaz.
- **Tum kayit baglantilarini kaldir**: Belgeyi Firebase'deki `documents` ve `documentLinks` koleksiyonlarindan tamamen kaldirir; baska urunlerdeki iliskiler de silinir. Dosya Drive'da kalir. Onay ekrani vardir.
- **Drive cop kutusuna tasi**: Sadece uygulamanin Drive'a yukledigi, en fazla bir baglantisi olan ve ayni Drive kimligi baska belge kaydinca kullanilmayan dosyalarda sunulur. Google Drive `capabilities.canTrash` izni ayrica dogrulanir. Ardindan dosya cop kutusuna tasinir ve Firebase referansi silinir. Kalici `DELETE` kullanilmaz.
- **Drive'dan secilen dis dosyalar**: Varsayilan olarak Drive'da kalir. Bu dosyalari Google Drive'dan dogrudan silmeniz gerekiyorsa Drive'i kullanin.

## Test sirasi
1. Bir belgenin yalnizca urun baglantisini kaldirin. Drive'da dosya kalmali.
2. Bir belgenin iki farkli urunle baglantisi varsa bir baglantisini kaldirin. Digeri kalmali.
3. Deneme icin yuklediginiz ve baska urunle paylasilmayan bir dosyayi Drive cop kutusuna tasiyin. Dosya Drive Cop Kutusu'nda gorunmeli, uygulama kaydi kalkmali.
4. Uygulamayi yenileyin, diger urun ve dosyalari kontrol edin.

## Onemli guvenlik aciklamalari
- Firebase ve Google Drive iki ayri servis oldugu icin silme islemi tek atomik islem degildir. Drive'a tasima basarili, Firebase yazimi basarisiz olursa uygulama otomatik Drive'dan geri alma denemesi yapar. Geri alma da basarisiz olursa Drive Cop Kutusu'ndan dosyayi manuel geri getirin.
- Silinen Firebase belge kayitlari normal uygulamadan geri alinmaz; silme oncesinde indirilen JSON yedeginden kurtarma veya Drive'daki dosyayi yeniden baglama gerekir.
- Bu degisiklikler tum mevcut urunleri, garanti surelerini, servisleri ve diger belgeleri oldugu gibi korur; toplu otomatik silme yoktur.
- Drive API scope degisimi gerekmez: uygulama mevcut `drive.file` izniyle Google Drive yetki kontrolunu yapar.

## Dogrulama kapsamimiz
Kod soz dizimi, veri baglantisi silme yardimci fonksiyon testleri ve simulasyon bazli masaustu/mobil tarayici testleri basarili. Kullanici hesabinda canli Drive silme testi bu paket asamasinda yapilmadi.
