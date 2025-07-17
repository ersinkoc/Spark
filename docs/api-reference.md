# API Reference

This document provides a comprehensive reference for the Spark Framework.

## Table of Contents

- [Core](#core)
  - [Application](#application)
  - [Context](#context)
  - [Middleware](#middleware)
  - [Request](#request)
  - [Response](#response)
- [Middleware](#middleware)
  - [Body-parser](#body-parser)
  - [Cache](#cache)
  - [Compression](#compression)
  - [Cors](#cors)
  - [Health](#health)
  - [Index](#index)
  - [Logger](#logger)
  - [Metrics](#metrics)
  - [Rate-limit](#rate-limit)
  - [Security](#security)
  - [Session](#session)
  - [Static](#static)
- [Router](#router)
  - [Layer](#layer)
  - [Route](#route)
  - [Router](#router)
- [Utilities](#utilities)
  - [Async-handler](#async-handler)
  - [Cache](#cache)
  - [Context-pool](#context-pool)
  - [Error-types](#error-types)
  - [Http](#http)
  - [Regex-validator](#regex-validator)

---

## Core

### Application

**File:** `src\core\application.js`

**Exports:**

- `Application` (default)

**Functions:**

#### `shutdownHandler`

Description pending...

#### `wrappedMiddleware`

Description pending...

#### `next`

Description pending...

---

### Context

**File:** `src\core\context.js`

**Exports:**

- `Context` (default)

---

### Middleware

**File:** `src\core\middleware.js`

**Functions:**

#### `createMiddleware`

Description pending...

#### `dispatch`

Description pending...

---

### Request

**File:** `src\core\request.js`

**Exports:**

- `Request` (default)

**Functions:**

#### `parseRange`

Description pending...

---

### Response

**File:** `src\core\response.js`

**Exports:**

- `Response` (default)

---

## Middleware

### Body-parser

**File:** `src\middleware\body-parser.js`

**Exports:**

- `json` (named)
- `urlencoded` (named)
- `text` (named)
- `raw` (named)

**Functions:**

#### `bodyParser`

Description pending...

#### `shouldParseJson`

Description pending...

#### `shouldParseUrlencoded`

Description pending...

#### `shouldParseMultipart`

Description pending...

#### `shouldParseText`

Description pending...

#### `shouldParseRaw`

Description pending...

#### `parseJson`

Description pending...

#### `parseUrlencoded`

Description pending...

#### `parseMultipart`

Description pending...

#### `parseText`

Description pending...

#### `parseRaw`

Description pending...

#### `readBody`

Description pending...

#### `getBoundary`

Description pending...

#### `parseMultipartData`

Description pending...

#### `json`

Description pending...

#### `urlencoded`

Description pending...

#### `text`

Description pending...

#### `raw`

Description pending...

#### `onData`

Description pending...

#### `onEnd`

Description pending...

#### `onError`

Description pending...

#### `onData`

Description pending...

#### `onEnd`

Description pending...

#### `onError`

Description pending...

#### `onData`

Description pending...

#### `onEnd`

Description pending...

#### `onError`

Description pending...

---

### Cache

**File:** `src\middleware\cache.js`

**Exports:**

- `cache` (default)

**Functions:**

#### `cache`

Description pending...

#### `cacheMiddleware`

Description pending...

#### `defaultKeyGenerator`

Description pending...

#### `defaultCondition`

Description pending...

#### `filterHeaders`

Description pending...

---

### Compression

**File:** `src\middleware\compression.js`

**Exports:**

- `gzip` (named)
- `deflate` (named)
- `brotli` (named)

**Functions:**

#### `compression`

Description pending...

#### `compressResponse`

Description pending...

#### `shouldCompress`

Description pending...

#### `getPreferredEncoding`

Description pending...

#### `parseAcceptEncoding`

Description pending...

#### `compressBuffer`

Description pending...

#### `gzipCompression`

Description pending...

#### `deflateCompression`

Description pending...

#### `brotliCompression`

Description pending...

---

### Cors

**File:** `src\middleware\cors.js`

**Exports:**

- `cors` (default)

**Functions:**

#### `cors`

Description pending...

#### `getOrigin`

Description pending...

#### `handlePreflight`

Description pending...

---

### Health

**File:** `src\middleware\health.js`

**Exports:**

- `createCustomCheck` (named)

**Functions:**

#### `healthCheck`

Description pending...

#### `performHealthChecks`

Description pending...

#### `formatUptime`

Description pending...

#### `createCustomCheck`

Description pending...

---

### Index

**File:** `src\middleware\index.js`

---

### Logger

**File:** `src\middleware\logger.js`

**Exports:**

- `Logger` (named)
- `morgan` (named)
- `accessLog` (named)
- `devLogger` (named)
- `errorLogger` (named)
- `requestLogger` (named)
- `structuredLogger` (named)

**Functions:**

#### `logger`

Description pending...

#### `morgan`

Description pending...

#### `accessLog`

Description pending...

#### `devLogger`

Description pending...

#### `errorLogger`

Description pending...

#### `requestLogger`

Description pending...

#### `structuredLogger`

Description pending...

#### `DEFAULT_SKIP`

Description pending...

#### `colorStatus`

Description pending...

#### `colorMethod`

Description pending...

---

### Metrics

**File:** `src\middleware\metrics.js`

**Exports:**

- `createCollector` (named)
- `getGlobalCollector` (named)
- `MetricsCollector` (named)

**Functions:**

#### `metrics`

Description pending...

#### `createCollector`

Description pending...

#### `getGlobalCollector`

Description pending...

#### `middleware`

Description pending...

---

### Rate-limit

**File:** `src\middleware\rate-limit.js`

**Exports:**

- `slowDown` (named)
- `tokenBucket` (named)
- `MemoryStore` (named)

**Functions:**

#### `rateLimit`

Description pending...

#### `defaultKeyGenerator`

Description pending...

#### `defaultHandler`

Description pending...

#### `slowDown`

Description pending...

#### `tokenBucket`

Description pending...

#### `middleware`

Description pending...

#### `middleware`

Description pending...

#### `middleware`

Description pending...

---

### Security

**File:** `src\middleware\security.js`

**Exports:**

- `csrf` (named)
- `csrfToken` (named)
- `xssProtection` (named)
- `requestSizeLimit` (named)

**Functions:**

#### `security`

Description pending...

#### `setContentSecurityPolicy`

Description pending...

#### `setFrameguard`

Description pending...

#### `setHSTS`

Description pending...

#### `setReferrerPolicy`

Description pending...

#### `csrf`

Description pending...

#### `generateSecret`

Description pending...

#### `generateToken`

Description pending...

#### `verifyToken`

Description pending...

#### `getSecret`

Description pending...

#### `getTokenFromRequest`

Description pending...

#### `csrfToken`

Description pending...

#### `xssProtection`

Description pending...

#### `escapeHtml`

Description pending...

#### `escapeJsonValues`

Description pending...

#### `requestSizeLimit`

Description pending...

#### `throwMissingCsrfSecretError`

Description pending...

---

### Session

**File:** `src\middleware\session.js`

**Exports:**

- `MemoryStore` (named)
- `FileStore` (named)

**Functions:**

#### `session`

Description pending...

#### `getSessionId`

Description pending...

#### `createSessionProxy`

Description pending...

#### `saveSession`

Description pending...

#### `generateSessionId`

Description pending...

#### `signCookie`

Description pending...

#### `unsignCookie`

Description pending...

#### `throwMissingSecretError`

Description pending...

---

### Static

**File:** `src\middleware\static.js`

**Exports:**

- `serveStatic` (named)

**Functions:**

#### `staticFiles`

Description pending...

#### `handleDirectory`

Description pending...

#### `tryExtensions`

Description pending...

#### `sendFile`

Description pending...

#### `sendRangeFile`

Description pending...

#### `parseRange`

Description pending...

#### `getContentType`

Description pending...

#### `generateETag`

Description pending...

#### `serveStatic`

Description pending...

---

## Router

### Layer

**File:** `src\router\layer.js`

**Exports:**

- `Layer` (default)

**Functions:**

#### `decodeParam`

Description pending...

---

### Route

**File:** `src\router\route.js`

**Exports:**

- `Route` (default)

**Functions:**

#### `next`

Description pending...

---

### Router

**File:** `src\router\router.js`

**Exports:**

- `Router` (default)

**Functions:**

#### `routerMiddleware`

Description pending...

#### `routerMiddleware`

Description pending...

#### `getFlags`

Description pending...

#### `nextLayer`

Description pending...

---

## Utilities

### Async-handler

**File:** `src\utils\async-handler.js`

**Functions:**

#### `asyncHandler`

Description pending...

#### `wrapAsync`

Description pending...

#### `errorHandler`

Description pending...

#### `handleErrorResponse`

Description pending...

#### `createError`

Description pending...

---

### Cache

**File:** `src\utils\cache.js`

**Functions:**

#### `createCache`

Description pending...

#### `memoize`

Description pending...

#### `asyncMemoize`

Description pending...

---

### Context-pool

**File:** `src\utils\context-pool.js`

**Exports:**

- `ContextPool` (default)

---

### Error-types

**File:** `src\utils\error-types.js`

---

### Http

**File:** `src\utils\http.js`

**Functions:**

#### `isHttpError`

Description pending...

#### `isClientError`

Description pending...

#### `isServerError`

Description pending...

#### `isRedirect`

Description pending...

#### `isSuccess`

Description pending...

#### `isInformational`

Description pending...

#### `getStatusText`

Description pending...

#### `getMimeType`

Description pending...

#### `parseContentType`

Description pending...

#### `parseAccept`

Description pending...

#### `parseRange`

Description pending...

#### `parseAuthorizationHeader`

Description pending...

#### `parseUserAgent`

Description pending...

#### `createError`

Description pending...

#### `isValidMethod`

Description pending...

#### `parseQuery`

Description pending...

#### `stringifyQuery`

Description pending...

#### `parseUrl`

Description pending...

#### `formatUrl`

Description pending...

---

### Regex-validator

**File:** `src\utils\regex-validator.js`

---

