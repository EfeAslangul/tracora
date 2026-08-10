# Haydar — Product Owner, Solution Architect ve Frontend

## 1. Rol

- Product Owner
- Solution Architect
- Frontend Developer
- GitHub yöneticisi
- Sprint ve release sorumlusu
- Acceptance test sorumlusu

Backend'in primary owner'ı Efe'dir. Haydar backend'i mikro yönetmez; ürün kapsamı, mimari sınır ve entegrasyon etkisi üzerinden review yapar.

## 2. Ürün Yönetimi

- MVP kapsamını koru.
- Genel profil acceptance sınırlarını ve yeni site ekleme önceliğini yönet.
- Acceptance criteria yaz.
- Backlog önceliklendir.
- Sprint hedeflerini belirle.
- Demo senaryoları oluştur.
- Yeni özellikleri MVP'ye kontrolsüz ekleme.

## 3. GitHub

- Repository oluştur.
- Efe'yi collaborator ekle.
- `main` branch protection aç.
- PR zorunlu yap.
- Squash merge aç.
- Issue template ekle.
- GitHub Project kur.
- Milestone oluştur.
- Release ve changelog yönet.

## 4. Frontend Teknolojileri

- React
- Vite
- TypeScript
- React Router
- TanStack Query
- React Hook Form
- Zod
- Recharts
- Vitest
- React Testing Library

## 5. Frontend Yapısı

```text
src/
  app/
  components/
  features/
    products/
    dashboard/
    system/
  pages/
  services/
  hooks/
  types/
  utils/
```

`packages/shared` başlangıçta kurulmaz. Gerçek paylaşım ihtiyacı çıkarsa eklenir.

## 6. MVP Ekranları

### İlk Açılış URL Wizard'ı

- `GET /setup/status` ile server-side route kararı
- 1..20 URL için satır ekleme/silme veya çok satırlı giriş
- URL bazında hedef fiyat ve bildirim tercihi
- partial success sonucunda oluşturulan/başarısız URL'leri ayrı gösterme
- en az bir başarıdan sonra ürün listesine geçme
- sonraki başlangıçlarda wizard'ı göstermeme
- onboarding kararını local storage'a yazmama

### Ürün Listesi

- ürün kartları
- arama
- mağaza filtresi
- durum filtresi
- hata filtresi
- son kontrol
- fiyat değişimi

### Ürün Ekleme

- URL
- hedef fiyat
- bildirim tercihi
- spike uygunsa beden/numara

### Ürün Detay

- görsel
- ürün adı
- güncel/eski fiyat
- değişim yüzdesi
- stok
- hedef fiyat
- fiyat grafiği
- son kontrol
- hata
- manuel kontrol
- yeniden dene
- duraklat/sil

### Sistem Durumu

Ayrı sayfa yerine header veya küçük panel olabilir. Telegram `not_configured/degraded` durumu kullanıcıya gösterilir; secret UI'da alınmaz veya görüntülenmez.

Dashboard MVP sonunda eklenebilir; ilk çalışan sürüm için zorunlu değildir.

## 7. Frontend Kuralları

- changedetection.io API'sine doğrudan çağrı yok.
- Merkezi API client.
- TanStack Query server state.
- React Hook Form + Zod.
- Her ekranda loading, empty, error.
- Teknik hata kullanıcı diline çevrilir.
- 360px mobil destek.
- Klavye erişimi.
- Durum yalnız renkle anlatılmaz.

## 8. Backend ile Paralel Çalışma

Efe Sprint 1 başında Swagger/OpenAPI taslağını yayınlar.

Haydar:

- mock response üretir
- API tamamlanmadan frontend geliştirir
- contract değişikliğini issue/PR ile takip eder
- frontend'de uydurma endpoint oluşturmaz

## 9. Acceptance Testleri

1. İlk açılışta birden çok public URL ekle.
2. Setup partial success sonucunu doğrula.
3. Restart sonrası onboarding'in açılmadığını doğrula.
4. Geçersiz ve private-network URL dene.
5. Aynı URL'yi iki kez ekle.
6. changedetection.io kapalıyken ürün ekle.
7. Genel profilin ayrıştıramadığı domain hata deneyimini kontrol et.
8. FAILED üründe yeniden dene.
9. Manuel check başlat.
10. Fiyat webhook'u ve duplicate webhook işle.
11. Telegram tekil mesaj ve retry davranışını doğrula.
12. Ürün sil.
13. Docker Compose yeniden başlat.
14. PostgreSQL, onboarding ve watch schedule kalıcılığını kontrol et.

## 10. Mimari Review

Kontrol soruları:

- MVP dışı teknoloji eklenmiş mi?
- changedetection.io'nun yaptığı iş tekrar yazılmış mı?
- Backend contract frontend ihtiyacını karşılıyor mu?
- Domain verisi PostgreSQL'de mi?
- Adapter sınırı korunuyor mu?
- SSRF ve webhook güvenliği düşünülmüş mü?
- Efe'nin backend ownership'i korunuyor mu?

## 11. Sprint Çıktıları

### Sprint 0

- repo
- GitHub Project
- React scaffold
- Docker koordinasyonu
- generic site spike acceptance

### Sprint 1

- ilk açılış URL wizard'ı
- ürün listesi
- ürün ekleme
- mock API
- Swagger contract review

### Sprint 2

- ürün detay
- fiyat grafiği
- manuel kontrol
- hata/retry UI

### Sprint 3

- Telegram health ve mesaj acceptance
- sistem health göstergesi
- responsive
- accessibility
- release

## 12. Codex Talimatı

```text
PROJECT.md, docs/ARCHITECTURE.md, docs/API.md ve TEAM/HAYDAR_TASKS.md dosyalarını oku.

Haydar'ın ana teknik alanı frontend ve ürün/süreç yönetimidir.
Backend contract'ı uydurma.
React'ten changedetection.io'ya doğrudan çağrı yapma.
Component içinde doğrudan fetch kullanma.
TanStack Query, React Hook Form ve Zod kullan.
Loading, empty, error, responsive ve erişilebilirlik durumlarını atlama.
MVP dışı ekran veya global state ekleme.
Her değişiklikten sonra lint, type-check, test ve build çalıştır.
Efe'nin backend ownership'ini bozacak yeniden tasarım yapma.
```
