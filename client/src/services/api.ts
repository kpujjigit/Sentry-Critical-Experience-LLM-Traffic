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

// Simplified request/response interceptors for Sentry
api.interceptors.request.use((config) => {
  // Add basic breadcrumb for API request
  Sentry.addBreadcrumb({
    message: `API Request: ${config.method?.toUpperCase()} ${config.url}`,
    category: 'http',
    level: 'info'
  });
  
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Add breadcrumb for successful response
    Sentry.addBreadcrumb({
      message: `API Response: ${response.status} ${response.config.url}`,
      category: 'http',
      level: 'info'
    });
    
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    // Capture API errors
    Sentry.captureException(error, {
      tags: {
        api_endpoint: error.config?.url || 'unknown',
        error_type: 'api_request_failed'
      }
    });
    
    console.error(`API Error: ${error.response?.status || 'Network'} ${error.config?.url}`);
    return Promise.reject(error);
  }
);

export const productAPI = {
  /**
   * Analyze a product URL using LLM
   */
  analyzeProduct: async (url: string): Promise<AnalyzeResponse> => {
    // Set context for this analysis
    Sentry.setContext('product_analysis', {
      url: url,
      store: new URL(url).hostname,
      initiated_from: 'frontend'
    });

    try {
      const response: AxiosResponse<AnalyzeResponse> = await api.post('/analyze', { url });
      
      // Add success breadcrumb
      if (response.data.success && response.data.data) {
        Sentry.addBreadcrumb({
          message: `Product analyzed: ${response.data.data.basic_info.title}`,
          category: 'user.action',
          level: 'info',
          data: {
            store: response.data.data.store,
            price: response.data.data.basic_info.current_price
          }
        });
      }
      
      return response.data;
    } catch (error: any) {
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
    try {
      const response: AxiosResponse<StoresResponse> = await api.get('/supported-stores');
      return response.data;
    } catch (error: any) {
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
    try {
      const response = await api.get('/demo/sample-urls');
      return response.data;
    } catch (error) {
      console.error('Failed to load sample URLs:', error);
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
    try {
      const response = await api.post('/simulate/start', params);
      
      Sentry.addBreadcrumb({
        message: `Started simulation: ${params.sessions} sessions`,
        category: 'user.action',
        level: 'info'
      });
      
      return response.data;
    } catch (error: any) {
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
    try {
      const response = await api.post('/simulate/stop');
      
      Sentry.addBreadcrumb({
        message: 'Stopped simulation',
        category: 'user.action',
        level: 'info'
      });
      
      return response.data;
    } catch (error: any) {
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
      return {
        isRunning: false,
        statistics: undefined
      };
    }
  }
};

const apiService = { productAPI, simulatorAPI };
export default apiService;