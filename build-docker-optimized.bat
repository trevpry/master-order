@echo off
REM Docker Build Script - OPTIMIZED VERSION (Windows)
REM This script uses Docker BuildKit for faster, cached builds
REM 
REM BuildKit features used:
REM - Layer caching: Reuses unchanged layers
REM - Cache mounts: Speeds up npm installs
REM - Parallel builds: Builds stages concurrently where possible
REM
REM 🔒 DATA SAFETY: This optimized build is 100% PostgreSQL data safe
REM - Build optimizations only affect layer caching (build time)
REM - Production runtime behavior IDENTICAL to original
REM - Same entrypoint, same data protection, same migrations
REM - See DOCKER_OPTIMIZED_DATA_SAFETY.md for verification
REM
REM Usage:
REM   build-docker-optimized.bat          # Build with cache
REM   build-docker-optimized.bat --no-cache  # Force full rebuild

echo.
echo 🚀 Building Master Order with OPTIMIZED caching...
echo 🔒 Data Safety: 100% PostgreSQL data safe (identical runtime to original)
echo.

REM Enable BuildKit for better caching and performance
set DOCKER_BUILDKIT=1
set COMPOSE_DOCKER_CLI_BUILD=1

REM Check if --no-cache flag is passed
if "%1"=="--no-cache" (
    echo ⚠️  Building WITHOUT cache (full rebuild)...
    docker build --no-cache -f Dockerfile.optimized -t master-order:latest .
) else (
    echo ✅ Building WITH cache (incremental rebuild)...
    docker build -f Dockerfile.optimized -t master-order:latest .
)

echo.
echo ✅ Build complete!
echo.
echo 📊 Build stats:
docker images master-order:latest --format "Size: {{.Size}}"
echo.
echo 🎯 Next steps:
echo    docker-compose up -d              # Start the container
echo    docker logs -f master-order       # View logs
