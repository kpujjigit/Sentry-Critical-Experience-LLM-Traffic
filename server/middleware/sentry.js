// Sentry configuration middleware
// Phase 2: Full Sentry integration will be implemented here

const setupSentry = (app) => {
  // Placeholder for Phase 2 Sentry setup
  console.log('Sentry setup placeholder - will be implemented in Phase 2');
  
  // For now, just add basic request logging
  app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    
    next();
  });
};

module.exports = {
  setupSentry
};