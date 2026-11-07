/**
 * Logging strategy (Phase 1 foundation).
 *
 * - Structured JSON output so logs are parseable by any log aggregator later
 *   (e.g. CloudWatch, Datadog) without changing call sites.
 * - Human-readable output in development.
 * - Every log line carries a `module` so it's traceable back to the service
 *   / route that produced it, and an optional `context` object for extra
 *   fields (userId, requestId, productId, etc.) — never log secrets/PII
 *   like passwords or full card numbers here.
 * - Levels follow standard severity ordering; LOG_LEVEL env var filters output.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function shouldLog(level) {
  return LEVELS[level] >= currentLevel;
}

function write(level, moduleName, message, context = {}) {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module: moduleName,
    message,
    ...context,
  };

  const line =
    process.env.NODE_ENV === "production"
      ? JSON.stringify(entry)
      : `[${entry.timestamp}] ${level.toUpperCase().padEnd(5)} (${moduleName}) ${message}${
          Object.keys(context).length ? " " + JSON.stringify(context) : ""
        }`;

  const consoleMethod = level === "debug" ? "log" : level;
  // eslint-disable-next-line no-console
  console[consoleMethod](line);
}

/**
 * Creates a logger scoped to a module (route, service, etc.).
 *
 * @example
 * const log = createLogger("services/product-service");
 * log.info("Product created", { productId });
 */
export function createLogger(moduleName) {
  return {
    debug: (message, context) => write("debug", moduleName, message, context),
    info: (message, context) => write("info", moduleName, message, context),
    warn: (message, context) => write("warn", moduleName, message, context),
    error: (message, context) => write("error", moduleName, message, context),
  };
}

export const logger = createLogger("app");
