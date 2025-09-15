# 🚀 Updated Unraid Deployment Script
## Complete History Plus Migration Integration

The `update-unraid.sh` script has been enhanced to handle complete History Plus data migration during PostgreSQL deployment.

---

## 🔧 **Enhanced Features**

### ✅ **Pre-Flight Safety Checks**
- Validates all required migration files are present
- Tests PostgreSQL connection before any operations
- Verifies repository structure and dependencies

### ✅ **Comprehensive Backup Strategy**
- **SQLite backup**: Preserves existing database (as before)
- **PostgreSQL backup**: Creates backup of target database
- **Backup rotation**: Keeps last 10 backups automatically
- **Backup verification**: Confirms backup integrity

### ✅ **Automatic History Plus Migration**
- **Detection**: Automatically detects if SQLite database contains History Plus data
- **Migration**: Runs complete data migration to PostgreSQL
- **Validation**: Verifies migration integrity post-completion
- **Logging**: Detailed migration logs for troubleshooting
- **Rollback**: Interactive rollback options if migration fails

### ✅ **Production Deployment**
- **Clean rebuild**: Forces clean Docker image rebuild
- **PostgreSQL configuration**: Automatically configures PostgreSQL environment
- **Health validation**: Runs post-deployment validation if script available
- **Status monitoring**: Comprehensive deployment status reporting

---

## 🎯 **Usage**

### **Simple Execution**
```bash
# Run on your Unraid server
./update-unraid.sh
```

### **What It Does Automatically**
1. **Pre-flight checks** - Validates environment and requirements
2. **PostgreSQL connectivity** - Tests database connection
3. **Backup creation** - Backs up both SQLite and PostgreSQL
4. **Code update** - Pulls latest code from GitHub
5. **History Plus migration** - Migrates all data if SQLite database exists
6. **Container rebuild** - Builds fresh container with latest code
7. **Deployment** - Starts container with PostgreSQL configuration
8. **Validation** - Tests deployment and provides status report

---

## 🛡️ **Safety Features**

### **Automatic Rollback Options**
If History Plus migration fails, the script provides:
- **Interactive choice**: Continue anyway or abort deployment
- **Detailed logs**: Complete migration log for troubleshooting
- **Rollback instructions**: Step-by-step recovery procedures
- **Backup preservation**: All backups retained for manual recovery

### **Data Protection**
- **Transaction safety**: All migrations use database transactions
- **Backup verification**: Confirms backups are valid before proceeding
- **Connection testing**: Validates PostgreSQL before any operations
- **Error handling**: Graceful error handling with clear messages

---

## 📊 **Configuration Variables**

The script uses these configurable settings at the top:

```bash
# PostgreSQL Configuration
POSTGRES_HOST="192.168.1.119"
POSTGRES_PORT="5432" 
POSTGRES_DB="master_order"
POSTGRES_USER="master_order_user"
POSTGRES_PASSWORD="secure_password_change_me"
```

**Update these values** to match your PostgreSQL setup before running.

---

## 📋 **Migration Process**

### **When SQLite Database Exists:**
1. ✅ Connects to both SQLite and PostgreSQL
2. ✅ Analyzes source data structure
3. ✅ Migrates in dependency order:
   - Historical events
   - Videos, books, chapters, sections, channels
   - User progress (watches, reads, reviews)
4. ✅ Validates data integrity
5. ✅ Generates migration report
6. ✅ Continues with container deployment

### **When No SQLite Database:**
- Skips migration step
- Proceeds directly to container deployment
- Uses PostgreSQL as primary database

---

## 📝 **Logging & Monitoring**

### **Migration Log**
- **Location**: `$BACKUP_DIR/history-plus-migration.log`
- **Content**: Complete migration process with timestamps
- **Usage**: Troubleshooting and verification

### **Backup Locations**
- **SQLite backups**: `$BACKUP_DIR/master_order_backup_[timestamp].db`
- **PostgreSQL backups**: `$BACKUP_DIR/postgresql_backup_[timestamp].sql`
- **Automatic cleanup**: Retains last 10 backups

### **Validation Checklist**
The script provides a post-deployment checklist:
- ✅ Web interface accessibility
- ✅ History Plus timeline functionality
- ✅ Up Next integration
- ✅ Android API endpoints
- ✅ Video/book completion workflows

---

## 🔙 **Rollback Procedures**

### **If Migration Fails:**
```bash
# 1. Stop container
docker stop master-order

# 2. Restore PostgreSQL backup
psql "postgresql://..." < /path/to/backup.sql

# 3. Restart container
docker start master-order
```

### **If Deployment Fails:**
- All backups preserved in `$BACKUP_DIR`
- Previous container image can be restored
- Manual migration possible using standalone scripts

---

## ⚡ **Quick Reference**

### **First-Time PostgreSQL Setup:**
1. Update PostgreSQL configuration variables in script
2. Ensure PostgreSQL database and user exist
3. Run `./update-unraid.sh` - it handles everything else

### **Regular Updates:**
- Simply run `./update-unraid.sh`
- Script detects if migration is needed
- Updates code and redeploys automatically

### **Emergency Restore:**
1. Check `$BACKUP_DIR` for latest backups
2. Use provided rollback instructions
3. Consult migration log for specific issues

---

## 🎉 **Benefits of Enhanced Script**

- **Zero-downtime migration**: Automated History Plus data migration
- **Safety first**: Multiple backup layers and rollback options
- **Unraid optimized**: Maintains all existing Unraid-specific configuration
- **Production ready**: Handles all edge cases and error scenarios
- **Comprehensive logging**: Full audit trail of all operations

**The updated script is your one-stop solution for deploying History Plus with PostgreSQL on Unraid.**

---

*Updated: September 12, 2025*  
*Compatible with: Unraid, PostgreSQL, History Plus data migration*