import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { SimulationStatus } from '../types';
import { simulatorAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

const SimulatorContainer = styled.div`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
`;

const SimulatorHeader = styled.div`
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
  color: white;
  padding: 1rem 1.5rem;
  font-weight: 600;
`;

const SimulatorBody = styled.div`
  padding: 1.5rem;
`;

const Section = styled.div`
  margin-bottom: 1.5rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h4`
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #4a5568;
  font-weight: 600;
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #4a5568;
  font-weight: 500;
`;

const Input = styled.input`
  width: 100%;
  border: 2px solid #e1e5e9;
  border-radius: 0.5rem;
  padding: 0.75rem;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: #764ba2;
  }

  &:disabled {
    background: #f5f5f5;
    color: #999;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  background: ${props => {
    switch (props.variant) {
      case 'danger': return '#e53e3e';
      case 'secondary': return '#a0aec0';
      default: return 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)';
    }
  }};
  
  color: white;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    background: #e2e8f0;
    color: #a0aec0;
    cursor: not-allowed;
    transform: none;
  }
`;

const StatusCard = styled.div<{ isRunning: boolean }>`
  background: ${props => props.isRunning ? '#c6f6d5' : '#edf2f7'};
  border: 1px solid ${props => props.isRunning ? '#48bb78' : '#e2e8f0'};
  border-radius: 0.5rem;
  padding: 1rem;
`;

const StatusIndicator = styled.div<{ isRunning: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const StatusDot = styled.div<{ isRunning: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.isRunning ? '#48bb78' : '#a0aec0'};
`;

const StatusText = styled.span<{ isRunning: boolean }>`
  font-weight: 600;
  color: ${props => props.isRunning ? '#22543d' : '#4a5568'};
`;

const ProgressBar = styled.div`
  background: #e2e8f0;
  border-radius: 0.25rem;
  height: 8px;
  margin: 0.5rem 0;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ percentage: number }>`
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
  height: 100%;
  width: ${props => props.percentage}%;
  transition: width 0.3s ease;
`;

const Stats = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
`;

const StatCard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.75rem;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  color: #718096;
`;

const InfoBox = styled.div`
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-top: 1rem;
`;

const InfoTitle = styled.div`
  font-weight: 600;
  color: #667eea;
  margin-bottom: 0.5rem;
`;

const InfoText = styled.div`
  font-size: 0.9rem;
  color: #4a5568;
  line-height: 1.4;
`;

const Simulator: React.FC = () => {
  const [sessions, setSessions] = useState(50);
  const [delay, setDelay] = useState(1000);
  const [status, setStatus] = useState<SimulationStatus>({ isRunning: false });
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    // Poll simulation status
    const interval = setInterval(async () => {
      const currentStatus = await simulatorAPI.getSimulationStatus();
      setStatus(currentStatus);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const response = await simulatorAPI.startSimulation({ sessions, delay });
      if (response.success) {
        setStatus({ ...status, isRunning: true });
      } else {
        console.error('Failed to start simulation:', response.error);
      }
    } catch (error) {
      console.error('Error starting simulation:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    try {
      const response = await simulatorAPI.stopSimulation();
      if (response.success) {
        setStatus({ ...status, isRunning: false });
      }
    } catch (error) {
      console.error('Error stopping simulation:', error);
    }
  };

  return (
    <SimulatorContainer>
      <SimulatorHeader>
        Traffic Simulator
      </SimulatorHeader>

      <SimulatorBody>
        <Section>
          <SectionTitle>Simulation Controls</SectionTitle>
          <FormGroup>
            <Label>Number of Sessions</Label>
            <Input
              type="number"
              min="1"
              max="1000"
              value={sessions}
              onChange={(e) => setSessions(parseInt(e.target.value) || 1)}
              disabled={status.isRunning}
            />
          </FormGroup>
          <FormGroup>
            <Label>Delay Between Sessions (ms)</Label>
            <Input
              type="number"
              min="100"
              max="10000"
              step="100"
              value={delay}
              onChange={(e) => setDelay(parseInt(e.target.value) || 1000)}
              disabled={status.isRunning}
            />
          </FormGroup>
          <ButtonGroup>
            <Button
              onClick={handleStart}
              disabled={status.isRunning || isStarting}
              variant="primary"
            >
              {isStarting ? <LoadingSpinner text="Starting..." /> : 'Start Simulation'}
            </Button>
            <Button
              onClick={handleStop}
              disabled={!status.isRunning}
              variant="danger"
            >
              Stop
            </Button>
          </ButtonGroup>
        </Section>

        <Section>
          <SectionTitle>Status</SectionTitle>
          <StatusCard isRunning={status.isRunning}>
            <StatusIndicator isRunning={status.isRunning}>
              <StatusDot isRunning={status.isRunning} />
              <StatusText isRunning={status.isRunning}>
                {status.isRunning ? 'Running' : 'Stopped'}
              </StatusText>
            </StatusIndicator>
            
            {status.progress && (
              <>
                <div>
                  {status.progress.completed} / {status.progress.total} sessions completed
                </div>
                <ProgressBar>
                  <ProgressFill percentage={status.progress.percentage} />
                </ProgressBar>
                <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>
                  {status.progress.percentage}% complete
                </div>
              </>
            )}
          </StatusCard>
        </Section>

        {status.statistics && (
          <Section>
            <SectionTitle>Live Statistics</SectionTitle>
            <Stats>
              <StatCard>
                <StatValue>{status.statistics.totalRequests}</StatValue>
                <StatLabel>Total Requests</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{status.statistics.successfulRequests}</StatValue>
                <StatLabel>Successful</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{status.statistics.failedRequests}</StatValue>
                <StatLabel>Failed</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{status.statistics.avgResponseTime}ms</StatValue>
                <StatLabel>Avg Response Time</StatLabel>
              </StatCard>
            </Stats>
          </Section>
        )}

        <InfoBox>
          <InfoTitle>About the Simulator</InfoTitle>
          <InfoText>
            This simulator creates realistic user sessions that interact with the LLM API. 
            Different user behaviors are simulated (quick browsers, thorough researchers, etc.) 
            with varying retry patterns and session lengths. The generated traffic includes 
            artificial delays and errors to demonstrate Sentry's monitoring capabilities.
          </InfoText>
        </InfoBox>
      </SimulatorBody>
    </SimulatorContainer>
  );
};

export default Simulator;