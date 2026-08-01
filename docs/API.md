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

## 4. Products

### GET /products

Query:

- page
- limit
- status
- store
- hasError
- search
- sort

### POST /products

```json
{
  "url": "https://example-store/product",
  "targetPrice": 1999.90,
  "notificationsEnabled": true
}
```

Response:

```json
{
  "id": "uuid",
  "status": "PENDING",
  "url": "https://example-store/product",
  "store": "STORE_CODE",
  "targetPrice": 1999.90
}
```

### GET /products/:id

Ürün bilgisi, fiyat geçmişi, stok geçmişi ve son event'leri döner.

### PATCH /products/:id

```json
{
  "targetPrice": 1799.90,
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

## 5. Webhook

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

## 6. Dashboard

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

## 7. System

### GET /system/health

- database
- changedetection
- last reconciliation
- failed product count
