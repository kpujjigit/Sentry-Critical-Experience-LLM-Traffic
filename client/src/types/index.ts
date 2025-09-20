// Types for product analysis
export interface ProductAnalysis {
  basic_info: {
    title: string;
    current_price: number;
    original_price: number;
    discount_percent: string;
    availability: string;
    category: string;
  };
  reviews: {
    average_rating: number;
    total_reviews: number;
    rating_distribution: {
      [key: string]: number;
    };
  };
  shipping: {
    is_free: boolean;
    is_fast: boolean;
    description: string;
    estimated_days: number;
  };
  price_analysis: {
    current_price: number;
    price_trend_7d: number[];
    lowest_price_7d: number;
    highest_price_7d: number;
    is_good_deal: boolean;
  };
  features: string[];
  value_metrics: {
    overall_score: number;
    discount_score: number;
    rating_score: number;
    popularity_score: number;
    recommendation: string;
  };
  extracted_at: string;
  llm_metadata: {
    model_used: string;
    processing_time_ms: number;
    timestamp: string;
    confidence_score: number;
    token_count: number;
  };
  store: string;
  url: string;
  analysis_metadata: {
    scraping_duration_ms: number;
    llm_processing_duration_ms: number;
    total_duration_ms: number;
    timestamp: string;
  };
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface AnalyzeResponse extends ApiResponse<ProductAnalysis> {}

export interface Store {
  name: string;
  domain: string;
  supported: boolean;
}

export interface StoresResponse extends ApiResponse<{ stores: Store[]; total: number }> {}

// Simulation types
export interface SimulationRequest {
  sessions: number;
  delay: number;
}

export interface SimulationStatus {
  isRunning: boolean;
  simulationId?: string;
  startTime?: string;
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  statistics?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    errorBreakdown: { [key: string]: number };
  };
}

// Message types for chat
export interface ChatMessage {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: Date;
  data?: ProductAnalysis;
  error?: boolean;
  loading?: boolean;
}

// Component props
export interface ChatInputProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

export interface ProductCardProps {
  product: ProductAnalysis;
  onClose?: () => void;
}

export interface SimulatorControlsProps {
  onStart: (sessions: number, delay: number) => void;
  onStop: () => void;
  status: SimulationStatus;
  disabled?: boolean;
}