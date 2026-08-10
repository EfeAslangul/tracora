# changedetection.io Webhook Contract

changedetection.io notification template'i bu sürümlü uygulama sözleşmesini üretir. Ham Apprise payload'ı doğrudan domain katmanına taşınmaz.

## Endpoint

```http
POST /api/v1/webhooks/changedetection
```

## Authentication

```http
x-webhook-secret: <secret>
```

## Sürüm 1 Normalize Payload

```json
{
  "schemaVersion": 1,
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
    "current": 1999.9,
    "previous": 2299.9,
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

`sourceEventKey`, normalize edilen event ID'den üretilir ve snapshot ile notification outbox'ta aynı işlem boyunca kullanılır.

## İşleme Kuralları

- Bilinmeyen `schemaVersion` için `400 INVALID_WEBHOOK_PAYLOAD` dönülür.
- `watchId` aktif bir `WatchBinding` ile eşleşmelidir.
- İlk başarılı fiyat gözlemi baseline olarak kaydedilir; fiyat değişimi bildirimi üretmez.
- Aynı fiyat tekrar geldiyse duplicate `PriceSnapshot` ve Telegram bildirimi üretilmez.
- `notificationsEnabled=false` ise snapshot kaydedilir fakat outbox kaydı oluşturulmaz.
- Önceki fiyat hedefin üzerindeyken yeni fiyat hedefe eşit veya altına indiyse `TARGET_REACHED` üretilir.
- Aynı event hem hedefe ulaşma hem fiyat değişimi ise tek, birleşik `TARGET_REACHED` mesajı gönderilir.
- `RESTOCKED`, önceki stok `false` ve yeni stok `true` olduğunda üretilir.
- Webhook transaction'ı snapshot ve outbox insert'ini birlikte commit eder; Telegram HTTP çağrısı request içinde yapılmaz.

## Response

- 204: işlendi veya daha önce işlenmiş
- 400: payload geçersiz
- 401: secret yanlış
- 404: watch eşleşmesi yok
- 500: geçici sunucu hatası

`204`, Telegram mesajının gönderildiği değil event'in kalıcı olarak kabul edildiği anlamına gelir.
