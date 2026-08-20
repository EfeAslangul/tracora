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
TELEGRAM_ENABLED=true
TELEGRAM_TIMEOUT_MS=10000
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
AUTH_REQUIRE_EMAIL_VERIFIED=false
APP_BASE_URL=http://localhost:3000
WEB_BASE_URL=http://localhost:5173
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

Telegram chat kimliği artık `.env`'de değil kullanıcı kaydındadır (`PATCH /me`); tek bir
global sohbet tüm kullanıcıların bildirimlerini aynı yere düşürürdü.

API host makinede `pnpm dev` ile çalışıyorsa `CHANGEDETECTION_BASE_URL=http://localhost:5050` kullanılır. API daha sonra Compose ağına alındığında değer `http://changedetection:5000` olur. Container içi port her zaman `5000` kalır; host tarafında macOS Control Center çakışmasını önlemek için varsayılan `5050` kullanılır.

`.env` repository kökünde tutulur. Hem NestJS (`ConfigModule.forRoot({ envFilePath: ['.env', '../../.env'] })`) hem de `apps/api` içindeki Prisma script'leri bu dosyayı okur. `apps/api/.env` oluşturulursa kök dosyadan önce gelir ve yerel override olarak çalışır.

`CHANGEDETECTION_API_KEY`, changedetection.io içindeki Settings/API ekranından alınır ve yalnız yerel `.env` veya secret store'a yazılır; repository'ye commit edilmez.

Browser fetcher dışarı port açmaz. changedetection.io, `PLAYWRIGHT_DRIVER_URL=ws://browser-fetcher:3000` ile Compose ağı içinden bağlanır. Browser image çoklu mimari manifest digest'iyle sabitlenmiştir.

## Firebase Auth

Giriş Firebase Auth ile yapılır; API her istekte ID token doğrular.

1. [Firebase Console](https://console.firebase.google.com) üzerinde bir proje açılır.
2. **Authentication → Sign-in method** altında üç sağlayıcı etkinleştirilir: **Email/Password**,
   **Apple**, **Google**. Apple ile Giriş, üçüncü taraf girişi sunan iOS uygulamaları için
   App Store zorunluluğudur (5.1.1(v)).
3. **Project settings → Service accounts → Generate new private key** ile JSON indirilir.
   JSON'daki `project_id`, `client_email` ve `private_key` alanları `.env`'e yazılır.
   `private_key` tek satır olarak, `\n` kaçışları korunarak kopyalanır.
4. Web istemcisi için **Project settings → General → Your apps → Web app** kaydı açılır ve
   `apiKey`, `authDomain`, `projectId`, `appId` değerleri `VITE_FIREBASE_*` değişkenlerine yazılır.
5. iOS istemcisi eklendiğinde `GoogleService-Info.plist` aynı ekrandan alınır.

Firebase değerleri boşken API ayağa kalkar ama korumalı uçlar `AUTH_NOT_CONFIGURED` (503)
döner; sessizce korumasız kalmaz. Üretimde bu üç değişken zorunludur.

Yerel geliştirmede token almak için (`FIREBASE_WEB_API_KEY` = konsoldaki Web API key):

```bash
curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_WEB_API_KEY" -H 'content-type: application/json' -d '{"email":"test@example.com","password":"secret123","returnSecureToken":true}'
```

## Kontrol

```bash
curl http://localhost:3000/api/v1/health
curl -H "authorization: Bearer $ID_TOKEN" http://localhost:3000/api/v1/setup/status
docker compose ps
curl -H "x-api-key: $CHANGEDETECTION_API_KEY" http://localhost:5050/api/v1/watch
```

`postgres`, `browser-fetcher` ve `changedetection` servislerinin `healthy` olması beklenir. İlk image indirmesi Chromium nedeniyle birkaç dakika sürebilir.

Telegram bot token'ı yoksa ürün takibi çalışmaya devam eder; `/system/health` Telegram
durumunu `not_configured` gösterir. Kullanıcı kendi chat kimliğini `PATCH /me` ile bağlar.
Token loglara yazılmaz; chat kimliği `GET /me` yanıtında ham olarak dönmez.

`CHANGEDETECTION_WEBHOOK_URL`, changedetection container'ının erişebildiği API adresidir. Yerel Docker Desktop/Linux kurulumunda varsayılan `http://host.docker.internal:3000/api/v1/webhooks/changedetection` kullanılır. Compose Linux için `host-gateway` eşlemesini ekler.

İlk fiyat webhook ile gelmez. API içindeki baseline worker watch REST durumunu varsayılan 5 saniyelik aralıkla okur; kontrolü changedetection.io çalıştırır. Sonraki değişiklikler sürümlü webhook ile gelir.

## İlk Açılış

1. `http://localhost:5173` açılır.
2. Giriş ekranı gelir; e-posta/şifre ile kayıt olunur ya da Google ile giriş yapılır.
3. Kullanıcının `onboardingCompletedAt` alanı boşsa URL listesi ekranı gösterilir.
4. En az bir public ürün URL'si başarıyla watch'a dönüştüğünde onboarding tamamlanır.
5. Sonraki `docker compose restart`, API restart veya tarayıcı açılışında ürün listesi doğrudan gösterilir.

Onboarding kullanıcı başınadır: ikinci bir hesapla girildiğinde kurulum ekranı yeniden çıkar.

PostgreSQL ve changedetection datastore volume'larını silmek onboarding ve watch durumunu da sıfırlar. Normal restart volume'ları silmez.

## Prisma

```bash
pnpm --filter api prisma generate
pnpm --filter api prisma:validate
pnpm --filter api prisma:migrate:deploy
DATABASE_URL=postgresql://product_tracker:product_tracker@localhost:5432/product_tracker_test?schema=public pnpm --filter api test:integration
```
