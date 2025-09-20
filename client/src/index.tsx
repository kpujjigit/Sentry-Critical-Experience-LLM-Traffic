import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
import reportWebVitals from './reportWebVitals';

// Initialize Sentry
Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || 'development',
  release: process.env.REACT_APP_SENTRY_RELEASE || '1.0.0',
  debug: process.env.REACT_APP_SENTRY_DEBUG === 'true',
  
  // Performance monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions for demo
  
  integrations: [
    // Enable automatic browser tracing
    new Sentry.BrowserTracing({
      // Capture clicks, inputs, and navigation
      tracingOrigins: ['localhost', /^\/api/],
      // Capture Web Vitals
      markLcpTransaction: true,
      markFidTransaction: true,
      markFcpTransaction: true,
      markTtfbTransaction: true,
    }),
    // Enable Session Replay for debugging
    new Sentry.Replay({
      maskAllText: false, // For demo purposes, don't mask text
      blockAllMedia: false, // For demo purposes, don't block media
      sampleRate: 1.0, // Capture 100% of sessions for demo
      errorSampleRate: 1.0, // Capture 100% of error sessions
    }),
  ],
  
  // Configure beforeSend for custom error processing
  beforeSend(event, hint) {
    // Add custom tags for demo filtering
    if (event.tags) {
      event.tags.demo_app = 'llm_traffic';
      event.tags.component = 'frontend';
    } else {
      event.tags = {
        demo_app: 'llm_traffic',
        component: 'frontend'
      };
    }
    
    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Sentry Frontend Error:', event.exception || event.message);
    }
    
    return event;
  },
  
  // Configure beforeSendTransaction for custom transaction processing
  beforeSendTransaction(event) {
    // Add custom tags for demo filtering
    if (event.tags) {
      event.tags.demo_app = 'llm_traffic';
      event.tags.component = 'frontend';
    } else {
      event.tags = {
        demo_app: 'llm_traffic',
        component: 'frontend'
      };
    }
    
    return event;
  }
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Report Web Vitals to Sentry
reportWebVitals((metric) => {
  // Send Web Vitals to Sentry
  const { name, value, delta, entries } = metric;
  
  Sentry.addBreadcrumb({
    category: 'web-vitals',
    message: `${name}: ${value}`,
    level: 'info',
    data: {
      name,
      value,
      delta,
      entries: entries.length
    }
  });
  
  // Also send as custom measurement
  const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
  if (transaction) {
    transaction.setMeasurement(name, value, 'millisecond');
  }
  
  console.log('Web Vital:', metric);
});
