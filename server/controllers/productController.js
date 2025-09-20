const llmService = require('../services/llmService');
const scrapingService = require('../services/scrapingService');
const { simulateDelay, simulateError, logPerformanceMetric } = require('../utils/demoUtils');
const { Sentry, createSpan, finishSpan } = require('../middleware/sentry');

const SUPPORTED_STORES = [
  { name: 'Amazon', domain: 'amazon.com', supported: true },
  { name: 'eBay', domain: 'ebay.com', supported: true },
  { name: 'Walmart', domain: 'walmart.com', supported: true },
  { name: 'Target', domain: 'target.com', supported: true },
  { name: 'Best Buy', domain: 'bestbuy.com', supported: true },
  { name: 'Home Depot', domain: 'homedepot.com', supported: true },
  { name: 'Lowes', domain: 'lowes.com', supported: true },
  { name: 'Etsy', domain: 'etsy.com', supported: true },
  { name: 'Shopify', domain: 'shopify.com', supported: true },
  { name: 'AliExpress', domain: 'aliexpress.com', supported: true }
];

const analyzeProduct = async (req, res) => {
  const startTime = Date.now();
  const { url } = req.body;
  
  // Start main Sentry transaction
  const transaction = Sentry.getCurrentHub().getScope().getTransaction();
  if (transaction) {
    transaction.setName('product.analyze');
    transaction.setTag('operation_type', 'product_analysis');
  }
  
  try {
    // Validate URL
    if (!url) {
      const error = new Error('URL is required');
      error.code = 'MISSING_URL';
      Sentry.captureException(error, {
        tags: {
          error_type: 'validation_error',
          step: 'url_validation'
        }
      });
      return res.status(400).json({
        error: 'URL is required',
        code: 'MISSING_URL'
      });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          error_type: 'url_parse_error',
          step: 'url_validation'
        },
        extra: { invalid_url: url }
      });
      return res.status(400).json({
        error: 'Invalid URL format',
        code: 'INVALID_URL'
      });
    }

    // Check if store is supported
    const store = SUPPORTED_STORES.find(s => 
      parsedUrl.hostname.includes(s.domain) || 
      parsedUrl.hostname.includes(s.domain.replace('.com', ''))
    );

    if (!store) {
      Sentry.captureMessage('Unsupported store attempted', {
        level: 'warning',
        tags: {
          store_domain: parsedUrl.hostname,
          error_type: 'unsupported_store'
        },
        extra: {
          url: url,
          supported_stores: SUPPORTED_STORES.map(s => s.name)
        }
      });
      return res.status(400).json({
        error: 'Unsupported store',
        code: 'UNSUPPORTED_STORE',
        supportedStores: SUPPORTED_STORES.map(s => s.name)
      });
    }

    // Add store context to Sentry
    Sentry.setTag('store_name', store.name);
    Sentry.setTag('store_domain', store.domain);
    Sentry.setContext('product_analysis', {
      url: url,
      store: store.name,
      domain: store.domain
    });

    // Create initial processing span
    const initSpan = createSpan(transaction, {
      op: 'product.initialize',
      description: 'Initialize product analysis'
    });
    
    await simulateDelay('initial_processing');
    simulateError('scraping_failure', 0.1); // 10% chance of error

    finishSpan(initSpan, {
      store_name: store.name,
      url_valid: true
    });

    console.log(`🔍 Starting product analysis for: ${url}`);

    // Step 1: Scrape the product page with Sentry span
    const scrapingStartTime = Date.now();
    const scrapingSpan = createSpan(transaction, {
      op: 'scraping.fetch',
      description: `Scrape product data from ${store.name}`
    });
    
    if (scrapingSpan) {
      scrapingSpan.setTag('store_name', store.name);
      scrapingSpan.setTag('scraping_target', parsedUrl.hostname);
    }
    
    const rawProductData = await scrapingService.scrapeProductPage(url);
    const scrapingDuration = Date.now() - scrapingStartTime;
    
    finishSpan(scrapingSpan, {
      scraping_duration_ms: scrapingDuration,
      product_title: rawProductData.title,
      scraping_success: true
    });

    // Step 2: Use LLM to parse and structure the data with Sentry span
    const llmStartTime = Date.now();
    const llmSpan = createSpan(transaction, {
      op: 'llm.inference',
      description: 'Process product data with LLM'
    });
    
    if (llmSpan) {
      llmSpan.setTag('llm_operation', 'product_parsing');
      llmSpan.setTag('store_name', store.name);
    }
    
    await simulateDelay('llm_processing');
    
    const structuredData = await llmService.parseProductData(rawProductData, url);
    const llmDuration = Date.now() - llmStartTime;

    finishSpan(llmSpan, {
      llm_processing_time_ms: llmDuration,
      confidence_score: structuredData.llm_metadata.confidence_score,
      token_count: structuredData.llm_metadata.token_count,
      llm_model: structuredData.llm_metadata.model_used
    });

    const totalDuration = Date.now() - startTime;

    // Add final metrics to transaction
    if (transaction) {
      transaction.setMeasurement('total_duration_ms', totalDuration);
      transaction.setMeasurement('scraping_duration_ms', scrapingDuration);
      transaction.setMeasurement('llm_duration_ms', llmDuration);
      transaction.setMeasurement('product_price', structuredData.basic_info.current_price);
      transaction.setMeasurement('product_rating', structuredData.reviews.average_rating);
      transaction.setMeasurement('confidence_score', structuredData.llm_metadata.confidence_score);
      
      transaction.setTag('product_category', structuredData.basic_info.category);
      transaction.setTag('has_discount', structuredData.price_analysis.is_good_deal);
      transaction.setTag('free_shipping', structuredData.shipping.is_free);
      transaction.setTag('analysis_success', true);
    }

    // Log performance metric
    logPerformanceMetric('product_analysis', startTime, true);

    // Response with parsed product data
    const response = {
      success: true,
      data: {
        ...structuredData,
        store: store.name,
        url: url,
        analysis_metadata: {
          scraping_duration_ms: scrapingDuration,
          llm_processing_duration_ms: llmDuration,
          total_duration_ms: totalDuration,
          timestamp: new Date().toISOString()
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Product analysis error:', error);
    
    // Capture error in Sentry with rich context
    Sentry.captureException(error, {
      tags: {
        error_type: error.code || 'analysis_failed',
        step: 'product_analysis'
      },
      extra: {
        url: url,
        duration_before_error: Date.now() - startTime,
        error_details: error.message
      },
      level: 'error'
    });
    
    // Update transaction with error status
    if (transaction) {
      transaction.setTag('analysis_success', false);
      transaction.setTag('error_type', error.code || 'analysis_failed');
      transaction.setStatus('internal_error');
    }

    // Log performance metric for failed request
    logPerformanceMetric('product_analysis', startTime, false, error);
    
    const errorResponse = {
      success: false,
      error: error.message,
      code: error.code || 'ANALYSIS_FAILED',
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    // Different status codes based on error type
    if (error.code === 'SCRAPING_FAILED') {
      return res.status(502).json(errorResponse);
    } else if (error.code === 'LLM_TIMEOUT') {
      return res.status(504).json(errorResponse);
    } else if (error.code === 'RATE_LIMITED') {
      return res.status(429).json(errorResponse);
    }
    
    res.status(500).json(errorResponse);
  }
};

const getSupportedStores = (req, res) => {
  // Simple endpoint with basic Sentry tracking
  const transaction = Sentry.getCurrentHub().getScope().getTransaction();
  if (transaction) {
    transaction.setName('stores.list');
    transaction.setTag('operation_type', 'metadata_request');
  }

  Sentry.addBreadcrumb({
    message: 'Listing supported stores',
    category: 'api',
    level: 'info'
  });

  res.json({
    stores: SUPPORTED_STORES,
    total: SUPPORTED_STORES.length
  });
};

module.exports = {
  analyzeProduct,
  getSupportedStores
};