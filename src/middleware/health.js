const os = require('os');
const fs = require('fs');
const { promisify } = require('util');

const stat = promisify(fs.stat);

/**
 * Health check middleware with configurable checks
 * @param {Object} options - Health check options
 * @returns {Function} Middleware function
 */
function healthCheck(options = {}) {
  const opts = {
    path: '/_health',
    checks: {
      uptime: true,
      memory: true,
      cpu: true,
      disk: false,
      custom: []
    },
    timeout: 5000,
    includeDetails: process.env.NODE_ENV !== 'production',
    ...options
  };

  return async (ctx, next) => {
    if (ctx.path !== opts.path) {
      return next();
    }

    if (ctx.method !== 'GET') {
      ctx.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      const healthData = await performHealthChecks(opts);
      
      const status = healthData.checks.every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy';
      const statusCode = status === 'healthy' ? 200 : 503;
      
      ctx.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        ...healthData
      });

    } catch (error) {
      ctx.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        checks: []
      });
    }
  };
}

async function performHealthChecks(opts) {
  const checks = [];
  const details = {};
  
  // Uptime check
  if (opts.checks.uptime) {
    const uptime = process.uptime();
    checks.push({
      name: 'uptime',
      status: 'healthy',
      value: `${Math.floor(uptime)}s`
    });
    
    if (opts.includeDetails) {
      details.uptime = {
        seconds: uptime,
        formatted: formatUptime(uptime)
      };
    }
  }

  // Memory check
  if (opts.checks.memory) {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = (usedMem / totalMem) * 100;
    
    const memStatus = memPercentage > 90 ? 'unhealthy' : memPercentage > 75 ? 'degraded' : 'healthy';
    
    checks.push({
      name: 'memory',
      status: memStatus,
      value: `${memPercentage.toFixed(1)}%`
    });
    
    if (opts.includeDetails) {
      details.memory = {
        usage: memUsage,
        system: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          percentage: memPercentage
        }
      };
    }
  }

  // CPU check
  if (opts.checks.cpu) {
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const avgLoad = loadAvg[0] / cpuCount;
    
    const cpuStatus = avgLoad > 0.8 ? 'unhealthy' : avgLoad > 0.6 ? 'degraded' : 'healthy';
    
    checks.push({
      name: 'cpu',
      status: cpuStatus,
      value: `${(avgLoad * 100).toFixed(1)}%`
    });
    
    if (opts.includeDetails) {
      details.cpu = {
        loadAverage: loadAvg,
        cores: cpuCount,
        usage: avgLoad
      };
    }
  }

  // Disk check
  if (opts.checks.disk) {
    try {
      const stats = await stat(process.cwd());
      checks.push({
        name: 'disk',
        status: 'healthy',
        value: 'accessible'
      });
    } catch (error) {
      checks.push({
        name: 'disk',
        status: 'unhealthy',
        value: 'inaccessible',
        error: error.message
      });
    }
  }

  // Custom checks
  for (const customCheck of opts.checks.custom) {
    try {
      const result = await Promise.race([
        customCheck.check(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), opts.timeout)
        )
      ]);
      
      checks.push({
        name: customCheck.name,
        status: result.status || 'healthy',
        value: result.value || 'ok',
        ...result
      });
    } catch (error) {
      checks.push({
        name: customCheck.name,
        status: 'unhealthy',
        value: 'failed',
        error: error.message
      });
    }
  }

  const result = { checks };
  
  if (opts.includeDetails) {
    result.details = details;
    result.system = {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      pid: process.pid
    };
  }

  return result;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);
  
  return parts.join(' ') || '0s';
}

/**
 * Create a custom health check
 * @param {string} name - Check name
 * @param {Function} checkFn - Function that returns health status
 * @returns {Object} Custom check object
 */
function createCustomCheck(name, checkFn) {
  return { name, check: checkFn };
}

module.exports = healthCheck;
module.exports.createCustomCheck = createCustomCheck;