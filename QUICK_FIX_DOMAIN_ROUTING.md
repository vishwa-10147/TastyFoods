# 🎯 Quick Fix: Domain Routing for gandikotadosa.in

**Your Issue:**
- ✗ `https://www.gandikotadosa.in/#order` → shows default restaurant
- ✗ Current workaround: `https://www.gandikotadosa.in/gandikotadosa#order` → shows gandikota

**Solution:**
- ✅ `https://www.gandikotadosa.in/#order` → will show gandikota restaurant
- ✅ No path needed anymore!

---

## 🚀 Fix in 2 Steps

### Step 1: Update Your Environment Variable

In your Render deployment (or local `.env`):

**Add this line:**
```
PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa
```

**That's it!** This makes gandikotadosa the default restaurant for your domain.

---

### Step 2: Restart Your Server

**On Render:**
1. Go to your Render service dashboard
2. Click "Manual Deploy" 
3. Wait for deployment to complete

**Locally:**
```bash
npm start
```

---

## ✅ Test It

Visit these URLs in your browser:

```
https://www.gandikotadosa.in/#order
↓
Should now show gandikota restaurant ✅
```

Clear your browser cache if needed:
- Press: `Ctrl+Shift+Delete` (or Cmd+Shift+Delete on Mac)
- Clear cached images/files

---

## 📚 Understanding the Configuration

### Option 1: Simple (What you want)
```bash
PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa
```
✅ Makes gandikotadosa the default for your domain  
✅ Simplest approach  
✅ Best for single restaurant domains

---

### Option 2: Advanced (If you have multiple domains/restaurants)
```bash
RESTAURANT_DOMAIN_MAP=gandikotadosa.in:gandikotadosa,www.gandikotadosa.in:gandikotadosa
```
✅ Maps specific domains to specific restaurants  
✅ Needed if hosting multiple restaurants  
❌ More complex

---

## 🔍 How It Works

**Before (Current):**
```
User visits: https://www.gandikotadosa.in/#order
             ↓
Server: "No path specified, using default restaurant"
             ↓
Shows: Default restaurant ❌
```

**After (Fixed):**
```
User visits: https://www.gandikotadosa.in/#order
             ↓
Server: "No path, checking PUBLIC_DEFAULT_RESTAURANT_CODE"
             ↓
Found: gandikotadosa
             ↓
Shows: Gandikota restaurant ✅
```

---

## 🎯 Where to Set This

### If on Render (Recommended)

1. Go to: `render.com` → Your Service Dashboard
2. Click: **Settings**
3. Scroll to: **Environment**
4. Add new variable:
   - Key: `PUBLIC_DEFAULT_RESTAURANT_CODE`
   - Value: `gandikotadosa`
5. Click: **Save Changes**
6. Render automatically redeploys

### If Running Locally

Edit `.env` file:
```
PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa
```

Restart server:
```bash
npm start
```

---

## ✨ Result

**Old way (still works but not needed):**
```
https://www.gandikotadosa.in/gandikotadosa#order
```

**New way (after fix):**
```
https://www.gandikotadosa.in/#order
```

Both will work, but you can remove `/gandikotadosa` from URLs now!

---

## ❓ Troubleshooting

**Still showing default?**

1. ✅ Did you restart the server? (Required!)
2. ✅ Did you clear browser cache? (`Ctrl+Shift+Delete`)
3. ✅ Check server is running with correct env variable
4. ✅ Wait a few seconds after restart

**Check the logs:**
```bash
# If you see this:
"Restaurant resolved: gandikotadosa" ✅

# Or if you see this:
"Using default restaurant" ❌ (restart server!)
```

---

## 📖 Full Documentation

For more details, see: [DOMAIN_ROUTING_GUIDE.md](DOMAIN_ROUTING_GUIDE.md)

Includes:
- Advanced configurations
- Multiple restaurants setup
- DNS troubleshooting
- Render deployment details

---

## ✅ Summary

**One line to add:**
```bash
PUBLIC_DEFAULT_RESTAURANT_CODE=gandikotadosa
```

**Restart server**

**Done!** ✅

Your gandikotadosa.in domain will now show the gandikota restaurant automatically!

---

**Questions?** 
- Read full guide: [DOMAIN_ROUTING_GUIDE.md](DOMAIN_ROUTING_GUIDE.md)
- Check server logs for errors
- Make sure restaurant code is correct: `gandikotadosa`
