const { Spark, middleware } = require('../../src/index');
const fs = require('fs');
const path = require('path');

const app = new Spark({
  port: process.env.PORT || 3000
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(middleware.cors());
app.use(middleware.bodyParser({ limit: 10 * 1024 * 1024 })); // 10MB limit
app.use(middleware.compression());

// Serve uploaded files
app.use('/uploads', middleware.static(uploadsDir));

// Upload endpoint
app.post('/upload', async (ctx) => {
  if (!ctx.files || Object.keys(ctx.files).length === 0) {
    return ctx.status(400).json({ error: 'No files uploaded' });
  }

  const uploadedFiles = [];

  for (const [fieldName, file] of Object.entries(ctx.files)) {
    const filename = `${Date.now()}-${file.filename}`;
    const filepath = path.join(uploadsDir, filename);

    try {
      fs.writeFileSync(filepath, file.data);
      
      uploadedFiles.push({
        fieldName,
        originalName: file.filename,
        filename,
        size: file.size,
        contentType: file.contentType,
        url: `/uploads/${filename}`
      });
    } catch (error) {
      console.error('Upload error:', error);
      return ctx.status(500).json({ error: 'Failed to save file' });
    }
  }

  ctx.json({
    message: 'Files uploaded successfully',
    files: uploadedFiles
  });
});

// Multiple file upload
app.post('/upload/multiple', async (ctx) => {
  const files = ctx.files;
  
  if (!files || Object.keys(files).length === 0) {
    return ctx.status(400).json({ error: 'No files uploaded' });
  }

  const uploadedFiles = [];
  const errors = [];

  for (const [fieldName, fileOrFiles] of Object.entries(files)) {
    const fileArray = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    
    for (const file of fileArray) {
      const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.filename}`;
      const filepath = path.join(uploadsDir, filename);

      try {
        fs.writeFileSync(filepath, file.data);
        
        uploadedFiles.push({
          fieldName,
          originalName: file.filename,
          filename,
          size: file.size,
          contentType: file.contentType,
          url: `/uploads/${filename}`
        });
      } catch (error) {
        errors.push({
          filename: file.filename,
          error: error.message
        });
      }
    }
  }

  ctx.json({
    message: 'Upload completed',
    uploaded: uploadedFiles,
    errors: errors,
    summary: {
      total: uploadedFiles.length + errors.length,
      successful: uploadedFiles.length,
      failed: errors.length
    }
  });
});

// List uploaded files at /uploads
app.get('/uploads', async (ctx) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    ctx.json(files);
  } catch (error) {
    ctx.json([]);
  }
});

// List uploaded files
app.get('/files', async (ctx) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const fileList = files.map(filename => {
      const filepath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filepath);
      
      return {
        filename,
        size: stats.size,
        uploadedAt: stats.birthtime,
        url: `/uploads/${filename}`
      };
    });

    ctx.json({
      files: fileList,
      total: fileList.length
    });
  } catch (error) {
    ctx.status(500).json({ error: 'Failed to list files' });
  }
});

// Delete file
app.delete('/files/:filename', async (ctx) => {
  const { filename } = ctx.params;
  const filepath = path.join(uploadsDir, filename);

  try {
    if (!fs.existsSync(filepath)) {
      return ctx.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filepath);
    ctx.json({ message: 'File deleted successfully' });
  } catch (error) {
    ctx.status(500).json({ error: 'Failed to delete file' });
  }
});

// File info
app.get('/files/:filename/info', async (ctx) => {
  const { filename } = ctx.params;
  const filepath = path.join(uploadsDir, filename);

  try {
    if (!fs.existsSync(filepath)) {
      return ctx.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(filepath);
    const ext = path.extname(filename).toLowerCase();
    
    ctx.json({
      filename,
      size: stats.size,
      uploadedAt: stats.birthtime,
      lastModified: stats.mtime,
      extension: ext,
      contentType: getContentType(ext),
      url: `/uploads/${filename}`
    });
  } catch (error) {
    ctx.status(500).json({ error: 'Failed to get file info' });
  }
});

// Root endpoint with upload form
app.get('/', (ctx) => {
  ctx.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>File Upload Example</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 600px; margin: 0 auto; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="file"] { width: 100%; padding: 10px; border: 1px solid #ddd; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer; }
        button:hover { background: #0056b3; }
        .response { margin-top: 20px; padding: 15px; background: #f8f9fa; border: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>File Upload Example</h1>
        
        <h2>Single File Upload</h2>
        <form id="singleUpload" enctype="multipart/form-data">
          <div class="form-group">
            <label for="file">Select file:</label>
            <input type="file" id="file" name="file" required>
          </div>
          <button type="submit">Upload</button>
        </form>
        
        <h2>Multiple File Upload</h2>
        <form id="multipleUpload" enctype="multipart/form-data">
          <div class="form-group">
            <label for="files">Select files:</label>
            <input type="file" id="files" name="files" multiple required>
          </div>
          <button type="submit">Upload Multiple</button>
        </form>
        
        <div id="response" class="response" style="display: none;"></div>
        
        <h2>API Endpoints</h2>
        <ul>
          <li><strong>POST /upload</strong> - Upload single file</li>
          <li><strong>POST /upload/multiple</strong> - Upload multiple files</li>
          <li><strong>GET /files</strong> - List all uploaded files</li>
          <li><strong>GET /files/:filename/info</strong> - Get file information</li>
          <li><strong>DELETE /files/:filename</strong> - Delete file</li>
          <li><strong>GET /uploads/:filename</strong> - Download file</li>
        </ul>
      </div>
      
      <script>
        function handleFormSubmit(formId, endpoint) {
          document.getElementById(formId).addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const response = document.getElementById('response');
            
            try {
              const result = await fetch(endpoint, {
                method: 'POST',
                body: formData
              });
              
              const data = await result.json();
              response.style.display = 'block';
              response.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
              response.style.display = 'block';
              response.innerHTML = '<pre style="color: red;">Error: ' + error.message + '</pre>';
            }
          });
        }
        
        handleFormSubmit('singleUpload', '/upload');
        handleFormSubmit('multipleUpload', '/upload/multiple');
      </script>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', async (ctx) => {
  ctx.json({
    status: 'ok',
    service: 'file-upload',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

function getContentType(ext) {
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return types[ext] || 'application/octet-stream';
}

if (require.main === module) {
  const port = process.env.PORT || 0; // Use dynamic port by default
  app.listen(port, () => {
    const actualPort = app.server?.address()?.port || port;
    console.log(`🚀 File Upload Server running on http://localhost:${actualPort}`);
    console.log(`📁 Upload files at: http://localhost:${actualPort}`);
    console.log(`📋 List files: http://localhost:${actualPort}/files`);
  });
}

module.exports = app;