require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');
const Razorpay = require('razorpay');
const { Pool } = require('pg');
const { parse } = require('csv-parse/sync');
const { Server } = require('socket.io');
const whatsappService = require('./whatsappService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = String(process.env.NODE_ENV || 'development').trim();
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const MANAGEMENT_AUTH_SECRET = String(process.env.MANAGEMENT_AUTH_SECRET || '').trim();
if (NODE_ENV === 'production' && !MANAGEMENT_AUTH_SECRET) {
  throw new Error('MANAGEMENT_AUTH_SECRET must be set in production');
}
const MANAGEMENT_SETUP_KEY = String(process.env.MANAGEMENT_SETUP_KEY || '').trim();
const MANAGEMENT_DEFAULT_PASSWORD = String(process.env.MANAGEMENT_DEFAULT_PASSWORD || '').trim();
const MANAGEMENT_DEV_FALLBACK_PASSWORD = String(process.env.MANAGEMENT_DEV_FALLBACK_PASSWORD || '').trim() || 'admin123';
const MANAGEMENT_ADMIN_USERNAME = String(process.env.MANAGEMENT_ADMIN_USERNAME || 'admin').trim().toLowerCase() || 'admin';
const MANAGEMENT_ADMIN_PASSWORD = String(process.env.MANAGEMENT_ADMIN_PASSWORD || (NODE_ENV === 'production' ? '' : MANAGEMENT_DEV_FALLBACK_PASSWORD)).trim();
const RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS || 60000));
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.RATE_LIMIT_MAX || 240));
const APP_START_TIME = Date.now();
const PGSSL = String(process.env.PGSSL || '').trim().toLowerCase();
const PUBLIC_DEFAULT_RESTAURANT_CODE = normalizeRestaurantCode(process.env.PUBLIC_DEFAULT_RESTAURANT_CODE || '');
const RESTAURANT_DOMAIN_MAP = parseRestaurantDomainMap(process.env.RESTAURANT_DOMAIN_MAP || '');

const RAZORPAY_KEY_ID = String(process.env.RAZORPAY_KEY_ID || '').trim();
const RAZORPAY_KEY_SECRET = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
const RAZORPAY_WEBHOOK_SECRET = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
const RAZORPAY_ENABLED = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
const PARCEL_CHARGE_AMOUNT = 5;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required for PostgreSQL.');
}

function getPostgresSslConfig(connectionString) {
  if (['1', 'true', 'yes', 'require'].includes(PGSSL)) return { rejectUnauthorized: false };
  if (['0', 'false', 'no', 'disable'].includes(PGSSL)) return undefined;
  return /render\.com|supabase\.co|neon\.tech|railway\.app/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined;
}

function getDatabaseHost(connectionString) {
  try {
    return new URL(connectionString).hostname;
  } catch (_error) {
    return '';
  }
}

function buildStartupError(error) {
  if (error && error.code === 'ENOTFOUND') {
    const host = error.hostname || getDatabaseHost(DATABASE_URL) || 'unknown host';
    const details = [
      `PostgreSQL host "${host}" could not be resolved.`,
      'Check the DATABASE_URL environment variable in Render.',
      'Use the full Render Postgres Internal Database URL only when the web service and database are in the same Render account and region.',
      'If they are not in the same account/region, use the External Database URL instead.'
    ];
    const wrapped = new Error(details.join(' '));
    wrapped.cause = error;
    return wrapped;
  }
  return error;
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: getPostgresSslConfig(DATABASE_URL)
});

const razorpay = RAZORPAY_ENABLED
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : null;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const uploadMenuImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = String(path.extname(file.originalname || '') || '').toLowerCase();
      cb(null, `menu-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext && ext.length <= 8 ? ext : '.jpg'}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').toLowerCase().startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image files are allowed'));
  }
}).single('image');

const fallbackMenu = [
  { name: 'Butter chicken', description: 'Creamy tomato gravy', price: 180, emoji: '🍛', category: 'mains' },
  { name: 'Paneer tikka', description: 'Grilled cottage cheese', price: 160, emoji: '🧀', category: 'starters' },
  { name: 'Dal makhani', description: 'Slow-cooked black lentils', price: 140, emoji: '🥘', category: 'mains' },
  { name: 'Garlic naan', description: 'Soft leavened bread', price: 50, emoji: '🫓', category: 'breads' },
  { name: 'Veg biryani', description: 'Fragrant basmati rice', price: 180, emoji: '🍚', category: 'mains' },
  { name: 'Mango lassi', description: 'Chilled yoghurt drink', price: 80, emoji: '🥭', category: 'drinks' },
  { name: 'Masala chai', description: 'Spiced milk tea', price: 40, emoji: '☕', category: 'drinks' },
  { name: 'Samosa', description: 'Crispy pastry with potato filling', price: 30, emoji: '🥟', category: 'starters' }
];

function normalizeRestaurantCode(input) {
  return String(input || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
}

function normalizeSite(input) {
  const value = String(input || '').trim().toLowerCase();
  if (value === 'all') return 'all';
  if (['gandikota', 'gandikotadosa', 'gandikota-site'].includes(value)) return 'gandikota';
  if (['tastyfoods', 'tastyfood', 'tasty-food', 'tastytables', 'tasty-tables', 'new'].includes(value)) return 'tastyfoods';
  return 'tastyfoods';
}

function normalizeHostname(input) {
  return String(input || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

function parseRestaurantDomainMap(input) {
  const map = new Map();
  String(input || '').split(',').forEach((entry) => {
    const [hostPart, codePart] = entry.split(':');
    const host = normalizeHostname(hostPart);
    const code = normalizeRestaurantCode(codePart);
    if (host && code) map.set(host, code);
  });
  return map;
}

function getRestaurantCodeForHost(req) {
  const host = normalizeHostname(req.headers['x-forwarded-host'] || req.headers.host || '');
  return RESTAURANT_DOMAIN_MAP.get(host) || PUBLIC_DEFAULT_RESTAURANT_CODE || '';
}

function getPreferredCustomDomain(restaurantCode) {
  if (!restaurantCode) return null;
  const code = normalizeRestaurantCode(restaurantCode);
  for (const [host, mappedCode] of RESTAURANT_DOMAIN_MAP.entries()) {
    if (mappedCode === code) {
      return host;
    }
  }
  return null;
}

function getActor(req) {
  const actor = req.headers['x-actor'];
  return typeof actor === 'string' && actor.trim() ? actor.trim() : 'system';
}

function hashPasswordWithSalt(password, saltHex = crypto.randomBytes(16).toString('hex')) {
  const normalizedSalt = String(saltHex || '').trim();
  const hash = crypto.pbkdf2Sync(String(password || ''), normalizedSalt, 120000, 64, 'sha512').toString('hex');
  return { salt: normalizedSalt, hash };
}

function verifyPassword(password, saltHex, expectedHashHex) {
  try {
    const computed = hashPasswordWithSalt(password, saltHex).hash;
    const computedBuffer = Buffer.from(computed, 'hex');
    const expectedBuffer = Buffer.from(String(expectedHashHex || ''), 'hex');
    if (computedBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
  } catch (_error) {
    return false;
  }
}

function createManagementToken({ restaurantId, restaurantCode, restaurantName, role, username, isAdmin }) {
  const payload = {
    restaurantId: Number(restaurantId || 0),
    restaurantCode: String(restaurantCode || ''),
    restaurantName: String(restaurantName || ''),
    role: String(role || (isAdmin ? 'admin' : 'owner')),
    username: String(username || ''),
    isAdmin: Boolean(isAdmin),
    iat: Date.now(),
    exp: Date.now() + (24 * 60 * 60 * 1000)
  };
  const base = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', MANAGEMENT_AUTH_SECRET).update(base).digest('base64url');
  return `${base}.${signature}`;
}

function parseManagementToken(token) {
  const text = String(token || '').trim();
  const [base, signature] = text.split('.');
  if (!base || !signature) return null;

  const expected = crypto.createHmac('sha256', MANAGEMENT_AUTH_SECRET).update(base).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return null;

  const payload = JSON.parse(Buffer.from(base, 'base64url').toString('utf8'));
  if ((!payload?.restaurantId && !payload?.isAdmin) || !payload?.exp || Date.now() > Number(payload.exp)) return null;
  return {
    restaurantId: Number(payload.restaurantId || 0),
    restaurantCode: String(payload.restaurantCode || ''),
    restaurantName: String(payload.restaurantName || ''),
    role: String(payload.role || (payload.isAdmin ? 'admin' : 'owner')),
    username: String(payload.username || ''),
    isAdmin: Boolean(payload.isAdmin)
  };
}

function getManagementSession(req) {
  const header = String(req.headers.authorization || '').trim();
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return parseManagementToken(header.slice(7).trim());
}

function requireManagementAuth(req, res, next) {
  const session = getManagementSession(req);
  if (!session?.restaurantId && !session?.isAdmin) {
    return res.status(401).json({ error: 'Management login required' });
  }
  req.management = session;
  return next();
}

function getRateLimitKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function createMemoryRateLimiter({ windowMs, max, keyPrefix }) {
  const buckets = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.min(windowMs, 60000)).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${getRateLimitKey(req)}`;
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'Too many requests, please retry shortly' });
    }

    return next();
  };
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function parseMenuCsv(csvText) {
  const text = String(csvText || '').replace(/^\uFEFF/, '');
  if (!text.trim()) return { rows: [], invalidRows: [] };

  // Use robust CSV parsing to correctly handle quoted fields and embedded newlines
  let records;
  try {
    records = parse(text, { relax_column_count: true, skip_empty_lines: true });
  } catch (e) {
    return { rows: [], invalidRows: [{ line: 1, reason: 'Failed to parse CSV' }] };
  }

  if (!records || !records.length) return { rows: [], invalidRows: [] };

  const firstRow = records[0].map((c) => (String(c || '').trim().toLowerCase()));
  const hasHeader = firstRow.includes('item') || firstRow.includes('name') || firstRow.includes('price');

  const rows = [];
  const invalidRows = [];

  const dataRows = hasHeader ? records.slice(1) : records;
  dataRows.forEach((parsed, index) => {
    const a = parsed.map((c) => String(c || '').trim());
    if (a.length < 3) {
      invalidRows.push({ line: index + (hasHeader ? 2 : 1), reason: 'Expected at least 3 columns: Category, Item, Price' });
      return;
    }
    const category = String(a[0] || '').trim().toLowerCase() || 'other';
    const name = neutralizeCsvField(String(a[1] || '').trim());
    const price = Math.round(Number(String(a[2] || '').replace(/[^\d.]/g, '')));
    const description = neutralizeCsvField(String(a[3] || '').trim() || `${category} menu item`);
    if (!name) {
      invalidRows.push({ line: index + (hasHeader ? 2 : 1), reason: 'Item name is empty' });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      invalidRows.push({ line: index + (hasHeader ? 2 : 1), reason: `Invalid price: ${a[2] || ''}` });
      return;
    }
    rows.push({ name, description, price, category, emoji: '🍽️', available: 1 });
  });

  return { rows, invalidRows };
}

function neutralizeCsvField(value) {
  const v = String(value || '');
  if (!v) return v;
  // Neutralize leading spreadsheet-executable characters to prevent CSV injection
  if (/^[=+\-@].*/.test(v)) return `'${v}`;
  return v;
}

function isValidImage(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(8);
    fs.readSync(fd, header, 0, 8, 0);
    fs.closeSync(fd);
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return true;
    // JPEG: FF D8 FF
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return true;
    // GIF: GIF87a or GIF89a
    if (header.slice(0, 3).toString('ascii') === 'GIF') return true;
    return false;
  } catch (_e) {
    return false;
  }
}

function toOrderLabel(id) {
  return `#${String(id).padStart(4, '0')}`;
}

function getGatewayErrorMessage(error, fallbackMessage) {
  const message = String(
    error?.error?.description
    || error?.description
    || error?.message
    || fallbackMessage
    || 'Payment gateway request failed'
  ).trim();

  const code = String(error?.error?.code || error?.code || '').trim();
  return code ? `${message} (${code})` : message;
}

function toIstDateKey(timestampMs) {
  const date = new Date(Number(timestampMs || Date.now()) + (5.5 * 60 * 60 * 1000));
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildRestaurantPayload(row) {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    address: row.address || 'Miyapur',
    imageUrl: row.image_url || row.imageUrl || null,
    cuisines: row.cuisines || 'South Indian, Indian',
    rating: Number(row.rating || 4.1),
    ratingCount: row.ratingCount || row.rating_count || '1.4K+ ratings',
    priceForTwo: Number(row.priceForTwo || row.price_for_two || 150),
    acceptingOrders: typeof row.acceptingOrders === 'boolean'
      ? row.acceptingOrders
      : Boolean(Number(row.acceptingOrders == null ? 1 : row.acceptingOrders)),
    reopenNote: row.reopenNote || row.reopen_note || null,
    site: normalizeSite(row.site),
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng)
  };
}

function getParcelCharge(orderType) {
  return String(orderType || '').toLowerCase() === 'takeaway' ? PARCEL_CHARGE_AMOUNT : 0;
}

function enrichOrder(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsTotal = Number(items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 0)), 0));
  const parcelCharge = getParcelCharge(order.orderType || order.order_type);
  const inclusiveTotal = itemsTotal + parcelCharge;
  const subtotal = Math.round((inclusiveTotal / 1.05) * 100) / 100;
  const gst = Math.round((inclusiveTotal - subtotal) * 100) / 100;
  const cgst = Math.round((gst / 2) * 100) / 100;
  const sgst = Math.round((gst - cgst) * 100) / 100;
  const total = Math.round(inclusiveTotal * 100) / 100;
  const progressMap = { new: 20, preparing: 55, ready: 85, delivered: 100 };
  return {
    ...order,
    id: Number(order.id),
    restaurantId: Number(order.restaurantId),
    tableNumber: order.tableNumber == null ? null : Number(order.tableNumber),
    paid: Number(order.paid || 0),
    etaMinutes: Number(order.etaMinutes || 15),
    createdAt: Number(order.createdAt),
    updatedAt: Number(order.updatedAt),
    paidAt: order.paidAt == null ? null : Number(order.paidAt),
    label: toOrderLabel(order.id),
    subtotal,
    gst,
    tax: gst,
    cgst,
    sgst,
    total,
    itemsTotal,
    parcelCharge,
    progress: progressMap[order.status] || 0,
    items: items.map((item) => ({
      id: Number(item.id || 0),
      menuItemId: Number(item.menuItemId || 0),
      name: item.name,
      price: Number(item.price || 0),
      qty: Number(item.qty || 0)
    }))
  };
}

async function logAudit(client, { action, entityType, entityId = null, actor = 'system', details = {}, restaurantId = null }) {
  const payload = { ...(details || {}) };
  if (restaurantId != null && payload.restaurantId == null) payload.restaurantId = Number(restaurantId);
  await client.query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [action, entityType, entityId == null ? null : String(entityId), actor, JSON.stringify(payload), Date.now()]
  );
}

async function getRestaurantById(restaurantId) {
  const { rows } = await pool.query(
    `SELECT id, code, name, address, cuisines,
            rating, rating_count AS "ratingCount",
            price_for_two AS "priceForTwo",
            accepting_orders AS "acceptingOrders",
            reopen_note AS "reopenNote",
            image_url AS "imageUrl",
            site, lat, lng
     FROM restaurants
     WHERE id = $1`,
    [restaurantId]
  );
  return rows[0] ? buildRestaurantPayload(rows[0]) : null;
}

async function resolveRestaurantByCode(restaurantCode, fallbackName = '') {
  const code = normalizeRestaurantCode(restaurantCode || fallbackName || 'default') || 'default';
  const { rows } = await pool.query(
    `SELECT id, code, name, address, cuisines,
            rating, rating_count AS "ratingCount",
            price_for_two AS "priceForTwo",
            accepting_orders AS "acceptingOrders",
            reopen_note AS "reopenNote",
            image_url AS "imageUrl",
            site, lat, lng
     FROM restaurants
     WHERE code = $1
     LIMIT 1`,
    [code]
  );
  if (rows[0]) return buildRestaurantPayload(rows[0]);

  const now = Date.now();
  const created = await pool.query(
    `INSERT INTO restaurants (
       code, name, created_at, updated_at, address, cuisines, rating, rating_count, price_for_two, accepting_orders, site
     )
     VALUES ($1, $2, $3, $3, 'Miyapur', 'South Indian, Indian', 4.1, '1.4K+ ratings', 150, TRUE, $4)
     RETURNING id, code, name, address, cuisines,
               rating, rating_count AS "ratingCount",
               price_for_two AS "priceForTwo",
               accepting_orders AS "acceptingOrders",
               reopen_note AS "reopenNote",
               site`,
    [code, String(fallbackName || code || 'Default Restaurant').trim() || 'Default Restaurant', now, normalizeSite(fallbackName || code || 'default')]
  );
  return buildRestaurantPayload(created.rows[0]);
}

async function findRestaurantByCode(restaurantCode) {
  const code = normalizeRestaurantCode(restaurantCode);
  if (!code) return null;
  const { rows } = await pool.query(
    `SELECT id, code, name, address, cuisines,
            rating, rating_count AS "ratingCount",
            price_for_two AS "priceForTwo",
            accepting_orders AS "acceptingOrders",
            reopen_note AS "reopenNote",
            image_url AS "imageUrl",
            site, lat, lng
     FROM restaurants
     WHERE code = $1
     LIMIT 1`,
    [code]
  );
  return rows[0] ? buildRestaurantPayload(rows[0]) : null;
}

async function resolveRestaurantByCodeOrName(input) {
  const raw = String(input || '').trim();
  if (!raw) return resolveRestaurantByCode('gandikotadosa', 'Gandikota');
  const code = normalizeRestaurantCode(raw);
  const { rows } = await pool.query(
    `SELECT id, code, name, address, cuisines,
            rating, rating_count AS "ratingCount",
            price_for_two AS "priceForTwo",
            accepting_orders AS "acceptingOrders",
            reopen_note AS "reopenNote",
            image_url AS "imageUrl",
            site, lat, lng
     FROM restaurants
     WHERE code = $1 OR lower(name) = lower($2)
     ORDER BY CASE WHEN code = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [code, raw]
  );
  return rows[0] ? buildRestaurantPayload(rows[0]) : null;
}

async function getMenu(restaurantId) {
  const { rows } = await pool.query(
    `SELECT id, name, description, price, emoji, category AS cat, image_url AS "imageUrl", available
     FROM menu_items
     WHERE restaurant_id = $1
     ORDER BY id ASC`,
    [restaurantId]
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    price: Number(row.price),
    desc: row.description,
    available: typeof row.available === 'boolean' ? (row.available ? 1 : 0) : Number(row.available)
  }));
}

async function getTables(restaurantId) {
  const { rows } = await pool.query(
    `SELECT table_number AS "tableNumber", status
     FROM table_status
     WHERE restaurant_id = $1
     ORDER BY table_number ASC`,
    [restaurantId]
  );
  return rows.map((row) => ({
    tableNumber: Number(row.tableNumber),
    status: row.status
  }));
}

async function getOrders(restaurantId = null) {
  const params = [];
  const filter = restaurantId == null ? '' : 'WHERE o.restaurant_id = $1';
  if (restaurantId != null) params.push(restaurantId);

  const { rows } = await pool.query(
    `SELECT
       o.id,
       o.restaurant_id AS "restaurantId",
       o.order_type AS "orderType",
       o.table_number AS "tableNumber",
       o.notes,
       o.status,
       o.paid,
       o.eta_minutes AS "etaMinutes",
       o.created_at AS "createdAt",
       o.updated_at AS "updatedAt",
       o.payment_method AS "paymentMethod",
       o.paid_at AS "paidAt",
       o.payment_gateway_order_id AS "paymentGatewayOrderId",
       o.payment_gateway_payment_id AS "paymentGatewayPaymentId",
       o.source,
       o.external_order_id AS "externalOrderId",
       r.code AS "restaurantCode",
       r.name AS "restaurantName",
      o.customer_name AS "customerName",
      o.customer_mobile AS "customerMobile",
       o.delivery_name AS "deliveryName",
       o.delivery_mobile AS "deliveryMobile",
       o.delivery_lat AS "deliveryLat",
       o.delivery_lng AS "deliveryLng",
       COALESCE(
         json_agg(
           json_build_object(
             'id', oi.id,
             'menuItemId', oi.menu_item_id,
             'name', oi.item_name,
             'price', oi.item_price,
             'qty', oi.qty
           )
           ORDER BY oi.id
         ) FILTER (WHERE oi.id IS NOT NULL),
         '[]'::json
       ) AS items
     FROM orders o
     LEFT JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${filter}
     GROUP BY o.id, r.code, r.name
     ORDER BY o.created_at DESC, o.id DESC`,
    params
  );

  const orders = rows.map((row) => enrichOrder(row));

  // Assign date-wise running labels (resets daily) so order IDs start from #0001 each day.
  const sequenceByDate = new Map();
  const labelByOrderId = new Map();
  [...orders]
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0) || Number(a.id || 0) - Number(b.id || 0))
    .forEach((order) => {
      const key = `${Number(order.restaurantId || 0)}:${toIstDateKey(order.createdAt)}`;
      const next = Number(sequenceByDate.get(key) || 0) + 1;
      sequenceByDate.set(key, next);
      labelByOrderId.set(Number(order.id), toOrderLabel(next));
    });

  return orders.map((order) => ({
    ...order,
    label: labelByOrderId.get(Number(order.id)) || toOrderLabel(order.id)
  }));
}

async function getOrderById(orderId) {
  const params = [orderId];
  const { rows } = await pool.query(
    `SELECT
       o.id,
       o.restaurant_id AS "restaurantId",
       o.order_type AS "orderType",
       o.table_number AS "tableNumber",
       o.notes,
       o.status,
       o.paid,
       o.eta_minutes AS "etaMinutes",
       o.created_at AS "createdAt",
       o.updated_at AS "updatedAt",
       o.payment_method AS "paymentMethod",
       o.paid_at AS "paidAt",
       o.payment_gateway_order_id AS "paymentGatewayOrderId",
       o.payment_gateway_payment_id AS "paymentGatewayPaymentId",
       o.source,
       o.external_order_id AS "externalOrderId",
       o.customer_name AS "customerName",
       o.customer_mobile AS "customerMobile",
       o.delivery_name AS "deliveryName",
       o.delivery_mobile AS "deliveryMobile",
       o.delivery_lat AS "deliveryLat",
       o.delivery_lng AS "deliveryLng",
       COALESCE(
         json_agg(
           json_build_object(
             'id', oi.id,
             'menuItemId', oi.menu_item_id,
             'name', oi.item_name,
             'price', oi.item_price,
             'qty', oi.qty
           ) ORDER BY oi.id
         ) FILTER (WHERE oi.id IS NOT NULL),
         '[]'::json
       ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1
     GROUP BY o.id
     LIMIT 1`,
    params
  );
  if (!rows[0]) return null;
  return enrichOrder(rows[0]);
}

function getStats(orders, tables) {
  const activeOrders = orders.filter((order) => order.status !== 'delivered').length;
  const now = Date.now();
  const paidInProgressOrders = orders.filter((order) => Number(order.paid) === 1 && order.status !== 'delivered');
  const overdue = paidInProgressOrders.filter((order) => now - order.createdAt > order.etaMinutes * 60000).length;
  const waitingOrders = paidInProgressOrders;
  const avgWait = waitingOrders.length
    ? Math.round(waitingOrders.reduce((sum, order) => sum + ((now - order.createdAt) / 60000), 0) / waitingOrders.length)
    : 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const revenueToday = orders
    .filter((order) => Number(order.paid) === 1 && order.createdAt >= todayStart.getTime())
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const occupiedTables = tables.filter((table) => table.status === 'occupied' || table.status === 'ordering').length;

  return {
    activeOrders,
    overdue,
    avgWait,
    revenueToday,
    occupiedTables,
    tableCapacity: tables.length
  };
}

async function getState(restaurantId) {
  const [menu, tables, orders] = await Promise.all([
    getMenu(restaurantId),
    getTables(restaurantId),
    getOrders(restaurantId)
  ]);
  return { menu, tables, orders, stats: getStats(orders, tables) };
}

async function getAuditLogsForRestaurant(restaurantId, limit = 30) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 30), 200));
  const { rows } = await pool.query(
    `SELECT id,
            action,
            entity_type AS "entityType",
            entity_id AS "entityId",
            actor,
            details,
            created_at AS "createdAt"
     FROM audit_logs
     WHERE COALESCE((details ->> 'restaurantId')::int, -1) = $1
        OR (entity_type = 'restaurant' AND entity_id = $1::text)
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [restaurantId, safeLimit]
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    createdAt: Number(row.createdAt),
    details: row.details || {}
  }));
}

async function getMenuMap(client, restaurantId) {
  const { rows } = await client.query(
    `SELECT id, name, price, available
     FROM menu_items
     WHERE restaurant_id = $1`,
    [restaurantId]
  );
  return rows.reduce((acc, row) => {
    acc[Number(row.id)] = {
      id: Number(row.id),
      name: row.name,
      price: Number(row.price),
      available: typeof row.available === 'boolean' ? (row.available ? 1 : 0) : Number(row.available)
    };
    return acc;
  }, {});
}

async function ensureDefaultTables(client, restaurantId, desiredCount = 12) {
  const existing = await client.query('SELECT COUNT(*)::int AS count FROM table_status WHERE restaurant_id = $1', [restaurantId]);
  if (Number(existing.rows[0].count) > 0) return;

  for (let tableNumber = 1; tableNumber <= desiredCount; tableNumber += 1) {
    await client.query(
      'INSERT INTO table_status (restaurant_id, table_number, status) VALUES ($1, $2, $3)',
      [restaurantId, tableNumber, 'free']
    );
  }
}

async function createOrder({
  orderType,
  tableNumber = null,
  notes = '',
  items,
  status = 'new',
  paid = 0,
  paymentMethod = null,
  paidAt = null,
  etaMinutes = 15,
  source = 'direct',
  externalOrderId = null,
  restaurantId = 1,
  actor = 'system',
  customerName = null,
  customerMobile = null,
  deliveryName = null,
  deliveryMobile = null,
  deliveryLat = null,
  deliveryLng = null
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const menuMap = await getMenuMap(client, restaurantId);
    const normalizedItems = (Array.isArray(items) ? items : []).map((line) => {
      const menuItemId = Number(line?.menuItemId || 0);
      const qty = Number(line?.qty || 0);
      const menuItem = menuMap[menuItemId];
      if (!menuItem || Number(menuItem.available) !== 1) {
        throw new Error(`Menu item ${menuItemId} is unavailable`);
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('Invalid item quantity');
      }
      return { menuItemId, qty: Math.round(qty), name: menuItem.name, price: Number(menuItem.price) };
    });

    if (!normalizedItems.length) throw new Error('At least one order item is required');

    const now = Date.now();
    const created = await client.query(
      `INSERT INTO orders (
         restaurant_id, order_type, table_number, notes, status, paid,
         eta_minutes, created_at, updated_at, payment_method, paid_at, source, external_order_id,
         customer_name, customer_mobile,
         delivery_name, delivery_mobile, delivery_lat, delivery_lng
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id`,
      [restaurantId, orderType, tableNumber, String(notes || ''), status, paid ? 1 : 0, etaMinutes, now, paymentMethod, paidAt, source, externalOrderId, customerName, customerMobile, deliveryName, deliveryMobile, deliveryLat, deliveryLng]
    );
    const orderId = Number(created.rows[0].id);

    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, item_price, qty)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.menuItemId, item.name, item.price, item.qty]
      );
    }

    if ((orderType === 'dine' || orderType === 'preorder') && tableNumber) {
      await client.query(
        `INSERT INTO table_status (restaurant_id, table_number, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (restaurant_id, table_number)
         DO UPDATE SET status = EXCLUDED.status`,
        [restaurantId, tableNumber, orderType === 'preorder' ? 'ordering' : 'occupied']
      );
    }

    await logAudit(client, {
      action: 'order_created',
      entityType: 'order',
      entityId: orderId,
      actor,
      restaurantId,
      details: { orderType, tableNumber, itemCount: normalizedItems.length }
    });

    await client.query('COMMIT');
    return orderId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function markOrderPaid({ orderId, actor, paymentMethod, paymentGatewayOrderId = null, paymentGatewayPaymentId = null }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `SELECT id, restaurant_id AS "restaurantId", order_type AS "orderType", table_number AS "tableNumber", paid
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order) throw new Error('Order not found');

    if (Number(order.paid) !== 1) {
      const now = Date.now();
      await client.query(
        `UPDATE orders
         SET paid = 1,
             payment_method = $1,
             paid_at = $2,
             payment_gateway_order_id = COALESCE($3, payment_gateway_order_id),
             payment_gateway_payment_id = COALESCE($4, payment_gateway_payment_id),
             updated_at = $2
         WHERE id = $5`,
        [paymentMethod, now, paymentGatewayOrderId, paymentGatewayPaymentId, orderId]
      );

      if (String(order.orderType) === 'dine' && order.tableNumber) {
        await client.query(
          'UPDATE table_status SET status = $1 WHERE restaurant_id = $2 AND table_number = $3',
          ['occupied', Number(order.restaurantId), Number(order.tableNumber)]
        );
      }

      await logAudit(client, {
        action: 'order_paid',
        entityType: 'order',
        entityId: orderId,
        actor,
        restaurantId: Number(order.restaurantId),
        details: { paymentMethod, paymentGatewayOrderId, paymentGatewayPaymentId }
      });
    }

    await client.query('COMMIT');
    const orders = await getOrders(Number(order.restaurantId));
    return orders.find((entry) => entry.id === Number(orderId)) || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function broadcastState(restaurantId) {
  if (restaurantId) {
    io.emit('state:update', await getState(restaurantId));
    return;
  }
  const restaurant = await resolveRestaurantByCode('gandikotadosa', 'Gandikota');
  io.emit('state:update', await getState(restaurant.id));
}

async function seedMenuFromCsv(client, restaurantId) {
  const csvPath = path.join(__dirname, 'data', 'gandikota_menu.csv');
  if (!fs.existsSync(csvPath)) return false;
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const records = parse(csvText, { columns: true, skip_empty_lines: true });
  for (const record of records) {
    const name = neutralizeCsvField(String(record.Item || record.name || '').trim());
    const price = Math.round(Number(record.Price || record.price || 0));
    const category = String(record.Category || record.category || 'other').trim().toLowerCase() || 'other';
    if (!name || price <= 0) continue;
    await client.query(
      `INSERT INTO menu_items (restaurant_id, name, description, price, emoji, category, available)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [restaurantId, name, `${category} menu item`, price, '🍽️', category]
    );
  }
  return true;
}

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        cuisines TEXT NOT NULL DEFAULT 'South Indian, Indian',
        rating NUMERIC(3,1) NOT NULL DEFAULT 4.1,
        rating_count TEXT NOT NULL DEFAULT '1.4K+ ratings',
        price_for_two INTEGER NOT NULL DEFAULT 150,
        accepting_orders BOOLEAN NOT NULL DEFAULT TRUE,
        reopen_note TEXT,
        site TEXT NOT NULL DEFAULT 'tastyfoods'
      )
    `);

    await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS site TEXT`);
    await client.query(`UPDATE restaurants SET site = CASE
      WHEN lower(COALESCE(site, '')) IN ('gandikota', 'gandikotadosa', 'gandikota-site') THEN 'gandikota'
      WHEN lower(COALESCE(site, '')) IN ('tastyfoods', 'tastyfood', 'tasty-food', 'tastytables', 'tasty-tables', 'new') THEN 'tastyfoods'
      WHEN lower(code) LIKE '%gandikota%' OR lower(name) LIKE '%gandikota%' THEN 'gandikota'
      ELSE 'tastyfoods'
    END`);
    await client.query(`ALTER TABLE restaurants ALTER COLUMN site SET DEFAULT 'tastyfoods'`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurant_auth (
        restaurant_id INTEGER PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS management_users (
        id SERIAL PRIMARY KEY,
        restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        created_at BIGINT NOT NULL,
        UNIQUE (restaurant_id, username)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price INTEGER NOT NULL,
        emoji TEXT NOT NULL DEFAULT '🍽️',
        category TEXT NOT NULL DEFAULT 'other',
        image_url TEXT,
        available BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS table_status (
        restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        table_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        PRIMARY KEY (restaurant_id, table_number)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        order_type TEXT NOT NULL,
        table_number INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        paid INTEGER NOT NULL DEFAULT 0,
        eta_minutes INTEGER NOT NULL DEFAULT 15,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        payment_method TEXT,
        paid_at BIGINT,
        payment_gateway_order_id TEXT,
        payment_gateway_payment_id TEXT,
        source TEXT NOT NULL DEFAULT 'direct',
        external_order_id TEXT,
        customer_name TEXT,
        customer_mobile TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
        item_name TEXT NOT NULL,
        item_price INTEGER NOT NULL,
        qty INTEGER NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        actor TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at BIGINT NOT NULL
      )
    `);

    const now = Date.now();
    
    // Delete any 'default' restaurant - only keep gandikotadosa
    await client.query(`DELETE FROM restaurants WHERE code = 'default'`);
    
    // Always use gandikotadosa as the primary restaurant
    const defaultCode = 'gandikotadosa';
    const defaultName = 'Gandikota';
    const restaurantResult = await client.query(
      `INSERT INTO restaurants (
         code, name, created_at, updated_at, address, cuisines, rating, rating_count, price_for_two, accepting_orders, site
       )
       VALUES ($1, $2, $3, $3, 'Miyapur', 'South Indian, Indian', 4.1, '1.4K+ ratings', 150, TRUE, 'gandikota')
       ON CONFLICT (code) DO UPDATE SET updated_at = restaurants.updated_at, site = COALESCE(NULLIF(restaurants.site, ''), EXCLUDED.site)
       RETURNING id`,
      [defaultCode, defaultName, now]
    );
    const defaultRestaurantId = Number(restaurantResult.rows[0].id);

    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_name TEXT`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_mobile TEXT`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_mobile TEXT`);
    
    await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS restaurant_id INTEGER`);
    await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`);
    await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '🍽️'`);
    await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT`);
    await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS image_url TEXT`);
    await client.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT TRUE`);
    await client.query(`UPDATE menu_items SET restaurant_id = $1 WHERE restaurant_id IS NULL`, [defaultRestaurantId]);
    await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lat NUMERIC`);
    await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lng NUMERIC`);
    await client.query(`ALTER TABLE menu_items ALTER COLUMN restaurant_id SET NOT NULL`);

    await client.query('CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items (restaurant_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders (restaurant_id, created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)');

    const menuCount = await client.query('SELECT COUNT(*)::int AS count FROM menu_items WHERE restaurant_id = $1', [defaultRestaurantId]);
    if (Number(menuCount.rows[0].count) === 0) {
      const seeded = await seedMenuFromCsv(client, defaultRestaurantId);
      if (!seeded) {
        for (const item of fallbackMenu) {
          await client.query(
            `INSERT INTO menu_items (restaurant_id, name, description, price, emoji, category, available)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
            [defaultRestaurantId, item.name, item.description, item.price, item.emoji, item.category]
          );
        }
      }
    }

    await ensureDefaultTables(client, defaultRestaurantId, 12);

    if (MANAGEMENT_DEFAULT_PASSWORD) {
      const existing = await client.query('SELECT restaurant_id FROM restaurant_auth WHERE restaurant_id = $1', [defaultRestaurantId]);
      if (!existing.rows.length) {
        const hash = hashPasswordWithSalt(MANAGEMENT_DEFAULT_PASSWORD);
        await client.query(
          'INSERT INTO restaurant_auth (restaurant_id, password_hash, password_salt, updated_at) VALUES ($1, $2, $3, $4)',
          [defaultRestaurantId, hash.hash, hash.salt, now]
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://cdn.razorpay.com"],
      scriptSrcElem: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://cdn.razorpay.com"],
      frameSrc: ["'self'", "https://checkout.razorpay.com", "https://api.razorpay.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
      scriptSrcAttr: ["'unsafe-inline'"]
    }
  }
}));
app.use(compression());
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '').trim();
app.use(cors(ALLOWED_ORIGINS ? { origin: ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) } : undefined));

const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.path === '/api/payments/razorpay/webhook') return next();
  return jsonParser(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.use('/data/uploads', express.static(UPLOADS_DIR));

async function redirectToRestaurantForHost(req, res) {
  const host = normalizeHostname(req.headers['x-forwarded-host'] || req.headers.host || '');
  const mappedCode = RESTAURANT_DOMAIN_MAP.get(host);
  if (mappedCode) {
    const restaurant = await resolveRestaurantByCode(mappedCode);
    if (restaurant) {
      // Serve the TastyFoods storefront directly for custom domain roots. No redirect to /code needed.
      return res.sendFile(path.join(__dirname, 'tastyfoods.html'));
    }
  }

  const code = getRestaurantCodeForHost(req);
  if (code) {
    const restaurant = await resolveRestaurantByCode(code);
    if (restaurant) {
      const preferredCustomDomain = getPreferredCustomDomain(restaurant.code);
      if (preferredCustomDomain) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        return res.redirect(`${protocol}://${preferredCustomDomain}/`);
      }
      return res.redirect(`/${restaurant.code}`);
    }
  }
  const defaultRestaurant = await resolveRestaurantByCode('gandikotadosa', 'Gandikota');
  return res.redirect(`/${defaultRestaurant.code}`);
}

// Route public entry points directly to the TastyFoods storefront page.
app.get(['/', '/index.html', '/client.html', '/restaurants.html', '/tastyfoods', '/tastyfoods/'], (_req, res) =>
  res.sendFile(path.join(__dirname, 'tastyfoods.html'))
);
app.get('/tastyfoods.html', (_req, res) => res.sendFile(path.join(__dirname, 'tastyfoods.html')));
app.get(['/admin', '/admin/', '/admin-dashboard', '/admin-dashboard/', '/admin-dashboard.html'], (_req, res) =>
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'))
);
app.use('/tastyfoods', express.static(path.join(__dirname, 'tastyfoods')));

app.use(express.static(__dirname));
// Support pretty restaurant URLs without changing the visible path.
// Examples supported: /r/:code  and /:code  (if :code is not a reserved path)
app.get(['/r/:code', '/:code'], async (req, res, next) => {
  try {
    const maybe = String(req.params.code || '').trim();
    if (!maybe) return next();

    // reserved paths that should continue to static or other routes
    const reserved = new Set([
      'api', 'admin', 'admin-dashboard', 'admin-dashboard.html', 'client.html', 'management', 'management.html', 'restaurants.html', 'index.html', 'outer-screen.html', 'display', 'data', '_redirects', 'favicon.ico', 'tastyfoods'
    ]);
    if (reserved.has(maybe.toLowerCase())) return next();

    // normalize and check if restaurant exists
    const code = normalizeRestaurantCode(maybe);
    if (!code) return next();
    const restaurant = await findRestaurantByCode(code);
    if (!restaurant) return next();

    // Custom domain redirection logic:
    const currentHost = normalizeHostname(req.headers['x-forwarded-host'] || req.headers.host || '');
    const mappedCodeForHost = RESTAURANT_DOMAIN_MAP.get(currentHost);
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';

    if (mappedCodeForHost) {
      // The current hostname is a custom domain.
      // Redirect any code path suffix to the clean root of the custom domain.
      return res.redirect(`${protocol}://${currentHost}/`);
    }

    const preferredCustomDomain = getPreferredCustomDomain(code);
    if (preferredCustomDomain) {
      // We are on the main domain (or another domain), but this restaurant has a custom domain.
      // Redirect to the clean root of the custom domain.
      return res.redirect(`${protocol}://${preferredCustomDomain}/`);
    }

    // Serve the TastyFoods storefront so pretty restaurant URLs keep the same UI after refresh.
    return res.sendFile(path.join(__dirname, 'tastyfoods.html'));
  } catch (err) {
    return next();
  }
});
app.use('/api', createMemoryRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  keyPrefix: 'api'
}));

app.get('/client', (_req, res) => res.redirect('/client.html'));
app.get('/management', (_req, res) => res.redirect('/management.html'));
app.get('/outer-screen', (_req, res) => res.redirect('/outer-screen.html'));
app.get('/display', (_req, res) => res.redirect('/outer-screen.html'));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({
      ok: true,
      env: NODE_ENV,
      port: PORT,
      uptimeSeconds: Math.floor((Date.now() - APP_START_TIME) / 1000),
      db: { engine: 'postgresql', configured: true }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/state', async (_req, res) => {
  const restaurant = await resolveRestaurantByCode('gandikotadosa', 'Gandikota');
  return res.json(await getState(restaurant.id));
});

app.get('/api/public/config', async (req, res) => {
  const host = normalizeHostname(req.headers['x-forwarded-host'] || req.headers.host || '');
  const hasCustomDomain = RESTAURANT_DOMAIN_MAP.has(host);
  const restaurantCode = getRestaurantCodeForHost(req);
  return res.json({
    restaurantCode: restaurantCode || null,
    defaultRestaurantCode: PUBLIC_DEFAULT_RESTAURANT_CODE || null,
    isCustomDomain: hasCustomDomain
  });
});

app.get('/api/public/restaurants', async (req, res) => {
  const requestedSite = normalizeSite(String(req.query.site || req.query.source || 'tastyfoods').trim());
  const siteFilter = requestedSite === 'all' ? '' : `AND COALESCE(NULLIF(lower(site), ''), 'tastyfoods') = $1`;
  const params = requestedSite === 'all' ? [] : [requestedSite];
  const { rows } = await pool.query(
    `SELECT id, code, name, address, cuisines,
            rating, rating_count AS "ratingCount",
            price_for_two AS "priceForTwo",
            accepting_orders AS "acceptingOrders",
            reopen_note AS "reopenNote",
            image_url AS "imageUrl",
            site, lat, lng
     FROM restaurants
     WHERE EXISTS (
       SELECT 1 FROM restaurant_auth
       WHERE restaurant_auth.restaurant_id = restaurants.id
     )
     ${siteFilter}
     ORDER BY name ASC`,
    params
  );
  return res.json({ restaurants: rows.map(buildRestaurantPayload) });
});

app.get('/api/public/state', async (req, res) => {
  const restaurantInput = String(req.query.restaurant || req.query.restaurantCode || 'gandikotadosa').trim();
  const restaurant = await resolveRestaurantByCodeOrName(restaurantInput) || await resolveRestaurantByCode('gandikotadosa', 'Gandikota');
  if (!restaurant?.id) return res.status(404).json({ error: 'Restaurant not found' });
  return res.json({
    ...(await getState(restaurant.id)),
    restaurant
  });
});

app.post('/api/management/register', async (req, res) => {
  const restaurantInput = String(req.body?.restaurant || req.body?.restaurantCode || '').trim();
  const restaurantName = String(req.body?.restaurantName || restaurantInput || '').trim();
  const password = String(req.body?.password || '').trim();
  const setupKey = String(req.body?.setupKey || '').trim();
  const requestedSite = normalizeSite(String(req.body?.site || req.body?.siteName || req.body?.siteType || 'tastyfoods').trim());

  if (!restaurantInput) return res.status(400).json({ error: 'Restaurant name or code is required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const normalizedCode = normalizeRestaurantCode(restaurantInput);
  const existingRestaurant = await findRestaurantByCode(normalizedCode);
  const restaurant = await resolveRestaurantByCode(restaurantInput, restaurantName || restaurantInput);
  const isNewRestaurant = !existingRestaurant;
  if (restaurant?.id) {
    await pool.query('UPDATE restaurants SET site = $1 WHERE id = $2', [requestedSite, restaurant.id]);
    restaurant.site = requestedSite;
  }
  const existing = await pool.query('SELECT restaurant_id FROM restaurant_auth WHERE restaurant_id = $1', [restaurant.id]);
  if (existing.rows.length && MANAGEMENT_SETUP_KEY && setupKey !== MANAGEMENT_SETUP_KEY) {
    return res.status(403).json({ error: 'Valid setup key required to change an existing restaurant password' });
  }

  const hash = hashPasswordWithSalt(password);
  await pool.query(
    `INSERT INTO restaurant_auth (restaurant_id, password_hash, password_salt, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (restaurant_id)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, password_salt = EXCLUDED.password_salt, updated_at = EXCLUDED.updated_at`,
    [restaurant.id, hash.hash, hash.salt, Date.now()]
  );

  // Ensure an owner user exists in management_users for this restaurant
  try {
    const existingUser = await pool.query('SELECT id FROM management_users WHERE restaurant_id = $1 AND username = $2', [restaurant.id, 'owner']);
    if (!existingUser.rows.length) {
      const now = Date.now();
      await pool.query(
        `INSERT INTO management_users (restaurant_id, username, password_hash, password_salt, role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [restaurant.id, 'owner', hash.hash, hash.salt, 'owner', now]
      );
    }
  } catch (e) {
    // ignore user creation errors
  }

  if (isNewRestaurant) {
    const client = await pool.connect();
    try {
      await ensureDefaultTables(client, restaurant.id, 12);
    } finally {
      client.release();
    }
  }

  return res.json({
    ok: true,
    created: isNewRestaurant,
    token: createManagementToken({
      restaurantId: restaurant.id,
      restaurantCode: restaurant.code,
      restaurantName: restaurant.name,
      role: 'owner'
    }),
    restaurant,
    username: 'owner'
  });
});

const uploadRestaurantImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = String(path.extname(file.originalname || '') || '').toLowerCase();
      cb(null, `restaurant-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext && ext.length <= 8 ? ext : '.jpg'}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').toLowerCase().startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image files are allowed'));
  }
}).single('image');

app.post('/api/management/restaurant/image', requireManagementAuth, (req, res) => {
  uploadRestaurantImage(req, res, async (uploadError) => {
    if (uploadError) return res.status(400).json({ error: uploadError.message || 'Failed to upload image' });
    try {
      if (!req.file) return res.status(400).json({ error: 'Image file is required' });
      const savedPath = path.join(UPLOADS_DIR, req.file.filename);
      if (!isValidImage(savedPath)) {
        try { fs.unlinkSync(savedPath); } catch (_e) {}
        return res.status(400).json({ error: 'Uploaded file is not a valid image' });
      }
      const imageUrl = `/data/uploads/${req.file.filename}`;
      await pool.query('UPDATE restaurants SET image_url = $1, updated_at = $2 WHERE id = $3', [imageUrl, Date.now(), req.management.restaurantId]);
      await logAudit(pool, {
        action: 'restaurant_image_uploaded', entityType: 'restaurant', entityId: req.management.restaurantId, actor: `${getActor(req)}:${req.management.restaurantCode}`, restaurantId: req.management.restaurantId, details: { imageUrl }
      });
      await broadcastState(req.management.restaurantId);
      return res.json({ ok: true, imageUrl });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to update restaurant image' });
    }
  });
});

app.patch('/api/management/restaurant', requireManagementAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const address = String(req.body?.address || '').trim();
    const lat = req.body?.lat == null ? null : Number(req.body.lat);
    const lng = req.body?.lng == null ? null : Number(req.body.lng);
    const cuisines = String(req.body?.cuisines || '').trim();
    if (!name && !address && !cuisines) return res.status(400).json({ error: 'At least one field (name|address|cuisines) is required' });
    const updates = [];
    const params = [];
    let idx = 1;
    if (name) { updates.push(`name = $${idx++}`); params.push(name); }
    if (address) { updates.push(`address = $${idx++}`); params.push(address); }
    if (lat != null) { updates.push(`lat = $${idx++}`); params.push(lat); }
    if (lng != null) { updates.push(`lng = $${idx++}`); params.push(lng); }
    if (cuisines) { updates.push(`cuisines = $${idx++}`); params.push(cuisines); }
    params.push(Date.now());
    params.push(req.management.restaurantId);
    const sql = `UPDATE restaurants SET ${updates.join(', ')}, updated_at = $${idx++} WHERE id = $${idx}`;
    await pool.query(sql, params);
    await logAudit(pool, { action: 'restaurant_updated', entityType: 'restaurant', entityId: req.management.restaurantId, actor: `${getActor(req)}:${req.management.restaurantCode}`, restaurantId: req.management.restaurantId, details: { name, address, cuisines } });
    await broadcastState(req.management.restaurantId);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to update restaurant' });
  }
});

app.post('/api/management/login', async (req, res) => {
  const restaurantInput = String(req.body?.restaurant || '').trim();
  const password = String(req.body?.password || '').trim();
  const username = String(req.body?.username || '').trim();
  if (!restaurantInput || !password) {
    return res.status(400).json({ error: 'Restaurant and password are required' });
  }

  const wantsAdmin = ['admin', 'all', 'all-restaurants'].includes(restaurantInput.toLowerCase())
    || username.toLowerCase() === MANAGEMENT_ADMIN_USERNAME;
  if (wantsAdmin) {
    if (!MANAGEMENT_ADMIN_PASSWORD) {
      return res.status(403).json({ error: 'Admin login is not configured' });
    }
    const adminUsername = username || restaurantInput;
    const validAdmin = adminUsername.toLowerCase() === MANAGEMENT_ADMIN_USERNAME && password === MANAGEMENT_ADMIN_PASSWORD;
    if (!validAdmin) return res.status(401).json({ error: 'Invalid admin username or password' });
    const restaurant = { id: 0, code: 'all', name: 'All Restaurants' };
    return res.json({
      ok: true,
      token: createManagementToken({
        restaurantId: 0,
        restaurantCode: 'all',
        restaurantName: 'All Restaurants',
        role: 'admin',
        username: MANAGEMENT_ADMIN_USERNAME,
        isAdmin: true
      }),
      restaurant,
      role: 'admin',
      username: MANAGEMENT_ADMIN_USERNAME,
      isAdmin: true
    });
  }

  const restaurant = await resolveRestaurantByCodeOrName(restaurantInput);
  if (!restaurant?.id) return res.status(401).json({ error: 'Invalid restaurant or password' });

  const authResult = await pool.query(
    `SELECT password_hash AS "passwordHash", password_salt AS "passwordSalt"
     FROM restaurant_auth
     WHERE restaurant_id = $1`,
    [restaurant.id]
  );
  const auth = authResult.rows[0];

  // If username provided, try management_users lookup
  if (username) {
    const userRes = await pool.query(
      `SELECT id, username, password_hash AS "passwordHash", password_salt AS "passwordSalt", role
       FROM management_users
       WHERE restaurant_id = $1 AND lower(username) = lower($2)
       LIMIT 1`,
      [restaurant.id, username]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid restaurant, user, or password' });
    const validUser = verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!validUser) return res.status(401).json({ error: 'Invalid restaurant, user, or password' });
    return res.json({ ok: true, token: createManagementToken({ restaurantId: restaurant.id, restaurantCode: restaurant.code, restaurantName: restaurant.name, role: user.role }), restaurant, role: user.role, username: user.username });
  }

  let valid = false;
  if (auth?.passwordHash && auth?.passwordSalt) {
    valid = verifyPassword(password, auth.passwordSalt, auth.passwordHash);
  } else if (MANAGEMENT_DEFAULT_PASSWORD) {
    // allow explicit MANAGEMENT_DEFAULT_PASSWORD (set via env) to authenticate when no auth row exists
    valid = password === MANAGEMENT_DEFAULT_PASSWORD;
  } else {
    // No auth available for this restaurant and no default password configured — reject
    valid = false;
  }

  if (!valid) return res.status(401).json({ error: 'Invalid restaurant or password' });

  return res.json({ ok: true, token: createManagementToken({ restaurantId: restaurant.id, restaurantCode: restaurant.code, restaurantName: restaurant.name, role: 'owner' }), restaurant, role: 'owner', username: 'owner' });
});

app.get('/api/management/state', requireManagementAuth, async (req, res) => {
  if (req.management.isAdmin) {
    const { rows } = await pool.query(
      `SELECT id, code, name, address, cuisines,
              rating, rating_count AS "ratingCount",
              price_for_two AS "priceForTwo",
              accepting_orders AS "acceptingOrders",
              reopen_note AS "reopenNote",
              image_url AS "imageUrl",
              site, lat, lng
       FROM restaurants
       ORDER BY name ASC`
    );
    const restaurants = rows.map(buildRestaurantPayload);
    const orders = await getOrders(null);
    return res.json({
      menu: [],
      tables: [],
      orders,
      restaurants,
      stats: {
        restaurants: restaurants.length,
        openRestaurants: restaurants.filter((restaurant) => restaurant.acceptingOrders !== false).length,
        closedRestaurants: restaurants.filter((restaurant) => restaurant.acceptingOrders === false).length
      },
      restaurant: {
        id: 0,
        code: 'all',
        name: 'All Restaurants',
        address: '',
        cuisines: '',
        rating: 0,
        ratingCount: '',
        priceForTwo: 0,
        acceptingOrders: true,
        reopenNote: null
      }
    });
  }

  const restaurant = await getRestaurantById(req.management.restaurantId);
  return res.json({
    ...(await getState(req.management.restaurantId)),
    restaurant: restaurant || {
      id: req.management.restaurantId,
      code: req.management.restaurantCode,
      name: req.management.restaurantName,
      address: 'Miyapur',
      cuisines: 'South Indian, Indian',
      rating: 4.1,
      ratingCount: '1.4K+ ratings',
      priceForTwo: 150,
      acceptingOrders: true,
      reopenNote: null
    }
  });
});

app.post('/api/management/outlet-status', requireManagementAuth, async (req, res) => {
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;
  const acceptingOrders = req.body?.acceptingOrders === false ? false : true;
  const reopenNote = acceptingOrders ? null : (String(req.body?.reopenNote || '').trim() || null);

  await pool.query(
    'UPDATE restaurants SET accepting_orders = $1, reopen_note = $2, updated_at = $3 WHERE id = $4',
    [acceptingOrders, reopenNote, Date.now(), req.management.restaurantId]
  );
  await logAudit(pool, {
    action: 'outlet_status_updated',
    entityType: 'restaurant',
    entityId: req.management.restaurantId,
    actor,
    restaurantId: req.management.restaurantId,
    details: { acceptingOrders, reopenNote }
  });

  await broadcastState(req.management.restaurantId);
  return res.json({ ok: true, acceptingOrders, reopenNote });
});

function requireOwner(req, res, next) {
  if (!req.management || String(req.management.role || 'owner') !== 'owner') {
    return res.status(403).json({ error: 'Owner role required' });
  }
  return next();
}

// List management users for the restaurant
app.get('/api/management/users', requireManagementAuth, async (req, res) => {
  if (req.management.isAdmin) return res.json({ users: [] });
  const { rows } = await pool.query(
    `SELECT id, username, role, created_at AS "createdAt" FROM management_users WHERE restaurant_id = $1 ORDER BY id ASC`,
    [req.management.restaurantId]
  );
  return res.json({ users: rows.map(r => ({ id: Number(r.id), username: r.username, role: r.role, createdAt: Number(r.createdAt || 0) })) });
});

// Create management user (owner only)
app.post('/api/management/users', requireManagementAuth, requireOwner, async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  const role = String(req.body?.role || 'staff').trim() === 'owner' ? 'owner' : 'staff';
  if (!username || password.length < 6) return res.status(400).json({ error: 'Username and password (>=6) required' });
  const hash = hashPasswordWithSalt(password);
  const now = Date.now();
  try {
    const created = await pool.query(
      `INSERT INTO management_users (restaurant_id, username, password_hash, password_salt, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, role, created_at AS "createdAt"`,
      [req.management.restaurantId, username, hash.hash, hash.salt, role, now]
    );
    await logAudit(pool, { action: 'management_user_created', entityType: 'management_user', entityId: created.rows[0].id, actor: `${getActor(req)}:${req.management.restaurantCode}`, restaurantId: req.management.restaurantId, details: { username, role } });
    return res.status(201).json({ user: { id: Number(created.rows[0].id), username: created.rows[0].username, role: created.rows[0].role, createdAt: Number(created.rows[0].createdAt || now) } });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create user' });
  }
});

// Delete management user (owner only)
app.delete('/api/management/users/:id', requireManagementAuth, requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  const result = await pool.query('DELETE FROM management_users WHERE id = $1 AND restaurant_id = $2 RETURNING id, username', [id, req.management.restaurantId]);
  if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
  await logAudit(pool, { action: 'management_user_deleted', entityType: 'management_user', entityId: id, actor: `${getActor(req)}:${req.management.restaurantCode}`, restaurantId: req.management.restaurantId, details: { username: result.rows[0].username } });
  return res.json({ ok: true });
});

// Update management user (owner only) - change password or role
app.patch('/api/management/users/:id', requireManagementAuth, requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  const password = req.body?.password == null ? null : String(req.body.password || '').trim();
  const role = String(req.body?.role || '').trim();
  const updates = [];
  const params = [];
  let idx = 1;
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const hash = hashPasswordWithSalt(password);
    updates.push(`password_hash = $${idx++}`); params.push(hash.hash);
    updates.push(`password_salt = $${idx++}`); params.push(hash.salt);
  }
  if (role) {
    const safeRole = role === 'owner' ? 'owner' : 'staff';
    updates.push(`role = $${idx++}`); params.push(safeRole);
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(id);
  params.push(req.management.restaurantId);
  try {
    const sql = `UPDATE management_users SET ${updates.join(', ')} WHERE id = $${idx++} AND restaurant_id = $${idx} RETURNING id, username, role`;
    const result = await pool.query(sql, params);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    await logAudit(pool, { action: 'management_user_updated', entityType: 'management_user', entityId: id, actor: `${getActor(req)}:${req.management.restaurantCode}`, restaurantId: req.management.restaurantId, details: { id, role: result.rows[0].role } });
    return res.json({ ok: true, user: { id: Number(result.rows[0].id), username: result.rows[0].username, role: result.rows[0].role } });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to update user' });
  }
});

// List ALL restaurants in database (for debugging)
app.get('/api/management/all-restaurants', requireManagementAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, code, name, address, cuisines, rating, rating_count, price_for_two, accepting_orders, created_at 
     FROM restaurants 
     ORDER BY created_at DESC`
  );
  return res.json({ restaurants: rows });
});

app.get('/api/menu', async (req, res) => {
  const restaurant = await resolveRestaurantByCodeOrName(String(req.query.restaurant || 'gandikotadosa').trim()) || await resolveRestaurantByCode('gandikotadosa');
  return res.json(await getMenu(restaurant.id));
});

app.post('/api/menu/:id/availability', requireManagementAuth, async (req, res) => {
  const menuItemId = Number(req.params.id);
  const available = !(req.body?.available === false || req.body?.available === 0 || req.body?.available === '0');
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;

  const result = await pool.query(
    `UPDATE menu_items
     SET available = $1
     WHERE id = $2 AND restaurant_id = $3
     RETURNING id, name`,
    [available, menuItemId, req.management.restaurantId]
  );
  const item = result.rows[0];
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  await logAudit(pool, {
    action: 'menu_availability_changed',
    entityType: 'menu_item',
    entityId: menuItemId,
    actor,
    restaurantId: req.management.restaurantId,
    details: { name: item.name, to: available ? 1 : 0 }
  });
  await broadcastState(req.management.restaurantId);
  return res.json({ ok: true, available: available ? 1 : 0 });
});

app.patch('/api/menu/:id/name', requireManagementAuth, async (req, res) => {
  const menuItemId = Number(req.params.id);
  const name = String(req.body?.name || '').trim();
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;

  if (!menuItemId) return res.status(400).json({ error: 'Valid menu item ID is required' });
  if (!name) return res.status(400).json({ error: 'New menu item name is required' });

  const result = await pool.query(
    `UPDATE menu_items
     SET name = $1
     WHERE id = $2 AND restaurant_id = $3
     RETURNING id, name`,
    [name, menuItemId, req.management.restaurantId]
  );
  const item = result.rows[0];
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  await logAudit(pool, {
    action: 'menu_item_renamed',
    entityType: 'menu_item',
    entityId: menuItemId,
    actor,
    restaurantId: req.management.restaurantId,
    details: { name: item.name }
  });

  await broadcastState(req.management.restaurantId);
  return res.json({ ok: true, id: item.id, name: item.name });
});

app.patch('/api/menu/:id', requireManagementAuth, async (req, res) => {
  const menuItemId = Number(req.params.id);
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.desc || req.body?.description || '').trim();
  const price = Math.round(Number(req.body?.price || 0));
  const category = String(req.body?.cat || req.body?.category || '').trim().toLowerCase();
  const emoji = String(req.body?.emoji || '').trim();
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;

  if (!menuItemId) return res.status(400).json({ error: 'Valid menu item ID is required' });
  if (!name) return res.status(400).json({ error: 'Menu item name is required' });
  if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'Price must be greater than 0' });
  if (!category) return res.status(400).json({ error: 'Category is required' });

  const result = await pool.query(
    `UPDATE menu_items
     SET name = $1, description = $2, price = $3, category = $4, emoji = $5
     WHERE id = $6 AND restaurant_id = $7
     RETURNING id, name, description, price, category, emoji`,
    [name, description || 'Custom menu item', price, category, emoji || '🍽️', menuItemId, req.management.restaurantId]
  );
  const item = result.rows[0];
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  await logAudit(pool, {
    action: 'menu_item_updated',
    entityType: 'menu_item',
    entityId: menuItemId,
    actor,
    restaurantId: req.management.restaurantId,
    details: { name: item.name, price: Number(item.price), cat: item.category }
  });

  await broadcastState(req.management.restaurantId);
  return res.json({ ok: true, item });
});

app.post('/api/menu', requireManagementAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.desc || req.body?.description || '').trim() || 'Custom menu item';
  const price = Math.round(Number(req.body?.price || 0));
  const emoji = String(req.body?.emoji || '🍽️').trim() || '🍽️';
  const category = String(req.body?.cat || req.body?.category || 'other').trim().toLowerCase() || 'other';
  const available = !(req.body?.available === false || req.body?.available === 0 || req.body?.available === '0');
  const imageUrl = String(req.body?.imageUrl || '').trim() || null;
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;

  if (!name) return res.status(400).json({ error: 'Menu item name is required' });
  if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'Price must be greater than 0' });

  const created = await pool.query(
    `INSERT INTO menu_items (restaurant_id, name, description, price, emoji, category, image_url, available)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [req.management.restaurantId, name, description, price, emoji, category, imageUrl, available]
  );
  const menuItemId = Number(created.rows[0].id);

  await logAudit(pool, {
    action: 'menu_item_added',
    entityType: 'menu_item',
    entityId: menuItemId,
    actor,
    restaurantId: req.management.restaurantId,
    details: { name, price, cat: category }
  });
  await broadcastState(req.management.restaurantId);
  return res.status(201).json({ id: menuItemId });
});

app.delete('/api/menu/:id', requireManagementAuth, async (req, res) => {
  const menuItemId = Number(req.params.id);
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;
  const result = await pool.query(
    `DELETE FROM menu_items
     WHERE id = $1 AND restaurant_id = $2
     RETURNING id, name, price, category, image_url AS "imageUrl"`,
    [menuItemId, req.management.restaurantId]
  );
  const item = result.rows[0];
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  if (item.imageUrl && String(item.imageUrl).startsWith('/data/uploads/')) {
    const previousPath = path.normalize(path.join(__dirname, String(item.imageUrl).replace(/^\//, '')));
    if (previousPath.startsWith(UPLOADS_DIR) && fs.existsSync(previousPath)) {
      try {
        fs.unlinkSync(previousPath);
      } catch (_error) {
      }
    }
  }

  await logAudit(pool, {
    action: 'menu_item_deleted',
    entityType: 'menu_item',
    entityId: menuItemId,
    actor,
    restaurantId: req.management.restaurantId,
    details: { name: item.name, price: Number(item.price), cat: item.category }
  });
  await broadcastState(req.management.restaurantId);
  return res.json({ ok: true });
});

app.post('/api/menu/bulk', requireManagementAuth, async (req, res) => {
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!items.length) return res.status(400).json({ error: 'Menu items are required' });

  const rows = [];
  const errors = [];

  items.forEach((item, index) => {
    const name = neutralizeCsvField(String(item?.name || '').trim());
    const price = Math.round(Number(item?.price || 0));
    const category = String(item?.cat || item?.category || 'general').trim().toLowerCase() || 'general';
    const description = neutralizeCsvField(String(item?.desc || item?.description || 'Custom menu item').trim() || 'Custom menu item');
    const emoji = String(item?.emoji || '🍽️').trim() || '🍽️';
    const available = !(item?.available === false || item?.available === 0 || item?.available === '0');

    if (!name) {
      errors.push(`Row ${index + 1}: Name is required`);
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`Row ${index + 1}: Price must be greater than 0`);
      return;
    }

    rows.push({ name, price, category, description, emoji, available });
  });

  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM menu_items WHERE restaurant_id = $1', [req.management.restaurantId]);

    for (const row of rows) {
      await client.query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, emoji, category, available)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.management.restaurantId, row.name, row.description, row.price, row.emoji, row.category, row.available]
      );
    }

    await logAudit(client, {
      action: 'menu_bulk_uploaded',
      entityType: 'menu',
      actor,
      restaurantId: req.management.restaurantId,
      details: { inserted: rows.length, replaceExisting: true }
    });

    await client.query('COMMIT');
    await broadcastState(req.management.restaurantId);
    return res.json({ ok: true, success: true, inserted: rows.length });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: error.message || 'Failed to upload menu' });
  } finally {
    client.release();
  }
});

app.post('/api/menu/:id/image-url', requireManagementAuth, async (req, res) => {
  const menuItemId = Number(req.params.id);
  const imageUrl = String(req.body?.imageUrl || '').trim();
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;

  if (!menuItemId) return res.status(400).json({ error: 'Valid menu item ID is required' });
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    return res.status(400).json({ error: 'Image URL must start with http:// or https://' });
  }

  const result = await pool.query(
    `UPDATE menu_items
     SET image_url = $1
     WHERE id = $2 AND restaurant_id = $3
     RETURNING id, name, image_url AS "imageUrl"`,
    [imageUrl || null, menuItemId, req.management.restaurantId]
  );
  const item = result.rows[0];
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  await logAudit(pool, {
    action: 'menu_image_url_updated',
    entityType: 'menu_item',
    entityId: menuItemId,
    actor,
    restaurantId: req.management.restaurantId,
    details: { name: item.name, imageUrl: item.imageUrl }
  });

  await broadcastState(req.management.restaurantId);
  return res.json({ ok: true, imageUrl: item.imageUrl });
});

app.post('/api/menu/:id/image', requireManagementAuth, (req, res) => {
  uploadMenuImage(req, res, async (uploadError) => {
    if (uploadError) return res.status(400).json({ error: uploadError.message || 'Failed to upload image' });

    try {
      const menuItemId = Number(req.params.id);
      const actor = `${getActor(req)}:${req.management.restaurantCode}`;
      const itemResult = await pool.query(
        `SELECT id, name, image_url AS "imageUrl"
         FROM menu_items
         WHERE id = $1 AND restaurant_id = $2`,
        [menuItemId, req.management.restaurantId]
      );
      const item = itemResult.rows[0];
      if (!item) return res.status(404).json({ error: 'Menu item not found' });
      if (!req.file) return res.status(400).json({ error: 'Image file is required' });

      const savedPath = path.join(UPLOADS_DIR, req.file.filename);
      if (!isValidImage(savedPath)) {
        try { fs.unlinkSync(savedPath); } catch (_e) {}
        return res.status(400).json({ error: 'Uploaded file is not a valid image' });
      }

      const imageUrl = `/data/uploads/${req.file.filename}`;
      await pool.query(
        'UPDATE menu_items SET image_url = $1 WHERE id = $2 AND restaurant_id = $3',
        [imageUrl, menuItemId, req.management.restaurantId]
      );

      await logAudit(pool, {
        action: 'menu_image_uploaded',
        entityType: 'menu_item',
        entityId: menuItemId,
        actor,
        restaurantId: req.management.restaurantId,
        details: { name: item.name, imageUrl }
      });
      await broadcastState(req.management.restaurantId);
      return res.json({ ok: true, imageUrl });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to upload image' });
    }
  });
});

app.post('/api/menu/import-csv', requireManagementAuth, async (req, res) => {
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;
  const csvText = String(req.body?.csvText || '');
  const replaceExisting = req.body?.replaceExisting === true;
  if (!csvText.trim()) return res.status(400).json({ error: 'CSV content is required' });

  const { rows, invalidRows } = parseMenuCsv(csvText);
  if (!rows.length) return res.status(400).json({ error: 'No valid menu rows found in CSV', invalidRows });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (replaceExisting) {
      await client.query('DELETE FROM menu_items WHERE restaurant_id = $1', [req.management.restaurantId]);
    }

    for (const row of rows) {
      await client.query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, emoji, category, available)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.management.restaurantId, row.name, row.description, row.price, row.emoji, row.category, Boolean(row.available)]
      );
    }

    await logAudit(client, {
      action: 'menu_csv_imported',
      entityType: 'menu',
      actor,
      restaurantId: req.management.restaurantId,
      details: { inserted: rows.length, invalidRows: invalidRows.length, replaceExisting }
    });

    await client.query('COMMIT');
    await broadcastState(req.management.restaurantId);
    return res.json({
      ok: true,
      restaurant: {
        id: req.management.restaurantId,
        code: req.management.restaurantCode,
        name: req.management.restaurantName
      },
      inserted: rows.length,
      invalidRows,
      replaceExisting
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: error.message || 'Failed to import CSV' });
  } finally {
    client.release();
  }
});

app.get('/api/audit-logs', requireManagementAuth, async (req, res) => {
  const limit = Number(req.query.limit || 30);
  return res.json({ logs: await getAuditLogsForRestaurant(req.management.restaurantId, limit) });
});

app.post('/api/orders', async (req, res) => {
  try {
    const session = getManagementSession(req);
    const requestedRestaurant = session
      ? null
      : (await resolveRestaurantByCodeOrName(String(req.body?.restaurantCode || req.body?.restaurant || 'gandikotadosa').trim()));
    const restaurantId = session?.restaurantId || requestedRestaurant?.id || (await resolveRestaurantByCode('gandikotadosa')).id;
    const restaurant = await getRestaurantById(restaurantId);
    if (restaurant?.acceptingOrders === false && !session) {
      return res.status(400).json({ error: 'This outlet is not accepting orders right now' });
    }

    const { orderType, tableNumber, notes, items, customerName, customerMobile, deliveryName, deliveryMobile, deliveryLat, deliveryLng } = req.body || {};
    if (!['dine', 'takeaway', 'preorder', 'delivery'].includes(orderType)) {
      return res.status(400).json({ error: 'Invalid order type' });
    }
    const paidOnCreate = Boolean(session && req.body?.paid);
    const paymentMethod = String(req.body?.paymentMethod || 'cash').trim().toLowerCase();
    if (paidOnCreate && !['card', 'upi', 'cash', 'online'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const normalizedTableNumber = Number(tableNumber || 0) || null;
    const now = Date.now();

    const actor = session ? `${getActor(req)}:${session.restaurantCode}` : getActor(req);
    const orderId = await createOrder({
      orderType,
      tableNumber: normalizedTableNumber,
      notes: notes || '',
      items,
      status: 'new',
      paid: paidOnCreate ? 1 : 0,
      paymentMethod: paidOnCreate ? paymentMethod : null,
      paidAt: paidOnCreate ? now : null,
      etaMinutes: orderType === 'preorder' ? 25 : 15,
      source: paidOnCreate ? 'manual' : 'direct',
      restaurantId,
      actor,
      customerName: customerName || null,
      customerMobile: customerMobile || null,
      deliveryName: deliveryName || null,
      deliveryMobile: deliveryMobile || null,
      deliveryLat: deliveryLat || null,
      deliveryLng: deliveryLng || null
    });

    const createdOrder = (await getOrders(restaurantId)).find((order) => order.id === orderId);
    await broadcastState(restaurantId);

    // Send WhatsApp notification for order placed
    if (createdOrder?.customerMobile && whatsappService.WHATSAPP_ENABLED) {
      setImmediate(async () => {
        try {
          const shopName = restaurant?.name || 'F3 Drivein';
          await whatsappService.sendOrderPlacedMessage(createdOrder, shopName);
        } catch (error) {
          // Log error but don't fail the order creation
          console.error('Failed to send WhatsApp order placed message:', error.message);
          whatsappService.logWhatsAppEvent('ORDER_PLACED_ASYNC_FAILED', {
            orderId: createdOrder.id,
            error: error.message
          });
        }
      });
    }

    return res.status(201).json({ order: createdOrder });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unable to create order' });
  }
});

app.post('/api/orders/:id/status', requireManagementAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  const status = String(req.body?.status || '').trim();
  if (!['new', 'preparing', 'ready', 'delivered'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const actor = `${getActor(req)}:${req.management.restaurantCode}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, order_type AS "orderType", table_number AS "tableNumber", status
       FROM orders
       WHERE id = $1 AND restaurant_id = $2
       FOR UPDATE`,
      [orderId, req.management.restaurantId]
    );
    const order = result.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    await client.query(
      'UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3 AND restaurant_id = $4',
      [status, Date.now(), orderId, req.management.restaurantId]
    );

    if ((order.orderType === 'dine' || order.orderType === 'preorder') && order.tableNumber) {
      let nextTableStatus = null;
      if (status === 'new') nextTableStatus = 'ordering';
      if (status === 'preparing' || status === 'ready') nextTableStatus = 'occupied';
      if (status === 'delivered') nextTableStatus = 'free';
      if (nextTableStatus) {
        await client.query(
          'UPDATE table_status SET status = $1 WHERE restaurant_id = $2 AND table_number = $3',
          [nextTableStatus, req.management.restaurantId, Number(order.tableNumber)]
        );
      }
    }

    await logAudit(client, {
      action: 'order_status_changed',
      entityType: 'order',
      entityId: orderId,
      actor,
      restaurantId: req.management.restaurantId,
      details: { from: order.status, to: status, orderType: order.orderType, tableNumber: order.tableNumber }
    });

    await client.query('COMMIT');
    await broadcastState(req.management.restaurantId);

    // Send WhatsApp notification when order is ready
    if (status === 'ready' && whatsappService.WHATSAPP_ENABLED) {
      setImmediate(async () => {
        try {
          const updatedOrder = await getOrderById(orderId);
          if (updatedOrder?.customerMobile) {
            const restaurant = await getRestaurantById(req.management.restaurantId);
            const shopName = restaurant?.name || 'F3 Drivein';
            await whatsappService.sendOrderReadyMessage(updatedOrder, shopName);
          }
        } catch (error) {
          // Log error but don't fail the status update
          console.error('Failed to send WhatsApp order ready message:', error.message);
          whatsappService.logWhatsAppEvent('ORDER_READY_ASYNC_FAILED', {
            orderId,
            error: error.message
          });
        }
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: error.message || 'Unable to update order status' });
  } finally {
    client.release();
  }
});

app.get('/api/payments/razorpay/config', (_req, res) => {
  return res.json({ enabled: RAZORPAY_ENABLED, keyId: RAZORPAY_ENABLED ? RAZORPAY_KEY_ID : null });
});

app.post('/api/orders/:id/razorpay-order', async (req, res) => {
  try {
    if (!RAZORPAY_ENABLED || !razorpay) return res.status(400).json({ error: 'Razorpay is not configured' });

    const orderId = Number(req.params.id);
    const actor = getActor(req);
    const session = getManagementSession(req);
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (Number(order.paid) === 1) return res.status(400).json({ error: 'Order is already paid' });

    // Access control: management sessions can operate on their restaurant; public callers must prove ownership via customerMobile
    if (session) {
      if (Number(session.restaurantId) !== Number(order.restaurantId)) return res.status(403).json({ error: 'Not allowed' });
    } else {
      const customerMobile = String(req.body?.customerMobile || req.query?.customerMobile || '').trim();
      if (!order.customerMobile || !customerMobile || String(order.customerMobile) !== customerMobile) {
        return res.status(403).json({ error: 'Payment can only be initiated by the order owner' });
      }
    }

    const amountPaise = Math.round(Number(order.total || 0) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ error: 'Invalid order amount' });
    }

    const gatewayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `order_${order.id}_${Date.now()}`,
      notes: {
        appOrderId: String(order.id),
        appOrderLabel: String(order.label || '')
      }
    });

    await pool.query(
      'UPDATE orders SET payment_gateway_order_id = $1, updated_at = $2 WHERE id = $3',
      [gatewayOrder.id, Date.now(), order.id]
    );
    await logAudit(pool, {
      action: 'payment_gateway_order_created',
      entityType: 'order',
      entityId: order.id,
      actor,
      restaurantId: order.restaurantId,
      details: { gateway: 'razorpay', gatewayOrderId: gatewayOrder.id, amountPaise }
    });

    await broadcastState(order.restaurantId);
    return res.json({
      keyId: RAZORPAY_KEY_ID,
      gatewayOrderId: gatewayOrder.id,
      amountPaise,
      currency: 'INR',
      appOrder: (await getOrders(order.restaurantId)).find((entry) => entry.id === order.id)
    });
  } catch (error) {
    const message = getGatewayErrorMessage(error, 'Unable to create Razorpay order');
    console.error('Razorpay order creation failed:', message);
    return res.status(400).json({ error: message });
  }
});

app.post('/api/orders/:id/razorpay/verify', async (req, res) => {
  try {
    if (!RAZORPAY_ENABLED || !razorpay) return res.status(400).json({ error: 'Razorpay is not configured' });

    const orderId = Number(req.params.id);
    const actor = getActor(req);
    const session = getManagementSession(req);
    const razorpayOrderId = String(req.body?.razorpayOrderId || '').trim();
    const razorpayPaymentId = String(req.body?.razorpayPaymentId || '').trim();
    const razorpaySignature = String(req.body?.razorpaySignature || '').trim();
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing Razorpay verification fields' });
    }

    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (Number(order.paid) === 1) return res.status(400).json({ error: 'Order is already paid' });
    if (order.paymentGatewayOrderId && order.paymentGatewayOrderId !== razorpayOrderId) {
      return res.status(400).json({ error: 'Gateway order mismatch' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ error: 'Invalid Razorpay signature' });
    }

    const payment = await razorpay.payments.fetch(razorpayPaymentId);
    const expectedAmountPaise = Math.round(Number(order.total || 0) * 100);
    if (Number(payment.amount || 0) !== expectedAmountPaise) {
      return res.status(400).json({ error: 'Razorpay amount mismatch' });
    }
    if (String(payment.order_id || '') !== razorpayOrderId) {
      return res.status(400).json({ error: 'Razorpay order reference mismatch' });
    }
    if (!['captured', 'authorized'].includes(String(payment.status || '').toLowerCase())) {
      return res.status(400).json({ error: 'Payment not completed yet' });
    }

    const updatedOrder = await markOrderPaid({
      orderId,
      actor,
      paymentMethod: String(payment.method || req.body?.paymentMethod || 'online').trim().toLowerCase(),
      paymentGatewayOrderId: razorpayOrderId,
      paymentGatewayPaymentId: razorpayPaymentId
    });
    await broadcastState(updatedOrder?.restaurantId || null);
    return res.json({ ok: true, order: updatedOrder });
  } catch (error) {
    const message = getGatewayErrorMessage(error, 'Razorpay verification failed');
    console.error('Razorpay verification failed:', message);
    return res.status(400).json({ error: message });
  }
});

app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!RAZORPAY_ENABLED || !RAZORPAY_WEBHOOK_SECRET) {
      return res.status(400).json({ error: 'Razorpay webhook is not configured' });
    }

    const signature = String(req.headers['x-razorpay-signature'] || '').trim();
    if (!signature) return res.status(400).json({ error: 'Missing webhook signature' });

    const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(bodyBuffer).digest('hex');
    if (expected !== signature) return res.status(400).json({ error: 'Invalid webhook signature' });

    const payload = JSON.parse(bodyBuffer.toString('utf8') || '{}');
    if (String(payload?.event || '').trim() !== 'payment.captured') return res.json({ ok: true, ignored: true });

    const paymentEntity = payload?.payload?.payment?.entity;
    const orderEntity = payload?.payload?.order?.entity;
    const appOrderId = Number(orderEntity?.notes?.appOrderId || 0);
    if (!appOrderId) return res.json({ ok: true, ignored: true });

    const existing = await getOrderById(appOrderId);
    if (!existing || Number(existing.paid) === 1) return res.json({ ok: true, ignored: true });

    const updatedOrder = await markOrderPaid({
      orderId: appOrderId,
      actor: 'razorpay-webhook',
      paymentMethod: String(paymentEntity?.method || 'online').toLowerCase(),
      paymentGatewayOrderId: String(paymentEntity?.order_id || orderEntity?.id || ''),
      paymentGatewayPaymentId: String(paymentEntity?.id || '')
    });
    await broadcastState(updatedOrder?.restaurantId || null);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Webhook processing failed' });
  }
});

app.post('/api/orders/:id/pay', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const actor = getActor(req);
    const paymentMethod = String(req.body?.paymentMethod || 'card').trim().toLowerCase();
    if (!['card', 'upi', 'cash', 'online'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const session = getManagementSession(req);
    const fullOrder = await getOrderById(orderId);
    if (!fullOrder) return res.status(404).json({ error: 'Order details not found' });
    if (Number(fullOrder.paid) === 1) return res.status(400).json({ error: 'Order is already paid' });

    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid payment amount' });
    if (Math.round(amount) !== Math.round(fullOrder.total)) {
      return res.status(400).json({ error: `Payment amount mismatch. Expected ${fullOrder.total}` });
    }

    // Access control: only management session for the same restaurant or the order owner (by mobile) can pay
    if (session) {
      if (Number(session.restaurantId) !== Number(fullOrder.restaurantId)) return res.status(403).json({ error: 'Not allowed' });
    } else {
      const customerMobile = String(req.body?.customerMobile || '').trim();
      if (!fullOrder.customerMobile || !customerMobile || String(fullOrder.customerMobile) !== customerMobile) {
        return res.status(403).json({ error: 'Only the order owner can pay this order' });
      }
    }

    const updatedOrder = await markOrderPaid({ orderId, actor, paymentMethod });
    await broadcastState(updatedOrder?.restaurantId || null);
    return res.json({ ok: true, order: updatedOrder });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unable to capture payment' });
  }
});

app.post('/api/tables/:tableNumber/toggle', requireManagementAuth, async (req, res) => {
  const tableNumber = Number(req.params.tableNumber);
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;
  const tableResult = await pool.query(
    'SELECT status FROM table_status WHERE restaurant_id = $1 AND table_number = $2',
    [req.management.restaurantId, tableNumber]
  );
  const table = tableResult.rows[0];
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const cycle = { free: 'ordering', ordering: 'occupied', occupied: 'free' };
  const next = cycle[table.status];
  if (next === 'free') {
    const active = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM orders
       WHERE restaurant_id = $1 AND order_type IN ('dine', 'preorder') AND table_number = $2 AND status != 'delivered'`,
      [req.management.restaurantId, tableNumber]
    );
    if (Number(active.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Table can be set to free only after all dine/pre-order orders are delivered' });
    }
  }

  await pool.query(
    'UPDATE table_status SET status = $1 WHERE restaurant_id = $2 AND table_number = $3',
    [next, req.management.restaurantId, tableNumber]
  );
  await logAudit(pool, {
    action: 'table_status_toggled',
    entityType: 'table',
    entityId: tableNumber,
    actor,
    restaurantId: req.management.restaurantId,
    details: { from: table.status, to: next }
  });
  await broadcastState(req.management.restaurantId);
  return res.json({ status: next });
});

app.post('/api/tables/:tableNumber/status', requireManagementAuth, async (req, res) => {
  const tableNumber = Number(req.params.tableNumber);
  const status = String(req.body?.status || '').trim();
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;
  if (!['free', 'ordering', 'occupied'].includes(status)) {
    return res.status(400).json({ error: 'Invalid table status' });
  }

  const tableResult = await pool.query(
    'SELECT status FROM table_status WHERE restaurant_id = $1 AND table_number = $2',
    [req.management.restaurantId, tableNumber]
  );
  const table = tableResult.rows[0];
  if (!table) return res.status(404).json({ error: 'Table not found' });
  if (table.status === status) return res.json({ status });

  if (status === 'free') {
    const active = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM orders
       WHERE restaurant_id = $1 AND order_type IN ('dine', 'preorder') AND table_number = $2 AND status != 'delivered'`,
      [req.management.restaurantId, tableNumber]
    );
    if (Number(active.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Table can be set to free only after all dine/pre-order orders are delivered' });
    }
  }

  await pool.query(
    'UPDATE table_status SET status = $1 WHERE restaurant_id = $2 AND table_number = $3',
    [status, req.management.restaurantId, tableNumber]
  );
  await logAudit(pool, {
    action: 'table_status_set',
    entityType: 'table',
    entityId: tableNumber,
    actor,
    restaurantId: req.management.restaurantId,
    details: { from: table.status, to: status }
  });
  await broadcastState(req.management.restaurantId);
  return res.json({ status });
});

app.post('/api/tables', requireManagementAuth, async (req, res) => {
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;
  const requested = Number(req.body?.tableNumber || 0);
  const maxResult = await pool.query(
    'SELECT COALESCE(MAX(table_number), 0) AS "maxTable" FROM table_status WHERE restaurant_id = $1',
    [req.management.restaurantId]
  );
  const nextTableNumber = requested > 0 ? requested : (Number(maxResult.rows[0].maxTable) + 1);

  const exists = await pool.query(
    'SELECT table_number FROM table_status WHERE restaurant_id = $1 AND table_number = $2',
    [req.management.restaurantId, nextTableNumber]
  );
  if (exists.rows.length) return res.status(400).json({ error: 'Table already exists' });

  await pool.query(
    'INSERT INTO table_status (restaurant_id, table_number, status) VALUES ($1, $2, $3)',
    [req.management.restaurantId, nextTableNumber, 'free']
  );
  await logAudit(pool, {
    action: 'table_added',
    entityType: 'table',
    entityId: nextTableNumber,
    actor,
    restaurantId: req.management.restaurantId,
    details: { status: 'free' }
  });
  await broadcastState(req.management.restaurantId);
  return res.status(201).json({ tableNumber: nextTableNumber, status: 'free' });
});

app.delete('/api/tables/:tableNumber', requireManagementAuth, async (req, res) => {
  const tableNumber = Number(req.params.tableNumber);
  const actor = `${getActor(req)}:${req.management.restaurantCode}`;
  const tableResult = await pool.query(
    'SELECT status FROM table_status WHERE restaurant_id = $1 AND table_number = $2',
    [req.management.restaurantId, tableNumber]
  );
  const table = tableResult.rows[0];
  if (!table) return res.status(404).json({ error: 'Table not found' });
  if (table.status !== 'free') return res.status(400).json({ error: 'Only free tables can be removed' });

  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM table_status WHERE restaurant_id = $1',
    [req.management.restaurantId]
  );
  if (Number(countResult.rows[0].count) <= 1) {
    return res.status(400).json({ error: 'At least one table must remain' });
  }

  const active = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM orders
     WHERE restaurant_id = $1 AND order_type IN ('dine', 'preorder') AND table_number = $2 AND status != 'delivered'`,
    [req.management.restaurantId, tableNumber]
  );
  if (Number(active.rows[0].count) > 0) {
    return res.status(400).json({ error: 'Table has active dine-in orders' });
  }

  await pool.query(
    'DELETE FROM table_status WHERE restaurant_id = $1 AND table_number = $2',
    [req.management.restaurantId, tableNumber]
  );
  await logAudit(pool, {
    action: 'table_removed',
    entityType: 'table',
    entityId: tableNumber,
    actor,
    restaurantId: req.management.restaurantId,
    details: { previousStatus: table.status }
  });
  await broadcastState(req.management.restaurantId);
  return res.json({ ok: true });
});

io.on('connection', async (socket) => {
  try {
    const restaurant = await resolveRestaurantByCode('gandikotadosa', 'Gandikota');
    socket.emit('state:update', await getState(restaurant.id));
  } catch (_error) {
  }
});

// ════════════════════════════════════════════════════════════════════════════════════
// WhatsApp Business API Integration Endpoints
// ════════════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/whatsapp/status
 * Check WhatsApp Business API configuration status
 */
app.get('/api/whatsapp/status', (_req, res) => {
  try {
    const status = whatsappService.getWhatsAppStatus();
    return res.json({
      configured: status.enabled,
      enabled: status.enabled,
      message: status.enabled ? 'WhatsApp integration is active' : 'WhatsApp integration is not configured'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/whatsapp/test
 * Send a test WhatsApp message to verify configuration
 * 
 * Body: { phoneNumber: string (e.g., "919010002233") }
 * 
 * Management authentication required for security
 */
app.post('/api/whatsapp/test', requireManagementAuth, async (req, res) => {
  try {
    const phoneNumber = String(req.body?.phoneNumber || req.query?.phoneNumber || '').trim();
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!whatsappService.WHATSAPP_ENABLED) {
      return res.status(400).json({ error: 'WhatsApp is not configured. Check WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID environment variables.' });
    }

    const response = await whatsappService.sendTestMessage(phoneNumber);
    return res.json({
      success: true,
      message: 'Test message sent successfully',
      messageId: response.messages?.[0]?.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('WhatsApp test message error:', error);
    return res.status(400).json({
      error: error.message || 'Failed to send test message',
      details: error.apiResponse || null
    });
  }
});

/**
 * GET /api/whatsapp/webhook
 * WhatsApp Cloud API webhook verification (GET request during setup)
 * 
 * Query params:
 * - hub.mode: 'subscribe'
 * - hub.challenge: random token
 * - hub.verify_token: must match WHATSAPP_VERIFY_TOKEN
 */
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const webhookToken = String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim();

  if (!webhookToken) {
    console.warn('⚠️  WHATSAPP_VERIFY_TOKEN not set. Webhook verification will fail.');
    return res.status(403).json({ error: 'Webhook verification token not configured' });
  }

  if (mode === 'subscribe' && token === webhookToken) {
    console.log('✅ WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ error: 'Webhook verification failed' });
});

/**
 * POST /api/whatsapp/webhook
 * WhatsApp Cloud API webhook for incoming messages
 * (Currently not processing incoming messages - only for future expansion)
 */
app.post('/api/whatsapp/webhook', (req, res) => {
  // For now, we only send messages, don't receive them
  // This endpoint is required by WhatsApp but we acknowledge all messages
  const entry = req.body?.entry?.[0];
  const changes = entry?.changes?.[0];

  if (!changes) {
    return res.status(200).json({ received: true });
  }

  // Log the event (optional)
  if (process.env.NODE_ENV !== 'production') {
    console.log('📱 WhatsApp Webhook Event:', JSON.stringify(changes.value, null, 2));
  }

  // Always return 200 to acknowledge receipt
  return res.status(200).json({ received: true });
});

app.use((error, _req, res, _next) => {
  return res.status(500).json({ error: error.message || 'Internal server error' });
});

async function start() {
  await initDatabase();
  whatsappService.validateWhatsAppConfig();
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Startup failed:', buildStartupError(error));
  process.exit(1);
});
