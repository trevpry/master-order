@echo off
REM Build script for Master Order Docker image (Windows)

echo 🏗️  Building Master Order Docker Image

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the project root directory.
    exit /b 1
)

REM Set image name and tag
set IMAGE_NAME=master-order
set IMAGE_TAG=latest
set FULL_IMAGE_NAME=%IMAGE_NAME%:%IMAGE_TAG%

echo 📋 Building image: %FULL_IMAGE_NAME%

REM Build the Docker image
docker build -t %FULL_IMAGE_NAME% .

if %errorlevel% neq 0 (
    echo ❌ Build failed!
    exit /b 1
)

echo ✅ Build completed successfully!

REM Optional: Show image size
echo 📊 Image information:
docker images %IMAGE_NAME%

echo.
echo 🚀 To run the container:
echo    docker run -d --name master-order -p 3001:3001 -v "%cd%\data:/app/data" %FULL_IMAGE_NAME%
echo.
echo 🐳 To use with docker-compose:
echo    docker-compose up -d
echo.
echo 📦 To save image for transfer:
echo    docker save %FULL_IMAGE_NAME% | gzip > master-order-docker-image.tar.gz
