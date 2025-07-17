declare module '@oxog/spark' {
  // Basic types without Node.js dependencies
  interface IncomingMessage {
    url?: string;
    method?: string;
    headers: Record<string, string | string[] | undefined>;
  }

  interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string | string[]): void;
    writeHead(statusCode: number, headers?: Record<string, string | string[]>): void;
    write(chunk: any): boolean;
    end(chunk?: any): void;
  }

  interface Server {
    listen(port?: number, hostname?: string, callback?: () => void): void;
    close(callback?: () => void): void;
    address(): { address: string; port: number } | null;
  }

  export interface AppOptions {
    port?: number;
    host?: string;
    cluster?: boolean;
    compression?: boolean;
    security?: {
      cors?: CorsOptions;
      rateLimit?: RateLimitOptions;
      csrf?: boolean;
    };
    https?: {
      key: string;
      cert: string;
    };
  }

  export interface Context<TState = any> {
    req: IncomingMessage;
    res: ServerResponse;
    app: Spark;
    method: string;
    url: string;
    path: string;
    query: Record<string, string | string[]>;
    params: Record<string, string>;
    headers: Record<string, string>;
    cookies: Record<string, string>;
    body: any;
    files: Record<string, UploadedFile> | null;
    session: any;
    state: TState;
    responded: boolean;
    statusCode: number;

    get(headerName: string): string | undefined;
    set(headerName: string, value: string): Context;
    setHeader(name: string, value: string): Context;
    getHeader(name: string): string | undefined;
    removeHeader(name: string): Context;
    status(code: number): Context;
    redirect(url: string, status?: number): Context;
    json(data: any): Context;
    text(data: string): Context;
    html(data: string): Context;
    send(data: any): Context;
    end(data?: any): Context;
    cookie(name: string, value: string, options?: CookieOptions): Context;
    clearCookie(name: string, options?: CookieOptions): Context;
  }

  export interface UploadedFile {
    filename: string;
    contentType: string;
    size: number;
    data: any;
  }

  export interface CookieOptions {
    maxAge?: number;
    expires?: Date;
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  }

  export type Middleware<TState = any> = (
    ctx: Context<TState>,
    next: () => Promise<void>
  ) => Promise<void> | void;

  export interface RouterOptions {
    prefix?: string;
    strict?: boolean;
    sensitive?: boolean;
  }

  export interface Route {
    method: string;
    path: string;
    middleware: Middleware[];
  }

  export class Router {
    constructor(options?: RouterOptions);
    use(...middleware: Middleware[]): Router;
    get(path: string, ...middleware: Middleware[]): Router;
    post(path: string, ...middleware: Middleware[]): Router;
    put(path: string, ...middleware: Middleware[]): Router;
    patch(path: string, ...middleware: Middleware[]): Router;
    delete(path: string, ...middleware: Middleware[]): Router;
    head(path: string, ...middleware: Middleware[]): Router;
    options(path: string, ...middleware: Middleware[]): Router;
    all(path: string, ...middleware: Middleware[]): Router;
    prefix(prefix: string): Router;
    group(prefix: string, fn: (router: Router) => void): Router;
    routes(): Middleware;
    middleware(prefix?: string): Middleware;
  }

  export class Spark {
    constructor(options?: AppOptions);
    options: AppOptions;
    server?: Server;
    listening: boolean;

    use(path?: string | Middleware, ...middleware: Middleware[]): Spark;
    get(path: string, ...middleware: Middleware[]): Spark;
    post(path: string, ...middleware: Middleware[]): Spark;
    put(path: string, ...middleware: Middleware[]): Spark;
    patch(path: string, ...middleware: Middleware[]): Spark;
    delete(path: string, ...middleware: Middleware[]): Spark;
    head(path: string, ...middleware: Middleware[]): Spark;
    options(path: string, ...middleware: Middleware[]): Spark;
    all(path: string, ...middleware: Middleware[]): Spark;

    listen(port?: number, host?: string, callback?: () => void): Promise<void>;
    close(): Promise<void>;
    handleError(error: Error, ctx?: Context): void;
    onShutdown(handler: () => Promise<void> | void): void;

    on(event: 'error', listener: (error: Error, ctx?: Context) => void): Spark;
    on(event: 'listening', listener: () => void): Spark;
    on(event: string, listener: (...args: any[]) => void): Spark;

    emit(event: 'error', error: Error, ctx?: Context): boolean;
    emit(event: 'listening'): boolean;
    emit(event: string, ...args: any[]): boolean;
  }

  // Middleware types
  export interface CorsOptions {
    origin?: boolean | string | string[] | ((ctx: Context) => string | boolean);
    credentials?: boolean;
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    maxAge?: number;
  }

  export interface RateLimitOptions {
    max?: number;
    window?: number;
    message?: string;
    keyGenerator?: (ctx: Context) => string;
    skip?: (ctx: Context) => boolean;
  }

  export interface SessionOptions {
    key?: string;
    secret: string;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  }

  export interface StaticOptions {
    root?: string;
    index?: string | string[];
    hidden?: boolean;
    extensions?: string[];
    redirect?: boolean;
    maxAge?: number;
  }

  export interface CompressionOptions {
    threshold?: number;
    level?: number;
    filter?: (ctx: Context) => boolean;
  }

  export interface BodyParserOptions {
    json?: boolean;
    urlencoded?: boolean;
    text?: boolean;
    multipart?: boolean;
    limit?: string | number;
  }

  // Middleware functions
  export function bodyParser(options?: BodyParserOptions): Middleware;
  export function cors(options?: CorsOptions): Middleware;
  export function compression(options?: CompressionOptions): Middleware;
  export function rateLimit(options?: RateLimitOptions): Middleware;
  export function session(options?: SessionOptions): Middleware;
  export function security(options?: any): Middleware;
  export function healthCheck(options?: any): Middleware;
  export function metrics(options?: any): Middleware;
  export function logger(options?: any): Middleware;

  // Alias for backward compatibility
  export const App: typeof Spark;

  // Error handling utilities
  export const errorHandling: {
    asyncHandler: (fn: Middleware) => Middleware;
    errorHandler: () => Middleware;
    createError: (status: number, message: string) => Error;
    errors: {
      badRequest: (message?: string) => Error;
      unauthorized: (message?: string) => Error;
      forbidden: (message?: string) => Error;
      notFound: (message?: string) => Error;
      conflict: (message?: string) => Error;
      tooManyRequests: (message?: string) => Error;
      internalServerError: (message?: string) => Error;
    };
  };

  // Middleware collection
  export const middleware: {
    bodyParser: typeof bodyParser;
    cors: typeof cors;
    compression: typeof compression;
    static: (root: string, options?: StaticOptions) => Middleware;
    session: typeof session;
    rateLimit: typeof rateLimit;
    security: typeof security;
    helmet: typeof security;
    healthCheck: typeof healthCheck;
    health: typeof healthCheck;
    metrics: typeof metrics;
    logger: typeof logger;
    cache: (options?: any) => Middleware;
    compress: typeof compression;
  };

  // Utility classes
  export const utils: {
    ContextPool: any;
    RegexValidator: any;
    SafeRegexCache: any;
  };
}