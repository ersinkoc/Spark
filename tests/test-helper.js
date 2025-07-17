const http = require('http');
const { URL } = require('url');

class TestHelper {
  static async request(app, options = {}) {
    const server = await app.listen(0); // Random port
    const port = server.address().port;
    
    const defaultOptions = {
      method: 'GET',
      path: '/',
      headers: {},
      ...options
    };
    
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: 'localhost',
        port,
        ...defaultOptions
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          server.close();
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            json: () => {
              try {
                return JSON.parse(body);
              } catch (e) {
                return null;
              }
            }
          });
        });
      });
      
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }
  
  static async assertThrows(fn, expectedError) {
    let thrown = false;
    let error = null;
    
    try {
      await fn();
    } catch (e) {
      thrown = true;
      error = e;
    }
    
    if (!thrown) {
      throw new Error('Expected function to throw');
    }
    
    if (expectedError && !error.message.includes(expectedError)) {
      throw new Error(`Expected error to include "${expectedError}" but got "${error.message}"`);
    }
    
    return error;
  }
  
  static createMemoryMonitor() {
    const baseline = process.memoryUsage();
    const samples = [];
    
    return {
      sample() {
        const current = process.memoryUsage();
        samples.push({
          heapUsed: current.heapUsed,
          external: current.external,
          timestamp: Date.now()
        });
      },
      
      hasLeak(threshold = 10 * 1024 * 1024) { // 10MB default
        if (samples.length < 2) return false;
        
        const first = samples[0];
        const last = samples[samples.length - 1];
        const growth = last.heapUsed - first.heapUsed;
        
        return growth > threshold;
      },
      
      getGrowth() {
        if (samples.length < 2) return 0;
        const first = samples[0];
        const last = samples[samples.length - 1];
        return last.heapUsed - first.heapUsed;
      },
      
      reset() {
        samples.length = 0;
      }
    };
  }
  
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  static async measureTime(fn) {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e6; // Convert to milliseconds
    
    return { result, duration };
  }
  
  static generateRandomString(length = 10) {
    return Math.random().toString(36).substring(2, length + 2);
  }
  
  static generateLargePayload(sizeInMB = 1) {
    const size = sizeInMB * 1024 * 1024;
    return 'x'.repeat(size);
  }
}

module.exports = TestHelper;