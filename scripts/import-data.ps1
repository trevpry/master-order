# Master Order Data Import Script (PowerShell)
# Imports data from hosted PostgreSQL to local SQLite or production PostgreSQL

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("local", "production")]
    [string]$Target,
    
    [Parameter(Mandatory=$true)]
    [string]$Source,
    
    [switch]$NoBackup,
    [switch]$Force,
    [string]$Tables
)

# Colors for output
function Write-Status { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Write-Success { param($msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "[WARNING] $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackupEnabled = -not $NoBackup.IsPresent
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Status "Master Order Data Import (PowerShell)"
Write-Status "Target: $Target"
Write-Status "Source: $Source"

# Check prerequisites
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Write-Error "pg_dump not found. Please install PostgreSQL client tools."
    exit 1
}

if ($Target -eq "production" -and -not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker not found. Required for production import."
    exit 1
}

# Load import environment if exists
$ImportEnvFile = Join-Path $ProjectRoot ".env.import"
if (Test-Path $ImportEnvFile) {
    Write-Status "Loading import configuration..."
    Get-Content $ImportEnvFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

# Create backup if enabled
if ($BackupEnabled) {
    Write-Status "Creating backup before import..."
    
    if ($Target -eq "local") {
        $DbFile = Join-Path $ProjectRoot "master_order.db"
        if (Test-Path $DbFile) {
            $BackupFile = Join-Path $ProjectRoot "master_order_backup_$Timestamp.db"
            Copy-Item $DbFile $BackupFile
            Write-Success "Local backup created: $(Split-Path -Leaf $BackupFile)"
        }
    } else {
        # Production backup
        $ContainerRunning = docker ps --format "table {{.Names}}" | Select-String "master-order-postgres"
        if ($ContainerRunning) {
            $BackupFile = Join-Path $ProjectRoot "master_order_prod_backup_$Timestamp.sql"
            docker exec master-order-postgres pg_dump -U postgres master_order | Out-File -FilePath $BackupFile -Encoding UTF8
            Write-Success "Production backup created: $(Split-Path -Leaf $BackupFile)"
        } else {
            Write-Warning "Could not create production backup - Docker container not running"
        }
    }
}

# Export data from source
Write-Status "Exporting data from source database..."
$ExportFile = Join-Path $env:TEMP "master_order_export_$Timestamp.sql"

try {
    if ($Tables) {
        # Export specific tables
        $TableArgs = @()
        $Tables.Split(',') | ForEach-Object { $TableArgs += "--table=$($_.Trim())" }
        
        $pgDumpArgs = @($Source) + $TableArgs + @("--data-only", "--disable-triggers")
        & pg_dump @pgDumpArgs | Out-File -FilePath $ExportFile -Encoding UTF8
        Write-Success "Exported tables: $Tables"
    } else {
        # Export all data
        pg_dump $Source --clean --if-exists --disable-triggers | Out-File -FilePath $ExportFile -Encoding UTF8
        Write-Success "Exported complete database"
    }
} catch {
    Write-Error "Failed to export from source database: $_"
    exit 1
}

# Validate export
if (-not (Test-Path $ExportFile) -or (Get-Item $ExportFile).Length -eq 0) {
    Write-Error "Export failed - file is empty or missing"
    exit 1
}

$ExportSize = [math]::Round((Get-Item $ExportFile).Length / 1MB, 2)
Write-Status "Export file size: $ExportSize MB"

# Import based on target environment
if ($Target -eq "local") {
    Write-Status "Converting PostgreSQL export to SQLite format..."
    
    # Simple conversion for PowerShell (basic version)
    $SqliteFile = Join-Path $env:TEMP "master_order_sqlite_$Timestamp.sql"
    $Content = Get-Content $ExportFile
    
    # Basic PostgreSQL to SQLite conversions
    $Content = $Content -replace 'SERIAL PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT'
    $Content = $Content -replace 'SERIAL', 'INTEGER'
    $Content = $Content -replace 'BIGSERIAL', 'INTEGER'
    $Content = $Content -replace 'BOOLEAN', 'INTEGER'
    $Content = $Content -replace '\bTRUE\b', '1'
    $Content = $Content -replace '\bFALSE\b', '0'
    $Content = $Content -replace 'TIMESTAMP WITH TIME ZONE', 'TEXT'
    $Content = $Content -replace 'TIMESTAMP WITHOUT TIME ZONE', 'TEXT'
    $Content = $Content -replace 'TIMESTAMP', 'TEXT'
    $Content = $Content -replace 'JSONB', 'TEXT'
    $Content = $Content -replace 'JSON', 'TEXT'
    $Content = $Content -replace 'UUID', 'TEXT'
    
    # Remove PostgreSQL-specific lines
    $Content = $Content | Where-Object { 
        $_ -notmatch '^SET ' -and 
        $_ -notmatch '^SELECT pg_catalog' -and 
        $_ -notmatch '^--.*PostgreSQL' -and 
        $_ -notmatch '^\\connect' -and 
        $_ -notmatch '^CREATE EXTENSION' -and 
        $_ -notmatch '^DROP EXTENSION' -and 
        $_ -notmatch '^COMMENT ON' -and 
        $_ -notmatch '^ALTER DEFAULT PRIVILEGES' -and 
        $_ -notmatch '^GRANT ' -and 
        $_ -notmatch '^REVOKE '
    }
    
    # Add SQLite pragmas
    $SqliteContent = @(
        "-- SQLite import optimizations",
        "PRAGMA foreign_keys = OFF;",
        "PRAGMA synchronous = OFF;",
        "PRAGMA journal_mode = MEMORY;",
        "PRAGMA temp_store = MEMORY;",
        "PRAGMA cache_size = 1000000;",
        "",
        "BEGIN TRANSACTION;",
        ""
    ) + $Content + @(
        "",
        "COMMIT;",
        "PRAGMA foreign_keys = ON;",
        "PRAGMA synchronous = NORMAL;",
        "PRAGMA journal_mode = WAL;"
    )
    
    $SqliteContent | Out-File -FilePath $SqliteFile -Encoding UTF8
    
    # Import to SQLite
    Write-Status "Importing to local SQLite database..."
    Set-Location $ProjectRoot
    
    # Setup SQLite schema if needed
    Set-Location "$ProjectRoot\server"
    npm run setup-schema:sqlite
    Set-Location $ProjectRoot
    
    # Import data
    if (Get-Command sqlite3 -ErrorAction SilentlyContinue) {
        sqlite3 master_order.db ".read $SqliteFile"
        Write-Success "Import to SQLite completed"
    } else {
        Write-Error "sqlite3 command not found. Please install SQLite."
        exit 1
    }
    
    # Cleanup
    Remove-Item $SqliteFile -ErrorAction SilentlyContinue
    
} else {
    # Production PostgreSQL import
    Write-Status "Importing to production PostgreSQL..."
    
    $ContainerRunning = docker ps --format "table {{.Names}}" | Select-String "master-order-postgres"
    if (-not $ContainerRunning) {
        Write-Error "Production PostgreSQL container is not running"
        exit 1
    }
    
    # Import to production PostgreSQL
    Get-Content $ExportFile | docker exec -i master-order-postgres psql -U postgres master_order
    Write-Success "Import to production PostgreSQL completed"
}

# Cleanup export file
Remove-Item $ExportFile -ErrorAction SilentlyContinue

# Validate import
Write-Status "Validating imported data..."

if ($Target -eq "local") {
    # SQLite validation
    $RecordCount = sqlite3 master_order.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
    Write-Status "Tables imported: $RecordCount"
    
    # Check for data in main tables
    @('orders', 'episodes', 'movies') | ForEach-Object {
        $tableName = $_
        try {
            $Count = sqlite3 master_order.db "SELECT COUNT(*) FROM $tableName;"
            Write-Status "${tableName}: $Count records"
        } catch {
            Write-Status "${tableName}: Table not found or empty"
        }
    }
} else {
    # PostgreSQL validation
    $TableCount = docker exec master-order-postgres psql -U postgres master_order -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | ForEach-Object { $_.Trim() }
    Write-Status "Tables imported: $TableCount"
    
    # Check for data in main tables
    @('orders', 'episodes', 'movies') | ForEach-Object {
        $tableName = $_
        try {
            $Count = docker exec master-order-postgres psql -U postgres master_order -t -c "SELECT COUNT(*) FROM $tableName;" | ForEach-Object { $_.Trim() }
            Write-Status "${tableName}: $Count records"
        } catch {
            Write-Status "${tableName}: Unable to count records"
        }
    }
}

Write-Success "Data import completed successfully!"

Write-Status "Post-import recommendations:"
Write-Host "1. Test the application to ensure all features work correctly"
Write-Host "2. Verify data integrity by checking key records"
Write-Host "3. Update any API keys or settings that may have been overwritten"
Write-Host "4. Consider running database optimization/vacuum"
Write-Host "5. Setup regular backups for the imported data"

if ($Target -eq "local") {
    Write-Host "6. Start the development server: npm run dev"
} else {
    Write-Host "6. Restart the production container: docker-compose restart"
}

Write-Warning "Remember to test thoroughly before using in production!"