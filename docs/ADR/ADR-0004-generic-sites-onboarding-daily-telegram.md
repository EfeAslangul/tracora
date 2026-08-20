# ADR-0004 — Genel Site Desteği, Onboarding, Günlük Kontrol ve Telegram

## Durum

Kabul edildi.

## Bağlam

Uygulama tek bir mağazaya bağlı olmamalı, ilk açılışta takip edilecek URL'leri istemeli, sonraki açılışlarda onboarding göstermemeli, ürünleri günde bir kez kontrol etmeli ve Telegram bildirimi göndermelidir.

## Kararlar

1. Herkese açık HTTP/HTTPS URL'leri kabul edilir; sabit mağaza allowlist'i kullanılmaz.
2. SSRF koruması için DNS çözümleme ve tüm redirect hedefleri kontrol edilir; private, loopback, link-local ve reserved ağlar reddedilir.
3. Domain profili varsa o, yoksa changedetection.io yeteneklerini kullanan genel profil seçilir.
4. Genel profil ayrıştıramazsa ürün `FAILED` olur ve `EXTRACTION_UNSUPPORTED` hatası gösterilir. Yeni profil eklendikten sonra retry yapılabilir.
5. Onboarding tamamlanma bilgisi PostgreSQL'de sunucu tarafında tutulur. En az bir watch başarıyla oluşturulmadan tamamlanmış sayılmaz. (ADR-0005 ile `AppSetting`'ten `User.onboardingCompletedAt` alanına taşındı.)
6. Watch oluşturulunca ilk kontrol hemen, devam eden kontroller 24 saatte bir changedetection.io tarafından yapılır. Restart yeni kontrol başlatmaz.
7. changedetection.io olayları yalnız NestJS webhook'una gönderir. Kullanıcıya gidecek Telegram mesajını NestJS'in bildirim politikası üretir.
8. Telegram teslimatı PostgreSQL outbox ile idempotent ve tekrar denenebilir yapılır; Redis/BullMQ veya ayrı bildirim servisi eklenmez.

## Gerekçe

- Site profili registry'si yeni domainleri çekirdek domain ve UI kodunu değiştirmeden eklemeyi sağlar.
- Genel profil, yaygın ve standart sayfalarda sıfır konfigürasyonla çalışma şansı verir.
- Onboarding durumunu server-side tutmak restart ve farklı browser davranışını deterministik yapar.
- Scheduling'i changedetection.io'da bırakmak aynı işi ikinci kez yazmayı önler.
- Bildirim kararını NestJS'te vermek hedef fiyat, duplicate engelleme ve kullanıcı tercihlerini tek yerde tutar.
- PostgreSQL outbox düşük hacimli MVP için güvenilirlik sağlar ve ek altyapı gerektirmez.

## Sonuçlar

- “Her site” desteği, her public URL'nin sisteme kabul edilmesi ve yeni profil eklenebilmesi anlamına gelir; CAPTCHA/login/anti-bot engellerini aşma garantisi değildir.
- Site profili contract testleri ve fixture'ları bakım maliyeti oluşturur.
- Telegram environment değerleri yoksa takip çalışır, bildirim sağlığı `not_configured` görünür. (Hedef sohbet ADR-0005 ile kullanıcı başına taşındı.)
- Schedule değiştirme MVP'de UI üzerinden sunulmaz; varsayılan `86400` saniyedir.
