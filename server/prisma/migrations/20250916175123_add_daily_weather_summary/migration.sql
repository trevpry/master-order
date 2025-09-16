-- CreateTable
CREATE TABLE "DailyWeatherSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tempMin" REAL,
    "tempMax" REAL,
    "tempAvg" REAL,
    "humidity" INTEGER,
    "precipitation" REAL,
    "windSpeed" REAL,
    "pressure" REAL,
    "cloudiness" INTEGER,
    "sunrise" TEXT,
    "sunset" TEXT,
    "weatherData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyWeatherSummary_date_key" ON "DailyWeatherSummary"("date");
