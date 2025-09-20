# Sentry Trace Explorer & Dashboards Guide

## Critical User Workflows Identification

Based on our LLM Traffic demo application, we've identified these critical user experiences that should be monitored:

### 1. Product Analysis Journey
**User Flow**: User pastes URL → System scrapes product → LLM processes data → Results displayed
**Pain Points**: Slow scraping, LLM timeouts, parsing failures
**Business Impact**: Core feature - failures directly affect user satisfaction

### 2. Simulation Performance
**User Flow**: User configures simulation → System generates traffic → Real-time statistics displayed  
**Pain Points**: Simulation failures, poor response times affecting demo quality
**Business Impact**: Demo effectiveness - affects sales and customer confidence

### 3. User Interface Responsiveness  
**User Flow**: User interacts with chat → System responds → Results rendered
**Pain Points**: Slow UI rendering, network delays, interaction lag
**Business Impact**: User experience - affects engagement and retention

---

## Trace Explorer Queries "Brain-Dead" Checklist

### Step 1: Identify Your Span Operation
```
span.op:[operation_name]
```
**Examples from our app:**
- `span.op:product.analyze` - Main product analysis
- `span.op:llm.inference` - LLM processing  
- `span.op:scraping.fetch` - Web scraping
- `span.op:simulation.session` - User session simulation

### Step 2: Add Time Filter
```
span.op:[operation] AND timestamp:>=2024-01-01T00:00:00
```

### Step 3: Filter by Success/Failure
```
span.op:[operation] AND tags.analysis_success:true
span.op:[operation] AND tags.analysis_success:false  
```

### Step 4: Add Store/Category Filters
```
span.op:product.analyze AND tags.store_name:Amazon
span.op:product.analyze AND tags.product_category:"Electronics > Audio"
```

### Step 5: Filter by Performance Thresholds
```
span.op:product.analyze AND span.data.total_duration_ms:>5000
span.op:llm.inference AND span.data.confidence_score:<0.7
```

### Step 6: Add User Behavior Context
```
span.op:simulation.session AND tags.user_behavior:"Thorough Researcher"
span.op:simulation.request AND tags.request_success:false
```

### Step 7: Combine Multiple Conditions
```
span.op:product.analyze AND tags.store_name:Amazon AND span.data.total_duration_ms:>3000 AND tags.analysis_success:true
```

---

## Dashboard 1: LLM Performance Monitoring

### Purpose
Monitor the health and performance of LLM operations to ensure consistent product analysis quality.

### Key Widgets

#### 1. LLM Processing Time (Time Series)
```
Query: span.op:llm.inference
Aggregation: p95(span.data.llm_processing_time_ms)
Group By: tags.store_name
Time Window: Last 24 hours
```

#### 2. LLM Confidence Score Distribution
```
Query: span.op:llm.inference
Aggregation: avg(span.data.confidence_score)
Group By: tags.store_name
Display: Bar Chart
```

#### 3. LLM Success Rate
```
Query: span.op:llm.inference
Aggregation: count_if(tags.llm_success:true) / count()
Group By: hour
Display: Line Chart with target line at 95%
```

#### 4. Token Usage Analysis
```
Query: span.op:llm.inference
Aggregation: avg(span.data.token_count)
Group By: tags.product_category
Display: Table
```

#### 5. LLM Error Breakdown
```
Query: span.op:llm.inference AND tags.llm_success:false
Aggregation: count()
Group By: tags.error_type
Display: Pie Chart
```

---

## Dashboard 2: User Experience & Business Metrics

### Purpose
Track end-to-end user experience and key business metrics affecting customer satisfaction.

### Key Widgets

#### 1. Product Analysis Success Rate by Store
```
Query: span.op:product.analyze
Aggregation: count_if(tags.analysis_success:true) / count() * 100
Group By: tags.store_name
Display: Bar Chart with 95% target line
```

#### 2. End-to-End Response Time Trends
```
Query: span.op:product.analyze
Aggregation: p95(span.data.total_duration_ms)
Group By: hour
Display: Line Chart
```

#### 3. Product Value Scores
```
Query: span.op:product.analyze AND tags.analysis_success:true
Aggregation: avg(span.data.product_price), avg(span.data.product_rating)
Group By: tags.store_name
Display: Scatter Plot (Price vs Rating)
```

#### 4. User Behavior Impact
```
Query: span.op:simulation.session
Aggregation: avg(span.data.session_duration_ms)
Group By: tags.user_behavior
Display: Bar Chart
```

#### 5. Critical Errors Timeline
```
Query: (span.op:scraping.fetch AND tags.scraping_success:false) OR (span.op:llm.inference AND tags.error_type:"llm_timeout")
Aggregation: count()
Group By: time(1h)
Display: Time Series with annotations
```

---

## 4 Span Metric Alerts for Real-Time Monitoring

### Alert 1: High LLM Processing Latency
```
Name: LLM Processing Too Slow
Dataset: Spans  
Query: span.op:llm.inference
Aggregation: p95(span.data.llm_processing_time_ms)
Threshold: > 5000ms for 5 minutes
Group By: tags.store_name
Notification: Slack + Email
```
**Why**: Slow LLM processing directly impacts user experience and demo effectiveness.

### Alert 2: Product Analysis Failure Rate Spike  
```
Name: Product Analysis Failures
Dataset: Spans
Query: span.op:product.analyze
Aggregation: count_if(tags.analysis_success:false) / count() * 100
Threshold: > 15% for 10 minutes  
Notification: PagerDuty
```
**Why**: High failure rates indicate system issues affecting core functionality.

### Alert 3: Low LLM Confidence Scores
```
Name: Poor LLM Analysis Quality
Dataset: Spans
Query: span.op:llm.inference
Aggregation: avg(span.data.confidence_score)  
Threshold: < 0.6 for 15 minutes
Group By: tags.store_name
Notification: Email
```
**Why**: Low confidence scores indicate poor analysis quality affecting user trust.

### Alert 4: Simulation Performance Degradation
```
Name: Demo Simulation Issues
Dataset: Spans
Query: span.op:simulation.session
Aggregation: count_if(tags.session_completed:false) / count() * 100
Threshold: > 25% for 5 minutes
Notification: Slack
```
**Why**: Simulation failures affect demo quality and sales presentations.

---

## Advanced Query Examples

### Find Slow Operations by Store
```
span.op:product.analyze AND span.data.total_duration_ms:>10000
```

### Identify Problematic Product Categories  
```
span.op:llm.inference AND tags.llm_success:false AND span.data.confidence_score:<0.5
```

### Track User Journey Success
```
(span.op:scraping.fetch AND tags.scraping_success:true) AND (span.op:llm.inference AND tags.llm_success:true) AND (span.op:product.analyze AND tags.analysis_success:true)
```

### Monitor Business Hours Performance
```
span.op:product.analyze AND timestamp:>=2024-01-01T09:00:00 AND timestamp:<=2024-01-01T17:00:00
```

This guide provides the foundation for creating meaningful Sentry dashboards and alerts that directly tie to business value and user experience.