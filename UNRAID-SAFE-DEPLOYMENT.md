# 🔒 UNRAID SAFE DEPLOYMENT GUIDE

## MANDATORY SAFETY VERIFICATION FOR UNRAID

**NEVER deploy on Unraid without running the safety verification first!**

### Step 1: Navigate to your project directory
```bash
cd /mnt/user/appdata/master-order-build/master-order
```

### Step 2: Make safety script executable
```bash
chmod +x verify-safety.sh
```

### Step 3: MANDATORY - Run safety verification
```bash
./verify-safety.sh
```

**This MUST show "DEPLOYMENT APPROVED" before proceeding!**

### Step 4: Only if safety verification passes, deploy
```bash
docker-compose down
docker-compose up --build -d
```

## 🚨 CRITICAL SAFETY RULES FOR UNRAID

### BEFORE every deployment:
1. **ALWAYS run `./verify-safety.sh` first**
2. **Wait for "DEPLOYMENT APPROVED" message**  
3. **If it shows any errors, STOP and fix them**
4. **Never skip the safety verification**

### RED FLAGS - STOP IMMEDIATELY if you see:
- ❌ "DANGER: Found 'migrate reset'"
- ❌ "DEPLOYMENT BLOCKED"
- ❌ Any error messages from verification
- ❌ "Data loss risk detected"

### SAFE INDICATORS - Proceed only if you see:
- ✅ "No dangerous commands detected"
- ✅ "Safety measures in place"  
- ✅ "DEPLOYMENT APPROVED"
- ✅ "Data safety verified"

## 📋 COMPLETE UNRAID DEPLOYMENT CHECKLIST

```bash
# 1. Navigate to project
cd /mnt/user/appdata/master-order-build/master-order

# 2. Make script executable (one time only)
chmod +x verify-safety.sh

# 3. MANDATORY safety check
./verify-safety.sh
# MUST see: "🎉 DEPLOYMENT APPROVED - Data safety verified"

# 4. Only if step 3 passes, deploy
docker-compose down
docker-compose up --build -d

# 5. Verify data still exists after deployment
docker exec postgresql16 psql -U master_order_user -d master_order -c "SELECT COUNT(*) FROM \"Settings\";"
```

## 🛡️ WHAT THE SAFETY SCRIPT CHECKS

### Scans for DANGEROUS commands that could delete data:
- `migrate reset` (the command that caused the data loss)
- `prisma migrate reset`
- `force-reset`
- `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, `DELETE FROM`

### Verifies SAFETY measures are present:
- `--accept-data-loss=false` (prevents destructive changes)
- `Will NOT attempt reset` (explicit safety promise)
- `DATA-SAFE` indicators
- `preserve your data` messaging

## 💾 BACKUP BEFORE DEPLOYMENT (RECOMMENDED)

```bash
# Create PostgreSQL backup before deployment
docker exec postgresql16 pg_dump -U master_order_user master_order > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup was created
ls -la backup_*.sql
```

## 🚀 QUICK UNRAID DEPLOYMENT

```bash
cd /mnt/user/appdata/master-order-build/master-order
./verify-safety.sh && docker-compose down && docker-compose up --build -d
```

**This ensures safety verification runs before every deployment.**

---

**Remember: The data loss incident will never happen again if you always run the safety verification first!**