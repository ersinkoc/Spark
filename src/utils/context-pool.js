const Context = require('../core/context');

/**
 * Context Object Pool for performance optimization
 * Reuses Context objects to reduce garbage collection pressure
 */
class ContextPool {
  constructor(maxSize = 100) {
    this.pool = [];
    this.maxSize = maxSize;
    this.created = 0;
    this.reused = 0;
  }
  
  /**
   * Acquire a Context object from the pool or create new one
   * @param {IncomingMessage} req - HTTP request object
   * @param {ServerResponse} res - HTTP response object  
   * @param {Application} app - Spark application instance
   * @returns {Context} Context instance
   */
  acquire(req, res, app) {
    let ctx;
    
    if (this.pool.length > 0) {
      ctx = this.pool.pop();
      ctx.init(req, res, app);
      this.reused++;
    } else {
      ctx = new Context(req, res, app);
      this.created++;
    }
    
    return ctx;
  }
  
  /**
   * Release a Context object back to the pool
   * @param {Context} ctx - Context to release
   */
  release(ctx) {
    if (this.pool.length < this.maxSize) {
      ctx.reset();
      this.pool.push(ctx);
    }
  }
  
  /**
   * Get pool statistics
   * @returns {Object} Pool stats
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      maxSize: this.maxSize,
      created: this.created,
      reused: this.reused,
      reuseRatio: this.created > 0 ? (this.reused / this.created * 100).toFixed(2) + '%' : '0%'
    };
  }
  
  /**
   * Clear the pool
   */
  clear() {
    this.pool.length = 0;
  }
  
  /**
   * Resize the pool
   * @param {number} newSize - New maximum pool size
   */
  resize(newSize) {
    this.maxSize = newSize;
    
    // Trim pool if new size is smaller
    if (this.pool.length > newSize) {
      this.pool.length = newSize;
    }
  }
}

module.exports = ContextPool;