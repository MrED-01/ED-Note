# ED Note

PDF okuma, alıntılama, kalemle not alma ve ses kaydı için kişisel bir uygulama.

- Tamamen tarayıcıda çalışır, sunucuya hiçbir veri gönderilmez.
- Notlar, kalem çizimleri, görseller ve ses kayıtları cihazın kendi deposunda (IndexedDB) saklanır.
- Bilgisayarda (Chrome/Edge) bir klasöre bağlanarak projeyi otomatik olarak oraya da kaydedebilir.
- Projeler `.alinti.zip` olarak dışa ve içe aktarılabilir.

Kullanılan açık kaynak kütüphaneler: [PDF.js](https://mozilla.github.io/pdf.js/) (Apache 2.0), [JSZip](https://stuk.github.io/jszip/) (MIT).

## Sürüm 4 (Aşama 3)

- **Projeler:** Bir projede birden fazla PDF. Belge başlığındaki **+** ile ekle, sekmelerle geç.
- **Yan yana:** ⧉ düğmesi iki belgeyi yan yana açar.
- **Gruplar ve yığınlar:** Bir kartı başka bir kartın üstüne bırak, grup olur. Ok düğmesi grubu yığına çevirir.
- **Birden fazla masa:** Masa sekmeleri, **+** ile yeni masa, **⋯** ile adını değiştir ya da sil.
- **Belgeye bağlantı:** Karttaki bağlantı düğmesine bas, sonra belgede bir kalem çizgisine, metin kutusuna ya da yoruma dokun.
- **Yorumlar:** Metni seç, **Yorum**'a bas. Kenarda turuncu iğne çıkar. "Masaya ekle" ile karta çevrilir.
- **İçindekiler ve yer imleri:** Belge başlığındaki kitap simgesi.
- **Arama:** Projedeki tüm belgelerde arar, sonuçlar belgeye göre gruplanır.
- Eski (v3) projeler otomatik olarak yeni biçime taşınır. Eski `.alinti.zip` dosyaları da içe aktarılabilir.

## Sürüm 5

- Yeni ad ve logo: **ED Note**.
- **Kalınlık kaydırıcısı:** Kalem (0,3 ile 24 pt), fosforlu (4 ile 48 pt), yazı (6 ile 72 pt) ve silgi (4 ile 120 pt). Üç hazır uçtan birini seç, kaydırıcıyla değiştir; değer o uca kaydedilir. Klavyede `[` ve `]`.
- **Düz çizgi:** Kalem ve fosforlu için serbest ya da düz çizgi seçimi. Düz çizgi yatay, dikey ve 45 dereceye yapışır. Bilgisayarda Shift'e basılı tutarak da düz çizilir.
- **.ednote dosya biçimi:** Dışa aktarılan projeler artık `.ednote` uzantılı. Eski `.alinti.zip` dosyaları açılmaya devam eder. Bilgisayarda uygulamayı yüklediysen `.ednote` dosyasına çift tıklayınca açılır.
- Kayıtlı projeler aynen korunur.

## Sürüm 5.1

- Logo, elle düzeltilen kıvrımlara göre yeniden çizildi.
- **Çizgiyle bağlantı:** Kalemle bir karttan belgeye, belgeden karta ya da karttan karta çizgi çek. Çizgi mürekkep olarak kalmaz, ok uçlu bir bağlantıya dönüşür. Belgede bağlantının ucuna yeşil bir işaret konur; işarete dokununca bağlı kart açılır.
- Bağlantı düğmesiyle bağlarken artık belgede herhangi bir yere dokunabilirsin.

## Sürüm 6

- **Masa sayfası:** Masa artık sınırsız değil, bir kağıt gibi. Varsayılan boyut A1 yatay (84 × 59 cm), en fazla 200 × 200 cm. Kartlar, gruplar ve çizimler sayfanın dışına çıkamaz, sayfa kaydırmayla kaybolmaz.
- **Boyut ve desen:** Masa sekmesindeki **⋯** menüsünde "Sayfa boyutu ve deseni". Hazır boyutlar (A3 ile 2A0 arası), yatay ya da dikey, santimetre olarak özel boyut. Desenler: boş, noktalı, kareli, çizgili, milimetrik. İçerik sığmıyorsa sayfa küçültülemez.
- **Notlu PDF:** **⋯ → Notlu PDF olarak dışa aktar.** Vurgular, yorumlar ve kalem çizgileri gerçek PDF notu olur (Acrobat, Edge ve Zotero okur). Metin kutuları sayfaya yazılır. Her masa ayrı bir sayfa olarak eklenir; sayfa boyutu kullanılan alan kadardır. Kart ile belge arasındaki bağlantıların iki ucuna aynı numara konur, numaralar tıklanabilir. Belgeler, yer imleri ve masalar PDF'in içindekiler panelinde görünür.
- **Eski sürüm uyumluluğu:** Her yeni sürüm, önceki tüm sürümlerin dosyalarını açar ve düzenler. `tests/` klasöründe her sürümden örnek dosyalar ve otomatik test var.

## Test

```
python3 -m http.server 8765
node tests/compat.test.js http://localhost:8765/
```

Her yeni sürümden önce bu test çalıştırılır. Yeni bir sürüm yayınlandığında, o sürümle kaydedilmiş bir örnek dosya `tests/fixtures/` klasörüne eklenir ve `expected.json` güncellenir.

Üçüncü taraf bileşenlerin lisansları `vendor/LICENSES/` klasöründe.

## Sürüm 6.1

- **Kartlarda yazı boyutu:** Seçili kartın altındaki **A−** ve **A+** ile yazıyı küçült ya da büyüt (klavyede **−** ve **+**). Büyüyen yazıyla kart da genişler. Son seçtiğin boyut yeni kartlarda da kullanılır.
- **Kendiliğinden büyüyen masa:** Masa A2 boyutunda başlar; bir kartı, grubu ya da çizimi kenara yaklaştırdıkça kendiliğinden büyür. En fazla 200 × 200 cm. Masa normal boyutta (yüzde 100) açılır.
- **Yeni kartlar boş yere:** Yeni kartlar masada görünen boş bir yere konur, birbirinin üstüne binmez.
- **Birden fazla kitap:** PDF açarken birden fazla dosya seçebilirsin; hepsi aynı projeye girer ve yan yana açılır. Alıntıları tek masada buluşur.
- **Kitaptan kitaba bağlantı:** Yan yana görünümde kalemle bir belgedeki yerden diğer belgedeki yere çizgi çek. İki ucuna işaret konur; işarete dokununca karşı uca gidersin. Aynı belge içinde çizilen çizgiler normal kalem çizgisi olarak kalır. Notlu PDF'te iki uçta aynı numara olur.

## Sürüm 6.2

- **Sınırsız masa:** 2 metre sınırı kaldırıldı. Masa içerik ekledikçe büyür, kaydırırken hep görünür kalır. Çok büyük masalar notlu PDF'te sayfa sınırına (yaklaşık 5 m) sığacak şekilde otomatik küçültülür.
- **Kart görünümü:** Seçilen renk artık kartın çerçevesini ve başlık şeridini boyar. Seçili kartta palet düğmesiyle kağıt rengi (beyaz, krem, sarı bloknot, kraft, kahverengi, yeşil, mavi, pembe, gri), çerçeve (yok, ince, kalın) ve yazı tipi seçilir. Görsel kartlarında da aynı. Son seçimler yeni kartlarda kullanılır.
- **40 yazı tipi:** 20 bilimsel ve akademik (STIX Two, Libertinus, Times uyumlu Tinos, Cambria uyumlu Caladea, Georgia uyumlu Gelasio ve diğerleri), 9 sade (Calibri uyumlu Carlito, Arial uyumlu Arimo ve diğerleri), 3 teknik, 8 sıcak (el yazısı dahil). Hepsi Türkçe karakterleri destekler. Kartlarda ve belgedeki metin kutularında kullanılır, notlu PDF'e gömülür. Yazı tipinde olmayan harfler (örneğin el yazısı yazı tipinde Yunan harfleri) PDF'te yedek yazı tipiyle yazılır.
- **Masa kağıdı rengi:** Masa ⋯ menüsündeki "Sayfa boyutu ve deseni" bölümünde kağıt rengi seçilir; desenlerle birlikte kullanılır. Koyu temada renkler koyu karşılıklarıyla görünür.

## Sürüm 6.3

- **Kartlarda formül:** Notlara LaTeX ile formül yaz: satır içinde `$\sigma = E\varepsilon$`, ayrı satırda ortalanmış `$$\sigma = \frac{F}{A_0}$$`. Karttan çıkınca formül çizilmiş hâliyle görünür; dokununca yazıya geri döner. Hatalı formül kırmızı altı çizili gösterilir. Formüller notlu PDF'e de çizilir. Para birimi gibi tek başına `$` içeren eski notlar formül sayılmaz (`$5 ve $10` düz yazı kalır); `\$` her zaman düz dolar işaretidir. Formül motoru (MathJax) yalnızca ilk formülde yüklenir ve çevrimdışı çalışır.
- **Sayfa küçük resimleri:** Belge başlığındaki sayfa numarasına (örneğin `3 / 120`) ya da kitap simgesine dokun. "Sayfalar" sekmesinde tüm sayfalar küçük resim olarak görünür; bulunduğun sayfa vurgulanır, kart alınan sayfalarda kart sayısı, yer imli sayfalarda kırmızı işaret olur. Dokununca o sayfaya gidersin. "İçindekiler" sekmesinde yer imleri ve belgenin içindekiler tablosu durur.
- **Kalın kitaplarda hız:** Görünümden uzaklaşan sayfalar belleği boşaltır, geri dönünce yeniden çizilir. Yüzlerce sayfalık kitaplar tablette çökmeden kaydırılabilir.

## Sürüm 6.4

- **Etiketler:** Seçili kartın altındaki **#** düğmesiyle karta etiket ver (örneğin `vize`, `laminat`). Etiketler kartta küçük işaret olarak görünür; birine dokununca o etiketli kartlar bulunur.
- **Masada arama:** Masanın alt çubuğundaki büyüteçle kartların yazısında, notunda ve etiketlerinde ara, üstteki etiketlere dokunarak süz. Bulunanlar öne çıkar, diğerleri soluklaşır. Enter ile sıradakine gidilir; başka masadaki sonuçlara da geçer.
- **Sınav modu:** ⋯ menüsünden ya da aramadaki **Sınav** düğmesiyle. Kartlar bilgi kartı gibi tek tek gelir: önce notun, sonra alıntı (ya da tersi). Not kartlarında ilk satır soru, altı cevap; araya `---` satırı da konabilir. **Tekrar** dediğin kart birkaç kart sonra yeniden gelir. Sonunda kaç kartı ilk seferde bildiğin yazar. Klavyede Boşluk, 1 ve 2.
- **Fotoğraf:** Masa çubuğundaki kamerayla fotoğraf çek ya da galeriden seç; masaya fotoğraf kartı olarak gelir. Ses kaydı sürerken eklenirse kaydın o anına bağlanır (tahta, slayt).
- **Okuma modları:** ⋯ menüsünde Normal, Gece, Sepya. Yalnızca PDF sayfaları değişir, masa aynı kalır.
- Telefonda üst çubukta belge adının düğmelerin üstüne binmesi düzeltildi.

## Sürüm 6.5

- **OneDrive eşitleme:** Ana ekrandaki OneDrive satırından Microsoft hesabınla bağlan. Projeler, PDF'ler ve ses kayıtları OneDrive'da "Uygulamalar/ED Note" klasörüne gider; diğer cihazda aynı hesapla bağlanınca gelir. Eşitleme kendiliğinden olur: düzenledikten kısa süre sonra, uygulamadan çıkarken, internet gelince ve açıkken birkaç dakikada bir. ⋯ menüsünde "OneDrive ile şimdi eşitle" de var.
  - Kaydırma ve yakınlaştırma değişiklik sayılmaz, yalnızca içerik.
  - Aynı proje iki cihazda birden değiştiyse hiçbir şey silinmez: bu cihazdaki sürüm kalır, diğeri "(diğer cihaz, tarih)" adıyla ayrı proje olarak kaydedilir.
  - Ana ekrandan silinen proje OneDrive'dan ve diğer cihazlardan da silinir.
  - Microsoft, tarayıcı uygulamalarında oturumu yaklaşık 24 saatte bir yeniletir; o zaman "Yeniden giriş" düğmesi çıkar.
- **Bağlantıları düzenleme:** Bir oka dokununca küçük bir araç çubuğu açılır: renk (6), ok ucu (sonda, başta, iki uçta, oksuz), kesikli çizgi ve silme. Kartlar arası, kart ile belge arası ve belgeden belgeye bağlantıların hepsinde çalışır; notlu PDF'e de aynı renk ve uçlarla geçer. Son seçilen renk ve kesikli ayarı yeni bağlantılarda kullanılır.
- **Masada boş noktada biten bağlantı:** Kartın bağla düğmesine bastıktan sonra masada boş bir yere dokun; bağlantı orada biter. Ucundaki noktayı sürükleyerek taşıyabilirsin.
- **Aynı kitabın iki yeri arasında bağlantı:** Yan yana görünümde iki tarafta da aynı belgeyi aç, kalemle bir taraftan diğerine çizgi çek.

### OneDrive'ı açmak (bir kere, yayına aldıktan sonra)

1. https://entra.microsoft.com adresine Microsoft hesabınla gir. (Kişisel hesapla olmuyorsa https://portal.azure.com, "Microsoft Entra ID" bölümü.)
2. **App registrations > New registration**.
   - Name: `ED Note`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: platform olarak **Single-page application (SPA)** seç, adres: `https://mred-01.github.io/ED-Note/` (sondaki eğik çizgi dahil, sitenin tam adresi)
3. **Register**'a bas. Açılan sayfadaki **Application (client) ID** değerini kopyala.
4. **API permissions** bölümünde `Microsoft Graph > Delegated > Files.ReadWrite.AppFolder` iznini ekle (`User.Read` zaten vardır).
5. Depodaki `config.js` dosyasında `onedriveClientId: ""` satırının tırnakları arasına bu kimliği yapıştır ve kaydet.

Kimlik gizli bir şifre değildir, depoda durabilir. Gizli anahtar (client secret) oluşturmaya gerek yok, oluşturma.

## Sürüm 6.6

- **Laptopta kamera:** Kamera düğmesi bilgisayarda doğrudan kamerayı açar; deklanşöre (ya da Boşluk tuşuna) basınca fotoğraf masaya gelir. "Dosyadan seç" ile kayıtlı bir fotoğraf da eklenebilir. Telefonda telefonun kendi kamera ekranı açılır.
- **Kitaptan masadaki herhangi bir noktaya ok:** Kalemle kitap sayfasından masada boş bir yere (örneğin kendi el yazının yanına) çizgi çek; ok o noktada biter. Tersi de olur: masada boş bir yerden kitap sayfasına çizgi çek. Uçtaki işarete dokununca karşı uca gidilir; masadaki nokta seçiliyken sürüklenerek taşınır. Renk, uç ve kesikli ayarları diğer oklardaki gibi. Notlu PDF'te iki uçta aynı numara olur.

## Sürüm 6.6.1 ve 6.6.2

- Ana ekranın altında sürüm numarası görünür.
- Uygulama her açılışta dosyaların yenisini sorar; GitHub'a yüklenen yeni sürüm hemen gelir.
- Kamera penceresi dokunmatik ekranlı laptoplarda da açılır. Fosforlu kalemle de kitaptan masaya ok çekilebilir.
- **Okuma modları artık tüm uygulamayı boyar:** Gece seçilince arka plan, menüler, masa ve kartlar koyu olur; PDF sayfası ters çevrilmez, sadece biraz kısılır (siyah resimler görünür kalır). Sepya tüm uygulamayı sıcak kağıt rengine boyar. Normal, cihazın açık ya da koyu ayarını takip eder.

## Sürüm 6.7

- **Video:** Kamera düğmesinden fotoğrafın yanında video da eklenir (telefonda kamera video çekebilir, bilgisayarda "Dosyadan seç"). Çözünürlük sınırı yok, 4K da olur. Video projeden ayrı saklanır; karta dokununca oynar. Ses kaydı sürerken eklenirse kaydın o anına bağlanır.
- **Yer kalmazsa:** Video eklenmeden önce tarayıcıdaki boş alan ölçülür. Yetmezse "Videoyu cihazına kaydedip masaya kartını ekleyeyim mi?" diye sorulur. Evet denirse video telefona ya da bilgisayara kaydedilir (iPhone ve iPad'de paylaş menüsünden "Videoyu Kaydet"), masaya kapak resmi olan bir kart gelir. Karta dokununca dosyayı seçip izlersin; sonradan yer açılırsa "Projeye al" ile projeye alınır. Notlar ve proje kaydı bundan hiç etkilenmez.
- Videolar .ednote dosyasına ve OneDrive'a da gider (OneDrive'da `media` klasörü). Bir cihazda yer yetmiyorsa video orada indirilmez, kart durur.
- Notlu PDF'te video kartı kapak resmiyle görünür.

## Sürüm 6.7.1

- **Telefonda kamera menüsü:** Kamera düğmesine dokununca üç seçenek çıkar: Fotoğraf çek, Video çek, Galeriden ya da dosyadan seç.
- **Video çekerken ses kaydı duraklar:** Ses kaydı sürerken "Video çek" seçilirse kayıt otomatik duraklar, video bitince devam eder; saat de durur, notlar kayıtla uyumlu kalır. Video, çekime başlandığı ana bağlanır.
- **Mikrofon elden giderse:** Bazı telefonlarda (özellikle iPhone, iPad) kamera mikrofonu tamamen alır. O zaman kaydın o ana kadarki kısmı saklanır ve kayıt "(devam)" adıyla yeni bir parça olarak kendiliğinden sürer. Hiçbir ses kaybolmaz.

## Sürüm 6.7.2

- **Bilgisayarda video:** Kamera penceresinde üstte **Fotoğraf / Video** seçimi var. Video seçiliyken yuvarlak düğme kırmızı olur: bir basış başlatır, bir basış durdurur (Boşluk tuşu da aynı). Süre ve boyut kayıt sırasında görünür. Ses kaydı sürüyorsa video boyunca duraklar, sonra devam eder. Pencereyi kapatmak kaydı durdurur ve videoyu saklar.
- **Tek basış, tek fotoğraf:** Boşluk tuşuna art arda ya da basılı tutarak basınca artık sadece bir fotoğraf çekilir.

## Sürüm 6.8: Android uygulaması ve lisans

- **Lisans:** Uygulama açılışta lisans kodu ister (EDN-XXXX-XXXX-XXXX). Kod, `ednote-lisans` deposundaki `liste.json` ile karşılaştırılır; listede kodların sadece özeti durur. Uygulama günde en fazla iki kez listeye bakar. İnternet yoksa 7 gün daha çalışır. Listeden çıkarılan kod en geç bir gün içinde kilitlenir; kilitliyken bile projeler dışa aktarılabilir, notlar silinmez. Kodlar `lisans-araci.html` ile üretilir (bu dosya depoda değil, sadece Ekrem'de).
- **Android:** Depo bir Capacitor projesi. Her yüklemede GitHub Actions APK üretir (Actions > son çalışma > Artifacts > ED-Note-APK). APK aynı anahtarla imzalanır, yeni sürüm eskisinin üstüne kurulur ve notlar kalır. İmza anahtarı depoda değil, GitHub Secrets'ta: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`.
- Uygulama içinde dışa aktarılan dosyalar (.ednote, notlu PDF, Markdown, video) paylaş menüsüyle kaydedilir ya da gönderilir. Android geri tuşu açık pencereyi kapatır, editörden ana ekrana döner.
- Uygulamadaki kod küçültülmüş (okunması zor) hâlde paketlenir.
- OneDrive'ın uygulamada çalışması için Entra kaydına ikinci yönlendirme adresi eklenir: `https://localhost/` (Tek sayfalı uygulama).

## Sürüm 6.8.1

- **Tabletlerde yan yana görünüm:** Tablet dikey tutulduğunda da belge solda, masa sağda durur (bilgisayardaki gibi). Aradaki çizgiyi sürükleyerek genişlikler ayarlanır. Sadece telefonlarda (dar ekran ya da yatay tutulan telefon) Belge / Masa sekmeleri kullanılır.

## Sürüm 6.8.2

- **Sadece belge yakınlaşır:** Belge penceresinde iki parmakla (telefon, tablet) ya da Ctrl + fare tekerleği / dokunmatik yüzeyde iki parmak (bilgisayar) ile yakınlaştırınca sadece PDF sayfası büyür; parmakların altındaki yer yerinde kalır. Uygulamanın geri kalanı (araç çubuğu, menüler, düğmeler) hiç büyüyüp küçülmez. Ctrl + / Ctrl - / Ctrl 0 de belgeyi yakınlaştırır, uzaklaştırır, genişliğe sığdırır. Tekerlek tek başına sayfaları kaydırır.
- **Parmağa uygun düğmeler:** Telefon ve tablette düğmeler en az 40 ile 44 piksel; araç çubuğu, menüler, kart düğmeleri, renk noktaları, etiketler büyüdü. Dokunmatik ekranda belgenin - / + düğmeleri gizlenir (iki parmak yeterli), masa çubuğunda da - / + yerine iki parmak kullanılır.

## Sürüm 6.8.3: otomatik güncelleme

- ED-Note deposuna her yüklemede Actions APK'yı üretir, `ednote-lisans` deposunun **Releases** bölümüne koyar ve `liste.json`'a en yeni sürümün bilgisini yazar (`latest`). Bunun için ED-Note'ta `LISANS_TOKEN` adlı Secret gerekir (sadece `ednote-lisans` deposuna, Contents: Read and write izinli ince ayarlı erişim anahtarı). Secret yoksa bu adım atlanır, APK yine üretilir.
- Uygulama lisans listesine baktığında daha yeni bir sürüm görürse üstte "Yeni sürüm hazır" şeridi çıkar: **İndir** APK'yı tarayıcıda indirir (eskisinin üstüne kurulur, notlar kalır), **Sonra** bir gün sormaz.
- Yükleme yaparken GitHub'daki "Commit changes" kutusuna yazdığın ilk satır, güncelleme notu olarak kullanıcılara gösterilir ("Add files via upload" gibi hazır metinler gösterilmez).
- Arkadaşlara ilk kurulum için kalıcı indirme adresi: https://github.com/MrED-01/ednote-lisans/releases/latest/download/ED-Note.apk

## Sürüm 6.8.4

- Uygulama ilk kez açılıp lisans kodu girildiğinde OneDrive satırı görünmüyordu (sadece yeniden açınca çıkıyordu). Artık kod girilir girilmez görünür.

## Sürüm 6.8.5

- **Bölme çizgisi:** Belge ile masa arasındaki çizgi artık çok daha sağa (masa en az yaklaşık 170 piksel kalacak kadar) ve sola sürüklenebilir. Çizgiyi ekranın sağ kenarına kadar sürükleyince masa gizlenir, belge tüm ekranı kaplar; sol kenara kadar sürükleyince belge gizlenir, masa tüm ekranı kaplar. Kenarda kalan çubuğa dokununca gizlenen taraf son genişliğiyle geri gelir. Seçim uygulama kapanıp açılınca da korunur. Dokunmatik ekranlarda çizgi parmakla tutulacak kadar geniş.

## Sürüm 6.9: kütüphane (giriş ekranı)

- Giriş ekranı artık bir dosya yöneticisi: solda **Projelerim**, **Son açılanlar** ve **Çöp kutusu**; sağda projeler ilk sayfalarının küçük resmiyle kart olarak görünür. Sağ üstten arama, sıralama (son açılan, son değişen, ada göre), liste/kart görünümü ve **yeni klasör**.
- **Klasörler:** İstediğin kadar iç içe klasör açabilirsin. Bir klasörün içindeyken açtığın ya da içe aktardığın PDF/proje o klasöre girer. Projeyi kartın ⋯ menüsündeki **Taşı** ile ya da sürükleyip klasörün (veya üstteki yol çubuğunun) üstüne bırakarak taşırsın. Klasörü yeniden adlandırabilir, silebilirsin (içindekiler çöp kutusuna gider).
- **Çöp kutusu:** Silinen projeler 30 gün çöp kutusunda bekler, **Geri al** ile döner; süre dolunca ya da **Çöp kutusunu boşalt** ile kalıcı silinir.
- OneDrive açıksa klasör yerleşimi ve çöp kutusu öbür cihazlara da geçer.
- Aramada Türkçe "ı/i" farkı artık sorun çıkarmıyor ("ikinci" yazınca "Ikinci" de bulunur). Bu, belge içi aramayla masa aramasında da geçerli.
- Telefonda sol panel üstte başlık olarak durur.

## Sürüm 6.9.1: lisans Microsoft hesabına bağlı (Cloudflare)

- Her lisans kodu ilk kullanıldığında bir Microsoft hesabına (kişisel ya da okul hesabı) bağlanır. Aynı hesapla istenen sayıda cihazda çalışır; başka bir hesap aynı kodu kullanamaz ("Bu kod başka bir Microsoft hesabına bağlı").
- Her yeni cihazda bir kere Microsoft girişi yapılır. Sonraki kontrolleri uygulama kendi başına yapar; internetsiz 7 gün toleransı aynen geçerli.
- Bunu Cloudflare'da çalışan küçük bir sunucu yapar: `cloudflare/worker.js`. Hangi kodların geçerli olduğu yine `liste.json`'dan okunur; lisans aracıyla kod eklemek ve iptal etmek eskisi gibi.
- Daha önce kod girmiş kullanıcılar bir kere "Microsoft hesabınla doğrula" ekranını görür.
- Lisans aracında kimin hangi hesapla bağlı olduğu ve hangi cihazları kullandığı görünür; **Bağı çöz** ile kod yeni bir hesaba bağlanabilir.
- Uygulamanın altında "Lisans: isim" yazar (isim Microsoft hesabından gelir).
- `config.js` içindeki `licenseApiUrl` boşsa uygulama eskisi gibi sadece listeye bakar.

## Sürüm 6.9.2

- Android uygulamasında Microsoft girişinden (lisans ve OneDrive) dönünce çıkan "Web sayfası mevcut değil, ERR_CONNECTION_REFUSED" hatası düzeltildi (`MainActivity.java`).
- Giriş ekranında kişisel Microsoft hesabı öneriliyor.

## Sürüm 6.9.3: daha hızlı ve takılmayan OneDrive eşitlemesi

- Dosyalar artık 3'er 3'er gönderiliyor ve alınıyor (önce tek tek gidiyordu).
- Bir dosyada hata çıkınca sadece o proje bekliyor, diğerleri eşitlenmeye devam ediyor. Hatalı proje 30 sn, 1 dk, 2 dk, sonra 5 dakikada bir kendiliğinden yeniden deneniyor. Durum satırında "N proje eşitlenemedi, yeniden denenecek" yazıyor.
- Her isteğin süre sınırı var. Telefonda uygulama arka plana geçip yarım kalan bir indirme takılırsa, uygulamaya dönünce eşitleme kendini durdurup baştan başlıyor (önceden uygulama kapatılıp açılana kadar hiçbir şey eşitlenmiyordu).
- Büyük dosyalarda kopan parça 3 kere yeniden gönderiliyor. Süresi dolan indirme bağlantısı yenileniyor.
- Önceki bir eşitleme yarıda kaldıysa eksik PDF, ses ve videolar sonraki turda tamamlanıyor.
- Her proje gelir gelmez ana ekranda görünüyor; durum satırında kaç dosyanın tamamlandığı yazıyor.
- Dosyalar gönderilirken sayfayı kapatmaya çalışınca tarayıcı önce soruyor.
- OneDrive bağlantısını kesip aynı hesapla yeniden bağlanınca uygulama neyin eşitlendiğini unutmuyor, her şeyi baştan indirip karşılaştırmıyor. Başka bir hesapla bağlanınca temiz başlıyor.
- Yeni test: `tests/onedrive.test.js` (sahte OneDrive, iki cihaz, hatalı dosya, takılan indirme, yeniden bağlanma).

## Sürüm 6.9.4: biçimli notlar, geniş renk paleti, yumuşak kalem, .ednote ile aç

- **OneDrive düğmesi:** Eşitlerken düğmede "Eşitleniyor %…" yazıyor ve çerçevesinde mavi bir ışık dönüyor; çerçeve ilerledikçe doluyor. Bitince kısa süre yeşil "✓ Eşitlendi", sorun çıkarsa "Tekrar dene". Altında ne yapıldığı yazıyor (hangi PDF gidiyor, büyük dosyada yüzde kaç, kaç proje bitti). Menüdeki eşitleme satırı da durumu gösteriyor.
- **Biçimli notlar:** Kart notlarında seçili yazıya kalın, italik, altı çizili, yazı rengi ve yazı tipi. Not düzenlenirken üst çubuğun altında biçim çubuğu çıkıyor (Ctrl+B, Ctrl+I, Ctrl+U de çalışır). Hiçbir şey seçili değilken basılan biçim, sonra yazılan harflere uygulanıyor. Formüllü notlarda da biçim korunuyor. Notlu PDF'te ve Markdown'da biçim görünüyor (Markdown'da kalın, italik, altı çizili). Not verisinde düz metin (`note`) aynen duruyor, biçim ayrı bir alanda (`rich`); eski sürümler notu düz metin olarak görür.
- **Geniş renk paleti:** Kart rengi ve kağıt rengi için tek düğme, tıklayınca hazır renkler, son kullanılanlar ve istediğin herhangi bir renk (renk seçici ya da #kod). Masa kağıdında "+" ile başka renk. Kart menüsünde "Görünüm": Kopyala, Yapıştır, Karttan al (dokunduğun kartın rengi, kağıdı, çerçevesi, yazı tipi ve yazı boyutu bu karta geçer).
- **Kalem:** Kalemle ve parmakla çizilen çizgiler titremeden pürüzsüz çıkıyor (One Euro filtresi; yavaşken sakin, hızlıyken gecikmesiz), basınçlı çizginin kenarları eğri. Kalemin gideceği yer tahmin edilip çizgi önden çiziliyor, gecikme daha az hissediliyor. Eski çizimler de daha yumuşak görünüyor, veriler değişmedi.
- **.ednote dosyası:** Dosyanın başında artık kendi imzası var ("EDNOTE/1"), WhatsApp gibi uygulamalar onu zip sanıp adına .zip eklemiyor. Eski dosyalar ve adı .zip'e çevrilmiş dosyalar açılmaya devam ediyor; eski ED Note sürümleri de yeni dosyaları açabiliyor.
- **Android:** .ednote dosyasına ya da PDF'e dokununca "ED Note ile aç" çıkıyor; WhatsApp ve diğer uygulamalardan "Paylaş > ED Note" ile de gönderilebiliyor (`EdIncomingPlugin.java`, manifestte intent filtreleri).
- Yeni test dosyası `tests/fixtures/v6.9.4.ednote` (biçimli not, serbest kart rengi, serbest kağıt rengi).

## Sürüm 6.9.5: kişiselleştirme (kütüphane ve uygulama görünümü)

- **Klasörler:** Siyah hat kaldırıldı; klasör artık dolu, yumuşak gölgeli. İçindeki ilk projenin kapağı klasörden hafifçe görünüyor (kapatılabilir). Klasörün ⋯ menüsünde (ya da sağ tıkla) **Görünüm**: renk (renk verilmezse vurgu rengine uyar), çıkartma (5 grupta hazır emojiler, kendi emojin ya da kendi görselin, şeffaf PNG de olur), yerleşim (köşede, ortada, klasörün yerine). Görsel ya da çıkartma "klasörün yerine" seçilince klasör simgesi yerine o görünür, köşesinde küçük bir klasör işareti kalır.
- **Projeler:** ⋯ menüsünde Yıldızla, En üste sabitle, Renk etiketi, Kapak seç (herhangi bir sayfa, birden çok belgede belge seçimi, ya da kendi fotoğrafın). Kartta renkli kurdele, yıldız, sabitleme işareti ve okuma çubuğu (en ileri okunan sayfaya göre; "%35", "bitti"). Sol menüde **Yıldızlı** bölümü. Sabitlenenler her sıralamada en üstte.
- **Uygulamanın görünümü:** Sol alttaki **Görünüm** düğmesi (editörde ⋯ > Görünüm ayarları): vurgu rengi (10 hazır renk ya da istediğin renk; koyu temada otomatik açılır), tema (Sistem, Koyu, Sepya), arayüz yazı tipi (40 yazı tipinden biri), yoğunluk (Ferah, Sıkı).
- **Eşitleme:** Boş klasörler, klasör görünümleri, vurgu rengi ve arayüz yazı tipi OneDrive'daki `library.json` ile cihazlar arasında eşitleniyor (her kayıtta zaman damgası, yenisi kazanır; silinen klasör diğer cihazda da siliniyor). Yıldız, sabitleme, etiket, kapak ve okuma ilerlemesi projenin içinde olduğu için proje ile birlikte eşitleniyor. Yoğunluk ve tema her cihazda ayrı.
- Eski sürümler bu yeni alanları yok sayar. Yeni test dosyası `tests/fixtures/v6.9.5.ednote`; OneDrive testine kütüphane eşitlemesi eklendi.

## Sürüm 6.9.6: masayı kişiselleştirme

- **Masa yüzeyi:** Kağıdın dışındaki masa için Düz, Ahşap, Mantar pano, Karatahta, Keten, Keçe (görsel dosya yok, gürültüden çiziliyor; masa kaydırılınca birlikte kayar). Kağıda istenirse lif dokusu. Masa sayfası penceresinde (masa sekmesinin ⋯ menüsü > Masa sayfası). Masa başına ayrı.
- **Grup kutuları:** Başlıktaki palet düğmesiyle renk (çerçeve ve başlık bandı) ve kağıt. Notlu PDF'te de.
- **Kayıtlı kart stilleri:** Kart stil penceresinin en üstünde Tanım, Soru, Önemli, Formül, Fikir hazır stilleri; tek dokunuşla renk, kağıt, çerçeve, yazı tipi ve yazı boyutu birlikte uygulanır. "+ Bu görünümü kaydet" ile kendi stilin; "Düzenle" ile ad değiştirme ve silme. Stiller OneDrive ile diğer cihazlara gelir.
- **Çıkartmalar:** Masanın alt çubuğunda çıkartma düğmesi (hazır emojiler, kendi emojin ya da görselin). Sürükleyip bir kartın üstüne bırakınca karta yapışır, kart taşınınca onunla gider; karttan dışarı sürükleyince masaya döner. Seçince küçült, büyüt, döndür, sil. Kart stil penceresinde "Karta çıkartma ekle". Geri al ile geri alınır, notlu PDF'te renkli görünür. Eski sürümler çıkartmaları göstermez.
- **Bağlantı çizgisi biçimi:** Bağlantı araç çubuğunda eğri, düz ve köşeli; son seçim yeni bağlantılarda kullanılır. Notlu PDF'te de.
- Yeni test dosyası `tests/fixtures/v6.9.6.ednote`; OneDrive testinde kart stillerinin eşitlenmesi de denetleniyor.

## Sürüm 6.9.7: kalemler

- **Kalem kutusu:** Kalem ya da fosforlu kalem seçiliyken araç çubuğunun solunda kayıtlı kalemlerin; her biri çizdiği çizginin küçük bir örneğiyle görünür. Tek dokunuşla tür, uç, renk ve kalınlık birlikte seçilir. Hazır gelenler: Siyah, Mavi tükenmez, Kırmızı, Kurşun kalem, Kaligrafi, Sarı ve Yeşil fosforlu. "+" ile o an kullandığın kalemi kutuya eklersin (en çok 8); "Düzenle" ile ad değiştirir ya da çıkarırsın. Kutu OneDrive ile diğer cihazlara gelir.
- **Serbest renkler:** Kalem, fosforlu kalem ve metin kutusunda hazır renklerin yanında "+" ile istediğin renk (hazır renkler, son kullanılanlar, renk seçici ya da #kod). Notlu PDF'te de aynı renk.
- **Uçlar:** Kalem için Mürekkep, Kurşun kalem (grenli grafit dokusu) ve Kaligrafi (45° tutulmuş yassı uç: bir yönde ince, karşı yönde kalın). Notlu PDF'te kaligrafi dolu şekil olarak, kurşun kalem gri çizgi olarak çıkar.
- Eski sürümler serbest renkli çizgileri siyah (fosforluyu sarı), uçları mürekkep olarak gösterir; çizgiler kaybolmaz.
- Yeni test dosyası `tests/fixtures/v6.9.7.ednote`; OneDrive testinde kalem kutusunun eşitlenmesi de denetleniyor.

## Sürüm 6.9.8: her ekranda tek görünüm, ince çubuklar, çizimleri seçip taşıma

- **Tek ekran:** Telefonda da tablette de belge ve masa artık hep birlikte görünür (Belge / Masa sekmeleri kalktı). Dik tutulan ekranda belge üstte, masa altta; yatayda yan yana. Aradaki çubukla boyut ayarlanır, kenara kadar sürükleyince o taraf gizlenir. ⋯ menüsünde "Bölme yönü": otomatik, yan yana, üst üste. 700 pikselden dar belge alanında aynı anda tek belge gösterilir.
- **İnce çubuklar:** Dokunmatik ekranlarda ve küçük pencerelerde üst çubuk tek satır ve 46 piksel; belge başlığı satırı da inceldi. Kalem ve fosforlu seçenekleri artık içeriği aşağı itmiyor, üstünde yüzüyor. Telefonda belge adı, ileri al ve arama gizlenir.
- **Tam ekran:** ⋯ > "Tam ekran (çubukları gizle)". Üst çubuk kaybolur; araçlar ile geri al, ileri al ve çıkış düğmesi solda yüzen bir şeritte kalır. Tarayıcı izin verirse ekran da tam ekrana geçer.
- **Çizimleri seçme:** Kement aracıyla kalem ya da fosforlu çizimlerinin etrafını çiz; seçilirler (PDF'te ve masada). Çerçevenin içinden sürükleyerek taşı, köşelerden büyüt ya da küçült (çizgi kalınlığı da orantılı değişir). Üstteki çubukta renk değiştir, çoğalt, sil, bitti; PDF'te "bölgeyi görsel olarak masaya ekle". Delete ile silinir, Esc ile seçim kalkar, geri al çalışır. Kementin içinde çizim yoksa eskisi gibi bölge görsel olarak masaya eklenir.

## Sürüm 6.9.9: şekil tanıma, yakınlaştırma düzeltmesi, genel bakış

- **Yakınlaştırma:** PDF'de iki parmakla, Ctrl + tekerlekle ya da düğmelerle yakınlaştırırken parmakların (ya da imlecin) altındaki nokta artık yerinde kalır. Önceden sayfa araları ve kenar boşlukları hesaba katılmadığı için görüntü kayıyordu. Düğmeler ve klavye görünümün ortasını sabit tutar.
- **Şekil tanıma:** Kalemle ya da fosforlu kalemle çiz, kalemi kaldırmadan bir an (yarım saniye kadar) beklet: çizgi, ok, daire, elips, üçgen, kare, dikdörtgen, dörtgen, beşgen ya da altıgen düzgün hale gelir. Beklemezsen hiçbir şey değişmez, bu yüzden "O" harfi daire olmaz. Kalem seçeneklerindeki **Şekil** düğmesiyle kapatılabilir. PDF'de ve masada çalışır.
- **Yoğunluk şeridi:** Her PDF'nin sağ kenarında hangi sayfalarda alıntı, yorum, vurgu ya da çizim olduğunu gösteren işaretler. Çizginin kalınlığı o sayfadaki iş miktarını gösterir. Üstüne gelince ayrıntı, dokununca o sayfaya gider.
- **Mini harita:** Masa araç çubuğundaki yeni düğme. Köşede tüm kartları ve şu an görünen alanı gösterir; dokunup sürükleyerek masada gezinilir.
- **Okuma panosu:** Kitaplıkta yeni **Okuma** sayfası. Bugün ve bu hafta okunan sayfa ve süre, üst üste okunan gün sayısı, son 6 ayın gün gün renkli takvimi ve projelerdeki ilerleme. Her cihaz kendi kaydını tutar, OneDrive bağlıysa hepsi birleşir.
