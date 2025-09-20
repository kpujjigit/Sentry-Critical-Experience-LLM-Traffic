# E-commerce AI Assistant - Sentry LLM Monitoring Demo

A comprehensive web-based chatbot that analyzes product listings from major e-commerce platforms using AI, with deep Sentry integration for monitoring LLM traffic, performance, and user experience.

## Purpose

Demonstrate how to instrument AI/LLM applications with rich telemetry that powers dashboards and alerts in Sentry for critical user experience monitoring.

## Key Span Operations

- **product.analyze** - Complete product analysis workflow
- **scraping.fetch** - E-commerce site data extraction  
- **llm.inference** - AI/LLM processing and analysis
- **llm.parsing** - Data structuring and validation
- **simulation.session** - Realistic user behavior simulation
- **ui.action.user** - Frontend user interactions

## Important Attributes and Data

**Tags**: store_name, product_category, user_behavior, analysis_success, llm_success, simulation_id
**Data (span.data.*)**: total_duration_ms, llm_processing_time_ms, confidence_score, product_price, product_rating, token_count, scraping_duration_ms

![Application Screenshot](https://github.com/user-attachments/assets/75eb949f-a0c3-4bb6-b81a-c90482f15ab7)

## Problem Scenarios for Demos

The application includes several intentional pain points perfect for demonstrating Sentry's monitoring capabilities:

- **Network Latency**: Variable 500ms-4000ms delays simulating real LLM API calls
- **Scraping Failures**: 8% failure rate for web scraping operations
- **LLM Timeouts**: 12% chance of LLM processing timeouts
- **Rate Limiting**: 5% chance of API rate limiting errors
- **Variable Performance**: Different response times based on store complexity

## Local Setup

### Prerequisites
- Node.js 18+ and npm
- A Sentry project DSN (optional for basic functionality)

### Quick Start

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd Sentry-Critical-Experience-LLM-Traffic
   npm run install:all
   ```

2. **Configure Sentry (Optional)**
   ```bash
   cp .env.example .env
   # Edit .env and set your Sentry DSN
   ```

3. **Start the application**
   ```bash
   npm run dev
   ```
   
   This starts both backend (port 3001) and frontend (port 3000)

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

## Generate Demo Data (Traffic Simulator)

1. **In the web application**, use the Traffic Simulator panel on the right side
2. **Configure simulation settings**:
   - **Number of Sessions**: 50-200 recommended for dashboard visibility
   - **Delay Between Sessions**: 1000ms for realistic pacing
3. **Click "Start Simulation"** to begin generating traffic
4. **Monitor in real-time** via the live statistics panel

The simulator emits:
- `product.analyze` spans with complete analysis workflow
- `scraping.fetch` spans with store-specific scraping performance
- `llm.inference` spans with processing times, confidence scores, and token usage
- `simulation.session` spans with user behavior patterns
- `ui.action.user` spans for frontend interactions

**Pro Tip**: Use different session counts and monitor the performance impact in Sentry dashboards.

## Supported E-commerce Platforms

The application supports product analysis from 10 major platforms:
- **Amazon** - Electronics, books, household items
- **Walmart** - TVs, appliances, groceries  
- **Target** - Home goods, clothing, electronics
- **Best Buy** - Electronics, gaming, appliances
- **eBay** - Collectibles, electronics, parts
- **Etsy** - Handmade, vintage, craft supplies
- **Home Depot** - Tools, home improvement, garden
- **Lowes** - Home improvement, appliances, paint
- **Shopify** - Various merchant stores
- **AliExpress** - International electronics, accessories

## Architecture & Monitoring

### Frontend (React + TypeScript)
- **Session Replay** for complete user interaction recording
- **Web Vitals** monitoring (LCP, FID, FCP, TTFB)
- **User Interaction Tracking** for button clicks, form submissions
- **Network Request Monitoring** with response times and error rates
- **Real-time Error Boundary** with automatic Sentry reporting

### Backend (Node.js + Express)  
- **Distributed Tracing** across all API endpoints
- **Custom LLM Monitoring** with inference time and confidence tracking
- **Performance Profiling** with CPU and memory analysis
- **Structured Logging** with contextual breadcrumbs
- **Error Tracking** with detailed stack traces and context

### AI/LLM Operations
- **Token Usage Tracking** for cost monitoring
- **Model Performance Metrics** including confidence scores
- **Processing Time Analysis** for performance optimization
- **Failure Rate Monitoring** for reliability insights

## Sentry: Custom Dashboard & Alert Ideas

### Essential Custom Dashboards

#### 1. **LLM Performance Dashboard**
- **LLM Processing Time (p95)** - Monitor AI response performance
  - Query: `span.op:llm.inference` → p95(span.data.llm_processing_time_ms) by `tags.store_name`
- **Confidence Score Trends** - Track analysis quality over time
  - Query: `span.op:llm.inference` → avg(span.data.confidence_score) by hour
- **Token Usage Analysis** - Monitor LLM costs and efficiency
  - Query: `span.op:llm.inference` → sum(span.data.token_count) by `tags.product_category`

#### 2. **User Experience Dashboard**  
- **End-to-End Analysis Time** - Complete user journey performance
  - Query: `span.op:product.analyze` → p95(span.data.total_duration_ms) by `tags.store_name`
- **Success Rate by Store** - Business reliability metrics
  - Query: `span.op:product.analyze` → count_if(tags.analysis_success:true) / count() by `tags.store_name`
- **Simulation Health** - Demo environment monitoring
  - Query: `span.op:simulation.session` → count_if(tags.session_completed:true) / count()

### Critical Span Alerts

#### 1. **LLM Processing Latency Alert**
- **Purpose**: Detect when AI processing becomes too slow for good UX
- **Query**: `span.op:llm.inference`
- **Metric**: p95(span.data.llm_processing_time_ms) > 5000ms for 5 minutes
- **Business Impact**: Slow AI responses frustrate users and hurt conversion

#### 2. **Product Analysis Failure Rate Alert**  
- **Purpose**: Monitor core functionality health
- **Query**: `span.op:product.analyze`
- **Metric**: count_if(tags.analysis_success:false) / count() > 15% for 10 minutes
- **Business Impact**: High failure rates directly affect user satisfaction

#### 3. **LLM Confidence Score Alert**
- **Purpose**: Ensure AI analysis quality remains high
- **Query**: `span.op:llm.inference`  
- **Metric**: avg(span.data.confidence_score) < 0.6 for 15 minutes
- **Business Impact**: Low confidence affects user trust in recommendations

#### 4. **Demo Simulation Alert**
- **Purpose**: Ensure demo environment performs well for sales
- **Query**: `span.op:simulation.session`
- **Metric**: count_if(tags.session_completed:false) / count() > 25% for 5 minutes  
- **Business Impact**: Failed demos hurt sales and customer confidence

## Advanced Features

### Intelligent Product Analysis
- **Price Trend Analysis** - 7-day price history with recommendations
- **Value Score Calculation** - Composite score based on price, rating, and reviews
- **Feature Extraction** - Key product features and specifications
- **Shipping Analysis** - Cost and speed evaluation
- **Review Sentiment** - Rating distribution and authenticity indicators

### Realistic User Simulation
- **Multiple Behavior Patterns**: Quick Browser, Thorough Researcher, Casual User, Impatient User
- **Varied Session Lengths** - Different engagement patterns per user type  
- **Retry Logic Simulation** - Realistic error handling and persistence
- **Load Testing** - Generate realistic traffic patterns for performance testing

### Demo-Optimized Monitoring
- **Real-time Statistics** - Live traffic and performance metrics
- **Error Injection** - Configurable failure rates for demonstration
- **Performance Variability** - Time-based performance characteristics
- **Context-Rich Errors** - Detailed error information for debugging

## API Endpoints

### Product Analysis
```bash
# Analyze a product URL
POST /api/analyze
{
  "url": "https://www.amazon.com/dp/B08N5WRWNW"
}

# Get supported stores
GET /api/supported-stores

# Get sample URLs for testing  
GET /api/demo/sample-urls
```

### Traffic Simulation
```bash
# Start traffic simulation
POST /api/simulate/start
{
  "sessions": 100,
  "delay": 1000  
}

# Stop simulation
POST /api/simulate/stop

# Get simulation status
GET /api/simulate/status
```

## Troubleshooting

### Common Issues

**Application won't start**
- Ensure Node.js 18+ is installed
- Run `npm run install:all` to install all dependencies
- Check that ports 3000 and 3001 are available

**Sentry data not appearing**
- Verify SENTRY_DSN is set correctly in your .env file
- Check that your Sentry project has the correct permissions
- Ensure your Sentry plan supports the features you're using

**Simulation not generating data**
- Check browser console for JavaScript errors
- Verify backend is running on port 3001
- Check network connectivity between frontend and backend

**Performance issues during simulation**
- Reduce the number of concurrent sessions
- Increase delay between session starts
- Monitor system resources (CPU, memory)

### Development Tips

**Viewing Sentry Data**
- Set `debug: true` in Sentry configuration
- Check browser console and server logs for Sentry events
- Use Sentry's Debug mode to verify data transmission

**Customizing Demo Scenarios**
- Edit `server/utils/demoUtils.js` to adjust error rates and delays
- Modify `server/services/scrapingService.js` for different product data
- Update `server/services/simulatorService.js` for new user behaviors

## What's Included

- **Complete Full-Stack Application** - React frontend + Node.js backend
- **AI/LLM Integration** - Product analysis using language models
- **Comprehensive Sentry Integration** - All major Sentry features implemented
- **Realistic Traffic Simulation** - Multiple user behavior patterns
- **Rich Demo Data** - Perfect for showcasing Sentry capabilities
- **Performance Pain Points** - Intentional issues for alerting demonstrations
- **Business Metrics** - KPIs tied to user experience and revenue

## License

Demo project for showcasing Sentry's LLM monitoring capabilities. Adapt freely for your use cases.