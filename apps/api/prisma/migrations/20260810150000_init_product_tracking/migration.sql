CREATE TYPE "StoreProfileStatus" AS ENUM ('GENERIC', 'VERIFIED', 'DISABLED');
CREATE TYPE "ProductStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'FAILED');
CREATE TYPE "WatchFetchMode" AS ENUM ('AUTO', 'HTTP', 'BROWSER');
CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM');
CREATE TYPE "NotificationType" AS ENUM ('PRICE_CHANGED', 'TARGET_REACHED', 'RESTOCKED', 'WATCH_ERROR');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "Store" (
  "id" UUID NOT NULL,
  "hostname" VARCHAR(253) NOT NULL,
  "name" VARCHAR(253) NOT NULL,
  "profileKey" VARCHAR(100) NOT NULL DEFAULT 'generic',
  "profileVersion" INTEGER NOT NULL DEFAULT 1,
  "profileStatus" "StoreProfileStatus" NOT NULL DEFAULT 'GENERIC',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "name" VARCHAR(500),
  "url" TEXT NOT NULL,
  "normalizedUrl" TEXT NOT NULL,
  "imageUrl" TEXT,
  "currentPrice" DECIMAL(18,4),
  "previousPrice" DECIMAL(18,4),
  "currency" VARCHAR(3),
  "targetPrice" DECIMAL(18,4),
  "inStock" BOOLEAN,
  "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "status" "ProductStatus" NOT NULL DEFAULT 'PENDING',
  "lastCheckedAt" TIMESTAMPTZ(3),
  "lastSuccessfulCheckAt" TIMESTAMPTZ(3),
  "lastErrorCode" VARCHAR(100),
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchBinding" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "externalWatchId" VARCHAR(100) NOT NULL,
  "requestedFetchMode" "WatchFetchMode" NOT NULL DEFAULT 'AUTO',
  "fetchMode" "WatchFetchMode" NOT NULL,
  "lastSyncAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WatchBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceSnapshot" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "price" DECIMAL(18,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "observedAt" TIMESTAMPTZ(3) NOT NULL,
  "sourceEventKey" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockSnapshot" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "inStock" BOOLEAN NOT NULL,
  "availableSizes" JSONB,
  "observedAt" TIMESTAMPTZ(3) NOT NULL,
  "sourceEventKey" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventLog" (
  "id" UUID NOT NULL,
  "productId" UUID,
  "type" VARCHAR(100) NOT NULL,
  "code" VARCHAR(100),
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppSetting" (
  "key" VARCHAR(150) NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "NotificationDelivery" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "sourceEventKey" VARCHAR(128) NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'TELEGRAM',
  "type" "NotificationType" NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3),
  "lockedAt" TIMESTAMPTZ(3),
  "sentAt" TIMESTAMPTZ(3),
  "lastErrorCode" VARCHAR(100),
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Store_hostname_key" ON "Store"("hostname");
CREATE UNIQUE INDEX "Product_storeId_normalizedUrl_key" ON "Product"("storeId", "normalizedUrl");
CREATE INDEX "Product_status_lastSuccessfulCheckAt_idx" ON "Product"("status", "lastSuccessfulCheckAt");
CREATE INDEX "Product_updatedAt_idx" ON "Product"("updatedAt");
CREATE UNIQUE INDEX "WatchBinding_productId_key" ON "WatchBinding"("productId");
CREATE UNIQUE INDEX "WatchBinding_externalWatchId_key" ON "WatchBinding"("externalWatchId");
CREATE UNIQUE INDEX "PriceSnapshot_sourceEventKey_key" ON "PriceSnapshot"("sourceEventKey");
CREATE INDEX "PriceSnapshot_productId_observedAt_idx" ON "PriceSnapshot"("productId", "observedAt" DESC);
CREATE UNIQUE INDEX "StockSnapshot_sourceEventKey_key" ON "StockSnapshot"("sourceEventKey");
CREATE INDEX "StockSnapshot_productId_observedAt_idx" ON "StockSnapshot"("productId", "observedAt" DESC);
CREATE INDEX "EventLog_productId_createdAt_idx" ON "EventLog"("productId", "createdAt" DESC);
CREATE INDEX "EventLog_type_createdAt_idx" ON "EventLog"("type", "createdAt" DESC);
CREATE UNIQUE INDEX "NotificationDelivery_sourceEventKey_channel_type_key" ON "NotificationDelivery"("sourceEventKey", "channel", "type");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX "NotificationDelivery_lockedAt_idx" ON "NotificationDelivery"("lockedAt");

ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WatchBinding" ADD CONSTRAINT "WatchBinding_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockSnapshot" ADD CONSTRAINT "StockSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
