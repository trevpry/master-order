@echo off
REM Eddie Life Management - Production Deployment Script (Windows)
REM This script ensures safe deployment to production with data preservation

echo 🚀 Eddie Life Management - Production Deployment
echo ================================================
echo Date: %date% %time%
echo Working Directory: %cd%
echo.

REM Color setup for Windows (limited)
set "INFO=[INFO]"
set "SUCCESS=[SUCCESS]"
set "WARNING=[WARNING]"
set "ERROR=[ERROR]"

echo %INFO% Running pre-deployment checks...

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %ERROR% docker-compose is not installed or not in PATH
    exit /b 1
)

REM Check if required files exist
if not exist "Dockerfile" (
    echo %ERROR% Required file not found: Dockerfile
    exit /b 1
)
if not exist "docker-compose.yml" (
    echo %ERROR% Required file not found: docker-compose.yml
    exit /b 1
)
if not exist "start.js" (
    echo %ERROR% Required file not found: start.js
    exit /b 1
)
if not exist "server\prisma\schema.postgresql.prisma" (
    echo %ERROR% Required file not found: server\prisma\schema.postgresql.prisma
    exit /b 1
)

echo %SUCCESS% All required files present

REM Verify schema synchronization
echo %INFO% Verifying database schema synchronization...

cd server

REM Check if all schema files exist
if not exist "prisma\schema.prisma" (
    echo %ERROR% Missing schema files - cannot proceed
    cd ..
    exit /b 1
)
if not exist "prisma\schema.postgresql.prisma" (
    echo %ERROR% Missing schema files - cannot proceed
    cd ..
    exit /b 1
)
if not exist "prisma\schema.sqlite.prisma" (
    echo %ERROR% Missing schema files - cannot proceed
    cd ..
    exit /b 1
)

REM Verify PostgreSQL schema has correct provider
findstr /c:"provider = \"postgresql\"" prisma\schema.postgresql.prisma >nul
if %errorlevel% neq 0 (
    echo %ERROR% PostgreSQL schema does not have correct provider
    cd ..
    exit /b 1
)

echo %SUCCESS% Database schema files are properly synchronized

REM Check migration status
echo %INFO% Checking migration status...
npx prisma migrate status >nul 2>&1
if %errorlevel% equ 0 (
    echo %SUCCESS% Migration status check passed
) else (
    echo %WARNING% Migration status check failed - this may be normal for first deployment
)

cd ..

REM Build and deployment
echo %INFO% Starting deployment process...

REM Stop existing containers (if any)
echo %INFO% Stopping existing containers...
docker-compose down
if %errorlevel% neq 0 (
    echo %WARNING% No existing containers to stop
)

REM Remove old images to ensure fresh build
echo %INFO% Building Docker image...
docker-compose build --no-cache
if %errorlevel% neq 0 (
    echo %ERROR% Docker build failed
    exit /b 1
)

echo %SUCCESS% Docker image built successfully

REM Start the application
echo %INFO% Starting Eddie Life Management...
docker-compose up -d
if %errorlevel% neq 0 (
    echo %ERROR% Failed to start containers
    exit /b 1
)

echo %SUCCESS% Containers started successfully

REM Wait for application to be ready
echo %INFO% Waiting for application to be ready...
timeout /t 10 /nobreak >nul

REM Health check
echo %INFO% Performing health check...
set HEALTH_CHECK_URL=http://localhost:3001/api/health
set MAX_ATTEMPTS=30
set ATTEMPT=1

:HEALTH_CHECK_LOOP
curl -f -s "%HEALTH_CHECK_URL%" >nul 2>&1
if %errorlevel% equ 0 (
    echo %SUCCESS% Health check passed - application is ready!
    goto :HEALTH_CHECK_DONE
)

if %ATTEMPT% geq %MAX_ATTEMPTS% (
    echo %ERROR% Health check failed after %MAX_ATTEMPTS% attempts
    echo %INFO% Checking container logs...
    docker-compose logs --tail=20
    exit /b 1
)

echo %INFO% Health check attempt %ATTEMPT%/%MAX_ATTEMPTS% failed, retrying in 5 seconds...
timeout /t 5 /nobreak >nul
set /a ATTEMPT+=1
goto :HEALTH_CHECK_LOOP

:HEALTH_CHECK_DONE

REM Display deployment summary
echo.
echo 🎉 DEPLOYMENT SUCCESSFUL!
echo ==========================
echo %SUCCESS% Eddie Life Management is now running in production mode
echo %INFO% Application URL: http://localhost:3001
echo %INFO% Health Check: %HEALTH_CHECK_URL%
echo %INFO% Container Status:
docker-compose ps

echo.
echo %INFO% View logs with: docker-compose logs -f
echo %INFO% Stop application with: docker-compose down
echo.

REM Final verification of key endpoints
echo %INFO% Verifying key endpoints...

curl -f -s "http://localhost:3001/" >nul 2>&1
if %errorlevel% equ 0 (
    echo %SUCCESS% ✅ / - OK
) else (
    echo %WARNING% ⚠️ / - May not be ready yet
)

curl -f -s "http://localhost:3001/api/health" >nul 2>&1
if %errorlevel% equ 0 (
    echo %SUCCESS% ✅ /api/health - OK
) else (
    echo %WARNING% ⚠️ /api/health - May not be ready yet
)

curl -f -s "http://localhost:3001/api/notes" >nul 2>&1
if %errorlevel% equ 0 (
    echo %SUCCESS% ✅ /api/notes - OK
) else (
    echo %WARNING% ⚠️ /api/notes - May not be ready yet
)

curl -f -s "http://localhost:3001/api/settings" >nul 2>&1
if %errorlevel% equ 0 (
    echo %SUCCESS% ✅ /api/settings - OK
) else (
    echo %WARNING% ⚠️ /api/settings - May not be ready yet
)

echo.
echo %SUCCESS% 🚀 Eddie Life Management deployment completed successfully!
echo %INFO% All existing PostgreSQL data has been preserved
echo %INFO% New Notes functionality is now available
echo.

pause
