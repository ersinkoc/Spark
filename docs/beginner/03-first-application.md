# Your First Spark Application

Let's build your first real Spark application! You'll create a simple blog API that handles posts and comments.

## What We'll Build

A simple blog API with:
- 📝 **Posts**: Create, read, update, delete blog posts
- 💬 **Comments**: Add comments to posts
- 🔍 **Search**: Find posts by title
- 📊 **Stats**: Get blog statistics

## Step 1: Project Setup

Create a new directory and set up your project:

```bash
mkdir my-blog-api
cd my-blog-api
npm init -y
npm install @oxog/spark
```

## Step 2: Basic Server Structure

Create `server.js`:

```javascript
const { Spark } = require('@oxog/spark');

const app = new Spark();

// In-memory storage (we'll use a database later)
const posts = [];
const comments = [];
let nextPostId = 1;
let nextCommentId = 1;

// Basic route
app.get('/', (ctx) => {
  ctx.json({
    message: 'Welcome to My Blog API!',
    version: '1.0.0',
    endpoints: {
      posts: '/api/posts',
      comments: '/api/comments',
      stats: '/api/stats'
    }
  });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Blog API running on port ${port}`);
  console.log(`📖 Visit: http://localhost:${port}`);
});
```

**Test it:**
```bash
node server.js
```

Visit `http://localhost:3000` - you should see the welcome message!

## Step 3: Adding Posts Routes

Now let's add routes for managing blog posts:

```javascript
// Add this after the welcome route

// Get all posts
app.get('/api/posts', (ctx) => {
  ctx.json({
    posts: posts,
    total: posts.length
  });
});

// Get a specific post
app.get('/api/posts/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const post = posts.find(p => p.id === id);
  
  if (!post) {
    return ctx.status(404).json({
      error: 'Post not found'
    });
  }
  
  ctx.json({ post });
});

// Create a new post
app.post('/api/posts', (ctx) => {
  const { title, content, author } = ctx.body;
  
  // Basic validation
  if (!title || !content) {
    return ctx.status(400).json({
      error: 'Title and content are required'
    });
  }
  
  const post = {
    id: nextPostId++,
    title,
    content,
    author: author || 'Anonymous',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  posts.push(post);
  
  ctx.status(201).json({
    message: 'Post created successfully',
    post
  });
});

// Update a post
app.put('/api/posts/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const postIndex = posts.findIndex(p => p.id === id);
  
  if (postIndex === -1) {
    return ctx.status(404).json({
      error: 'Post not found'
    });
  }
  
  const { title, content } = ctx.body;
  
  if (title) posts[postIndex].title = title;
  if (content) posts[postIndex].content = content;
  posts[postIndex].updatedAt = new Date().toISOString();
  
  ctx.json({
    message: 'Post updated successfully',
    post: posts[postIndex]
  });
});

// Delete a post
app.delete('/api/posts/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const postIndex = posts.findIndex(p => p.id === id);
  
  if (postIndex === -1) {
    return ctx.status(404).json({
      error: 'Post not found'
    });
  }
  
  const deletedPost = posts.splice(postIndex, 1)[0];
  
  ctx.json({
    message: 'Post deleted successfully',
    post: deletedPost
  });
});
```

## Step 4: Adding Body Parser Middleware

To handle JSON in POST requests, we need to add body parser middleware:

```javascript
// Add this near the top, after creating the app
const bodyParser = require('@oxog/spark/middleware/body-parser');

app.use(bodyParser());
```

## Step 5: Testing Your API

Let's test our posts API:

**1. Create a post:**
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "My First Post", "content": "This is my first blog post!", "author": "John Doe"}'
```

**2. Get all posts:**
```bash
curl http://localhost:3000/api/posts
```

**3. Get a specific post:**
```bash
curl http://localhost:3000/api/posts/1
```

**4. Update a post:**
```bash
curl -X PUT http://localhost:3000/api/posts/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'
```

**5. Delete a post:**
```bash
curl -X DELETE http://localhost:3000/api/posts/1
```

## Step 6: Adding Comments

Let's add comment functionality:

```javascript
// Add these routes after the posts routes

// Get comments for a post
app.get('/api/posts/:id/comments', (ctx) => {
  const postId = parseInt(ctx.params.id);
  const postComments = comments.filter(c => c.postId === postId);
  
  ctx.json({
    comments: postComments,
    total: postComments.length
  });
});

// Add a comment to a post
app.post('/api/posts/:id/comments', (ctx) => {
  const postId = parseInt(ctx.params.id);
  const post = posts.find(p => p.id === postId);
  
  if (!post) {
    return ctx.status(404).json({
      error: 'Post not found'
    });
  }
  
  const { content, author } = ctx.body;
  
  if (!content) {
    return ctx.status(400).json({
      error: 'Comment content is required'
    });
  }
  
  const comment = {
    id: nextCommentId++,
    postId,
    content,
    author: author || 'Anonymous',
    createdAt: new Date().toISOString()
  };
  
  comments.push(comment);
  
  ctx.status(201).json({
    message: 'Comment added successfully',
    comment
  });
});

// Get all comments
app.get('/api/comments', (ctx) => {
  ctx.json({
    comments: comments,
    total: comments.length
  });
});
```

## Step 7: Adding Search and Stats

Let's add some useful features:

```javascript
// Search posts by title
app.get('/api/search', (ctx) => {
  const { q } = ctx.query;
  
  if (!q) {
    return ctx.status(400).json({
      error: 'Search query is required'
    });
  }
  
  const results = posts.filter(post => 
    post.title.toLowerCase().includes(q.toLowerCase()) ||
    post.content.toLowerCase().includes(q.toLowerCase())
  );
  
  ctx.json({
    query: q,
    results,
    total: results.length
  });
});

// Get blog statistics
app.get('/api/stats', (ctx) => {
  const stats = {
    totalPosts: posts.length,
    totalComments: comments.length,
    avgCommentsPerPost: posts.length > 0 ? (comments.length / posts.length).toFixed(2) : 0,
    recentPosts: posts.slice(-5).reverse(),
    topAuthors: getTopAuthors()
  };
  
  ctx.json(stats);
});

// Helper function for top authors
function getTopAuthors() {
  const authorCounts = {};
  
  posts.forEach(post => {
    authorCounts[post.author] = (authorCounts[post.author] || 0) + 1;
  });
  
  return Object.entries(authorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([author, count]) => ({ author, posts: count }));
}
```

## Step 8: Adding Error Handling

Let's add better error handling:

```javascript
// Add this near the top, after middleware setup

// Global error handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    
    ctx.status(error.status || 500).json({
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler (add this at the end, before app.listen)
app.use((ctx) => {
  ctx.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/posts',
      'POST /api/posts',
      'GET /api/posts/:id',
      'PUT /api/posts/:id',
      'DELETE /api/posts/:id',
      'GET /api/posts/:id/comments',
      'POST /api/posts/:id/comments',
      'GET /api/comments',
      'GET /api/search',
      'GET /api/stats'
    ]
  });
});
```

## Step 9: Complete Application

Here's your complete `server.js` file:

```javascript
const { Spark } = require('@oxog/spark');
const bodyParser = require('@oxog/spark/middleware/body-parser');

const app = new Spark();

// Middleware
app.use(bodyParser());

// Global error handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    
    ctx.status(error.status || 500).json({
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// In-memory storage
const posts = [];
const comments = [];
let nextPostId = 1;
let nextCommentId = 1;

// Routes
app.get('/', (ctx) => {
  ctx.json({
    message: 'Welcome to My Blog API!',
    version: '1.0.0',
    endpoints: {
      posts: '/api/posts',
      comments: '/api/comments',
      search: '/api/search',
      stats: '/api/stats'
    }
  });
});

// Posts routes
app.get('/api/posts', (ctx) => {
  ctx.json({
    posts: posts,
    total: posts.length
  });
});

app.get('/api/posts/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const post = posts.find(p => p.id === id);
  
  if (!post) {
    return ctx.status(404).json({
      error: 'Post not found'
    });
  }
  
  ctx.json({ post });
});

app.post('/api/posts', (ctx) => {
  const { title, content, author } = ctx.body;
  
  if (!title || !content) {
    return ctx.status(400).json({
      error: 'Title and content are required'
    });
  }
  
  const post = {
    id: nextPostId++,
    title,
    content,
    author: author || 'Anonymous',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  posts.push(post);
  
  ctx.status(201).json({
    message: 'Post created successfully',
    post
  });
});

app.put('/api/posts/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const postIndex = posts.findIndex(p => p.id === id);
  
  if (postIndex === -1) {
    return ctx.status(404).json({
      error: 'Post not found'
    });
  }
  
  const { title, content } = ctx.body;
  
  if (title) posts[postIndex].title = title;
  if (content) posts[postIndex].content = content;
  posts[postIndex].updatedAt = new Date().toISOString();
  
  ctx.json({
    message: 'Post updated successfully',
    post: posts[postIndex]
  });
});

app.delete('/api/posts/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const postIndex = posts.findIndex(p => p.id === id);
  
  if (postIndex === -1) {
    return ctx.status(404).json({
      error: 'Post not found'
    });
  }
  
  const deletedPost = posts.splice(postIndex, 1)[0];
  
  ctx.json({
    message: 'Post deleted successfully',
    post: deletedPost
  });
});

// Comments routes
app.get('/api/posts/:id/comments', (ctx) => {
  const postId = parseInt(ctx.params.id);
  const postComments = comments.filter(c => c.postId === postId);
  
  ctx.json({
    comments: postComments,
    total: postComments.length
  });
});

app.post('/api/posts/:id/comments', (ctx) => {
  const postId = parseInt(ctx.params.id);
  const post = posts.find(p => p.id === postId);
  
  if (!post) {
    return ctx.status(404).json({
      error: 'Post not found'
    });
  }
  
  const { content, author } = ctx.body;
  
  if (!content) {
    return ctx.status(400).json({
      error: 'Comment content is required'
    });
  }
  
  const comment = {
    id: nextCommentId++,
    postId,
    content,
    author: author || 'Anonymous',
    createdAt: new Date().toISOString()
  };
  
  comments.push(comment);
  
  ctx.status(201).json({
    message: 'Comment added successfully',
    comment
  });
});

app.get('/api/comments', (ctx) => {
  ctx.json({
    comments: comments,
    total: comments.length
  });
});

// Search and stats
app.get('/api/search', (ctx) => {
  const { q } = ctx.query;
  
  if (!q) {
    return ctx.status(400).json({
      error: 'Search query is required'
    });
  }
  
  const results = posts.filter(post => 
    post.title.toLowerCase().includes(q.toLowerCase()) ||
    post.content.toLowerCase().includes(q.toLowerCase())
  );
  
  ctx.json({
    query: q,
    results,
    total: results.length
  });
});

app.get('/api/stats', (ctx) => {
  const stats = {
    totalPosts: posts.length,
    totalComments: comments.length,
    avgCommentsPerPost: posts.length > 0 ? (comments.length / posts.length).toFixed(2) : 0,
    recentPosts: posts.slice(-5).reverse(),
    topAuthors: getTopAuthors()
  };
  
  ctx.json(stats);
});

// Helper function
function getTopAuthors() {
  const authorCounts = {};
  
  posts.forEach(post => {
    authorCounts[post.author] = (authorCounts[post.author] || 0) + 1;
  });
  
  return Object.entries(authorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([author, count]) => ({ author, posts: count }));
}

// 404 handler
app.use((ctx) => {
  ctx.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/posts',
      'POST /api/posts',
      'GET /api/posts/:id',
      'PUT /api/posts/:id',
      'DELETE /api/posts/:id',
      'GET /api/posts/:id/comments',
      'POST /api/posts/:id/comments',
      'GET /api/comments',
      'GET /api/search',
      'GET /api/stats'
    ]
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Blog API running on port ${port}`);
  console.log(`📖 Visit: http://localhost:${port}`);
});
```

## Step 10: Testing Your Complete API

Test all the endpoints:

```bash
# Create some posts
curl -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d '{"title": "Getting Started with Spark", "content": "This is a great framework!", "author": "John Doe"}'

curl -X POST http://localhost:3000/api/posts -H "Content-Type: application/json" -d '{"title": "Advanced Spark Techniques", "content": "Let me show you some advanced features.", "author": "Jane Smith"}'

# Add comments
curl -X POST http://localhost:3000/api/posts/1/comments -H "Content-Type: application/json" -d '{"content": "Great post!", "author": "Bob"}'

# Search posts
curl "http://localhost:3000/api/search?q=spark"

# Get stats
curl http://localhost:3000/api/stats
```

## What You've Learned

Congratulations! You've built a complete blog API with:

- ✅ **RESTful endpoints** for posts and comments
- ✅ **HTTP methods** (GET, POST, PUT, DELETE)
- ✅ **Route parameters** and query strings
- ✅ **Request body handling** with middleware
- ✅ **Error handling** and validation
- ✅ **Search functionality**
- ✅ **Statistics and analytics**

## What's Next?

Now you understand the basics! Let's learn about:

👉 **Next Guide:** [Understanding Routing](04-routing.md)

You'll learn about:
- Advanced routing patterns
- Route parameters and wildcards
- Router organization
- Middleware for specific routes

Keep building! 🚀