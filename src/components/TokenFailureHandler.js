import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const TokenFailureHandler = ({ email, password, onSuccess, onError }) => {
  const { handleTokenFailure } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleTokenFailureAndCreate = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const result = await handleTokenFailure(email, password);
      
      if (result.success) {
        if (result.autoCreated) {
          setMessage(result.message);
          // User was auto-created, they need to log in again
          setTimeout(() => {
            onSuccess && onSuccess(result);
          }, 2000);
        } else {
          // Regular success
          onSuccess && onSuccess(result);
        }
      } else {
        setMessage(result.error);
        onError && onError(result.error);
      }
    } catch (error) {
      setMessage(error.message);
      onError && onError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="token-failure-handler">
      <h3>Token Verification Failed</h3>
      <p>Your Firebase token could not be verified. Attempting to create user from Shopify...</p>
      
      <button 
        onClick={handleTokenFailureAndCreate}
        disabled={isLoading}
        className="btn btn-primary"
      >
        {isLoading ? 'Creating User...' : 'Create User from Shopify'}
      </button>
      
      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default TokenFailureHandler;
