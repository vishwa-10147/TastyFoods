# WhatsApp Integration - Deployment Checklist

**Project:** F3 Drivein  
**Date:** June 15, 2026  
**Status:** Ready for Production

---

## ✅ Pre-Deployment Checklist

### Phase 1: Credential Setup (Facebook/WhatsApp)

- [ ] **Create Facebook Business App**
  - Visit: https://developers.facebook.com/apps
  - Click "Create App"
  - Select "Business" type
  - App Name: "F3 Drivein Orders"
  - Note: App ID: `________________`

- [ ] **Link WhatsApp Business Account**
  - Go to WhatsApp Manager: https://business.facebook.com
  - Ensure Business Account is active
  - Account Name: `________________`
  - Account ID: `________________`

- [ ] **Create System User & Generate Token**
  - In App Dashboard → Settings → User Roles
  - Create System User: "f3drivein-api"
  - Permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
  - Generate Access Token
  - **IMPORTANT:** Copy full token (don't truncate)
  - Token: `________________` (save securely)

- [ ] **Get Phone Number ID**
  - WhatsApp Manager → Phone Numbers
  - Select your business phone
  - Copy "Phone Number ID" (not the phone number)
  - **Note:** Different from actual phone number!
  - Phone ID: `________________`

- [ ] **Create Webhook Verify Token**
  - Generate random string (16+ chars):
    ```bash
    # Mac/Linux:
    openssl rand -hex 16
    # Windows:
    -join([System.Random]::new().GetBytes(16) | ForEach { '{0:x2}' -f $_ })
    ```
  - Verify Token: `________________`

---

### Phase 2: Code Setup (Local)

- [ ] **Verify Files Exist**
  - [ ] `whatsappService.js` - Service module
  - [ ] `server.js` - Integration points (updated)
  - [ ] `package.json` - New npm script
  - [ ] `.env.example` - Config template
  - [ ] `WHATSAPP_INTEGRATION.md` - Full docs
  - [ ] `WHATSAPP_QUICK_START.md` - Quick start

- [ ] **Update Environment File**
  - [ ] Copy `.env.example` to `.env`
  - [ ] Add `WHATSAPP_ACCESS_TOKEN`
  - [ ] Add `WHATSAPP_PHONE_NUMBER_ID`
  - [ ] Add `WHATSAPP_VERIFY_TOKEN`
  - [ ] Set `TEST_PHONE_NUMBER` (your personal number)

- [ ] **Verify Code Integration**
  - [ ] `server.js` imports `whatsappService`
  - [ ] `validateWhatsAppConfig()` called at startup
  - [ ] Order creation endpoint has WhatsApp call
  - [ ] Order status endpoint has WhatsApp call
  - [ ] All endpoints defined (status, test, webhook)

- [ ] **Test Locally**
  ```bash
  npm install
  npm start
  # Expected log: ✅ WhatsApp Business API configured and enabled
  ```

---

### Phase 3: Webhook Configuration (WhatsApp Manager)

- [ ] **Configure Webhook URL**
  - Go to: WhatsApp Manager → Phone Numbers → Webhook
  - Click "Edit"
  - **Callback URL:** `https://your-domain.com/api/whatsapp/webhook`
    - Must be HTTPS (not HTTP)
    - Must be publicly accessible
    - Must match exactly (no trailing slash)
  - **Verify Token:** (same as `WHATSAPP_VERIFY_TOKEN`)
  - Click "Verify and Save"
  - Expected response: "Webhook verified"

- [ ] **Subscribe to Events**
  - Check: ☑️ `messages`
  - Check: ☑️ `message_status`
  - Click "Save"

- [ ] **Test Webhook Manually**
  ```bash
  curl "https://your-domain.com/api/whatsapp/webhook?hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST123&hub.mode=subscribe"
  # Expected response: TEST123
  ```

- [ ] **Approve Phone Number (if required)**
  - Some regions require phone verification
  - Phone Manager → Verify number with code sent via SMS

---

### Phase 4: Pre-Production Testing

- [ ] **Test WhatsApp Configuration**
  ```bash
  curl https://your-domain.com/api/whatsapp/status
  # Response: { "configured": true, "enabled": true }
  ```

- [ ] **Send Test Message**
  ```bash
  curl -X POST https://your-domain.com/api/whatsapp/test \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_MGMT_TOKEN" \
    -d '{"phoneNumber": "919010002233"}'
  # Check your phone for message within 5 seconds
  ```

- [ ] **Test Order Creation (Full Flow)**
  ```bash
  curl -X POST https://your-domain.com/api/orders \
    -H "Content-Type: application/json" \
    -d '{
      "orderType": "takeaway",
      "items": [{"menuItemId": 1, "qty": 2}],
      "customerName": "Test User",
      "customerMobile": "919010002233"
    }'
  # Check WhatsApp for order confirmation
  ```

- [ ] **Test Status Change (Ready Message)**
  - Get order ID from test above
  ```bash
  curl -X POST https://your-domain.com/api/orders/123/status \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_MGMT_TOKEN" \
    -d '{"status": "ready"}'
  # Check WhatsApp for ready message
  ```

- [ ] **Verify Error Handling**
  - [ ] Order fails gracefully if WhatsApp down
  - [ ] Invalid phone numbers handled properly
  - [ ] Errors logged but don't break orders

- [ ] **Monitor Server Logs**
  ```bash
  tail -f server.log | grep -i whatsapp
  # Should see successful message sends logged
  ```

---

### Phase 5: Database & Data Verification

- [ ] **Check Customer Mobile Field**
  ```sql
  SELECT id, customer_mobile, status FROM orders LIMIT 5;
  -- Verify customer_mobile is populated
  ```

- [ ] **Verify Phone Format**
  - All phone numbers 10 digits (India) or with country code
  - No special characters or formatting issues
  - Examples: `9010002233` or `919010002233`

---

### Phase 6: Production Deployment

- [ ] **Prepare Production Environment**
  - [ ] HTTPS certificate valid and installed
  - [ ] Domain properly configured (no self-signed certs)
  - [ ] Server is publicly accessible
  - [ ] Firewall allows HTTPS (port 443)

- [ ] **Deploy Code**
  ```bash
  git pull origin main
  npm install
  npm run build  # if applicable
  ```

- [ ] **Set Production Environment Variables**
  ```bash
  export NODE_ENV=production
  export WHATSAPP_ACCESS_TOKEN=your_token
  export WHATSAPP_PHONE_NUMBER_ID=your_phone_id
  export WHATSAPP_VERIFY_TOKEN=your_verify_token
  ```

- [ ] **Restart Server**
  ```bash
  npm start
  # Or using PM2:
  pm2 restart app
  ```

- [ ] **Verify Startup**
  - [ ] Server starts without errors
  - [ ] See: `✅ WhatsApp Business API configured and enabled`
  - [ ] Webhook is accessible
  - [ ] No database errors

---

### Phase 7: Production Testing

- [ ] **Smoke Test - Configuration**
  ```bash
  curl https://your-domain.com/api/whatsapp/status
  ```

- [ ] **Smoke Test - Real Order**
  - Create a real test order with real customer phone
  - Verify message arrives on customer's phone within 5 seconds
  - Check message content is correct

- [ ] **Monitor Logs for 1 Hour**
  ```bash
  tail -f /var/log/app.log | grep -i whatsapp
  ```

- [ ] **Test with Multiple Orders**
  - Create 5-10 test orders
  - Verify all messages arrive
  - No rate limiting issues
  - Response times acceptable

---

### Phase 8: Post-Deployment

- [ ] **Set Up Monitoring/Alerting**
  - [ ] Alert on WhatsApp API errors
  - [ ] Monitor message delivery success rate
  - [ ] Track webhook response times
  - Example:
    ```bash
    # Count WhatsApp errors in last hour
    tail -f /var/log/app.log | grep "❌ WhatsApp" | wc -l
    ```

- [ ] **Document Setup**
  - [ ] Save credentials in secure vault (1Password, AWS Secrets Manager)
  - [ ] Document webhook configuration date
  - [ ] Document phone number ID and access token expiry
  - [ ] Update operations runbook

- [ ] **Backup Documentation**
  - [ ] Print or save `WHATSAPP_INTEGRATION.md`
  - [ ] Bookmark WhatsApp Manager links
  - [ ] Save Facebook App ID and credentials location

- [ ] **Schedule Maintenance Tasks**
  - [ ] Monthly: Regenerate access token
  - [ ] Monthly: Review message delivery rates
  - [ ] Quarterly: Check for WhatsApp API updates
  - [ ] Quarterly: Review security settings

---

## 🚨 Troubleshooting During Deployment

### Issue: "WhatsApp not configured"

**Checklist:**
- [ ] `WHATSAPP_ACCESS_TOKEN` is set
- [ ] `WHATSAPP_PHONE_NUMBER_ID` is set
- [ ] Both have actual values (not empty)
- [ ] Server restarted after setting variables
- [ ] Check with: `echo $WHATSAPP_ACCESS_TOKEN`

**Fix:**
```bash
# Re-check environment file
cat .env | grep WHATSAPP

# Restart server
npm start
```

---

### Issue: "Invalid access token"

**Checklist:**
- [ ] Token is copied completely (no truncation)
- [ ] No spaces at beginning/end
- [ ] Token still valid (not expired)
- [ ] System User has required permissions

**Fix:**
```bash
# Regenerate token
# Facebook App → Settings → System Users → Regenerate Token
# Copy full token value again

# Test immediately
curl -X POST https://your-domain.com/api/whatsapp/test \
  -H "Authorization: Bearer YOUR_NEW_TOKEN" \
  -d '{"phoneNumber": "919010002233"}'
```

---

### Issue: "Webhook verification failed"

**Checklist:**
- [ ] Webhook URL is HTTPS (not HTTP)
- [ ] Domain is publicly accessible
- [ ] Verify Token matches exactly
- [ ] Server is running and responding
- [ ] No firewall blocking requests

**Fix:**
```bash
# Test webhook manually
curl "https://your-domain.com/api/whatsapp/webhook?hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST123&hub.mode=subscribe"

# Should return: TEST123

# If fails, check:
# 1. Domain DNS resolves: nslookup your-domain.com
# 2. HTTPS works: curl https://your-domain.com
# 3. Endpoint exists: curl https://your-domain.com/api/whatsapp/webhook
```

---

### Issue: "Messages not sending"

**Checklist:**
- [ ] Customer has phone number in order
- [ ] Phone number format is correct (10-13 digits)
- [ ] WhatsApp Business Account is active
- [ ] Phone number is approved/verified
- [ ] API rate limit not exceeded

**Fix:**
```bash
# Check logs
tail -100 server.log | grep -i whatsapp

# Verify with test message
npm run whatsapp-test

# Check phone format
# Should be: 9010002233 or 919010002233
```

---

## 📊 Success Criteria

Your deployment is successful when:

✅ **Configuration**
- [ ] All 3 environment variables set
- [ ] Server starts with WhatsApp enabled message
- [ ] Webhook URL verified in WhatsApp Manager

✅ **Functionality**
- [ ] `/api/whatsapp/status` returns configured: true
- [ ] Test message sends successfully
- [ ] Order placed → WhatsApp message within 5 seconds
- [ ] Order ready → WhatsApp message within 5 seconds

✅ **Reliability**
- [ ] No errors in logs over 1 hour
- [ ] Multiple orders processed successfully
- [ ] WhatsApp failures don't break orders
- [ ] Messages arrive consistently

✅ **Performance**
- [ ] Message send time: 1-2 seconds
- [ ] Order creation time unaffected (< 50ms overhead)
- [ ] No memory leaks or connection issues
- [ ] Rate limits respected

---

## 🔄 Rollback Plan (If Needed)

If issues occur in production:

1. **Quick Disable** (1 minute)
   ```bash
   # Remove credentials from .env
   unset WHATSAPP_ACCESS_TOKEN
   unset WHATSAPP_PHONE_NUMBER_ID
   npm start
   # Messages won't send, but orders continue
   ```

2. **Fix & Redeploy** (5-10 minutes)
   ```bash
   # Fix issue locally
   # Commit changes
   git commit -m "Fix WhatsApp issue"
   git push origin main
   
   # Deploy
   npm start
   
   # Test
   npm run whatsapp-test
   ```

3. **Full Rollback** (5 minutes)
   ```bash
   # If needed, revert code
   git revert HEAD
   npm start
   ```

---

## 📞 Support Resources

**During Setup Issues:**
1. Check: `WHATSAPP_INTEGRATION.md` → Troubleshooting section
2. Check: `WHATSAPP_QUICK_START.md` → Quick reference
3. Review logs: `tail -f server.log | grep -i whatsapp`
4. Test endpoint: `curl https://your-domain.com/api/whatsapp/status`

**Ongoing Support:**
- WhatsApp API Docs: https://developers.facebook.com/docs/whatsapp
- Rate Limiting: https://developers.facebook.com/docs/whatsapp/cloud-api/support/rate-limiting
- Troubleshooting: https://developers.facebook.com/docs/whatsapp/cloud-api/support/troubleshooting

---

## ✨ Next Steps After Successful Deployment

1. **Monitor for 24 hours**
   - Watch logs for errors
   - Verify consistent message delivery

2. **Gather Feedback**
   - Customer response to messages
   - Message delivery rates
   - Any formatting issues

3. **Iterate & Improve**
   - Adjust message timing if needed
   - Add more message types (order delay notifications, etc.)
   - Improve message templates based on feedback

4. **Plan Enhancements**
   - Two-way messaging (order changes)
   - Message delivery tracking
   - Multi-language support
   - Analytics dashboard

---

**Deployment Checklist Complete! 🚀**

You're ready to launch WhatsApp notifications for F3 Drivein orders.

**Estimated Total Time:** 30-45 minutes

**Questions?** Refer to the comprehensive docs:
- Quick start: `WHATSAPP_QUICK_START.md`
- Full guide: `WHATSAPP_INTEGRATION.md`
- Implementation: `IMPLEMENTATION_SUMMARY.md`
