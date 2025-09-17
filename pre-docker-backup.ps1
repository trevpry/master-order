# CRITICAL DATA SAFETY SCRIPT FOR WINDOWS
# This script creates automatic backups before any Docker operations

$ErrorActionPreference = "Stop"

$RepoPath = Get-Location
$BackupDir = Join-Path $RepoPath "database-backups"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "🛡️  CRITICAL DATA SAFETY CHECK - Master Order Database Backup" -ForegroundColor Yellow
Write-Host "📅 Backup Date: $(Get-Date)" -ForegroundColor White
Write-Host "📁 Repository Path: $RepoPath" -ForegroundColor White

# Create backup directory if it doesn't exist
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

function Create-Backup {
    param(
        [string]$SourceFile,
        [string]$BackupName
    )
    
    if (Test-Path $SourceFile) {
        $BackupFile = Join-Path $BackupDir "${BackupName}_$Timestamp.db"
        Write-Host "💾 Creating backup: $BackupFile" -ForegroundColor Cyan
        
        Copy-Item $SourceFile $BackupFile
        
        # Validate backup
        if (Test-Path $BackupFile) {
            $OriginalSize = (Get-Item $SourceFile).Length
            $BackupSize = (Get-Item $BackupFile).Length
            
            Write-Host "📊 Original size: $OriginalSize bytes" -ForegroundColor White
            Write-Host "📊 Backup size: $BackupSize bytes" -ForegroundColor White
            
            if ($OriginalSize -eq $BackupSize -and $BackupSize -gt 0) {
                Write-Host "✅ Backup validated successfully!" -ForegroundColor Green
                Write-Host "📂 Backup location: $BackupFile" -ForegroundColor Green
                return $true
            } else {
                Write-Host "❌ Backup validation failed! Size mismatch or empty file." -ForegroundColor Red
                return $false
            }
        } else {
            Write-Host "❌ Backup file creation failed!" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "⚠️  Source file not found: $SourceFile" -ForegroundColor Yellow
        return $false
    }
}

# Check for existing databases and create backups
$BackupCreated = $false

# Check main database file
$MainDbPath = Join-Path $RepoPath "master_order.db"
if (Test-Path $MainDbPath) {
    Write-Host "🔍 Found main database file" -ForegroundColor White
    if (Create-Backup $MainDbPath "pre_docker_main") {
        $BackupCreated = $true
    }
}

# Check server database file
$ServerDbPath = Join-Path $RepoPath "server\master_order.db"
if (Test-Path $ServerDbPath) {
    Write-Host "🔍 Found server database file" -ForegroundColor White
    if (Create-Backup $ServerDbPath "pre_docker_server") {
        $BackupCreated = $true
    }
}

# Check for running container database
$ContainerName = "master-order"
try {
    $RunningContainers = docker ps --format "{{.Names}}"
    if ($RunningContainers -contains $ContainerName) {
        Write-Host "🔍 Found running container, checking for database..." -ForegroundColor White
        
        # Try to backup from container
        try {
            docker exec $ContainerName test -f /app/master_order.db 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "💾 Backing up from running container..." -ForegroundColor Cyan
                $ContainerBackupPath = Join-Path $BackupDir "pre_docker_container_$Timestamp.db"
                docker cp "${ContainerName}:/app/master_order.db" $ContainerBackupPath
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Container database backup completed!" -ForegroundColor Green
                    $BackupCreated = $true
                }
            }
        } catch {
            # Try alternative path
            try {
                docker exec $ContainerName test -f /app/data/master_order.db 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "💾 Backing up from container data directory..." -ForegroundColor Cyan
                    $ContainerDataBackupPath = Join-Path $BackupDir "pre_docker_container_data_$Timestamp.db"
                    docker cp "${ContainerName}:/app/data/master_order.db" $ContainerDataBackupPath
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "✅ Container data directory backup completed!" -ForegroundColor Green
                        $BackupCreated = $true
                    }
                }
            } catch {
                Write-Host "⚠️  Could not access container database files" -ForegroundColor Yellow
            }
        }
    }
} catch {
    Write-Host "⚠️  Docker not available or container not running" -ForegroundColor Yellow
}

# List existing backups
Write-Host ""
Write-Host "📋 EXISTING BACKUPS:" -ForegroundColor White
if (Test-Path $BackupDir) {
    $BackupFiles = Get-ChildItem -Path $BackupDir -Filter "*.db" | Sort-Object LastWriteTime -Descending
    if ($BackupFiles.Count -gt 0) {
        foreach ($File in $BackupFiles) {
            $Size = [math]::Round($File.Length / 1MB, 2)
            Write-Host "   $($File.Name) - $Size MB - $($File.LastWriteTime)" -ForegroundColor White
        }
    } else {
        Write-Host "   No existing backups found" -ForegroundColor Yellow
    }
} else {
    Write-Host "   No backup directory found" -ForegroundColor Yellow
}

if ($BackupCreated) {
    Write-Host ""
    Write-Host "✅ DATA SAFETY VERIFIED - Backup(s) created successfully!" -ForegroundColor Green
    Write-Host "🚀 Safe to proceed with Docker operations." -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 RESTORE INSTRUCTIONS:" -ForegroundColor Cyan
    Write-Host "   To restore from backup, copy the backup file over your main database:" -ForegroundColor White
    Write-Host "   Copy-Item '$BackupDir\[backup_file].db' '$MainDbPath'" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "⚠️  WARNING: No database files found to backup!" -ForegroundColor Yellow
    Write-Host "   This might be normal for a fresh installation." -ForegroundColor White
    Write-Host "   If you expected to find data, please check your file locations." -ForegroundColor White
    Write-Host ""
}

Write-Host "🛡️  DATA SAFETY CHECK COMPLETE" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Gray