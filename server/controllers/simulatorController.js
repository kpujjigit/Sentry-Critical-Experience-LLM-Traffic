const simulatorService = require('../services/simulatorService');
const { Sentry, createSpan, finishSpan } = require('../middleware/sentry');

let currentSimulation = null;

const startSimulation = async (req, res) => {
  // Start Sentry transaction for simulation
  const transaction = Sentry.getCurrentHub().getScope().getTransaction();
  if (transaction) {
    transaction.setName('simulation.start');
    transaction.setTag('operation_type', 'simulation_control');
  }

  try {
    const { sessions = 50, delay = 1000 } = req.body;
    
    if (currentSimulation && currentSimulation.isRunning) {
      Sentry.captureMessage('Simulation start attempted while already running', {
        level: 'warning',
        tags: {
          simulation_status: 'already_running',
          requested_sessions: sessions
        }
      });
      
      return res.status(400).json({
        error: 'Simulation already running',
        code: 'SIMULATION_IN_PROGRESS'
      });
    }

    // Validate parameters
    if (sessions < 1 || sessions > 1000) {
      const error = new Error('Sessions must be between 1 and 1000');
      error.code = 'INVALID_SESSIONS_COUNT';
      
      Sentry.captureException(error, {
        tags: {
          error_type: 'validation_error',
          invalid_value: sessions
        }
      });
      
      return res.status(400).json({
        error: 'Sessions must be between 1 and 1000',
        code: 'INVALID_SESSIONS_COUNT'
      });
    }

    if (delay < 100 || delay > 10000) {
      const error = new Error('Delay must be between 100ms and 10000ms');
      error.code = 'INVALID_DELAY';
      
      Sentry.captureException(error, {
        tags: {
          error_type: 'validation_error',
          invalid_value: delay
        }
      });
      
      return res.status(400).json({
        error: 'Delay must be between 100ms and 10000ms',
        code: 'INVALID_DELAY'
      });
    }

    console.log(`🎯 Starting simulation: ${sessions} sessions with ${delay}ms delay`);
    
    // Add simulation context to Sentry
    Sentry.setTag('simulation_sessions', sessions.toString());
    Sentry.setTag('simulation_delay', delay.toString());
    Sentry.setContext('simulation_config', {
      sessions: sessions,
      delay: delay,
      startTime: new Date().toISOString()
    });

    const simulationSpan = createSpan(transaction, {
      op: 'simulation.initialize',
      description: `Initialize simulation with ${sessions} sessions`
    });
    
    currentSimulation = await simulatorService.startSimulation({
      sessions,
      delay
    });

    finishSpan(simulationSpan, {
      simulation_id: currentSimulation.id,
      sessions_count: sessions,
      delay_ms: delay
    });

    // Add breadcrumb for simulation start
    Sentry.addBreadcrumb({
      message: `Started simulation with ${sessions} sessions`,
      category: 'simulation',
      level: 'info',
      data: {
        simulationId: currentSimulation.id,
        sessions: sessions,
        delay: delay
      }
    });

    res.json({
      success: true,
      simulationId: currentSimulation.id,
      sessions: sessions,
      delay: delay,
      startTime: currentSimulation.startTime,
      message: 'Simulation started'
    });

  } catch (error) {
    console.error('❌ Failed to start simulation:', error);
    
    Sentry.captureException(error, {
      tags: {
        error_type: 'simulation_start_failed',
        operation: 'start_simulation'
      },
      extra: {
        requested_sessions: req.body.sessions,
        requested_delay: req.body.delay
      }
    });
    
    res.status(500).json({
      error: 'Failed to start simulation',
      code: 'SIMULATION_START_FAILED',
      details: error.message
    });
  }
};

const stopSimulation = async (req, res) => {
  const transaction = Sentry.getCurrentHub().getScope().getTransaction();
  if (transaction) {
    transaction.setName('simulation.stop');
    transaction.setTag('operation_type', 'simulation_control');
  }

  try {
    if (!currentSimulation || !currentSimulation.isRunning) {
      Sentry.captureMessage('Stop simulation attempted when no simulation running', {
        level: 'warning',
        tags: {
          simulation_status: 'not_running'
        }
      });
      
      return res.status(400).json({
        error: 'No simulation is currently running',
        code: 'NO_SIMULATION_RUNNING'
      });
    }

    const simulationId = currentSimulation.id;
    const stopSpan = createSpan(transaction, {
      op: 'simulation.stop',
      description: `Stop simulation ${simulationId}`
    });

    const result = await simulatorService.stopSimulation(simulationId);
    
    finishSpan(stopSpan, {
      simulation_id: simulationId,
      final_statistics: result.statistics
    });

    // Add breadcrumb for simulation stop
    Sentry.addBreadcrumb({
      message: `Stopped simulation ${simulationId}`,
      category: 'simulation',
      level: 'info',
      data: {
        simulationId: simulationId,
        statistics: result.statistics
      }
    });

    currentSimulation = null;

    res.json({
      success: true,
      message: 'Simulation stopped',
      statistics: result.statistics
    });

  } catch (error) {
    console.error('❌ Failed to stop simulation:', error);
    
    Sentry.captureException(error, {
      tags: {
        error_type: 'simulation_stop_failed',
        operation: 'stop_simulation'
      }
    });
    
    res.status(500).json({
      error: 'Failed to stop simulation',
      code: 'SIMULATION_STOP_FAILED',
      details: error.message
    });
  }
};

const getSimulationStatus = (req, res) => {
  const transaction = Sentry.getCurrentHub().getScope().getTransaction();
  if (transaction) {
    transaction.setName('simulation.status');
    transaction.setTag('operation_type', 'simulation_status');
  }

  if (!currentSimulation) {
    return res.json({
      isRunning: false,
      statistics: null
    });
  }

  const status = simulatorService.getSimulationStatus(currentSimulation.id);
  
  // Add current simulation metrics to Sentry
  if (status.statistics && transaction) {
    transaction.setMeasurement('simulation_total_requests', status.statistics.totalRequests);
    transaction.setMeasurement('simulation_successful_requests', status.statistics.successfulRequests);
    transaction.setMeasurement('simulation_failed_requests', status.statistics.failedRequests);
    transaction.setMeasurement('simulation_avg_response_time', status.statistics.avgResponseTime);
  }
  
  res.json({
    isRunning: currentSimulation.isRunning,
    simulationId: currentSimulation.id,
    startTime: currentSimulation.startTime,
    ...status
  });
};

module.exports = {
  startSimulation,
  stopSimulation,
  getSimulationStatus
};