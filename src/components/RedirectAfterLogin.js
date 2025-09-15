import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const RedirectAfterLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userType, isLoading } = useAuthContext();

  useEffect(() => {
    if (!isLoading && userType) {
      // Get redirect path from URL params
      const urlParams = new URLSearchParams(location.search);
      const redirectPath = urlParams.get('redirect');
      
      if (redirectPath) {
        // Redirect to the intended destination
        console.log('Redirecting to intended destination:', redirectPath);
        navigate(redirectPath, { replace: true });
      } else {
        // Redirect to appropriate dashboard based on user type
        const defaultPath = userType === 'expert' ? '/expert-dashboard' : '/user-dashboard';
        console.log('Redirecting to default dashboard:', defaultPath);
        navigate(defaultPath, { replace: true });
      }
    }
  }, [isLoading, userType, navigate, location]);

  return <LoadingSpinner text="Redirecting..." />;
};

export default RedirectAfterLogin;
