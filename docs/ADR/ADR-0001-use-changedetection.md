# ADR-0001 — changedetection.io Kullanımı

## Durum

Kabul edildi.

## Karar

changedetection.io ayrı Docker servisi olarak kullanılacaktır.

## Kullanılacak Yetkinlikler

- fetch
- browser
- selector
- diff
- restock/price detection
- schedule
- Apprise
- Telegram
- JSON webhook

## Kullanılmayacak Yaklaşım

- fork
- çekirdeği değiştirme
- kendi scraping motorumuzu yazma

## Koruma

- adapter interface
- sabit version
- PostgreSQL domain source
- datastore backup
- reconciliation
