import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, registerUser, loginUser, getUserType, sendPasswordResetEmail } from '../services/firebase';
import { useAuthContext } from '../contexts/AuthContext';
import './AuthPage.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import logoImage from '../assets/images/logo.png';
import signupBg from '../assets/images/sign-up-bg.jpg';

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, userType, isLoading } = useAuthContext();
  
  // Get redirect path from URL params or state
  const urlParams = new URLSearchParams(location.search);
  const redirectPath = urlParams.get('redirect') || location.state?.returnPath || null;
  
  // Manual authentication state
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [retryData, setRetryData] = useState(null);
  const [showLoginHint, setShowLoginHint] = useState(false);
  const [isEvaCustomer, setIsEvaCustomer] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  const [showPassword, setShowPassword] = useState(false);

  // Session token authentication state
  const [sessionTokenLoading, setSessionTokenLoading] = useState(false);
  const [sessionTokenError, setSessionTokenError] = useState('');
  const [sessionTokenSuccess, setSessionTokenSuccess] = useState('');

  // Password validation function
  const validatePassword = (value) => {
    const strength = {
      score: 0,
      hasMinLength: value.length >= 8,
      hasUpperCase: /[A-Z]/.test(value),
      hasLowerCase: /[a-z]/.test(value),
      hasNumber: /[0-9]/.test(value),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(value)
    };

    // Calculate score based on criteria
    if (strength.hasMinLength) strength.score++;
    if (strength.hasUpperCase) strength.score++;
    if (strength.hasLowerCase) strength.score++;
    if (strength.hasNumber) strength.score++;
    if (strength.hasSpecialChar) strength.score++;

    setPasswordStrength(strength);
    return strength;
  };

  // Enhanced email validator for client-side checks
  const isValidEmail = (value) => {
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const trimmedEmail = value.trim();
    
    // Basic format validation
    if (!emailPattern.test(trimmedEmail)) {
      return false;
    }
    
    // Additional checks
    if (trimmedEmail.length > 254) return false; // RFC 5321 limit
    if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) return false;
    if (trimmedEmail.includes('..')) return false; // No consecutive dots
    
    return true;
  };

  // Handle password change with validation
  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if (!isLogin) {
      validatePassword(newPassword);
    }
  };

  // ===== SESSION TOKEN AUTHENTICATION LOGIC =====
  
  // Handle Firebase ID token verification and automatic login
  const handleSessionTokenLogin = async (token) => {
    console.log('🚀 AuthPage: Starting ID token verification and auto-login process...');
    setSessionTokenLoading(true);
    setSessionTokenError('');
    setSessionTokenSuccess('');
    
    try {
      console.log('🔐 AuthPage: Verifying ID token...');
      
          // Decode the JWT token to get user information
          const tokenParts = token.split('.');
          if (tokenParts.length !== 3) {
            throw new Error('Invalid token format');
          }
          
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('🔍 AuthPage: Token payload:', payload);
          
          // Check if token is expired
          const currentTime = Math.floor(Date.now() / 1000);
          if (payload.exp < currentTime) {
            throw new Error('Token has expired');
          }
          
          console.log('✅ AuthPage: Token is valid for user:', payload.email);
          
      // Check if user exists in Firestore (Shopify account check)
      console.log('🔍 AuthPage: Checking if user exists in Firestore...');
          const userType = await getUserType(payload.sub);
          
          if (userType) {
            console.log('✅ AuthPage: User found in Firestore, proceeding with auto-login...');
        setSessionTokenSuccess('Welcome back! Logging you in...');
        
        // Since we have a valid token and user exists, we can create a session
        // We'll use the Firebase ID token to create a temporary authentication state
        try {
          console.log('🔐 AuthPage: Creating authenticated session with token...');
          
          // Import Firebase auth functions
          const { signInWithCustomToken } = await import('firebase/auth');
          
          // Try to use the ID token as a custom token (this might work in some cases)
          try {
            const userCredential = await signInWithCustomToken(auth, token);
            console.log('✅ AuthPage: Successfully signed in with token!');
            
            // Get user type and navigate
            const userType = await getUserType(userCredential.user.uid);
            checkUserTypeAndNavigate(userCredential.user.uid, userType);
            return;
          } catch (customTokenError) {
            console.log('⚠️ AuthPage: Custom token failed, trying alternative approach...');

            // Since we can't directly modify the auth context from here,
            // we'll redirect to a special endpoint that handles token-based login
            const redirectPath = urlParams.get('redirect') || '/aicoach';
            navigate(`/auth?email=${encodeURIComponent(payload.email)}&redirect=${encodeURIComponent(redirectPath)}&message=Welcome from AI Coach! Your account is verified. Please sign in to continue.&tokenVerified=true&autoLogin=true`);
          }
          
        } catch (authError) {
          console.error('❌ AuthPage: Auto-login failed:', authError);
          // Fallback to manual login with pre-filled email
          const redirectPath = urlParams.get('redirect') || '/aicoach';
          navigate(`/auth?email=${encodeURIComponent(payload.email)}&redirect=${encodeURIComponent(redirectPath)}&message=Welcome from AI Coach! Please sign in to continue.`);
        }
      } else {
        console.log('❌ AuthPage: User not found in Firestore, redirecting to registration...');
        setSessionTokenError('Account not found. Please create an account first.');
        
        // Redirect to registration with pre-filled email
        const redirectPath = urlParams.get('redirect') || '/aicoach';
        navigate(`/auth?email=${encodeURIComponent(payload.email)}&redirect=${encodeURIComponent(redirectPath)}&message=Welcome from AI Coach! Please create an account to continue.&isSignUp=true`);
      }
      
    } catch (error) {
      console.error('❌ AuthPage: Token verification failed:', error);
      console.error('❌ AuthPage: Error details:', error.message, error.code);
      setSessionTokenError(`Token verification failed: ${error.message}. Please try signing in manually.`);
      setSessionTokenLoading(false);
    }
  };

  // Handle Shopify customer authentication
  const handleShopifyCustomerLogin = async (email, customerId) => {
    try {
      console.log('🔐 DEBUG: Starting Shopify customer authentication...');
      setSessionTokenLoading(true);
      setSessionTokenError('');
      
      console.log('🛍️ DEBUG: Customer data provided, validating with Shopify...');
      console.log('🛍️ DEBUG: Email to validate:', email);
      console.log('🛍️ DEBUG: Customer ID to validate:', customerId);
      
      try {
        // Use the authenticateCustomer function for proper auto-login
        const { authenticateCustomer } = await import('../services/firebase');
        const customerObject = { email, customerId: customerId };
        
        console.log('🛍️ DEBUG: Customer object for authentication:', customerObject);
        console.log('🛍️ DEBUG: Calling authenticateCustomer...');
        const authResult = await authenticateCustomer(customerObject);
        console.log('✅ DEBUG: Customer authentication result:', authResult);
        
        if (authResult.success) {
          console.log('✅ DEBUG: Authentication successful, processing result...');
          
          // Store the validated customer data
          localStorage.setItem('shopifyCustomerEmail', email);
          localStorage.setItem('shopifyCustomerId', customerId);
          console.log('💾 DEBUG: Stored customer data in localStorage');
          
          if (authResult.authenticated) {
            // Customer is verified and authenticated
            console.log('✅ DEBUG: Customer verified and authenticated successfully!');
            
            // Create verified customer session for useAuth hook
            const verifiedSession = {
              email: email,
              uid: authResult.uid,
              customerId: customerId,
              userType: 'user', // Use 'user' instead of 'customer' for dashboard access
              verified: true,
              timestamp: Date.now()
            };
            
            // Store the verified session
            localStorage.setItem('verifiedCustomerSession', JSON.stringify(verifiedSession));
            console.log('💾 DEBUG: Created verified customer session:', verifiedSession);
            
            // Show success message and redirect
            setSessionTokenSuccess('✅ Customer verified with Shopify! Redirecting to AI Coach...');
            setSessionTokenLoading(false);
            
            // Redirect to the intended destination, but clean the URL to prevent loops
            const redirectPath = urlParams.get('redirect') || '/aicoach';
            console.log('🔄 DEBUG: Redirecting to:', redirectPath);
            
            // Clean the redirect path to remove any existing parameters that might cause loops
            const cleanRedirectPath = redirectPath.split('?')[0]; // Remove any query parameters
            console.log('🔄 DEBUG: Clean redirect path:', cleanRedirectPath);
            
            // Clear the session processing flag
            sessionStorage.removeItem('sessionTransferProcessed');
            
            setTimeout(() => {
              window.location.href = cleanRedirectPath;
            }, 2000);
            return;
          } else if (authResult.autoCreated) {
            // User was auto-created, show success message
            console.log('📝 DEBUG: User was auto-created:', {
              uid: authResult.uid,
              email: authResult.email,
              shopifyCustomerId: authResult.shopifyCustomerId
            });
            
            // Create verified customer session for auto-created user
            const verifiedSession = {
              email: email,
              uid: authResult.uid,
              customerId: customerId,
              userType: 'user', // Use 'user' instead of 'customer' for dashboard access
              verified: true,
              timestamp: Date.now()
            };
            
            // Store the verified session
            localStorage.setItem('verifiedCustomerSession', JSON.stringify(verifiedSession));
            console.log('💾 DEBUG: Created verified customer session for auto-created user:', verifiedSession);
            
            setSessionTokenSuccess('Account created successfully! Redirecting to AI Coach...');
            setSessionTokenLoading(false);
            
            // Redirect to the intended destination
            const redirectPath = urlParams.get('redirect') || '/aicoach';
            const cleanRedirectPath = redirectPath.split('?')[0];
            
            setTimeout(() => {
              window.location.href = cleanRedirectPath;
            }, 2000);
            return;
          } else {
            // Customer verified but needs to sign in
            console.log('🔐 DEBUG: Customer verified but not authenticated, showing login form');
            setSessionTokenSuccess('Customer verified! Please sign in to continue.');
            setEmail(email); // Pre-fill email
            setSessionTokenLoading(false);
            return;
          }
        } else {
          console.log('❌ DEBUG: Authentication failed:', authResult.error);
          throw new Error(authResult.error || 'Customer authentication failed');
        }
        
      } catch (shopifyError) {
        console.error('❌ DEBUG: Shopify validation failed:', shopifyError);
        setSessionTokenError(`Customer validation failed: ${shopifyError.message}. Please check your credentials.`);
        setSessionTokenLoading(false);
        return;
      }
      
    } catch (error) {
      console.error('❌ DEBUG: Shopify customer login error:', error);
      setSessionTokenError(`Shopify authentication failed: ${error.message}. Please sign in manually.`);
      setSessionTokenLoading(false);
    }
  };

  // ===== MANUAL AUTHENTICATION LOGIC =====

  // Handle manual sign-in
  const handleManualSignIn = async (email, password) => {
    try {
      const user = await loginUser(email, password);
      
      if (user.justMapped) {
        setSuccess('Your Shopify account has been successfully connected!');
        setTimeout(() => {
          checkUserTypeAndNavigate(user.uid);
        }, 1000);
      } else {
        checkUserTypeAndNavigate(user.uid);
      }
    } catch (loginError) {
      console.error('Login error:', loginError);
      
      if (loginError.message && 
          (loginError.message.includes('Shopify account has been connected') || 
           loginError.message.includes('Please log in again'))) {
        
        setError('');
        setSuccess('Connecting to your account...');
        setShowLoginHint(true);
        
        // Automatically retry without user intervention
        setRetryData({
          shouldRetry: true,
          email: email,
          password: password
        });
        
      } else {
        const code = (loginError && loginError.originalError && loginError.originalError.code) || '';
        const msg = (loginError && loginError.message) || '';

        // Handle specific Firebase auth error codes with human-readable messages
        if (code === 'auth/user-not-found') {
          setError('No account found with this email address. Please check your email or sign up for a new account.');
        } else if (code === 'auth/wrong-password') {
          setError('Incorrect password. Please try again or reset your password.');
        } else if (code === 'auth/invalid-email') {
          setError('Please enter a valid email address.');
        } else if (code === 'auth/user-disabled') {
          setError('This account has been disabled. Please contact support.');
        } else if (code === 'auth/too-many-requests') {
          setError('Too many failed login attempts. Please try again later or reset your password.');
        } else if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
          // Check if this might be a Shopify user with different password
          if (msg.includes('Email or password is incorrect')) {
            setError('Invalid email or password. If you have a Shopify account, please use your Shopify password, or reset your password using the "Forgot password?" link below.');
          } else {
            setError('Invalid email or password. Please check your credentials and try again.');
          }
        } else if (msg.includes('The email address is not valid')) {
          setError('Please enter a valid email address.');
        } else if (msg.includes('Password should be at least 6 characters')) {
          setError('Password must be at least 6 characters long.');
        } else if (msg.includes('Email or password is incorrect') || msg.includes('INVALID_LOGIN_CREDENTIALS')) {
          setError('Invalid email or password. If you have a Shopify account, please use your Shopify password, or reset your password using the "Forgot password?" link below.');
        } else if (msg.includes('network') || msg.includes('Network')) {
          setError('Network error. Please check your internet connection and try again.');
        } else if (msg.includes('Shopify password doesn\'t match our system')) {
          setError('Your Shopify password doesn\'t match our system. We\'ve sent a password reset email to your address. Please check your inbox and reset your password, then try logging in again.');
        } else {
          // Fallback for any other errors
          setError('Login failed. Please check your email and password and try again.');
        }
      }
    }
  };

  // Handle manual sign-up
  const handleManualSignUp = async (email, password, firstName, lastName, isEvaCustomer) => {
    const additionalData = {
      firstName,
      lastName,
      isEvaCustomer
    };
    
    await registerUser(email, password, 'user', additionalData);
    const registeredEmailTemp = email;
    
    // Clear form and switch to login
    setPassword('');
    setFirstName('');
    setLastName('');
    setIsEvaCustomer(false);
    setIsLogin(true);
    
    // Set success message and email after state updates
    setTimeout(() => {
      setSuccess('Account created successfully! Please sign in with your credentials.');
      setEmail(registeredEmailTemp);
    }, 100);
  };

  // ===== SHARED UTILITY FUNCTIONS =====

  // Function to check user type and navigate appropriately
  const checkUserTypeAndNavigate = async (uid, userType = null) => {
    try {
      // If userType is not provided, get it
      if (!userType) {
        userType = await getUserType(uid);
      }
      
      console.log('🔍 AuthPage: User type:', userType);
      
      // Determine redirect path
      let finalRedirectPath = redirectPath || '/';
      
      if (redirectPath && redirectPath !== '/') {
        // If there's a specific redirect path, use it
        console.log('🔍 AuthPage: Using redirect path from URL:', redirectPath);
        finalRedirectPath = redirectPath;
      } else {
        // Otherwise, redirect based on user type
        if (userType === 'expert') {
          finalRedirectPath = '/expert-dashboard';
        } else if (userType === 'admin') {
          finalRedirectPath = '/admin/panel';
        } else {
          finalRedirectPath = '/user-dashboard';
        }
        console.log('🔍 AuthPage: Using default redirect based on user type:', finalRedirectPath);
      }
      
      console.log('🚀 AuthPage: Redirecting to:', finalRedirectPath);
      navigate(finalRedirectPath, { replace: true });
      
    } catch (error) {
      console.error('❌ AuthPage: Error checking user type:', error);
      setError('Error verifying user account. Please try again.');
      setLoading(false);
    }
  };

  // ===== EFFECTS =====

  // Check if user is already logged in using context
  useEffect(() => {
    if (!isLoading && isAuthenticated && userType) {
      // Don't redirect here - let AuthGuard handle it
      // This prevents double redirects
      setLoading(false);
    } else if (!isLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [isLoading, isAuthenticated, userType]);

  // Handle session token authentication
  useEffect(() => {
    // Check for direct token parameter
    let token = urlParams.get('token');
    
    // If no direct token, check if token is in redirect parameter
    if (!token) {
      const redirectParam = urlParams.get('redirect');
      if (redirectParam) {
        console.log('🔍 AuthPage: Checking redirect parameter for token:', redirectParam);
        // Check if redirect parameter contains a token
        if (redirectParam.includes('token=')) {
          // Extract token from redirect parameter
          const tokenMatch = redirectParam.match(/token=([^&]+)/);
          if (tokenMatch) {
            token = tokenMatch[1];
            console.log('🔍 AuthPage: Token found in redirect:', token ? 'present' : 'not present');
          }
        }
      }
    }
    
    console.log('🔍 AuthPage: Token check - token:', token ? 'present' : 'not present');
    console.log('🔍 AuthPage: Auth state - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);
    
    // Only attempt token login if user is not already authenticated
    if (token && !isAuthenticated && !isLoading) {
      console.log('🔑 AuthPage: Firebase token found in URL, attempting auto-login...');
      handleSessionTokenLogin(token);
    } else if (token && isAuthenticated) {
      console.log('🔑 AuthPage: User already authenticated, redirecting...');
      // If user is already authenticated but we have a token, just redirect
      const redirectPath = urlParams.get('redirect') || '/aicoach';
      navigate(redirectPath, { replace: true });
    }
  }, [location.search, isAuthenticated, isLoading, navigate, urlParams]);

  // Handle Shopify customer authentication
  useEffect(() => {
    const handleSessionTransfer = async () => {
      console.log('🔍 DEBUG: AuthPage useEffect triggered');
      console.log('🔍 DEBUG: Current URL:', window.location.href);
      console.log('🔍 DEBUG: URL search params:', window.location.search);
      console.log('🔍 DEBUG: isAuthenticated:', isAuthenticated);
      console.log('🔍 DEBUG: isLoading:', isLoading);
      
      // Clear any existing session processing flag on fresh load
      if (window.location.search.includes('sessionTransfer=true')) {
        sessionStorage.removeItem('sessionTransferProcessed');
        console.log('🔄 DEBUG: Cleared session processing flag for fresh session transfer');
      }
      
      // Check if we've already processed this session transfer
      const sessionProcessed = sessionStorage.getItem('sessionTransferProcessed');
      if (sessionProcessed) {
        console.log('⏭️ DEBUG: Session transfer already processed, skipping...');
        return;
      }
      
      // Check for session transfer parameters
      let sessionTransfer = urlParams.get('sessionTransfer');
      let email = urlParams.get('email');
      let customerId = urlParams.get('customerId');
      let autoLogin = urlParams.get('autoLogin');
      let redirect = urlParams.get('redirect');
      
      // Check if parameters are encoded in the redirect parameter
      if (redirect && !email && !customerId) {
        console.log('🔍 DEBUG: Parameters might be in redirect URL, checking...');
        console.log('🔍 DEBUG: Redirect parameter:', redirect);
        
        try {
          // Decode the redirect parameter
          const decodedRedirect = decodeURIComponent(redirect);
          console.log('🔍 DEBUG: Decoded redirect:', decodedRedirect);
          
          // Check if it contains the aicoach path with parameters
          if (decodedRedirect.includes('/aicoach?')) {
            const redirectParams = new URLSearchParams(decodedRedirect.split('?')[1]);
            console.log('🔍 DEBUG: Redirect parameters:', redirectParams.toString());
            
            // Extract parameters from redirect URL
            const redirectEmail = redirectParams.get('email');
            const redirectCustomerId = redirectParams.get('customerId');
            const redirectSessionTransfer = redirectParams.get('sessionTransfer');
            
            console.log('🔍 DEBUG: Extracted from redirect:');
            console.log('  - email:', redirectEmail);
            console.log('  - customerId:', redirectCustomerId);
            console.log('  - sessionTransfer:', redirectSessionTransfer);
            
            // Use redirect parameters if they exist
            if (redirectEmail) email = redirectEmail;
            if (redirectCustomerId) customerId = redirectCustomerId;
            if (redirectSessionTransfer) sessionTransfer = redirectSessionTransfer;
          }
        } catch (error) {
          console.error('❌ DEBUG: Error decoding redirect parameter:', error);
        }
      }
      
      console.log('🔍 DEBUG: Final URL Parameters:');
      console.log('  - sessionTransfer:', sessionTransfer);
      console.log('  - email:', email);
      console.log('  - customerId:', customerId);
      console.log('  - autoLogin:', autoLogin);
      console.log('  - redirect:', redirect);
      
      if (sessionTransfer === 'true' && email && customerId) {
        console.log('✅ DEBUG: Session transfer conditions met - starting auto-login...');
        console.log('✅ DEBUG: Email from URL:', email);
        console.log('✅ DEBUG: Customer ID from URL:', customerId);
        
        // Mark session transfer as being processed
        sessionStorage.setItem('sessionTransferProcessed', 'true');
        
        await handleShopifyCustomerLogin(email, customerId);
      } else if (autoLogin === 'true' && email && customerId) {
        console.log('✅ DEBUG: Auto-login conditions met - starting auto-login...');
        console.log('✅ DEBUG: Email from URL:', email);
        console.log('✅ DEBUG: Customer ID from URL:', customerId);
        await handleShopifyCustomerLogin(email, customerId);
      } else {
        console.log('❌ DEBUG: Session transfer conditions NOT met:');
        console.log('  - sessionTransfer === "true":', sessionTransfer === 'true');
        console.log('  - email exists:', !!email);
        console.log('  - customerId exists:', !!customerId);
        console.log('  - autoLogin === "true":', autoLogin === 'true');
      }
    };
    
    // Only run if user is not already authenticated
    if (!isAuthenticated && !isLoading) {
      console.log('🚀 DEBUG: Starting session transfer check...');
      handleSessionTransfer();
    } else {
      console.log('⏭️ DEBUG: Skipping session transfer check - user authenticated or loading');
    }
  }, [urlParams, isAuthenticated, isLoading]);

  // Handle URL parameters for pre-filling email and messages
  useEffect(() => {
    const emailParam = urlParams.get('email');
    const messageParam = urlParams.get('message');
    const customerIdParam = urlParams.get('customerId');
    const tokenVerified = urlParams.get('tokenVerified');
    const isSignUpParam = urlParams.get('isSignUp');
    
    if (emailParam) {
      setEmail(emailParam);
      console.log('📧 AuthPage: Prefilled email from URL:', emailParam);
    }
    
    if (customerIdParam) {
      console.log('🛍️ AuthPage: Shopify Customer ID from URL:', customerIdParam);
      // Store customer ID for potential use
      localStorage.setItem('shopifyCustomerId', customerIdParam);
    }
    
    if (messageParam) {
      setSuccess(decodeURIComponent(messageParam));
      console.log('💬 AuthPage: Welcome message from URL:', messageParam);
    }
    
    if (tokenVerified === 'true') {
      console.log('✅ AuthPage: Token verified, user should be able to login easily');
      // You could add special styling or behavior for verified users here
    }
    
    if (isSignUpParam === 'true') {
      console.log('📝 AuthPage: Switching to sign-up mode for new user');
      setIsLogin(false);
    }
  }, [urlParams]);

  // Effect to handle auto-retry for manual login
  useEffect(() => {
    const performRetry = async () => {
      if (retryData && retryData.shouldRetry) {
        console.log('Automatically retrying login with same credentials...');
        setLoading(true);
        setError('');
        
        try {
          // Small delay to ensure UI feedback
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Try login again with same credentials
          const user = await loginUser(retryData.email, retryData.password);
          
          // Check if user was just mapped from Shopify to Firebase
          if (user.justMapped) {
            setSuccess('Your Shopify account has been successfully connected!');
            setTimeout(() => {
              checkUserTypeAndNavigate(user.uid);
            }, 1000);
          } else {
            checkUserTypeAndNavigate(user.uid);
          }
        } catch (retryError) {
          console.error('Retry login failed:', retryError);
          setError(retryError.message);
        } finally {
          setLoading(false);
          setRetryData(null); // Clear retry data
        }
      }
    };
    
    performRetry();
  }, [retryData]);

  // ===== FORM HANDLERS =====

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setShowLoginHint(false);

    try {
      if (!isLogin) {
        // Validate password for registration
        const strength = validatePassword(password);
        if (strength.score < 4) {
          setError('Password must meet all requirements');
          setLoading(false);
          return;
        }

        await handleManualSignUp(email, password, firstName, lastName, isEvaCustomer);

      } else if (isForgotPassword) {
        await sendPasswordResetEmail(email);
        setSuccess('Password reset email sent. Please check your inbox.');
        setIsForgotPassword(false);
      } else {
        // Client-side validation for login inputs
        const emailValid = isValidEmail(email);
        const passwordValid = typeof password === 'string' && password.length >= 6;

        if (!emailValid && !passwordValid) {
          setError('Please enter a valid email address and password');
          setLoading(false);
          return;
        }
        if (!emailValid) {
          setError('Please enter a valid email address');
          setLoading(false);
          return;
        }
        if (!passwordValid) {
          setError('Password must be at least 6 characters long');
          setLoading(false);
          return;
        }

        await handleManualSignIn(email, password);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      if (!retryData) {
      setLoading(false);
      }
    }
  };

  // Handle tab switch
  const handleTabSwitch = (isLoginTab) => {
    setIsLogin(isLoginTab);
    setError('');
    setSuccess('');
    setRetryData(null);
    setShowLoginHint(false);
    setPassword('');
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Left Side - Image */}
        <div className="auth-image-section">
          <div
            className="auth-image-container"
            style={{
              backgroundImage: !isLogin && !isForgotPassword ? `url(${signupBg})` : undefined
            }}
          >
            <div className="auth-logo-overlay">
              <img src={logoImage} alt="ELEFIT Logo" className="logo-image" />
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="auth-form-section">
          <div className="auth-header">
            <h1>{isForgotPassword ? 'Reset Password' : isLogin ? 'Welcome Back!' : 'Create Account'}</h1>
            <p>
              {isForgotPassword
                ? 'Enter your email to reset your password'
                : isLogin
                ? 'Sign in to access your account'
                : 'Join our community of nutrition experts'}
            </p>
          </div>

          {isLogin && !isForgotPassword && (
            <div className="password-tips">
              <h3>Password Tips:</h3>
              <p>If you have a Shopify account, use your Shopify password. If you created an account directly here, use your account password.</p>
            </div>
          )}

          {/* Session Token Authentication Messages */}
          {sessionTokenError && (
            <div className="auth-error">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {sessionTokenError}
            </div>
          )}

          {sessionTokenSuccess && (
            <div className="auth-success">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              {sessionTokenSuccess}
            </div>
          )}

          {/* Manual Authentication Messages */}
          {error && (
            <div className="auth-error">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="auth-success">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              {success}
            </div>
          )}

          {showLoginHint && (
            <div className="auth-info">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Setting up your account, please wait...
            </div>
          )}

        {urlParams.get('tokenVerified') === 'true' && (
          <div className="auth-success">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Your account has been verified! Please sign in to continue.
          </div>
        )}

          {sessionTokenLoading && (
          <div className="auth-info">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            {urlParams.get('token') ? 'Authenticating with token, please wait...' : 'Processing authentication, please wait...'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && !isForgotPassword && (
            <>
              <div className="form-group">
                <label htmlFor="firstName">
                  First Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  required
                  disabled={loading || sessionTokenLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">
                  Last Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  required
                  disabled={loading || sessionTokenLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="evaCustomer">
                  Are you an EVA customer? <span className="required-star">*</span>
                </label>
                <select
                  id="evaCustomer"
                  value={isEvaCustomer}
                  onChange={(e) => setIsEvaCustomer(e.target.value === 'true')}
                  required
                  disabled={loading || sessionTokenLoading}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="email">
              Email Address {!isLogin && <span className="required-star">*</span>}
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading || sessionTokenLoading}
            />
          </div>

          {!isForgotPassword && (
            <div className="form-group">
              <label htmlFor="password">
                Password {!isLogin && <span className="required-star">*</span>}
              </label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder={isLogin ? 'Enter your password' : 'Create a password'}
                  required
                  disabled={loading || sessionTokenLoading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {!isLogin && (
                <div className="password-strength">
                  <div className={`strength-bar ${passwordStrength.score >= 1 ? 'active' : ''}`}></div>
                  <div className={`strength-bar ${passwordStrength.score >= 2 ? 'active' : ''}`}></div>
                  <div className={`strength-bar ${passwordStrength.score >= 3 ? 'active' : ''}`}></div>
                  <div className={`strength-bar ${passwordStrength.score >= 4 ? 'active' : ''}`}></div>
                  <div className={`strength-bar ${passwordStrength.score >= 5 ? 'active' : ''}`}></div>
                  
                  <div className="password-requirements">
                    <p className={passwordStrength.hasMinLength ? 'met' : ''}>
                      ✓ At least 8 characters
                    </p>
                    <p className={passwordStrength.hasUpperCase ? 'met' : ''}>
                      ✓ One uppercase letter
                    </p>
                    <p className={passwordStrength.hasLowerCase ? 'met' : ''}>
                      ✓ One lowercase letter
                    </p>
                    <p className={passwordStrength.hasNumber ? 'met' : ''}>
                      ✓ One number
                    </p>
                    <p className={passwordStrength.hasSpecialChar ? 'met' : ''}>
                      ✓ One special character
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {isLogin && !isForgotPassword && (
            <div className="forgot-password">
              <button
                type="button"
                className="forgot-link"
                onClick={() => {
                  setIsForgotPassword(true);
                  setError('');
                  setSuccess('');
                }}
                disabled={loading || sessionTokenLoading}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button type="submit" className="auth-button" disabled={loading || sessionTokenLoading}>
            {loading ? (
              isForgotPassword ? 'Resetting...' :
              isLogin && retryData ? 'Connecting account...' :
              isLogin ? 'Authenticating...' :
              'Processing...'
            ) : sessionTokenLoading ? (
              'Processing authentication...'
            ) : (
              isForgotPassword ? 'Reset Password' :
              isLogin ? 'Sign In' :
              'Create Account'
            )}
          </button>

          {isLogin && !isForgotPassword && (
            <div className="signup-link">
              Don't have an Account? <button
                type="button"
                className="signup-button"
                onClick={() => handleTabSwitch(false)}
                disabled={loading || sessionTokenLoading}
              >
                Sign up
              </button>
            </div>
          )}

          {!isLogin && !isForgotPassword && (
            <div className="signup-link">
              Already have an account? <button
                type="button"
                className="signup-button"
                onClick={() => handleTabSwitch(true)}
                disabled={loading || sessionTokenLoading}
              >
                Sign in
              </button>
            </div>
          )}

          {isForgotPassword && (
            <>
            <div className="auth-divider">
              <span>OR</span>
            </div>
            <button
              type="button"
                className="auth-button secondary"
              onClick={() => {
                setIsForgotPassword(false);
                setError('');
                setSuccess('');
              }}
                disabled={loading || sessionTokenLoading}
            >
              Back to Sign In
            </button>
            </>
          )}
        </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage; 