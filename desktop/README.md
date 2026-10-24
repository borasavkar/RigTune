# RigTune

Bilgisayardaki ekran kartını, işlemciyi, belleği, diskleri, monitörü ve yüklü oyunları okuyup her oyun için iki tür öneri verir:

- **Sürücü uygulaması:** AMD Adrenalin, NVIDIA App ya da Intel Graphics Software'deki oyun profili ayarları.
- **Oyun içi ayarlar:** Ön ayar, doku, ışın izleme, ölçekleyici, kare üretimi, VSync, FPS sınırı, HDR.

Bir kez yapılacak genel ayarları ve Windows kontrollerini de gösterir. Donanım, sürücü, yazılım, monitör ya da oyun değişince bunu algılar, önerileri yeniler ve bildirim gösterir.

## Çalıştırma

| Ne | Komut |
|---|---|
| Uygulamayı geliştirme modunda aç | `npm start` |
| Arayüzsüz analiz | `node src/cli.js` |
| Tek oyunun önerileri | `node src/cli.js --oyun "witcher"` |
| İngilizce çıktı | `node src/cli.js --oyun "witcher" --dil en` |
| Testler | `npm test` |
| Windows kurulum dosyası + taşınabilir exe | `npm run dist` → `dist/` klasörü |

## Nasıl çalışır

1. **Sistem:** Windows'ta iki PowerShell betiği yalnızca okuma yapar. Ekran kartı ve sürücü bilgisi kayıt defterinden gelir. Monitörün gerçek yetenekleri (en yüksek yenileme hızı, FreeSync/G-SYNC aralığı, HDR parlaklığı) monitörün kendi EDID verisinden okunur. İşlemcinin mimarisi model adından çıkarılır. Disklerin türü (NVMe SSD, SSD, HDD), sürücü harfleri ve boş alanı Windows'un depolama bilgisinden okunur.
2. **Kütüphaneler:**
   - Steam: `libraryfolders.vdf` ve `appmanifest` dosyaları.
   - Epic: manifest dosyaları.
   - GOG, Ubisoft, EA: kayıt defteri.
   - Xbox / Microsoft Store: `MicrosoftGame.config`.
   - Battle.net, Rockstar, Riot: kaldırma kayıtları.
   - Playnite: `integrations/playnite/` eklentisinin yazdığı liste. Playnite açıkken kütüphane dosyasını kilitlediği için eklenti gerekir. Kurulum: klasörü `%AppData%\Playnite\Extensions\OyunAyarRehberi_Export` olarak kopyalayıp Playnite'ı yeniden başlat. Eklentinin 1.0 sürümü listeyi eski klasöre (`%APPDATA%\Oyun Ayar Rehberi`) yazar; uygulama iki klasörü de okur. Eklenti yoksa Playnite kapalıyken kütüphane dosyası doğrudan okunmaya çalışılır.
   - Ayrıca diskteki `Games` klasörleri ve senin eklediğin klasörler.
3. **Oyun dosyaları:** Oyun klasöründeki kütüphanelerden DLSS, FSR, XeSS, kare üretimi, Reflex, oyun motoru ve hile koruması çıkarılır. Bu sayede veritabanında olmayan oyunlar da analiz edilir.
4. **Öneri motoru:** Kural tabanlıdır. Oyunun türü, GPU yükü, desteklediği teknolojiler, kartın gücü ve özellikleri, monitörün çözünürlüğü ve yenileme hızı birlikte değerlendirilir. "Tahmini durum" ölçüm değildir. Ayrıca:
   - Strateji ve benzeri işlemciye bağlı oyunlarda ölçekleyicinin FPS'i artırmayacağı, rekabetçi oyunlarda yüksek FPS'te sınırı işlemcinin belirlediği not olarak yazılır.
   - Ağır, açık dünya ya da Unreal Engine 5 oyunu HDD'de yüklüyse oyunun notunda SSD'ye taşıma önerilir.
   - Sistem diskinde ya da oyun bulunan bir diskte boş alan %10'un altına inerse uyarı verilir (Windows Gezgini de bu sınırda sürücüyü kırmızı gösterir).
   - Steam mağaza bilgisi alınan oyunlarda en düşük ve önerilen bellek gereksinimi bilgisayardaki bellekle karşılaştırılır.
5. **Değişiklik izleme:** Açılışta ve ayarlanan aralıkta kontrol yapılır. Monitör değişince ve bilgisayar uykudan uyanınca da kontrol edilir. Fark varsa Geçmiş bölümüne yazılır ve bildirim gösterilir.
6. **Adrenalin'deki mevcut ayarlar (AMD, Windows):** Oyun profilleri (`%LOCALAPPDATA%\ATI\ACE\APL\User.blb`), genel ayarlar (kayıt defteri ve `%LOCALAPPDATA%\AMD\CN\GExDb.blb`) okunur ve her öneri şu anki değerle karşılaştırılır. Adrenalin sekmesinde önce değiştirilmesi gereken ayarlar "şu an → öneri" biçiminde görünür. Ardından okunamayanlar gelir; zaten doğru olanlar katlı bir listede durur. Oyun listesindeki rozet, o oyunda kaç ayarın değişeceğini gösterir. Adrenalin'de bir şey değiştirince uygulama kendini yeniler. Radeon Super Resolution ve AFMF, Adrenalin'in oyun listesinden (`%LOCALAPPDATA%AMDCNgmdb.blb`) okunur.
7. **Oyunun kendi ayarları (Windows):** Ayar dosyası tanınan oyunlarda oyun içi öneriler de şu anki değerle karşılaştırılır. Şu an tanınanlar: The Witcher 3 (`BelgelerThe Witcher 3dx12user.settings`), Red Dead Redemption 2 (`BelgelerRockstar GamesRed Dead Redemption 2Settingssystem.xml`) ve Unreal Engine oyunları (`%LOCALAPPDATA%<oyun>SavedConfigWindowsGameUserSettings.ini`). Yalnızca anlamı kesin değerler çözülür (çözünürlük, ekran modu, VSync, FPS sınırı, HDR, kare üretimi, gecikme azaltma, adı kendini anlatan ölçekleyici); anlamı doğrulanmamış sayısal kodlar (ör. Witcher 3'te `AAMode=5`) dosyadaki hâliyle "oyunda kontrol et" olarak gösterilir. Uygulama süreç listesine 8 saniyede bir bakar: kütüphanedeki bir oyun açılınca ya da kapanınca ayar dosyası yeniden okunur, oyun açıkken dosya izlenir ve oyun listesinin en üstünde "Şu an açık" grubunda görünür.

## Dil

Arayüz, öneriler, tepsi menüsü ve bildirimler Türkçe ya da İngilizce olabilir. Ayarlar > Dil bölümünden seçilir. Varsayılan "Sistem" seçeneği işletim sisteminin dilini kullanır; sistem dili Türkçe değilse İngilizce gösterilir. Sürücü uygulamalarındaki İngilizce ayar adları (ör. "AMD FSR Upscaling") iki dilde de çevrilmeden yazılır. Metinler `src/locales/` klasöründedir.

## Gizlilik

- Uygulama hiçbir ayarı değiştirmez, yalnızca okur (Adrenalin'in ayar dosyaları, kayıt defteri ve oyunların kendi ayar dosyaları dahil).
- İnternete yalnızca "Oyun bilgisini Steam mağazasından tamamla" açıkken çıkar. Bu durumda veritabanında olmayan oyunların adı ya da Steam numarası gönderilir; dönen bilgiden tür, önerilen sistem ve bellek/SSD gereksinimi alınır. Kapak resimleri de bu ayara bağlıdır.
- Veriler `%APPDATA%\RigTune\` klasöründe durur. Uygulamanın eski adı "Oyun Ayar Rehberi" idi; o addaki klasör varsa ayarlar ve geçmiş ilk açılışta buraya kopyalanır, eski klasör silinmez.

## Platformlar

Windows birincil hedeftir ve bu bilgisayarda denendi. macOS ve Linux için algılama ve kütüphane taraması (Steam, Heroic/Legendary) yazıldı ama o sistemlerde henüz denenmedi. Bu platformlarda ayrı bir sürücü paneli olmadığı için yalnızca oyun içi öneriler gösterilir.
