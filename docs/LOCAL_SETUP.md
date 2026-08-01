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

| Servis | Port |
|---|---|
| React | 5173 |
| NestJS | 3000 |
| changedetection.io | 5000 |
| PostgreSQL | 5432 |
| Browser fetcher | internal |

## Environment

```env
DATABASE_URL=
CHANGEDETECTION_BASE_URL=http://changedetection:5000
CHANGEDETECTION_API_KEY=
CHANGEDETECTION_WEBHOOK_SECRET=
APP_BASE_URL=http://localhost:3000
WEB_BASE_URL=http://localhost:5173
```

## Kontrol

```bash
curl http://localhost:3000/api/v1/health
```

## Prisma

```bash
pnpm --filter api prisma migrate dev
pnpm --filter api prisma db seed
```
