class Route {
  constructor(path) {
    this.path = path;
    this.stack = [];
    this.methods = {};
  }

  get(handler) {
    return this.add('GET', handler);
  }

  post(handler) {
    return this.add('POST', handler);
  }

  put(handler) {
    return this.add('PUT', handler);
  }

  delete(handler) {
    return this.add('DELETE', handler);
  }

  patch(handler) {
    return this.add('PATCH', handler);
  }

  head(handler) {
    return this.add('HEAD', handler);
  }

  options(handler) {
    return this.add('OPTIONS', handler);
  }

  all(handler) {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    methods.forEach(method => {
      this.add(method, handler);
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
        next(err);
      }
    };

    await next();
  }

  toString() {
    return this.path;
  }
}

module.exports = Route;