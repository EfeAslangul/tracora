# Local Setup

## Gereksinimler

- Git
- Docker
- Docker Compose
- Node.js LTS
- pnpm

## Hedef Repository Yapısı

```text
apps/
  api/
  web/
docs/
TEAM/
.github/
docker-compose.yml
pnpm-workspace.yaml
package.json
```

## İlk Kurulum

```bash
git clone <repository-url>
cd product-tracker
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d
pnpm --filter api prisma generate
pnpm --filter api prisma:migrate:deploy
pnpm dev
```

## Portlar

| Servis             | Port     |
| ------------------ | -------- |
| React              | 5173     |
| NestJS             | 3000     |
| changedetection.io | 5050     |
| PostgreSQL         | 5432     |
| Browser fetcher    | internal |

## Environment

```env
DATABASE_URL=
CHANGEDETECTION_BASE_URL=http://localhost:5050
CHANGEDETECTION_API_KEY=
CHANGEDETECTION_WEBHOOK_SECRET=
CHANGEDETECTION_WEBHOOK_URL=http://host.docker.internal:3000/api/v1/webhooks/changedetection
CHANGEDETECTION_TIMEOUT_MS=10000
CHANGEDETECTION_PUBLIC_BASE_URL=http://localhost:5050
CHANGEDETECTION_HOST_PORT=5050
CHANGEDETECTION_FETCH_WORKERS=3
SOCKPUPPET_BROWSER_IMAGE=dgtlmoon/sockpuppetbrowser@sha256:7116c61ef9cfce3d48a7efd9355d2fbe19f593ea3cfb52a5ded40ecbcb0a3f9d
BROWSER_MAX_CONCURRENCY=3
CHECK_INTERVAL_SECONDS=86400
BASELINE_SYNC_INTERVAL_MS=5000
NOTIFICATION_WORKER_INTERVAL_MS=10000
URL_VALIDATION_TIMEOUT_MS=5000
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ENABLED=true
TELEGRAM_TIMEOUT_MS=10000
APP_BASE_URL=http://localhost:3000
WEB_BASE_URL=http://localhost:5173
```

API host makinede `pnpm dev` ile çalışıyorsa `CHANGEDETECTION_BASE_URL=http://localhost:5050` kullanılır. API daha sonra Compose ağına alındığında değer `http://changedetection:5000` olur. Container içi port her zaman `5000` kalır; host tarafında macOS Control Center çakışmasını önlemek için varsayılan `5050` kullanılır.

`CHANGEDETECTION_API_KEY`, changedetection.io içindeki Settings/API ekranından alınır ve yalnız yerel `.env` veya secret store'a yazılır; repository'ye commit edilmez.

Browser fetcher dışarı port açmaz. changedetection.io, `PLAYWRIGHT_DRIVER_URL=ws://browser-fetcher:3000` ile Compose ağı içinden bağlanır. Browser image çoklu mimari manifest digest'iyle sabitlenmiştir.

## Kontrol

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/setup/status
docker compose ps
curl -H "x-api-key: $CHANGEDETECTION_API_KEY" http://localhost:5050/api/v1/watch
```

`postgres`, `browser-fetcher` ve `changedetection` servislerinin `healthy` olması beklenir. İlk image indirmesi Chromium nedeniyle birkaç dakika sürebilir.

Telegram değerleri yoksa ürün takibi çalışmaya devam eder; `/system/health` Telegram durumunu `not_configured` gösterir. Token ve chat ID veritabanına veya loglara yazılmaz.

`CHANGEDETECTION_WEBHOOK_URL`, changedetection container'ının erişebildiği API adresidir. Yerel Docker Desktop/Linux kurulumunda varsayılan `http://host.docker.internal:3000/api/v1/webhooks/changedetection` kullanılır. Compose Linux için `host-gateway` eşlemesini ekler.

İlk fiyat webhook ile gelmez. API içindeki baseline worker watch REST durumunu varsayılan 5 saniyelik aralıkla okur; kontrolü changedetection.io çalıştırır. Sonraki değişiklikler sürümlü webhook ile gelir.

## İlk Açılış

1. `http://localhost:5173` açılır.
2. PostgreSQL'de onboarding kaydı yoksa URL listesi ekranı gösterilir.
3. En az bir public ürün URL'si başarıyla watch'a dönüştüğünde onboarding tamamlanır.
4. Sonraki `docker compose restart`, API restart veya tarayıcı açılışında ürün listesi doğrudan gösterilir.

PostgreSQL ve changedetection datastore volume'larını silmek onboarding ve watch durumunu da sıfırlar. Normal restart volume'ları silmez.

## Prisma

```bash
pnpm --filter api prisma generate
pnpm --filter api prisma:validate
pnpm --filter api prisma:migrate:deploy
DATABASE_URL=postgresql://product_tracker:product_tracker@localhost:5432/product_tracker_test?schema=public pnpm --filter api test:integration
```
