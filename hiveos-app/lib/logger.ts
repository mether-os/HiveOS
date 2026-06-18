export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "INFO";
const currentLevelValue = LOG_LEVELS[currentLogLevel] !== undefined ? LOG_LEVELS[currentLogLevel]! : 1;

export interface LoggerInstance {
  debug: (msg: string, meta?: Record<string, any>) => void;
  info: (msg: string, meta?: Record<string, any>) => void;
  warn: (msg: string, meta?: Record<string, any>) => void;
  error: (msg: string, meta?: Record<string, any>) => void;
  child: (bindings: Record<string, any>) => LoggerInstance;
}

function createLogger(baseMeta: Record<string, any> = {}): LoggerInstance {
  const logFn = (level: LogLevel, message: string, meta?: Record<string, any>) => {
    if (LOG_LEVELS[level]! < currentLevelValue) return;
    const logObject = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...baseMeta,
      ...meta,
    };
    // Log as a JSON line for aggregations/parsing
    console.log(JSON.stringify(logObject));
  };

  return {
    debug: (msg, meta) => logFn("DEBUG", msg, meta),
    info: (msg, meta) => logFn("INFO", msg, meta),
    warn: (msg, meta) => logFn("WARN", msg, meta),
    error: (msg, meta) => logFn("ERROR", msg, meta),
    child: (bindings) => createLogger({ ...baseMeta, ...bindings }),
  };
}

export const logger = createLogger();
