const axios = require('axios');
const { simulateDelay, simulateError } = require('../utils/demoUtils');
const { Sentry, createLLMSpan, createSpan, finishSpan } = require('../middleware/sentry');

// LLM Service using Hugging Face Inference API
class LLMService {
  constructor() {
    this.apiKey = process.env.HUGGING_FACE_API_KEY;
    this.model = 'microsoft/DialoGPT-medium'; // Free model for demo
    this.baseUrl = 'https://api-inference.huggingface.co/models';
  }

  async parseProductData(rawProductData, url) {
    const startTime = Date.now();
    
    // Get current transaction for creating child spans
    const transaction = Sentry.getCurrentHub().getScope().getTransaction();
    
    try {
      console.log('🤖 Starting LLM product data parsing...');
      
      // Create main LLM span
      const llmSpan = createLLMSpan(transaction, 'inference', this.model, JSON.stringify(rawProductData));
      
      if (llmSpan) {
        llmSpan.setTag('llm_task', 'product_parsing');
        llmSpan.setTag('input_type', 'product_data');
        llmSpan.setData('input_size_bytes', JSON.stringify(rawProductData).length);
        llmSpan.setData('product_title', rawProductData.title);
      }

      // Simulate LLM processing time and potential issues
      await simulateDelay('llm_inference', 1000, 4000);
      
      // Add processing step spans
      const validationSpan = createSpan(transaction, {
        op: 'llm.validation',
        description: 'Validate input data for LLM processing'
      });
      
      finishSpan(validationSpan, {
        validation_success: true,
        input_fields_count: Object.keys(rawProductData).length
      });
      
      // Simulate LLM API issues for demo (timeouts, rate limits)
      simulateError('llm_timeout', 0.12); // 12% chance of timeout
      simulateError('rate_limited', 0.05); // 5% chance of rate limiting
      
      // Analysis span
      const analysisSpan = createSpan(transaction, {
        op: 'llm.analysis',
        description: 'Analyze and structure product data'
      });
      
      // For demo purposes, we'll use structured parsing instead of actual LLM API
      // In a real implementation, you would send the raw HTML to the LLM for parsing
      const structuredData = await this.mockLLMParsing(rawProductData, url);
      
      finishSpan(analysisSpan, {
        analysis_success: true,
        structured_fields: Object.keys(structuredData).length
      });
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ LLM processing completed in ${processingTime}ms`);
      
      const finalData = {
        ...structuredData,
        llm_metadata: {
          model_used: this.model,
          processing_time_ms: processingTime,
          timestamp: new Date().toISOString(),
          confidence_score: Math.random() * 0.3 + 0.7, // 70-100% confidence
          token_count: Math.floor(Math.random() * 500 + 200)
        }
      };

      // Finish main LLM span with comprehensive metrics
      finishSpan(llmSpan, {
        llm_processing_time_ms: processingTime,
        confidence_score: finalData.llm_metadata.confidence_score,
        token_count: finalData.llm_metadata.token_count,
        output_size_bytes: JSON.stringify(finalData).length,
        llm_success: true
      });

      // Add breadcrumb for successful LLM processing
      Sentry.addBreadcrumb({
        message: `LLM processing completed for ${rawProductData.title}`,
        category: 'llm',
        level: 'info',
        data: {
          model: this.model,
          processingTime: processingTime,
          confidence: finalData.llm_metadata.confidence_score,
          tokenCount: finalData.llm_metadata.token_count
        }
      });
      
      return finalData;
      
    } catch (error) {
      console.error('❌ LLM processing failed:', error);
      
      const processingTime = Date.now() - startTime;
      
      // Capture LLM-specific error in Sentry
      Sentry.captureException(error, {
        tags: {
          error_type: error.code || 'llm_processing_failed',
          llm_model: this.model,
          llm_operation: 'product_parsing',
          processing_stage: 'llm_inference'
        },
        extra: {
          product_title: rawProductData.title,
          processing_time_ms: processingTime,
          model_used: this.model,
          input_size: JSON.stringify(rawProductData).length
        },
        level: 'error'
      });
      
      // Handle different types of LLM errors
      if (error.code === 'LLM_TIMEOUT') {
        throw error;
      } else if (error.code === 'RATE_LIMITED') {
        throw error;
      }
      
      const llmError = new Error('LLM processing failed');
      llmError.code = 'LLM_FAILED';
      llmError.originalError = error;
      llmError.duration = processingTime;
      throw llmError;
    }
  }

  // Mock LLM parsing for demo purposes
  async mockLLMParsing(rawProductData, url) {
    const transaction = Sentry.getCurrentHub().getScope().getTransaction();
    
    // Add some processing variation to simulate real LLM behavior
    const parsingSpan = createSpan(transaction, {
      op: 'llm.parsing',
      description: 'Parse product information from raw data'
    });
    
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

    finishSpan(parsingSpan, {
      price_extracted: currentPrice,
      rating_extracted: parseFloat(rawProductData.rating),
      features_count: rawProductData.features ? rawProductData.features.length : 0,
      value_score: valueScore.overall_score
    });
    
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