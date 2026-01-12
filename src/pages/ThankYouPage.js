import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ThankYouPage.css';

const ThankYouPage = () => {
  const navigate = useNavigate();
  const textRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // Auto redirect after 10 seconds
    const timer = setTimeout(() => {
      navigate('/aicoach');
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="thank-you-container" ref={containerRef}>
      {/* Main Content */}
      <div className="thank-you-content">
        <h1 className="thank-you-title" ref={textRef}>
          <span className="word word-1">Thank</span>
          <span className="word word-2">You</span>
          <span className="word word-3">for</span>
          <span className="word word-4">Using</span>
          <span className="word word-5">AI</span>
          <span className="word word-6">Coach</span>
        </h1>

        <div className="thank-you-subtitle">
          <p className="subtitle-line line-1">Your wellness journey matters to us</p>
          <p className="subtitle-line line-2">Come back anytime for more personalized guidance</p>
        </div>

        <div className="action-buttons">
          <button 
            className="btn-primary"
            onClick={() => navigate('/aicoach')}
          >
            <i className="fas fa-arrow-left"></i>
            Back to AI Coach
          </button>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/')}
          >
            <i className="fas fa-home"></i>
            Go Home
          </button>
        </div>

        <div className="auto-redirect-notice">
          <i className="fas fa-clock"></i>
          <span>Automatically redirecting in 10 seconds...</span>
        </div>
      </div>
    </div>
  );
};

export default ThankYouPage;