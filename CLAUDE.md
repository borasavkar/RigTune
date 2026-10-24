# Adrenalin Ayar Rehberi

RX 9070 XT için oyun bazlı AMD Adrenalin ayar önerileri veren, tek dosyalık bir HTML uygulaması. Kullanıcı bir oyun ve monitör ayarı seçer; uygulama Adrenalin'deki oyun profilinde hangi ayarın açılıp kapanacağını gerekçesiyle gösterir.

- Başlangıç: 14 Ekim 2026, claude.ai sohbeti. Konuşma geçmişi: `docs/sohbet-gecmisi.md`
- Yayındaki sürüm: https://claude.ai/artifact/9TzEFResiNzrbn3sQFyi5T (özel, sürüm 2, 16 Ekim 2026)
- GitHub deposu: https://github.com/borasavkar/RigTune (**herkese açık**, `main` dalı; 22 Ekim 2026'da gizli açıldı, aynı gün Bora'nın isteğiyle herkese açıldı). Depo kökü bu klasör; `node_modules/` ve `dist/` yüklenmez. Bu dosya ve `docs/` da herkese açık: kişisel veri, iş bilgisi, parola ya da kişisel oyun klasörü yolu yazılmaz. Lisans dosyası yok (`package.json`'da `UNLICENSED`); kod görülebilir ama kullanım izni verilmiş değildir.

## Kullanıcı ve çalışma kuralları

- Kullanıcı: Bora. Arayüz ve açıklamalar Türkçe olacak; anlatım bozukluğu olmayan, sade bir Türkçe kullanılacak.
- Cevaplar kısa, net ve tarafsız olacak. Kullanıcı hatalıysa veya daha iyi bir yol varsa bu açıkça söylenecek.
- Kod hatasız olacak ve mevcut koddan devam edilecek; sıfırdan yeniden yazılmayacak.

## Sistem

- İşlemci: Ryzen 5 9600X. Anakart: MSI X670E. Güç kaynağı: Enermax Revolution III 1000W.
- Ekran kartı: Gigabyte RX 9070 XT Gaming OC, 16 GB (RDNA 4). Kullanıcının ilk AMD kartı.
- İşletim sistemi: Windows 11. Bilgisayar adı: `9600x`.
- Ana monitör (17 Ekim 2026'da EDID'den okundu): AOC CU34G2XP, 34", 3440×1440, DisplayPort, en fazla 180 Hz, FreeSync 2.1 aralığı 48–180 Hz, HDR10 (tepe yaklaşık 418 nit, HDR400 sınıfı), 10 bit. Windows'ta 144 Hz'de çalışıyordu ve HDR açıktı.
- İkinci monitör: ASUS VW193D, 1440×900, 60 Hz, DVI.
- Bellek: 2 × 16 GB DDR5, 6000 MT/s (EXPO açık).
- Diskler (22 Ekim 2026'da uygulamayla okundu): C: NVMe SSD (sistem), D: SATA SSD, G: NVMe SSD, E: ve F: HDD. O gün yüklü oyunların hepsi SSD'lerdeydi.
- AMD Software 26.10.1 (22 Ekim 2026'da güncellendi; önceki 26.8.1). Sürücü 32.0.32015.7029, sürücü tarihi 2026-10-18, iç sürüm 26.20.15.07.
- Tek dosyalık sayfa (index.html) başlangıçta örnek olarak 1440p / 165 Hz / FreeSync açık gösterir; masaüstü uygulaması monitörü kendisi okur.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html` | Tarayıcıda doğrudan açılabilen bağımsız sürüm (doctype ve head eklenmiş). Yerel geliştirme bu dosyada yapılır. |
| `adrenalin-ayar.artifact.html` | claude.ai'ye yayınlanan dosyanın birebir kopyası. Bu biçimde `<html>`, `<head>` ve `<body>` etiketi yoktur; yayın sırasında platform ekler. |
| `docs/sohbet-gecmisi.md` | claude.ai'deki konuşmanın özeti ve kararlar. |

İki HTML dosyasının gövdesi aynıdır. `index.html`'de yapılan değişiklik claude.ai'deki sürüme aktarılacaksa, değişiklik `adrenalin-ayar.artifact.html`'ye de uygulanmalı ve o dosya yeniden yayınlanmalı. Head kısmına ek olarak `body{margin:0}` ve `[hidden]{display:none!important}` kuralları kondu; claude.ai bunları kendisi ekliyor, yerelde ise gerekli. Gerekli olmalarının sebebi: `.row2` sınıfının `display:flex` kuralı `hidden` özniteliğini ezer.

## Kod yapısı

Bütün kod tek bir `<script>` bloğunda, kütüphane kullanılmıyor.

### Oyun verisi (`G` dizisi)

Her oyun bir nesne:

| Alan | Anlamı |
|---|---|
| `n` | Oyunun adı. Benzersiz olmalı; liste seçimi ada göre yapılır. |
| `t` | Tür: `rek` rekabetçi online, `koop` online ko-op, `aks` tek oyunculu aksiyon/RPG, `yar` yarış/spor/simülasyon, `haf` hafif/strateji |
| `y` | 1440p yüksek ayarda GPU yükü: 1 hafif, 2 orta, 3 ağır, 4 çok ağır/ışın izleme |
| `f` | FSR desteği: `fsr4`, `fsr31` (Adrenalin FSR 4'e yükseltebilir), `fsr31n` (FSR 3.1 ama AMD'nin FSR 4 listesinde değil), `fsr3`, `fsr2`, `fsr1`, `yok` |
| `fg` | Oyun içi FSR kare üretimi var (1) |
| `al` | Anti-Lag 2 destekli (1) |
| `c60` | Motor 60 FPS ile kilitli (1) |
| `ac` | Anti-cheat adı |
| `no` | Oyuna özel not (Türkçe) |
| `s` | Steam'de yüklüyse disk harfi (`"C:"` gibi) |
| `sx` | Steam'de kayıtlı ama diske erişilemiyor (1) |
| `lp` | Steam'de son oynama zamanı (Unix saniyesi); Steam grubunu sıralar |

Kullanıcının elle eklediği veya Claude'a sorarak eklediği oyunlar `localStorage`'da `ek` anahtarıyla tutulur (`src: "elle"` ya da `src: "claude"`).

### Öneri motoru (`rec(g)`)

- `lvl(g)`: Çözünürlüğe göre yükü kaydırır (1080p −1, UW +0,5, 4K +1) ve 0–3 arası bir seviye üretir.
- `need`: Seviye 2 veya üstüyse, ya da 4K'da seviye 1 olup oyun rekabetçi değilse ölçekleyici gerekir.
- Ölçekleme sırası: FSR 4 yerleşik → FSR 3.1 + Adrenalin FSR 4 yükseltmesi → eski FSR (Kalite modu) → modern ölçekleyici yoksa RSR. Rekabetçi oyunlarda native.
- AFMF şu durumda açık önerilir: rekabetçi değil, oyunun kendi kare üretimi yok, temel FPS 60 üstü ve monitör 120 Hz veya üstü. Oyun 60 FPS'e kilitliyse her durumda açık önerilir.
- FPS sınırı: yenileme hızı − 3. AFMF açıkken (yenileme hızı − 3) / 2, bu sınır Radeon Chill'de min = max olarak girilir. Rekabetçi oyunlarda sınır yok.
- Radeon Image Sharpening, FSR açıkken kapalı önerilir (FSR'nin kendi keskinleştirmesiyle üst üste biner).
- Genel ayarlar (`GL` dizisi): FreeSync, SAM, HYPR-RX kapalı, sürücü seviyesinde AA kapalı, sürücü 26.9.2 veya üstü.

### Claude'a sor

claude.ai'deki sürüm `sample` yeteneğini kullanır: `await window.claude.use("sample")` çağrılır, oyun özellikleri `sample.json()` ile JSON olarak istenir ve sonuç 24 saat önbellekte tutulur. Yerelde `window.claude` olmadığı için bu bölüm kendini gizler, yerine elle giriş formu açılır.

### Tasarım

- Renkler `:root` üzerinde token olarak tanımlı. Koyu tema iki blokta: `prefers-color-scheme` ve `[data-theme="dark"]`.
- Yazı tipleri: Barlow Condensed (başlık), IBM Plex Sans (metin), IBM Plex Mono (değerler).
- Durum etiketleri: `on` yeşil, `off` gri, `set` mavi, `warn` turuncu. Vurgu rengi Radeon kırmızısı.

## Steam kütüphanesi (16 Ekim 2026'da okundu)

Kütüphane klasörleri (`C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf`):

- `C:\Program Files (x86)\Steam`
- `D:\SteamLibrary`
- `G:\SteamLibrary` (boş)
- `H:\SteamLibrary` (o gün erişilemedi; sürücü takılı değil gibi görünüyordu)

Yüklü oyunlar (`appmanifest_*.acf` dosyalarından):

| AppID | Oyun | Disk | Son oynama |
|---|---|---|---|
| 292030 | The Witcher 3: Wild Hunt — Remastered | C: | 2026-10-15 |
| 1174180 | Red Dead Redemption 2 | C: | 2026-10-09 |
| 3472040 | NBA 2K26 | C: | 2026-09-25 |
| 933110 | Age of Empires III: Definitive Edition | D: | 2026-09-12 |
| 1297900 | Gothic 1 Remake | C: | 2026-08-21 |
| 261550 | Mount & Blade II: Bannerlord | C: | 2026-01-07 |
| 3041230 | Windrose | H: | bilinmiyor |

Manifest dosyası olmayan oyun klasörleri de var; bunlar büyük ihtimalle kaldırılmış oyunlardan kalanlar: `C:\...\steamapps\common` altında ENDLESS Legend 2, Sid Meier's Civilization V ve Windrose; `G:\SteamLibrary\steamapps\common` altında LoveCraft.

Steam dışı oyun klasörleri (henüz eklenmedi): `G:\Ubisoft`, `G:\XboxGames`, `G:\The Great Circle`.

## Araştırma bulguları ve kaynaklar

- **Witcher 3 Remastered (29 Eylül 2026):** FSR 4, FSR kare üretimi, Anti-Lag 2 ve path tracing var. https://witcher3remastered.com/guides/pc-settings/ · https://www.driverscloud.com/en/news/2959/the-witcher-3-gets-an-xxl-remaster-path-tracing-dlss-45-and-fsr-4-on-the-menu
- **Gothic 1 Remake:** Unreal Engine 5. AMD'nin listesinde FSR 3 olarak görünüyor; kullanıcılar FSR 3.1.4 olduğunu bildiriyor. Kullanıcılar FSR 4'ü OptiScaler ile ekliyor, bu da Adrenalin'in FSR 4 yükseltmesinin bu oyunda çalışmadığını düşündürüyor. Haziran yamasından sonra kare üretiminde sorun bildirildi. https://steamcommunity.com/app/1297900/discussions/2/564785190210398668/
- **NBA 2K26:** AMD listesinde FSR 3; hafif bir oyun.
- **AoE III DE:** FSR 1.
- **Bannerlord:** FSR yok, DirectX 11, işlemci sınırlı. https://checkfps.io/en/optimize-fps/mount-and-blade-ii-bannerlord
- **Windrose:** AMD listesinde FSR 4 (Redstone), FSR 3 ve kare üretimi var.
- AMD'nin oyun listesi: https://www.amd.com/en/products/graphics/technologies/fidelityfx/supported-games.html
- **Sürücüler:** 26.8.1'de RX 9070 XT'de Apex Legends çöküyordu, 26.9.1'de düzeltildi; 26.9.1 Starfield çökmelerini de düzeltti. 26.9.2 (isteğe bağlı WHQL) Witcher 3 Remastered desteğini getirdi.
- **İsim değişikliği:** Anti-Lag 2'nin adı "FSR Latency Reduction 2" oluyor.

Not: Oyunların özellik tabloları kural tabanlı tahmindir, ölçüm değildir. Yeni oyunların FSR bilgisi oyun güncellemeleriyle değişebilir.

## Masaüstü uygulaması: RigTune (`desktop/`)

17 Ekim 2026'da "Oyun Ayar Rehberi" adıyla başlandı; 22 Ekim 2026'da Bora'nın seçimiyle adı **RigTune** oldu (iki dilde de aynı ad). Tek dosyalık sayfanın öneri motoru ve oyun listesi buraya taşındı ve genişletildi. Ayrıntılı kullanım: `desktop/README.md`.

- **Ad değişikliği (0.1.4):** `name` rigtune, `productName` RigTune, `appId` tr.savkar.rigtune, paket dosyaları `RigTune-Kurulum-<sürüm>.exe` ve `RigTune-Tasinabilir-<sürüm>.exe`. Eski addaki veri klasörü ilk açılışta (ya da komut satırında) yeni klasöre bir kez kopyalanır (`migrateDataDir`, `core/util.js`); uygulama eski klasörü silmez. Bora'nın bilgisayarında eski `OyunAyarRehberi-*` paketleri ve eski veri klasörü 22 Ekim 2026'da Geri Dönüşüm Kutusu'na taşındı.

- **Taşınabilir sürüm ve görev çubuğu (0.1.5):** Taşınabilir exe her açılışta kendini `%TEMP%` içinde rastgele adlı bir klasöre açar ve kapanınca siler. Görev çubuğuna sabitlenen kısayol bu geçici yolu gösterdiği için beyaz kağıt simgesine dönüyordu. `main.js` artık `PORTABLE_EXECUTABLE_FILE` varsa `win.setAppDetails` ile sabitleme ve simgeyi, "Windows açılışında başlat" kaydını da taşınabilir exe'nin kendisine yönlendirir. Kalıcı kullanım için kurulum sürümü (`RigTune-Kurulum-*.exe`) daha uygundur: Başlat menüsü kısayolu oluşturur ve yeni sürümde yol değişmez.
- **Başlat menüsü kısayolu (0.1.10, 24 Ekim 2026):** 0.1.5 düzeltmesi yetmedi; sabitlenen simge yine açılmıyordu. Neden: Electron bildirim gösterebilmek için Başlat menüsüne `RigTune.lnk` yazar (uygulama kimliği `tr.savkar.rigtune`, bildirim CLSID'si, hedef çalışan exe) ve `HKCUSoftwareClassesCLSID{…}LocalServer32` ("Electron Notification Activator") kaydı açar; taşınabilir sürümde ikisi de silinen Temp kopyasını gösterir. Windows görev çubuğu aynı kimlikte bir Başlat menüsü kısayolu varsa pencerenin `setAppDetails` ayarlarını değil o kısayolu kullanır. `main.js` > `fixPortableShortcut` açılışta ve her bildirimden sonra kısayolun hedefini taşınabilir exe'ye çevirir (`shell.writeShortcutLink` `update`; kimlik ve CLSID korunur). CLSID kaydı Temp'i göstermeye devam eder (uygulama kapalıyken eski bir bildirime tıklamak bir şey açmaz). Eski addan kalan `Oyun Ayar Rehberi.lnk` ve CLSID kaydı aynı gün temizlendi. Sabitlenen kısayol dosya adını (sürüm numarasıyla) gösterir; yeni sürüme geçip eskisini silince yeniden sabitlemek gerekir.
- **Ne yapar:** Ekran kartını, monitörü (EDID), sürücü uygulamalarını ve Windows oyun ayarlarını okur. Steam, Epic, GOG, Ubisoft, Xbox/Microsoft Store, EA, Battle.net, Rockstar, Riot, Playnite (eklentiyle) ve klasörlerdeki oyunları bulur. Oyun klasöründeki DLL'lerden DLSS, FSR, XeSS, kare üretimi, Reflex, motor ve hile korumasını çıkarır. AMD Adrenalin, NVIDIA App ve Intel Graphics Software için oyun profili ayarlarını, oyun içi ayarları ve bir kez yapılacak genel ayarları önerir. Donanım, sürücü, yazılım, monitör ve oyun değişikliklerini algılar, yeniden analiz eder, bildirim gösterir.
- **Teknoloji:** Electron 44.4.5, kütüphane bağımlılığı yok (yalnızca electron ve electron-builder geliştirme bağımlılığı). Windows birincil; macOS (system_profiler) ve Linux (/sys/class/drm, EDID, lspci) için algılama yazıldı ama o sistemlerde denenmedi.
- **Çalıştırma:** `cd desktop` → `npm start`. Arayüzsüz analiz: `node src/cli.js` (`--oyun "ad"`, `--json`, `--hedef kalite|denge|fps`, `--dil tr|en`, `--yerel`, `--veri klasör`; İngilizce eş adlar `--game`, `--goal`, `--lang`, `--offline`, `--data`). Testler: `npm test`. Paket: `npm run dist` → `desktop/dist/`.
- **Veri:** `%APPDATA%\RigTune\` (settings, snapshot, changes, cache-probe, cache-meta, playnite-games JSON dosyaları). 0.1.3 ve öncesi `%APPDATA%\Oyun Ayar Rehberi\` kullanıyordu.
- **Arayüzü görsel kontrol:** `OAR_SHOT=<klasör>` ortam değişkeniyle açılırsa her bölümün PNG görüntüsünü alıp kapanır; `OAR_SHOT_PAGES="overview,games:Witcher,settings"` hangi sayfaların alınacağını seçer. `OAR_DEBUG=1` izleme olaylarını konsola yazar. Açık olan (paketli) uygulamaya ve gerçek verilere dokunmadan denemek için `--user-data-dir=<klasör>` ile başlat; o klasöre `settings.json` olarak `{"lang":"en"}` yazılırsa İngilizce açılır.

### Kod haritası

| Dosya | Görevi |
|---|---|
| `src/core/detect/windows-system.ps1` | GPU (kayıt defteri, VRAM, AMD paket sürümü), işlemci (L3 dahil), bellek modülleri, diskler (CIM `MSFT_Disk`, `MSFT_PhysicalDisk`, `MSFT_Partition`, `MSFT_Volume`), monitörler (DisplayConfig + GDI kipleri + EDID + HDR), kaldırma kayıtları, Windows oyun ayarları |
| `src/core/detect/windows-libs.ps1` | Steam yolu, GOG/Ubisoft/EA kayıtları, sürücüler ve .GamingRoot, Xbox paketleri |
| `src/core/detect/edid.js` | EDID çözücü (CTA-861, DisplayID; FreeSync/HDMI VRR/Adaptive-Sync, HDR parlaklığı) |
| `src/core/detect/amd-settings.js` | Adrenalin'in kayıtlı ayarlarını okur (oyun profilleri, genel ayarlar); bkz. "Adrenalin ayarlarını okuma" |
| `src/core/detect/index.js` | Platform algılama (Windows/macOS/Linux), ortak biçim, oyun kartı/monitör seçimi |
| `src/core/gpudb.js` | Model → mimari, yaklaşık güç sınıfı (RX 9070 XT = 100), özellikler |
| `src/core/cpudb.js` | İşlemci modeli → mimari, mimarinin ilk çıktığı yıl, 3D V-Cache (X3D), kısa ad. Puan yok (bkz. "İşlemci, bellek ve disk analizi") |
| `src/core/libraries/*` | Başlatıcı tarayıcıları, VDF çözücü, klasör ve Playnite tarayıcısı |
| `src/core/probe.js` | Oyun klasörü incelemesi ve PE dosya sürümü okuma; oyunun exe dosyaları (`exes`) |
| `src/core/gamecfg.js` | Oyunların kendi ayar dosyalarını okur (Witcher 3, RDR2, Unreal Engine); bkz. "Oyun ayar dosyalarını okuma" |
| `src/core/procs.js` | Kütüphanedeki hangi oyunların açık olduğu (tasklist + yeni süreçlerin yolu) |
| `src/core/gamedb.js` | Oyun veritabanı (eski `G` dizisi + yeni alanlar). `no` genel not, `noAmd` yalnızca AMD'de gösterilen not, `en: { no, noAmd, tips }` İngilizce karşılıkları, `ow` açık dünya, `cpu` işlemciye bağlı (1) ya da değil (0) |
| `src/core/engine/common.js` | Profil birleştirme, yük seviyesi, ölçekleme ihtiyacı, kare üretimi ve FPS sınırı planı |
| `src/core/engine/amd.js` | Eski `rec()` fonksiyonunun taşınmış hâli |
| `src/core/engine/nvidia.js`, `intel.js` | NVIDIA App ve Intel Graphics Software kuralları |
| `src/core/engine/ingame.js`, `system.js` | Oyun içi ayarlar; genel ayarlar ve sistem kontrolleri |
| `src/core/engine/hardware.js` | İşlemci, bellek ve disk: oyun notları, disk etiketi, disk kontrolleri, oyun klasörü → birim eşlemesi (`volumeOf`) |
| `src/core/changes.js` | Parmak izi ve değişiklik farkı |
| `src/core/steamstore.js` | Veritabanında olmayan oyunlar için Steam mağaza bilgisi: tür, yük, en düşük ve önerilen bellek, SSD şartı (`parseReq`). Ayarlardan kapatılabilir |
| `src/main/main.js` | Pencere (Windows 11'de akrilik), tepsi, izleme (aralıklı, monitör, uyku), bildirim, `oar://` protokolü |
| `src/renderer/*` | Cam arayüz: Özet, Oyunlar, Genel, Geçmiş, Ayarlar |
| `src/locales/tr.js`, `en.js`, `index.js` | Bütün metinler (motor, sistem kontrolleri, değişiklik geçmişi, tepsi/bildirim, komut satırı, arayüz) ve çevirmen `translator(dil)` |
| `integrations/playnite/` | Playnite dışa aktarma eklentisi (PowerShell betik eklentisi): `extension.yaml` + `OyunAyarRehberi.psm1` |

### Playnite entegrasyonu (17 Ekim 2026)

- Playnite 10.62 açıkken `%APPDATA%\Playnite\library\games.db` dosyasını tamamen kilitler (paylaşımlı okuma da reddedilir, EBUSY). Otomatik yedekleri kütüphaneyi içermez.
- Bu yüzden Bora'nın onayıyla `integrations/playnite/` eklentisi `%APPDATA%\Playnite\Extensions\OyunAyarRehberi_Export\` klasörüne kuruldu. Playnite açılınca, kapanınca, kütüphane güncellenince ve oyun kurulup kaldırılınca yüklü oyunları JSON olarak yazar; Eklentiler menüsünde "Oyun listesini şimdi aktar" seçeneği vardır. Playnite'ta hiçbir şeyi değiştirmez.
- 1.0 sürümü listeyi eski klasöre (`%APPDATA%\Oyun Ayar Rehberi\playnite-games.json`) yazıyordu. 1.1 sürümü `%APPDATA%\RigTune\playnite-games.json` dosyasına yazar; Id, klasör ve `.psm1` adı eski kurulumun üzerine kopyalanabilsin diye değişmedi. 22 Ekim 2026'da Bora'nın isteğiyle 1.1 kuruldu (Playnite kapalıyken kopyalandı, BOM korundu); eski veri klasörü de aynı gün Geri Dönüşüm Kutusu'na taşındı.
- `libraries/playnite.js` iki klasördeki dosyadan daha yeni olanı okur; dosya yoksa Playnite kapalıyken `games.db` içindeki BSON belgelerini arar (deneysel yedek yol).
- `.psm1` dosyası BOM'lu UTF-8 olmalı (Windows PowerShell 5.1 BOM'suz dosyayı ANSI okur, Türkçe karakterler bozulur). Kaynağı değiştirince eklenti klasörüne yeniden kopyala ve Playnite'ı yeniden başlat.
- Playnite, PowerShell eklenti desteğini 11. sürümde kaldıracağını duyurdu; o sürümde eklentinin .NET'e taşınması gerekir.
- Aynı gün düzeltilen hata: kütüphane tarayıcıları kaldırma kayıtlarını `sys.uninstall` alanından okuyordu, oysa `detect/index.js` listeyi `_uninstall` alanında veriyor. Bu yüzden EA, Battle.net, Rockstar ve Riot oyunları uygulamada hiç bulunmuyordu.

### Dil desteği (17 Ekim 2026)

- Ayarlar > Dil: Sistem / Türkçe / English. Varsayılan "Sistem": işletim sisteminin görüntü dili Türkçeyse Türkçe, değilse İngilizce. Ayar `settings.json` içinde `lang` (`system` | `tr` | `en`). Dil değişince öneriler, tepsi menüsü ve geçmiş yeniden kurulur; yeniden tarama gerekmez.
- Metinler `src/locales/tr.js` ve `en.js` içinde. İki dosyanın anahtar yapısı ve `{yer tutucu}` adları aynı olmalı; `npm test` bunu, oyun notlarının İngilizcesinin eksiksiz olduğunu ve İngilizce çıktıda Türkçe metin kalmadığını denetler. Yeni metin eklerken iki dosyaya da yaz.
- Motor metni dil dosyasından üretir: `context()` dili alır, `c.t('anahtar', { parametre })` kullanılır. Öneri satırlarında `id` dilden bağımsızdır; gruplar `id` ile eşleşir, ipucu satırları `tip: true` taşır. Karar mantığı metne bakmaz (test, iki dilde kararların aynı olduğunu da denetler).
- **AMD oyun profili ayarları, Adrenalin'in o dildeki arayüzünde göründüğü gibi yazılır** (Bora'nın isteği, 17 Ekim 2026). Adlar ve Etkin/Devre dışı değerleri `locales/*.js` içinde `amd.k` ve `amd.v`; Türkçe görünümde her satırın yanında Adrenalin'in İngilizce adı da küçük harfle gösterilir (`alt` alanı). Türkçe adlar Bora'nın Adrenalin ekran görüntüsünden (oyun profili > Ekran Kartları) alındı: AMD FSR Yükseltme, AMD FSR Kare Üretimi, Radeon Gecikme Önleme, Radeon Geliştirilmiş Senkronizasyon, Dikey Yenileme İçin Bekle ("Uygulama belirtmediyse kapalı"), Radeon Image Sharpening 2 (Netlik %), AMD Fluid Motion Frames 2.1, Radeon Super Resolution, Radeon Boost, Radeon Chill.
- 22 Ekim 2026'da Adrenalin 26.10.1'in Türkçe arayüzünden doğrulananlar (Oyun > Ekran Kartları ve oyun profilinin "Gelişmiş" bölümü): Kare Hızı Hedef Kontrolü + Maks FPS (Frame Rate Target Control), Global Oyun Deneyimi (HYPR-RX / HYPR-RX Eco / Varsayılan / Özel; oyun sayfasında "Oyun Deneyimi": Global Deneyim / Özel), Örtüşme Önleme ("Uygulama ayarlarını kullan"), Örtüşme Önleme Yöntemi, Morfolojik Örtüşme Önleme, Yönbağımlı Filtreleme, Doku Filtreleme Kalitesi (Yüksek / Standart / Performans), Yüzey Biçim Optimizasyonu, Mozaik Döşeme Modu ("AMD için en iyileştirilmiş"), OpenGL Üçlü Arabelleğe Alma, 10-Bit Piksel Biçimi, Shader Cache'yi Sıfırla, FSR OTA Kontrol ("En Son Üretimi Kullan"), Masaüstünü Netleştir, Video Yükseltme özelliği. Dikey Yenileme İçin Bekle seçenekleri: Her zaman kapalı (Önerilmez) / Uygulama belirtmediyse kapalı / Uygulama belirtmediyse açık / Her zaman açık.
- **Henüz doğrulanmayanlar:** Smart Access Memory'nin ve genel FreeSync anahtarının Türkçe yeri; İngilizce Adrenalin'deki "FSR OTA Control" seçeneklerinin adları (İngilizce görünümde değer "On" olarak kaldı). Tahminle değiştirilmez.
- NVIDIA App ve Intel Graphics Software ayar adları ("DLSS Override – Model Presets" vb.) İngilizce özgün adlarıyla kalır.
- Değişiklik geçmişi (`changes.json`) anahtar + değer olarak saklanır ve gösterilirken seçili dile çevrilir; kayıt anındaki dilde `text` de yazılır ki eski sürüm okuyabilsin. Tarama nedeni de anahtardır (`manual`, `startup`, `periodic`…); eski Türkçe kayıtlar olduğu gibi gösterilir, nedenleri ve "İlk analiz yapıldı." çevrilir.
- Algılamadan gelen etiketler dilden bağımsız tutulur (bağlantı türü `internal`, `wireless`; Intel dahili birimlerde "(dahili)" eki) ve arayüze giderken çevrilir.
- Uygulamanın adı iki dilde de "RigTune" (`app.name`). 0.1.3'e kadar Türkçe "Oyun Ayar Rehberi", İngilizce "Game Settings Guide" idi.

### Adrenalin ayarlarını okuma (22 Ekim 2026)

Bora'nın isteği: uygulama Adrenalin'deki mevcut ayarları okusun, değiştirilmesi gerekenleri belirgin göstersin. Yalnızca okunur; Adrenalin'de hiçbir şey değiştirilmez. Anlamlar, Adrenalin 26.10.1 arayüzü açılıp (Witcher 3, RDR2, NBA 2K26 ve genel sayfa) okunan değerlerle karşılaştırılarak doğrulandı.

- **Oyun profilleri:** `%LOCALAPPDATA%\ATI\ACE\APL\User.blb`. "BWJE" başlıklı ikili dosya; biçim `detect/amd-settings.js` içinde `parseApl` açıklamasında. Her profil bir exe + klasör (sonu `*`) ya da `steamappid:N` taşır; Adrenalin çoğu oyun için ikisini de yazar. Değerler UTF-16 `0x0300::değer;;` biçiminde. Doğrulanan anahtarlar: `Dlg_PFEnable` Gecikme Önleme, `Bst_PFEnable` Boost (desteklemeyen oyunda kayıt yok, Adrenalin'de satır da yok), `Chil_PFEnable`/`Chil_MinFRate`/`Chil_MaxFRate`, `Ris_PFEnable` + `Ris_SHDegree` (0,3 = %30), `UFG_PFEnabled` AFMF, `FsrOverride` FSR Yükseltme, `MlfiOverride` FSR Kare Üretimi, `TurboSync` Gelişmiş Senkronizasyon, `VSyncControl` (0–3, 1 = Uygulama belirtmediyse kapalı).
- **Profili olmayan oyun genel ayarları kullanır** (Adrenalin'de "Oyun Deneyimi: Global Deneyim"). Oyun sayfasında bir ayar değişince Adrenalin o oyun için profil açar.
- **Genel ayarlar:** kayıt defterinde ekran kartının sürücü anahtarı (`KMD_DeLagEnabled`, `KMD_ChillEnabled`, `KMD_RadeonBoostEnabled`, `Gmx_FRTCEnabled`, `Gmx_FRTCFrameRateTarget`), `UMD` alt anahtarı (`FsrOverride`, `MlfiOverride`, `TurboSync`, `VSyncControl`, `TFQ` 0 Yüksek / 1 Standart / 2 Performans, `SurfaceFormatReplacements`, `Tessellation_OPTION` 0 = AMD için en iyileştirilmiş, `AntiAlias` 1 = Uygulama ayarlarını kullan, `MLF`, `FsrOtaIndex` 1 = En Son Üretimi Kullan) ve `HKCU\Software\AMD\CN` `LastSavedExpID` (`PROFILE_CUSTOM` = Özel). Genel Radeon Image Sharpening yalnızca `%LOCALAPPDATA%\AMD\CN\GExDb.blb` (JSON) içinde: `""` anahtarı > `Custom` profili > özellik 27 (açık/kapalı) ve 28 (netlik). Oyun Deneyimi Özel değilse RIS okunmaz.
- **Genel RSR ve AFMF (22 Ekim 2026, Bora'nın izniyle Adrenalin'de bir kez açılıp kapatılarak bulundu):** RSR `Gmx_RSREnabled` içinde 2 biti (açıkken 3; kapalıyken kurulumdan gelen 1 ya da kapatıldıktan sonra 0). AFMF `UMD\DrvFrameGenEnabled` ("1" açık, "0" ya da kayıt yoksa kapalı; yanında `DrvFrameGenAlgorithm`). GExDb Özel profilde 44 = RSR, 58 = AFMF; RIS kapatılınca 27 numaralı kayıt silinir, yoksa kapalı sayılır. Ekran ayarları: GPU Ölçekleme `GPUScaling00` (ekran başına), Tamsayı Ölçekleme `DAL3_DATA\common\EDID_…\integerScaling`.
- **RSR'yi açıp kapatmanın yan etkileri (deneme sırasında görüldü):** RSR açılınca Adrenalin önce "Radeon Image Sharpening, Tamsayı Ölçekleme ve Merkezi Ölçekleme ile birlikte çalışmaz" uyarısı, sonra "Oyun Ayarlarını yapılandır" düğmeli bir bilgi penceresi gösterir (o düğmeye basılmadı). Genel RIS kendiliğinden kapanır. Kapatınca `Gmx_RSREnabled` 0 olur ve `DAL2_DATA__2_0\DisplayPath_*\Option\BestViewOption` içindeki 0x04 biti silinir; bunlar Adrenalin'den eski değerine getirilemiyor (arayüzde fark yok). Deneme sonunda RIS (%20) yeniden açıldı, GPU Ölçekleme ve Tamsayı Ölçekleme başlangıçtaki gibi kapalı bırakıldı.
- **Oyuna özel RSR ve gmdb.blb (22 Ekim 2026, Bora'nın izniyle Witcher 3 profilinde RSR bir kez açılıp kapatılarak bulundu):** `%LOCALAPPDATA%\AMD\CN\gmdb.blb` Adrenalin'in oyun listesidir (JSON, `games[]`). Alanlar: `upscaling_enabled` ("TRUE"/"FALSE", oyuna özel RSR), `upscaling_use_borderless` ("Etkin - Kenarlıksız Tam Ekran"), `upscaling_sharpness`, `framegen_enabled` (1/0, oyuna özel AFMF), `averageFPS` ve `percentile95_msec` (Danışman'ın ve oyun kartının gösterdiği ölçüm), `lastperformancereporttime`, `userprofiletype` (4 Özel, 5 Global Deneyim), `FSRUpgradeAvailable` / `MlfiAvailable` (anahtar o oyunda var), `guid` (GExDb'deki oyun kaydının anahtarı), `steam_id`, `exe_path`, `title`. Oyun sayfasındaki RSR üç seçenekli bir listedir: Devre dışı / Etkin / Etkin - Kenarlıksız Tam Ekran. RSR açılınca GExDb'deki oyun kaydında 44 = 1 olur, 1 numaralı alan (değer 2) eklenir. `Gmx_RSREnabled`'in 1. biti "en az bir oyunun profilinde RSR açık" anlamındadır (oyunda açılınca 1, kapanınca 0; ekran yollarındaki `BestViewOption` 0x04 biti de onunla gelir).
- **Okunan ve kalan:** Profilli oyunda RSR ve (User.blb'de kaydı yoksa) AFMF gmdb'den okunur; 22 Ekim 2026'da Bora'nın 17 oyununun hiçbirinde "okunamadı" kalmadı. FSR Yükseltme "Anahtar çıkarsa aç" belirsizliği gmdb `FSRUpgradeAvailable` "TRUE" ise "Etkin"e döner ("FALSE"a güvenilmez). Genel 10-Bit Piksel Biçimi, FreeSync, SAM, Masaüstünü Netleştir ve Video Yükseltme okunmuyor (bilgi satırı). GExDb'deki oyun GUID'li kayıtlar ölçüm ve ayar için kullanılmıyor.
- **Genel sayfa, Grafik Seçenekleri'nin tamamını önerir (22 Ekim 2026, Bora'nın isteği):** RSR, AFMF kapalı; FSR Yükseltme ve FSR Kare Üretimi etkin (desteklemeyen oyunda etkisiz); Gecikme Önleme etkin; Boost, Chill kapalı; RIS etkin; Gelişmiş Senkronizasyon kapalı; Dikey Yenileme "Uygulama belirtmediyse kapalı"; Yönbağımlı Filtreleme (`UMD\AnisoDegree`, 0 = kapalı) ve OpenGL Üçlü Arabellek (`UMD\EnableTripleBuffering`) kapalı. Masaüstünü Netleştir ve Video Yükseltme "İsteğe bağlı" (okunmuyor, oyunları etkilemez). Oyun sayfasında FSR Kare Üretimi, oyun kare üretimi kullanmıyorsa "Bu oyunda etkisiz" (karşılaştırılmaz).
- **Adrenalin'in ölçtüğü performans (Oyun Danışmanı'nın verisi, 22 Ekim 2026):** `%LOCALAPPDATA%\AMD\CN\GameReport\<exe>\gpa.bin` son ölçülen oturumun kare sürelerini mikrosaniye olarak, boşlukla ayrılmış tutar. Ortalama FPS = 1e6 / ortalama kare süresi (Adrenalin'in gösterdiğiyle karşılaştırıldı: King Arthur 143,5 / 144,0; AoE II 140,5 / 141,7). Kare üretimi açıkken kareler bir uzun bir kısa gelir (çift/tek sıra ortalaması oranı > 1,5; incelenen 10 oyunda kare üretimi yokken oran < 1,05). `RGStats.db` (SQLite; `InstalledGames`: ExePath, Title, SteamID; `GameSessions`) geçici kopyasından `node:sqlite` ile okunur (Electron 44'te Node 24.21, var). Eşleşme: Steam numarası, klasör, sonra ad (Xbox oyunları WindowsApps'ten çalışır), en son klasör taramasının exe'si. Ortalama FPS ve %95 için önce gmdb.blb'deki Adrenalin'in kendi değeri kullanılır; kare üretimi gpa.bin'den anlaşılır. `engine/measured.js` dört durum verir: `headroom` (FPS sınıra dayanıyor, kare üretimi yok → kaliteyi bir kademe artır), `low` (temel FPS FreeSync alt sınırının altında → düşür), `over` (yenileme hızının üstü → FPS sınırını kontrol et; ölçüm sınırdan önce yapılmış olabilir), `ok`. Oyun başlığında "Ölçülen: N FPS" etiketi ve not.
- **Klasör tarayıcısı düzeltmesi:** `findExes` her klasörde önce dosyalara sonra alt klasörlere bakar. Önceden büyük alt klasörler 4000 dosyalık bütçeyi bitirdiği için bir "Games" klasöründeki King Arthur: Legion IX bulunmuyordu.
- **RSR, Radeon Image Sharpening ile birlikte çalışmaz:** RSR önerilen oyunda RIS "Devre dışı" önerilir (test: hiçbir oyunda ikisi birlikte açık önerilmez).
- **Motor:** `engine/amd.js` her satıra `cur` (şu anki değer, Adrenalin'in sözcükleriyle), `state` (`change` | `ok` | `unknown` | `na`) ve `scope` (`game` | `global`) ekler; `driver.state` sayıları verir. Genel sayfası için aynısı `engine/system.js` içinde. Okuma başarısızsa (`c.amd` null) eski görünüm kalır.
- **Arayüz:** Adrenalin sekmesinde özet kutusu ("Adrenalin'de N ayarı değiştir" / "uygun"), sonra Değiştir (şu an → öneri), Okunamadı, Bilgi, "Yalnızca genel ayarda · Oyun > Ekran Kartları" (`globalOnly`, şimdilik yalnızca Kare Hızı Hedef Kontrolü; oyunun değişiklik sayısına girmez, `state.globalChange`) grupları; doğru olanlar katlı "Zaten doğru" listesinde. Profili olmayan oyunda Adrenalin'in oyun sayfası "Global Deneyim" modundadır ve ayarlar orada değiştirilemez (Bora bildirdi, 22 Ekim 2026); özet kutusu önce "Oyun Deneyimi"ni "Özel" yapmayı söyler. Oyun listesinde ve sekme düğmesinde değişecek ayar sayısı rozeti. Komut satırı: `!` değişecek, `✓` doğru, `?` okunamadı.
- **Canlı yenileme:** `main.js` iki dosyayı 2 sn aralıkla izler (`fs.watchFile`) ve pencere odaklanınca `Analyzer.refreshAmd()` çağırır; yalnızca Adrenalin ayarları yeniden okunur, fark varsa öneriler yeniden kurulur.
- **Test fikstürü:** `test/fixtures/amd-user.blb` gerçek dosyanın kopyası; `E:\A_Games\...` altındaki iki kişisel oyun klasörü yolu aynı uzunlukta `D:\Games\GameA\xxx` biçiminde sahte yollarla değiştirildi.
- Ekran görüntüsü aracına `OAR_SHOT_SCROLL=1` eklendi: katlı listeler açılır, sayfanın altı `_alt.png` olarak alınır.

### İşlemci, bellek ve disk analizi (22 Ekim 2026)

Bora'nın sorusu üzerine eklendi: önceden yalnızca ekran kartı ve monitör önerilere katılıyordu. Uygulama yine yalnızca okur.

- **Diskler:** `windows-system.ps1` Storage modülü yerine doğrudan CIM sınıflarını okur (modül yüklemesi birkaç saniye sürüyordu; CIM yaklaşık 0,3 sn). Tür: `BusType` 17 (NVMe) ise `nvme`, değilse `MediaType` 4/5 `ssd`, 3 `hdd`, diğerleri bilinmiyor. `MSFT_Disk.Number` = `MSFT_PhysicalDisk.DeviceId`; Depolama Alanları gibi sanal disklerde eşleşme olmaz, tür bilinmez. Ortak biçim `sys.storage = { disks, volumes }` (`detect/index.js` > `storageFromWin`). macOS ve Linux için `storageGeneric` (statfs, Linux'ta `queue/rotational`) yazıldı, denenmedi.
- **Oyun → disk:** `engine/hardware.js` > `volumeOf` oyun klasörünü en uzun eşleşen bağlama noktasına (Windows'ta sürücü harfi) bağlar. Oyun ayrıntısında `E: · HDD` gibi etiket, öneride `rec.disk` ve `rec.hdd`.
- **HDD notu:** oyun HDD'deyse ve GPU yükü 3+ (ağır), `ow: 1` (açık dünya), Unreal Engine 5 ya da Steam gereksinimi SSD istiyorsa (`req`/`rec`) not verilir. Hafif oyunda not yok.
- **Boş alan:** sistem diskinde ve oyun bulunan diğer disklerde boş alan %10'un altındaysa uyarı. Kaynak: Windows Gezgini sürücü çubuğunu bu sınırın altında kırmızı gösterir. HDD'deki ağır oyunlar ayrıca Özet'te bilgi olarak listelenir.
- **İşlemci:** `cpudb.js` mimari sınıfını verir (ör. Zen 5, 2024). Sayısal puan **bilerek yok**: işlemcilerin oyun performansını karşılaştıran ve kaynağı gösterilebilen bir tablo bulunamadı (TechPowerUp erişimi engelledi). Öneri kurallarında işlemci eşiği kullanılmıyor.
- **İşlemciye bağlı oyun notu:** `cpu: 1`, `haf` türü ya da Paradox (Clausewitz/Jomini) / TaleWorlds motoru; `cpu: 0` dışarıda tutar (Hades II). Ölçekleyici gerekmiyorsa "FPS'i çoğunlukla işlemci belirler; ölçekleyici artırmaz" notu. Oyunun kendi notu işlemciden söz ediyorsa kısa sürüm.
- **Rekabetçi oyunda işlemci notu:** ekran kartı rahatsa (yük seviyesi 0–1) ve monitör 120 Hz ve üstüyse "FPS sınırsızken kare hızını çoğunlukla işlemci belirler". 120 Hz sınırı kare üretimi planındaki yüksek yenileme sınırıyla aynı.
- **Bellek kapasitesi:** yalnızca Steam mağaza bilgisi olan (veritabanında olmayan) oyunlarda, en düşük ya da önerilen gereksinim toplam bellekten fazlaysa not. Mağaza önbelleğinin biçim sürümü `META_V = 2`; eski kayıtlar bir kez yeniden alınır.
- **Değişiklik geçmişi:** disk takılıp çıkarılması izlenir (`diskNew`, `diskRemoved`). USB, SD ve sanal diskler sayılmaz. Eski anlık görüntülerde disk bilgisi yoksa karşılaştırılmaz.
- **Arayüz:** Özet'te işlemci kartına mimari, L3 ve 3D V-Cache; ayrı Diskler kartı (birim, tür, doluluk çubuğu, boş alan, o diskteki oyun sayısı). Komut satırı işlemci, bellek ve diskleri de yazar.

### Oyun ayar dosyalarını okuma (0.1.9, 22–24 Ekim 2026)

Bora'nın isteği: "bir oyunu açtığımda program oyun ayarlarını okusun". Uygulama yalnızca okur; oyun dosyalarına yazmaz.

- **Okunan dosyalar** (`core/gamecfg.js`): The Witcher 3 `BelgelerThe Witcher 3dx12user.settings` (yoksa `user.settings`; hangisi yeniyse), Red Dead Redemption 2 `BelgelerRockstar GamesRed Dead Redemption 2Settingssystem.xml`, Unreal Engine oyunları `%LOCALAPPDATA%<ad>SavedConfigWindows|WindowsNoEditor|WinGDKGameUserSettings.ini` (ve `BelgelerMy Games<ad>…`). Belgeler klasörü `windows-system.ps1`'den (`paths`, OneDrive'a taşınmış olabilir) gelir. Unreal klasör adı oyunun exe adından (`-Win64-Shipping` olmadan) ya da `Binaries` üstündeki proje klasöründen türetilir; LocalAppData listelenmez, yalnızca bu adlardaki yollara bakılır.
- **Yalnızca anlamı kesin değerler çözülür:** çözünürlük; Unreal `FullscreenMode` (motorun EWindowMode sırası: 0 tam ekran, 1 kenarlıksız, 2 pencere); VSync (`VSync`, `bUseVSync`, RDR2 `vSync` 0 = kapalı); FPS sınırı (`FrameRateLimit` 0 = sınırsız, Witcher `[Engine] LimitFPS`); HDR (`HdrEnabled`, `bUseHDRDisplayOutput`, RDR2 `hdr`); kare üretimi (`FSRFramegen` 0/1, `FrameGeneration…Enabled`, `FrameGeneration=(Mode=Off,…)`); gecikme (`AMDAntiLag` 0/1); adı kendini anlatan ölçekleyici (`UpscaleMode=AMD_FSR2_Quality`). **Doğrulanmayanlar** dosyadaki hâliyle "Dosyadan okunamadı · oyunda kontrol et" grubunda gösterilir: Witcher 3 `FullScreenMode`, `AAMode`, `FSR2Quality`; RDR2 `windowed`, `fsr2Index`, `dlssIndex`; Gothic 1 Remake `UpscalingMethod`, `UpscalingQualityFSR`. Witcher 3'te `LimitFPS`in "sınırsız" için hangi sayıyı yazdığı bilinmiyor; değer sayı olarak gösterilir.
- **Karşılaştırma** (`engine/ingame.js` > `compare`): satırlara `cur`, `state` ve gerekirse `raw` eklenir; `rec.ingameState` sayıları verir. Ön ayar, doku, ışın izleme ve hareket bulanıklığı karşılaştırılmaz ("Diğer öneriler"). Windows'ta HDR kapalıyken oyundaki HDR karşılaştırılmaz. Oyunda FPS sınırı yoksa ya da öneriden yüksekse, Adrenalin'deki genel Kare Hızı Hedef Kontrolü öneriye uygunsa "doğru" sayılır; AFMF önerilen oyunda yarım sınır oyun içinden konmalıdır. RSR önerilen oyunda çözünürlük karşılaştırılmaz. Dosyadaki FSR sürümü önerilenden farklıysa (ör. dosyada AMD_FSR2_Quality, öneri FSR 3.1) karar verilmez: oyunun iç adı güncellemeden sonra eski kalmış olabilir.
- **Açık oyun** (`core/procs.js`, `main.js` > `watchGames`): ayar "Değişiklikleri izle" açıkken 8 sn'de bir `tasklist` alınır. Adı bir oyunun exe listesindeki (`probe.exes`; kurulum, kaldırma, hata bildirimi ve hile koruması exe'leri hariç) bir adla eşleşen yeni sürecin yolu bir kez PowerShell `Get-Process` ile sorulur ve oyunun klasörüyle karşılaştırılır (yol okunamazsa ad tek bir oyuna aitse kabul edilir). Oyun açılınca ve kapanınca (4 sn sonra bir kez daha) ayar dosyası okunur; açıkken dosya 2 sn aralıkla izlenir; pencereye dönünce de okunur. Oyun listesinde "Şu an açık" grubu ve başlıkta etiket. 22 Ekim 2026'da Witcher 3 açıkken denendi: yol eşleşmesiyle bulundu (ilk sorgu ~0,7 sn, sonraki ~0,4 sn).
- **Probe sürümü:** exe listesi için `PROBE_V = 2`; eski önbellek kayıtları bir kez yeniden incelenir.
- **Arayüz:** Oyun içi sekmesinde Adrenalin sekmesiyle aynı düzen (özet kutusu, Değiştir, Dosyadan okunamadı, Diğer öneriler, katlı Zaten doğru, ipuçları). Sekme düğmesinde ve oyun listesindeki rozette oyun içi değişiklikler de sayılır. Dosyası tanınmayan oyunda eski görünüm ve "Bu oyunun ayar dosyası tanınmıyor" notu. Ekran görüntüsü aracı `OAR_SHOT_PAGES="games:Witcher:ingame"` ile sekme de seçebilir.

### Eski sayfadan taşınırken değişen kurallar

- FSR 4 yükseltmesinin adı Adrenalin'de artık "AMD FSR Upscaling". RX 9000'de ML kare üretimi için "AMD FSR Frame Generation" satırı eklendi (oyunda FSR 3.1.4+ gerekir).
- FPS sınırı için Radeon Chill yerine Frame Rate Target Control (FRTC) ya da oyun içi sınırlayıcı öneriliyor; Chill yalnızca hafif oyunlarda.
- **Radeon Chill, Gecikme Önleme ve Boost ile birlikte çalışmaz:** Adrenalin Chill açılınca ikisini kendisi kapatır (26.10.1'deki uyarı penceresi, Bora'nın ekran görüntüsü, 22 Ekim 2026). Chill yalnızca `haf` türünde, FreeSync varken ve oyunda Anti-Lag 2 yoksa önerilir; o oyunlarda Gecikme Önleme "Devre dışı" önerilir. AFMF'li oyunlarda Chill'i sınırlayıcı olarak kullanmanın Gecikme Önleme'yi kapatacağı satırda yazar. Test: hiçbir oyunda Chill ve Gecikme Önleme birlikte açık önerilmez.
- **FRTC (Kare Hızı Hedef Kontrolü) Adrenalin 26.10.1'de yalnızca genel ayarda var, oyun profilinde yok** (22 Ekim 2026'da arayüzde doğrulandı). Bu yüzden oyun sayfasındaki satır "genel ayar" etiketiyle genel değeri gösterir; Genel sayfasına da ayrı FRTC satırı eklendi. AFMF açık oyunlarda yarım sınır (ör. 70) oyun içinden konur; oyunda sınırlayıcı yoksa Radeon Chill en az = en çok = yarım değer önerilir.
- FRTC karşılaştırmasında hedefin (yenileme hızı − 3) en çok 4 altı uygun sayılır (144 Hz'de 137–141); Bora'nın 140 ayarı "değiştir" diye gösterilmez (`capOk`, `engine/common.js`).
- Değişken yenileme olmayan monitörde FPS sınırı "yenileme hızı + VSync" oluyor (eski sayfa her durumda yenileme hızı − 3 diyordu).
- Yük seviyesine ekran kartı gücü de katılıyor: `y − 1 + log2(piksel / 2560×1440) + log2(100 / güç sınıfı)`.
- Sürücü önerisi (26.9.2 veya üstü) kayıt defterindeki AMD Software sürümüyle karşılaştırılıyor.

## Açık işler

1. ~~Monitörün gerçek modelini ve yenileme hızını öğren~~ (masaüstü uygulaması EDID'den okuyor).
2. ~~Steam kütüphanesini otomatik oku~~ (masaüstü uygulamasında yapıldı).
3. Xbox oyunları otomatik bulunuyor. Ubisoft klasöründeki üç Assassin's Creed klasöründe yalnızca `logs` var, yani yüklü değiller. Indiana Jones (`G:\The Great Circle`) için uygulamada Ayarlar > Oyun klasörleri > Klasör ekle gerekiyor.
4. Gothic 1 Remake'te Adrenalin'in FSR Upscaling anahtarının çıkıp çıkmadığını oyunda kontrol et; `gamedb.js` içindeki `f` alanını buna göre güncelle. (Oyun dosyası FSR 3.1.4: `amd_fidelityfx_dx12.dll` 1.0.1.41314.)
5. Masaüstü uygulamasını macOS ve Linux'ta dene.
6. ~~İstenirse arayüze İngilizce dil desteği ekle~~ (17 Ekim 2026'da yapıldı; bkz. Dil desteği).
7. ~~Genel ve oyuna özel RSR ile AFMF'nin yeri~~ (22 Ekim 2026'da bulundu; gmdb.blb). Yeni bir Adrenalin ayarının yeri gerekirse yöntem: anlık görüntü al (kayıt defteri `/s`, User.blb, GExDb, gmdb), Adrenalin'de tek ayarı değiştir, farkı bul, geri al. Komutları korumasız çalıştır (bkz. bellek notu). Bora'nın onayı olmadan ayar değiştirilmez.
8. ~~GitHub deposu~~ (22 Ekim 2026'da açıldı ve herkese açık yapıldı; öncesinde kişisel bilgi taraması yapıldı, sorun çıkmadı).
9. ~~Playnite eklentisinin 1.1 sürümünü kur~~ (22 Ekim 2026'da kuruldu).
10. İşlemci için sayısal oyun sınıfı (gpudb'deki gibi puan) ancak kaynağı gösterilebilen bir karşılaştırma tablosuyla eklenir; "işlemci ekran kartını sınırlıyor" kontrolü de bir eşik ister. İkisi de Bora'nın onayı ve kaynağı olmadan yapılmaz.
11. Oyun klasörü incelemesinde motor yanlış çıkabiliyor: Age of Empires II DE "Godot", Bannerlord "Unity 2021.3" olarak görünüyor (22 Ekim 2026). `probe.js` motor tespiti gözden geçirilmeli.
12. Steam mağazasında adla arama yanlış oyunu bulabiliyor: Epic'teki RAVEN2, "Mystery Solitaire. The Black Raven 2" ile eşleşti. Tür, yük ve bellek notu bu yanlış bilgiden üretilir; adla eşleşmenin doğrulanması gerekir.
13. Oyun ayar dosyalarında doğrulanmayan değerlerin anlamını bul (Witcher 3 `FullScreenMode`, `AAMode`, `FSR2Quality`, `LimitFPS` sınırsız değeri; RDR2 `windowed`, `fsr2Index`; Gothic 1 Remake `UpscalingMethod`). Yöntem Adrenalin'deki gibi: oyunda tek ayarı değiştir, dosyanın önceki ve sonraki hâlini karşılaştır. Bora yapar ya da onay verir; tahminle eşlenmez.
