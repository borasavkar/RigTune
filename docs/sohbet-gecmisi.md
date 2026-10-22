# Konuşma geçmişi: Adrenalin Ayar Rehberi

claude.ai sohbeti, 14–17 Ekim 2026. Bora'nın mesajları olduğu gibi aktarıldı; Claude'un yanıtları kısaltılarak özetlendi.

---

## 1. Uygulama fikri (14 Ekim 2026)

**Bora:**
> Şu an rx 9070xt'li sistemim var. Bulabildiğimiz her oyun için amd adrenalin ayarları önerecek bir uygulama yapabilir miyiz?

**Claude'un yaptıkları:**
- Güncel Adrenalin özelliklerini araştırdı: FSR 4 / FSR Redstone (25.12.1 ile RDNA 4'e geldi), AFMF 2.1, Anti-Lag 2'nin "FSR Latency Reduction 2" olarak yeniden adlandırılması, 26.9.x sürücü notları.
- Tek dosyalık bir web uygulaması yazıp claude.ai'de yayınladı:
  - 39 oyunluk hazır liste: tür, GPU yükü, FSR sürümü, kare üretimi, Anti-Lag 2 ve anti-cheat bilgisiyle.
  - Monitör seçimi: çözünürlük, Hz, FreeSync.
  - Kural tabanlı öneri motoru: FSR 4 yükseltmesi, RSR, AFMF, Anti-Lag, Boost, FPS sınırı ve Chill, Image Sharpening, VSync, Enhanced Sync.
  - "Bir kez yapılacak genel ayarlar" bölümü: FreeSync, SAM, HYPR-RX, AA, sürücü sürümü.
  - Listede olmayan oyunlar için "Claude'a sor" özelliği (oyun özelliklerini tahmin eder) ve elle giriş formu.
  - "Ayarları kopyala" düğmesi.

**Claude'un uyarıları:**
- Öneriler kural tabanlıdır, ölçüm değildir. Gerçek FPS Alt+R metrik katmanından kontrol edilmeli.
- Claude'un tahmini yanlış olabilir; oyun menüsünden doğrulanmalı.
- FSR 4 yükseltmesi yalnızca FSR 3.1 oyunlarında çalışır.
- Sürücü olarak 26.9.1 veya üstü öneriliyor (26.8.1'de Apex çökmesi vardı).

---

## 2. Steam kütüphanesi ve uygulamanın nereden açılacağı (16 Ekim 2026)

**Bora:**
> steam kütüphanemi oku. Ve bu uygulamayı nereden çalıştıracağım

**Claude'un yaptıkları:**
- Bilgisayardaki Steam kütüphane klasörlerini buldu (C:, D:, G:; H: kayıtlı ama erişilemedi) ve izinle `appmanifest` dosyalarını okudu.
- Yüklü 7 oyun: The Witcher 3 Remastered, Red Dead Redemption 2, NBA 2K26, Age of Empires III: DE, Gothic 1 Remake, Mount & Blade II: Bannerlord, Windrose (H:).
- Listede olmayan oyunların FSR ve kare üretimi desteğini araştırdı.
- Uygulamayı güncelledi (sürüm 2):
  - "Steam kütüphanen" grubu eklendi; son oynanan oyun üstte.
  - "Steam'im" filtresi eklendi.
  - Eski "The Witcher 3" kaydı, FSR 4 / kare üretimi / Anti-Lag 2 içeren Remastered kaydıyla değiştirildi.
  - FSR 3.1 olup AMD'nin FSR 4 listesinde olmayan oyunlar için ayrı bir durum (`fsr31n`) eklendi (Gothic 1 Remake).
  - Sürücü önerisi "26.9.2 veya üstü" yapıldı.

**Önemli notlar:**
- Gothic 1 Remake: Haziran yamasından sonra oyun içi kare üretiminde sorun bildirildi. Sorun sürerse oyun içi kare üretimi kapatılıp AFMF kullanılmalı.
- Windrose: Steam kurulumu H: diskinde gösteriyor, o disk o gün erişilemiyordu.
- Yalnızca yüklü oyunlar okundu. Hesapta olup yüklü olmayan oyunlar için Steam profilinin okunması gerekir.

**Uygulama nereden açılır:**
- Bir program değil, claude.ai'de duran özel bir web sayfası; kurulum gerekmez.
- Bilgisayarda sohbetteki karttan ya da claude.ai/code/artifacts sayfasındaki listeden açılır. Oyunda Alt+Tab ile bakılıp ayarlar Adrenalin'de girilir: Oyunlar sekmesinden oyun seçilir, profili düzenlenir.
- Aynı hesapla telefonda da açılır.
- Yerel kopya (`index.html`) tarayıcıda doğrudan açılır. Yerelde "Claude'a sor" çalışmaz, elle giriş formu kullanılır.

---

## 3. Dışa aktarma (17 Ekim 2026)

**Bora:**
> dışa aktar bu yazışmalarımızı code ile devam edeceğim

**Claude'un yaptıkları:** Bu klasörü hazırladı: `index.html`, `adrenalin-ayar.artifact.html`, `CLAUDE.md` (proje bağlamı, veri modeli, Steam bulguları, kaynaklar, açık işler) ve bu dosya.
