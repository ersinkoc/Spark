# Working with Data

Learn how to handle request data, validate input, and work with different data formats in Spark.

## Request Data Types

Spark can handle various types of request data:

### 1. URL Parameters

```javascript
// Route: /users/:id
app.get('/users/:id', (ctx) => {
  const id = ctx.params.id;
  console.log('User ID:', id);
  ctx.json({ userId: id });
});

// Route: /users/:userId/posts/:postId
app.get('/users/:userId/posts/:postId', (ctx) => {
  const { userId, postId } = ctx.params;
  console.log('User:', userId, 'Post:', postId);
  ctx.json({ userId, postId });
});
```

### 2. Query Parameters

```javascript
// URL: /search?q=nodejs&limit=10&page=1
app.get('/search', (ctx) => {
  const { q, limit = 10, page = 1 } = ctx.query;
  
  ctx.json({
    query: q,
    limit: parseInt(limit),
    page: parseInt(page)
  });
});

// URL: /users?role=admin&active=true&sort=name
app.get('/users', (ctx) => {
  const { role, active, sort = 'id' } = ctx.query;
  
  // Convert string to boolean
  const isActive = active === 'true';
  
  ctx.json({
    filters: { role, active: isActive },
    sorting: sort
  });
});
```

### 3. Request Body (JSON)

```javascript
const bodyParser = require('@oxog/spark/middleware/body-parser');

app.use(bodyParser());

app.post('/users', (ctx) => {
  const { name, email, age } = ctx.body;
  
  console.log('Request body:', ctx.body);
  
  ctx.json({
    message: 'User created',
    user: { name, email, age }
  });
});
```

### 4. Request Headers

```javascript
app.get('/protected', (ctx) => {
  const token = ctx.get('authorization');
  const userAgent = ctx.get('user-agent');
  const contentType = ctx.get('content-type');
  
  ctx.json({
    token,
    userAgent,
    contentType,
    allHeaders: ctx.headers
  });
});
```

## Data Validation

Always validate incoming data to ensure security and reliability:

### Basic Validation

```javascript
app.post('/users', (ctx) => {
  const { name, email, age } = ctx.body;
  
  // Check required fields
  if (!name || !email) {
    return ctx.status(400).json({
      error: 'Name and email are required'
    });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return ctx.status(400).json({
      error: 'Invalid email format'
    });
  }
  
  // Validate age
  if (age && (age < 0 || age > 150)) {
    return ctx.status(400).json({
      error: 'Age must be between 0 and 150'
    });
  }
  
  ctx.json({
    message: 'User created successfully',
    user: { name, email, age }
  });
});
```

### Advanced Validation Function

```javascript
function validateUser(userData) {
  const errors = [];
  
  // Required fields
  if (!userData.name) errors.push('Name is required');
  if (!userData.email) errors.push('Email is required');
  
  // Email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (userData.email && !emailRegex.test(userData.email)) {
    errors.push('Invalid email format');
  }
  
  // Age validation
  if (userData.age !== undefined) {
    if (typeof userData.age !== 'number' || userData.age < 0 || userData.age > 150) {
      errors.push('Age must be a number between 0 and 150');
    }
  }
  
  // Password strength (if provided)
  if (userData.password) {
    if (userData.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/.test(userData.password)) {
      errors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Use the validation function
app.post('/users', (ctx) => {
  const validation = validateUser(ctx.body);
  
  if (!validation.isValid) {
    return ctx.status(400).json({
      error: 'Validation failed',
      details: validation.errors
    });
  }
  
  ctx.json({
    message: 'User created successfully',
    user: ctx.body
  });
});
```

### Validation Middleware

```javascript
function validateUserData(ctx, next) {
  const validation = validateUser(ctx.body);
  
  if (!validation.isValid) {
    return ctx.status(400).json({
      error: 'Validation failed',
      details: validation.errors
    });
  }
  
  return next();
}

// Use validation middleware
app.post('/users', validateUserData, (ctx) => {
  ctx.json({
    message: 'User created successfully',
    user: ctx.body
  });
});

app.put('/users/:id', validateUserData, (ctx) => {
  ctx.json({
    message: 'User updated successfully',
    user: ctx.body
  });
});
```

## Data Transformation

Transform data before processing:

```javascript
function transformUserData(ctx, next) {
  if (ctx.body) {
    // Convert email to lowercase
    if (ctx.body.email) {
      ctx.body.email = ctx.body.email.toLowerCase();
    }
    
    // Trim whitespace from strings
    if (ctx.body.name) {
      ctx.body.name = ctx.body.name.trim();
    }
    
    // Convert age to number
    if (ctx.body.age) {
      ctx.body.age = parseInt(ctx.body.age);
    }
    
    // Add timestamps
    ctx.body.createdAt = new Date().toISOString();
  }
  
  return next();
}

app.post('/users', transformUserData, (ctx) => {
  ctx.json({
    message: 'User created',
    user: ctx.body
  });
});
```

## Working with Different Data Formats

### JSON Data

```javascript
app.use(require('@oxog/spark/middleware/body-parser')());

app.post('/api/data', (ctx) => {
  // ctx.body automatically parsed as JSON
  console.log('JSON data:', ctx.body);
  ctx.json({ received: ctx.body });
});
```

### Form Data

```javascript
app.use(require('@oxog/spark/middleware/body-parser')({
  urlencoded: true
}));

app.post('/form', (ctx) => {
  // Form data parsed to object
  const { username, password } = ctx.body;
  ctx.json({ username, password });
});
```

### File Uploads

```javascript
const fs = require('fs');
const path = require('path');

app.post('/upload', (ctx) => {
  const file = ctx.files?.file;
  
  if (!file) {
    return ctx.status(400).json({ error: 'No file uploaded' });
  }
  
  // Save file
  const uploadDir = './uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  
  const filename = `${Date.now()}-${file.filename}`;
  const filepath = path.join(uploadDir, filename);
  
  fs.writeFileSync(filepath, file.data);
  
  ctx.json({
    message: 'File uploaded successfully',
    filename: filename,
    size: file.size,
    type: file.contentType
  });
});
```

## Response Handling

Send different types of responses:

### JSON Responses

```javascript
app.get('/api/users', (ctx) => {
  ctx.json({
    users: [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' }
    ],
    total: 2,
    page: 1
  });
});

// With custom status
app.post('/api/users', (ctx) => {
  ctx.status(201).json({
    message: 'User created',
    user: { id: 3, name: 'Bob' }
  });
});
```

### Text Responses

```javascript
app.get('/health', (ctx) => {
  ctx.text('OK');
});

app.get('/version', (ctx) => {
  ctx.text('Version 1.0.0');
});
```

### HTML Responses

```javascript
app.get('/', (ctx) => {
  ctx.html(`
    <html>
      <head><title>My App</title></head>
      <body>
        <h1>Welcome to My App</h1>
        <p>This is a Spark application</p>
      </body>
    </html>
  `);
});
```

### Custom Headers

```javascript
app.get('/api/data', (ctx) => {
  ctx.set('X-API-Version', '1.0');
  ctx.set('X-Response-Time', Date.now());
  
  ctx.json({ data: 'example' });
});
```

### Redirects

```javascript
app.get('/old-page', (ctx) => {
  ctx.redirect('/new-page');
});

app.get('/external', (ctx) => {
  ctx.redirect('https://example.com', 301);
});
```

## Error Handling

Handle data-related errors gracefully:

```javascript
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      ctx.status(400).json({
        error: 'Validation failed',
        details: error.message
      });
    } else if (error.name === 'NotFoundError') {
      ctx.status(404).json({
        error: 'Resource not found'
      });
    } else {
      ctx.status(500).json({
        error: 'Internal server error'
      });
    }
  }
});
```

## Data Persistence

### In-Memory Storage

```javascript
const users = [];
let nextId = 1;

app.get('/users', (ctx) => {
  ctx.json({ users });
});

app.post('/users', (ctx) => {
  const user = {
    id: nextId++,
    ...ctx.body,
    createdAt: new Date().toISOString()
  };
  
  users.push(user);
  ctx.status(201).json({ user });
});

app.put('/users/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const index = users.findIndex(u => u.id === id);
  
  if (index === -1) {
    return ctx.status(404).json({ error: 'User not found' });
  }
  
  users[index] = {
    ...users[index],
    ...ctx.body,
    updatedAt: new Date().toISOString()
  };
  
  ctx.json({ user: users[index] });
});
```

### File Storage

```javascript
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'data.json');

function loadData() {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { users: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

app.get('/users', (ctx) => {
  const data = loadData();
  ctx.json({ users: data.users });
});

app.post('/users', (ctx) => {
  const data = loadData();
  const user = {
    id: Date.now(),
    ...ctx.body,
    createdAt: new Date().toISOString()
  };
  
  data.users.push(user);
  saveData(data);
  
  ctx.status(201).json({ user });
});
```

## Complete Example: User Management API

Here's a complete example with validation and data handling:

```javascript
const { Spark } = require('@oxog/spark');
const bodyParser = require('@oxog/spark/middleware/body-parser');

const app = new Spark();
app.use(bodyParser());

// In-memory storage
const users = [];
let nextId = 1;

// Validation function
function validateUser(userData) {
  const errors = [];
  
  if (!userData.name) errors.push('Name is required');
  if (!userData.email) errors.push('Email is required');
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (userData.email && !emailRegex.test(userData.email)) {
    errors.push('Invalid email format');
  }
  
  if (userData.age !== undefined) {
    if (typeof userData.age !== 'number' || userData.age < 0 || userData.age > 150) {
      errors.push('Age must be a number between 0 and 150');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Middleware
function validateUserData(ctx, next) {
  const validation = validateUser(ctx.body);
  
  if (!validation.isValid) {
    return ctx.status(400).json({
      error: 'Validation failed',
      details: validation.errors
    });
  }
  
  return next();
}

function transformUserData(ctx, next) {
  if (ctx.body) {
    if (ctx.body.email) ctx.body.email = ctx.body.email.toLowerCase();
    if (ctx.body.name) ctx.body.name = ctx.body.name.trim();
    if (ctx.body.age) ctx.body.age = parseInt(ctx.body.age);
  }
  
  return next();
}

// Routes
app.get('/users', (ctx) => {
  const { role, active, sort = 'id' } = ctx.query;
  
  let filteredUsers = users;
  
  if (role) {
    filteredUsers = filteredUsers.filter(u => u.role === role);
  }
  
  if (active === 'true') {
    filteredUsers = filteredUsers.filter(u => u.active === true);
  }
  
  // Sort users
  filteredUsers.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'email') return a.email.localeCompare(b.email);
    return a.id - b.id;
  });
  
  ctx.json({
    users: filteredUsers,
    total: filteredUsers.length,
    filters: { role, active: active === 'true' },
    sort
  });
});

app.get('/users/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const user = users.find(u => u.id === id);
  
  if (!user) {
    return ctx.status(404).json({ error: 'User not found' });
  }
  
  ctx.json({ user });
});

app.post('/users', 
  transformUserData,
  validateUserData,
  (ctx) => {
    const user = {
      id: nextId++,
      ...ctx.body,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    users.push(user);
    
    ctx.status(201).json({
      message: 'User created successfully',
      user
    });
  }
);

app.put('/users/:id', 
  transformUserData,
  validateUserData,
  (ctx) => {
    const id = parseInt(ctx.params.id);
    const index = users.findIndex(u => u.id === id);
    
    if (index === -1) {
      return ctx.status(404).json({ error: 'User not found' });
    }
    
    users[index] = {
      ...users[index],
      ...ctx.body,
      updatedAt: new Date().toISOString()
    };
    
    ctx.json({
      message: 'User updated successfully',
      user: users[index]
    });
  }
);

app.delete('/users/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const index = users.findIndex(u => u.id === id);
  
  if (index === -1) {
    return ctx.status(404).json({ error: 'User not found' });
  }
  
  const deletedUser = users.splice(index, 1)[0];
  
  ctx.json({
    message: 'User deleted successfully',
    user: deletedUser
  });
});

// Error handling
app.use((ctx, next) => {
  try {
    return next();
  } catch (error) {
    console.error('Error:', error);
    ctx.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('User Management API running on port 3000');
});
```

## Testing Your Data Handling

Test your endpoints with different data:

```bash
# Create users
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "age": 25}'

curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Smith", "email": "jane@example.com", "age": 30, "role": "admin"}'

# Test validation
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "", "email": "invalid-email"}'

# Filter users
curl "http://localhost:3000/users?role=admin&sort=name"

# Update user
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "John Updated"}'
```

## What's Next?

You now know how to handle data in Spark! Next, let's learn about middleware:

👉 **Next Guide:** [Understanding Middleware](06-middleware.md)

You'll learn:
- What middleware is and how it works
- Built-in middleware options
- Creating custom middleware
- Middleware patterns and best practices

Keep building! 🚀