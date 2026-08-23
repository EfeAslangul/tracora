# Tracora — iOS

Native SwiftUI istemcisi. Web ile aynı NestJS REST API'yi tüketir (`docs/API.md`). Kimlik
doğrulama Firebase Auth (v1'de yalnızca e-posta/şifre) ile yapılır — bkz.
`docs/ADR/ADR-0005-firebase-auth-and-multi-tenancy.md`. Görsel yön: Claude Design'dan içe aktarılan
"Tracora Mobil" mock'unun 1a seçeneği (sakin/açık iris teması, Newsreader + Manrope, otomatik koyu
tema desteği).

## Kurulum

1. `apps/ios/Tracora.xcodeproj` dosyasını Xcode ile aç. İlk açılışta Xcode, `Package.resolved`
   olmadığı için Firebase iOS SDK'sını (`FirebaseAuth`, `FirebaseCore`) GitHub'dan otomatik
   çözecek/indirecek — bu adım internet bağlantısı gerektirir ve firebase-ios-sdk deposu büyük
   olduğu için birkaç dakika sürebilir.
2. **Firebase**: `Tracora/Resources/GoogleService-Info.plist` şu an bir **placeholder**
   (`API_KEY = "REPLACE_ME"`). [Firebase console](https://console.firebase.google.com)'da paket
   adı `com.tracora.ios` ile bir iOS app kaydedip gerçek `GoogleService-Info.plist` dosyasını indirip
   bu dosyanın yerine koy. Placeholder haliyle uygulama çökmez — `FirebaseAuthService.isConfigured`
   `false` döner ve Login ekranında "Firebase henüz yapılandırılmadı" banner'ı görünür.
3. `pnpm dev` (repo kökünden) veya `docker compose up` ile backend'i ayağa kaldır (bkz. kök
   `README.md`).
4. **Simulator**: hiçbir ek ayar gerekmez, uygulama varsayılan olarak `http://127.0.0.1:3000/api/v1`
   adresine bağlanır (Simulator, host makinenin localhost'unu doğrudan görür — Android emülatörünün
   `10.0.2.2` NAT adresine ihtiyaç yok).
5. **Gerçek cihaz (aynı Wi-Fi)**: `Config.swift`'in okuduğu `API_BASE_URL` Info.plist anahtarını
   (ya da scheme'in Run > Arguments > Environment Variables kısmında aynı isimle bir override)
   host makinenin LAN IP'siyle doldur, örn. `http://192.168.1.23:3000/api/v1`.

## Mimari

- `Domain/Models` — `docs/API.md` kontratını birebir yansıtan `Codable` struct'lar (Android'deki
  `data/model/Product.kt`'nin Swift karşılığı)
- `Data/Network` — `ApiClient` (plain `URLSession` + `Codable`, üçüncü parti HTTP kütüphanesi yok),
  `Endpoints`, `ApiError`
- `Data/Repository/ProductRepository` — Android'deki `ProductRepository.kt` ile 1:1 metod eşlemesi
- `Data/Auth/FirebaseAuthService` — Firebase Auth sarmalayıcı (e-posta/şifre); placeholder plist
  iken `isConfigured=false` döner, çökme yok
- `UI/Theme` — `Palette.swift` (ışık/koyu tema aynı semantik token'lardan otomatik türer),
  `Typography.swift` (Newsreader/Manrope, bundled font'lar `Info.plist`'te `UIAppFonts` ile kayıtlı)
- `UI/Root/RootView` — auth + setup durumuna göre Login/Onboarding/ProductList yönlendirmesi
- `UI/Auth`, `UI/Onboarding`, `UI/Products`, `UI/Detail`, `UI/AddProduct`, `UI/Settings` — ekranlar

## Proje dosyası hakkında

`Tracora.xcodeproj` bu oturumda elle (Xcode GUI kullanılmadan) üretildi — bu makinede `xcodegen`/
`tuist` kurulu değildi. `plutil -lint` ile sözdizimi doğrulandı ve `xcodebuild -list` ile şema/hedef
okunabilirliği test edildi. Xcode'da açtığında normal bir proje gibi davranmalı; ilk açılışta
Firebase SPM paketinin çözülmesi biraz zaman alacaktır.

## Bilinen sınırlamalar

- Newsreader/Manrope, Google Fonts'un değişken (variable) font dosyalarından bu oturumda
  `fonttools` ile sabit ağırlık enstanslarına (`Regular`/`Medium`/`SemiBold`/`Bold`) dönüştürülüp
  vendored edildi — ekstra ağırlıklar gerekiyorsa aynı yöntemle yeniden üretilebilir.
- Ürün grupları (grup çipleri) sunucu tarafında bir alan olmadığı için tamamen sunucu-tarafsız/
  görsel: `hostname` alanından türetiliyor. Gerçek gruplama istenirse `docs/API.md`'ye ve `Product`
  modeline `group`/`tag` alanı eklenmesi gerekir.
- Sign in with Apple / Google henüz eklenmedi (ADR-0005 nihai hedefte istiyor) — v1 yalnızca
  e-posta/şifre.
- Bu oturumda Simulator'da gerçek bir build+run+screenshot doğrulaması yapıldıysa altta not
  edilmiştir; yapılamadıysa (örn. Firebase SPM çözümü bu ortamda çok uzun sürdüyse) bir sonraki
  adım Xcode'da açıp derlemek ve Simulator'da çalıştırmaktır.
