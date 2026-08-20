# Operations

Yerel/tek sunucu kurulumu için yedekleme, geri yükleme ve doğrulama adımları.

## 1. Neyin yedeklenmesi gerekir

MVP'de kalıcı durum iki ayrı yerde tutulur ve **ikisi birlikte tutarlı olmalıdır**:

| Veri                                                         | Konum                                              |
| ------------------------------------------------------------ | -------------------------------------------------- |
| Product, Store, WatchBinding, snapshot, EventLog, AppSetting | PostgreSQL (`postgres_data` volume)                |
| Watch tanımları ve 24 saatlik schedule                       | changedetection.io (`changedetection_data` volume) |

`WatchBinding.externalWatchId` yalnız changedetection.io datastore'unda var olan watch
UUID'lerine işaret eder. Bu yüzden iki taraf **birlikte** yedeklenmeli ve birlikte geri
yüklenmelidir; eşleşmeyen bir çift, her binding'i sahipsiz bırakır.

Secret'lar (`CHANGEDETECTION_API_KEY`, `CHANGEDETECTION_WEBHOOK_SECRET`,
`TELEGRAM_BOT_TOKEN`) `.env` veya secret store'dadır; yedeklere dahil edilmez ve
repository'ye commit edilmez.

## 2. Yedekleme

Tutarlılık için önce servisleri durdurun:

```bash
docker compose stop changedetection browser-fetcher
```

PostgreSQL:

```bash
docker compose exec -T postgres pg_dump -U product_tracker -Fc product_tracker > backup/product_tracker.dump
```

changedetection.io datastore volume'u:

```bash
docker run --rm -v tracora_changedetection_data:/datastore -v "$PWD/backup:/backup" alpine tar czf /backup/changedetection_datastore.tar.gz -C /datastore .
```

Servisleri geri başlatın:

```bash
docker compose start changedetection browser-fetcher
```

İki dosyayı aynı klasörde ve aynı zaman damgasıyla saklayın — geri yükleme çiftin
tutarlılığına bağlıdır.

## 3. Geri yükleme

changedetection.io datastore'unu **PostgreSQL'den önce veya onunla birlikte** geri yükleyin.

```bash
docker compose down
docker volume rm tracora_changedetection_data
docker volume create tracora_changedetection_data
docker run --rm -v tracora_changedetection_data:/datastore -v "$PWD/backup:/backup" alpine tar xzf /backup/changedetection_datastore.tar.gz -C /datastore
docker compose up -d postgres
docker compose exec -T postgres dropdb -U product_tracker --if-exists product_tracker
docker compose exec -T postgres createdb -U product_tracker product_tracker
docker compose exec -T postgres pg_restore -U product_tracker -d product_tracker < backup/product_tracker.dump
docker compose up -d
pnpm --filter api prisma:migrate:deploy
```

## 4. Geri yüklemeyi doğrulama

Yedek çiftinin tutarlı olduğunu reconciliation ile kanıtlayın. Cron 03:00'te çalışır;
beklemeden doğrulamak için `RECONCILIATION_ENABLED=true` ile API'yi başlatıp servisin
`reconcile()` metodunu tetikleyin veya cron saatini geçici olarak öne alın.

Ardından:

```bash
curl -s http://localhost:3000/api/v1/system/health | jq .lastReconciliation
```

Kabul ölçütü: `missing` ve `orphaned` **sıfır** olmalıdır.

- `missing > 0` → PostgreSQL yedeği changedetection datastore'undan yeni; watch'lar kayıp.
- `orphaned > 0` → changedetection datastore'u PostgreSQL yedeğinden yeni; sahipsiz watch var.

Her iki durumda da eşleşen bir çiftle geri yüklemeyi tekrarlayın. Ayrıntılı bulgular
`EventLog` içinde `type = RECONCILIATION` satırlarındadır (`docs/ARCHITECTURE.md` §10).

## 5. Restart davranışı

`docker compose restart` sonrası watch'lar ve 24 saatlik schedule changedetection
datastore volume'unda korunur; restart yeni bir kontrol tetiklemez. Onboarding kararı
PostgreSQL'deki `User.onboardingCompletedAt` alanında durduğu için wizard tekrar
açılmaz (ADR-0004, ADR-0005). Karar kullanıcı başınadır: yeni bir hesap kendi
onboarding'ini görür.

## 6. Çok kullanıcılı modele geçiş migration'ı

`20260818120000_firebase_auth_multi_tenancy` mevcut ürün verisini **siler**: tek kullanıcılı
MVP'de açılmış ürünler bir sahibe atanamıyordu (ADR-0005).

Migration changedetection.io tarafındaki watch'lara dokunmaz. Deploy sonrası bunlar
changedetection UI'dan (Settings → watch listesi) elle silinmelidir; aksi halde ilk
reconciliation turu hepsini `WATCH_ORPHANED` olarak raporlar ve fetcher boşuna çalışır:

```bash
curl -H "x-api-key: $CHANGEDETECTION_API_KEY" http://localhost:5050/api/v1/watch
```

Listedeki her `uuid` için:

```bash
curl -X DELETE -H "x-api-key: $CHANGEDETECTION_API_KEY" http://localhost:5050/api/v1/watch/<uuid>
```
