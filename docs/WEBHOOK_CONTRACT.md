# changedetection.io Webhook Contract

Bu dosya teknik spike sırasında gerçek Apprise JSON payload'ına göre güncellenecektir.

## Endpoint

```http
POST /api/v1/webhooks/changedetection
```

## Authentication

```http
x-webhook-secret: <secret>
```

## Önerilen Normalize Payload

```json
{
  "eventId": "string",
  "watchId": "string",
  "eventType": "PRICE_CHANGED",
  "observedAt": "2026-08-01T12:00:00Z",
  "product": {
    "name": "string",
    "url": "string",
    "imageUrl": "string"
  },
  "price": {
    "current": 1999.90,
    "previous": 2299.90,
    "currency": "TRY"
  },
  "stock": {
    "inStock": true,
    "availableSizes": []
  },
  "raw": {}
}
```

## Event Types

- PRICE_CHANGED
- STOCK_CHANGED
- RESTOCKED
- WATCH_ERROR
- WATCH_RECOVERED

## Idempotency

Tercih sırası:

1. Apprise/changedetection event ID varsa kullan.
2. Yoksa:

```text
watchId + eventType + observedAt + payloadHash
```

## Response

- 204: işlendi veya daha önce işlenmiş
- 400: payload geçersiz
- 401: secret yanlış
- 404: watch eşleşmesi yok
- 500: geçici sunucu hatası
