# Haydar — Android (Kotlin/Compose)

## 1. Rol Tanımı

- Android istemcisinin tek sahibi Haydar'dır — frontend, gerekirse Android'e özel backend ihtiyaçları (ör. push token endpoint'i) dahil.
- Efe bu alana dokunmaz; Efe'nin karşılığı iOS'u tamamen kendi başına native olarak yazmaktır.
- Ortak backend (NestJS API, `apps/api`) hâlâ Efe'nin ownership'indedir — Android yeni bir backend kurmaz, mevcut `docs/API.md` kontratını tüketir.

## 2. Teknoloji

- Kotlin
- Jetpack Compose + Material 3
- Retrofit + OkHttp + kotlinx.serialization
- Navigation Compose
- Vico (Compose native grafik kütüphanesi) — fiyat geçmişi grafiği
- Manuel DI (`di/AppContainer`, `di/ViewModelFactory`) — Hilt yok, uygulama küçük

## 3. Proje Yapısı

```
apps/android/
  app/src/main/kotlin/com/tracora/android/
    MainActivity.kt
    data/model/         # docs/API.md kontratını yansıtan @Serializable DTO'lar
    data/network/        # ProductApi (Retrofit), ApiClient, ApiException
    data/repository/     # ProductRepository — Response<T> -> başarı | ApiException
    di/                   # AppContainer, ViewModelFactory
    ui/products/          # Ürün listesi ekranı + ViewModel
    ui/detail/             # Ürün detay + fiyat grafiği ekranı + ViewModel
    ui/nav/                # NavHost
    ui/theme/              # Material 3 tema
  app/src/test/...         # ViewModel birim testleri (FakeProductApi ile)
```

## 4. MVP Ekranları

### Ürün Listesi

- `GET /products`, PENDING/baseline bekleyen ürün varken 3s, aksi halde 60s polling (web'deki `refetchInterval` mantığıyla aynı).
- Ürün ekleme formu (`POST /products`).
- FAILED üründe hızlı "Yeniden dene" (`POST /products/:id/retry`).
- Karta tıklayınca detay ekranına navigasyon.

### Ürün Detay

- `GET /products/:id` — ad, güncel/eski fiyat, değişim %, stok, hedef fiyat, fiyat grafiği, son kontrol, hata.
- Manuel kontrol (`POST /products/:id/check`).
- Yeniden dene — yalnızca `FAILED` (`POST /products/:id/retry`).
- Duraklat/Aktif et (`PATCH /products/:id`, `status`).
- Sil — onay diyaloğu (`DELETE /products/:id`).

### Kapsam dışı (şimdilik)

- Onboarding/setup wizard (web'de zaten var, kurulumun web üzerinden tamamlandığı varsayılır).
- Push notification / FCM.
- Release imzalama, Play Store dağıtımı.

## 5. Backend ile Çalışma Kuralları

- `docs/API.md` tek doğruluk kaynağıdır — endpoint/alan uydurma.
- API'de olmayan bir ihtiyaç çıkarsa (ör. push token kaydı) önce Efe ile konuşmadan `apps/api`'ye endpoint ekleme; Android'e özel bir backend ihtiyacı varsa bunu ayrı bir PR/issue olarak `apps/api` üzerinde Haydar açar (ownership değişmiyor, sadece Haydar bu konuda da yazabilir çünkü Efe Android'e hiç dokunmuyor).
- API şu an auth'suz (tek kullanıcı modu) ve HTTP üzerinden çalışıyor — cleartext izni yalnızca debug build'e (`src/debug/res/xml/network_security_config.xml`) tanımlı, release için gerçek HTTPS backend gerekecek.

## 6. Acceptance Testleri

1. Ürün listesi yükleniyor, boş durum doğru gösteriliyor.
2. Yeni ürün eklenince liste güncelleniyor.
3. FAILED üründe "Yeniden dene" API'yi çağırıyor ve durumu yeniliyor.
4. Ürün detayına gidince fiyat geçmişi grafiği (varsa) render oluyor.
5. Manuel kontrol 202 sonrası state'i günceller; cooldown/409 durumunda hata mesajı gösterilir.
6. Duraklat/Aktif et durumu değiştirir ve API'ye yansır.
7. Sil, onay diyaloğundan sonra API'yi çağırır ve listeye geri döner.
8. ViewModel testleri (`FakeProductApi`) gerçek ağ çağrısı yapmadan geçer.

## 7. Codex Talimatı

```text
Önce docs/API.md, PROJECT.md, apps/android/README.md ve bu dosyayı oku.

Android'in tek sahibi Haydar'dır; Efe'nin alanına (apps/api, apps/web, iOS) dokunma.
API kontratını uydurma — docs/API.md dışına çıkma.
Retrofit/OkHttp dışında ek bir networking katmanı ekleme.
Hilt veya başka bir DI framework'ü ekleme — mevcut AppContainer/ViewModelFactory yeterli.
Onboarding/setup ekranını bu aşamada ekleme (bilinçli olarak kapsam dışı).
Her değişiklikten sonra (Android Studio'da) ./gradlew testDebugUnitTest, lint ve assembleDebug çalıştır.
Bu ortamda Android SDK/Gradle CLI yoksa, derleme doğrulamasını Android Studio'da yapman gerektiğini kullanıcıya söyle.
```
