import React from 'react';
import styled from 'styled-components';
import { ProductAnalysis } from '../types';

const CardContainer = styled.div`
  background: white;
  border-radius: 0.5rem;
  border: 1px solid #e1e5e9;
  margin: 0.5rem 0;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const CardHeader = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem;
`;

const ProductTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  line-height: 1.3;
`;

const StoreInfo = styled.div`
  font-size: 0.9rem;
  opacity: 0.9;
`;

const CardBody = styled.div`
  padding: 1rem;
`;

const Section = styled.div`
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h4`
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #667eea;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const PriceContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
`;

const CurrentPrice = styled.span`
  font-size: 1.5rem;
  font-weight: 700;
  color: #2d3748;
`;

const OriginalPrice = styled.span`
  font-size: 1rem;
  color: #a0aec0;
  text-decoration: line-through;
`;

const Discount = styled.span`
  background: #48bb78;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
`;

const Rating = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const Stars = styled.div`
  color: #f6ad55;
  font-size: 1.1rem;
`;

const RatingText = styled.span`
  color: #4a5568;
  font-size: 0.9rem;
`;

const Features = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const FeatureTag = styled.span`
  background: #edf2f7;
  color: #4a5568;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
`;

const ValueScore = styled.div<{ score: number }>`
  text-align: center;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: ${props => {
    if (props.score >= 80) return '#c6f6d5';
    if (props.score >= 60) return '#fef5e7';
    return '#fed7d7';
  }};
  border: 1px solid ${props => {
    if (props.score >= 80) return '#48bb78';
    if (props.score >= 60) return '#ed8936';
    return '#f56565';
  }};
`;

const ScoreValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
  color: #2d3748;
`;

const ScoreLabel = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: #4a5568;
`;

const MetaInfo = styled.div`
  background: #f7fafc;
  padding: 0.75rem;
  border-radius: 0.25rem;
  margin-top: 1rem;
  font-size: 0.8rem;
  color: #718096;
`;

const MetaRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

interface ProductCardProps {
  product: ProductAnalysis;
  onClose?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClose }) => {
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push('★');
    }
    if (hasHalfStar) {
      stars.push('☆');
    }
    while (stars.length < 5) {
      stars.push('☆');
    }
    
    return stars.join('');
  };

  return (
    <CardContainer>
      <CardHeader>
        <ProductTitle>{product.basic_info.title}</ProductTitle>
        <StoreInfo>{product.store} • {product.basic_info.category}</StoreInfo>
      </CardHeader>

      <CardBody>
        <Section>
          <SectionTitle>💰 Pricing</SectionTitle>
          <PriceContainer>
            <CurrentPrice>${product.basic_info.current_price.toFixed(2)}</CurrentPrice>
            {product.basic_info.original_price !== product.basic_info.current_price && (
              <OriginalPrice>${product.basic_info.original_price.toFixed(2)}</OriginalPrice>
            )}
            {parseFloat(product.basic_info.discount_percent) > 0 && (
              <Discount>{product.basic_info.discount_percent}% OFF</Discount>
            )}
          </PriceContainer>
          {product.price_analysis.is_good_deal && (
            <div style={{ color: '#48bb78', fontSize: '0.9rem', fontWeight: '600' }}>
              🎉 Great deal! Price is {((product.basic_info.original_price - product.basic_info.current_price) / product.basic_info.original_price * 100).toFixed(0)}% below original
            </div>
          )}
        </Section>

        <Section>
          <SectionTitle>⭐ Reviews</SectionTitle>
          <Rating>
            <Stars>{renderStars(product.reviews.average_rating)}</Stars>
            <RatingText>
              {product.reviews.average_rating}/5.0 ({product.reviews.total_reviews.toLocaleString()} reviews)
            </RatingText>
          </Rating>
        </Section>

        <Section>
          <SectionTitle>🚚 Shipping</SectionTitle>
          <div style={{ color: product.shipping.is_free ? '#48bb78' : '#4a5568' }}>
            {product.shipping.description}
            {product.shipping.is_fast && ' • Fast delivery'}
          </div>
        </Section>

        <Section>
          <SectionTitle>✨ Features</SectionTitle>
          <Features>
            {product.features.map((feature, index) => (
              <FeatureTag key={index}>{feature}</FeatureTag>
            ))}
          </Features>
        </Section>

        <Section>
          <SectionTitle>🎯 Value Score</SectionTitle>
          <ValueScore score={product.value_metrics.overall_score}>
            <ScoreValue>{product.value_metrics.overall_score}/100</ScoreValue>
            <ScoreLabel>{product.value_metrics.recommendation}</ScoreLabel>
          </ValueScore>
        </Section>

        <MetaInfo>
          <MetaRow>
            <span>Analysis Time:</span>
            <span>{product.analysis_metadata.total_duration_ms}ms</span>
          </MetaRow>
          <MetaRow>
            <span>LLM Processing:</span>
            <span>{product.llm_metadata.processing_time_ms}ms</span>
          </MetaRow>
          <MetaRow>
            <span>Confidence:</span>
            <span>{(product.llm_metadata.confidence_score * 100).toFixed(1)}%</span>
          </MetaRow>
        </MetaInfo>
      </CardBody>
    </CardContainer>
  );
};

export default ProductCard;