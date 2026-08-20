# changedetection.io Webhook Contract

changedetection.io Apprise notification template'i fiyat/stok gözlemini bu sürümlü sözleşmeyle gönderir. Olay türünü güvenilir biçimde PostgreSQL'deki önceki değerle karşılaştıran NestJS üretir.

## Endpoint ve Authentication

```http
POST /api/v1/webhooks/changedetection
x-webhook-secret: <secret>
Content-Type: application/json
```

Secret SHA-256 özetleri üzerinden sabit zamanlı karşılaştırılır. Değer loglanmaz veya response'a yazılmaz.

## Sürüm 1 Gözlem Payload'ı

```json
{
  "schemaVersion": 1,
  "eventId": "watch-uuid:notification-timestamp",
  "watchId": "watch-uuid",
  "observedAt": 1786363200.123,
  "observation": {
    "price": "1999.90",
    "currency": "TRY",
    "inStock": true
  }
}
```

- `observedAt` Unix epoch saniyesidir.
- `price` en fazla dört ondalıklı decimal string'dir.
- `currency` üç harfli büyük ISO para birimi kodudur.
- `inStock` çıkarılamıyorsa alan gönderilmeyebilir.
- Product adı ve URL webhook'tan güvenilir veri olarak alınmaz; `watchId` ile PostgreSQL kaydı kullanılır.

## Fan-out

Watch, ürünün değil **URL'nin** varlığıdır: aynı normalize URL'yi izleyen tüm kullanıcıların
ürünleri tek `Watch` satırına ve tek changedetection.io watch'ına bağlanır. Gelen bir gözlem
o watch'a bağlı **her ürüne ayrı ayrı** uygulanır.

- Tekillik ürün başınadır: `PriceSnapshot`/`StockSnapshot` için `(productId, sourceEventKey)`,
  outbox için `(productId, sourceEventKey, channel, type)`. Aynı webhook'un yeniden teslimi
  yine idempotenttir.
- Hedef fiyat, bildirim tercihi ve `PAUSED` durumu ürün alanları olduğu için karar her sahip
  için bağımsız verilir.
- Bildirim yalnız sahibinin `telegramChatId` alanı doluysa üretilir.
- Watch'ın hiç ürünü kalmamışsa `404` yerine `204` dönülür ve `ORPHANED_WATCH` olayı yazılır;
  aksi halde changedetection.io sonsuza kadar yeniden dener.

## Baseline

Pinned changedetection.io `0.49.0` ilk snapshot'ta notification üretmez. NestJS baseline worker:

1. Baseline bekleyen (ACTIVE ve fiyatı olmayan) en az bir ürünü olan watch'ları okur.
2. Watch REST durumundaki `restock.price/currency/in_stock` alanlarını normalize eder.
3. `generic/AUTO` HTTP sonucu başarısızsa watch'ı yalnız bir kez BROWSER moda geçirir.
4. Başarılı sonucu aynı observation service'e yollar.
5. Baseline snapshot kaydeder fakat outbox üretmez.

Worker startup sırasında kontrol tetiklemez; yalnız mevcut watch durumunu okur. Restart sonrası PostgreSQL durumundan devam eder.

## Idempotency ve İşleme

- `sourceEventKey`, varsa `eventId`; yoksa `watchId + observedAt + canonical observation` SHA-256 özetidir.
- Aynı key ile daha önce PriceSnapshot veya StockSnapshot varsa `204` dönülür.
- Fiyat/stok değişmediyse yalnız son başarılı kontrol zamanı güncellenir.
- İlk fiyat baseline'dır ve Telegram üretmez.
- Hedefe ulaşma normal fiyat değişikliğine üstün gelir; aynı event için tek `TARGET_REACHED` oluşur.
- Önceki stok `false`, yeni stok `true` ise `RESTOCKED` oluşur.
- Product, snapshot ve NotificationDelivery aynı PostgreSQL transaction'ında commit edilir.
- Telegram HTTP çağrısı webhook request'i içinde yapılmaz.

## Response

- `204`: işlendi veya daha önce işlenmiş
- `400`: payload/sürüm geçersiz
- `401`: secret yanlış
- `404`: watch eşleşmesi yok (sahibi kalmamış watch bu değil, `204` döner)
- `500`: geçici DB/sunucu hatası
