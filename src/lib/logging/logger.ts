/**
 * Structured Logger
 * =================
 *
 * Structured logging with context support and multiple transports.
 * Designed for cloud-native environments with JSON output.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp */
  timestamp: string;
  /** Service name */
  service: string;
  /** Additional context */
  context?: Record<string, any>;
  /** Error details */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  /** Request/trace context */
  trace?: {
    requestId?: string;
    correlationId?: string;
    orgId?: string;
    userId?: string;
  };
}

export interface LoggerConfig {
  /** Service name */
  service: string;
  /** Minimum log level */
  level: LogLevel;
  /** Output format */
  format: 'json' | 'pretty';
  /** Additional default context */
  defaultContext?: Record<string, any>;
}

export interface Transport {
  log(entry: LogEntry): void | Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const COLORS = {
  debug: '\x1b[36m',  // Cyan
  info: '\x1b[32m',   // Green
  warn: '\x1b[33m',   // Yellow
  error: '\x1b[31m',  // Red
  fatal: '\x1b[35m',  // Magenta
  reset: '\x1b[0m',
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

export class Logger {
  private config: LoggerConfig;
  private transports: Transport[] = [];
  private childContext?: Record<string, any>;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      service: config.service || process.env.SERVICE_NAME || 'campotech',
      level: config.level || (process.env.LOG_LEVEL as LogLevel) || 'info',
      format: config.format || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
      defaultContext: config.defaultContext,
    };

    // Add default console transport
    this.transports.push(this.createConsoleTransport());
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * Log at info level
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Log at error level
   */
  error(message: string, errorOrContext?: Error | Record<string, any>, context?: Record<string, any>): void {
    if (errorOrContext instanceof Error) {
      this.log('error', message, context, errorOrContext);
    } else {
      this.log('error', message, errorOrContext);
    }
  }

  /**
   * Log at fatal level
   */
  fatal(message: string, errorOrContext?: Error | Record<string, any>, context?: Record<string, any>): void {
    if (errorOrContext instanceof Error) {
      this.log('fatal', message, context, errorOrContext);
    } else {
      this.log('fatal', message, errorOrContext);
    }
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.childContext = { ...this.childContext, ...context };
    childLogger.transports = this.transports;
    return childLogger;
  }

  /**
   * Add a transport
   */
  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  /**
   * Core log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    // Check if level should be logged
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.config.service,
    };

    // Merge contexts
    const mergedContext = {
      ...this.config.defaultContext,
      ...this.childContext,
      ...context,
    };

    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }

    // Add error details
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    // Add trace context if available
    const trace = this.getTraceContext(context);
    if (trace) {
      entry.trace = trace;
    }

    // Send to transports
    for (const transport of this.transports) {
      try {
        transport.log(entry);
      } catch (err) {
        console.error('Transport error:', err);
      }
    }
  }

  /**
   * Extract trace context
   */
  private getTraceContext(context?: Record<string, any>): LogEntry['trace'] | undefined {
    const trace: LogEntry['trace'] = {};

    if (context?.requestId) trace.requestId = context.requestId;
    if (context?.correlationId) trace.correlationId = context.correlationId;
    if (context?.orgId) trace.orgId = context.orgId;
    if (context?.userId) trace.userId = context.userId;

    return Object.keys(trace).length > 0 ? trace : undefined;
  }

  /**
   * Create console transport
   */
  private createConsoleTransport(): Transport {
    return {
      log: (entry: LogEntry) => {
        if (this.config.format === 'json') {
          console.log(JSON.stringify(entry));
        } else {
          this.prettyPrint(entry);
        }
      },
    };
  }

  /**
   * Pretty print log entry
   */
  private prettyPrint(entry: LogEntry): void {
    const color = COLORS[entry.level];
    const reset = COLORS.reset;

    const time = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase().padEnd(5);

    let output = `${color}[${time}] ${level}${reset} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = Object.entries(entry.context)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' ');
      output += ` ${contextStr}`;
    }

    console.log(output);

    if (entry.error?.stack) {
      console.log(`${COLORS.error}${entry.error.stack}${reset}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create file transport (appends to file)
 */
export function createFileTransport(filePath: string): Transport {
  const fs = require('fs');

  return {
    log: (entry: LogEntry) => {
      fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
    },
  };
}

/**
 * Create buffered transport (batches logs)
 */
export function createBufferedTransport(
  onFlush: (entries: LogEntry[]) => void | Promise<void>,
  options: { maxSize?: number; flushInterval?: number } = {}
): Transport {
  const { maxSize = 100, flushInterval = 5000 } = options;
  let buffer: LogEntry[] = [];

  const flush = async () => {
    if (buffer.length > 0) {
      const entries = buffer;
      buffer = [];
      await onFlush(entries);
    }
  };

  // Periodic flush
  setInterval(flush, flushInterval);

  return {
    log: async (entry: LogEntry) => {
      buffer.push(entry);
      if (buffer.length >= maxSize) {
        await flush();
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let logger: Logger | null = null;

/**
 * Initialize the global logger
 */
export function initializeLogger(config?: Partial<LoggerConfig>): void {
  logger = new Logger(config);
}

/**
 * Get the global logger
 */
export function getLogger(): Logger {
  if (!logger) {
    // Auto-initialize with defaults
    logger = new Logger();
  }
  return logger;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const log = {
  debug: (message: string, context?: Record<string, any>) => getLogger().debug(message, context),
  info: (message: string, context?: Record<string, any>) => getLogger().info(message, context),
  warn: (message: string, context?: Record<string, any>) => getLogger().warn(message, context),
  error: (message: string, errorOrContext?: Error | Record<string, any>, context?: Record<string, any>) =>
    getLogger().error(message, errorOrContext, context),
  fatal: (message: string, errorOrContext?: Error | Record<string, any>, context?: Record<string, any>) =>
    getLogger().fatal(message, errorOrContext, context),
};
