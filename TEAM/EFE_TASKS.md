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
    stores/
    changedetection/
    webhooks/
    settings/
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

### Zara

- Ürün JSON-LD var mı?
- Fiyat restock/price processor tarafından okunuyor mu?
- Genel stok okunuyor mu?
- Beden stokları sayfa yükünde mevcut mu?
- Browser fetch gerekli mi?
- Anti-bot problemi var mı?

### SuperStep

Aynı kontroller yapılır.

### Çıktı

`docs/SPIKE_STORE_SELECTION.md` dosyası:

- Test edilen URL'ler
- Fetch yöntemi
- Okunan alanlar
- Sorunlar
- Seçilen ilk mağaza
- Beden/numara desteğinin MVP'ye girip girmeyeceği

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

- Yalnız desteklenen hostname'ler
- URL normalize
- Fragment silme
- Tracking query parametrelerini temizleme
- Localhost/private IP engelleme
- Redirect sonrası hostname tekrar kontrolü
- HTTP/HTTPS dışında protokol kabul etmeme

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
- Store resolver
- Duplicate detection
- Product status transitions
- changedetection error mapping
- Webhook event key
- Snapshot duplicate prevention

### Integration

- Product create + watch create
- Watch create başarısızlığında FAILED
- Retry sonrası ACTIVE
- Product delete + watch delete
- Webhook price snapshot
- Duplicate webhook
- Invalid secret
- changedetection unavailable
- Reconciliation mismatch

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
- memory sınırı değerlendirmesi
- datastore backup yolu

## 16. Görünür Çıktılar

Efe'nin ana PR'ları:

1. Backend scaffold
2. Prisma schema
3. Store spike
4. ChangeDetection adapter
5. Product create state machine
6. Webhook receiver
7. Snapshot persistence
8. Swagger contract
9. Backend test suite
10. Docker backend stack

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
