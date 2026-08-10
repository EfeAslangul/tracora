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
pnpm install
docker compose up -d
pnpm dev
```

## Portlar

| Servis             | Port     |
| ------------------ | -------- |
| React              | 5173     |
| NestJS             | 3000     |
| changedetection.io | 5000     |
| PostgreSQL         | 5432     |
| Browser fetcher    | internal |

## Environment

```env
DATABASE_URL=
CHANGEDETECTION_BASE_URL=http://changedetection:5000
CHANGEDETECTION_API_KEY=
CHANGEDETECTION_WEBHOOK_SECRET=
CHECK_INTERVAL_SECONDS=86400
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ENABLED=true
APP_BASE_URL=http://localhost:3000
WEB_BASE_URL=http://localhost:5173
```

## Kontrol

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/setup/status
```

Telegram değerleri yoksa ürün takibi çalışmaya devam eder; `/system/health` Telegram durumunu `not_configured` gösterir. Token ve chat ID veritabanına veya loglara yazılmaz.

## İlk Açılış

1. `http://localhost:5173` açılır.
2. PostgreSQL'de onboarding kaydı yoksa URL listesi ekranı gösterilir.
3. En az bir public ürün URL'si başarıyla watch'a dönüştüğünde onboarding tamamlanır.
4. Sonraki `docker compose restart`, API restart veya tarayıcı açılışında ürün listesi doğrudan gösterilir.

PostgreSQL ve changedetection datastore volume'larını silmek onboarding ve watch durumunu da sıfırlar. Normal restart volume'ları silmez.

## Prisma

```bash
pnpm --filter api prisma migrate dev
pnpm --filter api prisma db seed
```
