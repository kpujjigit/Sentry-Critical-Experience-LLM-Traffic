const axios = require('axios');
const cheerio = require('cheerio');
const { simulateDelay, simulateError } = require('../utils/demoUtils');

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
  
  try {
    // Simulate scraping delay
    await simulateDelay('web_scraping', 500, 2000);
    
    // Simulate occasional scraping failures for demo
    simulateError('scraping_failure', 0.08); // 8% failure rate

    console.log(`Scraping product from: ${url}`);
    
    // Determine which mock data to use based on URL
    let mockData;
    const parsedUrl = new URL(url);
    
    if (parsedUrl.hostname.includes('amazon')) {
      mockData = MOCK_PRODUCT_DATA['amazon.com'];
    } else if (parsedUrl.hostname.includes('walmart')) {
      mockData = MOCK_PRODUCT_DATA['walmart.com'];
    } else if (parsedUrl.hostname.includes('target')) {
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

    console.log(`Successfully scraped product: ${scrapedData.title}`);
    return scrapedData;

  } catch (error) {
    console.error('Scraping failed:', error);
    
    const scrapingError = new Error('Failed to scrape product page');
    scrapingError.code = 'SCRAPING_FAILED';
    scrapingError.originalError = error;
    scrapingError.duration = Date.now() - startTime;
    scrapingError.url = url;
    
    throw scrapingError;
  }
};

const validateUrl = (url) => {
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
    
    return {
      valid: true,
      supported: isSupported,
      domain: parsedUrl.hostname,
      protocol: parsedUrl.protocol
    };
  } catch (error) {
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