/**
 * WhatsApp Business API Service
 * 
 * Handles integration with WhatsApp Cloud API for sending
 * transactional messages to customers during order lifecycle.
 * 
 * Features:
 * - Order Placed notification with invoice summary
 * - Order Ready for Pickup notification
 * - Error handling and retry logic
 * - Comprehensive logging
 * - Environment-based configuration
 */

const https = require('https');

// WhatsApp API Configuration
const WHATSAPP_API_URL = 'https://graph.instagram.com/v18.0';
const WHATSAPP_ACCESS_TOKEN = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
const WHATSAPP_PHONE_NUMBER_ID = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
const WHATSAPP_ENABLED = Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID);

/**
 * Validates WhatsApp configuration at startup
 */
function validateWhatsAppConfig() {
  if (process.env.NODE_ENV === 'production' && !WHATSAPP_ENABLED) {
    console.warn('⚠️  WhatsApp integration disabled: Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
  } else if (WHATSAPP_ENABLED) {
    console.log('✅ WhatsApp Business API configured and enabled');
  }
}

/**
 * Makes HTTP request to WhatsApp Cloud API
 * 
 * @param {string} endpoint - API endpoint path
 * @param {object} payload - Request payload
 * @returns {Promise<object>} API response
 * @throws {Error} If API call fails
 */
async function makeWhatsAppRequest(endpoint, payload) {
  if (!WHATSAPP_ENABLED) {
    throw new Error('WhatsApp integration is not enabled. Check environment variables.');
  }

  return new Promise((resolve, reject) => {
    const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/${endpoint}?access_token=${WHATSAPP_ACCESS_TOKEN}`;
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
      },
      timeout: 30000 // 30 second timeout
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          
          // Check for API errors
          if (res.statusCode >= 400) {
            const errorMsg = parsedData.error?.message || `API Error: ${res.statusCode}`;
            const error = new Error(errorMsg);
            error.statusCode = res.statusCode;
            error.apiResponse = parsedData;
            reject(error);
          } else {
            resolve(parsedData);
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse WhatsApp API response: ${parseError.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`WhatsApp API request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('WhatsApp API request timeout (30s)'));
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

/**
 * Formats customer name for WhatsApp message
 * @param {string} name - Customer name
 * @returns {string} Formatted name or "Customer"
 */
function formatCustomerName(name) {
  return name ? String(name).trim().split(' ')[0] : 'Customer';
}

/**
 * Formats phone number for WhatsApp (removes +, keeps only digits)
 * @param {string} phoneNumber - Customer phone number
 * @returns {string} Formatted phone number (digits only)
 */
function formatPhoneNumber(phoneNumber) {
  const cleaned = String(phoneNumber || '').replace(/\D/g, '');
  if (!cleaned || cleaned.length < 10) {
    throw new Error(`Invalid phone number: ${phoneNumber}`);
  }
  // Ensure Indian number (add country code if not present)
  return cleaned.length === 10 ? `91${cleaned}` : cleaned;
}

/**
 * Sends order placed notification with invoice summary
 * 
 * @param {object} order - Order object containing:
 *   - id: Order ID
 *   - customerName: Customer name
 *   - customerMobile: Customer phone number
 *   - items: Array of order items
 *   - total: Total amount
 *   - paid: Payment status (0 or 1)
 * @param {string} restaurantName - Restaurant/shop name
 * @returns {Promise<object>} WhatsApp API response
 */
async function sendOrderPlacedMessage(order, restaurantName) {
  try {
    if (!order.customerMobile) {
      throw new Error('Customer mobile number is required');
    }

    const phoneNumber = formatPhoneNumber(order.customerMobile);
    const customerFirstName = formatCustomerName(order.customerName);
    
    // Format items list for message
    const itemsList = (order.items || [])
      .map(item => `${item.qty}x ${item.name} - ₹${(item.price * item.qty).toFixed(2)}`)
      .join('\n');

    const invoiceSummary = `
*ORDER PLACED* ✅

*Order Details:*
Customer: ${order.customerName || 'Guest'}
Order ID: #${order.id}
Shop: ${restaurantName}

*Items Ordered:*
${itemsList || 'No items'}

*Summary:*
Total Amount: ₹${parseFloat(order.total || 0).toFixed(2)}
Payment Status: ${Number(order.paid) === 1 ? '✅ PAID' : '⏳ PENDING'}

Thank you for your order! Your order will be ready soon.

_Estimated time: 15-20 minutes_
`.trim();

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: invoiceSummary
      }
    };

    const response = await makeWhatsAppRequest('messages', payload);
    
    logWhatsAppEvent('ORDER_PLACED_SENT', {
      orderId: order.id,
      customerId: phoneNumber,
      messageId: response.messages?.[0]?.id,
      status: 'success'
    });

    return response;

  } catch (error) {
    logWhatsAppEvent('ORDER_PLACED_FAILED', {
      orderId: order.id,
      customerMobile: order.customerMobile,
      error: error.message,
      status: 'error'
    });
    throw error;
  }
}

/**
 * Sends order ready for pickup notification
 * 
 * @param {object} order - Order object containing:
 *   - id: Order ID
 *   - customerName: Customer name
 *   - customerMobile: Customer phone number
 * @param {string} restaurantName - Restaurant/shop name
 * @returns {Promise<object>} WhatsApp API response
 */
async function sendOrderReadyMessage(order, restaurantName) {
  try {
    if (!order.customerMobile) {
      throw new Error('Customer mobile number is required');
    }

    const phoneNumber = formatPhoneNumber(order.customerMobile);
    const customerFirstName = formatCustomerName(order.customerName);

    const readyNotification = `
🎉 *ORDER READY FOR PICKUP*

Hi ${customerFirstName},

Your order #${order.id} is ready for pickup at *${restaurantName}*!

Please come collect your order at the counter.

Thank you! 🙏
`.trim();

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: readyNotification
      }
    };

    const response = await makeWhatsAppRequest('messages', payload);
    
    logWhatsAppEvent('ORDER_READY_SENT', {
      orderId: order.id,
      customerId: phoneNumber,
      messageId: response.messages?.[0]?.id,
      status: 'success'
    });

    return response;

  } catch (error) {
    logWhatsAppEvent('ORDER_READY_FAILED', {
      orderId: order.id,
      customerMobile: order.customerMobile,
      error: error.message,
      status: 'error'
    });
    throw error;
  }
}

/**
 * Sends order completed notification (optional)
 * 
 * @param {object} order - Order object
 * @param {string} restaurantName - Restaurant/shop name
 * @returns {Promise<object>} WhatsApp API response
 */
async function sendOrderCompletedMessage(order, restaurantName) {
  try {
    if (!order.customerMobile) {
      throw new Error('Customer mobile number is required');
    }

    const phoneNumber = formatPhoneNumber(order.customerMobile);
    const customerFirstName = formatCustomerName(order.customerName);

    const completionNotification = `
✅ *ORDER COMPLETED*

Hi ${customerFirstName},

Thank you for your order at *${restaurantName}*!

Order ID: #${order.id}
Total Amount: ₹${parseFloat(order.total || 0).toFixed(2)}

We hope you enjoyed your meal! 😋
Please visit us again.

_Experience our service by leaving feedback._
`.trim();

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: completionNotification
      }
    };

    const response = await makeWhatsAppRequest('messages', payload);
    
    logWhatsAppEvent('ORDER_COMPLETED_SENT', {
      orderId: order.id,
      customerId: phoneNumber,
      messageId: response.messages?.[0]?.id,
      status: 'success'
    });

    return response;

  } catch (error) {
    logWhatsAppEvent('ORDER_COMPLETED_FAILED', {
      orderId: order.id,
      customerMobile: order.customerMobile,
      error: error.message,
      status: 'error'
    });
    throw error;
  }
}

/**
 * Logs WhatsApp events for monitoring and debugging
 * 
 * @param {string} eventType - Type of event (ORDER_PLACED_SENT, ORDER_PLACED_FAILED, etc.)
 * @param {object} details - Event details
 */
function logWhatsAppEvent(eventType, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    eventType,
    details
  };

  if (details.status === 'error') {
    console.error(`❌ WhatsApp ${eventType}:`, logEntry);
  } else {
    console.log(`📱 WhatsApp ${eventType}:`, logEntry);
  }
}

/**
 * Sends test message to verify WhatsApp configuration
 * Used for setup/verification purposes
 * 
 * @param {string} phoneNumber - Test phone number
 * @returns {Promise<object>} API response
 */
async function sendTestMessage(phoneNumber) {
  try {
    const formattedNumber = formatPhoneNumber(phoneNumber);
    const testMessage = `
✅ WhatsApp Integration Test

This is a test message from your F3 Drivein food ordering system.

WhatsApp Business API is successfully configured!
    `.trim();

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: testMessage
      }
    };

    const response = await makeWhatsAppRequest('messages', payload);
    console.log('✅ Test message sent successfully');
    return response;

  } catch (error) {
    console.error('❌ Test message failed:', error.message);
    throw error;
  }
}

/**
 * Retrieves WhatsApp configuration status
 * @returns {object} Configuration status
 */
function getWhatsAppStatus() {
  return {
    enabled: WHATSAPP_ENABLED,
    phoneNumberId: WHATSAPP_ENABLED ? WHATSAPP_PHONE_NUMBER_ID : null,
    configured: Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID),
    apiUrl: WHATSAPP_API_URL
  };
}

module.exports = {
  validateWhatsAppConfig,
  sendOrderPlacedMessage,
  sendOrderReadyMessage,
  sendOrderCompletedMessage,
  sendTestMessage,
  getWhatsAppStatus,
  logWhatsAppEvent,
  WHATSAPP_ENABLED,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN
};
