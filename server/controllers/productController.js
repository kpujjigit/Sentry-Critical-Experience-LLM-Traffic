const llmService = require('../services/llmService');
const scrapingService = require('../services/scrapingService');
const { simulateDelay, simulateError } = require('../utils/demoUtils');

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
  
  try {
    // Validate URL
    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        code: 'MISSING_URL'
      });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
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
      return res.status(400).json({
        error: 'Unsupported store',
        code: 'UNSUPPORTED_STORE',
        supportedStores: SUPPORTED_STORES.map(s => s.name)
      });
    }

    // Simulate artificial delays for demo purposes
    await simulateDelay('initial_processing');
    
    // Simulate potential errors for demo
    simulateError('scraping_failure', 0.1); // 10% chance of error

    // Step 1: Scrape the product page
    console.log(`Starting product analysis for: ${url}`);
    const scrapingStartTime = Date.now();
    
    const rawProductData = await scrapingService.scrapeProductPage(url);
    const scrapingDuration = Date.now() - scrapingStartTime;
    
    // Step 2: Use LLM to parse and structure the data
    const llmStartTime = Date.now();
    await simulateDelay('llm_processing');
    
    const structuredData = await llmService.parseProductData(rawProductData, url);
    const llmDuration = Date.now() - llmStartTime;

    const totalDuration = Date.now() - startTime;

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
    console.error('Product analysis error:', error);
    
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
  res.json({
    stores: SUPPORTED_STORES,
    total: SUPPORTED_STORES.length
  });
};

module.exports = {
  analyzeProduct,
  getSupportedStores
};