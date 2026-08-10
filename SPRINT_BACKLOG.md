# Sprint Backlog

Görevler bağımlılık sırasına göre yazılmıştır. Her PR lint, type-check, test ve build'den geçer; API değişiklikleri Swagger ve `docs/API.md` ile aynı PR'da güncellenir.

## Sprint 0 — Genel Site Spike ve Temel

### Efe

- [ ] changedetection.io ve browser fetcher Docker health/volume doğrulaması
- [ ] REST API erişimi ve sabit image version
- [ ] versioned Apprise JSON webhook smoke test
- [ ] üç temsili public ürün sayfasında generic/static/browser spike
- [ ] `docs/SPIKE_GENERIC_SITE_SUPPORT.md` raporu
- [ ] Telegram Bot API smoke test
- [ ] NestJS environment validation eksiklerini tamamlama
- [ ] Prisma/PostgreSQL scaffold doğrulama
- [ ] API lint scriptinde bulunmayan `test/**/*.ts` glob davranışını düzeltme

### Haydar

- [ ] GitHub repository, collaborator ve main protection
- [ ] GitHub Project ve milestone'lar
- [ ] React/Vite scaffold doğrulama
- [ ] AppShell ve merkezi API client
- [ ] Product list mock durumları
- [ ] generic site spike acceptance criteria
- [ ] ilk açılış wizard wireflow'u
- [ ] Telegram mesaj metni ve acceptance örnekleri
- [ ] Vitest globals/setup ve `vite/client` type yapılandırmasını düzeltme
- [ ] Web type-check, test ve build kalite kapılarını yeşile getirme

### Ortak Çıkış Kriteri

- [ ] Genel profilin destek sınırı ve yeni site profili şablonu belgeli
- [ ] Docker restart sonrası datastore volume'unda watch korunuyor
- [ ] Webhook ve Telegram smoke test kanıtı mevcut

## Sprint 1 — Onboarding ve Uçtan Uca Product

### Efe

- [ ] Store/Product/WatchBinding/AppSetting Prisma migration
- [ ] `SiteProfileRegistry` ve `generic` profil
- [ ] public URL normalizasyonu ve SSRF/redirect koruması
- [ ] duplicate constraint
- [ ] Product `PENDING → ACTIVE/FAILED` state machine
- [ ] `ChangeDetectionClient` adapter
- [ ] watch create + immediate initial check + `86400` saniye schedule
- [ ] `GET /setup/status`
- [ ] partial-success `POST /setup`
- [ ] setup completedAt kalıcılığı
- [ ] Swagger product/setup contract ve integration testleri

### Haydar

- [ ] setup status route guard
- [ ] 1..20 URL ilk açılış formu
- [ ] URL bazlı target price ve notification tercihi
- [ ] partial success sonuç ekranı
- [ ] başarı sonrası ürün listesine yönlendirme
- [ ] restart/yeniden açılışta wizard göstermeme testi
- [ ] Product list/card ve sonradan ürün ekleme formu
- [ ] loading/empty/error/responsive durumları
- [ ] mock API'den gerçek API'ye geçiş

### Ortak Çıkış Kriteri

- [ ] Temiz volume ile wizard açılıyor
- [ ] En az bir ürün başarıyla eklenince wizard kapanıyor
- [ ] API/web/container restart sonrasında wizard tekrar açılmıyor
- [ ] Watch ilk kontrolü yapıyor ve devamı 24 saate ayarlanıyor

## Sprint 2 — Webhook, Geçmiş ve Telegram

### Efe

- [ ] versioned webhook DTO, secret ve idempotency
- [ ] PriceSnapshot ve StockSnapshot migration/işleme
- [ ] NotificationDelivery outbox migration
- [ ] Telegram gateway ve secret validation
- [ ] birleşik `TARGET_REACHED`, `PRICE_CHANGED`, `RESTOCKED` politikası
- [ ] notification worker, maksimum 5 retry ve artan gecikme
- [ ] manual check ve retry endpoint'leri
- [ ] duplicate webhook/snapshot/message integration testleri
- [ ] Telegram unavailable/recovery integration testleri

### Haydar

- [ ] Product detail ve fiyat grafiği
- [ ] stok ve son kontrol durumu
- [ ] manual check ve FAILED retry UI
- [ ] hata kodu kullanıcı mesajları
- [ ] Telegram ready/not_configured/degraded göstergesi
- [ ] hedef fiyat ve notification tercih UX'i
- [ ] mobil/klavye erişilebilirlik kontrolü

### Ortak Çıkış Kriteri

- [ ] İlk baseline Telegram mesajı üretmiyor
- [ ] Aynı webhook ikinci snapshot veya mesaj üretmiyor
- [ ] Hedef fiyat olayında tek birleşik mesaj gidiyor
- [ ] Telegram geçici hatası outbox'tan tekrar deneniyor

## Sprint 3 — MVP Sertleştirme ve Release

### Efe

- [ ] daily reconciliation cron ve 24 saat schedule drift raporu
- [ ] system health API: database/changedetection/telegram/outbox
- [ ] structured logging ve request ID
- [ ] Docker health checks/restart policy
- [ ] PostgreSQL ve changedetection datastore backup/restore dokümanı
- [ ] backend test suite ve demo

### Haydar

- [ ] system health göstergesi
- [ ] responsive ve accessibility pass
- [ ] frontend test suite
- [ ] onboarding/product/Telegram uçtan uca acceptance
- [ ] README, changelog ve release notları
- [ ] MVP release tag

### Ortak Çıkış Kriteri

- [ ] `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` başarılı
- [ ] `docker compose config` ve temiz kurulum başarılı
- [ ] Restart/backup/restore kabul senaryoları başarılı

## Sprint 4 — Site Profil Kataloğu

### Efe

- [ ] Üretimde `EXTRACTION_UNSUPPORTED` olan domainleri EventLog ile raporlama
- [ ] Öncelikli domainler için sürümlü profile + fixture + contract test
- [ ] Profil regresyon testleri ve selector hata normalizasyonu

### Haydar

- [ ] Profil destek durumu ve retry kullanıcı deneyimi
- [ ] Yeni domain profil önceliklendirme/backlog süreci
- [ ] Profil kabul testleri ve sürüm notları
