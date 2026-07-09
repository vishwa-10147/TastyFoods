# WhatsApp Integration - Quick Start Guide

**Status:** ✅ Production Ready  
**Setup Time:** 15-20 minutes  
**Difficulty:** Easy-Medium

---

## 🚀 Quick Setup (5 Easy Steps)

### Step 1️⃣: Get WhatsApp Credentials (5 min)

1. Visit: https://developers.facebook.com
2. Create a Business App (if not exists)
3. Add WhatsApp product
4. Go to **Settings → System Users**
5. Generate Access Token with `whatsapp_business_messaging` permission
6. Go to **WhatsApp Manager → Phone Numbers**
7. Copy your **Phone Number ID**
8. Create a random **Verify Token** (e.g., `abc123def456`)

**You now have 3 credentials:**
```
✅ WHATSAPP_ACCESS_TOKEN = "EAAx..."
✅ WHATSAPP_PHONE_NUMBER_ID = "102345..."
✅ WHATSAPP_VERIFY_TOKEN = "abc123def456"
```

---

### Step 2️⃣: Update Environment (2 min)

**Edit `.env` file:**

```bash
# Add these lines:
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_VERIFY_TOKEN=your_verify_token_here
TEST_PHONE_NUMBER=919010002233  # Optional: for testing
```

**Restart server:**
```bash
npm start
```

**Check logs:**
```
✅ WhatsApp Business API configured and enabled
```

---

### Step 3️⃣: Setup Webhook (5 min)

1. Go to **WhatsApp Manager → Phone Numbers**
2. Click **Webhook** → **Edit**
3. Set **Callback URL**:
   ```
   https://your-domain.com/api/whatsapp/webhook
   ```
   *(Must be HTTPS and live)*

4. Set **Verify Token**:
   ```
   your_verify_token_here
   ```
   *(Same as WHATSAPP_VERIFY_TOKEN)*

5. Click **Verify and Save**
6. Subscribe to: `messages`, `message_status`

---

### Step 4️⃣: Test Configuration (2 min)

**Test WhatsApp integration:**

```bash
npm run whatsapp-test
```

**Or use cURL:**

```bash
curl -X POST https://your-domain.com/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_TOKEN" \
  -d '{ "phoneNumber": "919010002233" }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Test message sent successfully",
  "messageId": "wamid.HBEUGh..."
}
```

---

### Step 5️⃣: Test End-to-End (2 min)

**Create an order:**

```bash
curl -X POST https://your-domain.com/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantCode": "default",
    "orderType": "takeaway",
    "items": [{"menuItemId": 1, "qty": 1}],
    "customerName": "John Doe",
    "customerMobile": "9010002233"
  }'
```

**Check customer's WhatsApp** → Should receive order confirmation within 5 seconds! 🎉

---

## 📋 Files Created/Updated

```
✅ whatsappService.js                  # Main WhatsApp service module
✅ server.js                           # Integration points added
✅ package.json                        # New npm script added
✅ .env.example                        # WhatsApp config template
✅ WHATSAPP_INTEGRATION.md             # Full documentation
✅ WHATSAPP_QUICK_START.md             # This file
```

---

## 🎯 What Happens Automatically

1. **Order Created** → WhatsApp message sent to customer within 1-2 seconds
   - Shows: Order ID, items, total, payment status

2. **Order Status Changed to "ready"** → Pickup notification sent
   - Shows: Order ID, pickup location

---

## 🔧 Troubleshooting

### "WhatsApp not configured"
- Check `.env` has all 3 variables set
- Restart server: `npm start`

### "Invalid phone number"
- Use format: `9010002233` or `919010002233`
- No dashes, spaces, or special characters

### "Webhook verification failed"
- Verify tokens match (server vs WhatsApp Manager)
- Ensure URL is HTTPS
- Check server is publicly accessible

### Messages not sending
- Check server logs: `tail -f logs.txt | grep WhatsApp`
- Verify WhatsApp Business Account is active
- Test with: `npm run whatsapp-test`

---

## 📚 Full Documentation

For complete setup, troubleshooting, and API reference:

👉 See: [WHATSAPP_INTEGRATION.md](WHATSAPP_INTEGRATION.md)

---

## ✨ Features

✅ Automatic order notifications  
✅ Customer mobile number stored with order  
✅ No customer replies needed  
✅ Async message sending (non-blocking)  
✅ Comprehensive error handling  
✅ Production-ready code  
✅ Easy to extend  

---

## 📞 Support

- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp
- Issues? Check logs: `tail -f server.log | grep -i whatsapp`
- Rate limits? WhatsApp allows ~1000 msgs/hour

---

**Setup Complete!** 🚀

Your F3 Drivein customers will now automatically receive WhatsApp notifications for their orders.
