// Utility functions for creating realistic demo conditions with artificial delays and errors

/**
 * Simulate network delays and processing time for demo purposes
 * @param {string} operation - Name of the operation being delayed
 * @param {number} minMs - Minimum delay in milliseconds
 * @param {number} maxMs - Maximum delay in milliseconds
 */
const simulateDelay = async (operation, minMs = 500, maxMs = 2000) => {
  const baseDelay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  
  // Add extra delay based on environment settings
  const artificialLatency = parseInt(process.env.ARTIFICIAL_LATENCY_MS) || 0;
  const totalDelay = baseDelay + artificialLatency;
  
  console.log(`Simulating ${operation} delay: ${totalDelay}ms`);
  
  return new Promise(resolve => {
    setTimeout(resolve, totalDelay);
  });
};

/**
 * Simulate random errors for demo purposes
 * @param {string} errorType - Type of error to simulate
 * @param {number} probability - Probability of error (0.0 to 1.0)
 */
const simulateError = (errorType, probability = 0.1) => {
  const random = Math.random();
  const errorRate = parseFloat(process.env.ERROR_RATE_PERCENT) / 100 || 0.1;
  
  if (random < probability * errorRate) {
    const error = createDemoError(errorType);
    console.log(`Simulating ${errorType} error:`, error.message);
    throw error;
  }
};

/**
 * Create specific demo errors with realistic error codes and messages
 * @param {string} errorType - Type of error to create
 */
const createDemoError = (errorType) => {
  const errors = {
    scraping_failure: {
      message: 'Failed to scrape product page - connection timeout',
      code: 'SCRAPING_FAILED',
      statusCode: 502
    },
    llm_timeout: {
      message: 'LLM processing timed out after 30 seconds',
      code: 'LLM_TIMEOUT', 
      statusCode: 504
    },
    rate_limited: {
      message: 'Rate limit exceeded - too many requests',
      code: 'RATE_LIMITED',
      statusCode: 429
    },
    parsing_error: {
      message: 'Failed to parse product information from page content',
      code: 'PARSING_FAILED',
      statusCode: 422
    },
    network_error: {
      message: 'Network connection failed',
      code: 'NETWORK_ERROR',
      statusCode: 503
    },
    authentication_error: {
      message: 'API authentication failed',
      code: 'AUTH_FAILED',
      statusCode: 401
    }
  };

  const errorConfig = errors[errorType] || errors.network_error;
  const error = new Error(errorConfig.message);
  error.code = errorConfig.code;
  error.statusCode = errorConfig.statusCode;
  error.isSimulated = true;
  error.timestamp = new Date().toISOString();
  
  return error;
};

/**
 * Simulate network latency for different types of operations
 * @param {string} operationType - Type of operation (scraping, llm_inference, etc.)
 */
const getOperationLatency = (operationType) => {
  const latencyProfiles = {
    web_scraping: { min: 800, max: 3000 },
    llm_inference: { min: 1500, max: 5000 },
    llm_analysis: { min: 200, max: 1000 },
    initial_processing: { min: 100, max: 500 },
    data_parsing: { min: 50, max: 300 },
    api_request: { min: 200, max: 1000 }
  };

  return latencyProfiles[operationType] || { min: 100, max: 500 };
};

/**
 * Add realistic variability to metrics for demo purposes
 * @param {number} baseValue - Base value to add variation to
 * @param {number} variationPercent - Percentage of variation (0.1 = 10%)
 */
const addVariation = (baseValue, variationPercent = 0.2) => {
  const variation = (Math.random() - 0.5) * 2 * variationPercent;
  return baseValue * (1 + variation);
};

/**
 * Simulate different performance characteristics based on time of day
 */
const getPerformanceMultiplier = () => {
  const hour = new Date().getHours();
  
  // Simulate higher latency during "peak hours" (9-17 UTC)
  if (hour >= 9 && hour <= 17) {
    return 1.3 + (Math.random() * 0.4); // 1.3x to 1.7x slower
  }
  
  // Off-peak hours
  return 0.8 + (Math.random() * 0.4); // 0.8x to 1.2x normal speed
};

/**
 * Create realistic error patterns for different scenarios
 */
const getErrorScenario = () => {
  const scenarios = [
    {
      name: 'High Traffic',
      probability: 0.15,
      errors: ['rate_limited', 'llm_timeout'],
      description: 'Increased errors due to high traffic'
    },
    {
      name: 'Network Issues', 
      probability: 0.08,
      errors: ['scraping_failure', 'network_error'],
      description: 'Network connectivity problems'
    },
    {
      name: 'Normal Operation',
      probability: 0.05,
      errors: ['parsing_error'],
      description: 'Normal background error rate'
    }
  ];

  // Select scenario based on current conditions
  const random = Math.random();
  const hour = new Date().getHours();
  
  // Higher error rates during peak hours
  if (hour >= 9 && hour <= 17) {
    return scenarios[0]; // High Traffic scenario
  } else if (random < 0.1) {
    return scenarios[1]; // Network Issues
  } else {
    return scenarios[2]; // Normal Operation
  }
};

/**
 * Log performance metrics for demo analysis
 */
const logPerformanceMetric = (operation, startTime, success = true, error = null) => {
  const duration = Date.now() - startTime;
  const logData = {
    operation,
    duration_ms: duration,
    success,
    timestamp: new Date().toISOString()
  };

  if (error) {
    logData.error_code = error.code;
    logData.error_message = error.message;
  }

  // In Phase 2, this will integrate with Sentry
  console.log('Performance Metric:', JSON.stringify(logData));
  return logData;
};

module.exports = {
  simulateDelay,
  simulateError,
  createDemoError,
  getOperationLatency,
  addVariation,
  getPerformanceMultiplier,
  getErrorScenario,
  logPerformanceMetric
};