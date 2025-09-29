import { useState, useEffect } from 'react';
import { auth, getUserType, restoreUserSessionAfterPhoneVerification } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        console.log('🔐 useAuth: Auth state changed, user:', currentUser ? 'authenticated' : 'not authenticated');
        console.log('🔐 useAuth: Current user details:', currentUser ? { email: currentUser.email, uid: currentUser.uid } : null);
        
        // Check for original user session restoration after phone verification
        if (!currentUser) {
          const originalUserSession = localStorage.getItem('originalUserSession');
          if (originalUserSession) {
            try {
              const sessionData = JSON.parse(originalUserSession);
              const sessionAge = Date.now() - sessionData.timestamp;
              const maxAge = 5 * 60 * 1000; // 5 minutes
              
              if (sessionAge < maxAge) {
                console.log('🔐 useAuth: Original user session found after phone verification');
                console.log('🔐 useAuth: Restoring user session:', { email: sessionData.email, uid: sessionData.uid });
                
                // Restore the user session
                setUser({ email: sessionData.email, uid: sessionData.uid });
                setIsAuthenticated(true);
                
                // Get user type from Firestore
                try {
                  const type = await getUserType(sessionData.uid);
                  setUserType(type);
                  console.log('🔐 useAuth: User type restored:', type);
                } catch (error) {
                  console.error('Error getting user type after phone verification:', error);
                  setUserType(null);
                }
                
                // Clear the session data
                localStorage.removeItem('originalUserSession');
                return;
              } else {
                // Session expired, remove it
                localStorage.removeItem('originalUserSession');
                console.log('🔐 useAuth: Original user session expired, removed');
              }
            } catch (error) {
              console.error('Error parsing original user session:', error);
              localStorage.removeItem('originalUserSession');
            }
          }
        }

        // Always check for verified customer session first
        const verifiedSession = localStorage.getItem('verifiedCustomerSession');
        console.log('🔐 useAuth: Checking verified session:', verifiedSession ? 'exists' : 'null');
        
        if (verifiedSession) {
          try {
            const sessionData = JSON.parse(verifiedSession);
            const sessionAge = Date.now() - sessionData.timestamp;
            const maxAge = 30 * 60 * 1000; // 30 minutes
            
            console.log('🔐 useAuth: Session data:', {
              email: sessionData.email,
              uid: sessionData.uid,
              verified: sessionData.verified,
              userType: sessionData.userType,
              age: sessionAge,
              maxAge: maxAge,
              isValid: sessionAge < maxAge && sessionData.verified
            });
            
            if (sessionAge < maxAge && sessionData.verified) {
              console.log('🔐 useAuth: Verified customer session found, setting auth state');
              setUser({ email: sessionData.email, uid: sessionData.uid });
              setIsAuthenticated(true);
              setUserType(sessionData.userType);
              return;
            } else {
              // Session expired, remove it
              localStorage.removeItem('verifiedCustomerSession');
              console.log('🔐 useAuth: Verified customer session expired, removed');
            }
          } catch (error) {
            console.error('Error parsing verified customer session:', error);
            localStorage.removeItem('verifiedCustomerSession');
          }
        }
        
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
          
          // Get user type from Firestore
          try {
            const type = await getUserType(currentUser.uid);
            setUserType(type);
            console.log('🔐 useAuth: User type set to:', type);
          } catch (error) {
            console.error('Error getting user type:', error);
            setUserType(null);
          }
        } else {
          setUser(null);
          setUserType(null);
          setIsAuthenticated(false);
          console.log('🔐 useAuth: User logged out');
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
        setUserType(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
        console.log('🔐 useAuth: Loading state set to false');
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      // If Firebase login fails, try the enhanced login with Shopify auto-creation
      try {
        const { loginUser } = await import('../services/firebase');
        const result = await loginUser(email, password);
        
        // If auto-creation happened, return the result
        if (result.autoCreated) {
          return { 
            success: true, 
            user: null, // No user object yet since they need to log in again
            autoCreated: true,
            message: result.message,
            uid: result.uid,
            shopifyCustomerId: result.shopifyCustomerId
          };
        }
        
        // If regular login succeeded, return the user
        if (result && typeof result === 'object' && result.uid) {
          return { success: true, user: result };
        }
        
        return { success: false, error: 'Login failed' };
      } catch (enhancedError) {
        return { success: false, error: enhancedError.message || error.message };
      }
    }
  };

  const logout = async () => {
    try {
      const { signOut } = await import('firebase/auth');
      
      // Clear all local storage items related to authentication
      localStorage.removeItem('verifiedCustomerSession');
      localStorage.removeItem('phoneVerificationSession');
      localStorage.removeItem('originalUserSession');
      localStorage.removeItem('shopifyCustomerEmail');
      localStorage.removeItem('shopifyCustomerId');
      localStorage.removeItem('shopify_email');
      
      // Clear session storage
      sessionStorage.removeItem('sessionTransferProcessed');
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Manually clear state to ensure immediate UI update
      setUser(null);
      setUserType(null);
      setIsAuthenticated(false);
      
      console.log('🔐 useAuth: Logout completed, state cleared');
      return { success: true };
    } catch (error) {
      console.error('🔐 useAuth: Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password, userType, additionalData = {}) => {
    try {
      const { registerUser } = await import('../services/firebase');
      const result = await registerUser(email, password, userType, additionalData);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const handleTokenFailure = async (email, password) => {
    try {
      const { handleTokenFailureWithShopify } = await import('../services/firebase');
      const result = await handleTokenFailureWithShopify(email, password);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const authenticateCustomer = async (customerObject) => {
    try {
      const { authenticateCustomer: authCustomer } = await import('../services/firebase');
      const result = await authCustomer(customerObject);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return {
    user,
    userType,
    isLoading,
    isAuthenticated,
    login,
    logout,
    register,
    handleTokenFailure,
    authenticateCustomer
  };
};
