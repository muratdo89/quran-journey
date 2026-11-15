# Quran Journey — Kişisel Kur'an Öğrenme Platformu

Türkçe konuşan yetişkin öğreniciler için geliştirilmiş; Arapça okuma (Elif-Bâ ve harf formları), kelime kelime anlam ve kök incelemesi, tecvid farkındalığı, FSRS aralıklı tekrar ve Kur'an ezberi (Hıfz) odaklı kişisel öğrenme platformu.

## Kapsam (Faz 1 – Faz 6 Tamamlandı)

- **Tam Kur'an Doğrulanmış Kanonik Mushaf Verisi:** **114 Sure**, **604 Medine Mushaf Sayfası** (30 Cüz), **6.236 Ayet** ve **77.429 Kelime** (Tanzil Uthmani v1.1 + Quran.com API v4 + Quranic Arabic Corpus v0.4). Tembel yüklemeli (`surah-001.json.gz` … `surah-114.json.gz` + `lexicon-index.json.gz`) mimariyle düşük bellek tüketir ve tüm veriler SHA-256 ile doğrulanır.
- **5 Bağımsız Öğrenme Boyutu:** Arapça Okuma, Telaffuz & Tecvid, Kelime Hazinesi, Ayet Anlama ve Ezber (Hıfz).
- **28 Harflik Elif-Bâ & Okuma ve Tecvid Müfredatı:** Seviye tespit değerlendirmesi, 28 harfin 4 konumlu tablosu + Kur'an ses örnekleri, 8 aşamalı okuma modülü ve 8 aşamalı Tecvid dersi.
- **Kelime Hazinesi, 1.651 Kök Ailesi ve Müteşâbihât:** Tüm 77.429 kelime için sunucu taraflı sayfalanmış arama, **Kök Ailesi Gezgini** (`1.651` kök) ve Mushaf / Hıfz modlarında **Müteşâbihât** (benzer ayet) uyarıları.
- **Bilimsel Aralıklı Tekrar ve Toparlanma Modu:** `ts-fsrs` tabanlı aktif hatırlama kuyruğu, suçluluk yüklemeyen 3–5 dakikalık toparlanma modu ve çift yönlü (`AR→TR`, `TR→AR`) sure bazlı toplu kelime kartı üretimi.
- **6 Doğrulanmış Kâri & Hoca İnceleme Paketi:** Afâsî, Husarî (Muallim & Mürettel), Abdülbasit Abdüssamed, Abdurrahman es-Sudeys ve Ebû Bekir eş-Şatrî ayet tilavetleri; yerel ses indirme ve 5 kriterli Tecvid kontrol listesi içeren kopyalanabilir Hoca Raporu + JSON çalışma yedeği dışa aktarımı.
- **Genişletilebilir Kur'an ASR Kelime Sırası Analizi:** `ConfigurableHttpAsrProvider` + Arapça Levenshtein DP hizalama motoru. Mikrofon kayıtları IndexedDB'de yerel saklanır; harici ASR yalnızca açık kullanıcı onayı (`consentGranted`) olduğunda çalışır ve tecvid teyidi için her zaman uzman incelemesi gerektirir (`requiresHumanReview: true`).
- **Derin Analitik, Sağlık Kontrolü ve Çevrimdışı PWA Desteği:** 30 Cüz / 604 sayfalık ilerleme matrisi, unutulan kök ve FSRS hata örüntüsü analitiği, `/api/health` canlı durum doğrulaması, Service Worker sayfa/ses önbellekleme (`public/sw.js`) ve nazik tarayıcı hatırlatıcısı.

## Kurulum ve Yerel Çalıştırma

```bash
pnpm install
pnpm dev
```

Varsayılan olarak herhangi bir harici veritabanı veya API anahtarı gerekmeden yerel `node:sqlite` veritabanı (`.data/quran-journey.db`, salt okunur ortamlarda `/tmp/quran-journey-data`) ile hemen çalışır.

## Bilgisayarsız (Telefon Tarayıcısından) 2 Adımlı Bulut Kurulumu

Uygulama bilgisayara ihtiyaç duymadan doğrudan telefon tarayıcısı üzerinden canlıya alınabilecek şekilde hazırlanmıştır:

1. **Supabase Veritabanı (Tek Dosya Yapıştır & Çalıştır):**
   - Supabase projenizde **SQL Editor** ekranını açın.
   - [`supabase/setup_all.sql`](supabase/setup_all.sql) dosyasının içeriğini kopyalayıp yapıştırın ve **Run** butonuna basın (tüm şema, RLS güvenlik kuralları ve Faz 2–5 kolonları tek seferde idempotent şekilde kurulur).
   - *Project Settings → API* bölümünden **`Project URL`** ve **`anon public` key** değerlerini kopyalayın.
2. **Vercel Yayını (Tek Tıkla İçe Aktar):**
   - Aşağıdaki bağlantıyı telefonunuzdan açıp yukarıdaki iki Supabase değişkenini (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) yapıştırarak **Deploy** edin:
   - [Vercel ile Tek Tıkla Yayınla](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmuratdo89%2Fquran-journey&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - *(İsteğe bağlı — Faz 4 Harici Kur'an ASR)*: Kelime sırası kontrolü için Vercel Environment Variables alanına `QURAN_ASR_API_URL` (ör. Whisper uyumlu endpoint) ve `QURAN_ASR_API_KEY` ekleyebilirsiniz; tanımlanmazsa uygulama dürüst biçimde yerel kayıt + hoca karşılaştırma modunda çalışır.

## Doğrulama ve Testler

```bash
pnpm setup:env       # .env.local şablonunu ve Supabase SQL dosyalarının hazırlığını doğrular
pnpm verify:content  # Tüm 114 sure, 604 sayfa, 6.236 ayet, 77.429 kelime ve lexicon-index SHA-256 denetimi
pnpm test            # İçerik bütünlüğü, müfredat, FSRS/öğrenme motoru, ASR hizalama, SQLite ve Faz 6 testleri
npx tsc --noEmit     # Katı TypeScript denetimi
pnpm lint            # ESLint denetimi
pnpm build           # Next.js üretim derlemesi
pnpm seed:supabase   # Canonical veriden supabase/seed.sql dosyasını yeniden üretir (--all ile 114 sure)
```

## Dokümantasyon

- [Ürün Gereksinimleri (PRD)](docs/PRD.md)
- [Sistem Mimarisi](docs/ARCHITECTURE.md)
- [Veritabanı Tasarımı](docs/DATABASE.md)
- [İçerik Kaynakları ve Lisanslar](docs/CONTENT_SOURCES.md)
- [Yol Haritası](docs/ROADMAP.md)
- [Test ve Kabul Kriterleri](docs/TESTING.md)

