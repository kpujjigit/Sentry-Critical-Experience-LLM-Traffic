const axios = require('axios');
const { simulateDelay, simulateError } = require('../utils/demoUtils');
const { Sentry, createLLMSpan, createSpan, finishSpan } = require('../middleware/sentry');

// LLM Service using Hugging Face Inference API
class LLMService {
  constructor() {
    this.apiKey = process.env.HUGGING_FACE_API_KEY;
    this.model = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct';
    this.baseUrl = 'https://api-inference.huggingface.co/models';
  }

  async parseProductData(rawProductData, url) {
    const startTime = Date.now();
    
    // Get active span/transaction for creating child spans (fallback to hub lookup)
    const transaction = (Sentry.getActiveSpan && Sentry.getActiveSpan()) || Sentry.getCurrentHub().getScope().getTransaction();
    
    try {
      console.log('Starting LLM product data parsing...');
      
      // Create main LLM span
      const llmSpan = createLLMSpan(transaction, 'inference', this.model, JSON.stringify(rawProductData));
      
      if (llmSpan) {
        llmSpan.setTag('llm_task', 'product_parsing');
        llmSpan.setTag('input_type', 'product_data');
        llmSpan.setData('input_size_bytes', JSON.stringify(rawProductData).length);
        llmSpan.setData('product_title', rawProductData.title);
      }

      // Validation step
      const validationSpan = createSpan(transaction, {
        op: 'llm.validation',
        description: 'Validate input data for LLM processing'
      });
      finishSpan(validationSpan, {
        validation_success: true,
        input_fields_count: Object.keys(rawProductData).length
      });

      // Attempt real Hugging Face call if API key present; else fallback to mock
      let structuredData;
      if (this.apiKey) {
        const hfSpan = createSpan(transaction, {
          op: 'llm.http',
          description: `Call Hugging Face ${this.model}`
        });
        const httpStart = Date.now();
        try {
          // Intentional network slowdown for demo (visible as its own span)
          const netSpan = createSpan(transaction, {
            op: 'llm.network',
            description: 'Intentional LLM network latency (demo)'
          });
          await simulateDelay('llm_network', 800, 2500);
          finishSpan(netSpan, { reason: 'demo_intentional_slowdown' });

          structuredData = await this.callHuggingFaceForProduct(rawProductData, url);
          finishSpan(hfSpan, {
            llm_http_success: true,
            llm_http_duration_ms: Date.now() - httpStart,
            model: this.model
          });
        } catch (hfError) {
          finishSpan(hfSpan, {
            llm_http_success: false,
            llm_http_duration_ms: Date.now() - httpStart,
            model: this.model,
            error_message: hfError.message
          });
          // Fallback to mock parser on error
          structuredData = await this.mockLLMParsing(rawProductData, url);
        }
      } else {
        // No key provided, use mock
        structuredData = await this.mockLLMParsing(rawProductData, url);
      }

      // Analysis span (post-processing/normalization step)
      const analysisSpan = createSpan(transaction, {
        op: 'llm.analysis',
        description: 'Analyze and structure product data'
      });
      // Occasionally add extra analysis latency (less common than network)
      try {
        const slowProb = parseFloat(process.env.LLM_SLOW_ANALYSIS_PROB || '0.25');
        if (Math.random() < slowProb) {
          const minMs = parseInt(process.env.LLM_SLOW_ANALYSIS_MIN_MS || '2000');
          const maxMs = parseInt(process.env.LLM_SLOW_ANALYSIS_MAX_MS || '6000');
          const t = Date.now();
          await simulateDelay('llm_analysis_slow', minMs, maxMs);
          if (analysisSpan) {
            analysisSpan.setTag('llm.analysis_slow', true);
            analysisSpan.setData('llm_analysis_extra_delay_ms', Date.now() - t);
          }
        }
      } catch (_) {}
      finishSpan(analysisSpan, {
        analysis_success: true,
        structured_fields: Object.keys(structuredData).length
      });
      
      const processingTime = Date.now() - startTime;
      console.log(`LLM processing completed in ${processingTime}ms`);
      
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
      console.error('LLM processing failed:', error);
      
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

  async callHuggingFaceForProduct(rawProductData, url) {
    const prompt = this.buildPrompt(rawProductData, url);
    const endpoint = `${this.baseUrl}/${encodeURIComponent(this.model)}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    const body = {
      inputs: prompt,
      parameters: {
        max_new_tokens: 600,
        temperature: 0.2,
        return_full_text: false
      }
    };

    const response = await axios.post(endpoint, body, { headers, timeout: 60000 });
    const output = Array.isArray(response.data) ? response.data[0]?.generated_text : response.data?.generated_text || '';
    if (!output || typeof output !== 'string') {
      throw new Error('Unexpected Hugging Face response');
    }

    const json = this.extractJson(output);
    return this.normalizeStructuredData(json, rawProductData);
  }

  buildPrompt(rawProductData, url) {
    const seed = {
      title: rawProductData.title,
      price: rawProductData.price,
      originalPrice: rawProductData.originalPrice,
      rating: rawProductData.rating,
      reviewCount: rawProductData.reviewCount,
      availability: rawProductData.availability,
      shipping: rawProductData.shipping,
      category: rawProductData.category,
      url
    };

    return [
      'You are an assistant that extracts e-commerce product data and returns ONLY strict JSON.',
      'Given the raw fields below, output JSON matching:',
      '{',
      '  "basic_info": { "title": string, "current_price": number, "original_price": number, "discount_percent": string, "availability": string, "category": string },',
      '  "reviews": { "average_rating": number, "total_reviews": number, "rating_distribution": {"1": number, "2": number, "3": number, "4": number, "5": number} },',
      '  "shipping": { "is_free": boolean, "is_fast": boolean, "description": string, "estimated_days": number },',
      '  "price_analysis": { "current_price": number, "price_trend_7d": number[], "lowest_price_7d": number, "highest_price_7d": number, "is_good_deal": boolean },',
      '  "features": string[],',
      '  "value_metrics": { "overall_score": number, "discount_score": number, "rating_score": number, "popularity_score": number, "recommendation": string }',
      '}',
      'Rules:',
      '- Return ONLY JSON. No comments or code fences.',
      '- Convert "$" prices to numbers; compute discount_percent as a string with one decimal and %.',
      '- Infer is_free/is_fast from shipping text; set estimated_days = 2 if fast, else 5 if free, else 7.',
      `Raw Input: ${JSON.stringify(seed)}`
    ].join('\n');
  }

  extractJson(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON found in HF output');
      return JSON.parse(match[0]);
    }
  }

  normalizeStructuredData(data, rawProductData) {
    const toNum = (v, def = 0) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
        return Number.isFinite(n) ? n : def;
      }
      return def;
    };

    const currentPrice = toNum(data?.basic_info?.current_price, toNum(rawProductData.price));
    const originalPrice = toNum(
      data?.basic_info?.original_price,
      rawProductData.originalPrice ? toNum(rawProductData.originalPrice) : currentPrice * 1.2
    );
    const priceHistory = Array.isArray(data?.price_analysis?.price_trend_7d) && data.price_analysis.price_trend_7d.length >= 3
      ? data.price_analysis.price_trend_7d.map(n => toNum(n))
      : this.generateMockPriceHistory(currentPrice, originalPrice);

    const rating = toNum(data?.reviews?.average_rating, toNum(rawProductData.rating));
    const totalReviews = toNum(
      data?.reviews?.total_reviews,
      parseInt((rawProductData.reviewCount || '0').replace(/,/g, ''))
    );

    const valueScore = this.calculateValueScore(currentPrice, originalPrice, rating, totalReviews);

    return {
      basic_info: {
        title: data?.basic_info?.title || rawProductData.title,
        current_price: currentPrice,
        original_price: originalPrice,
        discount_percent: (((originalPrice - currentPrice) / (originalPrice || 1)) * 100).toFixed(1),
        availability: data?.basic_info?.availability || rawProductData.availability,
        category: data?.basic_info?.category || rawProductData.category
      },
      reviews: {
        average_rating: rating,
        total_reviews: totalReviews,
        rating_distribution: data?.reviews?.rating_distribution || this.generateMockRatingDistribution()
      },
      shipping: data?.shipping || this.parseShippingInfo(rawProductData.shipping || ''),
      price_analysis: {
        current_price: currentPrice,
        price_trend_7d: priceHistory,
        lowest_price_7d: Math.min(...priceHistory),
        highest_price_7d: Math.max(...priceHistory),
        is_good_deal: currentPrice < originalPrice * 0.8
      },
      features: Array.isArray(data?.features) ? data.features : (rawProductData.features || []),
      value_metrics: valueScore,
      extracted_at: new Date().toISOString()
    };
  }

  // Mock LLM parsing for demo purposes
  async mockLLMParsing(rawProductData, url) {
    const transaction = (Sentry.getActiveSpan && Sentry.getActiveSpan()) || Sentry.getCurrentHub().getScope().getTransaction();
    
    // Add some processing variation to simulate real LLM behavior
    const parsingSpan = createSpan(transaction, {
      op: 'llm.parsing',
      description: 'Parse product information from raw data'
    });
    
    // Baseline parsing work
    await simulateDelay('llm_analysis', 200, 800);
    
    // Occasionally add extra parsing latency (rarer than analysis/network)
    try {
      const slowProb = parseFloat(process.env.LLM_SLOW_PARSING_PROB || '0.15');
      if (Math.random() < slowProb) {
        const minMs = parseInt(process.env.LLM_SLOW_PARSING_MIN_MS || '1500');
        const maxMs = parseInt(process.env.LLM_SLOW_PARSING_MAX_MS || '4000');
        const t = Date.now();
        await simulateDelay('llm_parsing_slow', minMs, maxMs);
        if (parsingSpan) {
          parsingSpan.setTag('llm.parsing_slow', true);
          parsingSpan.setData('llm_parsing_extra_delay_ms', Date.now() - t);
        }
      }
    } catch (_) {}
    
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