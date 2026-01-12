import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import LoadingSpinner from './LoadingSpinner';

const ShopifyAuthGuard = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const handleShopifyToken = async () => {
      const urlParams = new URLSearchParams(location.search);
      const token = urlParams.get('token');
      
      if (!token) {
        // No token, proceed normally - let ProtectedRoute handle authentication
        setIsAuthenticated(true);
        return;
      }

      setIsProcessing(true);

      try {
        // Check if user is already logged in
        const currentUser = auth.currentUser;
        if (currentUser) {
          const currentEmail = currentUser.email;
          
          // Decode token to check email
          try {
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            const tokenEmail = tokenPayload.email;

            // If different user, sign out first
            if (currentEmail !== tokenEmail) {
              console.log('Switching user account...');
              await signOut(auth);
            }
          } catch (decodeError) {
            console.error('Error decoding token:', decodeError);
            throw new Error('Invalid token format');
          }
        }

        // Decode token to get user info
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const tokenEmail = tokenPayload.email;
        const tokenUid = tokenPayload.uid;
        
        console.log('Shopify token decoded successfully:', { email: tokenEmail, uid: tokenUid });
        
        // Store the email for potential use
        localStorage.setItem('shopify_email', tokenEmail);
        localStorage.setItem('shopify_uid', tokenUid);
        
        // Try to find existing user in Firestore with this email
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where("email", "==", tokenEmail.toLowerCase().trim()));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            // User exists in Firestore, redirect to auth with pre-filled email
            console.log('User found in Firestore, redirecting to auth');
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            navigate('/auth?message=Welcome from Shopify! Please log in to continue.', { replace: true });
            return;
          } else {
            // User doesn't exist, redirect to registration
            console.log('User not found in Firestore, redirecting to registration');
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            navigate('/register?message=Welcome from Shopify! Please create an account to continue.', { replace: true });
            return;
          }
        } catch (error) {
          console.error('Error checking user in Firestore:', error);
          // Fallback to auth page
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
          navigate('/auth?message=Welcome from Shopify! Please log in to continue.', { replace: true });
          return;
        }
        
      } catch (error) {
        console.error('Shopify token processing failed:', error);
        // Redirect to auth page if token is invalid
        navigate('/auth?error=Invalid authentication token. Please try again.', { replace: true });
        return;
      } finally {
        setIsProcessing(false);
      }
    };

    handleShopifyToken();
  }, [navigate, location]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center">
              <LoadingSpinner />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Processing Shopify Authentication...
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we verify your session...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return children;
};

export default ShopifyAuthGuard;
