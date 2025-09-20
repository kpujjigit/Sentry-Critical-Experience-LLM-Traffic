const simulatorService = require('../services/simulatorService');

let currentSimulation = null;

const startSimulation = async (req, res) => {
  try {
    const { sessions = 50, delay = 1000 } = req.body;
    
    if (currentSimulation && currentSimulation.isRunning) {
      return res.status(400).json({
        error: 'Simulation already running',
        code: 'SIMULATION_IN_PROGRESS'
      });
    }

    // Validate parameters
    if (sessions < 1 || sessions > 1000) {
      return res.status(400).json({
        error: 'Sessions must be between 1 and 1000',
        code: 'INVALID_SESSIONS_COUNT'
      });
    }

    if (delay < 100 || delay > 10000) {
      return res.status(400).json({
        error: 'Delay must be between 100ms and 10000ms',
        code: 'INVALID_DELAY'
      });
    }

    console.log(`Starting simulation: ${sessions} sessions with ${delay}ms delay`);
    
    currentSimulation = await simulatorService.startSimulation({
      sessions,
      delay
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
    console.error('Failed to start simulation:', error);
    res.status(500).json({
      error: 'Failed to start simulation',
      code: 'SIMULATION_START_FAILED',
      details: error.message
    });
  }
};

const stopSimulation = async (req, res) => {
  try {
    if (!currentSimulation || !currentSimulation.isRunning) {
      return res.status(400).json({
        error: 'No simulation is currently running',
        code: 'NO_SIMULATION_RUNNING'
      });
    }

    const result = await simulatorService.stopSimulation(currentSimulation.id);
    currentSimulation = null;

    res.json({
      success: true,
      message: 'Simulation stopped',
      statistics: result.statistics
    });

  } catch (error) {
    console.error('Failed to stop simulation:', error);
    res.status(500).json({
      error: 'Failed to stop simulation',
      code: 'SIMULATION_STOP_FAILED',
      details: error.message
    });
  }
};

const getSimulationStatus = (req, res) => {
  if (!currentSimulation) {
    return res.json({
      isRunning: false,
      statistics: null
    });
  }

  const status = simulatorService.getSimulationStatus(currentSimulation.id);
  
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