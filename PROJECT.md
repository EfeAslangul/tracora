# Product Tracker — Nihai Proje Tanımı

## 1. Proje Amacı

Kullanıcının teknik changedetection.io ekranlarına girmeden herhangi bir herkese açık ürün URL'sini ekleyebildiği, fiyat ve stok değişimlerini günde bir kez izleyebildiği, hedef fiyat belirleyebildiği ve Telegram bildirimi alabildiği sade bir uygulama geliştirmek.

Sistem belirli mağazalara gömülü olmayacaktır. Yeni bir domain için önce genel profil denenir; daha özel bir seçim/fetch ihtiyacı varsa çekirdek akış değiştirilmeden yeni bir site profili eklenir. Login, CAPTCHA veya çözülemeyen anti-bot koruması bulunan her sitenin başarıyla ayrıştırılması garanti edilmez; bu durum kullanıcıya açık bir hata koduyla gösterilir.

changedetection.io şu görevleri üstlenecektir:

- Web sayfasını alma
- JavaScript tabanlı sayfalar için browser fetch
- CSS/XPath selector
- Değişiklik tespiti
- Kontrol zamanlama
- Fiyat/stok değişiklikleri
- Apprise üzerinden NestJS'e sürümlü JSON webhook teslimi

Bizim uygulamamız şu görevleri üstlenecektir:

- Ürün odaklı domain modeli
- Genel profil ve sonradan eklenebilir site profilleri
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
- Herkese açık HTTP/HTTPS ürün URL'leri
- İlk açılışta çoklu URL onboarding ekranı
- Sonraki açılışlarda doğrudan ürün listesi
- Genel profil + domain bazlı site profili fallback'i
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
- Varsayılan 24 saatlik kontrol aralığı
- Docker Compose ile yerel kurulum

## 4. Sonraki Sürümlerde Değerlendirilecek Özellikler

- Beden/numara bazlı stok
- StockSnapshot ayrıntısı
- Bir ürün için birden fazla watch
- Browser Steps
- Kullanıcı tarafından değiştirilebilir kontrol sıklığı
- Login gerektiren ürün sayfaları

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
   ├── Diff / Restock / Price processor
   └── JSON Webhook → NestJS

NestJS
   └── Notification outbox → Telegram Bot API
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

MVP'de ayrı queue sistemi yoktur. Telegram teslimatları PostgreSQL tabanlı küçük bir outbox ve NestJS cron işi ile tekrar denenir.

### Günlük kontrol

- Watch oluşturulunca başlangıç değerini almak için hemen bir kontrol tetiklenir.
- Sonraki kontroller changedetection.io tarafından 24 saatte bir çalıştırılır.
- Uygulama veya container yeniden başladığında fazladan kontrol tetiklenmez.
- Kontrol planı changedetection.io datastore volume'unda, ürün ve tercih bilgileri PostgreSQL'de kalıcıdır.

### Telegram

- changedetection.io yalnız güvenli JSON webhook'u NestJS'e yollar.
- NestJS normalize edilmiş fiyat/stok olayından bildirim politikasını değerlendirir.
- Bildirim PostgreSQL outbox'a idempotent yazılır ve Telegram Bot API'ye gönderilir.
- İlk deneme başarısızsa ayrı bir queue kurmadan sınırlı ve artan gecikmeli retry uygulanır.

## 8. Ürün Oluşturma Durum Akışı

```text
PENDING
   ├── watch oluşturuldu → ACTIVE
   └── hata oluştu       → FAILED
```

Akış:

1. URL doğrulanır ve public internet hedefi olduğu güvenli şekilde kontrol edilir.
2. Domain için özel profil aranır; yoksa genel profil seçilir.
3. URL normalize edilir.
4. Duplicate kontrol edilir.
5. Product `PENDING` oluşturulur.
6. changedetection.io watch oluşturulur.
7. WatchBinding kaydedilir.
8. Product `ACTIVE` yapılır.
9. Hata halinde Product `FAILED` yapılır.
10. Kullanıcı yeniden deneme yapabilir.

Distributed transaction veya saga kullanılmayacaktır.

## 9. Site Profile

Siteye özel bilgiler tek yerde tutulur.

```ts
export interface SiteProfile {
  code: string;
  hostnames: string[] | ['*'];
  priority: number;
  useBrowser: boolean;
  productNameSelector?: string;
  priceSelector?: string;
  stockSelector?: string;
  imageSelector?: string;
  waitSeconds?: number;
  requestHeaders?: Record<string, string>;
}
```

Çözüm sırası:

1. Tam hostname eşleşen doğrulanmış site profili
2. Genel profil: changedetection.io price/restock processor ve standart yapılandırılmış veri
3. Ayrıştırma başarısızsa `EXTRACTION_UNSUPPORTED`; domain profili eklenerek yeniden deneme

Site profilleri sürümlenir, backend içinde tek registry üzerinden çözülür ve frontend'e selector ayrıntıları sızdırılmaz. Yeni site eklemek yeni bir profil ve contract testi gerektirir; Product, webhook veya UI akışı değiştirilmez.

## 10. İlk Açılış ve Onboarding

1. React başlangıçta `GET /api/v1/setup/status` çağırır.
2. PostgreSQL'de `onboarding.completedAt` yoksa çoklu URL giriş ekranı açılır.
3. Kullanıcı en az bir URL girer; tek istekte en fazla 20 URL kabul edilir.
4. Backend her URL için normal Product oluşturma akışını kullanır.
5. En az bir watch başarıyla oluşturulursa onboarding tamamlanmış sayılır.
6. Sonraki uygulama/container başlangıçlarında doğrudan ürün listesi açılır.

Onboarding bilgisi browser local storage'da değil PostgreSQL `AppSetting` kaydında tutulur. Böylece farklı tarayıcı ve container restart davranışları tutarlı kalır.

## 11. Veri Kaynağı İlkesi

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
- Onboarding durumu
- Telegram notification outbox

PostgreSQL uygulamanın kalıcı domain veri kaynağıdır.

## 12. Kodlama İlkeleri

- Frontend changedetection.io ile doğrudan konuşmaz.
- Controller içinde business logic bulunmaz.
- Prisma üzerine ek repository katmanı MVP'de kurulmaz.
- Dış servis erişimi yalnız adapter üzerinden yapılır.
- Sabit URL allowlist yerine yalnız public HTTP/HTTPS hedefleri kabul edilir.
- DNS çözümleme ve her redirect sonrası private, loopback, link-local ve reserved IP aralıkları engellenir.
- Tüm dış istekler timeout içerir.
- Webhook shared secret ile korunur.
- Aynı event iki kez işlense de sonuç değişmemelidir.
- Para alanları Decimal kullanır.
- Tarihler UTC saklanır.
- Secret değerler loglanmaz.
- Production'da sabit Docker image tag kullanılır.
- Siteye özel selector ve fetch ayarı yalnız site profile registry'sinde bulunur.
- Telegram token ve chat ID veritabanında tutulmaz; environment/secret üzerinden okunur.

## 13. Git Stratejisi

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

## 14. Definition of Done

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
