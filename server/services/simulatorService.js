const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

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

    // Start the simulation in the background
    this.runSimulation(simulation).catch(error => {
      console.error('Simulation error:', error);
      simulation.isRunning = false;
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

  async runSimulation(simulation) {
    console.log(`Starting simulation ${simulation.id} with ${simulation.sessions} sessions`);
    
    const promises = [];
    
    // Create all user sessions
    for (let i = 0; i < simulation.sessions && simulation.isRunning; i++) {
      const sessionPromise = this.simulateUserSession(simulation, i);
      promises.push(sessionPromise);
      
      // Stagger session starts
      if (i < simulation.sessions - 1) {
        await new Promise(resolve => setTimeout(resolve, simulation.delay));
      }
    }

    // Wait for all sessions to complete
    await Promise.allSettled(promises);
    
    simulation.isRunning = false;
    console.log(`Simulation ${simulation.id} completed`);
  }

  async simulateUserSession(simulation, sessionIndex) {
    const sessionStartTime = Date.now();
    const userBehavior = this.selectUserBehavior();
    const sessionId = `session_${sessionIndex}_${Date.now()}`;
    
    console.log(`Starting ${userBehavior.name} session ${sessionIndex + 1}/${simulation.sessions}`);
    
    try {
      const sessionLength = Math.floor(
        Math.random() * (userBehavior.sessionLength.max - userBehavior.sessionLength.min) + 
        userBehavior.sessionLength.min
      );

      // Simulate user requests in this session
      for (let req = 0; req < sessionLength && simulation.isRunning; req++) {
        await this.simulateUserRequest(simulation, userBehavior, sessionId);
        
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
      
    } catch (error) {
      console.error(`Session ${sessionIndex} failed:`, error.message);
      simulation.failed++;
      
      // Track error types
      const errorType = error.code || 'UNKNOWN_ERROR';
      simulation.statistics.errorCounts[errorType] = 
        (simulation.statistics.errorCounts[errorType] || 0) + 1;
    }
  }

  async simulateUserRequest(simulation, userBehavior, sessionId) {
    const startTime = Date.now();
    const url = this.getRandomUrl();
    
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
      
      console.log(`✓ ${userBehavior.name} analyzed ${url} in ${responseTime}ms`);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      simulation.statistics.responseTimes.push(responseTime);
      simulation.statistics.failedRequests++;
      
      console.log(`✗ ${userBehavior.name} failed to analyze ${url}: ${error.message}`);
      
      // Decide whether to retry based on user behavior
      if (Math.random() < userBehavior.errorTolerance) {
        console.log(`${userBehavior.name} retrying request...`);
        // Simulate retry delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.simulateUserRequest(simulation, userBehavior, sessionId);
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