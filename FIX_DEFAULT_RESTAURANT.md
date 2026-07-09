# Fix Domain Routing: gandikotadosa.in Shows Default Restaurant

**Issue:** `https://www.gandikotadosa.in/#order` shows "Default Restaurant" (Miyapur) instead of Gandikota

**Root Cause:** The environment variable `PUBLIC_DEFAULT_RESTAURANT_CODE` is not set on Render

---

## ✅ Complete Fix (2 Steps)

### **Step 1: Update Your Database** 🗄️

Your database currently has a restaurant with code `'default'`. We need to rename it to `'gandikotadosa'`.

**Option A: Using Render Database Console (Easiest)**

1. Go to **Render Dashboard** → **PostgreSQL Database** → **Connect**
2. Click **Open** in Render Data Browser (or copy connection string)
3. Run this SQL command:

```sql
UPDATE restaurants 
SET code = 'gandikotadosa', 
    name = 'Gandikota',
    updated_at = CURRENT_TIMESTAMP
WHERE code = 'default';
```

4. Verify it worked:
```sql
SELECT id, code, name, address FROM restaurants;
```

Should show:
```
 id | code           | name       | address
----|----------------|------------|----------
  1 | gandikotadosa  | Gandikota  | Miyapur
```

---

**Option B: Using SQL File**

If you have direct database access (pgAdmin, DBeaver, etc.):

1. Download: [DATABASE_UPDATE_GANDIKOTA.sql](DATABASE_UPDATE_GANDIKOTA.sql)
2. Run the SQL file in your database client
3. Or copy the SQL and run manually

---

### **Step 2: Set Environment Variable on Render** 🔧

Now tell your server to use 'gandikotadosa' as the default:

1. Go to **Render Dashboard** → Your Service → **Settings**
2. Scroll to **Environment** section
3. Click **Add Environment Variable** or edit existing
4. Add:
   - **Key:** `PUBLIC_DEFAULT_RESTAURANT_CODE`
   - **Value:** `gandikotadosa`
5. Click **Save Changes** (automatic redeploy)
6. Wait for deployment to complete (usually 1-2 minutes)

---

## 🧪 Test It

After both steps complete:

1. Clear browser cache: `Ctrl+Shift+Delete`
2. Visit: `https://www.gandikotadosa.in/#order`
3. Should now show **"Gandikota"** restaurant ✅

---

## 📋 What This Does

### Before (Current):
```
URL: https://www.gandikotadosa.in/#order
      ↓
Server: "No restaurant code set, using 'default'"
      ↓
Database: Finds 'default' restaurant
      ↓
Shows: Default Restaurant (Miyapur) ❌
```

### After (Fixed):
```
URL: https://www.gandikotadosa.in/#order
      ↓
Server: "PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa"
      ↓
Database: Finds 'gandikotadosa' restaurant
      ↓
Shows: Gandikota ✅
```

---

## 🔍 Troubleshooting

### Still showing "Default Restaurant"?

1. **Did you update the database?**
   - Run: `SELECT code FROM restaurants;`
   - Should show `gandikotadosa`, not `default`
   - If still showing `default`, run the UPDATE SQL again

2. **Did you set the environment variable?**
   - Check Render Settings → Environment
   - Confirm: `PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa`

3. **Did you wait for Render to redeploy?**
   - After saving env var, Render auto-redeploys
   - Wait 1-2 minutes for new server to start
   - Check Render Logs → should see new deployment

4. **Did you clear browser cache?**
   - Press: `Ctrl+Shift+Delete` on Windows
   - Or: Open in Incognito/Private window
   - Or: Hard refresh: `Ctrl+F5`

5. **Check server logs** (on Render):
   - Look for: `"Restaurant resolved: gandikotadosa"` ✅
   - If you see: `"Using default restaurant"` ❌ then env variable not set

---

## 📝 Summary

| Step | What | Where | Value |
|------|------|-------|-------|
| 1 | Update Database | SQL: `UPDATE restaurants...` | Change `default` → `gandikotadosa` |
| 2 | Set Environment Variable | Render Settings → Environment | `PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa` |
| 3 | Redeploy | Click "Manual Deploy" | Wait 1-2 minutes |
| 4 | Test | Browser | `https://www.gandikotadosa.in/#order` |

---

## ✨ Result

Your domain will now:
- ✅ Show Gandikota restaurant automatically
- ✅ No need for `/gandikotadosa` in URL
- ✅ Works for both `gandikotadosa.in` and `www.gandikotadosa.in`

---

## 📞 Still Having Issues?

Check:
1. Database has `gandikotadosa` record ← Run SQL SELECT to verify
2. Environment variable is set on Render ← Check Settings
3. Server has redeployed ← Check Render logs
4. Browser cache cleared ← Ctrl+Shift+Delete
5. Correct URL visited ← `https://www.gandikotadosa.in/#order`

**Questions?** See [QUICK_FIX_DOMAIN_ROUTING.md](QUICK_FIX_DOMAIN_ROUTING.md) or [DOMAIN_ROUTING_GUIDE.md](DOMAIN_ROUTING_GUIDE.md) for more details.
