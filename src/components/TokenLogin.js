import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import LoadingSpinner from './LoadingSpinner';

const TokenLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('Signing you in...');

  useEffect(() => {
    const handleTokenLogin = async () => {
      try {
        // Get token from URL parameters
        const urlParams = new URLSearchParams(location.search);
        const token = urlParams.get('token');
        
        if (!token) {
          setStatus('No authentication token found. Redirecting to login...');
          setTimeout(() => navigate('/auth'), 2000);
          return;
        }

        setStatus('Validating token...');

        // Check if user is already logged in
        const currentUser = auth.currentUser;
        if (currentUser) {
          const currentEmail = currentUser.email;
          
          // Decode token to check email (basic JWT decode)
          try {
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            const tokenEmail = tokenPayload.email;

            // If different user, sign out first
            if (currentEmail !== tokenEmail) {
              setStatus('Switching user account...');
              await signOut(auth);
            }
          } catch (decodeError) {
            console.error('Error decoding token:', decodeError);
            setStatus('Invalid token format. Redirecting to login...');
            setTimeout(() => navigate('/auth'), 2000);
            return;
          }
        }

        setStatus('Signing in with token...');

        // Sign in with the custom token
        await signInWithCustomToken(auth, token);
        
        setStatus('Authentication successful! Redirecting...');
        
        // Redirect to aicoach page
        setTimeout(() => {
          navigate('/aicoach');
        }, 1000);

      } catch (error) {
        console.error('Token login failed:', error);
        
        if (error.code === 'auth/invalid-custom-token') {
          setStatus('Invalid authentication token. Redirecting to login...');
        } else if (error.code === 'auth/custom-token-mismatch') {
          setStatus('Token mismatch. Redirecting to login...');
        } else {
          setStatus('Authentication failed. Redirecting to login...');
        }
        
        setTimeout(() => navigate('/auth'), 3000);
      }
    };

    handleTokenLogin();
  }, [navigate, location.search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center">
            <LoadingSpinner />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {status}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please wait while we authenticate your session...
          </p>
        </div>
      </div>
    </div>
  );
};

export default TokenLogin;
