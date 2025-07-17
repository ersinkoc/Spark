const crypto = require('crypto');
const { EventEmitter } = require('events');

const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
// Default secret removed for security - must be provided by user

class MemoryStore extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.timers = new Map();
  }

  async get(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? JSON.parse(session) : null;
  }

  async set(sessionId, session, maxAge) {
    this.sessions.set(sessionId, JSON.stringify(session));
    
    if (this.timers.has(sessionId)) {
      clearTimeout(this.timers.get(sessionId));
    }
    
    const timer = setTimeout(() => {
      this.destroy(sessionId);
    }, maxAge);
    
    this.timers.set(sessionId, timer);
  }

  async destroy(sessionId) {
    this.sessions.delete(sessionId);
    
    if (this.timers.has(sessionId)) {
      clearTimeout(this.timers.get(sessionId));
      this.timers.delete(sessionId);
    }
    
    this.emit('destroy', sessionId);
  }

  async touch(sessionId, session, maxAge) {
    await this.set(sessionId, session, maxAge);
  }

  async all() {
    const sessions = {};
    for (const [sessionId, sessionData] of this.sessions) {
      sessions[sessionId] = JSON.parse(sessionData);
    }
    return sessions;
  }

  async length() {
    return this.sessions.size;
  }

  async clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.sessions.clear();
    this.timers.clear();
  }
}

function session(options = {}) {
  const opts = {
    key: options.key || 'connect.sid',
    secret: options.secret || throwMissingSecretError(),
    store: options.store || new MemoryStore(),
    cookie: {
      path: '/',
      httpOnly: true,
      secure: false,
      maxAge: DEFAULT_MAX_AGE,
      sameSite: 'lax',
      ...options.cookie
    },
    genid: options.genid || generateSessionId,
    rolling: options.rolling || false,
    resave: options.resave || false,
    saveUninitialized: options.saveUninitialized || false,
    ...options
  };

  return async (ctx, next) => {
    const sessionId = getSessionId(ctx, opts);
    let session = null;
    let isNew = false;

    if (sessionId) {
      session = await opts.store.get(sessionId);
    }

    if (!session) {
      session = {};
      isNew = true;
    }

    ctx.session = createSessionProxy(session, {
      sessionId: sessionId || opts.genid(),
      isNew,
      store: opts.store,
      cookie: opts.cookie,
      key: opts.key,
      secret: opts.secret,
      rolling: opts.rolling,
      resave: opts.resave,
      saveUninitialized: opts.saveUninitialized,
      ctx: ctx
    });

    // Store original response methods
    const originalSend = ctx.send;
    const originalJson = ctx.json;
    
    // Track if session needs to be saved
    ctx._sessionSaveNeeded = false;
    ctx._sessionSaved = false;
    
    // Override send methods to save session before response
    ctx.send = function(data) {
      if (!ctx.responded && !ctx._sessionSaved) {
        saveSessionSync(ctx, opts);
        ctx._sessionSaved = true;
      }
      return originalSend.call(ctx, data);
    };

    ctx.json = function(data) {
      if (!ctx.responded && !ctx._sessionSaved) {
        saveSessionSync(ctx, opts);
        ctx._sessionSaved = true;
      }
      return originalJson.call(ctx, data);
    };

    await next();
  };
}

function getSessionId(ctx, opts) {
  const cookieValue = ctx.cookies[opts.key];
  
  if (!cookieValue) {
    return null;
  }

  try {
    return unsignCookie(cookieValue, opts.secret);
  } catch (error) {
    return null;
  }
}

function createSessionProxy(session, options) {
  const proxy = new Proxy(session, {
    set(target, property, value) {
      if (property === 'cookie') {
        return true;
      }
      
      target[property] = value;
      options.modified = true;
      
      // Auto-save session when modified
      if (options.ctx && !options.ctx.responded) {
        const sessionData = {};
        for (const key in session) {
          if (session.hasOwnProperty(key)) {
            sessionData[key] = session[key];
          }
        }
        options.store.set(options.sessionId, sessionData, options.cookie.maxAge);
        const signedId = signCookie(options.sessionId, options.secret);
        options.ctx.setCookie(options.key, signedId, options.cookie);
      }
      
      return true;
    },
    
    deleteProperty(target, property) {
      delete target[property];
      options.modified = true;
      return true;
    }
  });

  Object.defineProperty(proxy, 'id', {
    get() { return options.sessionId; },
    enumerable: false
  });

  Object.defineProperty(proxy, 'isNew', {
    get() { return options.isNew; },
    enumerable: false
  });

  Object.defineProperty(proxy, 'cookie', {
    get() { return options.cookie; },
    set(value) { options.cookie = { ...options.cookie, ...value }; },
    enumerable: false
  });

  Object.defineProperty(proxy, 'destroy', {
    value: async function() {
      await options.store.destroy(options.sessionId);
      options.destroyed = true;
    },
    enumerable: false
  });

  Object.defineProperty(proxy, 'regenerate', {
    value: async function() {
      await options.store.destroy(options.sessionId);
      options.sessionId = options.genid();
      options.isNew = true;
      options.modified = true;
      
      for (const key in session) {
        delete session[key];
      }
    },
    enumerable: false
  });

  Object.defineProperty(proxy, 'reload', {
    value: async function() {
      const data = await options.store.get(options.sessionId);
      if (data) {
        Object.assign(session, data);
      }
    },
    enumerable: false
  });

  Object.defineProperty(proxy, 'save', {
    value: async function() {
      await options.store.set(options.sessionId, session, options.cookie.maxAge);
    },
    enumerable: false
  });

  Object.defineProperty(proxy, 'touch', {
    value: async function() {
      await options.store.touch(options.sessionId, session, options.cookie.maxAge);
    },
    enumerable: false
  });

  return proxy;
}

async function saveSession(ctx, opts) {
  const session = ctx.session;
  
  if (!session) {
    return;
  }

  if (ctx.responded) {
    return;
  }

  if (session.destroyed) {
    ctx.clearCookie(opts.key);
    return;
  }

  const shouldSave = session.modified || 
                     (opts.resave && !session.isNew) ||
                     (opts.saveUninitialized && session.isNew);

  if (shouldSave) {
    const sessionData = {};
    for (const key in session) {
      if (session.hasOwnProperty(key)) {
        sessionData[key] = session[key];
      }
    }

    await opts.store.set(session.id, sessionData, opts.cookie.maxAge);
    
    const signedId = signCookie(session.id, opts.secret);
    ctx.setCookie(opts.key, signedId, opts.cookie);
  } else if (opts.rolling) {
    await opts.store.touch(session.id, session, opts.cookie.maxAge);
    
    const signedId = signCookie(session.id, opts.secret);
    ctx.setCookie(opts.key, signedId, opts.cookie);
  }
}

function saveSessionSync(ctx, opts) {
  const session = ctx.session;
  
  if (!session) {
    return;
  }

  if (ctx.responded) {
    return;
  }

  if (session.destroyed) {
    ctx.clearCookie(opts.key);
    return;
  }

  const shouldSave = session.modified || 
                     (opts.resave && !session.isNew) ||
                     (opts.saveUninitialized && session.isNew);

  if (shouldSave) {
    const sessionData = {};
    for (const key in session) {
      if (session.hasOwnProperty(key)) {
        sessionData[key] = session[key];
      }
    }
    
    // Save session asynchronously but don't wait
    opts.store.set(session.id, sessionData, opts.cookie.maxAge);
    
    const signedId = signCookie(session.id, opts.secret);
    ctx.setCookie(opts.key, signedId, opts.cookie);
  } else if (opts.rolling) {
    opts.store.touch(session.id, session, opts.cookie.maxAge);
    
    const signedId = signCookie(session.id, opts.secret);
    ctx.setCookie(opts.key, signedId, opts.cookie);
  }
}

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function signCookie(value, secret) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${value}.${signature}`;
}

function unsignCookie(signedValue, secret) {
  const parts = signedValue.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid signed cookie');
  }
  
  const [value, signature] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Cookie signature verification failed');
  }
  
  return value;
}

class FileStore extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessionPath = options.path || './sessions';
    this.ttl = options.ttl || DEFAULT_MAX_AGE;
    this.fs = require('fs');
    this.pathModule = require('path');
    
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!this.fs.existsSync(this.sessionPath)) {
      this.fs.mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  getFilePath(sessionId) {
    // Sanitize sessionId to prevent path traversal
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid session ID');
    }
    
    // Remove any path separators and special characters
    const sanitizedId = sessionId.replace(/[\/\\:*?"<>|]/g, '');
    
    if (!sanitizedId || sanitizedId !== sessionId) {
      throw new Error('Invalid session ID format');
    }
    
    return this.pathModule.join(this.sessionPath, `${sanitizedId}.json`);
  }

  async get(sessionId) {
    const filePath = this.getFilePath(sessionId);
    
    try {
      const data = await new Promise((resolve, reject) => {
      this.fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
      const session = JSON.parse(data);
      
      if (session.expires && Date.now() > session.expires) {
        await this.destroy(sessionId);
        return null;
      }
      
      return session.data;
    } catch (error) {
      return null;
    }
  }

  async set(sessionId, session, maxAge) {
    const filePath = this.getFilePath(sessionId);
    const data = {
      data: session,
      expires: Date.now() + maxAge
    };
    
    await new Promise((resolve, reject) => {
      this.fs.writeFile(filePath, JSON.stringify(data), 'utf8', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async destroy(sessionId) {
    const filePath = this.getFilePath(sessionId);
    
    try {
      await new Promise((resolve, reject) => {
        this.fs.unlink(filePath, (err) => {
          if (err && err.code !== 'ENOENT') reject(err);
          else resolve();
        });
      });
      this.emit('destroy', sessionId);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  async touch(sessionId, session, maxAge) {
    await this.set(sessionId, session, maxAge);
  }

  async all() {
    const sessions = {};
    const files = await new Promise((resolve, reject) => {
      this.fs.readdir(this.sessionPath, (err, files) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionId = file.replace('.json', '');
        const session = await this.get(sessionId);
        if (session) {
          sessions[sessionId] = session;
        }
      }
    }
    
    return sessions;
  }

  async length() {
    const files = await new Promise((resolve, reject) => {
      this.fs.readdir(this.sessionPath, (err, files) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
    return files.filter(file => file.endsWith('.json')).length;
  }

  async clear() {
    const files = await new Promise((resolve, reject) => {
      this.fs.readdir(this.sessionPath, (err, files) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        await new Promise((resolve, reject) => {
          this.fs.unlink(this.pathModule.join(this.sessionPath, file), (err) => {
            if (err && err.code !== 'ENOENT') reject(err);
            else resolve();
          });
        });
      }
    }
  }
}

function throwMissingSecretError() {
  throw new Error(
    'Session secret is required for security. ' +
    'Please provide a secret in the session options: ' +
    'session({ secret: "your-secret-here" })'
  );
}

module.exports = session;
module.exports.MemoryStore = MemoryStore;
module.exports.FileStore = FileStore;