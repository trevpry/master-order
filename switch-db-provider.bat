@echo off
REM Schema switcher script for development vs production (Windows)
REM This script switches between SQLite and PostgreSQL based on DATABASE_PROVIDER environment variable

REM Read environment file
if exist .env.production (
    for /f "tokens=1,2 delims==" %%a in (.env.production) do (
        if "%%a"=="DATABASE_PROVIDER" set DATABASE_PROVIDER=%%b
    )
) else if exist .env (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if "%%a"=="DATABASE_PROVIDER" set DATABASE_PROVIDER=%%b
    )
)

set SCHEMA_FILE=server\prisma\schema.prisma

REM Backup current schema
copy "%SCHEMA_FILE%" "%SCHEMA_FILE%.backup" >nul

if "%DATABASE_PROVIDER%"=="sqlite" (
    echo Switching to SQLite schema...
    powershell -Command "(Get-Content '%SCHEMA_FILE%') -replace 'provider = \"postgresql\"', 'provider = \"sqlite\"' | Set-Content '%SCHEMA_FILE%'"
) else if "%DATABASE_PROVIDER%"=="postgresql" (
    echo Switching to PostgreSQL schema...
    powershell -Command "(Get-Content '%SCHEMA_FILE%') -replace 'provider = \"sqlite\"', 'provider = \"postgresql\"' | Set-Content '%SCHEMA_FILE%'"
) else (
    echo Unknown DATABASE_PROVIDER: %DATABASE_PROVIDER%
    echo Using current schema provider
)

echo Schema provider set to: %DATABASE_PROVIDER%
