# Production Backup and Rollback Scripts for History Plus Deployment (PowerShell)
# Ensures data safety during PostgreSQL production deployment

param(
    [switch]$SkipPostgreSQL = $false,
    [string]$BackupDir = "./backups"
)

# Configuration
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$postgresBackupFile = "$BackupDir/postgresql_backup_$timestamp.sql"
$sqliteBackupFile = "$BackupDir/sqlite_backup_$timestamp.db"

# Functions
function Write-Info($message) {
    Write-Host "ℹ️  $message" -ForegroundColor Blue
}

function Write-Success($message) {
    Write-Host "✅ $message" -ForegroundColor Green
}

function Write-Warning($message) {
    Write-Host "⚠️  $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "❌ $message" -ForegroundColor Red
}

function Create-BackupDirectory {
    Write-Info "Creating backup directory..."
    
    if (!(Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }
    
    Write-Success "Backup directory created: $BackupDir"
}

function Backup-SQLiteDatabase {
    Write-Info "Creating SQLite database backup..."
    
    if (Test-Path "master_order.db") {
        Copy-Item "master_order.db" $sqliteBackupFile
        Write-Success "SQLite backup created: $sqliteBackupFile"
    } else {
        Write-Warning "SQLite database not found, skipping SQLite backup"
    }
}

function Backup-PostgreSQLDatabase {
    if ($SkipPostgreSQL) {
        Write-Warning "PostgreSQL backup skipped (use -SkipPostgreSQL:$false to enable)"
        return
    }
    
    Write-Info "Creating PostgreSQL database backup..."
    
    $databaseUrl = $env:DATABASE_URL
    if ([string]::IsNullOrEmpty($databaseUrl)) {
        Write-Error "DATABASE_URL environment variable not set"
        exit 1
    }
    
    # Check if pg_dump is available
    try {
        $null = Get-Command pg_dump -ErrorAction Stop
    } catch {
        Write-Error "pg_dump not found. Please install PostgreSQL client tools"
        Write-Info "Download from: https://www.postgresql.org/download/windows/"
        exit 1
    }
    
    Write-Info "Running pg_dump..."
    try {
        & pg_dump $databaseUrl | Out-File -FilePath $postgresBackupFile -Encoding UTF8
        Write-Success "PostgreSQL backup created: $postgresBackupFile"
    } catch {
        Write-Error "PostgreSQL backup failed: $($_.Exception.Message)"
        exit 1
    }
}

function Test-BackupIntegrity {
    Write-Info "Verifying backup integrity..."
    
    # Check PostgreSQL backup
    if (Test-Path $postgresBackupFile) {
        $fileSize = (Get-Item $postgresBackupFile).Length
        if ($fileSize -gt 0) {
            Write-Success "PostgreSQL backup file is valid and non-empty ($fileSize bytes)"
        } else {
            Write-Error "PostgreSQL backup file is empty"
            exit 1
        }
    }
    
    # Check SQLite backup
    if (Test-Path $sqliteBackupFile) {
        $fileSize = (Get-Item $sqliteBackupFile).Length
        if ($fileSize -gt 0) {
            Write-Success "SQLite backup file is valid and non-empty ($fileSize bytes)"
        } else {
            Write-Error "SQLite backup file is empty"
            exit 1
        }
    }
}

function Create-RollbackScript {
    $rollbackScript = "$BackupDir/rollback_$timestamp.ps1"
    
    Write-Info "Creating rollback script..."
    
    $rollbackContent = @"
# Rollback script generated on $timestamp
# Use this script to restore from backup if deployment fails

param()

function Write-Info(`$message) {
    Write-Host "ℹ️  `$message" -ForegroundColor Blue
}

function Write-Success(`$message) {
    Write-Host "✅ `$message" -ForegroundColor Green
}

function Write-Error(`$message) {
    Write-Host "❌ `$message" -ForegroundColor Red
}

function Write-Warning(`$message) {
    Write-Host "⚠️  `$message" -ForegroundColor Yellow
}

Write-Host "🔙 Starting rollback process..." -ForegroundColor Yellow

# Stop Docker containers
Write-Info "Stopping Docker containers..."
try {
    docker-compose -f docker-compose.external-db.yml down
} catch {
    try {
        docker-compose down
    } catch {
        Write-Warning "Failed to stop containers with docker-compose"
    }
}

# Restore PostgreSQL database
if (Test-Path "$postgresBackupFile") {
    Write-Info "Restoring PostgreSQL database from backup..."
    
    `$databaseUrl = `$env:DATABASE_URL
    if ([string]::IsNullOrEmpty(`$databaseUrl)) {
        Write-Error "DATABASE_URL environment variable not set"
        exit 1
    }
    
    Write-Warning "This will DROP the current database. Press Ctrl+C to abort in 10 seconds..."
    Start-Sleep -Seconds 10
    
    try {
        # Drop and recreate schema
        psql `$databaseUrl -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
        Get-Content "$postgresBackupFile" | psql `$databaseUrl
        
        Write-Success "PostgreSQL database restored from backup"
    } catch {
        Write-Error "Failed to restore PostgreSQL database: `$(`$_.Exception.Message)"
        exit 1
    }
} else {
    Write-Error "PostgreSQL backup file not found: $postgresBackupFile"
    exit 1
}

# Restart containers
Write-Info "Restarting Docker containers..."
docker-compose -f docker-compose.external-db.yml up -d

Write-Success "Rollback completed successfully!"
Write-Info "Please verify that the application is working correctly"
"@

    $rollbackContent | Out-File -FilePath $rollbackScript -Encoding UTF8
    Write-Success "Rollback script created: $rollbackScript"
}

function Show-Summary {
    Write-Host ""
    Write-Success "=== BACKUP SUMMARY ==="
    Write-Host "Timestamp: $timestamp"
    Write-Host "PostgreSQL Backup: $postgresBackupFile"
    Write-Host "SQLite Backup: $sqliteBackupFile"
    Write-Host "Rollback Script: $BackupDir/rollback_$timestamp.ps1"
    Write-Host ""
    Write-Info "NEXT STEPS:"
    Write-Host "1. Run the History Plus data migration: node migrate-history-plus-data.js"
    Write-Host "2. Deploy with: docker-compose -f docker-compose.external-db.yml up -d"
    Write-Host "3. Test all functionality thoroughly"
    Write-Host "4. If issues occur, run the rollback script"
    Write-Host ""
}

# Main execution
function Main {
    Write-Info "🚀 Starting production backup process..."
    
    Create-BackupDirectory
    Backup-SQLiteDatabase
    Backup-PostgreSQLDatabase
    Test-BackupIntegrity
    Create-RollbackScript
    Show-Summary
    
    Write-Success "✅ Production backup process completed successfully!"
}

# Execute main function
Main