const axios = require('axios');
const { simulateDelay, simulateError } = require('../utils/demoUtils');

// LLM Service using Hugging Face Inference API
class LLMService {
  constructor() {
    this.apiKey = process.env.HUGGING_FACE_API_KEY;
    this.model = 'microsoft/DialoGPT-medium'; // Free model for demo
    this.baseUrl = 'https://api-inference.huggingface.co/models';
  }

  async parseProductData(rawProductData, url) {
    const startTime = Date.now();
    
    try {
      console.log('Starting LLM product data parsing...');
      
      // Simulate LLM processing time and potential issues
      await simulateDelay('llm_inference', 1000, 4000);
      
      // Simulate LLM API issues for demo (timeouts, rate limits)
      simulateError('llm_timeout', 0.12); // 12% chance of timeout
      simulateError('rate_limited', 0.05); // 5% chance of rate limiting
      
      // For demo purposes, we'll use structured parsing instead of actual LLM API
      // In a real implementation, you would send the raw HTML to the LLM for parsing
      const structuredData = await this.mockLLMParsing(rawProductData, url);
      
      const processingTime = Date.now() - startTime;
      console.log(`LLM processing completed in ${processingTime}ms`);
      
      return {
        ...structuredData,
        llm_metadata: {
          model_used: this.model,
          processing_time_ms: processingTime,
          timestamp: new Date().toISOString(),
          confidence_score: Math.random() * 0.3 + 0.7, // 70-100% confidence
          token_count: Math.floor(Math.random() * 500 + 200)
        }
      };
      
    } catch (error) {
      console.error('LLM processing failed:', error);
      
      // Handle different types of LLM errors
      if (error.code === 'LLM_TIMEOUT') {
        throw error;
      } else if (error.code === 'RATE_LIMITED') {
        throw error;
      }
      
      const llmError = new Error('LLM processing failed');
      llmError.code = 'LLM_FAILED';
      llmError.originalError = error;
      llmError.duration = Date.now() - startTime;
      throw llmError;
    }
  }

  // Mock LLM parsing for demo purposes
  async mockLLMParsing(rawProductData, url) {
    // Add some processing variation to simulate real LLM behavior
    await simulateDelay('llm_analysis', 200, 800);
    
    // Extract price trend data (mock)
    const currentPrice = parseFloat(rawProductData.price.replace('$', ''));
    const originalPrice = rawProductData.originalPrice ? 
      parseFloat(rawProductData.originalPrice.replace('$', '')) : 
      currentPrice * 1.2;
      
    const priceHistory = this.generateMockPriceHistory(currentPrice, originalPrice);
    
    // Parse shipping information
    const shippingInfo = this.parseShippingInfo(rawProductData.shipping);
    
    // Calculate value metrics
    const valueScore = this.calculateValueScore(
      currentPrice, 
      originalPrice, 
      parseFloat(rawProductData.rating),
      parseInt(rawProductData.reviewCount.replace(/,/g, ''))
    );
    
    return {
      basic_info: {
        title: rawProductData.title,
        current_price: currentPrice,
        original_price: originalPrice,
        discount_percent: ((originalPrice - currentPrice) / originalPrice * 100).toFixed(1),
        availability: rawProductData.availability,
        category: rawProductData.category
      },
      reviews: {
        average_rating: parseFloat(rawProductData.rating),
        total_reviews: parseInt(rawProductData.reviewCount.replace(/,/g, '')),
        rating_distribution: this.generateMockRatingDistribution()
      },
      shipping: shippingInfo,
      price_analysis: {
        current_price: currentPrice,
        price_trend_7d: priceHistory,
        lowest_price_7d: Math.min(...priceHistory),
        highest_price_7d: Math.max(...priceHistory),
        is_good_deal: currentPrice < originalPrice * 0.8
      },
      features: rawProductData.features || [],
      value_metrics: valueScore,
      extracted_at: new Date().toISOString()
    };
  }

  parseShippingInfo(shippingText) {
    const isFree = shippingText.toLowerCase().includes('free');
    const isFast = shippingText.toLowerCase().includes('2-day') || 
                  shippingText.toLowerCase().includes('next day') ||
                  shippingText.toLowerCase().includes('same day');
    
    return {
      is_free: isFree,
      is_fast: isFast,
      description: shippingText,
      estimated_days: isFast ? 2 : (isFree ? 5 : 7)
    };
  }

  generateMockPriceHistory(currentPrice, originalPrice) {
    // Generate 7 days of mock price history
    const history = [];
    let price = originalPrice;
    
    for (let i = 6; i >= 0; i--) {
      // Simulate price fluctuations
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
      price = Math.max(price * (1 + variation), currentPrice * 0.9);
      
      if (i === 0) price = currentPrice; // Ensure current price is accurate
      
      history.push(parseFloat(price.toFixed(2)));
    }
    
    return history;
  }

  generateMockRatingDistribution() {
    // Generate realistic rating distribution
    const total = Math.floor(Math.random() * 1000 + 100);
    const weights = [0.05, 0.08, 0.12, 0.25, 0.50]; // 5-star to 1-star
    
    return {
      5: Math.floor(total * weights[4]),
      4: Math.floor(total * weights[3]),
      3: Math.floor(total * weights[2]),
      2: Math.floor(total * weights[1]),
      1: Math.floor(total * weights[0])
    };
  }

  calculateValueScore(currentPrice, originalPrice, rating, reviewCount) {
    const discountScore = Math.min((originalPrice - currentPrice) / originalPrice * 100, 50);
    const ratingScore = rating * 20; // Convert to 0-100 scale
    const popularityScore = Math.min(Math.log(reviewCount + 1) * 10, 30);
    
    const totalScore = (discountScore + ratingScore + popularityScore);
    
    return {
      overall_score: Math.round(totalScore),
      discount_score: Math.round(discountScore),
      rating_score: Math.round(ratingScore),
      popularity_score: Math.round(popularityScore),
      recommendation: totalScore > 70 ? 'Highly Recommended' : 
                     totalScore > 50 ? 'Good Value' : 'Consider Alternatives'
    };
  }
}

const llmService = new LLMService();

module.exports = {
  parseProductData: llmService.parseProductData.bind(llmService)
};