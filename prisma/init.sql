CREATE TABLE IF NOT EXISTS "OrderLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "driver_id" TEXT NOT NULL,
  "timestamp" BIGINT NOT NULL,
  "formatted_date" TEXT NOT NULL,
  "service_type" TEXT NOT NULL,
  "latitude" REAL,
  "longitude" REAL,
  "weather_status" TEXT,
  "gross_fare" INTEGER,
  "commission_cut" INTEGER,
  "net_fare" INTEGER,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "FinanceLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "driver_id" TEXT NOT NULL,
  "timestamp" BIGINT NOT NULL,
  "formatted_date" TEXT NOT NULL,
  "entry_type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "driver_id" TEXT NOT NULL,
  "commission_rate" INTEGER NOT NULL DEFAULT 10,
  "current_virtual_balance" INTEGER NOT NULL DEFAULT 0,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserSettings_driver_id_key" ON "UserSettings"("driver_id");
