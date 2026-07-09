# Domain Routing Configuration Guide - F3 Drivein

**Status:** Setup Instructions for Custom Domain Mapping  
**Date:** June 15, 2026

---

## Problem

Currently you have:
- ✗ Domain: `https://www.gandikotadosa.in/gandikotadosa#order` ← Works (but requires path)
- ✗ Domain: `https://www.gandikotadosa.in/#order` ← Shows default, not gandikota

**Goal:**
- ✓ Domain: `https://www.gandikotadosa.in/#order` → Shows gandikota restaurant
- ✓ Domain: `https://gandikotadosa.in/#order` → Shows gandikota restaurant

---

## Solution

### How It Works

The application supports two approaches:

#### **Approach 1: PUBLIC_DEFAULT_RESTAURANT_CODE (Simple, for single restaurant per domain)**

Best for: One restaurant per domain

```bash
# In your .env file:
PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa
```

**Effect:**
- `https://www.gandikotadosa.in/#order` → Shows gandikota restaurant
- `https://gandikotadosa.in/#order` → Shows gandikota restaurant
- No path required (`/gandikotadosa`)

---

#### **Approach 2: RESTAURANT_DOMAIN_MAP (Advanced, for multiple domains)**

Best for: Multiple restaurants or multiple domains

```bash
# In your .env file:
RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa,www.gandikotadosa.in:gandikotadosa
```

**Effect:**
- Maps `gandikotadosa.in` → gandikota restaurant
- Maps `www.gandikotadosa.in` → gandikota restaurant
- Both show correct restaurant without path

**Format:** `domain1:restaurantCode1,domain2:restaurantCode2`

---

## Configuration Steps

### Step 1: Update Your .env File

**Find your `.env` file** (in production, usually in Render/deployment platform)

**OPTION A: Simple (Recommended for single restaurant)**
```bash
PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa
```

**OPTION B: Advanced (For multiple domains)**
```bash
RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa,www.gandikotadosa.in:gandikotadosa
```

### Step 2: Restart Your Server

If deployed on Render:
1. Go to your Render dashboard
2. Click your service
3. Click "Manual Deploy" or redeploy

If running locally:
```bash
npm start
```

### Step 3: Test

Clear your browser cache and visit:
- `https://www.gandikotadosa.in/#order` → Should show gandikota
- `https://gandikotadosa.in/#order` → Should show gandikota

---

## Examples for Different Scenarios

### Scenario 1: Single Restaurant Domain (Your Case)

```bash
# .env configuration
PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa

# Result:
# https://gandikotadosa.in/#order → gandikota restaurant ✅
# https://www.gandikotadosa.in/#order → gandikota restaurant ✅
# https://gandikotadosa.in/gandikotadosa#order → gandikota restaurant ✅
```

---

### Scenario 2: Multiple Domains, Multiple Restaurants

```bash
# .env configuration
RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa,www.gandikotadosa.in:gandikotadosa,otherrestaurant.in:other

# Result:
# https://gandikotadosa.in/#order → gandikota restaurant ✅
# https://otherrestaurant.in/#order → other restaurant ✅
# https://mainsite.com/#order → still works (no mapping, uses default) ✅
```

---

### Scenario 3: Multiple Restaurant Codes on Same Domain

```bash
# .env configuration
RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa,dosa-restaurant.in:gandikotadosa

# Result:
# https://gandikotadosa.in/#order → gandikota restaurant
# https://dosa-restaurant.in/#order → gandikota restaurant (same restaurant, different domain)
```

---

## How the Routing Works

```
User visits: https://www.gandikotadosa.in/#order
                    ↓
    Server receives request
                    ↓
    Check RESTAURANT_DOMAIN_MAP for "www.gandikotadosa.in"
                    ↓
    Found: maps to "gandikotadosa"
                    ↓
    Load gandikota restaurant
                    ↓
    Show in browser ✅
```

---

## Troubleshooting

### Still showing default restaurant?

**Check 1: Did you restart the server?**
- Changes to .env require restart
- If on Render: do manual deploy
- If local: stop and `npm start`

**Check 2: Domain name mismatch**
- Check exact domain name
- Remove `http://` or `https://`
- Include/exclude `www.` as needed

Example correct format:
- ✅ `gandikotadosa.in:gandikotadosa`
- ✅ `www.gandikotadosa.in:gandikotadosa`
- ❌ `https://gandikotadosa.in` ← Wrong (has protocol)
- ❌ `http://www.gandikotadosa.in` ← Wrong (has protocol)

**Check 3: Browser cache**
- Clear browser cache
- Or open in private/incognito window
- Or try different browser

**Check 4: DNS resolution**
- Verify DNS points to your server
- Use: `nslookup gandikotadosa.in`
- Should resolve to your server IP

### Still doesn't work?

**Enable debugging** - Check server logs:
```bash
tail -f server.log | grep -i "domain\|restaurant"
```

Look for messages like:
- `Restaurant resolved: gandikota` ✅
- `Using default restaurant` ❌ (means domain not recognized)

---

## Environment Variable Syntax

### PUBLIC_DEFAULT_RESTAURANT_CODE

```bash
# Format: restaurant_code
PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa

# Single value only
```

### RESTAURANT_DOMAIN_MAP

```bash
# Format: domain1:code1,domain2:code2,domain3:code3

# Single mapping
RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa

# Multiple mappings
RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa,www.gandikotadosa.in:gandikotadosa

# Different domains, different restaurants
RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa,other.in:otherrestaurant

# Rules:
# ✅ Use commas to separate domain:code pairs
# ✅ Use colons to separate domain and code
# ✅ No spaces (spaces will be trimmed but best to avoid)
# ✅ Lowercase (automatically normalized)
# ❌ Don't include http:// or https://
# ❌ Don't include port numbers
# ❌ Don't include trailing slashes
```

---

## Production Deployment (Render)

### How to Set Environment Variables on Render

1. **Go to your Render service**
2. **Click "Settings"**
3. **Scroll to "Environment"**
4. **Add or Edit Variables:**

   | Key | Value |
   |-----|-------|
   | `PUBLIC_DEFAULT_RESTAURANT_CODE` | `gandikotadosa` |
   | OR: `RESTAURANT_DOMAIN_MAP` | `gandikotadosa.in:gandikotadosa,www.gandikotadosa.in:gandikotadosa` |

5. **Click "Save Changes"**
6. **Service automatically redeploys**

### Verify Deployment

```bash
# Check environment is set (SSH into server)
echo $PUBLIC_DEFAULT_RESTAURANT_CODE
echo $RESTAURANT_DOMAIN_MAP

# Check server logs
tail -100 server.log | grep -i domain
```

---

## URL Structure After Fix

### Before (Current)
```
https://www.gandikotadosa.in/gandikotadosa#order
                          └─ Path needed
```

### After (Fixed)
```
https://www.gandikotadosa.in/#order
                          └─ No path needed!
```

---

## DNS & Domain Setup

Make sure your domain DNS is configured correctly:

1. **Domain registrar** (e.g., GoDaddy, NameCheap, etc.)
2. **Add CNAME or A record:**
   - `gandikotadosa.in` → points to `your-render-url.onrender.com`
   - `www.gandikotadosa.in` → points to `your-render-url.onrender.com`
3. **Wait 24-48 hours for DNS propagation**
4. **Verify with:** `nslookup gandikotadosa.in`

---

## Code Behind the Scenes

How the routing works (for developers):

```javascript
// In server.js

// 1. Parse RESTAURANT_DOMAIN_MAP from .env
const RESTAURANT_DOMAIN_MAP = parseRestaurantDomainMap(
  process.env.RESTAURANT_DOMAIN_MAP || ''
);
// Result: Map { 'gandikotadosa.in' => 'gandikotadosa' }

// 2. When request comes in
function getRestaurantCodeForHost(req) {
  const host = normalizeHostname(req.headers['x-forwarded-host'] || req.headers.host);
  // host = 'www.gandikotadosa.in'
  
  return RESTAURANT_DOMAIN_MAP.get(host) || PUBLIC_DEFAULT_RESTAURANT_CODE || '';
  // Returns: 'gandikotadosa'
}

// 3. Load restaurant
const restaurant = await resolveRestaurantByCode('gandikotadosa');

// 4. Show in browser ✅
```

---

## Quick Reference

| Situation | Solution | Result |
|-----------|----------|--------|
| Single restaurant domain | `PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa` | `gandikotadosa.in/#order` shows gandikota |
| Multiple domains → same restaurant | `RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa,dosa.in:gandikotadosa` | Both domains show same restaurant |
| Multiple restaurants | `RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa,other.in:other` | Each domain → different restaurant |
| Fallback for unmapped domains | `PUBLIC_DEFAULT_RESTAURANT_CODE=default` | Unknown domains show default restaurant |

---

## Support & Testing

### Test URLs (after setup)

```
Primary domain with www:
https://www.gandikotadosa.in/#order

Primary domain without www:
https://gandikotadosa.in/#order

Path should NOT be needed anymore:
https://www.gandikotadosa.in/gandikotadosa#order ← Old way (still works but not needed)
https://www.gandikotadosa.in/#order ← New way (this is what we want)
```

### If Still Having Issues

1. **Check .env file** - Is value set correctly?
2. **Restart server** - Is latest code running?
3. **Clear cache** - Browser caching old behavior
4. **Check logs** - What is server logging?
5. **Verify DNS** - Is domain pointing to server?
6. **Check restaurant code** - Does `gandikotadosa` restaurant exist in database?

---

## Summary

**Your fix in 1 minute:**

1. Find your `.env` file
2. Add this line: `PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa`
3. Restart server
4. Visit `https://www.gandikotadosa.in/#order` ✅

**Done!**

---

**Questions?** Review the troubleshooting section or check server logs for detailed error messages.
