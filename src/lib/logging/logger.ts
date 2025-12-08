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

export interface FileTransportConfig {
  /** Base file path (without extension) */
  filePath: string;
  /** Maximum file size in bytes before rotation (default: 10MB) */
  maxSize?: number;
  /** Maximum number of rotated files to keep (default: 5) */
  maxFiles?: number;
  /** Compress rotated files (default: false) */
  compress?: boolean;
}

/**
 * Create production-ready file transport with rotation
 */
export function createFileTransport(config: string | FileTransportConfig): Transport {
  const fs = require('fs');
  const path = require('path');

  // Handle simple string config (backwards compatible)
  const options: FileTransportConfig = typeof config === 'string'
    ? { filePath: config }
    : config;

  const {
    filePath,
    maxSize = 10 * 1024 * 1024, // 10MB
    maxFiles = 5,
  } = options;

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let currentSize = 0;
  let writeStream: ReturnType<typeof fs.createWriteStream> | null = null;

  // Initialize stream
  const initStream = () => {
    if (writeStream) {
      writeStream.end();
    }
    writeStream = fs.createWriteStream(filePath, { flags: 'a' });
    try {
      const stats = fs.statSync(filePath);
      currentSize = stats.size;
    } catch {
      currentSize = 0;
    }
  };

  // Rotate log files
  const rotate = () => {
    if (writeStream) {
      writeStream.end();
      writeStream = null;
    }

    // Shift existing rotated files
    for (let i = maxFiles - 1; i >= 1; i--) {
      const oldPath = `${filePath}.${i}`;
      const newPath = `${filePath}.${i + 1}`;
      if (fs.existsSync(oldPath)) {
        if (i === maxFiles - 1) {
          fs.unlinkSync(oldPath); // Delete oldest
        } else {
          fs.renameSync(oldPath, newPath);
        }
      }
    }

    // Rotate current file
    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, `${filePath}.1`);
    }

    // Create new file
    initStream();
  };

  initStream();

  return {
    log: (entry: LogEntry) => {
      const line = JSON.stringify(entry) + '\n';
      const lineSize = Buffer.byteLength(line);

      // Check if rotation needed
      if (currentSize + lineSize > maxSize) {
        rotate();
      }

      // Write to file
      if (writeStream) {
        writeStream.write(line);
        currentSize += lineSize;
      }
    },
  };
}

/**
 * Create async file transport for high-throughput logging
 */
export function createAsyncFileTransport(config: FileTransportConfig): Transport {
  const fs = require('fs').promises;
  const path = require('path');

  const {
    filePath,
    maxSize = 10 * 1024 * 1024,
    maxFiles = 5,
  } = config;

  let buffer: string[] = [];
  let currentSize = 0;
  let isWriting = false;
  let flushTimer: NodeJS.Timeout | null = null;

  // Flush buffer to file
  const flush = async () => {
    if (buffer.length === 0 || isWriting) return;

    isWriting = true;
    const lines = buffer.join('');
    buffer = [];

    try {
      // Check if rotation needed
      try {
        const stats = await fs.stat(filePath);
        if (stats.size + Buffer.byteLength(lines) > maxSize) {
          await rotateFiles(filePath, maxFiles, fs);
          currentSize = 0;
        }
      } catch {
        // File doesn't exist, ensure directory does
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true }).catch(() => {});
      }

      await fs.appendFile(filePath, lines);
      currentSize += Buffer.byteLength(lines);
    } catch (err) {
      console.error('Failed to write to log file:', err);
    } finally {
      isWriting = false;
    }
  };

  // Schedule periodic flush
  const scheduleFlush = () => {
    if (!flushTimer) {
      flushTimer = setTimeout(async () => {
        flushTimer = null;
        await flush();
      }, 1000); // Flush every second
    }
  };

  return {
    log: (entry: LogEntry) => {
      buffer.push(JSON.stringify(entry) + '\n');
      scheduleFlush();

      // Flush immediately if buffer is large
      if (buffer.length >= 100) {
        flush();
      }
    },
  };
}

/**
 * Helper to rotate log files
 */
async function rotateFiles(filePath: string, maxFiles: number, fs: any): Promise<void> {
  // Shift existing rotated files
  for (let i = maxFiles - 1; i >= 1; i--) {
    const oldPath = `${filePath}.${i}`;
    const newPath = `${filePath}.${i + 1}`;
    try {
      if (i === maxFiles - 1) {
        await fs.unlink(oldPath).catch(() => {});
      } else {
        await fs.rename(oldPath, newPath).catch(() => {});
      }
    } catch {
      // Ignore errors
    }
  }

  // Rotate current file
  try {
    await fs.rename(filePath, `${filePath}.1`);
  } catch {
    // Ignore if file doesn't exist
  }
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
