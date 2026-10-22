'use strict';
// Oyun veritabanı. Adrenalin Ayar Rehberi'ndeki (index.html) G dizisinden taşındı ve genişletildi.
// Alanlar (eski alanlar korunuyor):
//  n ad · t tür (rek rekabetçi, koop online ko-op, aks tek oyunculu, yar yarış/spor, haf hafif/strateji)
//  y 1440p yüksek ayarda RX 9070 XT sınıfı kartta GPU yükü (1 hafif … 4 çok ağır/RT)
//  f FSR: fsr4 | fsr31 | fsr31n (FSR 3.1 ama AMD'nin yükseltme listesinde değil) | fsr3 | fsr2 | fsr1 | yok
//  fg oyun içi FSR kare üretimi · al Anti-Lag 2 · c60 60 FPS kilidi · ac hile koruması
//  no genel not · noAmd yalnızca AMD kartlarda gösterilen not
//  en: { no, noAmd, tips } İngilizce karşılıklar. Türkçe not eklenir ya da değişirse bunu da güncelle (test/run.js eksikleri yakalar).
// Yeni alanlar: ids {steam}, dl DLSS · dfg DLSS kare üretimi · rx Reflex · xs XeSS · rt 'zorunlu' · tips oyun içi ipuçları · aka diğer adlar
// Bilinmeyen alan boş bırakılır; o zaman oyun klasöründeki dosyalardan çıkan bilgi kullanılır.
const { norm, normLoose } = require('./util');

const G = [
  { n: 'Counter-Strike 2', ids: { steam: '730' }, t: 'rek', y: 1, f: 'fsr1', al: 1, rx: 1, ac: 'VAC', no: "Oyundaki FSR 1'i kapalı tut; native çözünürlük daha net.", noAmd: "Anti-Lag 2 oyun tarafından destekleniyor; Adrenalin'de Anti-Lag açıkken CS2 AL2 kullanır.", en: { no: 'Keep the in-game FSR 1 off; native resolution is sharper.', noAmd: 'Anti-Lag 2 is supported by the game; with Anti-Lag on in Adrenalin, CS2 uses AL2.' } },
  { n: 'Valorant', t: 'rek', y: 1, f: 'yok', rx: 1, ac: 'Vanguard' },
  { n: 'League of Legends', t: 'rek', y: 1, f: 'yok', ac: 'Vanguard', no: 'Kart neredeyse boşta çalışır; tearing istemiyorsan FPS sınırı koymak gücü ve ısıyı ciddi düşürür.', en: { no: 'The card runs almost idle; if you do not want tearing, setting an FPS limit cuts power and heat considerably.' } },
  { n: 'Dota 2', ids: { steam: '570' }, t: 'rek', y: 1, f: 'fsr1', ac: 'VAC' },
  { n: 'Apex Legends', ids: { steam: '1172470' }, t: 'rek', y: 2, f: 'yok', rx: 1, ac: 'EAC', noAmd: "Adrenalin 26.8.1'de RX 9070 XT'de çökme raporlandı; 26.9.1'de düzeltildi. 26.9.1 veya üstünü kullan.", en: { noAmd: 'A crash was reported on the RX 9070 XT with Adrenalin 26.8.1; it was fixed in 26.9.1. Use 26.9.1 or newer.' } },
  { n: 'Fortnite', t: 'rek', y: 2, f: 'yok', dl: 1, rx: 1, ac: 'EAC + BattlEye', no: "Fortnite'ın kendi TSR ölçekleyicisi var. Rekabetçi modda Performance render modu daha yüksek FPS verir.", noAmd: 'Oyunda FSR 4 desteği yok.', en: { no: 'Fortnite has its own TSR upscaler. In competitive play the Performance rendering mode gives higher FPS.', noAmd: 'The game has no FSR 4 support.' } },
  { n: 'Overwatch 2', ids: { steam: '2357570' }, t: 'rek', y: 1, f: 'fsr2', rx: 1, ac: 'Blizzard' },
  { n: 'Rainbow Six Siege X', ids: { steam: '359550' }, aka: ['Tom Clancys Rainbow Six Siege'], t: 'rek', y: 1, f: 'yok', ac: 'BattlEye' },
  { n: 'PUBG: Battlegrounds', ids: { steam: '578080' }, t: 'rek', y: 2, f: 'yok', ac: 'BattlEye' },
  { n: 'Rocket League', ids: { steam: '252950' }, t: 'rek', y: 1, f: 'yok', ac: 'EAC' },
  { n: 'Marvel Rivals', ids: { steam: '2767030' }, t: 'rek', y: 2, f: 'fsr31', ac: 'NetEase' },
  { n: 'Call of Duty: Black Ops 6 / Warzone', aka: ['Call of Duty'], t: 'rek', y: 2, f: 'fsr31', ac: 'Ricochet' },
  { n: 'Battlefield 6', t: 'rek', y: 2, f: 'fsr31', ac: 'Javelin' },
  { n: 'Escape from Tarkov', t: 'rek', y: 3, f: 'fsr2', ac: 'BattlEye', no: 'CPU ve bellek darboğazı yüksek; GPU ayarından çok harita ve RAM etkiler.', en: { no: 'Heavily CPU- and memory-bound; the map and RAM matter more than GPU settings.' } },
  { n: 'Helldivers 2', ids: { steam: '553850' }, t: 'koop', y: 2, f: 'fsr1', ac: 'GameGuard' },
  { n: 'Cyberpunk 2077', ids: { steam: '1091500' }, t: 'aks', y: 4, f: 'fsr31', fg: 1, dl: 1, dfg: 1, rx: 1, no: 'Path tracing (Overdrive) en ağır ayar; çoğu kartta RT Ultra daha dengeli.', noAmd: 'Path tracing RDNA 4\'te bile çok ağır. FSR 4 yükseltmesi Kalite modunda net fark yaratır.', tips: ['Path tracing (Overdrive) ve Psycho ekran yansımaları en çok FPS yiyen ayarlar.'], en: { no: 'Path tracing (Overdrive) is the heaviest setting; RT Ultra is more balanced on most cards.', noAmd: 'Path tracing is very heavy even on RDNA 4. The FSR 4 upgrade makes a clear difference in Quality mode.', tips: ['Path tracing (Overdrive) and Psycho screen space reflections are the settings that cost the most FPS.'] } },
  { n: 'Alan Wake 2', t: 'aks', y: 4, f: 'fsr2', dl: 1, dfg: 1, rx: 1, no: 'Path tracing kapalı, RT düşük/orta önerilir.', en: { no: 'Path tracing off, RT low/medium recommended.' } },
  { n: 'Black Myth: Wukong', ids: { steam: '2358720' }, t: 'aks', y: 4, f: 'fsr3', fg: 1, dl: 1, dfg: 1, rx: 1 },
  { n: 'Monster Hunter Wilds', ids: { steam: '2246340' }, t: 'aks', y: 3, f: 'fsr31', fg: 1, dl: 1, dfg: 1, no: 'CPU yükü yüksek. Yüksek çözünürlüklü doku paketi bol VRAM ister; 16 GB kartta rahat çalışır.', en: { no: 'High CPU load. The high-resolution texture pack needs plenty of VRAM; it runs comfortably on a 16 GB card.' } },
  { n: 'Kingdom Come: Deliverance II', ids: { steam: '1771300' }, t: 'aks', y: 3, f: 'fsr31', dl: 1 },
  { n: "Assassin's Creed Shadows", ids: { steam: '3159330' }, t: 'aks', y: 4, f: 'fsr31', fg: 1, dl: 1, dfg: 1 },
  { n: 'Ghost of Tsushima', ids: { steam: '2215430' }, t: 'aks', y: 2, f: 'fsr31', fg: 1, al: 1, dl: 1, dfg: 1, rx: 1 },
  { n: 'God of War Ragnarök', ids: { steam: '2322010' }, t: 'aks', y: 3, f: 'fsr31', fg: 1, dl: 1, dfg: 1, rx: 1 },
  { n: "Marvel's Spider-Man 2", ids: { steam: '2651280' }, t: 'aks', y: 4, f: 'fsr31', fg: 1, dl: 1, dfg: 1, rx: 1 },
  { n: 'Ratchet & Clank: Rift Apart', ids: { steam: '1895880' }, t: 'aks', y: 3, f: 'fsr31', fg: 1, al: 1, dl: 1, dfg: 1, rx: 1 },
  { n: 'Horizon Zero Dawn Remastered', ids: { steam: '2561580' }, t: 'aks', y: 2, f: 'fsr31', fg: 1, dl: 1, dfg: 1 },
  { n: 'S.T.A.L.K.E.R. 2', ids: { steam: '1643320' }, aka: ['STALKER 2 Heart of Chornobyl'], t: 'aks', y: 4, f: 'fsr31', fg: 1, dl: 1, dfg: 1, rx: 1, no: 'Unreal Engine 5 takılmaları sürücüyle çözülmez; shader derlemesi bitene kadar ilk dakikalar dalgalı olur.', en: { no: 'Unreal Engine 5 stutter is not fixed by the driver; the first minutes are uneven until shader compilation finishes.' } },
  { n: 'Crimson Desert', t: 'aks', y: 4, f: 'fsr4', fg: 1, noAmd: 'FSR Redstone (ışın yeniden üretimi dahil) oyunda yerleşik; ayarları oyun menüsünden yap.', en: { noAmd: 'FSR Redstone (including ray regeneration) is built into the game; make the settings in the game menu.' } },
  { n: 'Hogwarts Legacy', ids: { steam: '990080' }, t: 'aks', y: 3, f: 'fsr2', dl: 1, dfg: 1, rx: 1 },
  { n: "Baldur's Gate 3", ids: { steam: '1086940' }, t: 'aks', y: 2, f: 'fsr2', dl: 1 },
  { n: 'Elden Ring / Nightreign', ids: { steam: '1245620' }, aka: ['Elden Ring', 'Elden Ring Nightreign'], t: 'aks', y: 2, f: 'yok', c60: 1, ac: 'EAC', no: 'Motor 60 FPS ile kilitli.', noAmd: 'AFMF sürücü seviyesinde çalışır, oyuna müdahale etmez; 120 FPS görüntü elde edersin.', en: { no: 'The engine is locked to 60 FPS.', noAmd: 'AFMF works at driver level and does not interfere with the game; you get a 120 FPS output.' } },
  { n: 'Red Dead Redemption 2', ids: { steam: '1174180' }, t: 'aks', y: 3, f: 'fsr2', dl: 1, rx: 1, no: 'Vulkan API genelde DX12\'den daha stabil kare süresi verir.', noAmd: 'Oyun FSR 2 kullanıyor; Adrenalin bunu FSR 4\'e yükseltemez.', tips: ['Hacimsel aydınlatma (volumetrik) ve MSAA en çok FPS yiyen ayarlar; MSAA yerine TAA kullan.'], en: { no: 'The Vulkan API usually gives more stable frame times than DX12.', noAmd: 'The game uses FSR 2; Adrenalin cannot upgrade it to FSR 4.', tips: ['Volumetric lighting and MSAA are the settings that cost the most FPS; use TAA instead of MSAA.'] } },
  { n: 'The Witcher 3: Wild Hunt — Remastered', ids: { steam: '292030' }, aka: ['The Witcher 3 Wild Hunt'], t: 'aks', y: 3, f: 'fsr4', fg: 1, al: 1, no: '29 Eylül 2026 remaster sürümü. Path tracing en ağır ayar; açarsan ölçekleyiciyi Performans modunda ve oyun içi kare üretimiyle kullan.', noAmd: 'FSR 4, FSR kare üretimi ve Anti-Lag 2 oyunda yerleşik. Adrenalin 26.9.2 bu oyun için optimizasyon içeriyor.', en: { no: 'The 29 September 2026 remaster. Path tracing is the heaviest setting; if you turn it on, use the upscaler in Performance mode with in-game frame generation.', noAmd: 'FSR 4, FSR frame generation and Anti-Lag 2 are built into the game. Adrenalin 26.9.2 contains optimizations for this game.' } },
  { n: 'Gothic 1 Remake', ids: { steam: '1297900' }, t: 'aks', y: 3, f: 'fsr31n', fg: 1, no: 'Unreal Engine 5. Haziran yamasından sonra oyun içi FSR kare üretiminin bozulduğu bildirildi; sorun yaşarsan oyun içi kare üretimini kapat. Shader derleme takılmaları sürücüyle çözülmez.', noAmd: "Oyunda FSR 3.1 var ama AMD'nin FSR 4 yükseltme listesinde görünmüyor; Adrenalin'de anahtar çıkarsa aç. Oyun içi kare üretimini kapatırsan yerine AFMF kullanabilirsin.", en: { no: 'Unreal Engine 5. In-game FSR frame generation was reported broken after the June patch; if you have problems, turn off in-game frame generation. Shader compilation stutter is not fixed by the driver.', noAmd: "The game has FSR 3.1 but does not appear on AMD's FSR 4 upgrade list; turn on the toggle in Adrenalin if it appears. If you turn off in-game frame generation, you can use AFMF instead." } },
  { n: 'NBA 2K26', ids: { steam: '3472040' }, t: 'yar', y: 1, f: 'fsr3', ac: 'EAC', no: 'Atış zamanlaması gecikmeye duyarlı. Kare üretimi kullanma, düşük gecikme ayarı açık kalsın.', en: { no: 'Shot timing is sensitive to latency. Do not use frame generation; keep the low latency setting on.' } },
  { n: 'Age of Empires III: Definitive Edition', ids: { steam: '933110' }, t: 'haf', y: 1, f: 'fsr1', no: "Kalabalık savaşlarda işlemci sınırlar. Oyundaki FSR 1'i kapalı tut; kart native çözünürlükte rahat çalışır.", en: { no: 'In crowded battles the processor is the limit. Keep the in-game FSR 1 off; the card runs comfortably at native resolution.' } },
  { n: 'Mount & Blade II: Bannerlord', ids: { steam: '261550' }, t: 'haf', y: 1, f: 'yok', no: 'Darboğaz ekran kartı değil, işlemcinin tek çekirdeği. Büyük savaşlarda FPS düşüyorsa Savaş Boyutu ayarını düşür; grafik ayarları fazla fark yaratmaz. Oyun DirectX 11 kullanır, FSR yok.', en: { no: 'The bottleneck is not the graphics card but a single processor core. If FPS drops in big battles, lower the Battle Size setting; graphics settings make little difference. The game uses DirectX 11 and has no FSR.' } },
  { n: 'Windrose', ids: { steam: '3041230' }, t: 'koop', y: 3, f: 'fsr4', fg: 1, no: 'Erken erişim, Unreal Engine 5.', noAmd: 'FSR 4 (Redstone) ve kare üretimi oyunda yerleşik.', en: { no: 'Early access, Unreal Engine 5.', noAmd: 'FSR 4 (Redstone) and frame generation are built into the game.' } },
  { n: 'GTA V Enhanced', t: 'aks', y: 2, f: 'fsr3', fg: 1, dl: 1, dfg: 1, ac: 'BattlEye (Online)' },
  { n: 'Starfield', ids: { steam: '1716740' }, t: 'aks', y: 3, f: 'fsr3', fg: 1, dl: 1, dfg: 1, noAmd: "26.9.1 RX 9000'de Starfield çökmelerini düzeltti.", en: { noAmd: '26.9.1 fixed Starfield crashes on the RX 9000 series.' } },
  { n: 'Forza Horizon 5', ids: { steam: '1551360' }, t: 'yar', y: 2, f: 'fsr2', dl: 1 },
  { n: 'Minecraft (Java)', t: 'haf', y: 1, f: 'yok' },
  { n: 'Civilization VI', ids: { steam: '289070' }, aka: ["Sid Meier's Civilization VI"], t: 'haf', y: 1, f: 'yok' },
  { n: 'Hades II', ids: { steam: '1145350' }, t: 'haf', y: 1, f: 'yok' },
  // Kullanıcının kütüphanesinden eklenenler (tür ve yük; teknoloji bilgisi dosyalardan okunur)
  { n: 'Indiana Jones and the Great Circle', t: 'aks', y: 4, rt: 'zorunlu', no: 'Işın izleme destekli ekran kartı şart; motor her zaman RT aydınlatma kullanır. Doku havuzu boyutunu (Texture Pool Size) VRAM\'e göre seç; fazlası takılma yapar.', en: { no: 'A ray-tracing capable graphics card is required; the engine always uses RT lighting. Choose the Texture Pool Size according to your VRAM; more than that causes stutter.' } },
  { n: 'Age of Empires IV', t: 'haf', y: 1, no: 'Strateji oyunu; kalabalık haritalarda işlemci sınırlar.', en: { no: 'Strategy game; on crowded maps the processor is the limit.' } },
  { n: 'Age of Empires II: Definitive Edition', t: 'haf', y: 1 },
  { n: 'Europa Universalis V', t: 'haf', y: 1, no: 'Darboğaz işlemci; oyun ilerledikçe simülasyon yavaşlar. Grafik ayarları hızı pek etkilemez.', en: { no: 'The bottleneck is the processor; the simulation slows down as the game progresses. Graphics settings hardly affect speed.' } },
  { n: 'Old World', t: 'haf', y: 1 },
  { n: 'Foundation', t: 'haf', y: 1 },
  { n: 'Knights of Honor II: Sovereign', t: 'haf', y: 1 },
  { n: "Assassin's Creed Valhalla", t: 'aks', y: 2 },
  { n: "Assassin's Creed Odyssey", t: 'aks', y: 2 },
  { n: "Assassin's Creed IV Black Flag", t: 'aks', y: 1 },
];

const byNorm = new Map(), byLoose = new Map(), bySteam = new Map();
for (const g of G) {
  for (const name of [g.n, ...(g.aka || [])]) {
    byNorm.set(norm(name), g);
    byLoose.set(normLoose(name), g);
  }
  if (g.ids && g.ids.steam) bySteam.set(g.ids.steam, g);
}

function match(game) {
  if (game.appid && bySteam.has(String(game.appid))) return bySteam.get(String(game.appid));
  if (!game.name) return null;
  return byNorm.get(norm(game.name)) || byLoose.get(normLoose(game.name)) || null;
}

module.exports = { G, match };
