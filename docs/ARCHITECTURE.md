# Sistem Mimarisi

## 1. Sahiplik

| Alan | Sahip |
|---|---|
| Backend architecture | Efe |
| changedetection.io entegrasyonu | Efe |
| Database | Efe |
| Docker backend stack | Efe |
| Frontend | Haydar |
| Product scope | Haydar |
| GitHub ve release | Haydar |
| Mimari kararlar | Ortak |

## 2. Genel Diyagram

```mermaid
flowchart TB
    User[Kullanıcı]
    Web[React]
    API[NestJS]
    DB[(PostgreSQL)]
    CD[changedetection.io]
    Browser[Browser Fetcher]
    Store[Mağaza]
    Telegram[Telegram / Apprise]
    Webhook[Webhook Receiver]

    User --> Web
    Web --> API
    API --> DB
    API --> CD
    CD --> Browser
    Browser --> Store
    CD --> Telegram
    CD --> Webhook
    Webhook --> DB
```

## 3. Neden NestJS?

changedetection.io teknik `watch UUID` modeliyle çalışır. Uygulamamız ise Product, Store, hedef fiyat ve snapshot modeliyle çalışır.

NestJS:

- domain dönüşümü
- güvenlik
- validation
- adapter
- persistence
- stable API contract

sağlar.

## 4. Neden PostgreSQL?

changedetection.io datastore'u uygulama dashboard'u ve sayısal zaman serisi için uygun domain veritabanı değildir.

PostgreSQL:

- ürünler
- tercihler
- temiz fiyat geçmişi
- temiz stok geçmişi
- watch eşleşmeleri
- hata/durum olayları

için kullanılır.

## 5. Neden Redis/BullMQ Yok?

MVP'de:

- schedule changedetection.io'da
- fetch worker changedetection.io'da
- retry changedetection.io'da
- event delivery webhook ile

olduğu için ayrı queue sistemi gereksizdir.

## 6. Product Create Sequence

```mermaid
sequenceDiagram
    actor U as Kullanıcı
    participant W as React
    participant A as NestJS
    participant D as PostgreSQL
    participant C as changedetection.io

    U->>W: Ürün URL'si
    W->>A: POST /products
    A->>A: Validate + Normalize
    A->>D: Product PENDING
    A->>C: Create Watch
    alt başarılı
        C-->>A: Watch UUID
        A->>D: WatchBinding + ACTIVE
        A-->>W: 201 Product
    else başarısız
        A->>D: Product FAILED
        A-->>W: 502/Domain Error
    end
```

## 7. Webhook Sequence

```mermaid
sequenceDiagram
    participant C as changedetection.io
    participant A as NestJS Webhook
    participant D as PostgreSQL

    C->>A: JSON notification + secret
    A->>A: Validate + idempotency
    A->>D: Update Product
    A->>D: Insert Price/Stock Snapshot
    A-->>C: 204
```

## 8. Reconciliation

Günlük cron:

1. Active WatchBinding kayıtlarını oku.
2. changedetection.io watch listesini al.
3. Eksik/fazla watch tespit et.
4. EventLog yaz.
5. Otomatik düzeltme yerine ilk sürümde raporla.

## 9. Bağımlılık Koruması

changedetection.io yalnız `ChangeDetectionClient` interface arkasında kullanılır. Başka bir motor gerekirse yeni adapter yazılabilir.

## 10. Version Strategy

- sabit Docker tag
- aylık changelog inceleme
- update öncesi test
- datastore backup
- gerekirse image mirror
