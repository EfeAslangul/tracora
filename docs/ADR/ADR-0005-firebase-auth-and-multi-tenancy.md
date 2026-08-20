# ADR-0005 — Firebase Auth ve Çok Kullanıcılı Model

## Durum

Kabul edildi.

## Bağlam

MVP tek kullanıcılıydı: hiçbir uç noktada kimlik doğrulaması yoktu, `Product` bir sahibe
bağlı değildi, onboarding global bir `AppSetting` satırıydı ve tüm Telegram bildirimleri
`.env` içindeki tek bir `TELEGRAM_CHAT_ID`'ye gidiyordu.

Ürünün bir sonraki adımı bir **SwiftUI iOS istemcisi**. Bir mobil uygulama App Store'a
kullanıcı hesabı olmadan çıkamaz; hesap açılır açılmaz da verinin kullanıcı bazında
ayrılması zorunlu hale gelir. Bu ADR, hem kimlik doğrulama mekanizmasını hem de çok
kullanıcılı veri modelini kaydeder.

## Kararlar

1. **Kimlik doğrulama Firebase Auth ile yapılır.** Desteklenen sağlayıcılar: e-posta/şifre,
   Apple ile Giriş, Google ile Giriş. Sunucu `firebase-admin` ile `verifyIdToken(token, true)`
   çağırır (`checkRevoked=true`).
2. **Guard globaldir** (`APP_GUARD`). Yeni bir uç nokta varsayılan olarak korumalıdır; açmak
   için bilinçli şekilde `@Public()` yazmak gerekir. Public kalanlar yalnız `GET /health` ve
   `POST /webhooks/changedetection`'dır.
3. **Kullanıcı kaydı just-in-time yapılır.** Ayrı bir register/login ucu yoktur; hesap
   Firebase'de açılır, ilk kimliği doğrulanmış istek `User` satırını `firebaseUid` üzerinden
   upsert eder.
4. **Veri kullanıcı bazında ayrıktır.** `Product.userId` zorunludur, tekillik
   `(userId, storeId, normalizedUrl)`'dir. Başkasının ürünü `403` değil `404` döner.
5. **changedetection.io watch'ı URL başınadır, kullanıcı başına değil.** Aynı normalize URL'yi
   izleyen tüm ürünler tek `Watch` satırına bağlanır; gelen gözlem hepsine fan-out edilir.
6. **Telegram hedefi kullanıcı başınadır** (`User.telegramChatId`). Global `TELEGRAM_CHAT_ID`
   kaldırılmıştır; bot token'ı sunucu genelinde kalır.
7. **Onboarding kullanıcı başınadır** (`User.onboardingCompletedAt`). ADR-0004'ün 5. kararı
   bu noktada güncellenmiştir.
8. **Mevcut veri migration'da silinir.** Tek kullanıcılı dönemde açılmış ürünler bir sahibe
   atanamaz.
9. **Hesap silme API'de vardır** (`DELETE /me`).

## Gerekçe

- Firebase Auth üç sağlayıcıyı da tek SDK ile verir; Apple ile Giriş'i kendimiz kurmak
  (JWT imzalama, anahtar rotasyonu, nonce doğrulama) MVP'ye göre orantısız iş olurdu.
- Token doğrulamasını sunucuda yapmak, istemcinin kim olduğunu söylediğine güvenmeden
  kiracılığı zorunlu kılar.
- Guard'ı global bağlamak, unutmayı sessiz bir güvenlik açığı olmaktan çıkarır: yanlış
  yapılan şey uç noktanın çalışmaması olur, korumasız kalması değil.
- Watch'ı paylaşmak, aynı ürünü izleyen N kullanıcı için sayfayı N kez çekmeyi önler.
  Alternatif — kullanıcı başına ayrı watch — kodda daha basitti (`ObservationService`
  hiç değişmezdi) ama upstream siteye giden trafiği kullanıcı sayısıyla çarpıyordu ve
  anti-bot korumalarını tetiklemeyi kolaylaştırıyordu.
- Tek bir Telegram sohbeti çok kullanıcılı bir üründe doğrudan gizlilik sızıntısıdır.
- App Store 5.1.1(v), hesap açan uygulamalarda uygulama içi hesap silmeyi zorunlu kılar;
  bunu iOS istemcisi yazılmadan önce API'ye koymak sonradan eklemekten ucuzdur.

## Sonuçlar

- **Paylaşılan watch, paylaşılan kader.** Watch hata verirse ona bağlı tüm kullanıcıların
  ürünleri etkilenir. Manuel kontrol soğuma penceresi de paylaşılır; ikinci kullanıcı
  `CHECK_ALREADY_RUNNING` alabilir.
- Uzak watch ancak tüm sahipleri duraklattığında durur ve ancak son sahip ayrıldığında
  silinir. Bu, `ProductsService.update`/`remove` içinde ek sayım sorguları demektir.
- `sourceEventKey` tekilliği global olmaktan çıkıp ürün başına indi
  (`(productId, sourceEventKey)`); aksi halde tek webhook ikinci ürüne yazamazdı.
- `firebase-admin` doğrulama sırasında Google'ın public key'lerini çeker (yaklaşık 6 saat
  cache'lenir). İlk istekte kısa bir gecikme olabilir.
- Firebase kimlik bilgileri boşken uygulama ayağa kalkar ama korumalı uçlar
  `AUTH_NOT_CONFIGURED` (503) döner. Bu bilinçlidir: yerel geliştirmeyi ve testleri
  bloklamaz ama sessizce korumasız da bırakmaz.
- Migration mevcut ürünleri siler ve changedetection.io tarafındaki watch'lar elle
  temizlenmelidir (`docs/OPERATIONS.md` §6).
