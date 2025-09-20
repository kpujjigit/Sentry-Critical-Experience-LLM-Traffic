const axios = require('axios');
const cheerio = require('cheerio');
const { simulateDelay, simulateError } = require('../utils/demoUtils');
const { Sentry, createSpan, finishSpan } = require('../middleware/sentry');

// Mock product data for demo purposes (since actual scraping would be complex)
const MOCK_PRODUCT_DATA = {
  'amazon.com': {
    title: 'Wireless Noise-Cancelling Headphones',
    price: '$199.99',
    originalPrice: '$249.99',
    rating: '4.3',
    reviewCount: '2,847',
    availability: 'In Stock',
    shipping: 'FREE delivery',
    imageUrl: 'https://via.placeholder.com/400x400',
    description: 'Premium wireless headphones with active noise cancellation',
    features: ['Active Noise Cancellation', 'Wireless', '30-hour battery', 'Fast charging'],
    category: 'Electronics > Audio'
  },
  'walmart.com': {
    title: 'Smart TV 55-inch 4K Ultra HD',
    price: '$449.00',
    originalPrice: '$599.00',
    rating: '4.2',
    reviewCount: '1,523',
    availability: 'In Stock',
    shipping: 'FREE 2-day shipping',
    imageUrl: 'https://via.placeholder.com/400x400',
    description: '55-inch Smart TV with 4K Ultra HD resolution',
    features: ['4K Ultra HD', 'Smart TV', 'HDR support', 'Multiple HDMI ports'],
    category: 'Electronics > TVs'
  },
  'target.com': {
    title: 'Organic Cotton Bedding Set',
    price: '$89.99',
    originalPrice: '$119.99',
    rating: '4.6',
    reviewCount: '892',
    availability: 'In Stock',
    shipping: 'FREE shipping on orders $35+',
    imageUrl: 'https://via.placeholder.com/400x400',
    description: '100% organic cotton bedding set with pillowcases',
    features: ['100% Organic Cotton', 'Machine Washable', 'Hypoallergenic', 'Soft texture'],
    category: 'Home > Bedding'
  }
};

const scrapeProductPage = async (url) => {
  const startTime = Date.now();
  
  // Get current transaction for creating child spans
  const transaction = Sentry.getCurrentHub().getScope().getTransaction();
  
  try {
    // Create main scraping span
    const scrapingSpan = createSpan(transaction, {
      op: 'scraping.page',
      description: `Scrape product page: ${url}`
    });
    
    if (scrapingSpan) {
      scrapingSpan.setTag('scraping_url', url);
      scrapingSpan.setTag('scraping_method', 'mock_data'); // For demo purposes
    }

    // Simulate scraping delay
    await simulateDelay('web_scraping', 500, 2000);
    
    // Simulate occasional scraping failures for demo
    simulateError('scraping_failure', 0.08); // 8% failure rate

    console.log(`🕷️ Scraping product from: ${url}`);
    
    // Determine which mock data to use based on URL
    let mockData;
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname.toLowerCase();
    
    if (domain.includes('amazon')) {
      mockData = MOCK_PRODUCT_DATA['amazon.com'];
    } else if (domain.includes('walmart')) {
      mockData = MOCK_PRODUCT_DATA['walmart.com'];
    } else if (domain.includes('target')) {
      mockData = MOCK_PRODUCT_DATA['target.com'];
    } else {
      // Default fallback data
      mockData = {
        ...MOCK_PRODUCT_DATA['amazon.com'],
        title: 'Generic Product',
        price: '$' + (Math.random() * 500 + 50).toFixed(2),
        rating: (Math.random() * 2 + 3).toFixed(1),
        reviewCount: Math.floor(Math.random() * 5000 + 100).toLocaleString()
      };
    }

    // Add some variability to the data
    const priceVariation = (Math.random() - 0.5) * 0.2; // ±10% price variation
    const basePrice = parseFloat(mockData.price.replace('$', ''));
    const newPrice = basePrice * (1 + priceVariation);
    
    const scrapedData = {
      ...mockData,
      price: '$' + newPrice.toFixed(2),
      rawHtml: `<html><body>Mock HTML content for ${url}</body></html>`,
      scrapingMetadata: {
        url: url,
        scrapedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        success: true,
        userAgent: 'Demo-Scraper/1.0'
      }
    };

    // Add validation span
    const validationSpan = createSpan(transaction, {
      op: 'scraping.validation',
      description: 'Validate scraped data completeness'
    });
    
    const requiredFields = ['title', 'price', 'rating', 'availability'];
    const missingFields = requiredFields.filter(field => !scrapedData[field]);
    
    finishSpan(validationSpan, {
      required_fields: requiredFields.length,
      missing_fields: missingFields.length,
      validation_success: missingFields.length === 0
    });

    finishSpan(scrapingSpan, {
      scraping_duration_ms: Date.now() - startTime,
      product_title: scrapedData.title,
      product_price: newPrice,
      data_completeness_score: ((requiredFields.length - missingFields.length) / requiredFields.length * 100),
      scraping_success: true
    });

    // Add breadcrumb for successful scraping
    Sentry.addBreadcrumb({
      message: `Successfully scraped product: ${scrapedData.title}`,
      category: 'scraping',
      level: 'info',
      data: {
        url: url,
        productTitle: scrapedData.title,
        duration: Date.now() - startTime,
        dataFields: Object.keys(scrapedData).length
      }
    });

    console.log(`✅ Successfully scraped product: ${scrapedData.title}`);
    return scrapedData;

  } catch (error) {
    console.error('❌ Scraping failed:', error);
    
    const scrapingDuration = Date.now() - startTime;
    
    // Capture scraping error in Sentry
    Sentry.captureException(error, {
      tags: {
        error_type: 'scraping_failed',
        scraping_stage: 'page_fetch',
        target_url: url
      },
      extra: {
        url: url,
        scraping_duration_ms: scrapingDuration,
        error_details: error.message
      },
      level: 'error'
    });
    
    const scrapingError = new Error('Failed to scrape product page');
    scrapingError.code = 'SCRAPING_FAILED';
    scrapingError.originalError = error;
    scrapingError.duration = scrapingDuration;
    scrapingError.url = url;
    
    throw scrapingError;
  }
};

const validateUrl = (url) => {
  const transaction = Sentry.getCurrentHub().getScope().getTransaction();
  
  try {
    const parsedUrl = new URL(url);
    
    // Check if it's a supported ecommerce site
    const supportedDomains = [
      'amazon.com', 'amazon.co.uk', 'amazon.de',
      'ebay.com', 'walmart.com', 'target.com', 
      'bestbuy.com', 'homedepot.com', 'lowes.com',
      'etsy.com', 'shopify.com', 'aliexpress.com'
    ];
    
    const isSupported = supportedDomains.some(domain => 
      parsedUrl.hostname.includes(domain)
    );
    
    // Add validation breadcrumb
    Sentry.addBreadcrumb({
      message: `URL validation: ${url}`,
      category: 'validation',
      level: isSupported ? 'info' : 'warning',
      data: {
        url: url,
        domain: parsedUrl.hostname,
        protocol: parsedUrl.protocol,
        supported: isSupported
      }
    });
    
    if (transaction) {
      transaction.setTag('url_valid', true);
      transaction.setTag('url_supported', isSupported);
      transaction.setTag('url_domain', parsedUrl.hostname);
    }
    
    return {
      valid: true,
      supported: isSupported,
      domain: parsedUrl.hostname,
      protocol: parsedUrl.protocol
    };
  } catch (error) {
    // Capture URL validation error
    Sentry.captureException(error, {
      tags: {
        error_type: 'url_validation_failed',
        invalid_url: url
      },
      extra: {
        attempted_url: url,
        error_details: error.message
      },
      level: 'warning'
    });
    
    if (transaction) {
      transaction.setTag('url_valid', false);
    }
    
    return {
      valid: false,
      supported: false,
      error: error.message
    };
  }
};

module.exports = {
  scrapeProductPage,
  validateUrl
};