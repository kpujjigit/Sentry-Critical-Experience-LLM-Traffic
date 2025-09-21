const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { Sentry, createSpan, finishSpan } = require('../middleware/sentry');

// Sample URLs for simulation
const SAMPLE_URLS = [
  'https://www.amazon.com/dp/B08N5WRWNW', // Wireless Headphones
  'https://www.amazon.com/dp/B07XJ8C8F7', // Smart Watch
  'https://www.walmart.com/ip/tv-55-4k/123456',
  'https://www.walmart.com/ip/laptop-gaming/789012',
  'https://www.target.com/p/bedding-set/-/A-123',
  'https://www.target.com/p/kitchen-appliance/-/A-456',
  'https://www.bestbuy.com/site/smartphone/12345',
  'https://www.bestbuy.com/site/tablet/67890',
  'https://www.ebay.com/itm/collectible/555666',
  'https://www.etsy.com/listing/777888/handmade-item'
];

// User behavior patterns for realistic simulation
const USER_BEHAVIORS = [
  {
    name: 'Quick Browser',
    weight: 0.3,
    sessionLength: { min: 2, max: 5 },
    requestDelay: { min: 500, max: 1500 },
    errorTolerance: 0.8 // Will retry on errors
  },
  {
    name: 'Thorough Researcher', 
    weight: 0.4,
    sessionLength: { min: 8, max: 15 },
    requestDelay: { min: 2000, max: 5000 },
    errorTolerance: 0.9 // High retry rate
  },
  {
    name: 'Casual User',
    weight: 0.2,
    sessionLength: { min: 3, max: 8 },
    requestDelay: { min: 1000, max: 3000 },
    errorTolerance: 0.6 // Medium retry rate
  },
  {
    name: 'Impatient User',
    weight: 0.1,
    sessionLength: { min: 1, max: 3 },
    requestDelay: { min: 200, max: 800 },
    errorTolerance: 0.3 // Low retry rate, gives up quickly
  }
];

class SimulatorService {
  constructor() {
    this.activeSimulations = new Map();
    this.statistics = {
      totalSessions: 0,
      completedSessions: 0,
      failedSessions: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0
    };
  }

  async startSimulation({ sessions, delay }) {
    const simulationId = uuidv4();
    const startTime = new Date();
    
    const simulation = {
      id: simulationId,
      isRunning: true,
      startTime: startTime,
      sessions: sessions,
      delay: delay,
      completed: 0,
      failed: 0,
      statistics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        sessionDurations: [],
        errorCounts: {}
      }
    };

    this.activeSimulations.set(simulationId, simulation);

    // Create Sentry transaction for the entire simulation
    const transaction = Sentry.startTransaction({
      name: 'simulation.run',
      op: 'simulation'
    });
    
    transaction.setTag('simulation_id', simulationId);
    transaction.setTag('total_sessions', sessions.toString());
    transaction.setTag('session_delay', delay.toString());
    transaction.setContext('simulation', {
      id: simulationId,
      sessions: sessions,
      delay: delay,
      startTime: startTime.toISOString()
    });

    // Start the simulation in the background
    this.runSimulation(simulation, transaction).catch(error => {
      console.error('❌ Simulation error:', error);
      simulation.isRunning = false;
      
      Sentry.captureException(error, {
        tags: {
          simulation_id: simulationId,
          error_type: 'simulation_execution_failed'
        }
      });
      
      transaction.setStatus('internal_error');
      transaction.finish();
    });

    return simulation;
  }

  async stopSimulation(simulationId) {
    const simulation = this.activeSimulations.get(simulationId);
    
    if (!simulation) {
      throw new Error('Simulation not found');
    }

    simulation.isRunning = false;
    
    const statistics = {
      duration: new Date() - simulation.startTime,
      completed: simulation.completed,
      failed: simulation.failed,
      totalRequests: simulation.statistics.totalRequests,
      successfulRequests: simulation.statistics.successfulRequests,
      failedRequests: simulation.statistics.failedRequests,
      avgResponseTime: this.calculateAvgResponseTime(simulation.statistics.responseTimes)
    };

    this.activeSimulations.delete(simulationId);
    return { statistics };
  }

  getSimulationStatus(simulationId) {
    const simulation = this.activeSimulations.get(simulationId);
    
    if (!simulation) {
      return null;
    }

    return {
      progress: {
        completed: simulation.completed,
        total: simulation.sessions,
        percentage: Math.round((simulation.completed / simulation.sessions) * 100)
      },
      statistics: {
        totalRequests: simulation.statistics.totalRequests,
        successfulRequests: simulation.statistics.successfulRequests,
        failedRequests: simulation.statistics.failedRequests,
        avgResponseTime: this.calculateAvgResponseTime(simulation.statistics.responseTimes),
        errorBreakdown: simulation.statistics.errorCounts
      }
    };
  }

  async runSimulation(simulation, transaction) {
    console.log(`Starting simulation ${simulation.id} with ${simulation.sessions} sessions`);
    
    const promises = [];
    
    // Create all user sessions
    for (let i = 0; i < simulation.sessions && simulation.isRunning; i++) {
      const sessionPromise = this.simulateUserSession(simulation, i, transaction);
      promises.push(sessionPromise);
      
      // Stagger session starts
      if (i < simulation.sessions - 1) {
        await new Promise(resolve => setTimeout(resolve, simulation.delay));
      }
    }

    // Wait for all sessions to complete
    const results = await Promise.allSettled(promises);
    
    simulation.isRunning = false;
    console.log(`Simulation ${simulation.id} completed`);

    // Add final metrics to transaction
    if (transaction) {
      transaction.setMeasurement('total_sessions', simulation.sessions);
      transaction.setMeasurement('completed_sessions', simulation.completed);
      transaction.setMeasurement('failed_sessions', simulation.failed);
      transaction.setMeasurement('total_requests', simulation.statistics.totalRequests);
      transaction.setMeasurement('successful_requests', simulation.statistics.successfulRequests);
      transaction.setMeasurement('failed_requests', simulation.statistics.failedRequests);
      transaction.setMeasurement('avg_response_time', this.calculateAvgResponseTime(simulation.statistics.responseTimes));
      
      transaction.setTag('simulation_completed', true);
      transaction.setStatus('ok');
      transaction.finish();
    }
  }

  async simulateUserSession(simulation, sessionIndex, parentTransaction) {
    const sessionStartTime = Date.now();
    const userBehavior = this.selectUserBehavior();
    const sessionId = `session_${sessionIndex}_${Date.now()}`;
    
    // Create a ROOT transaction for this session so it gets its own trace id
    const sessionTransaction = Sentry.startTransaction({
      name: 'simulation.session',
      op: 'simulation.session',
      description: `${userBehavior.name} session ${sessionIndex + 1}`
    });
    // Bind this transaction to the current scope so HTTP instrumentation propagates this trace
    try {
      Sentry.getCurrentHub().configureScope(scope => {
        scope.setSpan(sessionTransaction);
      });
    } catch (_) {}
    
    sessionTransaction.setTag('session_index', sessionIndex.toString());
    sessionTransaction.setTag('user_behavior', userBehavior.name);
    sessionTransaction.setTag('session_id', sessionId);
    
    console.log(`Starting ${userBehavior.name} session ${sessionIndex + 1}/${simulation.sessions}`);
    
    try {
      const sessionLength = Math.floor(
        Math.random() * (userBehavior.sessionLength.max - userBehavior.sessionLength.min) + 
        userBehavior.sessionLength.min
      );

      // Spans do not support setMeasurement; use setData instead
      sessionTransaction.setData('planned_requests', sessionLength);

      // Simulate user requests in this session
      for (let req = 0; req < sessionLength && simulation.isRunning; req++) {
        await this.simulateUserRequest(simulation, userBehavior, sessionId, sessionTransaction);
        
        // Wait between requests (user thinking time)
        const thinkTime = Math.floor(
          Math.random() * (userBehavior.requestDelay.max - userBehavior.requestDelay.min) + 
          userBehavior.requestDelay.min
        );
        await new Promise(resolve => setTimeout(resolve, thinkTime));
      }

      simulation.completed++;
      const sessionDuration = Date.now() - sessionStartTime;
      simulation.statistics.sessionDurations.push(sessionDuration);
      
      sessionTransaction.setData('session_duration_ms', sessionDuration);
      sessionTransaction.setTag('session_completed', true);
      sessionTransaction.setStatus('ok');
      sessionTransaction.finish();
      try { Sentry.getCurrentHub().configureScope(scope => scope.setSpan(undefined)); } catch (_) {}
      
    } catch (error) {
      console.error(`❌ Session ${sessionIndex} failed:`, error.message);
      simulation.failed++;
      
      // Track error types
      const errorType = error.code || 'UNKNOWN_ERROR';
      simulation.statistics.errorCounts[errorType] = 
        (simulation.statistics.errorCounts[errorType] || 0) + 1;

      sessionTransaction.setTag('session_completed', false);
      sessionTransaction.setTag('error_type', errorType);
      sessionTransaction.setStatus('internal_error');
      sessionTransaction.finish();
      try { Sentry.getCurrentHub().configureScope(scope => scope.setSpan(undefined)); } catch (_) {}
    }
  }

  async simulateUserRequest(simulation, userBehavior, sessionId, sessionTransaction) {
    const startTime = Date.now();
    const url = this.getRandomUrl();
    
    // Simulate basic frontend user actions to better impersonate a live user
    try {
      const pageSpan = sessionTransaction.startChild({
        op: 'ui.page.load',
        description: 'User opens app'
      });
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 200) + 100));
      pageSpan.setTag('component', 'frontend');
      pageSpan.setTag('simulated_ui', true);
      pageSpan.finish();

      const pasteSpan = sessionTransaction.startChild({
        op: 'ui.input',
        description: 'Paste product URL'
      });
      pasteSpan.setData('url', url);
      pasteSpan.setTag('component', 'frontend');
      pasteSpan.setTag('simulated_ui', true);
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 200) + 100));
      pasteSpan.finish();

      const actionOp = Math.random() < 0.5 ? 'ui.key.enter' : 'ui.click';
      const actionDesc = actionOp === 'ui.key.enter' ? 'Press Enter to analyze' : 'Click Analyze button';
      const actionSpan = sessionTransaction.startChild({ op: actionOp, description: actionDesc });
      actionSpan.setTag('component', 'frontend');
      actionSpan.setTag('simulated_ui', true);
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 150) + 75));
      actionSpan.finish();
    } catch (_) {}

    // Create request span
    const requestSpan = sessionTransaction.startChild({
      op: 'simulation.request',
      description: `Analyze product: ${new URL(url).hostname}`
    });
    
    requestSpan.setTag('request_url', url);
    requestSpan.setTag('user_behavior', userBehavior.name);
    requestSpan.setTag('target_store', new URL(url).hostname);
    
    try {
      simulation.statistics.totalRequests++;
      
      // Make actual API call to our own endpoint
      const response = await axios.post('http://localhost:3001/api/analyze', {
        url: url
      }, {
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': `Simulator-${userBehavior.name}/${sessionId}`,
          'X-Simulator-Session': sessionId,
          'X-Simulator-Behavior': userBehavior.name
        }
      });

      const responseTime = Date.now() - startTime;
      simulation.statistics.responseTimes.push(responseTime);
      simulation.statistics.successfulRequests++;
      
      // Spans do not support setMeasurement; use setData instead
      requestSpan.setData('response_time_ms', responseTime);
      requestSpan.setTag('request_success', true);
      requestSpan.setTag('response_status', response.status.toString());
      
      if (response.data.data) {
        requestSpan.setData('product_title', response.data.data.basic_info.title);
        requestSpan.setData('product_price', response.data.data.basic_info.current_price);
        requestSpan.setData('store_name', response.data.data.store);
      }
      
      requestSpan.setStatus('ok');
      requestSpan.finish();
      
      // Simulate UI rendering of results
      try {
        const renderSpan = sessionTransaction.startChild({
          op: 'ui.render',
          description: 'Render analysis results'
        });
        renderSpan.setTag('component', 'frontend');
        renderSpan.setTag('simulated_ui', true);
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 250) + 100));
        renderSpan.finish();
      } catch (_) {}

      console.log(`${userBehavior.name} analyzed ${url} in ${responseTime}ms`);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      simulation.statistics.responseTimes.push(responseTime);
      simulation.statistics.failedRequests++;
      
      requestSpan.setData('response_time_ms', responseTime);
      requestSpan.setTag('request_success', false);
      requestSpan.setTag('error_code', error.code || 'UNKNOWN_ERROR');
      requestSpan.setTag('error_message', error.message);
      requestSpan.setStatus('internal_error');
      requestSpan.finish();
      
      console.log(`${userBehavior.name} failed to analyze ${url}: ${error.message}`);
      
      // Decide whether to retry based on user behavior
      if (Math.random() < userBehavior.errorTolerance) {
        console.log(`${userBehavior.name} retrying request...`);
        // Simulate retry delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.simulateUserRequest(simulation, userBehavior, sessionId, sessionTransaction);
      }
      
      throw error;
    }
  }

  selectUserBehavior() {
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const behavior of USER_BEHAVIORS) {
      cumulativeWeight += behavior.weight;
      if (random <= cumulativeWeight) {
        return behavior;
      }
    }
    
    return USER_BEHAVIORS[0]; // Fallback
  }

  getRandomUrl() {
    return SAMPLE_URLS[Math.floor(Math.random() * SAMPLE_URLS.length)];
  }

  calculateAvgResponseTime(responseTimes) {
    if (responseTimes.length === 0) return 0;
    const sum = responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / responseTimes.length);
  }
}

const simulatorService = new SimulatorService();

module.exports = {
  startSimulation: simulatorService.startSimulation.bind(simulatorService),
  stopSimulation: simulatorService.stopSimulation.bind(simulatorService),
  getSimulationStatus: simulatorService.getSimulationStatus.bind(simulatorService)
};