# ADR-0002 — MVP'de Redis ve BullMQ Kullanılmaması

## Durum

Kabul edildi.

## Karar

MVP'de Redis ve BullMQ kullanılmayacaktır.

## Gerekçe

changedetection.io zaten:

- schedule
- worker
- fetch concurrency
- retry
- event notification

sağlamaktadır.

## Yeniden Değerlendirme Koşulları

- yüksek hacimli bağımsız job
- garantili outbound notification retry
- uzun süren backend işleri
- webhook burst
- distributed lock ihtiyacı
