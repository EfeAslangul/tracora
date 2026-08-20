-- Çok kullanıcılı modele geçiş.
-- Mevcut ürün verisi bir sahibe atanamaz; taşınmak yerine temizlenir.
-- changedetection.io tarafındaki watch'lar bu migration ile silinmez;
-- docs/OPERATIONS.md içindeki adımla elle temizlenmelidir.
DELETE FROM "Product";
DELETE FROM "AppSetting" WHERE "key" = 'onboarding.completedAt';

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "firebaseUid" VARCHAR(128) NOT NULL,
  "email" VARCHAR(320),
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "displayName" VARCHAR(200),
  "signInProvider" VARCHAR(50),
  "telegramChatId" VARCHAR(64),
  "onboardingCompletedAt" TIMESTAMPTZ(3),
  "lastSeenAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- WatchBinding ürüne 1:1 bağlıydı; fan-out modelinde watch URL'nin varlığıdır.
DROP TABLE "WatchBinding";

CREATE TABLE "Watch" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "normalizedUrl" TEXT NOT NULL,
  "externalWatchId" VARCHAR(100) NOT NULL,
  "requestedFetchMode" "WatchFetchMode" NOT NULL DEFAULT 'AUTO',
  "fetchMode" "WatchFetchMode" NOT NULL,
  "lastSyncAt" TIMESTAMPTZ(3),
  "lastTriggeredAt" TIMESTAMPTZ(3),
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Watch_externalWatchId_key" ON "Watch"("externalWatchId");
CREATE UNIQUE INDEX "Watch_storeId_normalizedUrl_key" ON "Watch"("storeId", "normalizedUrl");

ALTER TABLE "Watch" ADD CONSTRAINT "Watch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product" ADD COLUMN "userId" UUID NOT NULL;
ALTER TABLE "Product" ADD COLUMN "watchId" UUID;

DROP INDEX "Product_storeId_normalizedUrl_key";
CREATE UNIQUE INDEX "Product_userId_storeId_normalizedUrl_key" ON "Product"("userId", "storeId", "normalizedUrl");
CREATE INDEX "Product_userId_createdAt_idx" ON "Product"("userId", "createdAt" DESC);
CREATE INDEX "Product_watchId_idx" ON "Product"("watchId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tek webhook artık N ürüne yazıyor: sourceEventKey global değil ürün başına tekil.
DROP INDEX "PriceSnapshot_sourceEventKey_key";
CREATE UNIQUE INDEX "PriceSnapshot_productId_sourceEventKey_key" ON "PriceSnapshot"("productId", "sourceEventKey");

DROP INDEX "StockSnapshot_sourceEventKey_key";
CREATE UNIQUE INDEX "StockSnapshot_productId_sourceEventKey_key" ON "StockSnapshot"("productId", "sourceEventKey");

DROP INDEX "NotificationDelivery_sourceEventKey_channel_type_key";
CREATE UNIQUE INDEX "NotificationDelivery_productId_sourceEventKey_channel_type_key" ON "NotificationDelivery"("productId", "sourceEventKey", "channel", "type");
