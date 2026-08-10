# Site Profile Sistemi

## Amaç

Product ve UI akışını değiştirmeden yeni e-ticaret domainleri ekleyebilmek. Sistem her public URL'yi kabul eder; fiyat/stok ayrıştırma önce genel profil ile denenir, gerekirse hostname'e özel profil eklenir.

## Profil Sözleşmesi

```ts
export interface SiteProfile {
  key: string;
  version: number;
  hostnames: string[] | ['*'];
  priority: number;
  fetchMode: 'AUTO' | 'HTTP' | 'BROWSER';
  productNameSelector?: string;
  priceSelector?: string;
  stockSelector?: string;
  imageSelector?: string;
  waitSeconds?: number;
  requestHeaders?: Record<string, string>;
  normalizeUrl(url: URL): URL;
}
```

`generic` profil `hostnames: ['*']`, `fetchMode: 'AUTO'` ve en düşük öncelikle kayıtlıdır. Profil registry exact hostname eşleşmesini generic profilden önce seçer. `AUTO`, önce düşük maliyetli HTTP fetch'i dener; ilk extraction sonucu JavaScript gereksinimi gösterirse yalnız bir kez browser fetch'e yükseltir. Kesinleşen mod `WatchBinding.fetchMode` alanında tutulur ve restart'ta yeniden denenmez.

## Çözümleme Akışı

1. URL yalnız `http` veya `https` olmalıdır; credential içeremez.
2. DNS ve redirect zincirinde private/loopback/link-local/reserved IP kontrolü yapılır.
3. URL tracking parametrelerinden ve fragment'ten arındırılır.
4. Exact hostname için en yüksek sürümlü aktif profil aranır.
5. Eşleşme yoksa `generic` profil seçilir.
6. Profil changedetection.io watch ayarına çevrilir.
7. İlk kontrol fiyat üretemezse Product `FAILED`, hata `EXTRACTION_UNSUPPORTED` olur.
8. Yeni profil yayınlandıktan sonra mevcut Product retry edilebilir.

## Genel Profil

Genel profil yalnız changedetection.io'nun hazır yeteneklerini kullanır:

- price/restock processor
- standart JSON-LD `Product/Offer`
- yaygın metadata
- gerekirse browser fetch kararı

Backend içinde genel amaçlı yeni HTML parser, headless browser veya scraping motoru yazılmaz.

## Yeni Profil Ekleme

Her site profili PR'ında şunlar zorunludur:

- Profili tetikleyen hostname listesi
- Kişisel veri içermeyen kaydedilmiş HTML/processor fixture'ı
- URL normalization testi
- Fiyat ve currency extraction contract testi
- Stok destekleniyorsa stok contract testi
- HTTP/browser fetch gerekçesi
- Redirect ve anti-bot davranışı
- Profil version artışı
- `EXTRACTION_UNSUPPORTED` ürün için retry acceptance testi

Selector değişikliği aynı profile key üzerinde version artırır. Eski version geri dönüş ve regresyon incelemesi için belgelenir.

## Başarı Tanımı

- URL'nin kabul edilmesi site desteği garantisi değildir.
- Watch oluşturulması ürün takibinin provision edildiğini gösterir.
- Site desteği, ilk kontrolde geçerli fiyat ve para birimi çıkarıldığında doğrulanır.
- CAPTCHA, login, bölgesel engel veya çözülemeyen anti-bot durumu aşılmaya çalışılmaz; kullanıcıya anlaşılır hata gösterilir.

## Gözlemlenebilirlik

`EXTRACTION_UNSUPPORTED` EventLog kayıtları hostname ve profile version ile raporlanır; ham HTML, secret veya kullanıcı credential'ı loglanmaz. Sprint 4 profil backlog'u hata hacmi ve kullanıcı önceliğine göre sıralanır.
