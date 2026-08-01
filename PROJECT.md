# Product Tracker — Nihai Proje Tanımı

## 1. Proje Amacı

Kullanıcının teknik changedetection.io ekranlarına girmeden ürün ekleyebildiği, fiyat ve stok değişimlerini izleyebildiği, hedef fiyat belirleyebildiği ve Telegram bildirimi alabildiği sade bir uygulama geliştirmek.

changedetection.io şu görevleri üstlenecektir:

- Web sayfasını alma
- JavaScript tabanlı sayfalar için browser fetch
- CSS/XPath selector
- Değişiklik tespiti
- Kontrol zamanlama
- Fiyat/stok değişiklikleri
- Apprise üzerinden bildirim

Bizim uygulamamız şu görevleri üstlenecektir:

- Ürün odaklı domain modeli
- Mağaza profilleri
- changedetection.io REST adapter
- Güvenli webhook receiver
- PostgreSQL üzerinde temiz fiyat/stok geçmişi
- Kullanıcı dostu React arayüzü
- Hata normalizasyonu
- Docker tabanlı yerel kurulum

## 2. Ekip

### Efe — Backend Lead

Efe backend mimarisinin ana sahibidir.

Sorumlulukları:

- NestJS
- Prisma
- PostgreSQL
- changedetection.io REST entegrasyonu
- Webhook receiver
- Store profile sistemi
- URL normalizasyonu
- İdempotent ürün oluşturma
- API contract
- Swagger
- Backend testleri
- Docker servislerinin backend tarafı
- Teknik ADR önerileri
- Backend demo anlatımı

### Haydar — Product Owner ve Frontend

Sorumlulukları:

- Ürün kapsamı
- React frontend
- UI akışları
- GitHub yönetimi
- Sprint planlama
- Acceptance criteria
- PR review
- Release
- Dokümantasyon
- Kullanıcı kabul testleri
- Mimari sınırların korunması

## 3. MVP Kapsamı

- Tek kullanıcı modu
- İlk aşamada tek mağaza
- URL ile ürün ekleme
- Ürün adı
- Ürün görseli
- Güncel fiyat
- Önceki fiyat
- Fiyat değişim yüzdesi
- Genel stok durumu
- Hedef fiyat
- Manuel kontrol
- Ürün listesi
- Ürün detay
- Fiyat geçmişi grafiği
- Son kontrol ve hata bilgisi
- Telegram bildirimi
- Docker Compose ile yerel kurulum

## 4. Spike Sonrası Değerlendirilecek Özellikler

- Beden/numara bazlı stok
- İkinci mağaza
- StockSnapshot ayrıntısı
- Bir ürün için birden fazla watch
- Browser Steps
- Reconciliation sıklığı

## 5. MVP Dışı

- Redis
- BullMQ
- Mikroservis
- Ağır DDD
- Ek repository abstraction
- Çok kullanıcılı üyelik
- Yetkilendirme
- Mobil uygulama
- SaaS
- Ödeme
- Kubernetes
- changedetection.io fork
- Yeni scraping motoru
- Ayrı notification servisi

## 6. Nihai Mimari

```text
React
   ↓
NestJS
   ├── PostgreSQL
   └── changedetection.io REST API

changedetection.io
   ├── Fetch / Browser
   ├── Scheduler
   ├── Diff / Restock / Price
   ├── Telegram / Apprise
   └── JSON Webhook → NestJS
```

## 7. Entegrasyon Stratejisi

### REST

NestJS changedetection.io REST API üzerinden:

- watch oluşturur
- watch günceller
- watch siler
- manuel kontrol tetikler
- watch durumunu okur

### Webhook

changedetection.io değişiklik tespit ettiğinde Apprise `json://` hedefi üzerinden NestJS webhook endpoint'ine POST gönderir.

NestJS:

- secret doğrular
- event'i idempotent işler
- Product kaydını günceller
- PriceSnapshot oluşturur
- gerekli ise StockSnapshot oluşturur
- hata/durum bilgisini kaydeder

### Reconciliation

Gecelik veya günlük basit cron:

- PostgreSQL Product/WatchBinding kayıtlarını
- changedetection.io watch listesiyle

karşılaştırır.

MVP'de ayrı queue sistemi yoktur.

## 8. Ürün Oluşturma Durum Akışı

```text
PENDING
   ├── watch oluşturuldu → ACTIVE
   └── hata oluştu       → FAILED
```

Akış:

1. URL doğrulanır.
2. Store belirlenir.
3. URL normalize edilir.
4. Duplicate kontrol edilir.
5. Product `PENDING` oluşturulur.
6. changedetection.io watch oluşturulur.
7. WatchBinding kaydedilir.
8. Product `ACTIVE` yapılır.
9. Hata halinde Product `FAILED` yapılır.
10. Kullanıcı yeniden deneme yapabilir.

Distributed transaction veya saga kullanılmayacaktır.

## 9. Store Profile

Siteye özel bilgiler tek yerde tutulur.

```ts
export interface StoreProfile {
  code: string;
  hostnames: string[];
  useBrowser: boolean;
  productNameSelector?: string;
  priceSelector?: string;
  stockSelector?: string;
  imageSelector?: string;
  waitSeconds?: number;
  requestHeaders?: Record<string, string>;
}
```

İlk teknik spike sonucunda Zara veya SuperStep'ten biri seçilecektir.

## 10. Veri Kaynağı İlkesi

### changedetection.io

- Sayfa izleme motoru
- Ham watch durumu
- Ham snapshot/diff
- Kontrol zamanlaması

### PostgreSQL

- Product domain modeli
- Store
- WatchBinding
- Kullanıcı tercihleri
- Temiz fiyat geçmişi
- Temiz stok geçmişi
- Hata/durum kayıtları

PostgreSQL uygulamanın kalıcı domain veri kaynağıdır.

## 11. Kodlama İlkeleri

- Frontend changedetection.io ile doğrudan konuşmaz.
- Controller içinde business logic bulunmaz.
- Prisma üzerine ek repository katmanı MVP'de kurulmaz.
- Dış servis erişimi yalnız adapter üzerinden yapılır.
- URL allowlist uygulanır.
- Redirect sonucu domain yeniden kontrol edilir.
- Tüm dış istekler timeout içerir.
- Webhook shared secret ile korunur.
- Aynı event iki kez işlense de sonuç değişmemelidir.
- Para alanları Decimal kullanır.
- Tarihler UTC saklanır.
- Secret değerler loglanmaz.
- Production'da sabit Docker image tag kullanılır.

## 12. Git Stratejisi

İki kişilik ekip için sade akış:

```text
main
feature/*
fix/*
docs/*
```

- `develop` kullanılmaz.
- PR zorunlu.
- Diğer ekip üyesi review eder.
- Squash merge.
- Conventional Commits.
- Main her zaman çalışır durumda tutulur.

## 13. Definition of Done

- Acceptance criteria tamamlandı.
- Lint geçti.
- Type-check geçti.
- Testler geçti.
- Build geçti.
- API değiştiyse Swagger ve `docs/API.md` güncellendi.
- UI değiştiyse loading, empty, error ve responsive durumları kontrol edildi.
- Güvenlik etkisi değerlendirildi.
- PR diğer kişi tarafından review edildi.
- Teknik karar gerekiyorsa ADR yazıldı.
