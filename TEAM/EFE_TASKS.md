# Efe — Backend Lead

## 1. Rol Tanımı

Efe projenin backend mimarisinin sahibidir.

Bu rol yalnızca endpoint yazmak değildir. Efe:

- Teknik backend kararlarını önerir.
- API contract'ı oluşturur.
- Veritabanı modelini tasarlar.
- changedetection.io entegrasyonunu geliştirir.
- Webhook güvenliğini sağlar.
- Backend kalite standardını belirler.
- Backend testlerini kurar.
- Docker backend servislerini hazırlar.
- Backend bölümünü demoda anlatır.

## 2. Teknolojiler

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Swagger/OpenAPI
- Jest
- Docker
- changedetection.io REST API
- Apprise JSON webhook

MVP'de Redis ve BullMQ kullanılmaz.

## 3. Modül Yapısı

```text
src/
  modules/
    products/
    sites/
    changedetection/
    webhooks/
    settings/
    notifications/
    system/
    health/
  common/
    errors/
    filters/
    guards/
    logging/
    validation/
```

## 4. İlk Teknik Spike

Kodlamaya başlamadan önce:

Tek mağaza seçmek yerine üç temsili public ürün sayfası test edilir:

1. Standart JSON-LD `Product/Offer` sunan statik sayfa
2. CSS/XPath profili gerektiren sayfa
3. Browser fetch gerektiren JavaScript sayfası

Her örnekte fiyat, para birimi, genel stok, redirect, fetch modu ve anti-bot davranışı kaydedilir.

### Çıktı

`docs/SPIKE_GENERIC_SITE_SUPPORT.md` dosyası:

- Test edilen URL'ler
- Fetch yöntemi
- Okunan alanlar
- Sorunlar
- Genel profilin başarı/başarısızlık sınırları
- Özel site profili ekleme şablonu
- Fixture ve contract test sonuçları

## 5. Product Domain

Durumlar:

```text
PENDING
ACTIVE
PAUSED
FAILED
```

Product davranışları:

- oluştur
- güncelle
- yeniden dene
- duraklat
- devam ettir
- hedef fiyat değiştir
- manuel kontrol
- sil

## 6. İlk Endpoint'ler

```http
GET    /api/v1/health
GET    /api/v1/setup/status
POST   /api/v1/setup
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/products/:id
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id
POST   /api/v1/products/:id/check
POST   /api/v1/products/:id/retry
POST   /api/v1/webhooks/changedetection
GET    /api/v1/dashboard
GET    /api/v1/system/health
```

## 7. ChangeDetection Adapter

```ts
export interface ChangeDetectionClient {
  createWatch(input: CreateWatchInput): Promise<CreatedWatch>;
  updateWatch(id: string, input: UpdateWatchInput): Promise<void>;
  deleteWatch(id: string): Promise<void>;
  triggerCheck(id: string): Promise<void>;
  getWatch(id: string): Promise<WatchSnapshot>;
  listWatches(): Promise<WatchSummary[]>;
}
```

Kurallar:

- API key environment'tan alınır.
- Timeout vardır.
- Retry yalnız güvenli operasyonlarda sınırlıdır.
- API hataları domain hata kodlarına çevrilir.
- External UUID frontend contract'ına sızdırılmaz.
- Adapter integration test ile doğrulanır.

## 8. Webhook Receiver

Endpoint:

```http
POST /api/v1/webhooks/changedetection
```

Zorunluluklar:

- Shared secret doğrulama
- Payload validation
- Event idempotency
- Duplicate snapshot koruması
- Request ID
- Structured log
- Hatalı payload için 4xx
- Geçici DB hatası için uygun 5xx

Webhook payload formatı `docs/WEBHOOK_CONTRACT.md` içinde tanımlanmalıdır.

## 9. URL Güvenliği

- Herkese açık HTTP/HTTPS hostname'ler
- URL normalize
- Fragment silme
- Tracking query parametrelerini temizleme
- DNS rebinding'e karşı çözülmüş tüm IP'lerde localhost/private/link-local/reserved ağ engeli
- Her redirect sonrası URL ve çözülmüş IP kontrolü
- HTTP/HTTPS dışında protokol kabul etmeme
- Credential içeren URL'leri kabul etmeme
- Port allowlist (`80`, `443`) ve istek timeout/response size sınırı

Unique constraint:

```text
(storeId, normalizedUrl)
```

## 10. Veritabanı

MVP tabloları:

- Store
- Product
- WatchBinding
- PriceSnapshot
- StockSnapshot
- EventLog
- AppSetting

Notlar:

- WatchBinding başlangıçta Product ile 1:1 olabilir.
- Beden spike'ı 1:N ihtiyacı gösterirse model ADR ile değiştirilir.
- Soft delete MVP'de yoktur.
- EventLog yalnız hata ve önemli durum değişimlerini tutar.
- Her kontrol için log satırı oluşturulmaz.

## 11. Idempotency

### Product Create

- Normalize URL unique constraint
- `PENDING → ACTIVE/FAILED`
- Aynı request iki kez gelirse ikinci Product oluşmaz

### Webhook

Aşağıdaki kombinasyonlardan uygun olanı event key olarak kullan:

```text
externalWatchId + observedAt + eventType + payloadHash
```

Unique constraint veya idempotency table ile tekrar işleme engellenir.

## 12. Error Model

Minimum hata kodları:

- STORE_NOT_SUPPORTED
- INVALID_PRODUCT_URL
- PRODUCT_ALREADY_EXISTS
- PRODUCT_NOT_FOUND
- CHANGEDETECTION_UNAVAILABLE
- WATCH_CREATE_FAILED
- WATCH_NOT_FOUND
- CHECK_ALREADY_RUNNING
- INVALID_WEBHOOK_SECRET
- INVALID_WEBHOOK_PAYLOAD
- RATE_LIMITED
- UNSAFE_PRODUCT_URL
- SETUP_ALREADY_COMPLETED
- SETUP_HAS_NO_SUCCESSFUL_PRODUCT
- EXTRACTION_UNSUPPORTED
- TELEGRAM_NOT_CONFIGURED

## 13. Swagger

Her endpoint için:

- Request DTO
- Response DTO
- Error response
- Status code
- Örnek payload
- Açıklama

Swagger backend contract'ın resmi kaynağıdır.

## 14. Testler

### Unit

- URL normalization
- Site profile resolver ve generic fallback
- Duplicate detection
- Product status transitions
- changedetection error mapping
- Webhook event key
- Snapshot duplicate prevention

### Integration

- setup status ilk açılış
- partial-success çoklu URL setup
- başarılı setup sonrası restart simülasyonu
- Product create + watch create
- Watch create başarısızlığında FAILED
- Retry sonrası ACTIVE
- Product delete + watch delete
- Webhook price snapshot
- Duplicate webhook
- Invalid secret
- changedetection unavailable
- Reconciliation mismatch
- 24 saat schedule oluşturma ve restart'ta duplicate check olmaması
- Telegram outbox duplicate prevention ve retry
- private IP, DNS/redirect SSRF engeli

## 15. Docker

Efe'nin sahip olduğu servisler:

- api
- postgres
- changedetection
- browser fetcher

Zorunluluklar:

- sabit changedetection.io version
- health check
- restart policy
- volume
- environment örneği
- PostgreSQL ve changedetection kalıcı volume'ları
- Telegram secret environment değerleri
- memory sınırı değerlendirmesi
- datastore backup yolu

## 16. Görünür Çıktılar

Efe'nin ana PR'ları:

1. Backend scaffold
2. Prisma schema
3. Generic site spike + SiteProfileRegistry
4. URL/SSRF güvenliği
5. ChangeDetection adapter + 24 saat schedule
6. Setup API + Product create state machine
7. Webhook receiver + snapshot persistence
8. Telegram gateway + notification outbox
9. Swagger contract
10. Backend test suite ve Docker backend stack

## 17. Codex Talimatı

```text
PROJECT.md, docs/ARCHITECTURE.md, docs/API.md, docs/DATABASE.md ve TEAM/EFE_TASKS.md dosyalarını oku.

Efe backend lead'dir.
MVP'de Redis veya BullMQ ekleme.
changedetection.io çekirdeğini değiştirme.
Yeni scraping motoru yazma.
Controller içinde business logic bırakma.
Prisma üzerine gereksiz repository abstraction kurma.
External API erişimini ChangeDetectionClient adapter'ında tut.
Webhook işlemlerini idempotent tasarla.
İşleri küçük PR'lara böl.
Her değişiklikten sonra lint, type-check, test ve build çalıştır.
API değişikliğinde Swagger ve docs/API.md güncelle.
Teknik karar gerektiğinde ADR taslağı oluştur.
```
