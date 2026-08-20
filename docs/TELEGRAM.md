# Telegram Bildirim Tasarımı

## Yapılandırma

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=
```

Bot token'ı sunucu genelidir ve yalnız environment/secret üzerinden okunur; API response,
veritabanı, exception veya log içine yazılmaz.

**Hedef sohbet kullanıcı başınadır.** Her kullanıcı kendi `telegramChatId` değerini
`PATCH /me` ile bağlar; global bir `TELEGRAM_CHAT_ID` tüm kullanıcıların bildirimlerini aynı
sohbete düşürürdü. `GET /me` yalnız `telegram.configured` boolean'ını döner, ham chat
kimliğini değil.

Token yoksa ürün takibi devam eder ve health durumu `not_configured` olur.

## Olay Politikası

Telegram outbox kaydı yalnız `Product.notificationsEnabled=true` **ve** ürün sahibinin
`telegramChatId` alanı doluyken oluşturulur. Chat kimliği olmayan kullanıcı için kalıcı
başarısız olacak bir kayıt açmanın anlamı yoktur.

Paylaşılan bir watch'tan gelen tek gözlem, ona bağlı her ürün için ayrı outbox kaydı üretir;
her sahip bildirimi kendi sohbetinde alır.

| Olay             | Kural                                                        | Mesaj                             |
| ---------------- | ------------------------------------------------------------ | --------------------------------- |
| İlk baseline     | Önceki doğrulanmış değer yok                                 | Gönderilmez                       |
| `PRICE_CHANGED`  | Yeni fiyat önceki fiyattan farklı                            | Eski/yeni fiyat ve yüzde          |
| `TARGET_REACHED` | Önceki fiyat hedefin üstünde, yeni fiyat hedefe eşit/altında | Tek birleşik hedef + fiyat mesajı |
| `RESTOCKED`      | Önceki stok false, yeni stok true                            | Ürün ve stok mesajı               |
| `WATCH_ERROR`    | Ardışık iki günlük kontrol başarısız                         | Teknik detay içermeyen uyarı      |

Aynı event hem `PRICE_CHANGED` hem `TARGET_REACHED` ise yalnız `TARGET_REACHED` teslimatı üretilir. `productId + sourceEventKey + TELEGRAM + type` unique constraint'i duplicate mesajı engeller.

## Mesaj Şablonu

```text
🎯 Hedef fiyata ulaştı
{productName}
{previousPrice} TRY → {currentPrice} TRY (%{change})
Hedef: {targetPrice} TRY
{productUrl}
```

Ürün adı ve URL Telegram parse mode'a uygun escape edilir. Mesajda internal Product ID, watch UUID, secret veya ham hata bulunmaz.

## Teslimat ve Retry

- Webhook transaction'ı yalnız outbox kaydını commit eder; Telegram HTTP çağrısını beklemez.
- Worker kısa bir cron aralığıyla kayıtları `PROCESSING` durumuna atomik alır.
- HTTP timeout 10 saniyedir.
- Geçici ağ hataları ve `5xx`: yaklaşık 1 dk, 5 dk, 30 dk, 2 saat ve 12 saat sonra denenir.
- `429`: Telegram `retry_after` değeri önceliklidir.
- `400`, `401`, `403`: kalıcı hata sayılır; teslimat tekrar denenmez ve health `degraded` olur.
- İlk teslimat denemesinden sonra en fazla 5 retry yapılır. Toplam 6 başarısız denemeden sonra kayıt `FAILED` kalır ve system health sayacına girer.
- Restart sırasında süresi geçmiş `PROCESSING` lock'ları güvenle tekrar alınır.
- Gönderim anında sahibin chat kimliği silinmişse kayıt `TELEGRAM_CHAT_NOT_CONFIGURED` ile
  kalıcı başarısız kapatılır; yeniden denenmez.

## Health

`GET /api/v1/system/health`:

- `ready`: config mevcut, son probe/teslimatlar başarılı
- `not_configured`: sunucuda token yok ya da kullanıcı kendi chat kimliğini bağlamamış
- `degraded`: kalıcı Telegram hatası veya maksimum denemeyi aşmış delivery var

Health endpoint Telegram token veya chat kimliği döndürmez.
