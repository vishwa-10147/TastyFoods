# WhatsApp Business API Integration Guide - F3 Drivein

**Last Updated:** June 15, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [Configuration](#configuration)
5. [Usage & Features](#usage--features)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [API Reference](#api-reference)
9. [Security Considerations](#security-considerations)
10. [Message Templates](#message-templates)

---

## Overview

This WhatsApp Business API integration enables F3 Drivein to send transactional order notifications directly to customer phones without requiring customer replies or chatbot functionality.

### Features

✅ **Automated Order Notifications**
- Order Placed confirmation with invoice summary
- Order Ready for Pickup notification
- Order Completed notification (optional)

✅ **Production Ready**
- Comprehensive error handling
- Async message sending (non-blocking)
- Extensive logging and monitoring
- Rate limiting support
- Webhook verification

✅ **Modular Design**
- Decoupled service layer (`whatsappService.js`)
- Easy to extend with new message types
- Clean separation from core order logic

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Express Server (server.js)               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  POST /api/orders ──────────────────┐                       │
│                                     │                       │
│                           ┌─────────▼──────────┐            │
│                           │ Create Order       │            │
│                           │ (in background)    │            │
│                           │ sendOrderPlaced    │            │
│                           └─────────┬──────────┘            │
│                                     │                       │
│  POST /api/orders/:id/status ───────┤                       │
│        (status='ready')             │                       │
│                           ┌─────────▼──────────────┐        │
│                           │ Update Order Status    │        │
│                           │ (in background)        │        │
│                           │ sendOrderReady         │        │
│                           └─────────┬──────────────┘        │
│                                     │                       │
│                           ┌─────────▼──────────────────┐    │
│                           │  whatsappService.js        │    │
│                           │  ┌──────────────────────┐ │    │
│                           │  │ sendOrderPlacedMsg   │ │    │
│                           │  │ sendOrderReadyMsg    │ │    │
│                           │  │ sendOrderCompletedMsg│ │    │
│                           │  │ sendTestMessage      │ │    │
│                           │  │ formatPhoneNumber    │ │    │
│                           │  │ logWhatsAppEvent     │ │    │
│                           │  └──────────────────────┘ │    │
│                           └─────────┬──────────────────┘    │
│                                     │                       │
│                           ┌─────────▼──────────────────┐    │
│                           │ WhatsApp Cloud API         │    │
│                           │ graph.instagram.com        │    │
│                           │ /v18.0/.../messages        │    │
│                           └────────────────────────────┘    │
│                                     │                       │
│                           ┌─────────▼──────────────────┐    │
│                           │ Customer's Phone           │    │
│                           │ WhatsApp Application       │    │
│                           └────────────────────────────┘    │
│                                                               │
│  GET /api/whatsapp/status ─────────────────┐               │
│  POST /api/whatsapp/test ──────────────────┤───────────┐   │
│                                            │           │   │
│  GET /api/whatsapp/webhook ────────────────┤───────────┤   │
│  POST /api/whatsapp/webhook ───────────────┘           │   │
│                                                         │   │
└──────────────────────────────────────────────────────────┼──┘
                                                          │
                        WhatsApp Manager Setup
                        (one-time configuration)
```

### Data Flow

1. **Order Created** → `POST /api/orders`
   - Order stored in database
   - Response returned to client
   - Async background job triggered
   - `sendOrderPlacedMessage()` called
   - WhatsApp message sent to customer

2. **Status Changed** → `POST /api/orders/:id/status`
   - Order status updated in database
   - If status = "ready", async job triggered
   - `sendOrderReadyMessage()` called
   - WhatsApp message sent to customer

---

## Setup Instructions

### Prerequisites

- ✅ Node.js 20+
- ✅ Existing F3 Drivein application
- ✅ PostgreSQL database
- ✅ Facebook Business Account
- ✅ WhatsApp Business Account
- ✅ HTTPS-enabled server (WhatsApp requires HTTPS for webhooks)

### Step 1: Get WhatsApp Business API Credentials

1. **Create Facebook Business App**
   - Visit: https://developers.facebook.com
   - Click "My Apps" → "Create App"
   - Select "Business" app type
   - Fill in app name (e.g., "F3 Drivein Orders")
   - Click "Create App"

2. **Add WhatsApp Product**
   - In app dashboard, click "Add Product"
   - Find "WhatsApp" and click "Set Up"
   - Select "WhatsApp Business Account"
   - If you don't have one, create at: https://business.facebook.com

3. **Generate Access Token**
   - Go to: Settings → User Roles → System Users
   - Create a new System User (or use existing)
   - Generate "Access Token" with these permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - **Copy this token** → Set as `WHATSAPP_ACCESS_TOKEN`

4. **Get Phone Number ID**
   - Go to: WhatsApp Manager → Phone Numbers
   - Select your business phone number
   - Copy "Phone Number ID" (not the phone number itself)
   - **Set as `WHATSAPP_PHONE_NUMBER_ID`**

5. **Create Webhook Verify Token**
   - Generate a random string (16+ characters):
     ```bash
     # On Linux/Mac:
     openssl rand -hex 16
     
     # On Windows PowerShell:
     -join([System.Random]::new().GetBytes(16) | ForEach { '{0:x2}' -f $_ })
     ```
   - **Set as `WHATSAPP_VERIFY_TOKEN`**

### Step 2: Configure Environment Variables

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Add WhatsApp credentials to `.env`:**
   ```bash
   WHATSAPP_ACCESS_TOKEN=your_long_access_token_here
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
   WHATSAPP_VERIFY_TOKEN=your_random_verify_token_here
   TEST_PHONE_NUMBER=9010002233  # For testing (optional)
   ```

3. **Verify configuration:**
   ```bash
   npm run whatsapp-test
   ```

### Step 3: Setup Webhook in WhatsApp Manager

1. **Configure Webhook URL**
   - Go to: WhatsApp Manager → Phone Numbers → Webhook
   - Click "Edit"
   - Set these fields:

     **Callback URL:**
     ```
     https://your-domain.com/api/whatsapp/webhook
     ```
     *(Must be HTTPS and publicly accessible)*

     **Verify Token:**
     ```
     (Use the same token from WHATSAPP_VERIFY_TOKEN)
     ```

   - Click "Verify and Save"

2. **Subscribe to Webhook Events**
   - Check these event types:
     - ✅ messages
     - ✅ message_status (optional, for delivery tracking)
   - Click "Save"

3. **Test Webhook**
   - Execute this cURL command:
     ```bash
     curl -i -X GET "https://your-domain.com/api/whatsapp/webhook?hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST123&hub.mode=subscribe"
     ```
   - Should receive response: `TEST123`

### Step 4: Deploy

```bash
# Install dependencies (if not already done)
npm install

# Start server with WhatsApp enabled
npm start

# Monitor logs for WhatsApp initialization
# Should see: "✅ WhatsApp Business API configured and enabled"
```

---

## Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WHATSAPP_ACCESS_TOKEN` | ✅ YES | WhatsApp Cloud API access token | `EAAx...` |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ YES | Business phone number ID (not the phone) | `102345...` |
| `WHATSAPP_VERIFY_TOKEN` | ✅ YES | Webhook verification token | `abcd1234efgh5678` |
| `TEST_PHONE_NUMBER` | ❌ NO | Phone for testing | `9010002233` |
| `NODE_ENV` | ❌ NO | Environment (production/development) | `production` |

### Configuration in Code

All configuration is managed in `whatsappService.js`:

```javascript
const WHATSAPP_API_URL = 'https://graph.instagram.com/v18.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ENABLED = Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
```

---

## Usage & Features

### Automatic Order Notifications

#### 1. Order Placed Message

**Triggered:** When order is created via `POST /api/orders`

**Sent to:** Customer's WhatsApp with this information:
- ✅ Customer name
- ✅ Order ID
- ✅ Shop name
- ✅ Ordered items with quantities and prices
- ✅ Total amount
- ✅ Payment status (PAID/PENDING)
- ✅ Estimated delivery time

**Example Message:**
```
ORDER PLACED ✅

Order Details:
Customer: Rajesh Kumar
Order ID: #1542
Shop: F3 Drivein

Items Ordered:
2x Dosa - ₹150.00
1x Idli - ₹80.00
1x Coffee - ₹30.00

Summary:
Total Amount: ₹260.00
Payment Status: ✅ PAID

Thank you for your order! Your order will be ready soon.

Estimated time: 15-20 minutes
```

#### 2. Order Ready Message

**Triggered:** When order status changes to `ready` via `POST /api/orders/:id/status`

**Sent to:** Customer's WhatsApp notifying pickup

**Example Message:**
```
🎉 ORDER READY FOR PICKUP

Hi Rajesh,

Your order #1542 is ready for pickup at F3 Drivein!

Please come collect your order at the counter.

Thank you! 🙏
```

#### 3. Order Completed Message

**Triggered:** Optionally when order status changes to `delivered`

**Note:** Currently not automatically sent - can be added by calling `sendOrderCompletedMessage()` in code

---

## Testing

### Test 1: Verify WhatsApp Status

Check if WhatsApp integration is properly configured:

```bash
# Using cURL
curl https://your-domain.com/api/whatsapp/status

# Expected response:
{
  "configured": true,
  "enabled": true,
  "message": "WhatsApp integration is active"
}
```

### Test 2: Send Test Message

Send a test WhatsApp message to verify credentials:

```bash
# Requires management authentication
curl -X POST https://your-domain.com/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_TOKEN" \
  -d '{ "phoneNumber": "919010002233" }'

# Or use CLI command (if TEST_PHONE_NUMBER set in .env):
npm run whatsapp-test
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Test message sent successfully",
  "messageId": "wamid.xxx...",
  "timestamp": "2026-06-15T10:30:00.000Z"
}
```

### Test 3: End-to-End Order Flow

1. **Create an order with customer mobile:**
   ```bash
   curl -X POST https://your-domain.com/api/orders \
     -H "Content-Type: application/json" \
     -d '{
       "restaurantCode": "f3drivein",
       "orderType": "takeaway",
       "items": [{"menuItemId": 1, "qty": 2}],
       "customerName": "Rajesh",
       "customerMobile": "9010002233"
     }'
   ```

2. **Monitor server logs:**
   ```
   📱 WhatsApp ORDER_PLACED_SENT: { orderId: 123, messageId: 'wamid.xxx...' }
   ```

3. **Check customer's WhatsApp** - Should receive message within 5 seconds

4. **Change order status to ready:**
   ```bash
   curl -X POST https://your-domain.com/api/orders/123/status \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer MANAGEMENT_TOKEN" \
     -d '{ "status": "ready" }'
   ```

5. **Check customer's WhatsApp again** - Should receive "Order Ready" message

### Test 4: Webhook Verification

Verify webhook is correctly configured:

```bash
# Webhook GET verification (done automatically by WhatsApp)
curl "https://your-domain.com/api/whatsapp/webhook?hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST123&hub.mode=subscribe"

# Should return:
# TEST123
```

---

## Troubleshooting

### Issue 1: "WhatsApp integration is not enabled"

**Causes:**
- `WHATSAPP_ACCESS_TOKEN` not set
- `WHATSAPP_PHONE_NUMBER_ID` not set
- Environment variables not loaded from `.env`

**Solution:**
```bash
# Verify environment variables are set
echo $WHATSAPP_ACCESS_TOKEN
echo $WHATSAPP_PHONE_NUMBER_ID

# Reload environment (if using Docker):
docker restart your-container

# Or restart Node.js:
npm start
```

### Issue 2: "Invalid phone number" Error

**Causes:**
- Phone number has invalid format
- Not including country code (91 for India)
- Invalid characters or spaces

**Solution:**
```javascript
// Correct formats:
"9010002233"      // 10 digits (India)
"919010002233"    // Country code + 10 digits
"+919010002233"   // International format (will be cleaned)

// Incorrect formats:
"090-100-02233"   // Dashes
"9010 002 233"    // Spaces
"900002233"       // Less than 10 digits
```

### Issue 3: "Invalid access token" or "Unauthorized"

**Causes:**
- Access token is incorrect/expired
- Wrong permissions on System User
- Access token from wrong Facebook app

**Solution:**
1. Regenerate access token:
   - Facebook App Dashboard → Settings → User Roles → System Users
   - Click on your system user → "Generate new token"
   - Copy the full token (don't truncate)

2. Verify token has these permissions:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`

3. Update `.env`:
   ```bash
   WHATSAPP_ACCESS_TOKEN=YOUR_NEW_TOKEN
   ```

### Issue 4: "Webhook verification failed"

**Causes:**
- `WHATSAPP_VERIFY_TOKEN` doesn't match what's set in WhatsApp Manager
- Webhook URL is not HTTPS
- Server is not publicly accessible

**Solution:**
1. Verify tokens match:
   ```bash
   # Check server-side token
   echo $WHATSAPP_VERIFY_TOKEN
   
   # Should match the token in WhatsApp Manager
   # Go to: Phone Numbers → Webhook → Verify Token
   ```

2. Ensure HTTPS:
   - WhatsApp only accepts HTTPS URLs
   - Get SSL certificate (Let's Encrypt is free)
   - Redirect HTTP to HTTPS

3. Test webhook:
   ```bash
   curl "https://your-domain.com/api/whatsapp/webhook?hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST&hub.mode=subscribe"
   # Should return: TEST
   ```

### Issue 5: Messages Not Being Sent

**Causes:**
- Customer mobile number not provided in order
- Phone number format invalid
- WhatsApp account not approved for sending
- API quota exceeded

**Solution:**
1. Check server logs:
   ```bash
   # Look for error messages
   tail -f /var/log/app.log | grep "WhatsApp"
   ```

2. Verify customer has mobile:
   ```sql
   SELECT id, customer_mobile FROM orders WHERE id = 123;
   -- Should show: customer_mobile = '9010002233'
   ```

3. Test with test endpoint:
   ```bash
   npm run whatsapp-test
   ```

4. Check WhatsApp Business Account status:
   - Go to: WhatsApp Manager
   - Verify account is "Active"
   - Check message limits haven't been exceeded

### Issue 6: "Rate Limit Exceeded" Error

**Causes:**
- Sending too many messages too quickly
- Hitting WhatsApp API rate limits

**Solution:**
- WhatsApp allows ~1000 messages/hour per business account
- Messages are sent async so shouldn't be an issue for normal order flow
- If testing heavily, add delays between requests:
  ```bash
  # Test with 5-second delay
  for i in {1..5}; do
    curl -X POST https://your-domain.com/api/orders ...
    sleep 5
  done
  ```

---

## API Reference

### Endpoints

#### GET `/api/whatsapp/status`

Check WhatsApp configuration and enabled status.

**Authentication:** None required

**Response:**
```json
{
  "configured": true,
  "enabled": true,
  "message": "WhatsApp integration is active"
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

---

#### POST `/api/whatsapp/test`

Send a test WhatsApp message to verify configuration.

**Authentication:** ✅ Management Auth Required

**Request Body:**
```json
{
  "phoneNumber": "919010002233"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Test message sent successfully",
  "messageId": "wamid.HBEUGhAe...",
  "timestamp": "2026-06-15T10:30:00.000Z"
}
```

**Response (Error):**
```json
{
  "error": "Invalid phone number: 12345",
  "details": null
}
```

**Status Codes:**
- `200` - Message sent successfully
- `400` - Invalid phone number or WhatsApp not configured
- `401` - Not authenticated
- `500` - Server error

---

#### GET `/api/whatsapp/webhook`

Webhook verification endpoint (called by WhatsApp Manager during setup).

**Query Parameters:**
- `hub.mode` - Should be "subscribe"
- `hub.challenge` - Random verification string
- `hub.verify_token` - Must match `WHATSAPP_VERIFY_TOKEN`

**Response:**
```
hub.challenge value (e.g., "TEST123")
```

**Status Codes:**
- `200` - Verification successful
- `403` - Verification failed

---

#### POST `/api/whatsapp/webhook`

Webhook endpoint for incoming WhatsApp events (currently for future expansion).

**Headers:**
```
X-Hub-Signature: sha256=...
```

**Request Body:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "messages": [...],
        "message_status": [...]
      }
    }]
  }]
}
```

**Response:**
```json
{
  "received": true
}
```

---

### Service Functions

#### `sendOrderPlacedMessage(order, restaurantName)`

Send order confirmation message.

**Parameters:**
- `order` (Object): Order object with properties:
  - `id` - Order ID
  - `customerName` - Customer name
  - `customerMobile` - Customer phone (10-digit or with country code)
  - `items` - Array of items with `name`, `price`, `qty`
  - `total` - Total amount
  - `paid` - Payment status (0 or 1)
- `restaurantName` (String): Name of restaurant/shop

**Returns:** Promise<Object> - WhatsApp API response

**Example:**
```javascript
const whatsappService = require('./whatsappService');

const order = {
  id: 123,
  customerName: 'Rajesh Kumar',
  customerMobile: '9010002233',
  items: [
    { name: 'Dosa', price: 75, qty: 2 },
    { name: 'Coffee', price: 30, qty: 1 }
  ],
  total: 180,
  paid: 1
};

await whatsappService.sendOrderPlacedMessage(order, 'F3 Drivein');
```

---

#### `sendOrderReadyMessage(order, restaurantName)`

Send order ready notification.

**Parameters:** Same as `sendOrderPlacedMessage()`

**Returns:** Promise<Object> - WhatsApp API response

---

#### `sendOrderCompletedMessage(order, restaurantName)`

Send order completion notification (optional use).

**Parameters:** Same as `sendOrderPlacedMessage()`

**Returns:** Promise<Object> - WhatsApp API response

---

#### `sendTestMessage(phoneNumber)`

Send test message to verify configuration.

**Parameters:**
- `phoneNumber` (String): Customer phone (format: 9010002233 or 919010002233)

**Returns:** Promise<Object> - WhatsApp API response

**Example:**
```javascript
await whatsappService.sendTestMessage('919010002233');
```

---

#### `getWhatsAppStatus()`

Get WhatsApp configuration status.

**Parameters:** None

**Returns:** Object with properties:
- `enabled` (Boolean) - Whether WhatsApp is enabled
- `configured` (Boolean) - Whether credentials are configured
- `phoneNumberId` (String|null) - Phone number ID if configured
- `apiUrl` (String) - API base URL

---

#### `logWhatsAppEvent(eventType, details)`

Log WhatsApp events for monitoring.

**Parameters:**
- `eventType` (String): Event type (e.g., 'ORDER_PLACED_SENT')
- `details` (Object): Event details with status

---

## Security Considerations

### 1. Access Token Security

✅ **DO:**
- Store token in environment variable (never in code)
- Regenerate token regularly (monthly)
- Use System Users instead of personal accounts
- Set minimal required permissions

❌ **DON'T:**
- Commit token to git repository
- Share token in logs or error messages
- Use personal access tokens
- Grant unnecessary permissions

### 2. Phone Number Privacy

✅ **DO:**
- Hash phone numbers before logging (optional)
- Use HTTPS for all API calls
- Limit access to customer data by role

❌ **DON'T:**
- Log full phone numbers in production
- Send test messages to random numbers
- Expose phone numbers in API responses

### 3. Webhook Security

✅ **DO:**
- Use HTTPS only (mandatory by WhatsApp)
- Validate webhook signature header
- Regenerate verify token periodically
- Rate limit webhook endpoint

❌ **DON'T:**
- Use HTTP (WhatsApp will reject)
- Accept unverified webhook requests
- Store credentials in webhook code

### 4. Message Content

✅ **DO:**
- Use templates for consistent messaging
- Include only necessary information
- Respect customer privacy
- Provide opt-out mechanism (future enhancement)

❌ **DON'T:**
- Include sensitive payment info in messages
- Send unsolicited promotional messages
- Use WhatsApp for spam
- Send messages outside business hours (respect timezone)

---

## Message Templates

### Order Placed Template

```
ORDER PLACED ✅

*Order Details:*
Customer: {customerName}
Order ID: #{orderId}
Shop: {shopName}

*Items Ordered:*
{items}

*Summary:*
Total Amount: ₹{totalAmount}
Payment Status: {paymentStatus}

Thank you for your order! Your order will be ready soon.

_Estimated time: 15-20 minutes_
```

### Order Ready Template

```
🎉 ORDER READY FOR PICKUP

Hi {customerFirstName},

Your order #{orderId} is ready for pickup at *{shopName}*!

Please come collect your order at the counter.

Thank you! 🙏
```

### Order Completed Template

```
✅ ORDER COMPLETED

Hi {customerFirstName},

Thank you for your order at *{shopName}*!

Order ID: #{orderId}
Total Amount: ₹{totalAmount}

We hope you enjoyed your meal! 😋
Please visit us again.

_Experience our service by leaving feedback._
```

---

## Performance & Optimization

### Async Message Sending

Messages are sent asynchronously in the background to prevent blocking order operations:

```javascript
// Non-blocking: Order is returned immediately
setImmediate(async () => {
  try {
    await whatsappService.sendOrderPlacedMessage(order, shopName);
  } catch (error) {
    // Logged but doesn't affect order
    console.error('Failed to send message:', error);
  }
});

return res.status(201).json({ order });
```

### Error Handling

- WhatsApp failures don't fail order operations
- Errors are logged for monitoring
- Failed messages can be retried via API

### Rate Limiting

- WhatsApp Cloud API: ~1000 msgs/hour per account
- Order flow uses ~2 msgs per order (placed + ready)
- Handle 500 orders/hour easily

---

## Future Enhancements

Possible additions:

1. **Message Delivery Tracking**
   - Track message read/delivered status
   - Implement webhooks for message status updates

2. **Two-Way Messaging**
   - Allow customers to reply with OTP verification
   - Handle order cancellations via WhatsApp

3. **Message Scheduling**
   - Schedule messages for optimal delivery time
   - Respecting customer timezone

4. **Multimedia Messages**
   - Send order receipt as image/PDF
   - Include restaurant logo/branding

5. **Customer Preferences**
   - Allow opt-in/opt-out of messages
   - Language preferences

6. **Analytics & Reporting**
   - Track message delivery rates
   - Monitor customer engagement

---

## Support & References

### Documentation
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [WhatsApp Business API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference)
- [Message Types Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/messages)

### Tools
- WhatsApp Manager: https://business.facebook.com
- Facebook App Dashboard: https://developers.facebook.com/apps

### Common Issues
- [WhatsApp API Troubleshooting](https://developers.facebook.com/docs/whatsapp/cloud-api/support/troubleshooting)
- [Rate Limiting Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/support/rate-limiting)

---

**Last Updated:** June 15, 2026  
**Maintained by:** F3 Drivein Development Team  
**Questions?** Refer to WhatsApp Cloud API documentation
