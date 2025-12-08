import React from 'react';
import { Button, Form } from 'react-bootstrap';
import styled from 'styled-components';
import { secondaryBackgroundColor, secondaryColor, navigationWidthNumber, marginNumber, buttonPaddingNumber, secMenuWidthNumber, primaryColor, secMenuUserWidthNumber } from './DisplaySettings';
import { Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
// Add base font size calculation
const calculateRem = (pixels) => `${pixels / 16}rem`;  // 16px is the default browser font size

const ButtonColumn = styled.div`
  position: fixed;
  left: ${calculateRem(navigationWidthNumber * 16 + marginNumber * 16 + buttonPaddingNumber * 16)};
  top: ${calculateRem(20)};
  display: flex;
  flex-direction: column;
  gap: ${calculateRem(10)};
  width: ${calculateRem(secMenuWidthNumber * 16)};
  button {
    width: 100%;
  }
`;



const StyledCard = ({ children, className = '', ...props }) => {
  return (
    <Card 
      className={`mb-4 ${className}`}
      bg="dark"
      text="white"
      style={{
        border: `0.125rem solid ${secondaryColor}`,
        borderRadius: '0.9375rem',
        boxShadow: `0 0 0.9375rem ${secondaryColor}`
      }}
      {...props}
    >
      <Card.Body>
        {children}
      </Card.Body>
    </Card>
  );
};

export { StyledCard }; 

const ContentContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  background: ${secondaryBackgroundColor};
  border: ${calculateRem(2)} solid ${secondaryColor};
  border-radius: ${calculateRem(15)};
  box-shadow: 0 0 ${calculateRem(15)} ${secondaryColor};
  padding: ${calculateRem(20)};
  margin-top: ${calculateRem(20)};
  margin-bottom: ${calculateRem(20)};
`;

const SecColumn = styled.div`
  position: fixed;
  left: ${navigationWidthNumber+marginNumber+buttonPaddingNumber}rem;
  top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  width: ${secMenuUserWidthNumber}rem;
  button {
    width: 100%;
  }
`;

const ContentRow = styled.div`
  display: flex;
  gap: 1.25rem;
  width: 100%;
`;

const HalfContentContainer = styled(ContentContainer)`
  width: 50%;
  margin: 1.25rem 0;
`;

const TopSecRow = styled.div`
  position: fixed;
  top: 1.25rem;
  display: flex;
  flex-direction: row;
  gap: 0.625rem;
  width: 100%;
  padding: 0 1.25rem;
  z-index: 1;
`;

const SecRow = styled.div`
  position: fixed;
  top: 5rem;
  display: flex;
  flex-direction: row;
  gap: 0.625rem;
  width: 100%;
  padding: 0 1.25rem;
  z-index: 1;
`;

export const Title = styled.h1`
  font-size: clamp(1rem, 3vw, 2rem);
  margin-bottom: 0.875rem;
`;

export const Subtitle = styled.h2`
  font-size: clamp(0.875rem, 2.5vw, 1.5rem); 
  margin-bottom: 0.75rem;
`;

export const Text = styled.p`
  font-size: clamp(0.75rem, 1.5vw, 1rem);
  line-height: 1.4;
  margin-bottom: 0.875rem;
`;

export const SmallText = styled.span`
  font-size: clamp(0.625rem, 1vw, 0.75rem);
`;

// Input Components using Bootstrap
const CustomTextInput = (props) => (
  <Form.Control type="text" {...props} />
);

const CustomNumberInput = (props) => (
  <Form.Control type="number" {...props} />
);

const CustomSearchInput = (props) => (
  <Form.Control type="search" {...props} />
);

// Small Button using Bootstrap
const SmallButton = (props) => (
  <Button size="sm" variant="outline-light" {...props} />
);

// Back Button Component
const BackButton = ({ to = '/', showText = '', size = 'normal', ...props }) => {
  const navigate = useNavigate();
  
  // Define dimensions based on size prop
  const dimensions = {
    small: {
      width: showText ? 'auto' : '30px',
      height: '30px',
      fontSize: '16px',
      textSize: '0.7rem'
    },
    normal: {
      width: showText ? 'auto' : '40px',
      height: '40px',
      fontSize: '20px',
      textSize: '0.8rem'
    },
    large: {
      width: showText ? 'auto' : '50px',
      height: '50px',
      fontSize: '24px',
      textSize: '0.9rem'
    }
  };
  
  const { width, height, fontSize, textSize } = dimensions[size] || dimensions.normal;
  
  return (
    <button
      onClick={() => navigate(to)}
      aria-label="Go back"
      style={{
        width: width,
        height: height,
        borderRadius: showText ? '0.75rem' : '50%',
        border: '2px solid white',
        backgroundColor: 'black',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        padding: showText ? '0.25rem 0.5rem' : 0,
        position: 'relative',
        gap: '0.3rem'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = 'white';
        e.currentTarget.querySelector('span').style.color = 'black';
        if (e.currentTarget.querySelector('.text-label')) {
          e.currentTarget.querySelector('.text-label').style.color = 'black';
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'black';
        e.currentTarget.querySelector('span').style.color = 'white';
        if (e.currentTarget.querySelector('.text-label')) {
          e.currentTarget.querySelector('.text-label').style.color = 'white';
        }
      }}
      {...props}
    >
      <span 
        style={{
          color: 'white',
          fontSize: fontSize,
          lineHeight: 1,
          position: 'relative',
          transition: 'color 0.2s ease-in-out',
        }}
      >
        &#8592;
      </span>
      {showText && (
        <span 
          className="text-label"
          style={{
            color: 'white',
            fontSize: textSize,
            transition: 'color 0.2s ease-in-out',
          }}
        >
          {showText}
        </span>
      )}
    </button>
  );
};

export {
  CustomTextInput,
  CustomNumberInput,
  CustomSearchInput,
  SmallButton,
  ButtonColumn,
  ContentContainer,
  SecColumn,
  ContentRow,
  HalfContentContainer,
  TopSecRow,
  SecRow,
  BackButton
};
