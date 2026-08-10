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

Watch create tamamlanmadan `201` dönülmez. Watch create başarısızsa Product `FAILED` tutulur ve domain hata cevabı döner. Watch oluşturulduktan sonra ilk kontrol tetiklenir; fiyat bilgisi daha sonra webhook ile gelebilir.

### GET /products/:id

Ürün bilgisi, fiyat geçmişi, stok geçmişi ve son event'leri döner.

### PATCH /products/:id

```json
{
  "targetPrice": 1799.9,
  "notificationsEnabled": true,
  "status": "PAUSED"
}
```

### DELETE /products/:id

Watch ve Product kaydını siler. MVP'de soft delete yoktur.

### POST /products/:id/check

Manuel changedetection.io check tetikler.

### POST /products/:id/retry

FAILED ürün için watch oluşturmayı tekrar dener.

## 6. Webhook

### POST /webhooks/changedetection

Header:

```text
x-webhook-secret
```

Payload sözleşmesi `docs/WEBHOOK_CONTRACT.md` içinde tanımlanacaktır.

Başarılı response:

```text
204 No Content
```

## 7. Dashboard

### GET /dashboard

MVP sonunda:

```json
{
  "totalProducts": 8,
  "activeProducts": 6,
  "failedProducts": 1,
  "recentPriceDrops": []
}
```

## 8. System

### GET /system/health

- database
- changedetection
- telegram (`ready`, `not_configured`, `degraded`)
- pending notification count
- last reconciliation
- failed product count

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
- `CHECK_ALREADY_RUNNING`
- `INVALID_WEBHOOK_SECRET`
- `INVALID_WEBHOOK_PAYLOAD`
- `TELEGRAM_NOT_CONFIGURED`
- `RATE_LIMITED`
