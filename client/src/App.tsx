import React from 'react';
import styled from 'styled-components';
import ChatBot from './components/ChatBot';
import Simulator from './components/Simulator';
import Header from './components/Header';
import './App.css';

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
`;

const MainContent = styled.div`
  display: flex;
  flex: 1;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  gap: 2rem;
  padding: 2rem;

  @media (max-width: 768px) {
    flex-direction: column;
    padding: 1rem;
  }
`;

const ChatSection = styled.div`
  flex: 2;
`;

const SimulatorSection = styled.div`
  flex: 1;
  max-width: 400px;

  @media (max-width: 768px) {
    max-width: none;
  }
`;

function App() {
  return (
    <AppContainer>
      <Header />
      <MainContent>
        <ChatSection>
          <ChatBot />
        </ChatSection>
        <SimulatorSection>
          <Simulator />
        </SimulatorSection>
      </MainContent>
    </AppContainer>
  );
}

export default App;
