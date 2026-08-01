# Codex Başlangıç Talimatı

## Amaç

Bu repository'nin teknik iskeletini dokümanlara uygun şekilde oluştur.

## Önce Oku

1. `PROJECT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/API.md`
4. `docs/DATABASE.md`
5. `TEAM/EFE_TASKS.md`
6. `TEAM/HAYDAR_TASKS.md`
7. `SPRINT_BACKLOG.md`

## İlk Görev

Yalnız Sprint 0 temel repository scaffold'ını oluştur.

### Oluşturulacak Yapı

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
- Product feature'larını henüz tam implement etme.
- Dokümanlarla çelişen bağımlılık ekleme.

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
6. Sprint 0 içinde kalan işler
