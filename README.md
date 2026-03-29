# F1 25 Next.js Advanced Dashboard

Bu proje, F1 25 UDP telemetry verisini ayni yerel agda canli toplayip Next.js tabanli modern bir dashboarda tasir.

## 1) F1 25 oyununda telemetry nasil acilir?

Oyunda:

1. `Settings` -> `Telemetry Settings`
2. Su ayarlari uygula:
   - `UDP Telemetry`: **On**
   - `UDP Broadcast Mode`: **Off** (onerilen)
   - `UDP IP Address`: Dashboard calisan cihazin LAN IP adresi
   - `UDP Port`: **20777**
   - `UDP Send Rate`: **20Hz** (daha stabil)
   - `UDP Format`: **2025** (gerekirse 2024 ile test)

Notlar:
- Oyun cihazi ve dashboard cihazi ayni Wi-Fi/LAN aginda olmali.
- Firewall tarafinda `UDP 20777` izinli olmali.
- Broadcast mode acik olursa oyun agdaki tum cihazlara UDP yayinlar.

## 2) Uygulama neleri gosteriyor?

Tek sayfada hem dashboard hem detay telemetry:

- Canli surus:
  - Hiz, vites, RPM, DRS
  - Gaz/fren/debriyaj/direksiyon barlari
  - Recharts ile hiz/RPM ve input grafikler
- Race/session:
  - Session tipi, hava, pist/hava sicakligi
  - Safety car durumu, pit limit, kalan sure
- Lap:
  - Son tur, mevcut tur, sektor sureleri
  - Delta (on arac / lider), pit stop, penalti
- Car status:
  - Fuel mix, yakit miktari, kalan tur
  - ERS seviye/mode/harvest/deploy
  - ABS, pit limiter
- Car damage:
  - Aero hasarlari (wing/floor/diffuser/sidepod)
  - Lastik asinma ve hasar
  - Fren hasari
  - PU component wear + DRS/ERS fault
- Event timeline:
  - FTLP, PENA, RCWN, LGOT gibi event akisi
- Pist gorunumu:
  - Tum pilotlarin pistte canli konumu (map gorunumu)
  - Pilot listesinde lastik tipi ve lastik yasi
- Arac ustu hasar gorunumu:
  - Front/rear wing, floor gibi parcalarin renkli hasar gostergesi
  - Fren/teker sicakliklarinin renk kodlu goruntusu
- Teknik debug:
  - Son packet header
  - Packet dagilimi
  - Raw snapshot JSON

## 3) Parse edilen paketler

Bu surumde su packet id'ler parse edilir:

- `1`: Session
- `2`: Lap Data
- `3`: Event
- `4`: Participants
- `6`: Car Telemetry
- `7`: Car Status
- `10`: Car Damage

Desteklenmeyen paketler yine packet dagiliminda gorunur.

## 4) Kurulum ve calistirma

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm start
```

Sunucu endpointleri:
- Dashboard: `http://localhost:3000`
- Summary API: `http://localhost:3000/api/summary`
- UDP listener: `0.0.0.0:20777`

## 5) Ayni Wi-Fi aginda kullanim adimlari

1. `npm start` ile dashboardu ac.
2. Terminalde yazan LAN IP adresini al (ornek `192.168.1.110`).
3. Oyunda `UDP IP Address` alanina bu adresi yaz.
4. Portu `20777` yap.
5. Piste cik ve telemetry yayinini baslat.
6. Dashboardda baglanti durumu `Canli veri akiyor` oldugunda veri alinmis demektir.

Konsoldan oynuyorsan (PS/Xbox):
- Konsol ve dashboard cihazini ayni router'a bagla.
- Oyun ayarinda hedef IP olarak dashboard bilgisayarini sec.

## 6) Teknik mimari

- `server.js`
  - Next.js custom HTTP server + UDP telemetry listener
  - Packet parse + driver overview aggregation
  - SSE (`/events`) uzerinden canli snapshot yayini
- `pages/index.js`
  - MUI component tabanli responsive dashboard
  - Recharts ile gelismis cizimler
- `pages/_app.js`, `styles/globals.css`
  - Tema ve global UI stilleri

## 7) Sorun giderme

- Veri gelmiyor:
  - Oyun IP adresi dogru mu?
  - Ayni agda misiniz?
  - UDP 20777 engelli mi?
  - Telemetry acik mi?
- Veri kesik kesik:
  - Send rate'i 20Hz yap
  - Broadcast mode'u kapatip dogrudan IP kullan
- Hala calismiyorsa:
  - Gecici olarak `UDP Format` 2025/2024 degistirip test et
  - Farkli Wi-Fi AP yerine ayni ana router uzerinden bagla

## 8) Referanslar

- [EA Sports F1 25 UDP specification duyurusu](https://forums.ea.com/blog/f1-games-game-info-hub-en/ea-sports%E2%84%A2-f1%C2%AE25-udp-specification/12187347)
- [F1 25 UDP specification tartisma konusu](https://forums.ea.com/discussions/f1-25-general-discussion-en/discussion-f1%C2%AE-25-udp-specification/12187351/replies/13069528)
- [F1Laps F1 25 telemetry ayarlari](https://www.f1laps.com/faqs/f1-25-udp-telemetry-settings/)
