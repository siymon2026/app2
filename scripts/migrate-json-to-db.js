/*
  JSON -> PostgreSQL migration (Prisma)
  الهدف: نقل البيانات الحالية من data/*.json إلى PostgreSQL بشكل تدريجي.

  الاستخدام:
    1) ضع DATABASE_URL في .env
    2) npm install
    3) npx prisma db push
    4) node scripts/migrate-json-to-db.js

  ملاحظة: هذا سكريبت best-effort. لا يحذف أي شيء من JSON.
*/

const fs = require('fs');
const path = require('path');
require('dotenv').config();

let PrismaClient;
try {
  ({ PrismaClient } = require('@prisma/client'));
} catch (e) {
  console.error('Missing @prisma/client. Run: npm install');
  process.exit(1);
}

const prisma = new PrismaClient();

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function asText(v) {
  if (!v) return { ar: '', en: '', fr: '' };
  if (typeof v === 'string') return { ar: v, en: v, fr: v };
  return {
    ar: String(v.ar || v.AR || ''),
    en: String(v.en || v.EN || v.ar || ''),
    fr: String(v.fr || v.FR || v.en || v.ar || ''),
  };
}

async function upsertRestaurant(r) {
  const name = asText(r.name);
  await prisma.restaurant.upsert({
    where: { id: String(r.id) },
    update: {
      nameAr: name.ar || 'Restaurant',
      nameEn: name.en || name.ar || 'Restaurant',
      nameFr: name.fr || name.en || name.ar || 'Restaurant',
      phone: r.phone ? String(r.phone) : null,
      address: r.address ? String(r.address) : null,
      isActive: r.isActive !== false,
      ownerId: r.ownerId ? String(r.ownerId) : null,
      subscriptionPlan: String(r.subscriptionPlan || 'Basic'),
      subscriptionStatus: String(r.subscriptionStatus || 'active'),
      subscriptionRenewsAt: r.subscriptionRenewsAt ? new Date(String(r.subscriptionRenewsAt)) : null,
      subscriptionProvider: r.subscriptionProvider ? String(r.subscriptionProvider) : null,
      subscriptionMeta: r.subscriptionMeta && typeof r.subscriptionMeta === 'object' ? r.subscriptionMeta : {},
      loginEmail: r.loginEmail ? String(r.loginEmail) : null,
      loginPhone: r.loginPhone ? String(r.loginPhone) : null,
      passwordHash: r.password ? String(r.password) : null,
    },
    create: {
      id: String(r.id),
      nameAr: name.ar || 'Restaurant',
      nameEn: name.en || name.ar || 'Restaurant',
      nameFr: name.fr || name.en || name.ar || 'Restaurant',
      phone: r.phone ? String(r.phone) : null,
      address: r.address ? String(r.address) : null,
      isActive: r.isActive !== false,
      ownerId: r.ownerId ? String(r.ownerId) : null,
      subscriptionPlan: String(r.subscriptionPlan || 'Basic'),
      subscriptionStatus: String(r.subscriptionStatus || 'active'),
      subscriptionRenewsAt: r.subscriptionRenewsAt ? new Date(String(r.subscriptionRenewsAt)) : null,
      subscriptionProvider: r.subscriptionProvider ? String(r.subscriptionProvider) : null,
      subscriptionMeta: r.subscriptionMeta && typeof r.subscriptionMeta === 'object' ? r.subscriptionMeta : {},
      loginEmail: r.loginEmail ? String(r.loginEmail) : null,
      loginPhone: r.loginPhone ? String(r.loginPhone) : null,
      passwordHash: r.password ? String(r.password) : null,
      createdAt: r.createdAt ? new Date(String(r.createdAt)) : new Date(),
    },
  });
}

async function run() {
  console.log('Starting migration...');

  // Restaurants
  const restaurants = readJson(path.join(DATA_DIR, 'restaurants.json'), { restaurants: [] }).restaurants || [];
  for (const r of restaurants) {
    await upsertRestaurant(r);
  }
  console.log(`Restaurants: ${restaurants.length}`);

  // Restaurant users
  const rusers = readJson(path.join(DATA_DIR, 'restaurant_users.json'), { users: [] }).users || [];
  for (const u of rusers) {
    await prisma.restaurantUser.upsert({
      where: { id: String(u.id) },
      update: {
        restaurantId: String(u.restaurantId),
        email: u.email ? String(u.email) : null,
        phone: u.phone ? String(u.phone) : null,
        role: String(u.role || 'owner'),
        isActive: u.isActive !== false,
        passwordHash: String(u.password || ''),
      },
      create: {
        id: String(u.id),
        restaurantId: String(u.restaurantId),
        email: u.email ? String(u.email) : null,
        phone: u.phone ? String(u.phone) : null,
        role: String(u.role || 'owner'),
        isActive: u.isActive !== false,
        passwordHash: String(u.password || ''),
        createdAt: u.createdAt ? new Date(String(u.createdAt)) : new Date(),
      },
    });
  }
  console.log(`Restaurant users: ${rusers.length}`);

  // Admins
  const admins = readJson(path.join(DATA_DIR, 'admins.json'), { admins: [] }).admins || [];
  for (const a of admins) {
    if (!a.email) continue;
    await prisma.admin.upsert({
      where: { email: String(a.email) },
      update: {
        phone: a.phone ? String(a.phone) : null,
        passwordHash: typeof a.password === 'string' ? a.password : JSON.stringify(a.password || {}),
      },
      create: {
        id: String(a.id || a.email),
        email: String(a.email),
        phone: a.phone ? String(a.phone) : null,
        passwordHash: typeof a.password === 'string' ? a.password : JSON.stringify(a.password || {}),
        role: 'super_admin',
        createdAt: a.createdAt ? new Date(String(a.createdAt)) : new Date(),
      },
    });
  }
  console.log(`Admins: ${admins.length}`);

  // Customers
  const customers = readJson(path.join(DATA_DIR, 'customers.json'), { customers: [] }).customers || [];
  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: String(c.id) },
      update: {
        firstName: String(c.firstName || ''),
        lastName: String(c.lastName || ''),
        email: c.email ? String(c.email) : null,
        phone: c.phone ? String(c.phone) : null,
        passwordHash: typeof c.password === 'string' ? c.password : JSON.stringify(c.password || {}),
      },
      create: {
        id: String(c.id),
        firstName: String(c.firstName || ''),
        lastName: String(c.lastName || ''),
        email: c.email ? String(c.email) : null,
        phone: c.phone ? String(c.phone) : null,
        passwordHash: typeof c.password === 'string' ? c.password : JSON.stringify(c.password || {}),
        createdAt: c.createdAt ? new Date(String(c.createdAt)) : new Date(),
      },
    });
  }
  console.log(`Customers: ${customers.length}`);

  // Drivers
  const drivers = readJson(path.join(DATA_DIR, 'drivers.json'), { drivers: [] }).drivers || [];
  for (const d of drivers) {
    await prisma.driver.upsert({
      where: { id: String(d.id) },
      update: {
        email: d.email ? String(d.email) : null,
        phone: d.phone ? String(d.phone) : null,
        name: String(d.name || ''),
        cardNumber: d.cardNumber ? String(d.cardNumber) : null,
        passwordHash: typeof d.password === 'string' ? d.password : JSON.stringify(d.password || {}),
        status: String(d.status || 'pending'),
        walletBalance: Number(d.walletBalance || 0),
        walletHistory: d.walletHistory && typeof d.walletHistory === 'object' ? d.walletHistory : [],
        restaurantId: d.restaurantId ? String(d.restaurantId) : null,
      },
      create: {
        id: String(d.id),
        email: d.email ? String(d.email) : null,
        phone: d.phone ? String(d.phone) : null,
        name: String(d.name || ''),
        cardNumber: d.cardNumber ? String(d.cardNumber) : null,
        passwordHash: typeof d.password === 'string' ? d.password : JSON.stringify(d.password || {}),
        status: String(d.status || 'pending'),
        walletBalance: Number(d.walletBalance || 0),
        walletHistory: d.walletHistory && typeof d.walletHistory === 'object' ? d.walletHistory : [],
        restaurantId: d.restaurantId ? String(d.restaurantId) : null,
        createdAt: d.createdAt ? new Date(String(d.createdAt)) : new Date(),
      },
    });
  }
  console.log(`Drivers: ${drivers.length}`);

  // Menu
  const menu = readJson(path.join(DATA_DIR, 'menu.json'), { items: [] }).items || [];
  for (const it of menu) {
    if (!it.restaurantId) continue;
    await prisma.menuItem.upsert({
      where: { id: String(it.id) },
      update: {
        restaurantId: String(it.restaurantId),
        cat: it.cat ? String(it.cat) : null,
        catLabel: it.catLabel && typeof it.catLabel === 'object' ? it.catLabel : null,
        name: it.name && typeof it.name === 'object' ? it.name : null,
        desc: it.desc && typeof it.desc === 'object' ? it.desc : null,
        img: it.img ? String(it.img) : null,
        price: Number(it.price || 0),
        isAvailable: it.isAvailable !== false,
      },
      create: {
        id: String(it.id),
        restaurantId: String(it.restaurantId),
        cat: it.cat ? String(it.cat) : null,
        catLabel: it.catLabel && typeof it.catLabel === 'object' ? it.catLabel : null,
        name: it.name && typeof it.name === 'object' ? it.name : null,
        desc: it.desc && typeof it.desc === 'object' ? it.desc : null,
        img: it.img ? String(it.img) : null,
        price: Number(it.price || 0),
        isAvailable: it.isAvailable !== false,
        createdAt: it.createdAt ? new Date(String(it.createdAt)) : new Date(),
      },
    });
  }
  console.log(`Menu items: ${menu.length}`);

  // Orders (+ items)
  const orders = readJson(path.join(DATA_DIR, 'orders.json'), { orders: [] }).orders || [];
  for (const o of orders) {
    if (!o.restaurantId) continue;
    await prisma.order.upsert({
      where: { id: String(o.id) },
      update: {
        restaurantId: String(o.restaurantId),
        customerId: o.customerId ? String(o.customerId) : null,
        driverId: o.driverId ? String(o.driverId) : null,
        status: String(o.status || 'new'),
        currency: o.currency ? String(o.currency) : null,
        subtotal: Number(o.subtotal || 0),
        deliveryFee: Number(o.deliveryFee || 0),
        total: Number(o.total || 0),
        customerName: o.customer?.name ? String(o.customer.name) : null,
        customerPhone: o.customer?.phone ? String(o.customer.phone) : null,
        customerAddr: o.customer?.addr ? String(o.customer.addr) : null,
        customerNotes: o.customer?.notes ? String(o.customer.notes) : null,
        createdAt: o.createdAt ? new Date(String(o.createdAt)) : new Date(),
      },
      create: {
        id: String(o.id),
        restaurantId: String(o.restaurantId),
        customerId: o.customerId ? String(o.customerId) : null,
        driverId: o.driverId ? String(o.driverId) : null,
        status: String(o.status || 'new'),
        currency: o.currency ? String(o.currency) : null,
        subtotal: Number(o.subtotal || 0),
        deliveryFee: Number(o.deliveryFee || 0),
        total: Number(o.total || 0),
        customerName: o.customer?.name ? String(o.customer.name) : null,
        customerPhone: o.customer?.phone ? String(o.customer.phone) : null,
        customerAddr: o.customer?.addr ? String(o.customer.addr) : null,
        customerNotes: o.customer?.notes ? String(o.customer.notes) : null,
        createdAt: o.createdAt ? new Date(String(o.createdAt)) : new Date(),
      },
    });

    // Replace items (simple strategy)
    await prisma.orderItem.deleteMany({ where: { orderId: String(o.id) } });
    const items = Array.isArray(o.items) ? o.items : [];
    if (items.length) {
      await prisma.orderItem.createMany({
        data: items
          .filter((it) => it && (it.name || it.id))
          .map((it) => ({
            orderId: String(o.id),
            itemId: it.id ? String(it.id) : null,
            name: String(it.name || it.id),
            qty: Math.max(0, Number(it.qty || 0) | 0),
            price: Number(it.price || 0),
          })),
      });
    }
  }
  console.log(`Orders: ${orders.length}`);

  // Refresh tokens + audit logs (optional)
  const rt = readJson(path.join(DATA_DIR, 'refresh_tokens.json'), { tokens: [] }).tokens || [];
  for (const t of rt) {
    if (!t.tokenHash) continue;
    await prisma.refreshToken.upsert({
      where: { tokenHash: String(t.tokenHash) },
      update: {
        userType: String(t.userType || ''),
        userId: String(t.userId || ''),
        role: String(t.role || ''),
        restaurantId: t.restaurantId ? String(t.restaurantId) : null,
        expiresAt: t.expiresAt ? new Date(String(t.expiresAt)) : new Date(Date.now() + 7 * 864e5),
        revokedAt: t.revokedAt ? new Date(String(t.revokedAt)) : null,
        replacedBy: t.replacedBy ? String(t.replacedBy) : null,
        meta: t.meta && typeof t.meta === 'object' ? t.meta : {},
      },
      create: {
        id: String(t.id || t.tokenHash),
        tokenHash: String(t.tokenHash),
        userType: String(t.userType || ''),
        userId: String(t.userId || ''),
        role: String(t.role || ''),
        restaurantId: t.restaurantId ? String(t.restaurantId) : null,
        createdAt: t.createdAt ? new Date(String(t.createdAt)) : new Date(),
        expiresAt: t.expiresAt ? new Date(String(t.expiresAt)) : new Date(Date.now() + 7 * 864e5),
        revokedAt: t.revokedAt ? new Date(String(t.revokedAt)) : null,
        replacedBy: t.replacedBy ? String(t.replacedBy) : null,
        meta: t.meta && typeof t.meta === 'object' ? t.meta : {},
      },
    });
  }
  console.log(`Refresh tokens: ${rt.length}`);

  const logs = readJson(path.join(DATA_DIR, 'audit_logs.json'), { logs: [] }).logs || [];
  for (const l of logs) {
    if (!l.id) continue;
    await prisma.auditLog.upsert({
      where: { id: String(l.id) },
      update: {
        at: l.at ? new Date(String(l.at)) : new Date(),
        actorType: String(l.actorType || ''),
        actorId: l.actorId ? String(l.actorId) : null,
        restaurantId: l.restaurantId ? String(l.restaurantId) : null,
        method: String(l.method || ''),
        path: String(l.path || ''),
        status: Number(l.status || 0) | 0,
        ms: Number(l.ms || 0) | 0,
        ip: l.ip ? String(l.ip) : null,
        ua: l.ua ? String(l.ua) : null,
        bodyKeys: Array.isArray(l.bodyKeys) ? l.bodyKeys : null,
      },
      create: {
        id: String(l.id),
        at: l.at ? new Date(String(l.at)) : new Date(),
        actorType: String(l.actorType || ''),
        actorId: l.actorId ? String(l.actorId) : null,
        restaurantId: l.restaurantId ? String(l.restaurantId) : null,
        method: String(l.method || ''),
        path: String(l.path || ''),
        status: Number(l.status || 0) | 0,
        ms: Number(l.ms || 0) | 0,
        ip: l.ip ? String(l.ip) : null,
        ua: l.ua ? String(l.ua) : null,
        bodyKeys: Array.isArray(l.bodyKeys) ? l.bodyKeys : null,
      },
    });
  }
  console.log(`Audit logs: ${logs.length}`);

  console.log('Migration complete.');
}

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
