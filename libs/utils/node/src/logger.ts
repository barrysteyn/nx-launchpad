import { SeverityNumber, logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: process.env.SERVICE_NAME || 'app',
});

const processor = process.env.BETTERSTACK_TOKEN
  ? new SimpleLogRecordProcessor(
      new OTLPLogExporter({
        url: 'https://in-otel.logs.betterstack.com',
        headers: { Authorization: `Bearer ${process.env.BETTERSTACK_TOKEN}` },
      }),
    )
  : new SimpleLogRecordProcessor(new ConsoleLogRecordExporter());

const provider = new LoggerProvider({ resource, processors: [processor] });

logs.setGlobalLoggerProvider(provider);

const SEVERITY = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
} as const;

type AttrValue = string | number | boolean | string[] | number[] | boolean[];
type Attrs = Record<string, AttrValue>;
type LogArg = string | Attrs | unknown;

class Logger {
  private otelLogger = provider.getLogger('app');
  private bindings: Attrs;

  constructor(bindings: Attrs = {}) {
    this.bindings = bindings;
  }

  private emit(level: keyof typeof SEVERITY, msgOrAttrs: LogArg, msg?: string) {
    const [body, attrs] =
      typeof msgOrAttrs === 'string'
        ? [msgOrAttrs, {} as Attrs]
        : typeof msgOrAttrs === 'object' && msgOrAttrs !== null && !Array.isArray(msgOrAttrs)
          ? [msg ?? '', msgOrAttrs as Attrs]
          : [String(msgOrAttrs), {} as Attrs];

    this.otelLogger.emit({
      severityNumber: SEVERITY[level],
      severityText: level.toUpperCase(),
      body,
      attributes: { ...this.bindings, ...attrs },
    });
  }

  debug(m: LogArg, s?: string) { this.emit('debug', m, s); }
  info(m: LogArg, s?: string) { this.emit('info', m, s); }
  warn(m: LogArg, s?: string) { this.emit('warn', m, s); }
  error(m: LogArg, s?: string) { this.emit('error', m, s); }

  child(bindings: Attrs): Logger {
    return new Logger({ ...this.bindings, ...bindings });
  }
}

export const logger = new Logger();

export const flushLogger = () => provider.forceFlush();
