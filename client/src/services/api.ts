import axios, { AxiosResponse } from 'axios';
import * as Sentry from '@sentry/react';
import {
  AnalyzeResponse,
  StoresResponse,
  SimulationRequest,
  SimulationStatus,
  ApiResponse
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 second timeout for LLM requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and Sentry tracking
api.interceptors.request.use((config) => {
  const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
  
  // Create span for API request
  const span = transaction?.startChild({
    op: 'http.client',
    description: `${config.method?.toUpperCase()} ${config.url}`,
    data: {
      url: config.url,
      method: config.method,
      timeout: config.timeout
    }
  });
  
  // Add span to config so we can finish it in response interceptor
  config.metadata = { sentrySpan: span, startTime: Date.now() };
  
  // Add breadcrumb for API request
  Sentry.addBreadcrumb({
    message: `API Request: ${config.method?.toUpperCase()} ${config.url}`,
    category: 'http',
    level: 'info',
    data: {
      url: config.url,
      method: config.method
    }
  });
  
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor for logging and Sentry tracking
api.interceptors.response.use(
  (response) => {
    const { config } = response;
    const span = config.metadata?.sentrySpan;
    const duration = Date.now() - config.metadata?.startTime;
    
    if (span) {
      span.setHttpStatus(response.status);
      span.setData('response_size', JSON.stringify(response.data).length);
      span.setMeasurement('response_time_ms', duration);
      span.setTag('http_status_code', response.status.toString());
      span.setTag('api_success', true);
      span.finish();
    }
    
    // Add breadcrumb for successful response
    Sentry.addBreadcrumb({
      message: `API Response: ${response.status} ${config.url}`,
      category: 'http',
      level: 'info',
      data: {
        status: response.status,
        duration: duration,
        url: config.url
      }
    });
    
    console.log(`API Response: ${response.status} ${config.url} (${duration}ms)`);
    return response;
  },
  (error) => {
    const { config } = error;
    const span = config?.metadata?.sentrySpan;
    const duration = Date.now() - (config?.metadata?.startTime || Date.now());
    
    if (span) {
      span.setHttpStatus(error.response?.status || 0);
      span.setTag('http_status_code', error.response?.status?.toString() || 'unknown');
      span.setTag('api_success', false);
      span.setTag('error_type', error.code || 'network_error');
      span.setData('error_message', error.message);
      span.setMeasurement('response_time_ms', duration);
      span.finish();
    }
    
    // Capture API error in Sentry
    Sentry.captureException(error, {
      tags: {
        api_endpoint: config?.url || 'unknown',
        http_status: error.response?.status || 'unknown',
        error_type: 'api_request_failed'
      },
      extra: {
        url: config?.url,
        method: config?.method,
        duration: duration,
        response_data: error.response?.data
      }
    });
    
    console.error(`API Error: ${error.response?.status || 'Network'} ${config?.url}`, error.response?.data);
    return Promise.reject(error);
  }
);

export const productAPI = {
  /**
   * Analyze a product URL using LLM
   */
  analyzeProduct: async (url: string): Promise<AnalyzeResponse> => {
    // Start Sentry transaction for product analysis
    const transaction = Sentry.startTransaction({
      name: 'product.analyze.frontend',
      op: 'ui.action.user',
      data: { product_url: url }
    });
    
    // Set context for this analysis
    Sentry.setContext('product_analysis', {
      url: url,
      store: new URL(url).hostname,
      initiated_from: 'frontend'
    });
    
    transaction.setTag('operation_type', 'product_analysis');
    transaction.setTag('initiated_by', 'user_interaction');
    transaction.setTag('target_store', new URL(url).hostname);
    
    try {
      const response: AxiosResponse<AnalyzeResponse> = await api.post('/analyze', { url });
      
      // Add success metrics to transaction
      if (response.data.success && response.data.data) {
        transaction.setMeasurement('product_price', response.data.data.basic_info.current_price);
        transaction.setMeasurement('product_rating', response.data.data.reviews.average_rating);
        transaction.setMeasurement('analysis_duration', response.data.data.analysis_metadata.total_duration_ms);
        transaction.setTag('product_category', response.data.data.basic_info.category);
        transaction.setTag('store_name', response.data.data.store);
        transaction.setTag('analysis_success', true);
      }
      
      transaction.setStatus('ok');
      transaction.finish();
      
      return response.data;
    } catch (error: any) {
      transaction.setTag('analysis_success', false);
      transaction.setStatus('internal_error');
      transaction.finish();
      
      if (error.response?.data) {
        return error.response.data;
      }
      return {
        success: false,
        error: error.message || 'Network error occurred',
        code: 'NETWORK_ERROR'
      };
    }
  },

  /**
   * Get list of supported stores
   */
  getSupportedStores: async (): Promise<StoresResponse> => {
    const transaction = Sentry.startTransaction({
      name: 'stores.list.frontend',
      op: 'ui.load'
    });
    
    try {
      const response: AxiosResponse<StoresResponse> = await api.get('/supported-stores');
      
      if (response.data && 'stores' in response.data) {
        transaction.setMeasurement('stores_count', response.data.stores.length);
      }
      
      transaction.setStatus('ok');
      transaction.finish();
      
      return response.data;
    } catch (error: any) {
      transaction.setStatus('internal_error');
      transaction.finish();
      
      return {
        success: false,
        error: error.message || 'Failed to load supported stores',
        code: 'NETWORK_ERROR'
      };
    }
  },

  /**
   * Get demo sample URLs
   */
  getSampleUrls: async (): Promise<string[]> => {
    const transaction = Sentry.startTransaction({
      name: 'demo.sample_urls.frontend',
      op: 'ui.load'
    });
    
    try {
      const response = await api.get('/demo/sample-urls');
      
      transaction.setMeasurement('sample_urls_count', response.data.length);
      transaction.setStatus('ok');
      transaction.finish();
      
      return response.data;
    } catch (error) {
      console.error('Failed to load sample URLs:', error);
      
      transaction.setStatus('internal_error');
      transaction.finish();
      
      // Return fallback URLs
      return [
        'https://www.amazon.com/dp/B08N5WRWNW',
        'https://www.walmart.com/ip/tv-55-4k/123456',
        'https://www.target.com/p/bedding-set/-/A-123'
      ];
    }
  }
};

export const simulatorAPI = {
  /**
   * Start a simulation
   */
  startSimulation: async (params: SimulationRequest): Promise<ApiResponse<any>> => {
    const transaction = Sentry.startTransaction({
      name: 'simulation.start.frontend',
      op: 'ui.action.user',
      data: params
    });
    
    transaction.setTag('operation_type', 'simulation_control');
    transaction.setTag('simulation_action', 'start');
    transaction.setMeasurement('requested_sessions', params.sessions);
    transaction.setMeasurement('session_delay', params.delay);
    
    try {
      const response = await api.post('/simulate/start', params);
      
      transaction.setTag('simulation_started', true);
      transaction.setStatus('ok');
      transaction.finish();
      
      return response.data;
    } catch (error: any) {
      transaction.setTag('simulation_started', false);
      transaction.setStatus('internal_error');
      transaction.finish();
      
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        code: error.response?.data?.code || 'NETWORK_ERROR'
      };
    }
  },

  /**
   * Stop the current simulation
   */
  stopSimulation: async (): Promise<ApiResponse<any>> => {
    const transaction = Sentry.startTransaction({
      name: 'simulation.stop.frontend',
      op: 'ui.action.user'
    });
    
    transaction.setTag('operation_type', 'simulation_control');
    transaction.setTag('simulation_action', 'stop');
    
    try {
      const response = await api.post('/simulate/stop');
      
      transaction.setTag('simulation_stopped', true);
      transaction.setStatus('ok');
      transaction.finish();
      
      return response.data;
    } catch (error: any) {
      transaction.setTag('simulation_stopped', false);
      transaction.setStatus('internal_error');
      transaction.finish();
      
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        code: error.response?.data?.code || 'NETWORK_ERROR'
      };
    }
  },

  /**
   * Get simulation status
   */
  getSimulationStatus: async (): Promise<SimulationStatus> => {
    try {
      const response = await api.get('/simulate/status');
      return response.data;
    } catch (error: any) {
      // Don't create transactions for polling requests to avoid spam
      return {
        isRunning: false,
        statistics: undefined
      };
    }
  }
};

export default { productAPI, simulatorAPI };