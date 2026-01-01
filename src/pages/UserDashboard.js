import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import bookingService from '../services/bookingService';
import LoadingSpinner from '../components/LoadingSpinner';
import ProfileImageUploader from '../components/ProfileImageUploader';
import PhoneVerification from '../components/PhoneVerification';
import PhoneNumberInput from '../components/PhoneNumberInput';
import { getProfileImageURL } from '../services/storageService';
import { useAuthContext } from '../contexts/AuthContext';
import './UserDashboard.css';


const UserDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Use AuthContext instead of local state
  const { user: currentUser, isAuthenticated, isLoading: authLoading, logout } = useAuthContext();
  const [userData, setUserData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    age: '',
    gender: '',
    height: '',
    heightUnit: 'cm',
    weight: '',
    weightUnit: 'kg',
    activityLevel: '',
    targetWeight: '',
    targetWeightUnit: 'kg',
    targetTimeline: '',
    targetTimelineUnit: 'weeks',
    healthGoals: '',
    dietaryRestrictions: '',
    allergies: ''
  });
  const [formErrors, setFormErrors] = useState({
    age: '',
    height: '',
    weight: '',
    phone: ''
  });
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isEvaCustomer, setIsEvaCustomer] = useState(false);
  const [phoneVerificationStatus, setPhoneVerificationStatus] = useState({
    isVerified: false,
    phoneNumber: '',
    verificationResult: null
  });

  // Load user data when authentication state changes
  useEffect(() => {
    const loadUserData = async () => {
      if (isAuthenticated && currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setIsEvaCustomer(data.isEvaCustomer || false);
            setFormData({
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              email: data.email || currentUser.email || '',
              phone: data.phone || '',
              age: data.age || '',
              gender: data.gender || '',
              height: data.height || '',
              heightUnit: data.heightUnit || 'cm',
              weight: data.weight || '',
              weightUnit: data.weightUnit || 'kg',
              activityLevel: data.activityLevel || '',
              targetWeight: data.targetWeight || '',
              targetWeightUnit: data.targetWeightUnit || 'kg',
              targetTimeline: data.targetTimeline || '',
              targetTimelineUnit: data.targetTimelineUnit || 'weeks',
              healthGoals: data.healthGoals || '',
              dietaryRestrictions: data.dietaryRestrictions || '',
              allergies: data.allergies || ''
            });

            // Load phone verification status
            setPhoneVerificationStatus({
              isVerified: data.phoneVerified || false,
              phoneNumber: data.phone || '',
              verificationResult: data.phoneVerificationResult || null
            });
            setPhoneVerified(data.phoneVerified || false);

            // Get profile image if it exists
            if (currentUser.uid) {
              try {
                const imageUrl = await getProfileImageURL(currentUser.uid);
                setProfileImageUrl(imageUrl);
              } catch (error) {
                console.error('Error fetching profile image:', error);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setError('Failed to load user data');
        } finally {
          setLoading(false);
        }
      } else if (!authLoading) {
        // Only redirect if auth is not loading and user is not authenticated
        navigate('/auth');
      }
    };

    loadUserData();
  }, [isAuthenticated, currentUser, authLoading, navigate, lastRefresh]);

  // Refresh bookings whenever the component mounts or when returning to this page 
  // or when lastRefresh changes
  useEffect(() => {
    if (currentUser && currentUser.uid) {
      // Check if we need to refresh bookings based on navigation state
      if (location.state && location.state.refreshBookings) {
        // Clear the state so future navigations don't trigger refresh unnecessarily
        navigate(location.pathname, { replace: true, state: {} });
        fetchUserBookings(currentUser.uid);
      } else {
        fetchUserBookings(currentUser.uid);
      }
    }
  }, [location.key, lastRefresh, currentUser, navigate]);

  // Refresh profile image if the URL changes
  useEffect(() => {
    if (profileImageUrl) {
      const img = new Image();
      img.src = profileImageUrl;
      img.onload = () => {
        // Image loaded successfully, no need to do anything
      };
      img.onerror = () => {
        // If the image fails to load, try to fetch it again
        if (currentUser && currentUser.uid) {
          fetchProfileImage(currentUser.email);
        }
      };
    }
  }, [profileImageUrl, currentUser]);

  const fetchUserData = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnapshot = await getDoc(userRef);

      if (userSnapshot.exists()) {
        const data = userSnapshot.data();

        // Check if user is an expert - if so, redirect to expert dashboard
        if (data.userType === 'expert') {
          navigate('/expert-dashboard');
          return;
        }

        setUserData(data);
        // Initialize form data with user data
        setFormData({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
          age: data.age || '',
          gender: data.gender || '',
          height: data.height || '',
          heightUnit: data.heightUnit || 'cm',
          weight: data.weight || '',
          weightUnit: data.weightUnit || 'kg',
          activityLevel: data.activityLevel || '',
          targetWeight: '',
          targetWeightUnit: 'kg',
          targetTimeline: '',
          targetTimelineUnit: 'weeks',
          healthGoals: data.healthGoals || '',
          dietaryRestrictions: data.dietaryRestrictions || '',
          allergies: data.allergies || ''
        });
        setIsEvaCustomer(data.isEvaCustomer || false);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBookings = async (userId) => {
    try {
      setLoadingBookings(true);
      const userBookings = await bookingService.getUserBookings(userId);
      setBookings(userBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setError('Failed to load your bookings. Please try again.');
    } finally {
      setLoadingBookings(false);
    }
  };

  const fetchProfileImage = async (email) => {
    try {
      if (currentUser && currentUser.uid) {
        // Try to get image from cache first
        const cachedImageKey = `profileImage_${currentUser.uid}`;
        const cachedData = localStorage.getItem(cachedImageKey);

        if (cachedData) {
          try {
            const { url, timestamp } = JSON.parse(cachedData);
            // Check if cache is less than 24 hours old
            const now = new Date().getTime();
            if (now - timestamp < 86400000) {
              console.log('Using cached profile image in UserDashboard');
              setProfileImageUrl(url);
              return;
            } else {
              // Cache expired, remove it
              localStorage.removeItem(cachedImageKey);
            }
          } catch (error) {
            console.error('Error parsing cached profile image:', error);
          }
        }

        // If not in cache or expired, fetch from storage
        console.log('Fetching profile image from storage in UserDashboard');
        const imageUrl = await getProfileImageURL(currentUser.uid);
        if (imageUrl) {
          setProfileImageUrl(imageUrl);

          // Save to cache
          try {
            localStorage.setItem(cachedImageKey, JSON.stringify({
              url: imageUrl,
              timestamp: new Date().getTime()
            }));
          } catch (error) {
            console.error('Error saving profile image to cache:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching profile image:', error);
    }
  };

  const handleProfileImageUploaded = (url) => {
    setProfileImageUrl(url);
  };

  // Function to manually refresh bookings
  const refreshBookings = () => {
    if (currentUser && currentUser.uid) {
      setLastRefresh(Date.now());
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await bookingService.cancelBooking(bookingId);
      // Update bookings state
      setBookings(prevBookings =>
        prevBookings.map(booking =>
          booking.id === bookingId
            ? { ...booking, status: 'cancelled' }
            : booking
        )
      );
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setError('Failed to cancel booking. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      // Clear verified customer session
      localStorage.removeItem('verifiedCustomerSession');

      // Use the logout function from AuthContext
      const result = await logout();

      if (result.success) {
        console.log('Logout successful');
        navigate('/auth');
      } else {
        console.error('Logout failed:', result.error);
        // Fallback to direct signOut if context logout fails
        await signOut(auth);
        navigate('/auth');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to log out. Please try again.');
      // Fallback to direct signOut if context logout fails
      await signOut(auth);
      navigate('/auth');
    }
  };

  // Helper function to format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form data to current user data
    if (userData) {
      setFormData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phone: userData.phone || '',
        age: userData.age || '',
        gender: userData.gender || '',
        height: userData.height || '',
        heightUnit: userData.heightUnit || 'cm',
        weight: userData.weight || '',
        weightUnit: userData.weightUnit || 'kg',
        activityLevel: userData.activityLevel || '',
        targetWeight: userData.targetWeight || '',
        targetWeightUnit: userData.targetWeightUnit || 'kg',
        targetTimeline: userData.targetTimeline || '',
        targetTimelineUnit: userData.targetTimelineUnit || 'weeks',
        healthGoals: userData.healthGoals || '',
        dietaryRestrictions: userData.dietaryRestrictions || '',
        allergies: userData.allergies || ''
      });
      // Clear errors
      setFormErrors({ age: '', height: '', weight: '', phone: '' });
    }
  };

  // Validation functions
  const validateAge = (age) => {
    const ageNum = parseFloat(age);

    if (!age || age === '') {
      setFormErrors(prev => ({ ...prev, age: '' }));
      return;
    }

    if (isNaN(ageNum)) {
      setFormErrors(prev => ({ ...prev, age: 'Please enter a valid age' }));
      return;
    }

    if (ageNum < 13) {
      setFormErrors(prev => ({ ...prev, age: 'Age must be at least 13 years' }));
      return;
    }

    if (ageNum > 120) {
      setFormErrors(prev => ({ ...prev, age: 'Age must be less than 120 years' }));
      return;
    }

    setFormErrors(prev => ({ ...prev, age: '' }));
  };

  const validateHeight = (height, unit) => {
    const heightNum = parseFloat(height);

    if (!height || height === '') {
      setFormErrors(prev => ({ ...prev, height: '' }));
      return;
    }

    if (isNaN(heightNum)) {
      setFormErrors(prev => ({ ...prev, height: 'Please enter a valid height' }));
      return;
    }

    if (unit === 'cm') {
      if (heightNum < 90) {
        setFormErrors(prev => ({ ...prev, height: 'Height must be at least 90 cm' }));
        return;
      }
      if (heightNum > 250) {
        setFormErrors(prev => ({ ...prev, height: 'Height must be less than 250 cm' }));
        return;
      }
    } else if (unit === 'ft') {
      if (heightNum < 3) {
        setFormErrors(prev => ({ ...prev, height: 'Height must be at least 3 ft' }));
        return;
      }
      if (heightNum > 8) {
        setFormErrors(prev => ({ ...prev, height: 'Height must be less than 8 ft' }));
        return;
      }
    }

    setFormErrors(prev => ({ ...prev, height: '' }));
  };

  const validateWeight = (weight, unit) => {
    const weightNum = parseFloat(weight);

    if (!weight || weight === '') {
      setFormErrors(prev => ({ ...prev, weight: '' }));
      return;
    }

    if (isNaN(weightNum)) {
      setFormErrors(prev => ({ ...prev, weight: 'Please enter a valid weight' }));
      return;
    }

    if (weightNum <= 0) {
      setFormErrors(prev => ({ ...prev, weight: 'Weight must be greater than 0' }));
      return;
    }

    if (unit === 'kg') {
      if (weightNum < 30) {
        setFormErrors(prev => ({ ...prev, weight: 'Weight must be at least 30 kg' }));
        return;
      }
      if (weightNum > 650) {
        setFormErrors(prev => ({ ...prev, weight: 'Weight must be less than 650 kg' }));
        return;
      }
    } else if (unit === 'lbs') {
      if (weightNum < 66) {
        setFormErrors(prev => ({ ...prev, weight: 'Weight must be at least 66 lbs' }));
        return;
      }
      if (weightNum > 1433) {
        setFormErrors(prev => ({ ...prev, weight: 'Weight must be less than 1433 lbs' }));
        return;
      }
    }

    setFormErrors(prev => ({ ...prev, weight: '' }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Validate age
    if (name === 'age') {
      validateAge(value);
    }

    // Validate height with unit
    if (name === 'height' || name === 'heightUnit') {
      const height = name === 'height' ? value : formData.height;
      const unit = name === 'heightUnit' ? value : formData.heightUnit;
      validateHeight(height, unit);
    }

    // Validate weight with unit
    if (name === 'weight' || name === 'weightUnit') {
      const weight = name === 'weight' ? value : formData.weight;
      const unit = name === 'weightUnit' ? value : formData.weightUnit;
      validateWeight(weight, unit);
    }
  };

  const handlePhoneChange = (phoneNumber) => {
    setFormData(prev => ({
      ...prev,
      phone: phoneNumber
    }));
  };

  const handlePhoneValidation = (validation) => {
    setFormErrors(prev => ({
      ...prev,
      phone: validation.isValid ? '' : validation.error
    }));
  };

  const handlePhoneVerificationStatus = async (verification) => {
    // Handle phone verification status
    console.log('Phone verification status:', verification);
    setPhoneVerificationStatus(verification);
    setPhoneVerified(verification.isVerified);

    // Update form data with verified phone number while preserving email
    if (verification.isVerified && verification.phoneNumber) {
      setFormData(prev => ({
        ...prev,
        phone: verification.phoneNumber
        // Email is preserved from currentUser.email and not overwritten
      }));

      // Update local user data with verification status
      if (currentUser && verification.verifiedForExistingUser) {
        try {
          // Update local user data
          setUserData(prev => ({
            ...prev,
            phone: verification.phoneNumber,
            phoneVerified: true,
            phoneVerificationDate: new Date()
          }));

          console.log('User phone verification status updated locally');

          // Show success message
          setMessage({
            text: 'Phone number verified successfully! Your profile has been updated.',
            type: 'success'
          });

          // Clear message after 3 seconds
          setTimeout(() => {
            setMessage({ text: '', type: '' });
          }, 3000);

        } catch (error) {
          console.error('Error updating user phone verification status:', error);
          setMessage({
            text: 'Phone verified but failed to update profile. Please refresh the page.',
            type: 'error'
          });
        }
      }
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage({ text: '', type: '' });

    try {
      // Validate all fields before saving
      validateAge(formData.age);
      validateHeight(formData.height, formData.heightUnit);
      validateWeight(formData.weight, formData.weightUnit);

      // Check if there are any validation errors
      if (formErrors.age || formErrors.height || formErrors.weight || formErrors.phone) {
        setIsSaving(false);
        return;
      }

      // Sanitize phoneVerificationResult to remove UserImpl objects
      let sanitizedVerificationResult = null;
      if (phoneVerificationStatus.verificationResult) {
        sanitizedVerificationResult = {
          success: phoneVerificationStatus.verificationResult.success || false,
          phoneNumber: phoneVerificationStatus.verificationResult.phoneNumber || '',
          verificationId: phoneVerificationStatus.verificationResult.verificationId || '',
          // Remove any UserImpl objects or other non-serializable data
        };
      }

      const userRef = doc(db, 'users', currentUser.uid);
      // Exclude timeline and workout days from being saved (keeping target weight)
      const { targetTimeline, targetTimelineUnit, workoutDays, ...dataToSave } = formData;
      await updateDoc(userRef, {
        ...dataToSave,
        email: currentUser.email, // Always preserve the email from Firebase Auth
        phoneVerified: phoneVerificationStatus.isVerified,
        phoneVerificationResult: sanitizedVerificationResult,
        updatedAt: new Date()
      });

      // ✅ Update userData in state
      setUserData({
        ...userData,
        ...dataToSave,
        email: currentUser.email, // Always preserve the email from Firebase Auth
        phoneVerified: phoneVerificationStatus.isVerified,
        phoneVerificationResult: sanitizedVerificationResult
      });

      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ text: 'Failed to update profile. Please try again.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };


  const handlePhoneVerification = (success) => {
    setPhoneVerified(success);
    if (success) {
      setShowPhoneVerification(false);
    }
  };

  const getActivityLevelDisplayName = (level) => {
    const activityLevels = {
      'sedentary': 'Sedentary',
      'lightly-active': 'Lightly Active',
      'moderately-active': 'Moderately Active',
      'very-active': 'Very Active',
      'extra-active': 'Extra Active'
    };
    return activityLevels[level] || 'Not provided';
  };

  if (loading) {
    return <LoadingSpinner text="Loading..." />;
  }

  return (
    <div className="user-dashboard">
      <div className="dashboard-header">
        <h1>User Dashboard</h1>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="dashboard-content">
        <div className="profile-card">
          <div className="profile-image-container">
            <ProfileImageUploader
              currentImageUrl={profileImageUrl}
              email={currentUser?.email}
              userId={currentUser?.uid}
              userType="users"
              onImageUploaded={handleProfileImageUploaded}
              size="large"
            />
          </div>

          <div className="profile-header">
            <div className="profile-info">
              <h2>{userData?.firstName} {userData?.lastName}</h2>
              {isEvaCustomer && (
                <div className="eva-customer-badge">
                  EVA Customer
                </div>
              )}
            </div>
          </div>

          {showPhoneVerification && (
            <div className="phone-verification-modal">
              <div className="modal-content">
                <button
                  className="close-modal"
                  onClick={() => setShowPhoneVerification(false)}
                >
                  ×
                </button>
                <PhoneVerification
                  currentUser={currentUser}
                  onVerificationComplete={handlePhoneVerification}
                />
              </div>
            </div>
          )}

          <div className="dashboard-actions">

            {!isEditing && (
              <button
                className="action-button"
                onClick={() => setIsEditing(true)}
              >
                <i className="fas fa-edit"></i>
                Edit Profile
              </button>
            )}

          </div>

          <div className="profile-content">
            {!isEditing ? (
              <>
                <div className="profile-details">
                  <div className="profile-section">
                    <h3>Personal Information</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>First Name:</label>
                        <span>{userData?.firstName || currentUser?.displayName?.split(' ')[0] || 'Not provided'}</span>
                      </div>
                      <div className="info-item">
                        <label>Last Name:</label>
                        <span>{userData?.lastName || currentUser?.displayName?.split(' ')[1] || 'Not provided'}</span>
                      </div>
                      <div className="info-item">
                        <label>Email:</label>
                        <span>{currentUser?.email || 'Not provided'}</span>
                      </div>
                      <div className="info-item">
                        <label>Phone:</label>
                        <span>{userData?.phone || 'Not provided'}</span>
                      </div>
                      <div className="info-item">
                        <label>Age:</label>
                        <span>{userData?.age || 'Not provided'}</span>
                      </div>
                      <div className="info-item">
                        <label>Gender:</label>
                        <span>{userData?.gender || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="profile-section">
                    <h3>Health Information</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Height:</label>
                        <span>{userData?.height ? `${userData.height} ${userData.heightUnit || 'cm'}` : 'Not provided'}</span>
                      </div>
                      <div className="info-item">
                        <label>Weight:</label>
                        <span>{userData?.weight ? `${userData.weight} ${userData.weightUnit || 'kg'}` : 'Not provided'}</span>
                      </div>
                      <div className="info-item">
                        <label>Activity Level:</label>
                        <span>{getActivityLevelDisplayName(userData?.activityLevel)}</span>
                      </div>
                      <div className="info-item">
                        <label>Target Weight:</label>
                        <span>{userData?.targetWeight ? `${userData.targetWeight} ${userData.targetWeightUnit || 'kg'}` : 'Not provided'}</span>
                      </div>
                    </div>
                    <div className="info-item full-width">
                      <label>Health Goals:</label>
                      <p>{userData?.healthGoals || 'Not provided'}</p>
                    </div>
                    <div className="info-item full-width">
                      <label>Dietary Restrictions:</label>
                      <p>{userData?.dietaryRestrictions || 'Not provided'}</p>
                    </div>
                    <div className="info-item full-width">
                      <label>Allergies:</label>
                      <p>{userData?.allergies || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="edit-profile-form">
                <div className="form-section">
                  <h3>Personal Information</h3>
                  <div className="form-grid">
                    <div className="form-row">
                      <div className="form-group">
                        <label>First Name</label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          placeholder="Enter first name"
                        />
                      </div>
                      <div className="form-group">
                        <label>Last Name</label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          value={currentUser?.email || ''}
                          disabled
                          className="disabled-input"
                        />
                      </div>
                      <div className="form-group">
                        <PhoneNumberInput
                          value={formData.phone}
                          onChange={handlePhoneChange}
                          onValidationChange={handlePhoneValidation}
                          onVerificationChange={handlePhoneVerificationStatus}
                          placeholder="Enter phone number"
                          disabled={isSaving}
                          label="Phone"
                          showVerification={true}
                          isAlreadyVerified={phoneVerificationStatus.isVerified}
                          currentUser={currentUser}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Age</label>
                        <input
                          type="number"
                          name="age"
                          value={formData.age}
                          onChange={handleInputChange}
                          onBlur={(e) => validateAge(e.target.value)}
                          min="13"
                          max="120"
                          className={formErrors.age ? 'input-error' : ''}
                        />
                        {formErrors.age && <p className="error-message">{formErrors.age}</p>}
                      </div>
                      <div className="form-group">
                        <label>Gender</label>
                        <select name="gender" value={formData.gender} onChange={handleInputChange}>
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer-not-to-say">Prefer not to say</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Health Information</h3>
                  <div className="form-grid">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Height</label>
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                          <input
                            type="number"
                            name="height"
                            value={formData.height}
                            onChange={handleInputChange}
                            onBlur={(e) => validateHeight(e.target.value, formData.heightUnit)}
                            placeholder="Enter height"
                            className={formErrors.height ? 'input-error' : ''}
                            style={{
                              flex: '1 1 70%',
                              width: '70%'
                            }}
                          />
                          <select
                            name="heightUnit"
                            value={formData.heightUnit || 'cm'}
                            onChange={handleInputChange}
                            onBlur={(e) => validateHeight(formData.height, e.target.value)}
                            style={{
                              flex: '0 0 30%',
                              width: '30%',
                              padding: '12px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              fontSize: '16px',
                              color: '#374151',
                              background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="cm">cm</option>
                            <option value="ft">ft</option>
                          </select>
                        </div>
                        {formErrors.height && <p className="error-message">{formErrors.height}</p>}
                      </div>
                      <div className="form-group">
                        <label>Weight</label>
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                          <input
                            type="number"
                            name="weight"
                            value={formData.weight}
                            onChange={handleInputChange}
                            onBlur={(e) => validateWeight(e.target.value, formData.weightUnit)}
                            placeholder="Enter weight"
                            className={formErrors.weight ? 'input-error' : ''}
                            style={{
                              flex: '1 1 70%',
                              width: '70%'
                            }}
                          />
                          <select
                            name="weightUnit"
                            value={formData.weightUnit || 'kg'}
                            onChange={handleInputChange}
                            onBlur={(e) => validateWeight(formData.weight, e.target.value)}
                            style={{
                              flex: '0 0 30%',
                              width: '30%',
                              padding: '12px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              fontSize: '16px',
                              color: '#374151',
                              background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="kg">kg</option>
                            <option value="lbs">lbs</option>
                          </select>
                        </div>
                        {formErrors.weight && <p className="error-message">{formErrors.weight}</p>}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Target Weight</label>
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                          <input
                            type="number"
                            name="targetWeight"
                            value={formData.targetWeight}
                            onChange={handleInputChange}
                            placeholder="Enter target weight"
                            style={{
                              flex: '1 1 70%',
                              width: '70%'
                            }}
                          />
                          <select
                            name="targetWeightUnit"
                            value={formData.targetWeightUnit || 'kg'}
                            onChange={handleInputChange}
                            style={{
                              flex: '0 0 30%',
                              width: '30%',
                              padding: '12px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              fontSize: '16px',
                              color: '#374151',
                              background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          >
                            <option value="kg">kg</option>
                            <option value="lbs">lbs</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Activity Level</label>
                        <select
                          name="activityLevel"
                          value={formData.activityLevel}
                          onChange={handleInputChange}
                        >
                          <option value="">Select activity level</option>
                          <option value="sedentary">Sedentary</option>
                          <option value="lightly-active">Lightly Active</option>
                          <option value="moderately-active">Moderately Active</option>
                          <option value="very-active">Very Active</option>
                          <option value="extra-active">Extra Active</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Additional Information</h3>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Health Goals</label>
                      <textarea
                        name="healthGoals"
                        value={formData.healthGoals}
                        onChange={handleInputChange}
                        placeholder="Describe your health goals"
                        rows="3"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Dietary Restrictions</label>
                      <textarea
                        name="dietaryRestrictions"
                        value={formData.dietaryRestrictions}
                        onChange={handleInputChange}
                        placeholder="List any dietary restrictions"
                        rows="3"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Allergies</label>
                      <textarea
                        name="allergies"
                        value={formData.allergies}
                        onChange={handleInputChange}
                        placeholder="List any allergies"
                        rows="3"
                      />
                    </div>
                  </div>
                </div>

                <div className="edit-actions">
                  <button className="cancel-button" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                  <button
                    className="cancel-button " style={{ backgroundColor: '#C8DA2B', color: 'black' }}
                    onClick={handleSaveProfile}
                    disabled={isSaving || formErrors.age || formErrors.height || formErrors.weight || formErrors.phone}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>



        <div className="dashboard-section appointments-section">
          <div className="section-header">
            <h3>My Appointments</h3>
            <button
              className="refresh-button"
              onClick={refreshBookings}
              disabled={loadingBookings}
            >
              {loadingBookings ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loadingBookings ? (
            <div className="loading-bookings">Loading your appointments...</div>
          ) : bookings.length === 0 ? (
            <div className="empty-state">
              <p className="no-appointments">You don't have any upcoming appointments.</p>
              <button
                className="action-button"
                onClick={() => navigate('/experts')}
              >
                Book an Appointment
              </button>
            </div>
          ) : (
            <>
              <div className="bookings-container">
                <div className="bookings-group">
                  <h4>Pending Confirmations</h4>
                  {bookings.filter(b => b.status === 'pending').length > 0 ? (
                    <div className="bookings-cards">
                      {bookings
                        .filter(booking => booking.status === 'pending')
                        .map(booking => (
                          <div key={booking.id} className="booking-card pending">
                            <div className="booking-header">
                              <h5>Appointment with {booking.expertName}</h5>
                              <span className="booking-status">Awaiting Confirmation</span>
                            </div>
                            <div className="booking-details">
                              <p><strong>Time:</strong> {booking.slotTime}</p>
                              <p><strong>Requested:</strong> {formatDate(booking.createdAt)}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="empty-message">No pending appointments</p>
                  )}
                </div>

                <div className="bookings-group">
                  <h4>Upcoming Appointments</h4>
                  {bookings.filter(b => b.status === 'confirmed').length > 0 ? (
                    <div className="bookings-cards">
                      {bookings
                        .filter(booking => booking.status === 'confirmed')
                        .map(booking => (
                          <div key={booking.id} className="booking-card confirmed">
                            <div className="booking-header">
                              <h5>Appointment with {booking.expertName}</h5>
                              <span className="booking-status">Confirmed</span>
                            </div>
                            <div className="booking-details">
                              <p><strong>Time:</strong> {booking.slotTime}</p>
                              <p><strong>Confirmed:</strong> {formatDate(booking.updatedAt)}</p>
                              {booking.meetingLink && (
                                <a
                                  href={booking.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="meeting-link"
                                >
                                  Join Meeting
                                </a>
                              )}
                              <button
                                className="meeting-link" style={{ backgroundColor: 'red', color: 'white', marginTop: '10px' }}
                                onClick={() => handleCancelBooking(booking.id)}
                              >
                                Cancel Appointment
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="empty-message">No confirmed appointments</p>
                  )}
                </div>

                {bookings.filter(b => b.status === 'rejected' || b.status === 'cancelled').length > 0 && (
                  <div className="bookings-group">
                    <h4>Past & Cancelled Appointments</h4>
                    <div className="bookings-cards">
                      {bookings
                        .filter(booking => booking.status === 'rejected' || booking.status === 'cancelled')
                        .map(booking => (
                          <div key={booking.id} className={`booking-card ${booking.status}`}>
                            <div className="booking-header">
                              <h5>Appointment with {booking.expertName}</h5>
                              <span className="booking-status">
                                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                              </span>
                            </div>
                            <div className="booking-details">
                              <p><strong>Time:</strong> {booking.slotTime}</p>
                              {booking.rejectionReason && (
                                <p><strong>Reason:</strong> {booking.rejectionReason}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="booking-cta">
                <button
                  className="action-button"
                  onClick={() => navigate('/experts')}
                >
                  Book New Appointment
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;



