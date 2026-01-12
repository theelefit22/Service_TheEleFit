import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, getUserType } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from './LoadingSpinner';

const AuthGuard = ({ children, requireAuth = true, allowedUserTypes = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          // User is authenticated
          setIsAuthenticated(true);
          setUser(currentUser);
          
          // Get user type from Firestore
          try {
            const type = await getUserType(currentUser.uid);
            setUserType(type);
          } catch (error) {
            console.error('Error getting user type:', error);
            setUserType(null);
          }
        } else {
          // User is not authenticated
          setIsAuthenticated(false);
          setUser(null);
          setUserType(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setIsAuthenticated(false);
        setUser(null);
        setUserType(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle redirect after authentication - only for auth pages
  useEffect(() => {
    if (!isLoading && isAuthenticated && userType) {
      const currentPath = location.pathname;
      
      // Only redirect from auth pages, not from protected routes
      if (currentPath === '/auth' || currentPath === '/register') {
        const searchParams = new URLSearchParams(location.search);
        const redirectPath = searchParams.get('redirect');
        
        console.log('🔄 AuthGuard: User authenticated on auth page');
        console.log('🔄 AuthGuard: Current path:', currentPath);
        console.log('🔄 AuthGuard: Redirect path:', redirectPath);
        console.log('🔄 AuthGuard: User type:', userType);
        
        if (redirectPath) {
          // If there's a redirect parameter, use it
          console.log('✅ AuthGuard: Redirecting to intended destination:', redirectPath);
          navigate(redirectPath, { replace: true });
        } else {
          // Otherwise redirect to appropriate dashboard
          const defaultPath = userType === 'expert' ? '/expert-dashboard' : '/user-dashboard';
          console.log('✅ AuthGuard: Redirecting to default dashboard:', defaultPath);
          navigate(defaultPath, { replace: true });
        }
      }
    }
  }, [isLoading, isAuthenticated, userType, navigate, location]);

  // Handle unauthenticated users - move navigation to useEffect
  useEffect(() => {
    if (!isLoading && requireAuth && !isAuthenticated) {
      // Check if this is a session transfer request
      const urlParams = new URLSearchParams(location.search);
      const sessionTransfer = urlParams.get('sessionTransfer');
      const email = urlParams.get('email');
      const customerId = urlParams.get('customerId');
      
      // Check for verified customer session in localStorage
      const verifiedSession = localStorage.getItem('verifiedCustomerSession');
      if (verifiedSession) {
        try {
          const sessionData = JSON.parse(verifiedSession);
          // Check if session is still valid (not expired)
          const sessionAge = Date.now() - sessionData.timestamp;
          const maxAge = 30 * 60 * 1000; // 30 minutes
          
          if (sessionAge < maxAge && sessionData.verified) {
            console.log('🔒 AuthGuard: Verified customer session found, allowing access');
            console.log('🔒 AuthGuard: Email:', sessionData.email);
            console.log('🔒 AuthGuard: Customer ID:', sessionData.customerId);
            console.log('🔒 AuthGuard: User Type:', sessionData.userType);
            
            // Set the user type for the session
            setUserType(sessionData.userType);
            setIsAuthenticated(true);
            return; // Don't redirect, allow the request to continue
          } else {
            // Session expired, remove it
            localStorage.removeItem('verifiedCustomerSession');
            console.log('🔒 AuthGuard: Verified customer session expired, removed');
          }
        } catch (error) {
          console.error('🔒 AuthGuard: Error parsing verified customer session:', error);
          localStorage.removeItem('verifiedCustomerSession');
        }
      }
      
      // Handle session transfer requests by redirecting to auth page
      if (sessionTransfer === 'true' && email && customerId) {
        console.log('🔒 AuthGuard: Session transfer detected, redirecting to auth page for processing');
        console.log('🔒 AuthGuard: Email:', email);
        console.log('🔒 AuthGuard: Customer ID:', customerId);
        
        // Redirect to auth page with session transfer parameters
        const currentPath = location.pathname + location.search;
        const authUrl = `/auth?sessionTransfer=true&email=${encodeURIComponent(email)}&customerId=${encodeURIComponent(customerId)}&redirect=${encodeURIComponent(currentPath)}`;
        console.log('🔒 AuthGuard: Redirecting to auth page:', authUrl);
        navigate(authUrl, { replace: true });
        return;
      }
      
      // Store the current path as redirect destination
      const currentPath = location.pathname + location.search;
      console.log('🔒 AuthGuard: User not authenticated');
      console.log('🔒 AuthGuard: Current path:', currentPath);
      console.log('🔒 AuthGuard: Redirecting to auth with redirect parameter');
      navigate(`/auth?redirect=${encodeURIComponent(currentPath)}`, { replace: true });
    }
  }, [isLoading, requireAuth, isAuthenticated, navigate, location]);

  // Handle user type restrictions - move navigation to useEffect
  useEffect(() => {
    if (!isLoading && requireAuth && isAuthenticated && allowedUserTypes && !allowedUserTypes.includes(userType)) {
      console.log('User type not allowed for this route:', userType, 'Allowed:', allowedUserTypes);
      // Redirect to appropriate dashboard based on user type
      const defaultPath = userType === 'expert' ? '/expert-dashboard' : '/user-dashboard';
      navigate(defaultPath, { replace: true });
    }
  }, [isLoading, requireAuth, isAuthenticated, allowedUserTypes, userType, navigate]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return <LoadingSpinner text="Checking authentication..." />;
  }

  // If authentication is required but user is not authenticated, show loading while redirecting
  if (requireAuth && !isAuthenticated) {
    return <LoadingSpinner text="Redirecting to login..." />;
  }

  // If user is authenticated but user type is required and doesn't match, show loading while redirecting
  if (requireAuth && isAuthenticated && allowedUserTypes && !allowedUserTypes.includes(userType)) {
    return <LoadingSpinner text="Redirecting to appropriate dashboard..." />;
  }

  // Render the protected component
  return children;
};

export default AuthGuard;
