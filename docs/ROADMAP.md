# Roadmap

## Sprint 0 — Teknik Doğrulama

- changedetection.io local kurulum
- repo iskeleti
- üç farklı public ürün sayfasında genel profil spike'ı
- JSON-LD/price/restock processor doğrulama
- browser fetch gerektiren sayfa doğrulaması
- SSRF ve redirect güvenlik taslağı
- versioned JSON webhook smoke test
- Telegram Bot API smoke test

## Sprint 1 — İlk Açılış ve Uçtan Uca Ürün

- Prisma/PostgreSQL
- setup status ve onboarding completedAt
- çoklu URL setup endpoint'i
- Product PENDING/ACTIVE/FAILED
- generic SiteProfileRegistry
- ChangeDetection adapter
- watch create + ilk check + 24 saat schedule
- React ürün listesi
- ilk açılış URL wizard'ı
- sonradan ürün ekleme
- Swagger contract

## Sprint 2 — Event ve Geçmiş

- webhook receiver
- idempotency
- PriceSnapshot
- StockSnapshot
- ürün detay
- fiyat grafiği
- manuel check
- retry UI
- Telegram notification outbox

## Sprint 3 — MVP Sertleştirme

- reconciliation cron
- system health
- hata normalizasyonu
- backend integration tests
- frontend tests
- responsive/accessibility
- backup
- release

## Sprint 4 — Site Profil Kataloğu

- başarısız gerçek domainler için öncelikli profiller
- profil fixture ve contract testleri
- selector/fetch edge case'leri
- dokümantasyon
- release 0.2

## Sonraki Sürümler

- beden/numara bazlı watch
- çoklu watch
- import/export
- etiketler
- ürün grupları
- PWA
- çok kullanıcı
