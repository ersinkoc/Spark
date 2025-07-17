class Route {
  constructor(path) {
    this.path = path;
    this.stack = [];
    this.methods = {};
  }

  get(...handlers) {
    handlers.forEach(handler => this.add('GET', handler));
    return this;
  }

  post(...handlers) {
    handlers.forEach(handler => this.add('POST', handler));
    return this;
  }

  put(...handlers) {
    handlers.forEach(handler => this.add('PUT', handler));
    return this;
  }

  delete(...handlers) {
    handlers.forEach(handler => this.add('DELETE', handler));
    return this;
  }

  patch(...handlers) {
    handlers.forEach(handler => this.add('PATCH', handler));
    return this;
  }

  head(...handlers) {
    handlers.forEach(handler => this.add('HEAD', handler));
    return this;
  }

  options(...handlers) {
    handlers.forEach(handler => this.add('OPTIONS', handler));
    return this;
  }

  all(...handlers) {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    handlers.forEach(handler => {
      methods.forEach(method => {
        this.add(method, handler);
      });
    });
    return this;
  }

  add(method, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    if (!this.methods[method]) {
      this.methods[method] = true;
    }

    const layer = {
      method,
      handler,
      name: handler.name || '<anonymous>'
    };

    this.stack.push(layer);
    return this;
  }

  handles_method(method) {
    if (this.methods._all) {
      return true;
    }

    // Method'lar büyük harfle kaydediliyor, bu yüzden büyük harfe çevir
    const name = method.toUpperCase();
    
    if (name === 'HEAD' && !this.methods.HEAD) {
      return this.methods.GET;
    }

    return Boolean(this.methods[name]);
  }

  async dispatch(ctx, done) {
    let layerIndex = 0;
    
    const next = async (error) => {
      if (error) {
        return done(error);
      }

      if (layerIndex >= this.stack.length) {
        return done();
      }

      const layer = this.stack[layerIndex++];
      
      if (layer.method && layer.method !== ctx.method) {
        return next();
      }

      try {
        const result = layer.handler(ctx, next);
        if (result && typeof result.then === 'function') {
          await result;
        }
      } catch (err) {
        return next(err);
      }
    };

    await next();
  }

  toString() {
    return this.path;
  }
}

module.exports = Route;