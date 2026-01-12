import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';

const CustomerAuth = () => {
  const { authenticateCustomer } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCustomerAuth = async () => {
      try {
        // Get customer data from URL parameters
        const email = searchParams.get('email');
        const customerId = searchParams.get('customerId');
        
        if (!email || !customerId) {
          setError('Missing customer information. Please try again.');
          setIsLoading(false);
          return;
        }

        const customerObject = {
          email: decodeURIComponent(email),
          customerId: decodeURIComponent(customerId)
        };

        console.log('🛍️ Validating customer with Shopify:', customerObject);
        setMessage('Validating customer with Shopify...');
        
        // Validate customer with Shopify
        const { validateShopifyCustomer } = await import('../services/shopifyService');
        const customerData = await validateShopifyCustomer(customerObject.customerId, customerObject.email);
        
        console.log('✅ Customer validated with Shopify:', customerData);
        
        // Store validated customer data
        localStorage.setItem('shopifyCustomerEmail', customerObject.email);
        localStorage.setItem('shopifyCustomerId', customerObject.customerId);
        
        setMessage('Customer validated successfully! Redirecting to login...');
        
        setTimeout(() => {
          navigate(`/auth?email=${encodeURIComponent(customerObject.email)}&customerId=${encodeURIComponent(customerObject.customerId)}&message=${encodeURIComponent('Customer validated! Please sign in to continue.')}&autoLogin=true`);
        }, 2000);
        
      } catch (error) {
        console.error('❌ Customer validation error:', error);
        setError(`Customer validation failed: ${error.message}. Please check your credentials.`);
        setTimeout(() => {
          navigate('/auth');
        }, 3000);
      }
    };

    handleCustomerAuth();
  }, [searchParams, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-lg">Authenticating customer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Customer Authentication
          </h1>
          
          {message && (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
              {message}
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <div className="mt-6">
            <button
              onClick={() => navigate('/')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition duration-200"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerAuth;
