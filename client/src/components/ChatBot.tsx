import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import * as Sentry from '@sentry/react';
import { ChatMessage } from '../types';
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
    // Track component mount
    Sentry.addBreadcrumb({
      message: 'ChatBot component mounted',
      category: 'ui.lifecycle',
      level: 'info'
    });

    // Load sample URLs with Sentry tracking
    const loadSampleUrls = async () => {
      try {
        const urls = await productAPI.getSampleUrls();
        setSampleUrls(urls.slice(0, 3));
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: 'ChatBot', operation: 'load_sample_urls' }
        });
      }
    };

    loadSampleUrls();

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

    // Track user interaction with Sentry
    const transaction = Sentry.startTransaction({
      name: 'chatbot.analyze_product',
      op: 'ui.action.user',
      data: {
        input_url: urlToAnalyze,
        input_method: url ? 'sample_button' : 'manual_input',
        message_count: messages.length
      }
    });

    Sentry.setUser({
      id: `user_${Date.now()}`,
      username: 'demo_user'
    });

    Sentry.setContext('chat_session', {
      messages_count: messages.length,
      input_method: url ? 'sample_button_click' : 'manual_input',
      url_analyzed: urlToAnalyze
    });

    try {
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

      // Track the API call
      const response = await productAPI.analyzeProduct(urlToAnalyze);
      
      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));

      if (response.success && response.data) {
        addMessage({
          type: 'bot',
          content: `Great! I found information about "${response.data.basic_info.title}". Here's the analysis:`,
          data: response.data
        });

        // Track successful analysis
        transaction.setMeasurement('analysis_duration', response.data.analysis_metadata.total_duration_ms);
        transaction.setMeasurement('product_price', response.data.basic_info.current_price);
        transaction.setMeasurement('confidence_score', response.data.llm_metadata.confidence_score);
        transaction.setTag('store_name', response.data.store);
        transaction.setTag('product_category', response.data.basic_info.category);
        transaction.setTag('analysis_success', true);
        transaction.setStatus('ok');

        // Track user engagement metrics
        Sentry.addBreadcrumb({
          message: `Product analyzed: ${response.data.basic_info.title}`,
          category: 'user.action',
          level: 'info',
          data: {
            store: response.data.store,
            price: response.data.basic_info.current_price,
            rating: response.data.reviews.average_rating,
            analysisTime: response.data.analysis_metadata.total_duration_ms
          }
        });
      } else {
        addMessage({
          type: 'bot',
          content: `Sorry, I couldn't analyze that URL. ${response.error || 'Please try a different product URL.'}`,
          error: true
        });

        // Track failed analysis
        transaction.setTag('analysis_success', false);
        transaction.setTag('error_code', response.code || 'unknown');
        transaction.setStatus('internal_error');

        Sentry.captureMessage('Product analysis failed', {
          level: 'warning',
          tags: {
            component: 'ChatBot',
            error_code: response.code,
            url: urlToAnalyze
          },
          extra: {
            error_message: response.error,
            user_input: urlToAnalyze
          }
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

      // Track exception
      Sentry.captureException(error, {
        tags: {
          component: 'ChatBot',
          operation: 'product_analysis',
          url: urlToAnalyze
        }
      });

      transaction.setTag('analysis_success', false);
      transaction.setStatus('internal_error');
    } finally {
      setIsLoading(false);
      transaction.finish();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Track keyboard interaction
      Sentry.addBreadcrumb({
        message: 'User pressed Enter to submit',
        category: 'ui.input',
        level: 'info'
      });
      
      handleSubmit();
    }
  };

  const handleSampleUrlClick = (url: string) => {
    // Track sample URL click
    Sentry.addBreadcrumb({
      message: `Sample URL clicked: ${new URL(url).hostname}`,
      category: 'ui.click',
      level: 'info',
      data: {
        url: url,
        store: new URL(url).hostname
      }
    });

    handleSubmit(url);
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
                onClick={() => handleSampleUrlClick(url)}
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