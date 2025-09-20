import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { ChatMessage, ProductAnalysis } from '../types';
import { productAPI } from '../services/api';
import ProductCard from './ProductCard';
import LoadingSpinner from './LoadingSpinner';

const ChatContainer = styled.div`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 1rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 80vh;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
`;

const ChatHeader = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 1.5rem;
  font-weight: 600;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const MessageBubble = styled.div<{ $isUser: boolean; $isError?: boolean }>`
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  align-self: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  background: ${props => {
    if (props.$isError) return '#ff4757';
    return props.$isUser ? '#667eea' : '#f1f3f4';
  }};
  color: ${props => props.$isUser || props.$isError ? 'white' : '#333'};
  word-wrap: break-word;
`;

const SystemMessage = styled.div`
  text-align: center;
  color: #666;
  font-size: 0.9rem;
  font-style: italic;
  margin: 0.5rem 0;
`;

const InputContainer = styled.div`
  padding: 1rem 1.5rem;
  border-top: 1px solid #e1e5e9;
  background: white;
`;

const InputWrapper = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
`;

const UrlInput = styled.textarea`
  flex: 1;
  border: 2px solid #e1e5e9;
  border-radius: 0.5rem;
  padding: 0.75rem;
  font-size: 1rem;
  resize: vertical;
  min-height: 44px;
  max-height: 120px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #667eea;
  }

  &:disabled {
    background: #f5f5f5;
    color: #999;
  }
`;

const SendButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

const SampleUrlsContainer = styled.div`
  margin-bottom: 1rem;
`;

const SampleUrlsTitle = styled.p`
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #666;
`;

const SampleUrlsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const SampleUrlButton = styled.button`
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  color: #667eea;
  cursor: pointer;

  &:hover {
    background: rgba(102, 126, 234, 0.2);
  }
`;

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sampleUrls, setSampleUrls] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load sample URLs
    productAPI.getSampleUrls().then(urls => setSampleUrls(urls.slice(0, 3)));

    // Welcome message
    addMessage({
      type: 'system',
      content: 'Welcome! Paste any product URL from Amazon, Walmart, Target, or other supported stores to analyze pricing, reviews, and get recommendations.',
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (message: Partial<ChatMessage>) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      ...message
    } as ChatMessage;
    
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSubmit = async (url?: string) => {
    const urlToAnalyze = url || inputUrl.trim();
    
    if (!urlToAnalyze) return;

    // Add user message
    addMessage({
      type: 'user',
      content: urlToAnalyze
    });

    // Add loading message
    const loadingMessageId = Date.now().toString();
    addMessage({
      type: 'bot',
      content: 'Analyzing product... This may take a few seconds.',
      loading: true,
      id: loadingMessageId
    });

    setInputUrl('');
    setIsLoading(true);

    try {
      const response = await productAPI.analyzeProduct(urlToAnalyze);
      
      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

      if (response.success && response.data) {
        addMessage({
          type: 'bot',
          content: `Great! I found information about "${response.data.basic_info.title}". Here's the analysis:`,
          data: response.data
        });
      } else {
        addMessage({
          type: 'bot',
          content: `Sorry, I couldn't analyze that URL. ${response.error || 'Please try a different product URL.'}`,
          error: true
        });
      }
    } catch (error) {
      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
      
      addMessage({
        type: 'bot',
        content: 'Sorry, something went wrong. Please try again.',
        error: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <ChatContainer>
      <ChatHeader>
        💬 Product Analysis Chat
      </ChatHeader>
      
      <MessagesContainer>
        {messages.map((message) => (
          <div key={message.id}>
            {message.type === 'system' ? (
              <SystemMessage>{message.content}</SystemMessage>
            ) : (
              <>
                <MessageBubble 
                  $isUser={message.type === 'user'} 
                  $isError={message.error}
                >
                  {message.loading && <LoadingSpinner />}
                  {message.content}
                </MessageBubble>
                {message.data && (
                  <ProductCard 
                    product={message.data} 
                    onClose={() => {}} 
                  />
                )}
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </MessagesContainer>

      <InputContainer>
        <SampleUrlsContainer>
          <SampleUrlsTitle>Try these sample URLs:</SampleUrlsTitle>
          <SampleUrlsList>
            {sampleUrls.map((url, index) => (
              <SampleUrlButton 
                key={index} 
                onClick={() => handleSubmit(url)}
                disabled={isLoading}
              >
                {new URL(url).hostname}
              </SampleUrlButton>
            ))}
          </SampleUrlsList>
        </SampleUrlsContainer>
        
        <InputWrapper>
          <UrlInput
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Paste a product URL here (e.g., https://www.amazon.com/product/...)"
            disabled={isLoading}
          />
          <SendButton 
            onClick={() => handleSubmit()}
            disabled={isLoading || !inputUrl.trim()}
          >
            Analyze
          </SendButton>
        </InputWrapper>
      </InputContainer>
    </ChatContainer>
  );
};

export default ChatBot;