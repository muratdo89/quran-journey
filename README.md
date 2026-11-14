# Quran Journey — Kişisel Kur'an Öğrenme Platformu

Türkçe konuşan yetişkin öğreniciler için geliştirilmiş; Arapça okuma (Elif-Bâ ve harf formları), kelime kelime anlam ve kök incelemesi, tecvid farkındalığı, FSRS aralıklı tekrar ve Kur'an ezberi (Hıfz) odaklı kişisel öğrenme platformu.

## Kapsam (Faz 1 + Faz 2)

- **Doğrulanmış Kanonik Mushaf Verisi:** **Fâtiha Suresi (Sayfa 1) + Amme Cüzü'nün tamamı** (38 Sure: 1 ve 78–114; 24 Medine Mushaf sayfası: Sayfa 1 ve 582–604; 571 ayet; 2.337 kelime; Tanzil Uthmani v1.1 + Quran.com API v4 + Quranic Arabic Corpus v0.4).
- **5 Bağımsız Öğrenme Boyutu:** Arapça Okuma, Telaffuz & Tecvid, Kelime Hazinesi, Ayet Anlama ve Ezber (Hıfz).
- **28 Harflik Elif-Bâ & Okuma Müfredatı:** Seviye tespit değerlendirmesi, 28 harfin 4 konumlu tablosu + ses örnekleri, 8 aşamalı okuma modülü ve 8 aşamalı Tecvid dersi.
- **Bilimsel Aralıklı Tekrar ve Toparlanma Modu:** `ts-fsrs` tabanlı aktif hatırlama kuyruğu, suçluluk yüklemeyen 3–5 dakikalık toparlanma modu ve çift yönlü (`AR→TR`, `TR→AR`) sure bazlı toplu kelime kartı üretimi.

## Kurulum ve Yerel Çalıştırma

```bash
pnpm install
pnpm dev
```

Varsayılan olarak herhangi bir harici veritabanı veya API anahtarı gerekmeden yerel `node:sqlite` veritabanı (`.data/quran-journey.db`, salt okunur ortamlarda `/tmp/quran-journey-data`) ile hemen çalışır.

## Bilgisayarsız (Telefon Tarayıcısından) Bulut Kurulumu: Supabase + Vercel

Proje bulutta tek elden telefon tarayıcısı üzerinden canlıya alınabilecek şekilde yapılandırılmıştır:

1. **Supabase Veritabanı ve Kimlik Doğrulama:**
   - Supabase SQL Editor'de sırasıyla şu dosyaları çalıştırın:
     - `supabase/migrations/0001_initial_schema.sql`
     - `supabase/migrations/0002_rls_policies.sql`
     - `supabase/migrations/0003_phase2_progress_columns.sql`
   - *(İsteğe bağlı kanonik referans tohumlaması için)* `supabase/seed.sql` dosyasını da çalıştırabilirsiniz (uygulama kanonik metinleri yerel paketlenmiş doğrulanmış JSON'dan okuduğu için temel kullanıcı senkronizasyonu `0001`–`0003` ile hemen çalışır).
   - Supabase proje ayarlarından (`Project Settings -> API`) **`Project URL`** ve **`anon public` key** değerlerini kopyalayın.
2. **Vercel Yayını:**
   - Vercel üzerinde bu GitHub deposunu içe aktarın (`Import Git Repository`).
   - **Environment Variables** alanına `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` değerlerini ekleyin ve **Deploy** butonuna basın.
   - Uygulama açıldığında **Ayarlar** sayfasındaki bulut oturumu bölümünden e-posta/şifre ile hesap oluşturup giriş yapabilirsiniz; tüm FSRS kartlarınız, ezber durumunuz, notlarınız ve yer imleriniz cihazlar arası eşitlenir.

## Doğrulama ve Testler

```bash
pnpm test            # İçerik bütünlüğü, müfredat, FSRS/öğrenme motoru ve SQLite entegrasyon testleri
npx tsc --noEmit     # Katı TypeScript denetimi
pnpm lint            # ESLint denetimi
pnpm build           # Next.js üretim derlemesi
pnpm verify:content  # Canonical JSON dosyalarının SHA-256 ve yapı bütünlüğünü doğrular
pnpm seed:supabase   # Canonical veriden supabase/seed.sql dosyasını yeniden üretir
```

## Dokümantasyon

- [Ürün Gereksinimleri (PRD)](docs/PRD.md)
- [Sistem Mimarisi](docs/ARCHITECTURE.md)
- [Veritabanı Tasarımı](docs/DATABASE.md)
- [İçerik Kaynakları ve Lisanslar](docs/CONTENT_SOURCES.md)
- [Yol Haritası](docs/ROADMAP.md)
- [Test ve Kabul Kriterleri](docs/TESTING.md)
