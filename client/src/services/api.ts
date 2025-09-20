import axios, { AxiosResponse } from 'axios';
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

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor for logging and error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`API Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
    return Promise.reject(error);
  }
);

export const productAPI = {
  /**
   * Analyze a product URL using LLM
   */
  analyzeProduct: async (url: string): Promise<AnalyzeResponse> => {
    try {
      const response: AxiosResponse<AnalyzeResponse> = await api.post('/analyze', { url });
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

export default { productAPI, simulatorAPI };