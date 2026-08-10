# Codex Başlangıç Talimatı

## Amaç

Bu repository'de herhangi bir değişiklik yapmadan önce ürün kararlarını ve mimari sınırları yükle; yalnız istenen sprint/görev kapsamında çalış.

## Önce Oku

1. `PROJECT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/API.md`
4. `docs/DATABASE.md`
5. `docs/WEBHOOK_CONTRACT.md`
6. `docs/ADR/ADR-0004-generic-sites-onboarding-daily-telegram.md`
7. `docs/SITE_PROFILES.md`
8. `docs/TELEGRAM.md`
9. `TEAM/EFE_TASKS.md`
10. `TEAM/HAYDAR_TASKS.md`
11. `SPRINT_BACKLOG.md`

## Kabul Edilmiş Ürün Kararları

- Sistem tek mağazaya bağlı değildir; her public HTTP/HTTPS ürün URL'si kabul edilir.
- Önce `generic` profil, gerekirse hostname'e özel sürümlü site profili kullanılır.
- Login/CAPTCHA/anti-bot aşan yeni scraping motoru yazılmaz; ayrıştırılamayan site açık hata alır.
- İlk açılışta 1..20 URL istenir. En az bir watch başarılıysa onboarding PostgreSQL'de tamamlanır.
- Onboarding browser local storage ile yönetilmez ve normal restart'ta tekrar açılmaz.
- Watch oluşturulunca ilk kontrol hemen, sonraki kontroller changedetection.io ile 24 saatte bir yapılır.
- API/application startup kontrol tetiklemez.
- changedetection.io güvenli JSON webhook'u NestJS'e yollar.
- NestJS bildirim politikasını uygular ve PostgreSQL outbox üzerinden Telegram Bot API'ye gönderir.
- Redis, BullMQ ve ayrı notification servisi yoktur.

## Çalışma Sırası

1. `SPRINT_BACKLOG.md` içinde istenen görevin sprintini ve sahibini belirle.
2. Backend işi Efe, frontend/ürün/release işi Haydar sınırında kalır.
3. Contract değişiyorsa önce veya aynı PR'da doküman ve Swagger güncellenir.
4. Küçük, review edilebilir PR'lar hazırlanır.
5. Her görev kendi acceptance criteria ve testleri tamamlanınca kapanır.

## Mevcut İskelet

Repository scaffold'ı oluşturulmuştur; tekrar scaffold üretme. Mevcut kalite kapıları henüz tamamen yeşil değildir. Bilinen lint/Vitest/Vite type eksikleri `SPRINT_BACKLOG.md` Sprint 0'a yazılmıştır; eksikleri backlog sırasıyla tamamla.

### Hedef Yapı

```text
apps/
  api/
  web/
docs/
TEAM/
.github/
```

### Backend

- NestJS
- Prisma
- PostgreSQL
- health module
- changedetection module interface
- environment validation
- Swagger
- Jest

### Frontend

- React
- Vite
- TypeScript
- React Router
- TanStack Query
- React Hook Form
- Zod
- temel AppShell
- Product list placeholder
- API client

### Root

- pnpm workspace
- root scripts
- ESLint
- Prettier
- `.editorconfig`
- `.gitignore`
- `.env.example`
- Docker Compose
- CI

## Kısıtlar

- Redis ekleme.
- BullMQ ekleme.
- Mikroservis oluşturma.
- `packages/shared` oluşturma.
- changedetection.io kodunu repository'ye kopyalama.
- Yeni scraping motoru yazma.
- İstenen sprint/görev dışındaki Product feature'larını aynı değişikliğe ekleme.
- Dokümanlarla çelişen bağımlılık ekleme.
- Sabit mağaza allowlist'i ekleme; public URL SSRF korumasını uygula.
- Telegram token/chat ID'yi veritabanına veya loglara yazma.
- Onboarding kararını local storage'a bağlama.
- Uygulama başlangıcında bütün watch'ları yeniden kontrol etme.

## Doğrulama

Çalıştır:

```bash
pnpm install
pnpm lint
pnpm type-check
pnpm test
pnpm build
docker compose config
```

## Çıktı

Sonunda şunları raporla:

1. Oluşturulan dosyalar
2. Mimari kararlar
3. Çalıştırılan komutlar
4. Test sonuçları
5. Eksik environment değerleri
6. İlgili sprint içinde kalan işler
