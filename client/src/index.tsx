import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
import reportWebVitals from './reportWebVitals';

// Initialize Sentry - simplified for compatibility
Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || 'development',
  release: process.env.REACT_APP_SENTRY_RELEASE || '1.0.0',
  debug: process.env.REACT_APP_SENTRY_DEBUG === 'true',
  
  // Performance monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions for demo
  
  integrations: [
    // Enable automatic browser tracing
    Sentry.browserTracingIntegration(),
    // Enable Session Replay for debugging  
    Sentry.replayIntegration({
      maskAllText: false, // For demo purposes
      blockAllMedia: false, // For demo purposes
      replaysSessionSampleRate: 1.0, // Capture 100% of sessions for demo
      replaysOnErrorSampleRate: 1.0, // Capture 100% of error sessions
    }),
  ],
  
  beforeSend(event) {
    // Add demo tags
    event.tags = {
      ...event.tags,
      demo_app: 'llm_traffic',
      component: 'frontend'
    };
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

// Basic Web Vitals reporting
reportWebVitals((metric) => {
  console.log('Web Vital:', metric);
  
  // Basic Sentry breadcrumb
  Sentry.addBreadcrumb({
    category: 'web-vitals',
    message: `${metric.name}: ${metric.value}`,
    level: 'info',
    data: metric
  });
});
