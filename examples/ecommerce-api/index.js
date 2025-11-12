const { Spark, Router } = require('../../src');
const crypto = require('crypto');

// SECURITY FIX: Generate random session secret if not provided (demo only)
// 🔴 CRITICAL: In production, ALWAYS set SESSION_SECRET environment variable!
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === 'production') {
    // In production, REQUIRE the secret to be set
    console.error('🔴 CRITICAL ERROR: SESSION_SECRET environment variable must be set in production!');
    console.error('Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  } else {
    // In development, generate a random secret with warning
    sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️  WARNING: Using randomly generated session secret for development.');
    console.warn('⚠️  Set SESSION_SECRET environment variable for persistent sessions.');
    console.warn(`⚠️  Generated secret (save this if you want persistent sessions):\n    ${sessionSecret}`);
  }
}

// Create application
const app = new Spark({
  port: process.env.PORT || 3000,
  security: {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
      credentials: true
    },
    csrf: true,
    rateLimit: {
      max: 100,
      windowMs: 60000
    }
  }
});

// Middleware
app.use(require('../../src/middleware/logger')({
  format: ':method :url :status :response-time ms'
}));
app.use(require('../../src/middleware/body-parser')());
app.use(require('../../src/middleware/compression')());
app.use(require('../../src/middleware/session')({
  secret: sessionSecret,  // Use validated/generated secret
  saveUninitialized: true,
  resave: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// In-memory database (for demo purposes)
const db = {
  users: new Map(),
  products: new Map(),
  carts: new Map(),
  orders: new Map(),
  sessions: new Map()
};

// Initialize with sample data
initializeSampleData();

// Authentication middleware
async function requireAuth(ctx, next) {
  if (!ctx.session || !ctx.session.userId) {
    return ctx.status(401).json({ error: 'Authentication required' });
  }
  
  ctx.user = db.users.get(ctx.session.userId);
  if (!ctx.user) {
    return ctx.status(401).json({ error: 'Invalid session' });
  }
  
  await next();
}

// Admin middleware
async function requireAdmin(ctx, next) {
  await requireAuth(ctx, next);
  if (ctx.user && ctx.user.role !== 'admin') {
    return ctx.status(403).json({ error: 'Admin access required' });
  }
}

// Validation middleware
function validate(schema) {
  return async (ctx, next) => {
    const errors = validateSchema(ctx.body, schema);
    if (errors.length > 0) {
      return ctx.status(400).json({ errors });
    }
    await next();
  };
}

// API Routes
const api = new Router();

// Auth routes
api.post('/auth/register', validate({
  email: 'required|email',
  password: 'required|min:8',
  name: 'required|min:2'
}), async (ctx) => {
  const { email, password, name } = ctx.body;
  
  // Check if user exists
  const existingUser = Array.from(db.users.values()).find(u => u.email === email);
  if (existingUser) {
    return ctx.status(409).json({ error: 'Email already registered' });
  }
  
  // Create user
  const userId = generateId();
  const user = {
    id: userId,
    email,
    password: hashPassword(password),
    name,
    role: 'customer',
    createdAt: new Date().toISOString()
  };
  
  db.users.set(userId, user);
  ctx.session.userId = userId;
  
  ctx.status(201).json({
    user: sanitizeUser(user),
    message: 'Registration successful'
  });
});

api.post('/auth/login', validate({
  email: 'required|email',
  password: 'required'
}), async (ctx) => {
  const { email, password } = ctx.body;
  
  const user = Array.from(db.users.values()).find(u => u.email === email);
  if (!user || !verifyPassword(password, user.password)) {
    return ctx.status(401).json({ error: 'Invalid credentials' });
  }
  
  ctx.session.userId = user.id;
  ctx.json({
    user: sanitizeUser(user),
    message: 'Login successful'
  });
});

api.post('/auth/logout', async (ctx) => {
  await ctx.session.destroy();
  ctx.json({ message: 'Logout successful' });
});

api.get('/auth/me', requireAuth, async (ctx) => {
  ctx.json({ user: sanitizeUser(ctx.user) });
});

// Product routes
api.get('/products', async (ctx) => {
  const { category, search, sort = 'name', page = 1, limit = 20 } = ctx.query;
  
  let products = Array.from(db.products.values());
  
  // Filter by category
  if (category) {
    products = products.filter(p => p.category === category);
  }
  
  // Search
  if (search) {
    const searchLower = search.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower)
    );
  }
  
  // Sort
  products.sort((a, b) => {
    switch (sort) {
      case 'price': return a.price - b.price;
      case '-price': return b.price - a.price;
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });
  
  // Paginate
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paginatedProducts = products.slice(offset, offset + parseInt(limit));
  
  ctx.json({
    products: paginatedProducts,
    total: products.length,
    page: parseInt(page),
    pages: Math.ceil(products.length / parseInt(limit))
  });
});

api.get('/products/:id', async (ctx) => {
  const product = db.products.get(ctx.params.id);
  if (!product) {
    return ctx.status(404).json({ error: 'Product not found' });
  }
  
  ctx.json({ product });
});

api.post('/products', requireAdmin, validate({
  name: 'required|min:2',
  description: 'required|min:10',
  price: 'required|number|min:0',
  category: 'required',
  stock: 'required|integer|min:0',
  images: 'array'
}), async (ctx) => {
  const productId = generateId();
  const product = {
    id: productId,
    ...ctx.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.products.set(productId, product);
  ctx.status(201).json({ product });
});

api.put('/products/:id', requireAdmin, async (ctx) => {
  const product = db.products.get(ctx.params.id);
  if (!product) {
    return ctx.status(404).json({ error: 'Product not found' });
  }
  
  const updated = {
    ...product,
    ...ctx.body,
    id: product.id,
    createdAt: product.createdAt,
    updatedAt: new Date().toISOString()
  };
  
  db.products.set(product.id, updated);
  ctx.json({ product: updated });
});

api.delete('/products/:id', requireAdmin, async (ctx) => {
  if (!db.products.has(ctx.params.id)) {
    return ctx.status(404).json({ error: 'Product not found' });
  }
  
  db.products.delete(ctx.params.id);
  ctx.status(204).end();
});

// Cart routes
api.get('/cart', requireAuth, async (ctx) => {
  const cart = db.carts.get(ctx.user.id) || { items: [] };
  
  // Populate product details
  const items = cart.items.map(item => {
    const product = db.products.get(item.productId);
    return {
      ...item,
      product
    };
  });
  
  const total = items.reduce((sum, item) => 
    sum + (item.product ? item.product.price * item.quantity : 0), 0
  );
  
  ctx.json({
    items,
    total,
    count: items.length
  });
});

api.post('/cart/items', requireAuth, validate({
  productId: 'required',
  quantity: 'required|integer|min:1'
}), async (ctx) => {
  const { productId, quantity } = ctx.body;
  
  const product = db.products.get(productId);
  if (!product) {
    return ctx.status(404).json({ error: 'Product not found' });
  }
  
  if (product.stock < quantity) {
    return ctx.status(400).json({ error: 'Insufficient stock' });
  }
  
  let cart = db.carts.get(ctx.user.id) || { items: [] };
  
  const existingItem = cart.items.find(item => item.productId === productId);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({ productId, quantity });
  }
  
  db.carts.set(ctx.user.id, cart);
  ctx.status(201).json({ message: 'Item added to cart' });
});

api.put('/cart/items/:productId', requireAuth, validate({
  quantity: 'required|integer|min:0'
}), async (ctx) => {
  const { productId } = ctx.params;
  const { quantity } = ctx.body;
  
  let cart = db.carts.get(ctx.user.id);
  if (!cart) {
    return ctx.status(404).json({ error: 'Cart not found' });
  }
  
  const item = cart.items.find(i => i.productId === productId);
  if (!item) {
    return ctx.status(404).json({ error: 'Item not in cart' });
  }
  
  if (quantity === 0) {
    cart.items = cart.items.filter(i => i.productId !== productId);
  } else {
    item.quantity = quantity;
  }
  
  db.carts.set(ctx.user.id, cart);
  ctx.json({ message: 'Cart updated' });
});

api.delete('/cart', requireAuth, async (ctx) => {
  db.carts.delete(ctx.user.id);
  ctx.json({ message: 'Cart cleared' });
});

// Order routes
api.post('/orders', requireAuth, validate({
  shippingAddress: 'required|object',
  paymentMethod: 'required|in:card,paypal,cod'
}), async (ctx) => {
  const cart = db.carts.get(ctx.user.id);
  if (!cart || cart.items.length === 0) {
    return ctx.status(400).json({ error: 'Cart is empty' });
  }
  
  // Validate stock availability
  for (const item of cart.items) {
    const product = db.products.get(item.productId);
    if (!product || product.stock < item.quantity) {
      return ctx.status(400).json({ 
        error: `Insufficient stock for ${product?.name || 'product'}` 
      });
    }
  }
  
  // Create order
  const orderId = generateId();
  const order = {
    id: orderId,
    userId: ctx.user.id,
    items: cart.items.map(item => {
      const product = db.products.get(item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        name: product.name
      };
    }),
    total: cart.items.reduce((sum, item) => {
      const product = db.products.get(item.productId);
      return sum + (product.price * item.quantity);
    }, 0),
    shippingAddress: ctx.body.shippingAddress,
    paymentMethod: ctx.body.paymentMethod,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  // Update product stock
  for (const item of cart.items) {
    const product = db.products.get(item.productId);
    product.stock -= item.quantity;
    db.products.set(item.productId, product);
  }
  
  // Save order and clear cart
  db.orders.set(orderId, order);
  db.carts.delete(ctx.user.id);
  
  ctx.status(201).json({ order });
});

api.get('/orders', requireAuth, async (ctx) => {
  const userOrders = Array.from(db.orders.values())
    .filter(order => order.userId === ctx.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  ctx.json({ orders: userOrders });
});

api.get('/orders/:id', requireAuth, async (ctx) => {
  const order = db.orders.get(ctx.params.id);
  
  if (!order) {
    return ctx.status(404).json({ error: 'Order not found' });
  }
  
  if (order.userId !== ctx.user.id && ctx.user.role !== 'admin') {
    return ctx.status(403).json({ error: 'Access denied' });
  }
  
  ctx.json({ order });
});

// Admin routes
api.get('/admin/stats', requireAdmin, async (ctx) => {
  const stats = {
    users: db.users.size,
    products: db.products.size,
    orders: db.orders.size,
    revenue: Array.from(db.orders.values())
      .reduce((sum, order) => sum + order.total, 0),
    topProducts: getTopProducts(),
    recentOrders: getRecentOrders(5)
  };
  
  ctx.json({ stats });
});

// Root route
app.get('/', async (ctx) => {
  ctx.json({
    message: 'E-commerce API - Complete e-commerce solution with authentication, products, cart, and orders',
    name: 'E-commerce API',
    version: '1.0.0',
    description: 'Complete e-commerce API with authentication, products, cart, and orders',
    endpoints: {
      auth: '/api/auth/*',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      admin: '/api/admin/*'
    }
  });
});

// Mount API routes
app.use('/api', api.routes());

// Error handling
app.on('error', (err) => {
  console.error('Application error:', err);
});

// Helper functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function hashPassword(password) {
  // ⚠️  SECURITY WARNING: This is NOT a secure password hashing method!
  // Base64 is ENCODING, not HASHING - passwords can be trivially decoded.
  // This is for DEMO PURPOSES ONLY to avoid adding external dependencies.
  //
  // 🔴 CRITICAL: NEVER use this in production!
  // Production use requires proper password hashing:
  //   - bcrypt (recommended): npm install bcrypt
  //   - argon2 (also good): npm install argon2
  //   - scrypt (built-in): require('crypto').scrypt
  //
  // Example with bcrypt:
  //   const bcrypt = require('bcrypt');
  //   return await bcrypt.hash(password, 10);
  //
  console.warn('⚠️  WARNING: Using insecure Base64 encoding for passwords! DO NOT use in production!');
  return Buffer.from(password).toString('base64');
}

function verifyPassword(password, hash) {
  // ⚠️  SECURITY WARNING: Insecure verification method - see hashPassword()
  // Production example with bcrypt:
  //   return await bcrypt.compare(password, hash);
  return Buffer.from(password).toString('base64') === hash;
}

function sanitizeUser(user) {
  const { password, ...sanitized } = user;
  return sanitized;
}

function validateSchema(data, schema) {
  const errors = [];
  
  Object.entries(schema).forEach(([field, rules]) => {
    const ruleList = rules.split('|');
    const value = data[field];
    
    ruleList.forEach(rule => {
      const [ruleName, param] = rule.split(':');
      
      switch (ruleName) {
        case 'required':
          if (!value) errors.push(`${field} is required`);
          break;
        case 'email':
          if (value && !value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            errors.push(`${field} must be a valid email`);
          }
          break;
        case 'min':
          if (value && value.length < parseInt(param)) {
            errors.push(`${field} must be at least ${param} characters`);
          }
          break;
        case 'number':
          if (value && isNaN(value)) {
            errors.push(`${field} must be a number`);
          }
          break;
        case 'integer':
          if (value && !Number.isInteger(Number(value))) {
            errors.push(`${field} must be an integer`);
          }
          break;
      }
    });
  });
  
  return errors;
}

function getTopProducts(limit = 5) {
  const productSales = new Map();
  
  Array.from(db.orders.values()).forEach(order => {
    order.items.forEach(item => {
      const current = productSales.get(item.productId) || 0;
      productSales.set(item.productId, current + item.quantity);
    });
  });
  
  return Array.from(productSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId, sales]) => ({
      product: db.products.get(productId),
      sales
    }));
}

function getRecentOrders(limit = 10) {
  return Array.from(db.orders.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function initializeSampleData() {
  // Admin user
  const adminId = 'admin123';
  db.users.set(adminId, {
    id: adminId,
    email: 'admin@example.com',
    password: hashPassword('admin123'),
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date().toISOString()
  });
  
  // Sample products
  const products = [
    {
      id: 'prod1',
      name: 'Laptop Pro 15"',
      description: 'High-performance laptop with 16GB RAM and 512GB SSD',
      price: 1299.99,
      category: 'Electronics',
      stock: 50,
      images: ['/images/laptop1.jpg']
    },
    {
      id: 'prod2',
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with precision tracking',
      price: 29.99,
      category: 'Electronics',
      stock: 200,
      images: ['/images/mouse1.jpg']
    },
    {
      id: 'prod3',
      name: 'Coffee Maker Deluxe',
      description: 'Programmable coffee maker with thermal carafe',
      price: 89.99,
      category: 'Home & Kitchen',
      stock: 75,
      images: ['/images/coffee1.jpg']
    },
    {
      id: 'prod4',
      name: 'Running Shoes',
      description: 'Comfortable running shoes with advanced cushioning',
      price: 119.99,
      category: 'Sports',
      stock: 100,
      images: ['/images/shoes1.jpg']
    },
    {
      id: 'prod5',
      name: 'Smartphone X',
      description: 'Latest smartphone with 5G and triple camera system',
      price: 999.99,
      category: 'Electronics',
      stock: 30,
      images: ['/images/phone1.jpg']
    }
  ];
  
  products.forEach(product => {
    db.products.set(product.id, {
      ...product,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });
}

// Start server
const port = process.env.PORT || 0; // Use dynamic port by default
app.listen(port, () => {
  const actualPort = app.server?.address()?.port || port;
  console.log(`🛍️  E-commerce API running on port ${actualPort}`);
  console.log(`📧 Admin login: admin@example.com / admin123`);
});

module.exports = app;