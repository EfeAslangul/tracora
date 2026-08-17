# REST API Contract

Base URL:

```text
/api/v1
```

Backend contract owner: Efe  
Frontend consumer: Haydar

## 1. Ortak Hata

```json
{
  "code": "INVALID_PRODUCT_URL",
  "message": "Ürün bağlantısı geçerli değil.",
  "details": {},
  "requestId": "req_01"
}
```

### Request ID

Her istek bir `x-request-id` taşır. İstemci başlık göndermezse sunucu üretir; gönderirse
değer yalnız `[A-Za-z0-9._-]` karakterlerine indirgenip 100 karaktere kırpılarak kullanılır
(başlık enjeksiyonuna karşı). Değer her yanıtta `x-request-id` başlığıyla döner ve hata
gövdesindeki `requestId` alanıyla aynıdır.

Sunucu tarafında her istek tek satırlık yapılandırılmış bir log üretir:

```json
{
  "event": "http_request",
  "requestId": "req-1",
  "method": "GET",
  "route": "/api/v1/products/:id",
  "status": 404,
  "durationMs": 6
}
```

`route` ham URL değil eşleşen rota kalıbıdır; ürün id'si, query değerleri, başlıklar ve
gövdeler loglanmaz.

## 2. Product Status

```text
PENDING
ACTIVE
PAUSED
FAILED
```

`ACTIVE`, watch'ın başarıyla oluşturulduğunu belirtir. İlk kontrol tamamlanana kadar fiyat alanları `null` olabilir.

## 3. Health

### GET /health

```json
{
  "status": "ok",
  "services": {
    "database": "up",
    "changedetection": "up"
  },
  "version": "0.1.0"
}
```

## 4. İlk Kurulum

### GET /setup/status

Frontend her açılışta bu endpoint'i çağırır.

```json
{
  "required": true,
  "completedAt": null,
  "defaultCheckIntervalSeconds": 86400,
  "telegram": {
    "configured": true,
    "status": "ready"
  }
}
```

`required=false` ise frontend onboarding göstermeden ürün listesine gider.

### POST /setup

İlk açılışta 1 ile 20 URL'yi normal Product create servisi üzerinden oluşturur.

```json
{
  "products": [
    {
      "url": "https://shop.example/product-a",
      "targetPrice": 1999.9,
      "notificationsEnabled": true
    },
    {
      "url": "https://other.example/product-b",
      "notificationsEnabled": true
    }
  ]
}
```

Response `201 Created`:

```json
{
  "completed": true,
  "completedAt": "2026-08-04T12:00:00Z",
  "created": [{ "id": "uuid", "url": "https://shop.example/product-a", "status": "ACTIVE" }],
  "failed": [
    {
      "url": "https://other.example/product-b",
      "code": "WATCH_CREATE_FAILED",
      "message": "Takip başlatılamadı."
    }
  ]
}
```

- Sonuçlar URL bazında döner; dış servis çağrıları nedeniyle bütün batch için distributed transaction kullanılmaz.
- En az bir watch oluşturulduysa setup tamamlanır.
- Hiçbiri oluşturulamazsa `422` döner ve setup tamamlanmaz.
- Daha önce tamamlanmış setup isteği `409 SETUP_ALREADY_COMPLETED` döner. Yeni ürünler `POST /products` ile eklenir.

## 5. Products

### GET /products

Query:

- page
- limit
- status
- hostname
- hasError
- search
- sort

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Örnek ürün",
      "url": "https://shop.example/product",
      "hostname": "shop.example",
      "profile": "generic",
      "status": "ACTIVE",
      "currentPrice": 1999.9,
      "previousPrice": 2299.9,
      "currency": "TRY",
      "targetPrice": 1799.9,
      "inStock": true,
      "notificationsEnabled": true,
      "lastCheckedAt": "2026-08-10T12:00:00Z",
      "lastSuccessfulCheckAt": "2026-08-10T12:00:00Z",
      "lastError": null
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### POST /products

```json
{
  "url": "https://example-store/product",
  "targetPrice": 1999.9,
  "notificationsEnabled": true
}
```

Response:

```json
{
  "id": "uuid",
  "status": "ACTIVE",
  "url": "https://example-store/product",
  "hostname": "example-store",
  "profile": "generic",
  "targetPrice": 1999.9
}
```

Watch create ve initial check kabul edilmeden `201` dönülmez. Watch create başarısızsa Product `FAILED` tutulur ve domain hata cevabı döner. İlk fiyat changedetection.io REST durumundan baseline worker ile alınır; sonraki değişiklikler webhook ile gelir. Aynı FAILED URL yeniden gönderildiğinde yeni Product oluşturulmadan mevcut kayıt/binding güvenli biçimde tekrar denenir.

### GET /products/:id

Ürün bilgisi, fiyat geçmişi, stok geçmişi ve son event'leri döner. Geçmiş dizileri
eskiden yeniye sıralıdır (grafik için); `recentEvents` yeniden eskiye sıralıdır.
Sınırlar sabittir: 100 fiyat, 50 stok, 20 event.

```json
{
  "id": "uuid",
  "name": "Example product",
  "url": "https://shop.example/product",
  "hostname": "shop.example",
  "profile": "generic",
  "status": "ACTIVE",
  "currentPrice": 1999.9,
  "previousPrice": 2299.9,
  "currency": "TRY",
  "targetPrice": 1799.9,
  "inStock": true,
  "notificationsEnabled": true,
  "lastCheckedAt": "2026-08-10T12:00:00Z",
  "lastSuccessfulCheckAt": "2026-08-10T12:00:00Z",
  "lastError": null,
  "watchId": "watch-uuid",
  "fetchMode": "HTTP",
  "priceHistory": [{ "price": 2299.9, "currency": "TRY", "observedAt": "2026-08-09T12:00:00Z" }],
  "stockHistory": [{ "inStock": true, "observedAt": "2026-08-09T12:00:00Z" }],
  "recentEvents": [
    {
      "type": "EXTRACTION_ERROR",
      "code": "EXTRACTION_UNSUPPORTED",
      "message": "Genel profil bu ürün sayfasından fiyat çıkaramadı.",
      "createdAt": "2026-08-09T12:00:00Z"
    }
  ]
}
```

Bilinmeyen id `404 PRODUCT_NOT_FOUND`, geçersiz UUID `400 INVALID_REQUEST` döner.

### PATCH /products/:id

```json
{
  "targetPrice": 1799.9,
  "notificationsEnabled": true,
  "status": "PAUSED"
}
```

Üç alan da opsiyoneldir, en az biri gönderilmelidir; boş gövde `400 INVALID_REQUEST` döner.
`targetPrice: null` hedef fiyatı temizler. `status` yalnız `ACTIVE` veya `PAUSED` olabilir;
`PENDING` ve `FAILED` yalnız sistem tarafından atanır.

`PAUSED` yalnız yerel bir alan değildir: webhook her gözlemde ürünü `ACTIVE`'e çektiği için
duraklatma önce changedetection.io watch'ında uygulanır, ancak başarılı olursa yerel durum
yazılır. Uzak çağrı başarısızsa `502 CHANGEDETECTION_UNAVAILABLE` döner ve yerel durum değişmez.

Response `GET /products` ile aynı ürün gövdesidir.

### DELETE /products/:id

Watch ve Product kaydını siler. MVP'de soft delete yoktur.

Önce changedetection.io watch'ı silinir, sonra veritabanı kaydı. Uzak watch zaten yoksa
(`WATCH_NOT_FOUND`) silme başarılı sayılır; başka bir uzak hata `502` döner ve veritabanı
kaydı **silinmez** — aksi halde sahipsiz bir watch webhook üretmeye devam ederdi.
Product silinince WatchBinding, snapshot'lar, EventLog ve NotificationDelivery cascade ile düşer.

```text
204 No Content
```

### POST /products/:id/check

Manuel changedetection.io check tetikler. Sonuç asenkron olarak webhook ile gelir.

```json
{ "accepted": true, "triggeredAt": "2026-08-10T12:00:00Z" }
```

`202 Accepted` döner. Ürün başına bir soğuma penceresi vardır (`MANUAL_CHECK_COOLDOWN_MS`,
varsayılan 60 sn); pencere dolmadan gelen ikinci istek `409 CHECK_ALREADY_RUNNING` döner.
Pencere `WatchBinding.lastSyncAt` üzerinde tek bir atomik `UPDATE ... WHERE` ile talep edilir,
bu yüzden eşzamanlı iki istek ikisi birden kazanamaz.

Duraklatılmış ürün `409 PRODUCT_PAUSED`, watch'ı olmayan ürün `404 WATCH_NOT_FOUND` döner.
Tetikleme hatası ürünü `FAILED` yapmaz; geçici hata olarak `502` döner.

### POST /products/:id/retry

FAILED ürün için watch oluşturmayı tekrar dener. Yalnız `FAILED` durumunda çalışır;
diğer durumlarda `409 PRODUCT_NOT_RETRYABLE` döner.

Ürün önce `PENDING`'e alınır. Mevcut bir WatchBinding varsa yalnız yeni bir check tetiklenir;
yoksa watch sıfırdan oluşturulur. `normalizedUrl` daha önce doğrulandığı için URL güvenlik
doğrulaması tekrarlanmaz — aksi halde geçici bir DNS hatası `UNSAFE_PRODUCT_URL`'e dönüşürdü.

Response `GET /products` ile aynı ürün gövdesidir.

## 6. Webhook

### POST /webhooks/changedetection

Header:

```text
x-webhook-secret
```

Payload fiyat/stok olayı değil gözlemi taşır. `PRICE_CHANGED`, `TARGET_REACHED` ve `RESTOCKED` kararlarını NestJS mevcut snapshot ile karşılaştırarak üretir. Ayrıntılı sözleşme `docs/WEBHOOK_CONTRACT.md` içindedir.

Başarılı response:

```text
204 No Content
```

## 7. Dashboard

### GET /dashboard

```json
{
  "totalProducts": 8,
  "activeProducts": 6,
  "failedProducts": 1,
  "recentPriceDrops": [
    {
      "id": "uuid",
      "name": "Example product",
      "url": "https://shop.example/product",
      "hostname": "shop.example",
      "currency": "TRY",
      "previousPrice": 2299.9,
      "currentPrice": 1999.9,
      "dropAmount": 300,
      "dropPercent": 13.04,
      "observedAt": "2026-08-10T12:00:00Z"
    }
  ]
}
```

`recentPriceDrops`, `currentPrice < previousPrice` olan ürünlerden son başarılı kontrol
zamanına göre en yeni 5 kayıttır.

## 8. System

### GET /system/health

```json
{
  "status": "ok",
  "services": { "database": "up", "changedetection": "up", "telegram": "ready" },
  "outbox": { "pending": 0, "permanentlyFailed": 0 },
  "failedProducts": 1,
  "checkIntervalSeconds": 86400,
  "lastReconciliation": {
    "completedAt": "2026-08-10T03:00:00Z",
    "checked": 8,
    "missing": 0,
    "orphaned": 0,
    "drifted": 0,
    "watchErrors": 0
  }
}
```

`telegram` değerleri `ready`, `not_configured`, `degraded`. `lastReconciliation` günlük
reconciliation cron'u ilk kez çalışana kadar `null` döner.

## 9. Minimum Hata Kodları

- `INVALID_PRODUCT_URL`
- `UNSAFE_PRODUCT_URL`
- `PRODUCT_ALREADY_EXISTS`
- `PRODUCT_NOT_FOUND`
- `SETUP_ALREADY_COMPLETED`
- `SETUP_HAS_NO_SUCCESSFUL_PRODUCT`
- `EXTRACTION_UNSUPPORTED`
- `CHANGEDETECTION_UNAVAILABLE`
- `WATCH_CREATE_FAILED`
- `WATCH_NOT_FOUND`
- `CHECK_ALREADY_RUNNING` (manuel kontrol soğuma penceresi dolmadı)
- `PRODUCT_PAUSED`
- `PRODUCT_NOT_RETRYABLE`
- `INVALID_WEBHOOK_SECRET`
- `INVALID_WEBHOOK_PAYLOAD`
- `TELEGRAM_NOT_CONFIGURED`
- `RATE_LIMITED` (uygulama kısıtı: `POST /products/:id/check` için 60 sn'de 10 istek; ayrıca changedetection.io/Telegram 429'ları)
