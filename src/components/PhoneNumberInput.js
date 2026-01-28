import React, { useState, useEffect } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import { sendPhoneVerificationCode, verifyPhoneNumber, verifyOTPForExistingUser, checkFirebasePhoneAuthSetup } from '../services/firebase';
import 'react-phone-number-input/style.css';
import './PhoneNumberInput.css';

const PhoneNumberInput = ({ 
  value = '', 
  onChange, 
  onValidationChange,
  onVerificationChange,
  placeholder = 'Enter phone number',
  className = '',
  disabled = false,
  label = 'Phone',
  showVerification = true,
  isAlreadyVerified = false,
  currentUser = null
}) => {
  const [phoneNumber, setPhoneNumber] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(isAlreadyVerified);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [isLoadingOtp, setIsLoadingOtp] = useState(false);
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState(null);
  const [showChangeNumber, setShowChangeNumber] = useState(false);

  // Initialize phone number from value prop
  useEffect(() => {
    if (value !== phoneNumber) {
      setPhoneNumber(value);
    }
  }, [value, phoneNumber]);

  // Handle country change and reset validation
  useEffect(() => {
    // When country changes, reset validation if phone number is empty or just country code
    if (phoneNumber && phoneNumber.length <= 5) {
      setIsValid(true);
      setError('');
      if (onValidationChange) {
        onValidationChange({ 
          isValid: true, 
          error: null 
        });
      }
    }
  }, [phoneNumber, onValidationChange]);

  // Update verification status when prop changes
  useEffect(() => {
    setIsVerified(isAlreadyVerified);
    if (isAlreadyVerified && phoneNumber) {
      setVerifiedPhoneNumber(phoneNumber);
    }
  }, [isAlreadyVerified, phoneNumber]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up reCAPTCHA and confirmation result on unmount
      try {
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        }
        if (window.confirmationResult) {
          window.confirmationResult = null;
        }
      } catch (error) {
        console.warn('Error cleaning up phone verification:', error);
      }
    };
  }, []);

  const handlePhoneChange = (value) => {
    // If phone is verified and user is trying to change it, don't allow unless they clicked "Change Number"
    if (isVerified && verifiedPhoneNumber && value !== verifiedPhoneNumber && !showChangeNumber) {
      return; // Don't allow changes to verified phone number
    }
    
    setPhoneNumber(value || '');
    
    // Reset verification status when phone number changes (only if user explicitly changed it)
    if (showChangeNumber || !isVerified) {
      setIsVerified(false);
      setVerifiedPhoneNumber(null);
      setShowOtpInput(false);
      setOtpCode('');
      setVerificationId('');
      setShowChangeNumber(false);
    }
    
    // Call parent onChange
    if (onChange) {
      onChange(value || '');
    }
    
    // Validate phone number with better logic
    let valid = true;
    let errorMsg = '';
    
    if (value && value.trim()) {
      // Only validate if there's actual content
      const phoneDigits = value.replace(/\D/g, ''); // Remove all non-digits
      
      if (phoneDigits.length === 0) {
        // No digits entered yet, don't show error
        valid = true;
        errorMsg = '';
      } else if (phoneDigits.length < 4) {
        // Too few digits, show helpful message
        valid = false;
        errorMsg = 'Phone number is too short';
      } else {
        // Enough digits, validate with library
      try {
        valid = isValidPhoneNumber(value);
        if (!valid) {
            if (phoneDigits.length > 15) {
              errorMsg = 'Phone number is too long';
            } else {
          errorMsg = 'Please enter a valid phone number';
            }
        }
      } catch (error) {
        valid = false;
        errorMsg = 'Please enter a valid phone number';
      }
      }
    } else {
      // Empty value, no error
      valid = true;
      errorMsg = '';
    }
    
    setIsValid(valid);
    setError(errorMsg);
    
    // Call validation callback
    if (onValidationChange) {
      onValidationChange({ 
        isValid: valid, 
        error: errorMsg || null 
      });
    }
    
    // Call verification callback
    if (onVerificationChange) {
      onVerificationChange({ 
        isVerified: isVerified && value === verifiedPhoneNumber, 
        phoneNumber: value || '' 
      });
    }
  };

  const handleSendOtp = async () => {
    if (!phoneNumber || !isValid) {
      setError('Please enter a valid phone number first');
      return;
    }

    // Check for rate limiting
    const lastAttempt = localStorage.getItem('lastPhoneVerificationAttempt');
    const now = Date.now();
    if (lastAttempt && (now - parseInt(lastAttempt)) < 60000) { // 1 minute cooldown
      const remainingTime = Math.ceil((60000 - (now - parseInt(lastAttempt))) / 1000);
      setError(`Please wait ${remainingTime} seconds before trying again to avoid rate limiting.`);
      return;
    }

    setIsLoadingOtp(true);
    setError('');

    try {
      // Store attempt timestamp
      localStorage.setItem('lastPhoneVerificationAttempt', now.toString());

      // Store the phone number being verified globally for the verification function
      window.phoneNumberBeingVerified = phoneNumber;

      // Run diagnostics to help debug issues
      const diagnostics = checkFirebasePhoneAuthSetup();
      console.log('Starting phone verification with diagnostics:', diagnostics);

      // Check for common issues
      if (!diagnostics.httpsProtocol && diagnostics.domain !== 'localhost') {
        console.warn('Phone authentication may not work properly on non-HTTPS domains');
      }

      // Ensure reCAPTCHA container exists
      const containerId = 'recaptcha-container-phone';
      let container = document.getElementById(containerId);
      if (!container) {
        // Create container if it doesn't exist
        container = document.createElement('div');
        container.id = containerId;
        container.style.display = 'none'; // Hidden by default
        container.style.justifyContent = 'center';
        container.style.margin = '16px 0';
        
        // Find the phone input container and append
        const phoneContainer = document.querySelector('.phone-number-input-container');
        if (phoneContainer) {
          phoneContainer.appendChild(container);
        }
      }

      // Wait a moment for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 200));

      const verId = await sendPhoneVerificationCode(phoneNumber, containerId);
      setVerificationId(verId);
      setShowOtpInput(true);
      setError('');
      console.log('OTP sent successfully to:', phoneNumber);
    } catch (error) {
      console.error('Error sending OTP:', error);
      
      // Provide specific guidance for common errors
      let errorMessage = error.message;
      if (error.message.includes('invalid-app-credential')) {
        errorMessage = 'Phone authentication is not properly configured in Firebase Console. Please enable Phone provider in Authentication settings.';
      }
      
      setError(errorMessage || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoadingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      // For existing users, use the new OTP verification that doesn't disrupt the session
      let result;
      if (currentUser) {
        result = await verifyOTPForExistingUser(otpCode, currentUser, phoneNumber);
      } else {
        result = await verifyPhoneNumber(verificationId, otpCode, currentUser);
      }
      
        if (result.success) {
          setIsVerified(true);
          setVerifiedPhoneNumber(result.phoneNumber || phoneNumber);
          setShowOtpInput(false);
          setError('');
          
          // Call verification callback with sanitized result
          if (onVerificationChange) {
            const sanitizedResult = {
              success: result.success || false,
              phoneNumber: result.phoneNumber || phoneNumber,
              verificationId: verificationId,
              verifiedForExistingUser: result.verifiedForExistingUser || false,
              sessionPreserved: result.sessionPreserved || false,
              // Remove any UserImpl objects or other non-serializable data
            };
            
            onVerificationChange({ 
              isVerified: true, 
              phoneNumber: result.phoneNumber || phoneNumber,
              verificationResult: sanitizedResult 
            });
          }
        }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setError(error.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(value);
  };

  return (
    <div className={`phone-number-input-container ${className}`}>
      <label className="phone-label">{label}</label>
      
      <div className="phone-input-with-verification">
        <div className="phone-input-wrapper">
          <PhoneInput
            value={isVerified && verifiedPhoneNumber ? verifiedPhoneNumber : phoneNumber}
            onChange={handlePhoneChange}
            placeholder={placeholder}
            disabled={disabled || (isVerified && !showChangeNumber)}
            defaultCountry="US"
            international
            countryCallingCodeEditable={false}
            labels={{}}
            addInternationalOption={false}
            className={`phone-input-component ${!isValid ? 'error' : ''} ${isVerified ? 'verified' : ''}`}
          />
        </div>
        
        {showVerification && (phoneNumber || verifiedPhoneNumber) && isValid && (
          <div className="verification-section">
            {!isVerified ? (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isLoadingOtp || showOtpInput}
                className={`verify-button ${showOtpInput ? 'otp-sent' : ''}`}
                title={showOtpInput ? 'OTP Sent' : 'Verify Phone Number'}
              >
                {isLoadingOtp ? (
                  <div className="loading-spinner"></div>
                ) : showOtpInput ? (
                  '✓'
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1M10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z"/>
                  </svg>
                )}
              </button>
            ) : (
              <div className="verified-section">
                <div className="verified-badge" title="Phone number verified">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  <span>Verified</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChangeNumber(true)}
                  className="change-number-button"
                  title="Change phone number"
                >
                  Change
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showOtpInput && (
        <div className="otp-verification-section">
          <div className="otp-input-wrapper">
            <input
              type="text"
              value={otpCode}
              onChange={handleOtpChange}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="otp-input"
              disabled={isVerifying}
            />
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={isVerifying || otpCode.length !== 6}
              className="verify-otp-button"
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </button>
          </div>
          <p className="otp-help-text">
            Enter the 6-digit code sent to {phoneNumber}
          </p>
          <button
            type="button"
            onClick={() => {
              setShowOtpInput(false);
              setOtpCode('');
              setVerificationId('');
            }}
            className="cancel-otp-button"
            disabled={isVerifying}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Hidden reCAPTCHA container */}
      <div id="recaptcha-container-phone" className="recaptcha-container" style={{ display: 'none' }}></div>

      {error && (
        <div className="phone-error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default PhoneNumberInput;

