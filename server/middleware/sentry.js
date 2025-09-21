const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

// Sentry configuration and middleware
const setupSentry = (app) => {
  // Initialize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
    release: process.env.SENTRY_RELEASE || '1.0.0',
    debug: process.env.SENTRY_DEBUG === 'true',
    
    // Performance monitoring
    tracesSampleRate: 1.0, // Capture 100% of the transactions for demo
    profilesSampleRate: 1.0, // Capture 100% of profiles for demo
    
    integrations: [
      // Enable HTTP integration for automatic request tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Enable Express integration for automatic Express.js tracing
      new Sentry.Integrations.Express({ app }),
      // Enable Continuous Profiling
      new ProfilingIntegration(),
      // Enable Node.js built-in modules tracing
      new Sentry.Integrations.Modules(),
      // Enable Context Lines for better error reporting
      new Sentry.Integrations.ContextLines(),
    ],
    
    // Configure beforeSend hook for custom error processing
    beforeSend(event, hint) {
      // Add custom tags for demo filtering
      if (event.tags) {
        event.tags.demo_app = 'llm_traffic';
        event.tags.component = 'backend';
      } else {
        event.tags = {
          demo_app: 'llm_traffic',
          component: 'backend'
        };
      }
      
      // Log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Sentry Error:', event.exception || event.message);
      }
      
      return event;
    },
    
    // Configure beforeSendTransaction hook for custom transaction processing
    beforeSendTransaction(event) {
      // Add custom tags for demo filtering
      if (event.tags) {
        event.tags.demo_app = 'llm_traffic';
        event.tags.component = 'backend';
      } else {
        event.tags = {
          demo_app: 'llm_traffic',
          component: 'backend'
        };
      }
      
      return event;
    }
  });

  // RequestHandler creates a separate execution context for each incoming request
  app.use(Sentry.Handlers.requestHandler());
  
  // TracingHandler creates a transaction for each incoming request
  app.use(Sentry.Handlers.tracingHandler());

  // Custom middleware for request context enhancement
  app.use((req, res, next) => {
    // Add user context if available
    Sentry.setUser({
      ip_address: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // Add request context
    Sentry.setTag('request.method', req.method);
    Sentry.setTag('request.url', req.originalUrl);
    
    // Add custom context for simulator requests
    if (req.get('X-Simulator-Session')) {
      Sentry.setTag('simulator.session', req.get('X-Simulator-Session'));
      Sentry.setTag('simulator.behavior', req.get('X-Simulator-Behavior'));
      Sentry.setContext('simulator', {
        sessionId: req.get('X-Simulator-Session'),
        behavior: req.get('X-Simulator-Behavior'),
        isSimulated: true
      });
    }
    
    next();
  });

  console.log('Sentry initialized successfully');
  console.log(`Environment: ${process.env.SENTRY_ENVIRONMENT || 'development'}`);
  console.log(`Traces Sample Rate: 100%`);
  console.log(`Profiles Sample Rate: 100%`);
};

// Helper function to create custom spans
const createSpan = (transaction, spanData) => {
  if (!transaction) {
    console.warn('No active transaction for span:', spanData.op);
    return null;
  }
  
  const span = transaction.startChild(spanData);
  
  // Add common tags
  span.setTag('demo_app', 'llm_traffic');
  
  return span;
};

// Helper function to add LLM monitoring spans
const createLLMSpan = (transaction, operation, model, input = null) => {
  const span = createSpan(transaction, {
    op: `llm.${operation}`,
    description: `LLM ${operation} with ${model}`
  });
  
  if (span) {
    span.setTag('llm.model', model);
    span.setTag('llm.operation', operation);
    
    if (input) {
      span.setData('llm.input_length', typeof input === 'string' ? input.length : JSON.stringify(input).length);
    }
  }
  
  return span;
};

// Helper function to finish spans with metrics
const finishSpan = (span, data = {}) => {
  if (!span) return;
  
  // Add custom data/metrics
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'number') {
      // Use setData for measurements since setMeasurement may not be available on spans
      span.setData(key, value);
    } else {
      span.setData(key, value);
    }
  });
  
  span.finish();
};

// Error handler middleware (must be after all routes)
const errorHandler = () => {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Handle all errors for demo purposes
      return true;
    }
  });
};

module.exports = {
  setupSentry,
  createSpan,
  createLLMSpan,
  finishSpan,
  errorHandler,
  Sentry
};