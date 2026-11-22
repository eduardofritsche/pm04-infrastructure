const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const seedProducts = require('./products');

const PORT = Number(process.env.PORT || 3000);
// MONGO_URL completo, ou as partes separadas (o Ansible usa as partes, assim a
// senha não precisa ser escapada para caber numa URL).
function mongoUrl() {
  if (process.env.MONGO_URL) return process.env.MONGO_URL;
  const host = process.env.MONGO_HOST || 'localhost:27017';
  const dbName = process.env.MONGO_DB || 'kubeshop';
  const user = process.env.MONGO_USER;
  if (!user) return `mongodb://${host}/${dbName}`;
  const pass = encodeURIComponent(process.env.MONGO_PASSWORD || '');
  return `mongodb://${encodeURIComponent(user)}:${pass}@${host}/${dbName}?authSource=${dbName}`;
}
const MONGO_URL = mongoUrl();
const APP_VERSION = process.env.APP_VERSION || 'dev';

const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
let db;

const app = express();
app.use(express.json({ limit: '100kb' }));

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

app.use((req, res, next) => {
  res.on('finish', () => log(req.method, req.originalUrl, res.statusCode));
  next();
});

// Saúde: usado pelo Ansible (role app) e pelo operations.yml (action=health).
app.get('/api/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });
    const [products, orders] = await Promise.all([
      db.collection('products').countDocuments(),
      db.collection('orders').countDocuments()
    ]);
    res.json({ status: 'ok', version: APP_VERSION, database: 'ok', products, orders });
  } catch (err) {
    res.status(503).json({ status: 'error', version: APP_VERSION, database: 'unreachable', error: err.message });
  }
});

app.get('/api/products', async (req, res, next) => {
  try {
    const products = await db.collection('products').find().sort({ sku: 1 }).toArray();
    res.json(products);
  } catch (err) {
    next(err);
  }
});

app.post('/api/orders', async (req, res, next) => {
  try {
    const { customer, items } = req.body || {};
    const name = String(customer?.name || '').trim();
    const email = String(customer?.email || '').trim().toLowerCase();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Informe nome e e-mail válidos.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'A sacola está vazia.' });
    }

    const ids = items.map((i) => {
      try {
        return new ObjectId(String(i.productId));
      } catch {
        return null;
      }
    });
    if (ids.includes(null)) return res.status(400).json({ error: 'Produto inválido.' });

    const products = await db.collection('products').find({ _id: { $in: ids } }).toArray();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const lines = [];
    for (const item of items) {
      const product = byId.get(String(item.productId));
      const quantity = Math.floor(Number(item.quantity));
      if (!product || !(quantity >= 1 && quantity <= 99)) {
        return res.status(400).json({ error: 'Item inválido na sacola.' });
      }
      lines.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        emoji: product.emoji,
        price: product.price,
        quantity,
        subtotal: Math.round(product.price * quantity * 100) / 100
      });
    }
    const total = Math.round(lines.reduce((s, l) => s + l.subtotal, 0) * 100) / 100;

    const order = {
      customer: { name, email },
      items: lines,
      total,
      status: 'Recebido',
      appVersion: APP_VERSION,
      createdAt: new Date()
    };
    const result = await db.collection('orders').insertOne(order);
    log('pedido criado', String(result.insertedId), email, total);
    res.status(201).json({ ...order, _id: result.insertedId });
  } catch (err) {
    next(err);
  }
});

app.get('/api/orders', async (req, res, next) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Informe o e-mail.' });
    const orders = await db.collection('orders').find({ 'customer.email': email }).sort({ createdAt: -1 }).toArray();
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  log('erro', err.stack || err);
  res.status(500).json({ error: 'Erro interno.' });
});

async function connectWithRetry() {
  for (let attempt = 1; ; attempt++) {
    try {
      await client.connect();
      db = client.db();
      await db.command({ ping: 1 });
      log('conectado ao MongoDB');
      return;
    } catch (err) {
      log(`MongoDB indisponível (tentativa ${attempt}): ${err.message}`);
      await new Promise((r) => setTimeout(r, Math.min(attempt, 10) * 1000));
    }
  }
}

async function seed() {
  const products = db.collection('products');
  await products.createIndex({ sku: 1 }, { unique: true });
  await db.collection('orders').createIndex({ 'customer.email': 1, createdAt: -1 });
  for (const p of seedProducts) {
    await products.updateOne({ sku: p.sku }, { $setOnInsert: p }, { upsert: true });
  }
}

async function main() {
  await connectWithRetry();
  await seed();
  const server = app.listen(PORT, () => log(`KubeShop API ${APP_VERSION} ouvindo na porta ${PORT}`));
  const shutdown = () => {
    log('encerrando');
    server.close(() => client.close().finally(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  log('falha ao iniciar', err);
  process.exit(1);
});
