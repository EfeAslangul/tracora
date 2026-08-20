# Tracora — Android

Native Kotlin + Jetpack Compose istemcisi. Web ile aynı NestJS REST API'yi tüketir (`docs/API.md`), auth yok (tek kullanıcı modu), ayrı bir backend gerekmiyor.

## Kurulum

1. Android Studio (Koala veya sonrası) ile `apps/android` klasörünü aç — Gradle wrapper (`gradlew`/`gradlew.bat`) repoda hazır, ek bir şey indirmesi gerekmez.
2. `pnpm dev` (repo kökünden) veya `docker compose up` ile backend'i ayağa kaldır (bkz. kök `README.md`).
3. **Emülatör**: hiçbir ek ayar gerekmez, uygulama varsayılan olarak `http://10.0.2.2:3000/api/v1` adresine bağlanır (emülatörden host makinenin localhost'una giden standart adres).
4. **Gerçek cihaz (aynı Wi-Fi)**: host makinenin LAN IP'sini kullanmak için çalıştırma konfigürasyonuna Gradle özelliği ekle:
   ```
   ./gradlew assembleDebug -PlanApiHost=192.168.1.23
   ```
   (Android Studio'da Run/Debug Configuration → "Add Property" ile de aynısı yapılabilir.)

## Mimari

- `data/model` — `docs/API.md` kontratını birebir yansıtan `@Serializable` DTO'lar (web'deki `product.types.ts`'nin Kotlin karşılığı)
- `data/network` — Retrofit arayüzü (`ProductApi`) + `ApiClient` (OkHttp/Retrofit kurulumu)
- `data/repository` — `ProductRepository`, Retrofit `Response`'unu başarı/`ApiException` olarak ayırır (web'deki `ApiError`'un karşılığı)
- `di/AppContainer` — tek elle yazılmış servis lokatörü (Hilt yok, uygulama küçük)
- `ui/products`, `ui/detail` — ViewModel + Compose ekranları (liste, detay+fiyat grafiği)

## Testler

```
./gradlew testDebugUnitTest
```

ViewModel testleri `FakeProductApi` ile (gerçek ağ çağrısı yok) — web tarafındaki `vi.mock` deseniyle paralel.

## Doğrulama durumu

Bu proje CLI ortamında gerçek Android SDK (platform 35, build-tools 35.0.0), JDK 17 ve Gradle 8.9 kurularak derlendi ve doğrulandı:

- `./gradlew testDebugUnitTest` → **BUILD SUCCESSFUL**, 4/4 ViewModel testi geçti.
- `./gradlew assembleDebug` → **BUILD SUCCESSFUL**, `app/build/outputs/apk/debug/app-debug.apk` üretildi (Compose derlemesi ve Vico grafik entegrasyonu dahil).

Yani kod gerçekten derleniyor ve testler gerçekten geçiyor — sadece bir emülatörde/cihazda çalıştırıp UI'ı görsel olarak doğrulama bu ortamda yapılamadı (Android SDK burada headless, emülatör/AVD kurulu değil).

## Bilinen sınırlamalar

- Onboarding/setup ekranı bilinçli olarak kapsam dışı bırakıldı — uygulama doğrudan ürün listesiyle açılır, kurulumun web tarafından zaten tamamlanmış olduğu varsayılır.
- Emülatör/gerçek cihazda görsel/etkileşim testi yapılmadı — Android Studio'da çalıştırıp gözden geçirmen gerekiyor.
