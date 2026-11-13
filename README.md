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
