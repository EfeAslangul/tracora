# Tracora — Android

Native Kotlin + Jetpack Compose istemcisi. Web ile aynı NestJS REST API'yi tüketir (`docs/API.md`).
Kimlik doğrulama Firebase Auth (e-posta/şifre) ile yapılır — bkz. `docs/ADR/ADR-0005-firebase-auth-and-multi-tenancy.md`.
Görsel yön: Claude Design'dan içe aktarılan "Tracora Mobil" mock'unun 1b seçeneği (koyu iris tema, Sora + IBM Plex Mono).

## Kurulum

1. Android Studio (Koala veya sonrası) ile `apps/android` klasörünü aç — Gradle wrapper (`gradlew`/`gradlew.bat`) repoda hazır, ek bir şey indirmesi gerekmez.
2. `pnpm dev` (repo kökünden) veya `docker compose up` ile backend'i ayağa kaldır (bkz. kök `README.md`).
3. **Firebase**: `app/google-services.json` şu an bir **placeholder**. Firebase console'da paket adı `com.tracora.android` ile bir Android app kaydedip gerçek `google-services.json` dosyasını indirip bu dosyanın yerine koy. Placeholder haliyle uygulama çöküp, sadece "Firebase henüz yapılandırılmadı" banner'ıyla oturum açmadan kalır (bkz. `data/auth/FirebaseAuthService.kt`).
4. **Emülatör**: hiçbir ek ayar gerekmez, uygulama varsayılan olarak `http://10.0.2.2:3000/api/v1` adresine bağlanır (emülatörden host makinenin localhost'una giden standart adres).
5. **Gerçek cihaz (aynı Wi-Fi)**: host makinenin LAN IP'sini kullanmak için çalıştırma konfigürasyonuna Gradle özelliği ekle:
   ```
   ./gradlew assembleDebug -PlanApiHost=192.168.1.23
   ```
   (Android Studio'da Run/Debug Configuration → "Add Property" ile de aynısı yapılabilir.)

## Mimari

- `data/model` — `docs/API.md` kontratını birebir yansıtan `@Serializable` DTO'lar (web'deki `product.types.ts`'nin Kotlin karşılığı), artık `SetupStatus`/`SetupRequest`/`SetupResult` dahil
- `data/network` — Retrofit arayüzü (`ProductApi`) + `ApiClient` (OkHttp/Retrofit kurulumu) + `AuthInterceptor` (her isteğe Firebase ID token ekler, 401'de oturumu kapatır)
- `data/auth/FirebaseAuthService` — Firebase Auth sarmalayıcı (e-posta/şifre); `google-services.json` placeholder iken `isConfigured=false` döner, çökme yok
- `data/repository` — `ProductRepository`, Retrofit `Response`'unu başarı/`ApiException` olarak ayırır (web'deki `ApiError`'un karşılığı)
- `di/AppContainer` — tek elle yazılmış servis lokatörü (Hilt yok, uygulama küçük)
- `ui/auth`, `ui/onboarding`, `ui/settings` — giriş, çoklu URL kurulumu, çıkış/hesap silme ekranları
- `ui/products`, `ui/detail` — ViewModel + Compose ekranları (liste, detay+fiyat grafiği)
- `ui/theme` — Direction 1b renk paleti (`Color.kt`) ve Sora/IBM Plex Mono tipografisi (`Type.kt`)

## Testler

```
./gradlew testDebugUnitTest
```

ViewModel testleri `FakeProductApi` ile (gerçek ağ çağrısı yok) — web tarafındaki `vi.mock` deseniyle paralel.

## Doğrulama durumu

Önceki bir oturumda (JDK 17 + Android SDK platform 35 kurulu bir ortamda) `./gradlew testDebugUnitTest` ve `./gradlew assembleDebug` başarıyla geçmişti (bkz. git geçmişi). Bu oturumda (Firebase Auth, yeni onboarding/login/settings ekranları, 1b tema restyle'ı eklendi) **bu makinede ne JDK ne de Android SDK kurulu** — `./gradlew` çalıştırılamadı, dolayısıyla yeni kod bu oturumda derleme seviyesinde doğrulanamadı. Bir sonraki adım olarak Android Studio'da veya JDK+SDK kurulu bir CI/CLI ortamında `./gradlew assembleDebug` çalıştırıp derleme hatalarını (özellikle yeni Firebase bağımlılıkları ve font kaynakları etrafında) gidermek gerekir.

## Bilinen sınırlamalar

- Emülatör/gerçek cihazda görsel/etkileşim testi yapılmadı — Android Studio'da çalıştırıp gözden geçirmen gerekiyor (bu oturumda Android emülatörü mevcut değildi, doğrulama yalnızca derleme seviyesinde yapılabildi).
- Ürün grupları (`+ Grup` çipleri) sunucu tarafında bir alan olmadığı için tamamen sunucu-tarafsız/görsel: `hostname` alanından türetiliyor. Gerçek gruplama istenirse `docs/API.md`'ye ve `Product` modeline `group`/`tag` alanı eklenmesi gerekir.
- Sign in with Apple / Google henüz eklenmedi (ADR-0005 nihai hedefte istiyor) — v1 yalnızca e-posta/şifre.
