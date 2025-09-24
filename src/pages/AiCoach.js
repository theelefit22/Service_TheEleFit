import "./AiCoach.css";
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ref, push, serverTimestamp, get } from 'firebase/database';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { database, db, auth } from '../services/firebase';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { parsePrompt } from '../utils/promptParser';
import { cleanWorkoutContent, isRecommendationContent } from '../utils/test-parser';
import { useAuth } from '../hooks/useAuth';

const AIFitnessCoach = () => {
  console.log('🤖 AiCoach: Component rendered');
  console.log('🤖 AiCoach: Current URL:', window.location.href);
  console.log('🤖 AiCoach: URL search params:', window.location.search);
  
  // Navigation hook
  const navigate = useNavigate();
  
  // Get authentication state from AuthContext
  const { isAuthenticated, user, userType, isLoading: authLoading } = useAuth();
  
  // Debug logging
  console.log('🔍 AiCoach Debug - AuthContext state:', {
    isAuthenticated,
    user: user ? { email: user.email, uid: user.uid } : null,
    userType,
    authLoading
  });
  
  // Add error state for debugging
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // State management
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [showPlans, setShowPlans] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastProcessedGoal, setLastProcessedGoal] = useState('');
  const [openMealAccordion, setOpenMealAccordion] = useState('');
  const [openMealSubAccordion, setOpenMealSubAccordion] = useState('');
  const [openWorkoutAccordion, setOpenWorkoutAccordion] = useState('');
  const [currentPopupGoal, setCurrentPopupGoal] = useState(null);
  const [timeline, setTimeline] = useState(3);
  const [weeklySchedule, setWeeklySchedule] = useState(7);
  const [expectedResults, setExpectedResults] = useState('');
  const [endOfPlanSuggestion, setEndOfPlanSuggestion] = useState('');
  const [inputError, setInputError] = useState(false);
  const [inputLocked, setInputLocked] = useState(false);
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(false);
  const [customerData, setCustomerData] = useState(null);
  const [urlParams, setUrlParams] = useState(new URLSearchParams(window.location.search));
  const [naturalLanguagePrompt, setNaturalLanguagePrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    height: '',
    currentWeight: '',
    targetWeight: '',
    activityLevel: '',
    workoutDays: '',
    timeframe: '3'
  });
  const [warningMessage, setWarningMessage] = useState('');
  const [loadingStage, setLoadingStage] = useState(0);
  const [validationError, setValidationError] = useState('');
  const [showProfileSavePopup, setShowProfileSavePopup] = useState(false);
  const [extractedProfileData, setExtractedProfileData] = useState({});
  const [useExistingProfile, setUseExistingProfile] = useState(false);
  const [showProfileChoicePopup, setShowProfileChoicePopup] = useState(false);
  const [mealPlansByDay, setMealPlansByDay] = useState([]);
  const [workoutSections, setWorkoutSections] = useState([]);
  const [showProfileUpdatePopup, setShowProfileUpdatePopup] = useState(false);
  const [userProfileData, setUserProfileData] = useState(null);
  const [changedProfileFields, setChangedProfileFields] = useState({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorPopupMessage, setErrorPopupMessage] = useState('');
  
  // New states for the enhanced flow
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [calculatedCalories, setCalculatedCalories] = useState(null);
  const [showCalorieResults, setShowCalorieResults] = useState(false);
  const [showMealPlanChoice, setShowMealPlanChoice] = useState(false);
  const [showWorkoutPlanChoice, setShowWorkoutPlanChoice] = useState(false);
  const [noWorkoutPlan, setNoWorkoutPlan] = useState(false);
  const [mealPlanChoice, setMealPlanChoice] = useState(null); // Track meal plan choice
  const [workoutPlanChoice, setWorkoutPlanChoice] = useState(null); // Track workout plan choice
  const [streamingMealPlan, setStreamingMealPlan] = useState('');
  const [streamingWorkoutPlan, setStreamingWorkoutPlan] = useState('');
    const [isStreamingMeal, setIsStreamingMeal] = useState(false);
  const [isStreamingWorkout, setIsStreamingWorkout] = useState(false);
  const [incompleteExerciseBuffer, setIncompleteExerciseBuffer] = useState('');
  const [exerciseBuffer, setExerciseBuffer] = useState({});
  const [lastParsedLength, setLastParsedLength] = useState(0);
  const [newlyCreatedDays, setNewlyCreatedDays] = useState(new Set());
  const [personalizedSuggestions, setPersonalizedSuggestions] = useState('');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [openSuggestionsAccordion, setOpenSuggestionsAccordion] = useState(false);
  const [copyButtonClicked, setCopyButtonClicked] = useState(false);
  const [plansComplete, setPlansComplete] = useState(false);
  const [showWorkoutDaysConfirmation, setShowWorkoutDaysConfirmation] = useState(false);
  const [selectedWorkoutDays, setSelectedWorkoutDays] = useState(7);
  const [profileFormData, setProfileFormData] = useState({
     age: '',
     gender: '',
     height: '',
     currentWeight: '',
     targetWeight: '',
     activityLevel: '',
     targetTimeline: '3',
     workoutDays: '5',
     goal: ''
   });

  // Refs
  const loadingAnimationRef = useRef(null);
  const plansContainerRef = useRef(null);
  const mealAccordionRef = useRef(null);
  const workoutAccordionRef = useRef(null);

  // Function to hide/show popular goals
  const hidePopularGoals = () => {
    const setHide = true; // Set to false if you want to show popular goals
    return setHide;
  };

  // Handle Shopify token authentication and session transfer
  useEffect(() => {
    console.log('🤖 AiCoach: useEffect for token processing triggered');
    console.log('🤖 DEBUG: Component state:', {
      isCustomerLoggedIn,
      customerData,
      hasError,
      errorMessage
    });
    
    const handleShopifyToken = async () => {
      console.log('🔥 DEBUG: handleShopifyToken function CALLED');
      console.log('🔥 DEBUG: Current URL:', window.location.href);
      
      try {
        // Check for verified customer session data from localStorage first
        const verifiedSession = localStorage.getItem('verifiedCustomerSession');
        if (verifiedSession) {
          try {
            const sessionData = JSON.parse(verifiedSession);
            console.log('🔐 DEBUG: Found verified customer session data:', sessionData);
            
            // Check if session is still valid (within 30 minutes)
            const sessionAge = Date.now() - sessionData.timestamp;
            const maxAge = 30 * 60 * 1000; // 30 minutes
            
            if (sessionAge < maxAge && sessionData.verified) {
              console.log('✅ DEBUG: Valid verified customer session found, auto-logging in...');
              
              // Set the customer as logged in
              setIsCustomerLoggedIn(true);
              setCustomerData(sessionData);
              
              // Don't clear the session data - let useAuth hook manage it
              // localStorage.removeItem('verifiedCustomerSession');
              
              // Clear any URL parameters to prevent redirect loops
              const cleanUrl = window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
              console.log('🔄 DEBUG: Cleaned URL to prevent loops:', cleanUrl);
              
              console.log('✅ DEBUG: Customer auto-logged in successfully');
              return;
            } else {
              console.log('⏰ DEBUG: Verified customer session expired, clearing...');
              localStorage.removeItem('verifiedCustomerSession');
            }
          } catch (error) {
            console.error('❌ DEBUG: Error parsing verified customer session:', error);
            localStorage.removeItem('verifiedCustomerSession');
          }
        }
        
        const token = urlParams.get('token');
        const email = urlParams.get('email');
        const customerId = urlParams.get('customerId');
        const sessionTransfer = urlParams.get('sessionTransfer');
        
        console.log('🤖 DEBUG: AiCoach URL Parameters:');
        console.log('  - token:', token);
        console.log('  - email:', email);
        console.log('  - customerId:', customerId);
        console.log('  - sessionTransfer:', sessionTransfer);
        console.log('🤖 DEBUG: Session transfer conditions:');
        console.log('  - sessionTransfer === "true":', sessionTransfer === 'true');
        console.log('  - email exists:', !!email);
        console.log('  - customerId exists:', !!customerId);
        console.log('  - isCustomerLoggedIn:', isCustomerLoggedIn);
        console.log('  - All conditions met:', sessionTransfer === 'true' && email && customerId && !isCustomerLoggedIn);
        
        // Session transfer is now handled by AuthGuard
        if (sessionTransfer === 'true' && email && customerId) {
          console.log('🛍️ DEBUG: Session transfer detected, AuthGuard will handle redirect');
          return;
        }
        
        // If we have a token, redirect to auth page for processing
        if (token) {
          console.log('🤖 AiCoach: Token found, redirecting to auth page for processing...');
          const authUrl = `/auth?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(window.location.pathname)}`;
          window.location.href = authUrl;
          return;
        }
        
        // No special parameters, let AuthGuard handle authentication
        console.log('🤖 AiCoach: No special parameters, letting AuthGuard handle authentication');
        
      } catch (error) {
        console.error('❌ DEBUG: Error in handleShopifyToken:', error);
        setHasError(true);
        setErrorMessage('Authentication error. Redirecting...');
        // Fallback: redirect to auth page
        setTimeout(() => {
          window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}&error=Authentication error. Please try again.`;
        }, 2000);
      }
    };

    handleShopifyToken().catch(error => {
      console.error('🤖 AiCoach: Critical error in token processing:', error);
      setHasError(true);
      setErrorMessage('Authentication error. Redirecting...');
      // Fallback: redirect to auth page
      setTimeout(() => {
        window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}&error=Authentication error. Please try again.`;
      }, 2000);
    });
  }, [isCustomerLoggedIn, urlParams]); // Add urlParams to dependency array

  // Update urlParams when URL changes
  useEffect(() => {
    const updateUrlParams = () => {
      setUrlParams(new URLSearchParams(window.location.search));
    };
    
    // Update on mount
    updateUrlParams();
    
    // Listen for URL changes
    window.addEventListener('popstate', updateUrlParams);
    
    return () => {
      window.removeEventListener('popstate', updateUrlParams);
    };
  }, []);

  // Load user profile data on component mount
  useEffect(() => {
    const loadUserProfile = async () => {
      if (auth.currentUser) {
        try {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserProfileData(userData);
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      }
    };
    loadUserProfile();
  }, []);

  // Data
  const suggestions = [
    { text: "Lose Weight", icon: "fa-fire" },
    { text: "Build Muscle", icon: "fa-dumbbell" },
    { text: "Get Fit", icon: "fa-running" },
    { text: "Get Stronger", icon: "fa-mountain" },
    { text: "Stay Flexible", icon: "fa-stopwatch" },
    { text: "Be Athletic", icon: "fa-chart-line" }
  ];

  const goalData = {
    "Lose Weight": {
      icon: "fa-fire",
      color: "#e74c3c",
      description: "Focus on calorie deficit and cardio exercises to achieve sustainable weight loss."
    },
    "Build Muscle": {
      icon: "fa-dumbbell",
      color: "#3498db",
      description: "Combine strength training with proper nutrition to increase muscle mass."
    },
    "Get Fit": {
      icon: "fa-running",
      color: "#2ecc71",
      description: "Enhance your cardiovascular fitness through consistent aerobic exercises."
    },
    "Get Stronger": {
      icon: "fa-mountain",
      color: "#f1c40f",
      description: "Focus on progressive overload and compound movements for overall strength."
    },
    "Stay Flexible": {
      icon: "fa-stopwatch",
      color: "#9b59b6",
      description: "Incorporate stretching and mobility exercises for better range of motion."
    },
    "Be Athletic": {
      icon: "fa-chart-line",
      color: "#1abc9c",
      description: "Enhance your overall athletic abilities through targeted training programs."
    }
  };

  // Helper function to check if user declined both plans and navigate to thank you page
  const checkBothDeclinedAndNavigate = () => {
    if (mealPlanChoice === false && workoutPlanChoice === false) {
      navigate('/thank-you');
      return true;
    }
    return false;
  };

  // Utility functions
  const cleanText = (text) => {
    return text
      .replace(/[^\w\s.,()-:]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getApiUrl = (endpoint = 'chat') => {
    return `http://127.0.0.1:5002/${endpoint}`;
 
  };

  const cleanItemText = (text) => {
    return text
      .replace(/[^\w\s.,()-:]/g, '')
      .replace(/^[-–—•●◆◇▪▫■□★☆*]+\s*/, '')
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const formatResponse = (text) => {
    let cleaned = text
      .replace(/[│├─└┌┐•●◆◇▪▫■□★☆\[\]{}*]/g, '')
      .replace(/\s{3,}/g, '\n\n')
      .trim();
    
    cleaned = cleaned.replace(/(Day\s*\d+\s*[-:])/gi, '\n$1');
    cleaned = cleaned.replace(/MEAL_PLAN(?:\s+for\s+[\w\s]+)?:/gi, 'MEAL_PLAN:');
    cleaned = cleaned.replace(/WORKOUT_PLAN(?:\s+for\s+[\w\s]+)?:/gi, 'WORKOUT_PLAN:');
    cleaned = cleaned.replace(/\*\*MEAL PLAN\*\*/gi, 'MEAL_PLAN:');
    cleaned = cleaned.replace(/###\s*MEAL PLAN\s*/gi, 'MEAL_PLAN:');
    cleaned = cleaned.replace(/\*\*WORKOUT PLAN\*\*/gi, 'WORKOUT_PLAN:');
    cleaned = cleaned.replace(/###\s*WORKOUT PLAN\s*/gi, 'WORKOUT_PLAN:');
    cleaned = cleaned.replace(/\*\*Day\s*(\d+):\*\*\s*/gi, 'Day $1:');
    cleaned = cleaned.replace(/\*\*Total Daily Calories:\*\*\s*(\d+)/gi, 'Total Daily Calories: $1');
    cleaned = cleaned.replace(/\*\*Timeline:\*\*\s*(\d+)\s*months?/gi, 'Timeline: $1 months');
    cleaned = cleaned.replace(/\*\*Weekly Schedule:\*\*\s*(\d+)\s*days?/gi, 'Weekly Schedule: $1 days');
    cleaned = cleaned.replace(/\*\*Expected Results:\*\*\s*/gi, 'Expected Results: ');
    cleaned = cleaned.replace(/\*\*Day\s*(\d+)\s*-\s*([^:]+):\*\*/gi, 'Day $1 - $2:');
    cleaned = cleaned.replace(/\*\*/g, '');
    cleaned = cleaned.replace(/\*/g, '');
    cleaned = cleaned.replace(/---/g, '');
    
    if (cleaned.includes('MEAL_PLAN:') && cleaned.includes('WORKOUT_PLAN:')) {
      cleaned = cleaned.replace(/WORKOUT_PLAN:/g, '\n\nWORKOUT_PLAN:');
    }
    
    return cleaned;
  };

  // Enhanced profile data extraction using new prompt parser
  const extractProfileData = (prompt) => {
    const parsedData = parsePrompt(prompt);
    const data = {};
    
    // Only extract valid height values
    if (parsedData.height && parsedData.height > 0 && parsedData.height < 300) {
      data.height = Math.round(parsedData.height);
    }
    
    // Only extract valid weight values - keep decimal precision for weight
    if (parsedData.weight && parsedData.weight > 0 && parsedData.weight < 500) {
      // Keep one decimal place for weight
      data.weight = Math.round(parsedData.weight * 10) / 10;
    }
    
    // Extract age with validation
    if (parsedData.age && parsedData.age >= 13 && parsedData.age <= 120) {
      data.age = parsedData.age;
    }
    
    // Extract gender with validation
    if (parsedData.gender && ['male', 'female', 'other'].includes(parsedData.gender.toLowerCase())) {
      data.gender = parsedData.gender.toLowerCase();
    }
    
    // Map goal to health goals
    if (parsedData.goal) {
      const goalMapping = {
        'weight_loss': 'Lose Weight',
        'muscle_gain': 'Build Muscle',
        'toning': 'Get Fit',
        'weight_maintenance': 'Maintain Weight',
        'maintenance': 'Maintain Weight',
        'strength': 'Get Stronger',
        'endurance': 'Get Fit',
        'fitness': 'Get Fit',
        'body_recomposition': 'Get Fit',
        'recomposition': 'Get Fit'
      };
      data.healthGoals = goalMapping[parsedData.goal] || 'Get Fit';
    }
    
    // Extract activity level (prefer direct activity level over frequency mapping)
    if (parsedData.activityLevel) {
      data.activityLevel = parsedData.activityLevel;
    } else if (parsedData.frequency) {
      // Fallback: Map activity frequency to activity level
      if (parsedData.frequency <= 2) {
        data.activityLevel = 'lightly active';
      } else if (parsedData.frequency <= 4) {
        data.activityLevel = 'moderately active';
      } else if (parsedData.frequency <= 6) {
        data.activityLevel = 'very active';
      } else {
        data.activityLevel = 'extra active';
      }
    }
    
    // Map frequency to workoutDays
    if (parsedData.frequency) {
      data.workoutDays = parsedData.frequency.toString();
    }
    
    console.log('Extracted profile data from prompt:', data);
    console.log('Raw parsed data from parser:', parsedData);
    console.log('DEBUG: Frequency extraction check:', {
      frequency: parsedData.frequency,
      workoutDays: data.workoutDays,
      originalPrompt: prompt
    });
    return data;
  };

  // Validation function to check for required fields and return specific error messages
  const validateProfileData = (extractedData, originalPrompt) => {
    const missingFields = [];
    const suggestions = [];

    // Check for required fields
    if (!extractedData.age) {
      missingFields.push('age');
      suggestions.push('Please include your age (e.g., "I am 25 years old" or "25M")');
    }

    if (!extractedData.gender) {
      missingFields.push('gender');
      suggestions.push('Please specify your gender (e.g., "male", "female", "M", "F")');
    }

    if (!extractedData.height) {
      missingFields.push('height');
      suggestions.push('Please include your height (e.g., "5\'8\"", "170 cm", "5 feet 8 inches")');
    }

    if (!extractedData.weight) {
      missingFields.push('weight');
      suggestions.push('Please include your weight (e.g., "70 kg", "150 lbs", "70kg")');
    }

    if (!extractedData.activityLevel) {
      missingFields.push('activity level');
      suggestions.push('Please specify your activity level (e.g., "sedentary", "moderately active", "very active")');
    }

    if (missingFields.length === 0) {
      return { isValid: true, message: '' };
    }

    // Create simple error message with examples for each missing field
    const missingWithExamples = [];
    
    if (!extractedData.age) {
      missingWithExamples.push('age (e.g., 25 years old)');
    }
    if (!extractedData.gender) {
      missingWithExamples.push('gender (e.g., male)');
    }
    if (!extractedData.height) {
      missingWithExamples.push('height (e.g., 170 cm)');
    }
    if (!extractedData.weight) {
      missingWithExamples.push('weight (e.g., 70 kg)');
    }
    if (!extractedData.activityLevel) {
      missingWithExamples.push('activity level (e.g., moderately active)');
    }
    
    let errorMessage = `Missing: ${missingWithExamples.join(', ')}`;

    return { isValid: false, message: errorMessage, missingFields, suggestions };
  };

  
  // Check if user has profile data in Firebase
  const checkUserProfile = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Check for complete profile including gender and activityLevel
        return {
          hasProfile: !!(userData.height && userData.weight && userData.age),
          hasCompleteProfile: !!(userData.height && userData.weight && userData.age && userData.gender && userData.activityLevel),
          profileData: userData
        };
      }
      return { hasProfile: false, hasCompleteProfile: false, profileData: null };
    } catch (error) {
      console.error('Error checking user profile:', error);
      return { hasProfile: false, hasCompleteProfile: false, profileData: null };
    }
  };

  // Save profile data to Firebase
  const saveProfileData = async (data) => {
    try {
      if (!auth.currentUser) return false;
      
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        height: data.height,
        weight: data.weight,
        age: data.age || '',
        gender: data.gender || '',
        activityLevel: data.activityLevel || 'moderate',
        dietaryRestrictions: data.dietaryRestrictions || [],
        allergies: data.allergies || [],
        healthGoals: data.healthGoals || '',
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      return true;
    } catch (error) {
      console.error('Error saving profile data:', error);
      return false;
    }
  };

  const generatePlanWithProfileChoice = async (useProfile, extractedData) => {
    try {
      // If not using existing profile, validate that we have some essential data
      if (!useProfile) {
        const validation = validateProfileData(extractedData, fitnessGoal);
        if (!validation.isValid) {
          setValidationError(validation.message);
          return;
        }
      }

      const userDetails = useProfile 
        ? await getExistingProfileDetails() 
        : {
            height: extractedData.height || "",
            weight: extractedData.weight || "",
            age: extractedData.age || "",
            gender: extractedData.gender || "",
            activityLevel: extractedData.activityLevel || "moderate",
            healthGoals: extractedData.healthGoals || "",
            dietaryRestrictions: extractedData.dietaryRestrictions || [],
            allergies: extractedData.allergies || []
          };

      const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        body: JSON.stringify({ 
          prompt: fitnessGoal,
          userDetails: userDetails 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let formattedResponse = data.reply;
      
      formattedResponse = formatResponse(formattedResponse);
      parseResponse(formattedResponse);
      setShowPlans(true);
      setPlansComplete(true); // Plans are complete for non-streaming response

      // Check for profile updates - always compare extracted data with existing profile
      if (Object.keys(extractedData).length > 0 && auth.currentUser) {
        const changedFields = {};
        
        // Check if user has a profile
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        const hasProfile = userDoc.exists() && userDoc.data().height && userDoc.data().weight;
        
        if (hasProfile) {
          // Always compare extracted data with existing profile, regardless of useProfile choice
          const userData = userDoc.data();
          console.log('Comparing extracted data with profile:', { extractedData, userData });
          
          for (const key of Object.keys(extractedData)) {
            if (extractedData[key] !== undefined && extractedData[key] !== null) {
              // Convert to same type for comparison
              const extractedValue = extractedData[key];
              const profileValue = userData[key];
              
              // Skip comparison if profile value doesn't exist
              if (profileValue === undefined || profileValue === null) {
                changedFields[key] = extractedValue;
                console.log(`Field ${key} is new (not in profile):`, extractedValue);
                continue;
              }
              
              // Compare values properly
              if (key === 'height' || key === 'weight' || key === 'age') {
                // For numeric values, compare as numbers (not necessarily integers for weight)
                const extractedNum = Number(extractedValue);
                const profileNum = Number(profileValue);
                
                // For weight, allow decimal comparison
                if (key === 'weight') {
                  if (Math.abs(extractedNum - profileNum) > 0.1 && extractedNum > 0) {
                    changedFields[key] = extractedNum;
                    console.log(`Weight changed: ${profileNum} -> ${extractedNum}`);
                  }
                } else {
                  // For height and age, round to integers
                  const extractedInt = Math.round(extractedNum);
                  const profileInt = Math.round(profileNum);
                  if (extractedInt !== profileInt && extractedInt > 0) {
                    changedFields[key] = extractedInt;
                    console.log(`${key} changed: ${profileInt} -> ${extractedInt}`);
                  }
                }
              } else if (key === 'gender') {
                // Normalize gender comparison (case insensitive)
                const extractedGender = String(extractedValue).toLowerCase();
                const profileGender = String(profileValue).toLowerCase();
                if (extractedGender !== profileGender && extractedGender !== '') {
                  changedFields[key] = extractedValue;
                  console.log(`Gender changed: ${profileGender} -> ${extractedGender}`);
                }
              } else if (key === 'activityLevel') {
                // Normalize activity level comparison
                const extractedActivity = String(extractedValue).toLowerCase();
                const profileActivity = String(profileValue).toLowerCase();
                if (extractedActivity !== profileActivity && extractedActivity !== 'moderate') {
                  changedFields[key] = extractedValue;
                  console.log(`Activity level changed: ${profileActivity} -> ${extractedActivity}`);
                }
              } else if (extractedValue !== profileValue) {
                changedFields[key] = extractedValue;
                console.log(`${key} changed: ${profileValue} -> ${extractedValue}`);
              }
            }
          }
          
          console.log('Changed fields detected:', changedFields);
        } else {
          // No existing profile, all extracted data is new
          Object.keys(extractedData).forEach(key => {
            if (extractedData[key] !== undefined && extractedData[key] !== null) {
              changedFields[key] = extractedData[key];
            }
          });
          console.log('No existing profile, all data is new:', changedFields);
        }
        
        if (Object.keys(changedFields).length > 0) {
          console.log('Showing profile update popup with changed fields:', changedFields);
          setChangedProfileFields(changedFields);
          setUserProfileData(hasProfile ? userDoc.data() : null);
          setShowProfileUpdatePopup(true);
        } else {
          console.log('No changes detected, not showing update popup');
        }
      }
    } catch (error) {
      console.error('Error generating plan:', error);
      throw error;
    }
  };

  const getExistingProfileDetails = async () => {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    
    return {
      height: userData.height,
      weight: userData.weight,
      age: userData.age,
      gender: userData.gender,
      activityLevel: userData.activityLevel,
      healthGoals: userData.healthGoals,
      dietaryRestrictions: userData.dietaryRestrictions || [],
      allergies: userData.allergies || []
    };
  };

  const handleRecommendation = async () => {
    if (!fitnessGoal.trim()) {
      setInputError(true);
      return;
    }
    
    setInputError(false);
    setWarningMessage('');
    setValidationError('');
    setIsLoading(true);
    setShowPlans(false);
  
    // Reset choice states for new recommendation
    setMealPlanChoice(null);
    setWorkoutPlanChoice(null);

    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
          setErrorPopupMessage('Please log in to get personalized recommendations.');
         setShowErrorPopup(true);
        setIsLoading(false);
        return;
      }

      // Extract profile data from prompt
      const extractedData = extractProfileData(fitnessGoal);
      setExtractedProfileData(extractedData);

      // NEW: Check if we have extracted data from the prompt - this should take priority
      if (extractedData.age && extractedData.gender && extractedData.height && extractedData.weight && extractedData.activityLevel) {
        // Process as natural language input (even when no existing profile)
        console.log('Processing with extracted data from prompt:', extractedData);
        await handleNaturalLanguageInput(fitnessGoal, true); // bypass profile check
        return;
      }

      // Check user profile status
      const { hasProfile, hasCompleteProfile, profileData } = await checkUserProfile(auth.currentUser.uid);

      // If user has a complete profile, ask if they want to use it
      if (hasCompleteProfile) {
        // User has complete profile - ask if they want to use it
        setShowProfileChoicePopup(true);
        setIsLoading(false);
        return;
      }

      // If we have extracted data from the prompt, use it directly
      if (extractedData.age && extractedData.gender && extractedData.height && extractedData.weight && extractedData.activityLevel) {
        // Process as natural language input (even when no existing profile)
        await handleNaturalLanguageInput(fitnessGoal, true); // bypass profile check
        return;
      }

      // Validate extracted data and show specific error messages for missing fields
      const validation = validateProfileData(extractedData, fitnessGoal);
      if (!validation.isValid) {
        setErrorPopupMessage(validation.message);
        setShowErrorPopup(true);
        setIsLoading(false);
        return;
      }

      // No profile exists or incomplete profile - proceed with prompt and extracted data
      await generatePlanWithProfileChoice(false, extractedData);
      
    } catch (error) {
      console.error('Error:', error);
      setValidationError('Failed to get recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseProfileChoice = async (useProfile) => {
    setUseExistingProfile(useProfile);
    setShowProfileChoicePopup(false);
    
    if (useProfile) {
      // Show form with prefilled profile data
      await loadProfileDataToForm();
      setShowProfileForm(true);
    } else {
      // User selected "No" - process the prompt directly without profile check
      console.log('User selected No to use profile, processing prompt directly:', fitnessGoal);
      
      // Set flags for natural language processing
      setUseExistingProfile(false);
      setShowProfileForm(false);
      
      // Parse the prompt to extract user details
      const extractedData = parsePrompt(fitnessGoal);
      console.log('Extracted data from prompt:', extractedData);
      
      // Store extracted data for later use
      setExtractedProfileData(extractedData);
      
      // Check if we have enough data to calculate calories
      if (extractedData.age && extractedData.gender && extractedData.height && extractedData.weight && extractedData.activityLevel) {
        // Calculate calories immediately
        setIsLoading(true);
        try {
          const response = await fetch(getApiUrl('user'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: fitnessGoal,
              userDetails: {
                age: parseInt(extractedData.age),
                weight: parseFloat(extractedData.weight),
                height: parseFloat(extractedData.height),
                gender: extractedData.gender,
                activityLevel: extractedData.activityLevel,
                targetWeight: parseFloat(extractedData.targetWeight?.value || extractedData.weight),
                timelineWeeks: parseInt(extractedData.timelineWeeks || extractedData.timeline?.value || 12),
                healthGoals: extractedData.goal || 'Get Fit'
              }
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
          }
          
          const calorieData = await response.json();
          setCalculatedCalories(calorieData);
          setIsLoading(false);
          setShowCalorieResults(true);
          
          // Store extracted data for later use
          setExtractedProfileData(extractedData);
          
        } catch (error) {
          console.error('Error calculating calories:', error);
          setIsLoading(false);
          let errorMessage = 'Failed to calculate calories. ';
          if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Make sure the backend server is running on http://localhost:5002';
          } else {
            errorMessage += 'Please try again.';
          }
          setSuccessMessage(errorMessage);
          setShowSuccessPopup(true);
          setTimeout(() => setShowSuccessPopup(false), 5000);
        }
      } else {
        // Not enough data, show detailed error with specific missing fields
        const validation = validateProfileData(extractedData, fitnessGoal);
        setErrorPopupMessage(validation.message);
        setShowErrorPopup(true);
        setTimeout(() => setShowErrorPopup(false), 8000);
      }
    }
  };

     const loadProfileDataToForm = async () => {
     try {
       if (auth.currentUser) {
         const userRef = doc(db, 'users', auth.currentUser.uid);
         const userDoc = await getDoc(userRef);
         if (userDoc.exists()) {
           const userData = userDoc.data();
           setProfileFormData({
             age: userData.age || '',
             gender: userData.gender || '',
             height: userData.height || '',
             currentWeight: userData.weight || '',
             targetWeight: userData.weight || '', // Default to current weight
             activityLevel: userData.activityLevel || '',
             targetTimeline: '3', // Default
             workoutDays: '5', // Default to 5 days
             goal: fitnessGoal || '' // Use the fitness goal from input
           });
         }
       }
     } catch (error) {
       console.error('Error loading profile data:', error);
     }
   };

  const handleUpdateProfile = async () => {
    try {
      if (auth.currentUser) {
        // Save only the changed fields
        const profileData = {
          ...changedProfileFields,
          updatedAt: serverTimestamp()
        };

        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, profileData, { merge: true });
        
        // Update local user profile data
        setUserProfileData({ ...userProfileData, ...profileData });
        
        setShowProfileUpdatePopup(false);
        setSuccessMessage('Profile updated successfully!');
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 3000);
      } else {
        setSuccessMessage('You must be logged in to update your profile.');
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 3000);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setSuccessMessage('Failed to update profile. Please try again.');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);
    }
  };

  // New function to handle profile form submission
  const handleProfileFormSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!profileFormData.age || !profileFormData.gender || !profileFormData.height || 
        !profileFormData.currentWeight || !profileFormData.targetWeight || 
        !profileFormData.activityLevel || !profileFormData.targetTimeline) {
      setSuccessMessage('Please fill in all required fields.');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);
      return;
    }

    setShowProfileForm(false);
    setIsLoading(true);

    try {
      // Calculate calories using backend
      const response = await fetch(getApiUrl('user'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: fitnessGoal,
          userDetails: {
            age: parseInt(profileFormData.age),
            weight: parseFloat(profileFormData.currentWeight),
            height: parseFloat(profileFormData.height),
            gender: profileFormData.gender,
            activityLevel: profileFormData.activityLevel,
            targetWeight: parseFloat(profileFormData.targetWeight),
            timelineWeeks: parseInt(profileFormData.targetTimeline) * 4,
            healthGoals: profileFormData.goal
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const calorieData = await response.json();
      console.log('Calorie calculation response:', calorieData);
      
      setCalculatedCalories(calorieData);
      setIsLoading(false);
      setShowCalorieResults(true);
      
    } catch (error) {
      console.error('Error calculating calories:', error);
      setIsLoading(false);
      
      // More specific error messages
      let errorMessage = 'Failed to calculate calories. ';
      if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Make sure the backend server is running on http://localhost:5002';
      } else {
        errorMessage += 'Please try again.';
      }
      
      setSuccessMessage(errorMessage);
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 5000);
    }
  };

  // Handle meal plan generation choice
  const handleMealPlanChoice = async (generateMealPlan) => {
    setShowCalorieResults(false);
    setMealPlanChoice(generateMealPlan); // Track the choice
    
    if (!generateMealPlan) {
      // User selected "No" for meal plan - navigate directly to thank you page
      navigate('/thank-you');
      return;
    }

    // Generate meal plan with streaming and live accordion updates
    setIsStreamingMeal(true);
    setStreamingMealPlan('');
    setShowPlans(true); // Show the plans section immediately
    setMealPlansByDay([]); // Clear previous data
    setWorkoutSections([]);
    setPlansComplete(false); // Reset plans complete status
    setNoWorkoutPlan(false); // Reset no workout plan flag
    setIncompleteExerciseBuffer(''); // Clear incomplete exercise buffer
    
    // Set a timeout to ensure streaming state is reset even if something goes wrong
    const mealStreamingTimeout = setTimeout(() => {
      console.log('Meal plan streaming timeout reached, forcing isStreamingMeal to false');
      setIsStreamingMeal(false);
    }, 120000); // 120 seconds timeout
    
    try {
      const response = await fetch(getApiUrl('mealplan'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetCalories: calculatedCalories.targetCalories,
          dietaryRestrictions: [], // Empty array is fine now - backend handles it properly
          allergies: [], // Empty array is fine now - backend handles it properly
          prompt: `Generate meal plan for ${extractedProfileData?.goal || profileFormData.goal || 'fitness'} goal`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Meal plan error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setStreamingMealPlan(accumulatedText);
        
        // Parse and update meal plans in real-time
        try {
          const liveResponse = `MEAL_PLAN:${accumulatedText}`;
          // Parse immediately for UI updates
          parseResponseLiveImmediate(liveResponse, 'meal');
        } catch (parseError) {
          // Continue streaming even if parsing fails temporarily
          console.log('Temporary parse error (continuing):', parseError.message);
          // Fallback: try to create days from text
          createDaysFromText(accumulatedText, 'meal');
        }
        
        // Force UI update to ensure real-time display
        if (accumulatedText.includes('Day')) {
          // Trigger a re-render by updating the state
          setMealPlansByDay(prev => [...prev]);
        }
      }

      // Final parse for complete meal plan
      const finalResponse = `MEAL_PLAN:${accumulatedText}`;
      parseResponse(finalResponse);
      clearTimeout(mealStreamingTimeout); // Clear the timeout since we completed successfully
      setIsStreamingMeal(false);
      setShowWorkoutPlanChoice(true);
      
      // Plans are not complete yet - waiting for user to choose workout plan
      
    } catch (error) {
      console.error('Error generating meal plan:', error);
      clearTimeout(mealStreamingTimeout); // Clear the timeout since we had an error
      setIsStreamingMeal(false);
      let errorMessage = 'Failed to generate meal plan. ';
      if (error.message.includes('400')) {
        errorMessage += 'Invalid request format. Please check your profile data.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Backend server not responding.';
      } else {
        errorMessage += 'Please try again.';
      }
      setSuccessMessage(errorMessage);
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 5000);
    } finally {
      // Ensure streaming state is always reset
      console.log('Finally block: ensuring isStreamingMeal is false');
      clearTimeout(mealStreamingTimeout); // Clear timeout in finally block too
      setIsStreamingMeal(false);
    }
  };

  // Handle workout plan generation choice
     const handleWorkoutPlanChoice = async (generateWorkoutPlan) => {
     setShowWorkoutPlanChoice(false);
     setWorkoutPlanChoice(generateWorkoutPlan); // Track the choice
     
     if (!generateWorkoutPlan) {
       // User selected "No" for workout plan
       // Check if they also said "No" to meal plan
       if (mealPlanChoice === false) {
         navigate('/thank-you');
         return;
       }
       
       // Plans are complete (meal plan only)
       setPlansComplete(true);
       setNoWorkoutPlan(true); // Set flag to show no workout animation
       
       // Generate suggestions even when user selects No to workout plan
       const fallbackSuggestions = generateFallbackSuggestions();
       setPersonalizedSuggestions(fallbackSuggestions);
       setOpenSuggestionsAccordion(true);
       
       setSuccessMessage('Thank you for using AI Coach!');
       setShowSuccessPopup(true);
       setTimeout(() => setShowSuccessPopup(false), 3000);
       return; // Keep showing meal plan only
     }

     // User selected "Yes" - show workout days confirmation popup
     // Extract workout days from the prompt or use default
     let detectedDays = 7; // Default to 7 days
     
     if (extractedProfileData && (extractedProfileData.workoutDays || extractedProfileData.frequency)) {
       const extractedDays = parseInt(extractedProfileData.workoutDays || extractedProfileData.frequency);
       if (!isNaN(extractedDays) && extractedDays > 0 && extractedDays <= 7) {
         detectedDays = extractedDays;
       }
     } else if (profileFormData.workoutDays) {
       const formDays = parseInt(profileFormData.workoutDays);
       if (!isNaN(formDays) && formDays > 0 && formDays <= 7) {
         detectedDays = formDays;
       }
     }
     
     setSelectedWorkoutDays(detectedDays);
     setShowWorkoutDaysConfirmation(true);
   };

  // Handle workout days confirmation
  const handleWorkoutDaysConfirmation = async (confirmed) => {
    setShowWorkoutDaysConfirmation(false);
    
    if (!confirmed) {
      // User cancelled, go back to workout plan choice
      setShowWorkoutPlanChoice(true);
      return;
    }
    
    // User confirmed, generate workout plan with selected days
    await generateWorkoutPlanWithDays(selectedWorkoutDays);
  };

  // Generate workout plan with specified days
  const generateWorkoutPlanWithDays = async (workoutDays) => {
    // Generate workout plan with streaming
    setIsStreamingWorkout(true);
    setStreamingWorkoutPlan('');
    setWorkoutSections([]); // Clear previous workout sections
    setPlansComplete(false); // Reset plans complete status
    setNoWorkoutPlan(false); // Reset no workout plan flag
    setIncompleteExerciseBuffer(''); // Clear incomplete exercise buffer
    setLastParsedLength(0); // Reset parsing state
    setNewlyCreatedDays(new Set()); // Clear newly created days tracking
    console.log('Starting workout plan generation...');
     
    // Set a timeout to ensure streaming state is reset even if something goes wrong
    const streamingTimeout = setTimeout(() => {
      console.log('Streaming timeout reached, forcing isStreamingWorkout to false');
      setIsStreamingWorkout(false);
    }, 120000); // 120 seconds timeout (increased from 60 seconds)
     
     try {
       // Use the confirmed workout days from the popup
       let workoutPrompt;
       
       console.log('=== WORKOUT PLAN WITH CONFIRMED DAYS ===');
       console.log('Selected workout days:', workoutDays);
       console.log('extractedProfileData:', extractedProfileData);
       console.log('profileFormData:', profileFormData);
       
       // Create prompt with the selected number of days
       if (extractedProfileData?.goal || profileFormData.goal) {
         workoutPrompt = `Generate workout plan for ${extractedProfileData?.goal || profileFormData.goal || 'fitness'} goal, I prefer to workout ${workoutDays} days per week`;
       } else {
         workoutPrompt = `${fitnessGoal}. Generate workout plan for ${workoutDays} days per week`;
       }
       
       console.log('Final workout prompt:', workoutPrompt);
       console.log('Sending to backend:', {
         goal: extractedProfileData?.goal || profileFormData.goal || 'fitness',
         workout_focus: calculatedCalories.WorkoutFocus || 'Mixed Cardio and Strength',
         workout_days: workoutDays,
         prompt: workoutPrompt
       });
       
       const response = await fetch(getApiUrl('workoutplan'), {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           goal: extractedProfileData?.goal || profileFormData.goal || 'fitness',
           workout_focus: calculatedCalories.WorkoutFocus || 'Mixed Cardio and Strength',
           workout_days: workoutDays,
           prompt: workoutPrompt
         })
       });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Workout plan error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setStreamingWorkoutPlan(accumulatedText);
        
        // Parse and update workout plans in real-time with immediate parsing
        try {
          const liveResponse = `WORKOUT_PLAN:${accumulatedText}`;
          console.log('Parsing workout response:', liveResponse.substring(0, 200) + '...');
          
          // Use immediate parsing for real-time UI updates
          parseResponseLiveImmediate(liveResponse, 'workout');
          
          // Debug: Log current workout sections after parsing
          console.log('Current workout sections after parsing:', workoutSections);
        } catch (parseError) {
          console.log('Temporary workout parse error (continuing):', parseError.message);
          // Fallback: try to create days from text
          createDaysFromText(accumulatedText, 'workout');
        }
        
        // Force UI update to ensure real-time display
        if (accumulatedText.includes('Day')) {
          // Trigger a re-render by updating the state
          setWorkoutSections(prev => [...prev]);
        }
        
        // Also check for day patterns with more specific matching
        const specificDayMatches = accumulatedText.match(/Day\s*(\d+)[:\s-]/gi);
        if (specificDayMatches) {
          const specificDays = specificDayMatches.map(match => {
            const dayNum = parseInt(match.match(/\d+/)[0]);
            return dayNum;
          }).filter(dayNum => dayNum >= 1 && dayNum <= 7);
          
          // Create these days too if they don't exist
          setWorkoutSections(prevSections => {
            const updatedSections = [...prevSections];
            let hasChanges = false;
            
            specificDays.forEach(dayNum => {
              if (!updatedSections.find(day => day.dayNumber === dayNum)) {
                console.log(`Creating workout day ${dayNum} from specific pattern during streaming`);
                updatedSections.push({
                  dayNumber: dayNum,
                  workoutType: 'Training Day',
                  exercises: []
                });
                hasChanges = true;
                // Track this as a newly created day
                setNewlyCreatedDays(prev => new Set([...prev, dayNum]));
                // Clear the "newly created" status after 3 seconds
                setTimeout(() => {
                  setNewlyCreatedDays(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(dayNum);
                    return newSet;
                  });
                }, 3000);
              }
            });
            
            if (hasChanges) {
              updatedSections.sort((a, b) => a.dayNumber - b.dayNumber);
            }
            
            return hasChanges ? updatedSections : prevSections;
          });
        }
        
        // Force UI update to ensure real-time display
        if (accumulatedText.includes('Day')) {
          // Trigger a re-render by updating the state
          setWorkoutSections(prev => [...prev]);
        }
      }

      // Final parse for complete workout plan - use the same parsing logic as streaming
      const finalResponse = `WORKOUT_PLAN:${accumulatedText}`;
      parseResponseLiveImmediate(finalResponse, 'workout');
      
      console.log('Workout plan generation completed, setting isStreamingWorkout to false');
      clearTimeout(streamingTimeout); // Clear the timeout since we completed successfully
      setIsStreamingWorkout(false);
      
      // Force a re-render to ensure UI updates
      setTimeout(() => {
        setWorkoutSections(prev => [...prev]);
      }, 500);
      
      // Plans are now complete
      setPlansComplete(true);
      
      // Generate suggestions after both meal and workout plans are complete
      // Use fallback suggestions for now (API can be added later)
      const fallbackSuggestions = generateFallbackSuggestions();
      setPersonalizedSuggestions(fallbackSuggestions);
      setOpenSuggestionsAccordion(true);
      
      // Show profile update popup if form data differs from existing profile
      setTimeout(() => {
        checkForProfileUpdates();
      }, 1000);
      
    } catch (error) {
      console.error('Error generating workout plan:', error);
      console.log('Error occurred, setting isStreamingWorkout to false');
      clearTimeout(streamingTimeout); // Clear the timeout since we had an error
      setIsStreamingWorkout(false);
      
      // Force a re-render to ensure UI updates
      setTimeout(() => {
        setWorkoutSections(prev => [...prev]);
      }, 500);
      let errorMessage = 'Failed to generate workout plan. ';
      if (error.message.includes('400')) {
        errorMessage += 'Invalid request format.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Backend server not responding.';
      } else {
        errorMessage += 'Please try again.';
      }
      setSuccessMessage(errorMessage);
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 5000);
    } finally {
      // Ensure streaming state is always reset
      console.log('Finally block: ensuring isStreamingWorkout is false');
      clearTimeout(streamingTimeout); // Clear timeout in finally block too
      setIsStreamingWorkout(false);
    }
  };

  const generateSuggestions = async (workoutPlanText = '') => {
    try {
      setIsLoadingSuggestions(true);
      setPersonalizedSuggestions('');
      
      // Generate fallback suggestions based on user inputs instead of AI
      const fallbackSuggestions = generateFallbackSuggestions();
      setPersonalizedSuggestions(fallbackSuggestions);
      
      console.log('DEBUG: Generated user-based suggestions:', fallbackSuggestions);
      // Auto-expand suggestions when they're loaded
      setOpenSuggestionsAccordion(true);
      
    } catch (error) {
      console.error('Error generating suggestions:', error);
      // Generate fallback suggestions based on the plans
      const fallbackSuggestions = generateFallbackSuggestions();
      setPersonalizedSuggestions(fallbackSuggestions);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const generateFallbackSuggestions = () => {
    // Get user selections and timeline
    const hasMealPlan = mealPlansByDay && mealPlansByDay.length > 0;
    const hasWorkoutPlan = workoutSections && workoutSections.length > 0;
    const selectedTimeline = profileFormData.targetTimeline || timeline || 3;
    const timelineMonths = parseInt(selectedTimeline);
    
    // Extract user goals and details from profile form or prompt
    const userGoal = profileFormData.goal || fitnessGoal || '';
    const userAge = profileFormData.age || extractedProfileData?.age || '';
    const userWeight = profileFormData.currentWeight || extractedProfileData?.weight || '';
    const targetWeight = profileFormData.targetWeight || extractedProfileData?.targetWeight?.value || userWeight;
    const activityLevel = profileFormData.activityLevel || extractedProfileData?.activityLevel || '';
    const workoutDays = profileFormData.workoutDays || extractedProfileData?.workoutDays || '5';
    
    let suggestions = [];
    let explanations = [];
    
    // Generate explanations based on user inputs and selections
    if (hasMealPlan && hasWorkoutPlan) {
      // Both meal and workout plans selected
      explanations = [
        `MEAL PLAN EXPLANATION: Your meal plan is tailored to your ${userGoal.toLowerCase()} goal${userWeight && targetWeight ? `, helping you progress from ${userWeight}kg to ${targetWeight}kg` : ''}. Each meal is designed to provide balanced nutrition and support your ${timelineMonths}-month journey.`,
        `WORKOUT PLAN EXPLANATION: Your workout plan is designed for ${workoutDays} days per week training, perfect for your ${activityLevel} lifestyle. The progressive training will help you achieve your ${userGoal.toLowerCase()} goal over ${timelineMonths} months.`
      ];
    } else if (hasMealPlan && !hasWorkoutPlan) {
      // Only meal plan selected
      explanations = [
        `MEAL PLAN EXPLANATION: Your meal plan is specifically designed for your ${userGoal.toLowerCase()} goal${userWeight && targetWeight ? `, supporting your journey from ${userWeight}kg to ${targetWeight}kg` : ''}. Each meal provides balanced nutrition to help you achieve results over ${timelineMonths} months through proper nutrition alone.`
      ];
    } else if (!hasMealPlan && hasWorkoutPlan) {
      // Only workout plan selected
      explanations = [
        `WORKOUT PLAN EXPLANATION: Your workout plan is customized for ${workoutDays} days per week training, perfectly suited for your ${activityLevel} lifestyle. The progressive training approach will help you achieve your ${userGoal.toLowerCase()} goal over ${timelineMonths} months.`
      ];
    }
    
    // Generate personalized suggestions based on user inputs
    if (hasMealPlan && hasWorkoutPlan) {
      suggestions = [
        `• Follow this comprehensive plan consistently for ${timelineMonths} months to achieve your ${userGoal.toLowerCase()} goal`,
        `• Your ${workoutDays} days per week schedule fits well with your ${activityLevel} lifestyle`,
        userWeight && targetWeight && userWeight !== targetWeight ? `• Track your progress from ${userWeight}kg towards your target of ${targetWeight}kg` : '',
        `• Prepare meals in advance to stay consistent with your nutrition plan`,
        `• Maintain your workout schedule - consistency is key for your ${userGoal.toLowerCase()} goal`,
        userAge ? `• At ${userAge} years old, focus on proper recovery between workout sessions` : '• Focus on proper recovery between workout sessions',
        `• Track your transformation with progress photos throughout your ${timelineMonths}-month journey`
      ].filter(Boolean);
    } else if (hasMealPlan && !hasWorkoutPlan) {
      suggestions = [
        `• Follow your meal plan consistently for ${timelineMonths} months to support your ${userGoal.toLowerCase()} goal`,
        userWeight && targetWeight && userWeight !== targetWeight ? `• Monitor your progress from ${userWeight}kg towards ${targetWeight}kg through nutrition` : '',
        `• Prepare meals in advance to maintain consistency`,
        `• Since you're focusing on nutrition only, consider adding light physical activity like walking`,
        userAge ? `• At ${userAge} years old, proper nutrition is especially important for achieving your goals` : '',
        `• Take progress photos to track your ${timelineMonths}-month transformation`
      ].filter(Boolean);
    } else if (!hasMealPlan && hasWorkoutPlan) {
      suggestions = [
        `• Follow your ${workoutDays} days per week workout schedule for ${timelineMonths} months`,
        `• Your ${activityLevel} lifestyle supports this training frequency well`,
        userWeight && targetWeight && userWeight !== targetWeight ? `• Work towards your target of ${targetWeight}kg from ${userWeight}kg through consistent training` : '',
        `• Consider adding a structured nutrition plan to complement your workout routine`,
        userAge ? `• At ${userAge} years old, ensure adequate rest between your workout sessions` : '• Ensure adequate rest between workout sessions',
        `• Track your strength and endurance improvements over your ${timelineMonths}-month journey`
      ].filter(Boolean);
    }
    
    // Only return content if we have plans to show
    if (explanations.length === 0) {
      return '';
    }
    
    return `${explanations.join('\n\n')}\n\nPERSONALIZED SUGGESTIONS:\n${suggestions.map(s => `• ${s.replace(/^• /, '')}`).join('\n')}`;
  };

  // Check for profile updates after plan generation
  const checkForProfileUpdates = async () => {
    try {
      if (!auth.currentUser) return;
      
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const changedFields = {};
        
        // Check for changes from form data or extracted data
        const currentAge = parseInt(profileFormData.age || extractedProfileData?.age);
        const currentGender = profileFormData.gender || extractedProfileData?.gender;
        const currentHeight = parseInt(profileFormData.height || extractedProfileData?.height);
        const currentWeight = parseFloat(profileFormData.currentWeight || extractedProfileData?.weight);
        const currentActivityLevel = profileFormData.activityLevel || extractedProfileData?.activityLevel;
        
        if (currentAge && parseInt(currentAge) !== parseInt(userData.age)) {
          changedFields.age = parseInt(currentAge);
        }
        if (currentGender && currentGender !== userData.gender) {
          changedFields.gender = currentGender;
        }
        if (currentHeight && parseInt(currentHeight) !== parseInt(userData.height)) {
          changedFields.height = parseInt(currentHeight);
        }
        if (currentWeight && parseFloat(currentWeight) !== parseFloat(userData.weight)) {
          changedFields.weight = parseFloat(currentWeight);
        }
        if (currentActivityLevel && currentActivityLevel !== userData.activityLevel) {
          changedFields.activityLevel = currentActivityLevel;
        }
        
        if (Object.keys(changedFields).length > 0) {
          setChangedProfileFields(changedFields);
          setUserProfileData(userData);
          setShowProfileUpdatePopup(true);
        }
      }
    } catch (error) {
      console.error('Error checking for profile updates:', error);
    }
  };


  const handleCopyDefaultPrompt = async () => {
    try {
      const defaultPrompt = `I am a [age]-year-old [gender], my height is [height] cm, weight is [weight] kg. My activity level is [activity level] (e.g., sedentary, lightly active, moderately active, very active). I usually work out [number of workout days] days per week. My target weight is [target weight] kg, and I want to achieve this goal in [target timeline] weeks/months.`;

      await navigator.clipboard.writeText(defaultPrompt);
      setCopyButtonClicked(true);
      setTimeout(() => setCopyButtonClicked(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };


  // Debounced parsing to reduce UI updates
  const debouncedParseResponseLive = useRef(null);
  
  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      if (debouncedParseResponseLive.current) {
        clearTimeout(debouncedParseResponseLive.current);
      }
    };
  }, []);
  
  // Live parsing function for streaming updates with improved debouncing
  const parseResponseLive = (response, type = 'meal') => {
    // Only parse if there's meaningful content
    if (!response || response.length < 10) return;
    
    // For workout plans, only parse if there's significant new content
    if (type === 'workout') {
      const currentLength = response.length;
      if (currentLength - lastParsedLength < 30) { // Further reduced threshold for more frequent updates
        console.log('Skipping workout parse - not enough new content');
        return;
      }
      setLastParsedLength(currentLength);
    }
    
    // Clear existing timeout
    if (debouncedParseResponseLive.current) {
      clearTimeout(debouncedParseResponseLive.current);
    }
    
    // Use shorter debounce for more responsive updates
    const debounceTime = type === 'workout' ? 100 : 100; // Reduced debounce for more responsive workout updates
    
    // Set new timeout for debounced parsing
    debouncedParseResponseLive.current = setTimeout(() => {
      parseResponseLiveImmediate(response, type);
    }, debounceTime);
  };
  
  // Emergency day creation function for when parsing fails
  const createDaysFromText = (text, type) => {
    const dayPattern = /Day\s*(\d+)/gi;
    const matches = [...text.matchAll(dayPattern)];
    const dayNumbers = [...new Set(matches.map(match => parseInt(match[1])))].filter(day => day >= 1 && day <= 7);
    
    if (type === 'meal') {
      setMealPlansByDay(prevMealPlans => {
        const updatedMealPlans = [...prevMealPlans];
        let hasChanges = false;
        
        dayNumbers.forEach(dayNum => {
          if (!updatedMealPlans.find(day => day.dayNumber === dayNum)) {
            updatedMealPlans.push({
              dayNumber: dayNum,
              meals: [
                { type: 'Breakfast', calories: 0, items: [] },
                { type: 'Lunch', calories: 0, items: [] },
                { type: 'Snack', calories: 0, items: [] },
                { type: 'Dinner', calories: 0, items: [] }
              ]
            });
            hasChanges = true;
          }
        });
        
        if (hasChanges) {
          updatedMealPlans.sort((a, b) => a.dayNumber - b.dayNumber);
        }
        
        return hasChanges ? updatedMealPlans : prevMealPlans;
      });
    }
  };
  
  const parseResponseLiveImmediate = (response, type = 'meal') => {
    if (type === 'meal') {
      const mealPlanMatch = response.match(/MEAL_PLAN:([\s\S]*?)(?=WORKOUT_PLAN:|$)/i);
      if (!mealPlanMatch) return;
      
      const mealPlanRaw = mealPlanMatch[1].trim();
      
      // Parse available days incrementally
      const mealPlanLines = mealPlanRaw.split('\n').map(line => line.trim()).filter(Boolean);
      let currentDay = null;
      let currentMealType = null;
      
      // Use functional update to avoid flickering
      setMealPlansByDay(prevMealPlans => {
        const updatedMealPlans = [...prevMealPlans];
        let hasChanges = false;
        
        // First, try to detect any day numbers in the text and create them immediately
        const dayNumbers = new Set();
        mealPlanRaw.match(/Day\s*(\d+)/gi)?.forEach(match => {
          const dayNum = parseInt(match.match(/\d+/)[0]);
          if (dayNum >= 1 && dayNum <= 7) {
            dayNumbers.add(dayNum);
          }
        });
        
        // Create any missing days immediately
        dayNumbers.forEach(dayNum => {
          if (!updatedMealPlans.find(day => day.dayNumber === dayNum)) {
            console.log(`Pre-creating meal day ${dayNum} from text scan`);
            updatedMealPlans.push({
              dayNumber: dayNum,
              meals: [
                { type: 'Breakfast', calories: 0, items: [] },
                { type: 'Lunch', calories: 0, items: [] },
                { type: 'Snack', calories: 0, items: [] },
                { type: 'Dinner', calories: 0, items: [] }
              ]
            });
            hasChanges = true;
          }
        });
        
        // Sort by day number to maintain order
        if (hasChanges) {
          updatedMealPlans.sort((a, b) => a.dayNumber - b.dayNumber);
        }
      
        mealPlanLines.forEach(line => {
          // More flexible day matching patterns
          const dayMatch = line.match(/Day\s*(\d+)[:\s-]/i) || line.match(/Day\s*(\d+)$/i);
          if (dayMatch) {
            currentDay = parseInt(dayMatch[1]);
            
            // Create day if it doesn't exist - show immediately when day is detected
            if (!updatedMealPlans.find(day => day.dayNumber === currentDay)) {
              console.log(`Creating meal day ${currentDay} immediately`);
              updatedMealPlans.push({
                dayNumber: currentDay,
                meals: [
                  { type: 'Breakfast', calories: 0, items: [] },
                  { type: 'Lunch', calories: 0, items: [] },
                  { type: 'Snack', calories: 0, items: [] },
                  { type: 'Dinner', calories: 0, items: [] }
                ]
              });
              hasChanges = true;
              // Sort by day number to maintain order
              updatedMealPlans.sort((a, b) => a.dayNumber - b.dayNumber);
            }
            return;
          }
        
          const mealTypeMatch = line.match(/(Breakfast|Lunch|Snack|Dinner)\s*(?:\((\d+)\s*(?:kcal|calories?)?\)|(?:\s*-\s*)?(\d+)\s*(?:kcal|calories?))?(?:\s*:|$)/i);
          if (mealTypeMatch && currentDay && currentDay <= 7) {
            currentMealType = mealTypeMatch[1];
            const calories = parseInt(mealTypeMatch[2] || mealTypeMatch[3]) || 0;
            
            const dayData = updatedMealPlans.find(day => day.dayNumber === currentDay);
            if (dayData) {
              const mealIndex = dayData.meals.findIndex(m => m.type === currentMealType);
              if (mealIndex !== -1) {
                dayData.meals[mealIndex].calories = calories;
                hasChanges = true;
              }
            }
            return;
          }
        
          // Parse meal items
          const itemMatch = line.match(/^(?:\d+\.|[\-•●])\s*(.*?)\s*—\s*(.*?)\s*—\s*(\d+)\s*(?:kcal|calories?|cal)$/i);
          if (itemMatch && currentDay && currentMealType && currentDay <= 7) {
            const itemName = itemMatch[1].trim();
            const itemQty = itemMatch[2].trim();
            const itemCalories = parseInt(itemMatch[3]) || 0;
            const description = itemQty ? `${itemName} — ${itemQty}` : itemName;
            
            const dayData = updatedMealPlans.find(day => day.dayNumber === currentDay);
            if (dayData) {
              const mealIndex = dayData.meals.findIndex(m => m.type === currentMealType);
              if (mealIndex !== -1) {
                // Check if item already exists to avoid duplicates
                const existingItem = dayData.meals[mealIndex].items.find(item => 
                  item.description === description && item.calories === itemCalories
                );
                if (!existingItem) {
                  dayData.meals[mealIndex].items.push({
                    description: description,
                    calories: itemCalories
                  });
                  hasChanges = true;
                }
              }
            }
          }
        });
        
        return hasChanges ? updatedMealPlans : prevMealPlans;
      });
    } else if (type === 'workout') {
      // Enhanced regex pattern to properly extract workout plan and stop before recommendations/suggestions
      const workoutPlanMatch = response.match(/WORKOUT_PLAN:([\s\S]*?)(?=END-OF-PLAN SUGGESTION:|Follow this plan|consistently.*achieve|Closing Recommendation|To achieve your goal|To effectively|RECOMMENDATION:|SUGGESTION:|Note:|Important:|$)/i);
      
      if (!workoutPlanMatch) return;
      
      // Clean the workout content to remove any trailing recommendation/suggestion content
      let workoutPlanRaw = cleanWorkoutContent(workoutPlanMatch[1]);
      
      // Parse available days incrementally
      const workoutPlanLines = workoutPlanRaw.split('\n').map(line => line.trim()).filter(Boolean);
      let currentWorkoutDay = null;
      let currentWorkoutType = null;
       
      // Use functional update to avoid flickering
      setWorkoutSections(prevWorkoutSections => {
        const updatedWorkoutSections = [...prevWorkoutSections];
        let hasChanges = false;
        
        // First, scan for all day numbers in the text and create them immediately
        const dayNumbers = new Set();
        workoutPlanRaw.match(/Day\s*(\d+)/gi)?.forEach(match => {
          const dayNum = parseInt(match.match(/\d+/)[0]);
          if (dayNum >= 1 && dayNum <= 7) {
            dayNumbers.add(dayNum);
          }
        });
        
        // Create any missing days immediately with proper workout types
        dayNumbers.forEach(dayNum => {
          if (!updatedWorkoutSections.find(day => day.dayNumber === dayNum)) {
            // Try to find the workout type for this day
            let workoutType = 'Training Day';
            const dayLine = workoutPlanLines.find(line => 
              line.match(new RegExp(`Day\\s*${dayNum}[:\s-]`, 'i'))
            );
            
            if (dayLine) {
              const dayMatch = dayLine.match(/Day\s*(\d+)(?:\s*-\s*|\s*:\s*[—\-]?\s*)([^:]+)(?::|$)/i) ||
                              dayLine.match(/Day\s*(\d+)\s*[:\s-][—\-]?\s*(.*)/i) ||
                              dayLine.match(/Day\s*(\d+)[:\s-]/i);
              
              if (dayMatch && dayMatch[2]) {
                workoutType = dayMatch[2].trim()
                  .replace(/:\s*$/, '') // Remove trailing colon
                  .replace(/\*\*/g, '') // Remove double asterisks
                  .replace(/\*/g, '') // Remove single asterisks
                  .replace(/^\s*[—\-]\s*/, '') // Remove leading dash or em dash
                  .replace(/\s+/g, ' ') // Normalize whitespace
                  .trim();
              }
            }
            
            console.log(`Creating workout day ${dayNum} immediately: ${workoutType}`);
            updatedWorkoutSections.push({
              dayNumber: dayNum,
              workoutType: workoutType,
              exercises: []
            });
            hasChanges = true;
          }
        });
        
        // Sort by day number to maintain order
        if (hasChanges) {
          updatedWorkoutSections.sort((a, b) => a.dayNumber - b.dayNumber);
        }
      
      // Filter out any lines that contain recommendation/suggestion content
      const filteredWorkoutLines = workoutPlanLines.filter(line => 
        !isRecommendationContent(line)
      );

      filteredWorkoutLines.forEach(line => {
        // Check for exclusion messages like "Day 5:, 6, and 7 are not included"
        const exclusionMatch = line.match(/Day\s*(\d+)[:,]\s*(\d+),\s*and\s*(\d+)\s*are\s*not\s*included/i);
        if (exclusionMatch) {
          const day1 = parseInt(exclusionMatch[1]);
          const day2 = parseInt(exclusionMatch[2]);
          const day3 = parseInt(exclusionMatch[3]);
          
          // Set these days as Rest Day
          [day1, day2, day3].forEach(dayNum => {
            if (dayNum >= 1) {
              const existingDay = updatedWorkoutSections.find(day => day.dayNumber === dayNum);
              if (existingDay) {
                existingDay.workoutType = 'Rest Day';
                existingDay.exercises = [];
              } else {
                updatedWorkoutSections.push({
                  dayNumber: dayNum,
                  workoutType: 'Rest Day',
                  exercises: []
                });
              }
              hasChanges = true;
              console.log(`Set Day ${dayNum} as Rest Day due to exclusion message (live)`);
            }
          });
          return;
        }
        
        // Check for single day exclusion messages like "Day 5: not included"
        const singleExclusionMatch = line.match(/Day\s*(\d+)[:\s]*not\s*included/i);
        if (singleExclusionMatch) {
          const dayNum = parseInt(singleExclusionMatch[1]);
          if (dayNum >= 1) {
            const existingDay = updatedWorkoutSections.find(day => day.dayNumber === dayNum);
            if (existingDay) {
              existingDay.workoutType = 'Rest Day';
              existingDay.exercises = [];
            } else {
              updatedWorkoutSections.push({
                dayNumber: dayNum,
                workoutType: 'Rest Day',
                exercises: []
              });
            }
            hasChanges = true;
            console.log(`Set Day ${dayNum} as Rest Day due to single exclusion message (live)`);
          }
          return;
        }
        
          // More flexible day matching patterns - handle em dash and regular dash
          let dayMatch = line.match(/Day\s*(\d+)(?:\s*[–-]\s*|\s*:\s*[—\-]?\s*)([^:]+)(?::|$)/i);
        if (!dayMatch) {
            dayMatch = line.match(/Day\s*(\d+)\s*[:\s–-][—\-]?\s*(.*)/i);
        }
        if (!dayMatch) {
            dayMatch = line.match(/Day\s*(\d+)[:\s–-]/i) || line.match(/Day\s*(\d+)$/i);
        }
        
        if (dayMatch) {
          currentWorkoutDay = parseInt(dayMatch[1]);
          currentWorkoutType = dayMatch[2] ? dayMatch[2].trim() : 'Training Day';
            
            console.log(`Found workout day ${currentWorkoutDay} with type: "${currentWorkoutType}"`);
          
          // Clean up special characters and formatting
          currentWorkoutType = currentWorkoutType
            .replace(/:\s*$/, '') // Remove trailing colon
            .replace(/\*\*/g, '') // Remove double asterisks
            .replace(/\*/g, '') // Remove single asterisks
            .replace(/^\s*[—\-]\s*/, '') // Remove leading dash or em dash
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
          
            console.log(`Cleaned workout type: "${currentWorkoutType}"`);
            
            // Update existing day or create if it doesn't exist
          if (currentWorkoutDay > 0) {
              const existingDay = updatedWorkoutSections.find(day => day.dayNumber === currentWorkoutDay);
              if (existingDay) {
                // Update existing day
                if (existingDay.workoutType !== currentWorkoutType) {
                  existingDay.workoutType = currentWorkoutType;
                  hasChanges = true;
                  console.log(`Updated workout day ${currentWorkoutDay}: ${currentWorkoutType}`);
                }
              } else {
                // Create new day
              console.log(`Creating workout day ${currentWorkoutDay}: ${currentWorkoutType}`);
              updatedWorkoutSections.push({
                dayNumber: currentWorkoutDay,
                workoutType: currentWorkoutType,
                exercises: []
              });
              hasChanges = true;
              // Sort by day number to maintain order
              updatedWorkoutSections.sort((a, b) => a.dayNumber - b.dayNumber);
            }
          }
          return;
        }
        
          // Parse exercises using number-based approach - only process when exercise number changes
          const exerciseNumberMatch = line.match(/^(\d+)\s*[.)]\s*(.*)/);
          if (currentWorkoutDay && exerciseNumberMatch) {
            const exerciseNumber = parseInt(exerciseNumberMatch[1]);
            const exerciseText = exerciseNumberMatch[2].trim();
            
            console.log(`Found exercise ${exerciseNumber}: "${exerciseText}"`);
          
          // Skip if exercise is too short or incomplete (likely streaming artifact)
            if (exerciseText.length < 3) {
              console.log(`Skipping incomplete exercise: "${exerciseText}"`);
            return;
          }
          
            // Check if this is a new exercise number (not seen before)
            const dayData = updatedWorkoutSections.find(day => day.dayNumber === currentWorkoutDay);
            if (dayData) {
              const existingExercise = dayData.exercises.find(ex => ex.number === exerciseNumber);
              
              // Only add if this is a new exercise number or if the text is more complete
              if (!existingExercise) {
                dayData.exercises.push({
                  number: exerciseNumber,
                  description: exerciseText
                });
                hasChanges = true;
                console.log(`Added NEW exercise ${exerciseNumber} to day ${currentWorkoutDay}: ${exerciseText}`);
              } else if (exerciseText.length > existingExercise.description.length) {
                // Update existing exercise only if the new one is significantly more complete
                existingExercise.description = exerciseText;
                hasChanges = true;
                console.log(`Updated exercise ${exerciseNumber} to more complete version: ${exerciseText}`);
              } else {
                console.log(`Skipping duplicate/incomplete exercise ${exerciseNumber}: ${exerciseText}`);
              }
            }
            return;
          }
          
          // Fallback: handle exercises without numbers (plain text)
          if (currentWorkoutDay && /^[A-Za-z]/.test(line) && !line.match(/^Day\s*\d+/i)) {
            const exercise = line.trim();
            
            console.log(`Processing plain text exercise: "${exercise}"`);
            
            // Skip if exercise is too short or incomplete
            if (exercise.length < 3) {
              console.log(`Skipping incomplete exercise: "${exercise}"`);
              return;
            }
            
            // Skip if this line contains recommendation/suggestion content
            if (isRecommendationContent(exercise)) {
              console.log(`Skipping recommendation content in exercise: "${exercise}"`);
              return;
            }
            
            // Add plain text exercise to the current day
             const dayData = updatedWorkoutSections.find(day => day.dayNumber === currentWorkoutDay);
          if (dayData) {
              // Check if this exercise already exists (avoid duplicates)
              const existingExercise = dayData.exercises.find(ex => 
                ex.description.toLowerCase().trim() === exercise.toLowerCase().trim()
              );
              
              if (!existingExercise) {
              dayData.exercises.push({
                number: dayData.exercises.length + 1,
                description: exercise
              });
              hasChanges = true;
                console.log(`Added plain text exercise to day ${currentWorkoutDay}: ${exercise}`);
              } else {
                console.log(`Skipping duplicate exercise: ${exercise}`);
            }
          }
        }
      });
      
      return hasChanges ? updatedWorkoutSections : prevWorkoutSections;
    });
  }
};

  const parseResponse = (response) => {
    let cleanedResponse = formatResponse(response);
    
    console.log('Cleaned response for parsing:', cleanedResponse);

    // Extract end-of-plan suggestion first, but don't remove it yet
    let suggestionMatch = cleanedResponse.match(/END-OF-PLAN SUGGESTION:([\s\S]*)$/i);
    if (!suggestionMatch) {
      // Try alternative formats
      suggestionMatch = cleanedResponse.match(/\*\*Closing Recommendation:\*\*([\s\S]*)$/i);
    }
    if (!suggestionMatch) {
      suggestionMatch = cleanedResponse.match(/Closing Recommendation:([\s\S]*)$/i);
    }
    if (!suggestionMatch) {
      suggestionMatch = cleanedResponse.match(/To achieve your goal([\s\S]*)$/i);
    }
    if (!suggestionMatch) {
      suggestionMatch = cleanedResponse.match(/To effectively([\s\S]*)$/i);
    }
    
    if (suggestionMatch) {
      setEndOfPlanSuggestion(suggestionMatch[1].trim());
    } else {
      setEndOfPlanSuggestion('Follow this plan consistently to achieve your desired results.');
    }

    const mealPlanMatch = cleanedResponse.match(/MEAL_PLAN:([\s\S]*?)(?=WORKOUT_PLAN:|$)/i);
    
    // Enhanced regex pattern to properly extract workout plan and stop before recommendations/suggestions
    let workoutPlanMatch = cleanedResponse.match(/WORKOUT_PLAN:([\s\S]*?)(?=END-OF-PLAN SUGGESTION:|Follow this plan|consistently.*achieve|Closing Recommendation|To achieve your goal|To effectively|RECOMMENDATION:|SUGGESTION:|Note:|Important:|$)/i);
    
    if (!workoutPlanMatch) {
      console.log('Trying alternate workout plan pattern');
      workoutPlanMatch = cleanedResponse.match(/(?:WORKOUT|EXERCISE)[\s_]*PLAN:?([\s\S]*?)(?=END-OF-PLAN SUGGESTION:|Follow this plan|consistently.*achieve|Closing Recommendation|To achieve your goal|To effectively|RECOMMENDATION:|SUGGESTION:|Note:|Important:|$)/i);
    }
    
    // Additional safeguard: if we still have issues, try to find the workout content by looking for day patterns
    if (!workoutPlanMatch) {
      console.log('Attempting to extract workout content by day patterns');
      const workoutSectionMatch = cleanedResponse.match(/(WORKOUT_PLAN:|EXERCISE_PLAN:|###\s*Workout.*?)[\s\S]*?(?=END-OF-PLAN SUGGESTION:|Follow this plan|consistently.*achieve|Closing Recommendation|To achieve your goal|To effectively|RECOMMENDATION:|SUGGESTION:|Note:|Important:|$)/i);
      if (workoutSectionMatch) {
        // Extract just the content after the header
        let content = workoutSectionMatch[0];
        const headerMatch = content.match(/^(WORKOUT_PLAN:|EXERCISE_PLAN:|###\s*Workout.*?)([\s\S]*)/i);
        if (headerMatch) {
          workoutPlanMatch = [workoutSectionMatch[0], cleanWorkoutContent(headerMatch[2])];
        } else {
          workoutPlanMatch = [workoutSectionMatch[0], cleanWorkoutContent(workoutSectionMatch[0])];
        }
      }
    }
    
    if (!workoutPlanMatch && cleanedResponse.includes('###')) {
      console.log('Trying to find workout section using markdown headers');
      const sections = cleanedResponse.split(/###\s+/);
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].toLowerCase().includes('workout') || 
            sections[i].toLowerCase().includes('exercise')) {
          // Make sure we stop before any recommendation content
          const cleanSection = cleanWorkoutContent(sections[i]);
          workoutPlanMatch = [sections[i], cleanSection];
          break;
        }
      }
    }
    
    const mealPlanRaw = mealPlanMatch ? mealPlanMatch[1].trim() : '';
    const workoutPlanRaw = workoutPlanMatch ? cleanWorkoutContent(workoutPlanMatch[1]) : '';
    
    console.log('Extracted meal plan:', mealPlanRaw);
    console.log('Extracted workout plan:', workoutPlanRaw);
    
    let extractedWorkoutContent = workoutPlanRaw;
    
    if (!workoutPlanRaw) {
      console.warn('No workout plan section found - attempting to extract workout info from full response');
      const fullResponseLines = cleanedResponse.split('\n');
      const workoutLines = [];
      let foundWorkoutSection = false;
      let foundEndOfPlanSuggestion = false;
      
      for (let i = 0; i < fullResponseLines.length; i++) {
        const line = fullResponseLines[i];
        
        // Check if we've reached the end-of-plan suggestion section
        if (isRecommendationContent(line)) {
          foundEndOfPlanSuggestion = true;
          break; // Stop processing once we hit the recommendation section
        }
        
        if (!foundWorkoutSection) {
          if (line.match(/work\s*out|exercise|training/i) && 
              !line.match(/meal|breakfast|lunch|dinner|snack/i)) {
            foundWorkoutSection = true;
            workoutLines.push(line);
          }
        } else {
          if (!line.match(/meal|breakfast|lunch|dinner|snack/i) ||
              line.match(/day\s*\d+|exercise|workout|training/i)) {
            // Skip recommendation content
            if (!isRecommendationContent(line)) {
              workoutLines.push(line);
            }
          }
        }
      }
      
      if (workoutLines.length > 0) {
        console.log('Found potential workout content:', workoutLines.join('\n'));
        extractedWorkoutContent = cleanWorkoutContent(workoutLines.join('\n'));
        if (!extractedWorkoutContent.match(/day\s*\d+|exercise|workout|training/i)) {
          console.log('Extracted content doesn\'t look like workout content, using default');
          extractedWorkoutContent = '';
        }
      }
    }

    // Filter out any recommendation/suggestion content from the extracted workout content
    const filteredWorkoutLines = extractedWorkoutContent.split('\n').filter(line => 
      !isRecommendationContent(line)
    );
    extractedWorkoutContent = filteredWorkoutLines.join('\n');

    // Process meal plan for exactly 7 days
    const mealPlansByDay = [];
    let currentDay = null;
    let currentMealType = null;
    let currentMealItems = [];

    for (let i = 1; i <= 7; i++) {
      mealPlansByDay.push({
        dayNumber: i,
        meals: [
          { type: 'Breakfast', calories: 0, items: [] },
          { type: 'Lunch', calories: 0, items: [] },
          { type: 'Snack', calories: 0, items: [] },
          { type: 'Dinner', calories: 0, items: [] }
        ]
      });
    }

    const mealPlanLines = mealPlanRaw.split('\n').map(line => line.trim()).filter(Boolean);
    
    mealPlanLines.forEach(line => {
      const dayMatch = line.match(/Day\s*(\d+):/i);
      if (dayMatch) {
        currentDay = parseInt(dayMatch[1]);
        currentMealType = null;
        currentMealItems = [];
        return;
      }

      const mealTypeMatch = line.match(/(Breakfast|Lunch|Snack|Dinner)\s*(?:\((\d+)\s*(?:kcal|calories?)?\)|(?:\s*-\s*)?(\d+)\s*(?:kcal|calories?))?(?:\s*:|$)/i);
      if (mealTypeMatch) {
        if (currentDay && currentMealType && currentMealItems.length > 0) {
          const dayIndex = currentDay - 1;
          if (dayIndex >= 0 && dayIndex < mealPlansByDay.length) {
            const mealIndex = mealPlansByDay[dayIndex].meals.findIndex(m => m.type === currentMealType);
            if (mealIndex !== -1) {
              mealPlansByDay[dayIndex].meals[mealIndex].items = currentMealItems;
            }
          }
        }
        currentMealType = mealTypeMatch[1];
        const calories = parseInt(mealTypeMatch[2] || mealTypeMatch[3]) || 0;
        currentMealItems = [];
        
        console.log(`Found meal type: ${currentMealType}, calories: ${calories}`);
        
        if (currentDay && currentDay <= 7) {
          const dayIndex = currentDay - 1;
          if (dayIndex >= 0 && dayIndex < mealPlansByDay.length) {
            const mealIndex = mealPlansByDay[dayIndex].meals.findIndex(m => m.type === currentMealType);
            if (mealIndex !== -1) {
              mealPlansByDay[dayIndex].meals[mealIndex].calories = calories;
            }
          }
        }
        return;
      }

      const itemMatch = line.match(/^(?:\d+\.|[\-•●])\s*(.*?)\s*—\s*(.*?)\s*—\s*(\d+)\s*(?:kcal|calories?|cal)$/i);
      if (itemMatch) {
        const itemName = cleanItemText(itemMatch[1]);
        const itemQty = itemMatch[2].trim();
        const itemCalories = parseInt(itemMatch[3]) || 0;
        const description = itemQty ? `${itemName} — ${itemQty}` : itemName;
        
        if (currentDay && currentMealType && currentDay <= 7) {
          const dayIndex = currentDay - 1;
          if (dayIndex >= 0 && dayIndex < mealPlansByDay.length) {
            const mealIndex = mealPlansByDay[dayIndex].meals.findIndex(m => m.type === currentMealType);
            if (mealIndex !== -1) {
              mealPlansByDay[dayIndex].meals[mealIndex].items.push({
                description: description,
                calories: itemCalories
              });
            }
          }
        }
      }
    });

    // Save items for the last meal of the last processed day
    if (currentDay && currentMealType && currentMealItems.length > 0 && currentDay <= 7) {
      const dayIndex = currentDay - 1;
      if (dayIndex >= 0 && dayIndex < mealPlansByDay.length) {
        const mealIndex = mealPlansByDay[dayIndex].meals.findIndex(m => m.type === currentMealType);
        if (mealIndex !== -1) {
          mealPlansByDay[dayIndex].meals[mealIndex].items = currentMealItems;
        }
      }
    }

         // Fill missing meals for all 7 days to ensure complete meal plan
     mealPlansByDay.forEach((dayPlan, index) => {
       dayPlan.meals.forEach(meal => {
         if (meal.items.length === 0 && meal.calories === 0) {
           // Fill empty meals with balanced options
           console.log(`Filling empty meal: Day ${dayPlan.dayNumber} ${meal.type}`);
           const defaultCalories = meal.type === 'Breakfast' ? 300 : meal.type === 'Lunch' ? 400 : meal.type === 'Snack' ? 150 : 450;
           meal.items = [
             { description: `Balanced ${meal.type.toLowerCase()} - 1 serving`, calories: Math.floor(defaultCalories * 0.4) },
             { description: `Healthy side - 1 portion`, calories: Math.floor(defaultCalories * 0.3) },
             { description: `Nutritious option - 1 item`, calories: Math.floor(defaultCalories * 0.3) }
           ];
           meal.calories = meal.items.reduce((sum, item) => sum + item.calories, 0);
         }
       });
     });

    // Process workout plan - always create all 7 days
    const workoutSections = [];
    for (let i = 1; i <= 7; i++) {
      workoutSections.push({
        dayNumber: i,
        workoutType: 'Rest Day', // Default to Rest Day, will be overridden by backend response
        exercises: []
      });
    }

    let currentWorkoutDay = null;
    let currentWorkoutType = null;
    let currentExercises = [];

    if (extractedWorkoutContent) {
      const workoutPlanLines = extractedWorkoutContent.split('\n').map(line => line.trim()).filter(Boolean);
      let isProcessingWorkout = false;
      
      // Filter out any recommendation text that might have slipped through
      const filteredWorkoutLines = workoutPlanLines.filter(line => 
        !line.match(/Follow this plan|consistently.*achieve|END-OF-PLAN SUGGESTION|Closing Recommendation|To achieve your goal|To effectively/i)
      );

      filteredWorkoutLines.forEach((line, index) => {
        console.log(`Processing workout line ${index}: ${line}`);
        
        // Check for exclusion messages like "Day 5:, 6, and 7 are not included"
        const exclusionMatch = line.match(/Day\s*(\d+)[:,]\s*(\d+),\s*and\s*(\d+)\s*are\s*not\s*included/i);
        if (exclusionMatch) {
          const day1 = parseInt(exclusionMatch[1]);
          const day2 = parseInt(exclusionMatch[2]);
          const day3 = parseInt(exclusionMatch[3]);
          
          // Set these days as Rest Day
          [day1, day2, day3].forEach(dayNum => {
            if (dayNum >= 1 && dayNum <= 7) {
              const dayIndex = dayNum - 1;
              workoutSections[dayIndex].workoutType = 'Rest Day';
              workoutSections[dayIndex].exercises = [];
              console.log(`Set Day ${dayNum} as Rest Day due to exclusion message`);
            }
          });
          return;
        }
        
        // Check for single day exclusion messages like "Day 5: not included"
        const singleExclusionMatch = line.match(/Day\s*(\d+)[:\s]*not\s*included/i);
        if (singleExclusionMatch) {
          const dayNum = parseInt(singleExclusionMatch[1]);
          if (dayNum >= 1 && dayNum <= 7) {
            const dayIndex = dayNum - 1;
            workoutSections[dayIndex].workoutType = 'Rest Day';
            workoutSections[dayIndex].exercises = [];
            console.log(`Set Day ${dayNum} as Rest Day due to single exclusion message`);
          }
          return;
        }
        
        // More flexible day pattern matching
        let dayMatch = line.match(/Day\s*(\d+)(?:\s*[-:]\s*|\s*:\s*)([^:]+)(?::|$)/i);
        if (!dayMatch) {
          dayMatch = line.match(/Day\s*(\d+)\s*[-:]?\s*(.*)/i);
        }
        if (!dayMatch) {
          // Try to match just "Day X" without any additional text
          dayMatch = line.match(/Day\s*(\d+)(?:\s*$|\s*[:\-])/i);
          if (dayMatch) {
            dayMatch[2] = ''; // No workout type specified
          }
        }
        
        if (dayMatch) {
          if (currentWorkoutDay && currentExercises.length > 0) {
            const dayIndex = currentWorkoutDay - 1;
            if (dayIndex >= 0 && dayIndex < workoutSections.length) {
              workoutSections[dayIndex].exercises = currentExercises;
              workoutSections[dayIndex].workoutType = currentWorkoutType;
            }
          }
          currentWorkoutDay = parseInt(dayMatch[1]);
          currentWorkoutType = dayMatch[2] ? dayMatch[2].trim() : getWorkoutType(currentWorkoutDay);
          
          // Clean up special characters and formatting from workout type
          currentWorkoutType = currentWorkoutType
            .replace(/:\s*$/, '') // Remove trailing colon
            .replace(/\*\*/g, '') // Remove double asterisks
            .replace(/\*/g, '') // Remove single asterisks
            .replace(/^\s*[—\-]\s*/, '') // Remove leading dash or em dash
            .replace(/^\s*[–]\s*/, '') // Remove en dash
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
          
          if (!currentWorkoutType || currentWorkoutType === 'Day' || currentWorkoutType === 'Workout') {
            currentWorkoutType = getWorkoutType(currentWorkoutDay);
          }
          
          currentExercises = [];
          isProcessingWorkout = true;
          
          console.log(`Found workout day: ${currentWorkoutDay}, type: ${currentWorkoutType}`);
          
          if (currentWorkoutDay > 0 && currentWorkoutDay <= 7) {
            const dayIndex = currentWorkoutDay - 1;
            workoutSections[dayIndex].workoutType = currentWorkoutType;
          } else {
            console.warn(`Workout day ${currentWorkoutDay} is invalid`);
          }
          return;
        }

        if (isProcessingWorkout) {
          // More flexible exercise detection - look for any line that could be an exercise
          // Skip lines that are clearly not exercises (day headers, empty lines, etc.)
          const isExerciseLine = line && 
            !line.match(/^Day\s*\d+/i) && // Not a day header
            !line.match(/^Rest\s+Day/i) && // Not a rest day header
            !line.match(/^Workout\s+Plan/i) && // Not a workout plan header
            !line.match(/^Exercise/i) && // Not an exercise header
            line.length > 2 && // At least 3 characters
            !line.match(/^[:\-\s]*$/); // Not just punctuation/whitespace
          
          if (isExerciseLine) {
            // Clean up the exercise line - remove common prefixes but keep the content
            let exercise = line.trim();
            
            // Remove common bullet points and numbering, but be more careful with dashes
            // Only remove if it's clearly a bullet point or number, not part of the exercise name
            exercise = exercise.replace(/^(\d+\s*[.)]|[\-•●])\s*/, '').trim();
            
            // Skip if exercise is too short or incomplete (likely streaming artifact)
            if (exercise.length < 2) {
              console.log(`Skipping incomplete exercise: "${exercise}"`);
              return;
            }
            
            // Skip if exercise ends with incomplete patterns (streaming artifacts)
            // But be more lenient - only skip if it's clearly incomplete
            if (exercise.endsWith('—') || exercise.endsWith('-') || exercise.endsWith(',')) {
              // Check if it might be a continuation of a previous exercise
              if (currentWorkoutDay && currentWorkoutDay <= 7) {
                const section = workoutSections.find(s => s.dayNumber === currentWorkoutDay);
                if (section && section.exercises.length > 0) {
                  const lastExercise = section.exercises[section.exercises.length - 1];
                  // If the last exercise ends with a dash and this line starts with details, combine them
                  if (lastExercise.description.endsWith('—') && !exercise.includes('—')) {
                    lastExercise.description = lastExercise.description + ' ' + exercise;
                    console.log(`Combined exercise: ${lastExercise.description}`);
                    return;
                  }
                }
              }
              console.log(`Skipping incomplete exercise ending: "${exercise}"`);
              return;
            }
            
            // Additional validation for streaming content - skip if exercise looks incomplete
            // Be more strict to prevent incomplete exercises like "Push-U" instead of "Push-Ups"
            if (exercise.length < 5 && !exercise.includes('—') && !exercise.includes('×') && !exercise.includes('sets') && !exercise.includes('min') && !exercise.includes('reps')) {
              console.log(`Skipping potentially incomplete exercise: "${exercise}"`);
              return;
            }
            
            // Skip exercises that end abruptly (likely streaming artifacts)
            if (exercise.endsWith('-') && !exercise.includes('—')) {
              console.log(`Skipping exercise ending with dash: "${exercise}"`);
              return;
            }
            
            // Check if this might be an incomplete exercise that should be buffered
            if (exercise.length < 10 && !exercise.includes('—') && !exercise.includes('×') && !exercise.includes('sets') && !exercise.includes('reps')) {
              // This might be an incomplete exercise, buffer it for now
              setIncompleteExerciseBuffer(exercise);
              console.log(`Buffering potentially incomplete exercise: "${exercise}"`);
              return;
            }
            
            if (currentWorkoutDay && currentWorkoutDay <= 7) {
              const section = workoutSections.find(s => s.dayNumber === currentWorkoutDay);
              if (section) {
                // Check if this might be a continuation of a buffered exercise
                if (incompleteExerciseBuffer && exercise.includes('—')) {
                  const combinedExercise = incompleteExerciseBuffer + exercise;
                  setIncompleteExerciseBuffer(''); // Clear the buffer
                  console.log(`Combined buffered exercise: "${combinedExercise}"`);
                  // Process the combined exercise
                  exercise = combinedExercise;
                }
                
                // Check if this might be a continuation of the previous exercise
                if (section.exercises.length > 0) {
                  const lastExercise = section.exercises[section.exercises.length - 1];
                  
                  // If the last exercise is incomplete (ends with dash) and this line has details, combine them
                  if (lastExercise.description.endsWith('—') && !exercise.includes('—')) {
                    lastExercise.description = lastExercise.description + ' ' + exercise;
                    console.log(`Combined exercise: ${lastExercise.description}`);
                    return;
                  }
                  
                  // If this line is just a word and the last exercise is incomplete, combine them
                  if (exercise.split(' ').length <= 2 && lastExercise.description.endsWith('—')) {
                    lastExercise.description = lastExercise.description + ' ' + exercise;
                    console.log(`Combined exercise: ${lastExercise.description}`);
                    return;
                  }
                }
                
                // Check if exercise already exists to avoid duplicates
                const existingExercise = section.exercises.find(ex => {
                  const existingDesc = ex.description.toLowerCase().trim();
                  const newDesc = exercise.toLowerCase().trim();
                  
                  // Check for exact match
                  if (existingDesc === newDesc) return true;
                  
                  // Check if one is a substring of the other (for streaming chunks)
                  if (existingDesc.includes(newDesc) || newDesc.includes(existingDesc)) return true;
                  
                  // Check if they start with the same words (for partial streaming)
                  const existingWords = existingDesc.split(' ').slice(0, 3);
                  const newWords = newDesc.split(' ').slice(0, 3);
                  if (existingWords.length > 0 && newWords.length > 0) {
                    const commonWords = existingWords.filter(word => newWords.includes(word));
                    return commonWords.length >= 2; // If at least 2 words match, consider it duplicate
                  }
                  
                  // Check if this is a simple version of an existing detailed exercise
                  // e.g., "Plank" vs "Plank — 3 sets × 60 seconds hold"
                  if (existingDesc.includes('—') && !newDesc.includes('—')) {
                    const existingBase = existingDesc.split('—')[0].trim();
                    if (existingBase === newDesc) return true;
                  }
                  
                  // Check if this is a detailed version of an existing simple exercise
                  if (!existingDesc.includes('—') && newDesc.includes('—')) {
                    const newBase = newDesc.split('—')[0].trim();
                    if (existingDesc === newBase) return true;
                  }
                  
                  return false;
                });
                
                if (!existingExercise && exercise.length > 0) {
                  section.exercises.push({
                    number: section.exercises.length + 1,
                    description: exercise
                  });
                  console.log(`Adding exercise to day ${currentWorkoutDay}: ${exercise}`);
                } else if (existingExercise) {
                  // If the new exercise is longer/more complete, replace the existing one
                  if (exercise.length > existingExercise.description.length) {
                    existingExercise.description = exercise;
                    console.log(`Updated exercise to more complete version: ${exercise}`);
                  } else if (exercise.includes('—') && !existingExercise.description.includes('—')) {
                    // If new exercise has details and existing doesn't, replace it
                    existingExercise.description = exercise;
                    console.log(`Replaced simple exercise with detailed version: ${exercise}`);
                  } else {
                    console.log(`Skipping duplicate exercise: ${exercise}`);
                  }
                }
              } else {
                console.warn(`Cannot add exercise - day ${currentWorkoutDay} not found in sections`);
              }
            } else {
              console.warn(`Cannot add exercise - no current workout day set`);
            }
          }
        }
      });

      // Save exercises for the last workout day
      if (currentWorkoutDay && currentExercises.length > 0 && currentWorkoutDay <= 7) {
        const dayIndex = currentWorkoutDay - 1;
        if (dayIndex >= 0 && dayIndex < workoutSections.length) {
          workoutSections[dayIndex].exercises = currentExercises;
          workoutSections[dayIndex].workoutType = currentWorkoutType;
        }
      }
    }

    // Ensure rest days are properly handled
    workoutSections.forEach(section => {
      if (section.workoutType.toLowerCase().includes('rest') || 
          section.workoutType.toLowerCase().includes('recovery') ||
          section.workoutType.toLowerCase().includes('off')) {
        section.exercises = [];
        section.workoutType = 'Rest Day';
      } else if (section.exercises.length === 0) {
        // If no exercises are scheduled, it's a rest day
        section.workoutType = 'Rest Day';
        section.exercises = [];
      } else {
        section.exercises.forEach((exercise, idx) => {
          exercise.number = idx + 1;
        });
      }
    });

    console.log('Processed meal plans:', mealPlansByDay);
    console.log('Processed workouts:', workoutSections);

    // Merge with existing data instead of overwriting
    setMealPlansByDay(prevMealPlans => {
      // If we have existing data from streaming, merge it with the final parsed data
      if (prevMealPlans.length > 0) {
        const mergedPlans = [...prevMealPlans];
        mealPlansByDay.forEach(newDay => {
          const existingDayIndex = mergedPlans.findIndex(day => day.dayNumber === newDay.dayNumber);
          if (existingDayIndex !== -1) {
            // Merge the data, keeping existing items and adding new ones
            mergedPlans[existingDayIndex] = {
              ...mergedPlans[existingDayIndex],
              ...newDay,
              meals: newDay.meals.map(newMeal => {
                const existingMeal = mergedPlans[existingDayIndex].meals.find(m => m.type === newMeal.type);
                if (existingMeal && existingMeal.items.length > 0) {
                  // Keep existing items if they exist, otherwise use new ones
                  return {
                    ...newMeal,
                    items: existingMeal.items.length > 0 ? existingMeal.items : newMeal.items,
                    calories: existingMeal.calories > 0 ? existingMeal.calories : newMeal.calories
                  };
                }
                return newMeal;
              })
            };
          } else {
            mergedPlans.push(newDay);
          }
        });
        return mergedPlans;
      }
      return mealPlansByDay;
    });

    setWorkoutSections(prevWorkouts => {
      // If we have existing workout data from streaming, merge it
      if (prevWorkouts.length > 0) {
        const mergedWorkouts = [...prevWorkouts];
        workoutSections.forEach(newWorkout => {
          const existingWorkoutIndex = mergedWorkouts.findIndex(workout => workout.dayNumber === newWorkout.dayNumber);
          if (existingWorkoutIndex !== -1) {
            // Merge workout data, keeping existing exercises if they exist
            mergedWorkouts[existingWorkoutIndex] = {
              ...mergedWorkouts[existingWorkoutIndex],
              ...newWorkout,
              exercises: mergedWorkouts[existingWorkoutIndex].exercises.length > 0 ? 
                mergedWorkouts[existingWorkoutIndex].exercises : newWorkout.exercises
            };
          } else {
            mergedWorkouts.push(newWorkout);
          }
        });
        return mergedWorkouts;
      }
      return workoutSections;
    });
  };

  const toggleAccordion = (section, type) => {
    if (type === 'meal') {
      setOpenMealAccordion(openMealAccordion === section ? '' : section);
      setOpenMealSubAccordion('');
    } else if (type === 'meal-sub') {
      setOpenMealSubAccordion(openMealSubAccordion === section ? '' : section);
    } else {
      setOpenWorkoutAccordion(openWorkoutAccordion === section ? '' : section);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setFitnessGoal(suggestion);
    
    // Auto-populate form data from user profile if available
    let initialFormData = {
      age: '',
      gender: '',
      height: '',
      currentWeight: '',
      targetWeight: '',
      activityLevel: '',
      workoutDays: '',
      timeframe: '3'
    };

    if (userProfileData) {
      // Use age directly if available
      if (userProfileData.age) {
        initialFormData.age = userProfileData.age.toString();
      }
      
      // Auto-populate other fields from profile
      if (userProfileData.gender) {
        initialFormData.gender = userProfileData.gender;
      }
      if (userProfileData.height) {
        initialFormData.height = userProfileData.height.toString();
      }
      if (userProfileData.weight) {
        initialFormData.currentWeight = userProfileData.weight.toString();
      }
      if (userProfileData.activityLevel) {
        // Map activity level to form values
        const activityLevelMap = {
          'sedentary': 'sedentary',
          'light': 'light',
          'moderate': 'moderate',
          'very': 'very',
          'extra': 'extra'
        };
        initialFormData.activityLevel = activityLevelMap[userProfileData.activityLevel] || userProfileData.activityLevel;
      }
    }

    setFormData(initialFormData);
    setShowPlans(false);
    setMealPlansByDay([]);
    setWorkoutSections([]);
    setPlansComplete(false); // Reset plans complete status
    setNoWorkoutPlan(false); // Reset no workout plan flag
    setCurrentPopupGoal(suggestion);
  };

  const handleFormChange = (e) => {
    const { name, value, type } = e.target;
    
    if (type === 'select-multiple') {
      const options = e.target.options;
      const selectedOptions = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].selected) {
          selectedOptions.push(options[i].value);
        }
      }
      setFormData({
        ...formData,
        [name]: selectedOptions
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleNaturalLanguageInput = async (prompt, bypassProfileCheck = false) => {
    console.log('Processing natural language input:', prompt);
    
    // Set flags for natural language processing
    setUseExistingProfile(false);
    setShowProfileForm(false);
    
    // First check if user has profile data (unless bypassed)
    if (!bypassProfileCheck && auth.currentUser) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Check if user has complete profile data
          if (userData.age && userData.gender && userData.height && userData.weight && userData.activityLevel) {
            // User has profile - show "use profile" popup
            setUserProfileData(userData);
            setShowProfileChoicePopup(true);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking user profile:', error);
        // Continue with prompt validation if profile check fails
      }
    }
    
    const extractedData = parsePrompt(prompt);
    console.log('Extracted data:', extractedData);
    console.log('Required fields check:', {
      age: extractedData.age,
      gender: extractedData.gender,
      height: extractedData.height,
      weight: extractedData.weight,
      activityLevel: extractedData.activityLevel,
      frequency: extractedData.frequency,
      workoutDays: extractedData.workoutDays
    });
    
    // Store extracted data for later use
    setExtractedProfileData(extractedData);
    
    // NEW: Set profileFormData with extracted data to ensure natural language approach works
    setProfileFormData({
      age: extractedData.age || '',
      gender: extractedData.gender || '',
      height: extractedData.height || '',
      currentWeight: extractedData.weight || '',
      targetWeight: extractedData.targetWeight?.value || extractedData.weight || '',
      activityLevel: extractedData.activityLevel || 'moderate',
      targetTimeline: extractedData.timelineWeeks ? Math.floor(extractedData.timelineWeeks / 4) : '3',
      workoutDays: extractedData.frequency || '5',
      goal: extractedData.goal || fitnessGoal || ''
    });

    // Check if we have enough data to calculate calories
    if (extractedData.age && extractedData.gender && extractedData.height && extractedData.weight && extractedData.activityLevel) {
      // Calculate calories immediately
      setIsLoading(true);
      try {
        const response = await fetch(getApiUrl('user'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt,
            userDetails: {
              age: parseInt(extractedData.age),
              weight: parseFloat(extractedData.weight),
              height: parseFloat(extractedData.height),
              gender: extractedData.gender,
              activityLevel: extractedData.activityLevel,
              targetWeight: parseFloat(extractedData.targetWeight?.value || extractedData.weight),
              timelineWeeks: parseInt(extractedData.timelineWeeks || extractedData.timeline?.value || 12),
              healthGoals: extractedData.goal || 'Get Fit'
            }
          })
        });
      
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
      
        const calorieData = await response.json();
        setCalculatedCalories(calorieData);
        setIsLoading(false);
        setShowCalorieResults(true);
      
        // Store extracted data for later use
        setExtractedProfileData(extractedData);
      
      } catch (error) {
        console.error('Error calculating calories:', error);
        setIsLoading(false);
        let errorMessage = 'Failed to calculate calories. ';
        if (error.message.includes('Failed to fetch')) {
          errorMessage += 'Make sure the backend server is running on http://localhost:5002';
        } else {
          errorMessage += 'Please try again.';
        }
        setSuccessMessage(errorMessage);
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 5000);
      }
    } else {
      // Not enough data, show detailed error with specific missing fields
      const validation = validateProfileData(extractedData, fitnessGoal);
      setErrorPopupMessage(validation.message);
      setShowErrorPopup(true);
      setTimeout(() => setShowErrorPopup(false), 8000);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // If we have a natural language prompt, process it first
    if (naturalLanguagePrompt) {
      handleNaturalLanguageInput(naturalLanguagePrompt);
    }
    
    if (!currentPopupGoal) return;
    
    // Skip profile check for manual form submission - user is explicitly filling out the form
    // Only check profile for natural language prompts
    
    if (!formData.age || !formData.gender || !formData.height || 
        !formData.currentWeight || !formData.targetWeight || 
        !formData.activityLevel || !formData.workoutDays || !formData.timeframe) {
      setSuccessMessage('Please fill in all required fields.');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);
      return;
    }
    
    // Calculate calories first - copy exact logic from handleNaturalLanguageInput
    setIsLoading(true);
    
    // Debug: Log form data being sent
    console.log('=== FORM SUBMISSION DEBUG ===');
    console.log('Form data:', formData);
    console.log('Current popup goal:', currentPopupGoal);
    console.log('Fitness goal:', fitnessGoal);
    
    try {
      const requestData = {
        age: parseInt(formData.age),
        weight: parseFloat(formData.currentWeight),
        height: parseFloat(formData.height),
        gender: formData.gender,
        activityLevel: formData.activityLevel,
        targetWeight: parseFloat(formData.targetWeight),
        timelineWeeks: parseInt(formData.timeframe) * 4,
        goal: currentPopupGoal, // Use currentPopupGoal instead of fitnessGoal
        workoutDays: parseInt(formData.workoutDays)
      };
      
      console.log('Sending to /user endpoint:', requestData);
      
      const response = await fetch(getApiUrl('user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const calorieData = await response.json();
      setCalculatedCalories(calorieData);
      setIsLoading(false);
      setShowCalorieResults(true); // Use the same state as natural language input
      
      // Set profileFormData so workout plan generation can access workout days
      setProfileFormData({
        age: formData.age,
        gender: formData.gender,
        height: formData.height,
        currentWeight: formData.currentWeight,
        targetWeight: formData.targetWeight,
        activityLevel: formData.activityLevel,
        workoutDays: formData.workoutDays,
        targetTimeline: formData.timeframe,
        goal: currentPopupGoal // Use currentPopupGoal instead of fitnessGoal
      });
      
      // Clear extractedProfileData to ensure profileFormData takes priority
      setExtractedProfileData({});
      
      // Close the form popup after successful submission
      setFitnessGoal(currentPopupGoal); // Set fitness goal BEFORE clearing currentPopupGoal
      setCurrentPopupGoal(null);
      
    } catch (error) {
      console.error('Error calculating calories:', error);
      setIsLoading(false);
      let errorMessage = 'Failed to calculate calories. ';
      if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Make sure the backend server is running on http://localhost:5002';
      } else {
        errorMessage += 'Please try again.';
      }
      setSuccessMessage(errorMessage);
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 5000);
    }
  };

  const getMealIcon = (mealType) => {
    const iconMap = {
      'Breakfast': 'fa-sun',
      'Lunch': 'fa-utensils',
      'Snack': 'fa-apple-alt',
      'Dinner': 'fa-moon'
    };
    return iconMap[mealType] || 'fa-utensils';
  };

  const getWorkoutIcon = (focusArea) => {
    if (focusArea.toLowerCase().includes('cardio')) return 'fa-heartbeat';
    if (focusArea.toLowerCase().includes('lower')) return 'fa-running';
    if (focusArea.toLowerCase().includes('upper')) return 'fa-dumbbell';
    if (focusArea.toLowerCase().includes('hiit')) return 'fa-bolt';
    if (focusArea.toLowerCase().includes('active') || focusArea.toLowerCase().includes('rest')) return 'fa-walking';
    return 'fa-dumbbell';
  };

  const getWorkoutType = (focusArea) => {
    if (typeof focusArea === 'number') {
      const dayNumber = focusArea;
      const types = [
        'Upper Body',
        'Lower Body',
        'Cardio & Endurance',
        'Core & Abs',
        'Total Body',
        'Flexibility & Recovery',
        'HIIT Training'
      ];
      return types[(dayNumber - 1) % types.length];
    }
    
    if (typeof focusArea === 'string') {
      if (focusArea.toLowerCase().includes('rest')) return 'Rest Day';
      if (focusArea.toLowerCase().includes('cardio')) return 'Cardio & Endurance';
      if (focusArea.toLowerCase().includes('lower')) return 'Lower Body';
      if (focusArea.toLowerCase().includes('upper')) return 'Upper Body';
      if (focusArea.toLowerCase().includes('hiit')) return 'HIIT Training';
      if (focusArea.toLowerCase().includes('active') || focusArea.toLowerCase().includes('recovery')) return 'Flexibility & Recovery';
      if (focusArea.toLowerCase().includes('total')) return 'Total Body';
      if (focusArea.toLowerCase().includes('core') || focusArea.toLowerCase().includes('abs')) return 'Core & Abs';
    }
    
    return 'Mixed Training';
  };

  const storeSubmissionInFirebase = (prompt) => {
    try {
      const timestamp = new Date().toISOString();
      let shopifyCustomerId = 'guest';
      let shopifyCustomerName = 'guest';
      let shopifyCustomerEmail = 'guest';
      
      try {
        const customerDataScript = document.getElementById('shopify-customer-data');
        if (customerDataScript) {
          const shopifyCustomerData = JSON.parse(customerDataScript.textContent);
          if (shopifyCustomerData.id) {
            shopifyCustomerId = shopifyCustomerData.id;
            shopifyCustomerName = `${shopifyCustomerData.first_name || ''} ${shopifyCustomerData.last_name || ''}`.trim() || 'guest';
            shopifyCustomerEmail = shopifyCustomerData.email || 'guest';
          }
        }
      } catch (e) {
        console.log('Error parsing Shopify customer data script:', e);
      }

      if (shopifyCustomerId === 'guest' && window.customer_data?.id) {
        shopifyCustomerId = window.customer_data.id;
        shopifyCustomerName = `${window.customer_data.first_name || ''} ${window.customer_data.last_name || ''}`.trim() || 'guest';
        shopifyCustomerEmail = window.customer_data.email || 'guest';
      }

      if (shopifyCustomerId === 'guest' && window.Shopify?.customer?.id) {
        shopifyCustomerId = window.Shopify.customer.id;
        shopifyCustomerName = `${window.Shopify.customer.first_name || ''} ${window.Shopify.customer.last_name || ''}`.trim() || 'guest';
        shopifyCustomerEmail = window.Shopify.customer.email || 'guest';
      }

      const submissionData = {
        prompt: prompt,
        shopifyUserId: shopifyCustomerId,
        shopifyUsername: shopifyCustomerName,
        shopifyUserEmail: shopifyCustomerEmail,
        requestTime: serverTimestamp(),
        clientTimestamp: timestamp,
        isLoggedIn: isCustomerLoggedIn,
        formData: currentPopupGoal ? { ...formData } : null,
        userAgent: navigator.userAgent,
        platform: navigator.platform
      };
      
      console.log('Storing submission in Firebase:', submissionData);
      
      const fitnessGoalsRef = ref(database, 'fitnessGoals');
      push(fitnessGoalsRef, submissionData)
        .then(() => {
          console.log('Successfully stored submission in Firebase');
        })
        .catch((error) => {
          console.error('Firebase push error:', error);
        });
    } catch (error) {
      console.error('Error storing submission in Firebase:', error);
    }
  };

  const estimateCalories = (mealItem) => {
    const calorieEstimates = {
      'oatmeal': 150,
      'yogurt': 120,
      'greek yogurt': 130,
      'berries': 50,
      'banana': 105,
      'apple': 95,
      'orange': 62,
      'nuts': 160,
      'almond': 165,
      'peanut butter': 190,
      'eggs': 140,
      'egg': 70,
      'toast': 75,
      'bread': 80,
      'whole grain': 90,
      'chicken': 165,
      'salmon': 208,
      'fish': 180,
      'tuna': 120,
      'salad': 100,
      'rice': 130,
      'quinoa': 120,
      'avocado': 234,
      'protein': 120,
      'smoothie': 150,
      'vegetables': 50,
      'veggies': 50,
      'broccoli': 55,
      'sweet potato': 103,
      'potato': 160,
      'hummus': 166,
      'olive oil': 120,
      'cheese': 113,
      'milk': 103,
      'protein bar': 200,
      'granola': 120,
      'honey': 64,
      'fruit': 60,
      'steak': 250,
      'beef': 213,
      'turkey': 165,
      'tofu': 144,
      'lentils': 230,
      'beans': 132,
      'soup': 170,
      'wrap': 245,
      'sandwich': 260,
      'pasta': 200,
      'noodles': 190,
      'snack': 100,
    };

    const itemLower = mealItem.toLowerCase();
    let totalCalories = 0;
    let matched = false;

    Object.entries(calorieEstimates).forEach(([keyword, calories]) => {
      if (itemLower.includes(keyword)) {
        totalCalories += calories;
        matched = true;
      }
    });

    return matched ? totalCalories : 100; // Default to 100 if no match
  };

  const calculateMealCalories = (items) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (item.calories || estimateCalories(item.description)), 0);
  };

  const calculateDailyCalories = (meals) => {
    if (!meals || meals.length === 0) return 0;
    return meals.reduce((sum, meal) => {
      const mealCalories = meal.calories || calculateMealCalories(meal.items);
      return sum + mealCalories;
    }, 0);
  };

  const getCustomerName = () => {
    try {
      const customerDataScript = document.getElementById('shopify-customer-data');
      if (customerDataScript) {
        try {
          const shopifyCustomerData = JSON.parse(customerDataScript.textContent);
          if (shopifyCustomerData.first_name || shopifyCustomerData.last_name) {
            return `${shopifyCustomerData.first_name || ''} ${shopifyCustomerData.last_name || ''}`.trim();
          }
        } catch (e) {
          console.log('Error parsing Shopify customer data script:', e);
        }
      }

      if (window.customer_data) {
        const { first_name, last_name } = window.customer_data;
        if (first_name || last_name) {
          return `${first_name || ''} ${last_name || ''}`.trim();
        }
      }

      if (window.Shopify?.customer) {
        const firstName = window.Shopify.customer.first_name || '';
        const lastName = window.Shopify.customer.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) return fullName;
      }

      return null;
    } catch (error) {
      console.error('Error getting customer name:', error);
      return null;
    }
  };

  const isActuallyLoggedIn = () => {
    try {
      console.log('🔍 AiCoach: isActuallyLoggedIn called');
      console.log('🔍 AiCoach: AuthContext state - isAuthenticated:', isAuthenticated, 'user:', user ? 'exists' : 'null');
      
      // First check AuthContext authentication
      if (isAuthenticated && user) {
        console.log('🔐 AiCoach: User authenticated via AuthContext:', user.email);
        return true;
      }
      
      // Check for verified customer session
      const verifiedSession = localStorage.getItem('verifiedCustomerSession');
      console.log('🔍 AiCoach: Checking verified session in isActuallyLoggedIn:', verifiedSession ? 'exists' : 'null');
      
      if (verifiedSession) {
        try {
          const sessionData = JSON.parse(verifiedSession);
          const sessionAge = Date.now() - sessionData.timestamp;
          const maxAge = 30 * 60 * 1000; // 30 minutes
          
          console.log('🔍 AiCoach: Session data in isActuallyLoggedIn:', {
            email: sessionData.email,
            verified: sessionData.verified,
            age: sessionAge,
            maxAge: maxAge,
            isValid: sessionAge < maxAge && sessionData.verified
          });
          
          if (sessionAge < maxAge && sessionData.verified) {
            console.log('🔐 AiCoach: Valid verified customer session found in isActuallyLoggedIn');
            return true;
          } else {
            // Session expired, remove it
            console.log('🔐 AiCoach: Verified customer session expired, removing...');
            localStorage.removeItem('verifiedCustomerSession');
            console.log('🔐 AiCoach: Verified customer session removed');
          }
        } catch (error) {
          console.error('Error parsing verified customer session:', error);
          localStorage.removeItem('verifiedCustomerSession');
        }
      }
      
      // Check Shopify context
      const customerDataScript = document.getElementById('shopify-customer-data');
      if (customerDataScript) {
        try {
          const shopifyCustomerData = JSON.parse(customerDataScript.textContent);
          if (shopifyCustomerData.id) return true;
        } catch (e) {
          console.log('Error parsing Shopify customer data script:', e);
        }
      }

      if (window.customer_data?.id) return true;
      if (window.Shopify?.customer?.id) return true;
      if (window.meta?.page?.customerId) return true;
      
      console.log('🔍 AiCoach: No authentication found');
      return false;
    } catch (error) {
      console.error('Error checking login status:', error);
      return false;
    }
  };

  useEffect(() => {
    const isInShopifyContext = () => {
      return window.Shopify !== undefined || 
             window.ShopifyAnalytics !== undefined || 
             window.meta?.page?.customerId !== undefined ||
             window.customer !== undefined ||
             document.querySelector('body.template-page') !== null;
    };

    const checkShopifyCustomer = () => {
      console.log('🔍 AiCoach: checkShopifyCustomer called');
      console.log('🔍 AiCoach: Current state - isAuthenticated:', isAuthenticated, 'user:', user ? 'exists' : 'null', 'authLoading:', authLoading);
      
      // Wait for auth loading to complete
      if (authLoading) {
        console.log('🔍 AiCoach: Auth still loading, waiting...');
        return;
      }
      
      // Check AuthContext first
      if (isAuthenticated && user) {
        console.log('🔐 AiCoach: User authenticated via AuthContext, setting customer state');
        
        // Only update state if it's not already set correctly
        if (!isCustomerLoggedIn || !customerData) {
          setIsCustomerLoggedIn(true);
          setInputLocked(false);
          setCustomerData({
            id: user.uid,
            name: user.displayName || user.email,
            email: user.email
          });
          console.log('🔐 AiCoach: Customer state updated');
        } else {
          console.log('🔐 AiCoach: Customer state already correct, skipping update');
        }
        return;
      }
      
      // Check for verified customer session
      const verifiedSession = localStorage.getItem('verifiedCustomerSession');
      console.log('🔍 AiCoach: Checking verified session:', verifiedSession ? 'exists' : 'null');
      
      if (verifiedSession) {
        try {
          const sessionData = JSON.parse(verifiedSession);
          const sessionAge = Date.now() - sessionData.timestamp;
          const maxAge = 30 * 60 * 1000; // 30 minutes
          
          console.log('🔍 AiCoach: Session data:', {
            email: sessionData.email,
            uid: sessionData.uid,
            verified: sessionData.verified,
            age: sessionAge,
            maxAge: maxAge,
            isValid: sessionAge < maxAge && sessionData.verified
          });
          
          if (sessionAge < maxAge && sessionData.verified) {
            console.log('🔐 AiCoach: Valid verified customer session found, setting customer state');
            
            // Only update state if it's not already set correctly
            if (!isCustomerLoggedIn || !customerData) {
              setIsCustomerLoggedIn(true);
              setInputLocked(false);
              setCustomerData({
                id: sessionData.uid,
                name: sessionData.email,
                email: sessionData.email,
                customerId: sessionData.customerId
              });
              console.log('🔐 AiCoach: Customer state updated from verified session');
            } else {
              console.log('🔐 AiCoach: Customer state already correct, skipping update');
            }
            return;
          } else {
            localStorage.removeItem('verifiedCustomerSession');
            console.log('🔐 AiCoach: Verified customer session expired, removed');
          }
        } catch (error) {
          console.error('Error parsing verified customer session:', error);
          localStorage.removeItem('verifiedCustomerSession');
        }
      }
      
      // Only use development mode simulation if we're actually in development and no auth context
      if (!isInShopifyContext() && process.env.NODE_ENV === 'development' && !isAuthenticated && !verifiedSession && !isCustomerLoggedIn) {
        const urlParams = new URLSearchParams(window.location.search);
        const loggedIn = urlParams.get('loggedIn') === 'true';
        
        if (loggedIn) {
          console.log('Development mode: Simulating logged-in customer');
          setIsCustomerLoggedIn(true);
          setInputLocked(false);
          setCustomerData({
            id: '12345',
            name: 'Test Customer',
            email: 'test@example.com'
          });
        } else {
          console.log('Development mode: Simulating logged-out customer');
          setIsCustomerLoggedIn(false);
          setInputLocked(true);
        }
        return;
      }

      // Only check isActuallyLoggedIn if we haven't already determined the user is logged in
      let actuallyLoggedIn = isCustomerLoggedIn;
      
      if (!isCustomerLoggedIn) {
        actuallyLoggedIn = isActuallyLoggedIn();
        console.log('🔍 AiCoach: Final check - actuallyLoggedIn:', actuallyLoggedIn);
        setIsCustomerLoggedIn(actuallyLoggedIn);
        setInputLocked(!actuallyLoggedIn);
        
        console.log('🔍 AiCoach: Setting customer state - isCustomerLoggedIn:', actuallyLoggedIn, 'inputLocked:', !actuallyLoggedIn);
      } else {
        console.log('🔍 AiCoach: User already logged in, skipping final check');
      }

      if (actuallyLoggedIn) {
        let customerInfo = null;
        
        try {
          const customerDataScript = document.getElementById('shopify-customer-data');
          if (customerDataScript) {
            const shopifyCustomerData = JSON.parse(customerDataScript.textContent);
            customerInfo = {
              id: shopifyCustomerData.id,
              name: `${shopifyCustomerData.first_name || ''} ${shopifyCustomerData.last_name || ''}`.trim(),
              email: shopifyCustomerData.email
            };
          }
        } catch (e) {
          console.log('Error parsing Shopify customer data script:', e);
        }

        if (!customerInfo && window.customer_data) {
          customerInfo = {
            id: window.customer_data.id,
            name: `${window.customer_data.first_name || ''} ${window.customer_data.last_name || ''}`.trim(),
            email: window.customer_data.email
          };
        }

        if (!customerInfo) {
          const customerName = getCustomerName();
          if (customerName) {
            customerInfo = {
              id: window.Shopify?.customer?.id || 
                  window.meta?.page?.customerId || 
                  'unknown',
              name: customerName,
              email: window.Shopify?.customer?.email || 
                    window.meta?.page?.customer?.email || 
                    'unknown'
            };
          }
        }

        setCustomerData(customerInfo);
      } else {
        setCustomerData(null);
      }
    };

    checkShopifyCustomer();
    // Remove interval to prevent infinite re-renders
    // const interval = setInterval(checkShopifyCustomer, 2000);
    // return () => clearInterval(interval);
  }, [isAuthenticated, user, authLoading, userType]);

  const toggleInputLock = () => {
    if (isCustomerLoggedIn) {
      setInputLocked(false);
    } else {
      const returnPath = window.reactAiCoachUrl || "/pages/react-ai-coach";
      window.location.href = `https://theelefit.com/account/login?return_to=${returnPath}`;
    }
  };

  const PlanPDFDocument = ({ fitnessGoal, mealPlansByDay, workoutSections, endOfPlanSuggestion }) => (
    <Document>
      <Page style={pdfStyles.body}>
        <Text style={pdfStyles.title}>AI Fitness Plan</Text>
        <Text style={pdfStyles.sectionTitle}>Goal:</Text>
        <Text style={pdfStyles.text}>{fitnessGoal}</Text>
        <Text style={pdfStyles.sectionTitle}>Meal Plan</Text>
        {mealPlansByDay.map((day, i) => (
          <View key={i} style={pdfStyles.daySection}>
            <Text style={pdfStyles.dayTitle}>Day {day.dayNumber}</Text>
            <View style={pdfStyles.table}>
              <View style={pdfStyles.tableRowHeader}>
                <Text style={{ ...pdfStyles.tableCell, ...pdfStyles.mealTypeHeader }}>Meal Type</Text>
                <Text style={{ ...pdfStyles.tableCell, ...pdfStyles.mealItemsHeader }}>Items</Text>
                <Text style={{ ...pdfStyles.tableCell, ...pdfStyles.caloriesHeader }}>Calories</Text>
              </View>
              {day.meals.map((meal, j) => (
                <View key={j} style={[pdfStyles.tableRow, j % 2 === 0 ? pdfStyles.tableRowEven : pdfStyles.tableRowOdd]}> 
                  <Text style={{ ...pdfStyles.tableCell, ...pdfStyles.mealTypeCell }}>{meal.type}</Text>
                  <View style={{ ...pdfStyles.tableCell, ...pdfStyles.mealItemsCell }}>
                    {meal.items.map((item, k) => (
                      <Text key={k} style={pdfStyles.mealItem}>- {item.description} ({item.calories} kcal)</Text>
                    ))}
                  </View>
                  <Text style={{ ...pdfStyles.tableCell, ...pdfStyles.caloriesCell }}>{meal.calories}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <Text style={pdfStyles.sectionTitle}>Workout Plan</Text>
        {workoutSections.map((section, i) => (
          <View key={i} style={pdfStyles.daySection}>
            <Text style={pdfStyles.dayTitle}>Day {section.dayNumber}: {section.workoutType}</Text>
            {section.workoutType === 'Rest Day' ? (
              <Text style={pdfStyles.text}>Rest Day - No exercises scheduled</Text>
            ) : (
              <View style={pdfStyles.table}>
                <View style={pdfStyles.tableRowHeader}>
                  <Text style={{ ...pdfStyles.tableCell, ...pdfStyles.exerciseHeader }}>#</Text>
                  <Text style={{ ...pdfStyles.tableCell, ...pdfStyles.exerciseDescHeader }}>Exercise</Text>
                </View>
                {section.exercises.map((ex, j) => (
                  <View key={j} style={[pdfStyles.tableRow, j % 2 === 0 ? pdfStyles.tableRowEven : pdfStyles.tableRowOdd]}> 
                    <Text style={{ ...pdfStyles.tableCell, ...pdfStyles.exerciseNumCell }}>{j + 1}</Text>
                    <Text style={{ ...pdfStyles.tableCell, ...pdfStyles.exerciseDescCell }}>{ex.description}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
        <Text style={pdfStyles.sectionTitle}>Recommendation</Text>
        <Text style={pdfStyles.text}>{endOfPlanSuggestion}</Text>
      </Page>
    </Document>
  );

  const pdfStyles = StyleSheet.create({
    body: { padding: 24, fontSize: 12, fontFamily: 'Helvetica' },
    title: { fontSize: 20, marginBottom: 12, fontWeight: 'bold', textAlign: 'center', color: '#7c3aed' },
    sectionTitle: { fontSize: 16, marginTop: 16, marginBottom: 6, fontWeight: 'bold', color: '#8b5cf6' },
    daySection: { marginBottom: 18 },
    dayTitle: { fontSize: 14, marginBottom: 6, fontWeight: 'bold', color: '#3498db' },
    text: { marginBottom: 4 },
    table: { display: 'table', width: 'auto', marginBottom: 8, borderStyle: 'solid', borderWidth: 1, borderColor: '#e5e7eb' },
    tableRowHeader: { flexDirection: 'row', backgroundColor: '#8b5cf6', color: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', borderBottomStyle: 'solid' },
    tableRow: { flexDirection: 'row', minHeight: 18, alignItems: 'flex-start' },
    tableRowEven: { backgroundColor: '#f3f4f6' },
    tableRowOdd: { backgroundColor: '#fff' },
    tableCell: { flex: 1, padding: 4, fontSize: 11, borderRightWidth: 1, borderRightColor: '#e5e7eb', borderRightStyle: 'solid' },
    mealTypeHeader: { fontWeight: 'bold', backgroundColor: '#e74c3c', color: 'white' },
    mealItemsHeader: { fontWeight: 'bold', backgroundColor: '#2ecc71', color: 'white' },
    caloriesHeader: { fontWeight: 'bold', backgroundColor: '#f1c40f', color: 'white' },
    mealTypeCell: { color: '#e74c3c', fontWeight: 'bold' },
    mealItemsCell: { color: '#2ecc71' },
    caloriesCell: { color: '#f1c40f', textAlign: 'center' },
    mealItem: { fontSize: 10, marginBottom: 1 },
    exerciseHeader: { fontWeight: 'bold', backgroundColor: '#6366f1', color: 'white', flex: 0.3 },
    exerciseDescHeader: { fontWeight: 'bold', backgroundColor: '#6366f1', color: 'white', flex: 2 },
    exerciseNumCell: { color: '#6366f1', textAlign: 'center', flex: 0.3 },
    exerciseDescCell: { color: '#22223b', flex: 2 },
  });

  useEffect(() => {
    if (isLoading) {
      console.log('Loading state changed to true, triggering animation');
      animateLoadingIcons();
    }
  }, [isLoading]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && currentPopupGoal) {
        setCurrentPopupGoal(null);
      }
    };
    
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [currentPopupGoal]);

  useEffect(() => {
    let timers = [];
    if (isLoading) {
      setLoadingStage(0);
      timers.push(setTimeout(() => setLoadingStage(1), 10000)); // After 10s: TDEE
      timers.push(setTimeout(() => setLoadingStage(2), 15000)); // After 15s: meal
      timers.push(setTimeout(() => setLoadingStage(3), 20000)); // After 20s: workout
    } else {
      setLoadingStage(0);
      timers.forEach(clearTimeout);
    }
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isLoading]);

  // Auto-resize textarea when fitnessGoal changes
  useEffect(() => {
    const textarea = document.getElementById('fitnessGoal');
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const minHeight = 42;
      textarea.style.height = `${Math.max(scrollHeight, minHeight)}px`;
    }
  }, [fitnessGoal]);

  const animateLoadingIcons = () => {
    const icons = document.querySelectorAll('.loader-icon');
    gsap.set(icons, { opacity: 1, y: 0, scale: 1, rotation: 0 });
    
    const masterTimeline = gsap.timeline({ repeat: -1 });
    
    icons.forEach((icon, index) => {
      const duration =  2;
      const delay = index * 0.2;
      
      masterTimeline.to(icon, {
        keyframes: [
          { y: -15, scale: 1.1, rotation: 360, duration: duration/2, ease: "power1.inOut" },
          { y: 0, scale: 1, rotation: 360, duration: duration/2, ease: "power1.inOut" }
        ],
      }, delay);
    });

    gsap.to('.loading-text', {
      scale: 1.05,
      duration: 1,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut"
    });

    gsap.to('.loading-text', {
      backgroundPosition: '100% 50%',
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: "none"
    });
  };

  // Show error message if there's an error
  if (hasError) {
    return (
      <div className="ai-coach-container" style={{ textAlign: 'center', padding: '50px' }}>
        <h1 className="ai-coach-title">Authentication Error</h1>
        <p style={{ color: '#e74c3c', fontSize: '18px', marginBottom: '20px' }}>
          {errorMessage}
        </p>
        <p style={{ color: '#666' }}>
          Please wait while we redirect you to the login page...
        </p>
      </div>
    );
  }

  return (
    <div className="ai-coach-container">
      <h1 className="ai-coach-title">Ask our EleFit AI Coach</h1>
      <div className="input-section">
        {isActuallyLoggedIn() && (
          <div className="welcome-message">
            {(() => {
              const customerName = getCustomerName();
              return customerName ? `Welcome back, ${customerName}!` : null;
            })()}
          </div>
        )}
        <div className="input-container">
          <textarea
            id="fitnessGoal"
            className={`goal-input ${inputError ? 'input-error' : ''} ${currentPopupGoal ? 'disabled' : ''}`}
            placeholder="Enter your fitness goal..."
            value={fitnessGoal}
            onChange={(e) => {
              setFitnessGoal(e.target.value);
              setShowPlans(false);
              setValidationError('');
              
              // Auto-resize textarea
              const textarea = e.target;
              textarea.style.height = 'auto'; // Reset height to auto
              const scrollHeight = textarea.scrollHeight;
              const minHeight = 42; // Original height
              textarea.style.height = `${Math.max(scrollHeight, minHeight)}px`;
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleRecommendation();
              }
            }}
            disabled={!!currentPopupGoal}
            aria-disabled={!!currentPopupGoal}
            rows="1"
          />
          <button
            className={`recommend-button ${currentPopupGoal ? 'disabled' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              handleRecommendation();
            }}
            disabled={!!currentPopupGoal}
            aria-disabled={!!currentPopupGoal}
          >
            Get Recommendations
          </button>
        </div>
        
        {/* Copy Default Prompt Button */}
        <div className="copy-prompt-container">
          <button
            className={`copy-prompt-button ${copyButtonClicked ? 'clicked' : ''}`}
            onClick={handleCopyDefaultPrompt}
            title="Copy default prompt template"
          >
            <i className={`fas ${copyButtonClicked ? 'fa-check' : 'fa-copy'}`}></i>
            <span>{copyButtonClicked ? 'Copied!' : 'Copy Default Prompt'}</span>
          </button>
        </div>
        
        {inputError && (
          <div className="input-error-message">
            <i className="fas fa-exclamation-circle"></i> Please enter your fitness goal first
          </div>
        )}
       
        {!hidePopularGoals() && (
          <div className="suggestions-container">
           
            <div className="suggestions-title">Popular Goals:</div>
            <div className="suggestion-chips">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`suggestion-chip ${currentPopupGoal === suggestion.text ? 'selected-goal' : ''}`}
                  data-goal={suggestion.text}
                  style={{ animation: `fadeInUp 0.5s ease forwards ${index * 0.1}s` }}
                  onClick={() => handleSuggestionClick(suggestion.text)}
                >
                  <i className={`fas ${suggestion.icon}`}></i>
                  {suggestion.text}
                </div>
              ))}
            </div>
          {currentPopupGoal && goalData[currentPopupGoal] && (
            <div className="goal-details-container" style={{ borderTopColor: goalData[currentPopupGoal].color }}>
              <div className="goal-details-content">
                <i
                  key={`icon-${currentPopupGoal}`}
                  className={`fas ${goalData[currentPopupGoal].icon} goal-details-icon`}
                  style={{ color: goalData[currentPopupGoal].color }}
                  data-goal={currentPopupGoal}
                ></i>
                <h2 className="goal-details-title">{currentPopupGoal}</h2>
                <p className="goal-details-description">{goalData[currentPopupGoal].description}</p>
                <form className="goal-details-form" id="goalForm" onSubmit={handleFormSubmit}>
                  {/* Natural Language Input */}
                  <div className="form-row">
                    <div className="form-group" style={{ width: '100%' }}>
                      <label htmlFor="naturalLanguagePrompt">
                        Describe yourself and your goals naturally
                        <button 
                          type="button" 
                          className="help-button"
                          onClick={() => setShowPromptInput(!showPromptInput)}
                          style={{ marginLeft: '10px' }}
                        >
                          {showPromptInput ? 'Hide' : 'Show'} Natural Input
                        </button>
                      </label>
                      {showPromptInput && (
                        <textarea
                          id="naturalLanguagePrompt"
                          name="naturalLanguagePrompt"
                          value={naturalLanguagePrompt}
                          onChange={(e) => {
                            setNaturalLanguagePrompt(e.target.value);
                            if (e.target.value) {
                              handleNaturalLanguageInput(e.target.value);
                            }
                          }}
                          placeholder="Example: I'm a 25-year-old female, 165cm tall, weighing 65kg. I'm moderately active and want to get stronger. I'm allergic to nuts."
                          rows={4}
                          style={{ width: '100%', marginBottom: '20px' }}
                        />
                      )}
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="age">Age <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        id="age"
                        name="age"
                        min="16"
                        max="100"
                        required
                        value={formData.age}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="gender">Gender <span className="required-asterisk">*</span></label>
                      <select
                        id="gender"
                        name="gender"
                        required
                        value={formData.gender}
                        onChange={handleFormChange}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="height">Height (cm) <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        id="height"
                        name="height"
                        min="120"
                        max="250"
                        required
                        value={formData.height}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="currentWeight">Current Weight (kg) <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        id="currentWeight"
                        name="currentWeight"
                        min="30"
                        max="200"
                        step="0.1"
                        required
                        value={formData.currentWeight}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="targetWeight">Target Weight (kg) <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        id="targetWeight"
                        name="targetWeight"
                        min="30"
                        max="200"
                        step="0.1"
                        required
                        value={formData.targetWeight}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="activityLevel">Activity Level <span className="required-asterisk">*</span></label>
                      <select
                        id="activityLevel"
                        name="activityLevel"
                        required
                        value={formData.activityLevel}
                        onChange={handleFormChange}
                      >
                        <option value="">Select activity level</option>
                        <option value="sedentary">Sedentary (little or no exercise)</option>
                        <option value="light">Lightly active (light exercise 1-3 days/week)</option>
                        <option value="moderate">Moderately active (moderate exercise 3-5 days/week)</option>
                        <option value="very">Very active (hard exercise 6-7 days/week)</option>
                        <option value="extra">Extra active (very hard exercise & physical job)</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="workoutDays">Preferred Workout Days <span className="required-asterisk">*</span></label>
                      <select
                        id="workoutDays"
                        name="workoutDays"
                        required
                        value={formData.workoutDays}
                        onChange={handleFormChange}
                      >
                        <option value="">Select workout days</option>
                        <option value="1">1 day per week</option>
                        <option value="2">2 days per week</option>
                        <option value="3">3 days per week</option>
                        <option value="4">4 days per week</option>
                        <option value="5">5 days per week</option>
                        <option value="6">6 days per week</option>
                        <option value="7">7 days per week</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="timeframe">Target Timeframe (months) <span className="required-asterisk">*</span></label>
                    <input
                      type="range"
                      id="timeframe"
                      name="timeframe"
                      min="1"
                      max="12"
                      required
                      value={formData.timeframe}
                      onChange={handleFormChange}
                    />
                    <div className="range-value" id="timeframeValue">
                      {formData.timeframe} months
                    </div>
                  </div>
                  <div className="goal-details-buttons">
                    <button
                      type="button"
                      className="goal-details-button cancel"
                      onClick={() => setCurrentPopupGoal(null)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="goal-details-button submit">
                      Continue
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </div>
        )}
      </div>
      {isLoading && (
        <div className="loading-animation" id="loadingAnimation">
          <div className="loader-container">
            <i className="fas fa-dumbbell loader-icon"></i>
            <i className="fas fa-running loader-icon"></i>
            <i className="fas fa-heart loader-icon"></i>
            <i className="fas fa-fire loader-icon"></i>
            <i className="fas fa-mountain loader-icon"></i>
          </div>
          <p className="loading-text">
            {loadingStage === 0 && 'Processing your request...'}
            {loadingStage === 1 && 'Calculating TDEE...'}
            {loadingStage === 2 && 'Generating Meal and Workout plan...'}
            {loadingStage === 3 && 'Finalizing your personalized plan...'}
          </p>
        </div>
      )}
      {showPlans && (
        <div className="plans-container" id="plansContainer" ref={plansContainerRef}>
          {plansComplete && (
          <div style={{ width: '100%', textAlign: 'right', marginBottom: 16 }}>
            <PDFDownloadLink
              document={<PlanPDFDocument fitnessGoal={fitnessGoal} mealPlansByDay={mealPlansByDay} workoutSections={workoutSections} endOfPlanSuggestion={endOfPlanSuggestion} />}
              fileName="AI_Fitness_Plan.pdf"
            >
              {({ loading }) => (
                <button className="recommend-button" style={{ marginBottom: 8 }}>
                  {loading ? 'Preparing PDF...' : 'Download PDF'}
                </button>
              )}
            </PDFDownloadLink>
          </div>
          )}
        
          <div className="plans-grid">
            <div className="plan-section meal-section">
              <div className="plan-header">
                <i className="fas fa-utensils plan-icon"></i>
                <h2>Meal Plan</h2>
              </div>
              
              <div className="accordion" id="mealAccordion" ref={mealAccordionRef}>
                {(isStreamingMeal || (mealPlansByDay && mealPlansByDay.length > 0)) ? (
                  // Show meal days in order, streaming or completed
                  <>
                    {console.log('Meal plan display - isStreamingMeal:', isStreamingMeal, 'mealPlansByDay.length:', mealPlansByDay?.length)}
                    {mealPlansByDay
                      .filter(day => day.dayNumber) // Show any day that exists
                      .sort((a, b) => a.dayNumber - b.dayNumber) // Sort by day number
                      .map((dayData) => (
                        <div key={`streaming-meal-day-${dayData.dayNumber}`} className="accordion-item generated">
                          <div
                            className="accordion-header"
                            data-meal={`day${dayData.dayNumber}`}
                            onClick={() => toggleAccordion(`day${dayData.dayNumber}`, 'meal')}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="day-header-content">
                              <i className="fas fa-calendar-day accordion-icon"></i>
                              <span style={{fontSize: '18px', fontWeight: '600' }}>Day {dayData.dayNumber}</span>
                            </div>
                            <div className="day-header-right">
                              <div className="total-calories">
                                <i className="fas fa-fire-alt"></i>
                                {calculateDailyCalories(dayData.meals)} cal/day
                              </div>
                              <i
                                className="fas fa-chevron-right accordion-arrow"
                                style={{
                                  transform: openMealAccordion === `day${dayData.dayNumber}` ? 'rotate(90deg)' : 'rotate(0deg)'
                                }}
                              ></i>
                            </div>
                          </div>
                          <div
                            className="accordion-content"
                            style={{
                              display: openMealAccordion === `day${dayData.dayNumber}` ? 'block' : 'none',
                              animation: openMealAccordion === `day${dayData.dayNumber}` ? 'slideDown 0.3s ease forwards' : 'none',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          >
                            <div className="nested-accordion">
                              {dayData.meals.map((meal) => (
                                <div key={`${dayData.dayNumber}-${meal.type}`} className="nested-accordion-item">
                                  <div 
                                    className="nested-accordion-header"
                                    data-meal-type={meal.type.toLowerCase()}
                                    onClick={() => toggleAccordion(`${dayData.dayNumber}-${meal.type}`, 'meal-sub')}
                                  >
                                    <div className="meal-header-content">
                                      <i className={`fas ${getMealIcon(meal.type)} nested-accordion-icon`}></i>
                                      <span style={{ fontSize: '16px', fontWeight: '500' }}>{meal.type}</span>
                                    </div>
                                    <div className="meal-header-right">
                                      <span className="calories-info">
                                        {meal.calories || calculateMealCalories(meal.items)} cal
                                      </span>
                                      <i
                                        className="fas fa-chevron-right nested-accordion-arrow"
                                        style={{
                                          transform: openMealSubAccordion === `${dayData.dayNumber}-${meal.type}` ? 'rotate(90deg)' : 'rotate(0deg)'
                                        }}
                                      ></i>
                                    </div>
                                  </div>
                                  <div
                                    className="nested-accordion-content"
                                    style={{
                                      display: openMealSubAccordion === `${dayData.dayNumber}-${meal.type}` ? 'block' : 'none',
                                      animation: openMealSubAccordion === `${dayData.dayNumber}-${meal.type}` ? 'slideDown 0.3s ease forwards' : 'none'
                                    }}
                                  >
                                    <ol className="numbered-list" start="1">
                                      {meal.items.map((item, itemIndex) => (
                                        <li className="ai-coach-numbered-item" key={`${dayData.dayNumber}-${meal.type}-item-${itemIndex}`}>
                                          {item.description} {item.calories ? `(${item.calories} kcal)` : ''}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    
                    {/* Show loading effect below the last generated accordion */}
                    {isStreamingMeal && (
                      <div className="generating-status">
                        <div className="generating-indicator">
                          <div className="generating-spinner"></div>
                          <span className="generating-text">Generating Meal Plan...</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Show regular meal accordions when not streaming
                  mealPlansByDay.map((dayPlan, index) => (
                  <div key={`day-${dayPlan.dayNumber}`}>
                    <div className="accordion-item">
                    <div
                      className="accordion-header"
                      data-meal={`day${dayPlan.dayNumber}`}
                      onClick={() => toggleAccordion(`day${dayPlan.dayNumber}`, 'meal')}
                    >
                      <div className="day-header-content">
                        <i className="fas fa-calendar-day accordion-icon"></i>
                        <span style={{fontSize: '18px', fontWeight: '600' }}>Day {dayPlan.dayNumber}</span>
                      </div>
                      <div className="day-header-right">
                        <div className="total-calories">
                          <i className="fas fa-fire-alt"></i>
                          {calculateDailyCalories(dayPlan.meals)} cal/day
                        </div>
                        <i
                          className="fas fa-chevron-right accordion-arrow"
                          style={{
                            transform: openMealAccordion === `day${dayPlan.dayNumber}` ? 'rotate(90deg)' : 'rotate(0deg)'
                          }}
                        ></i>
                      </div>
                    </div>
                    <div
                      className="accordion-content"
                      style={{
                        display: openMealAccordion === `day${dayPlan.dayNumber}` ? 'block' : 'none',
                        animation: openMealAccordion === `day${dayPlan.dayNumber}` ? 'slideDown 0.3s ease forwards' : 'none',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div className="nested-accordion">
                        {dayPlan.meals.map((meal) => (
                          <div key={`${dayPlan.dayNumber}-${meal.type}`} className="nested-accordion-item">
                            <div 
                              className="nested-accordion-header"
                              data-meal-type={meal.type.toLowerCase()}
                              onClick={() => toggleAccordion(`${dayPlan.dayNumber}-${meal.type}`, 'meal-sub')}
                            >
                              <div className="meal-header-content">
                                <i className={`fas ${getMealIcon(meal.type)} nested-accordion-icon`}></i>
                                <span style={{ fontSize: '16px', fontWeight: '500' }}>{meal.type}</span>
                              </div>
                              <div className="meal-header-right">
                                <span className="calories-info">
                                  {meal.calories || calculateMealCalories(meal.items)} cal
                                </span>
                                <i
                                  className="fas fa-chevron-right nested-accordion-arrow"
                                  style={{
                                    transform: openMealSubAccordion === `${dayPlan.dayNumber}-${meal.type}` ? 'rotate(90deg)' : 'rotate(0deg)'
                                  }}
                                ></i>
                              </div>
                            </div>
                            <div
                              className="nested-accordion-content"
                              style={{
                                display: openMealSubAccordion === `${dayPlan.dayNumber}-${meal.type}` ? 'block' : 'none',
                                animation: openMealSubAccordion === `${dayPlan.dayNumber}-${meal.type}` ? 'slideDown 0.3s ease forwards' : 'none'
                              }}
                            >
                              <ol className="numbered-list" start="1">
                                    {meal.items.map((item, itemIndex) => (
                                      <li className="ai-coach-numbered-item" key={`${dayPlan.dayNumber}-${meal.type}-item-${itemIndex}`}>
                                    {item.description} {item.calories ? `(${item.calories} kcal)` : ''}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    </div>
                        </div>
                  ))
                    )}
              </div>
            </div>
                         <div className={`plan-section workout-section ${isStreamingMeal ? 'locked-section' : ''}`}>
               {!isStreamingMeal && !noWorkoutPlan && (
                 <div className="plan-header">
                   <i className="fas fa-dumbbell plan-icon"></i>
                   <h2>Workout Plan</h2>
                 </div>
               )}
               

               <div className="accordion" id="workoutAccordion" ref={workoutAccordionRef}>
                 {isStreamingMeal ? (
                   // Show meal plan generation animation
                   <div className="meal-generation-container">
                     <div className="meal-generation-animation">
                       <div className="meal-generation-icon">
                         <i className="fas fa-utensils"></i>
                       </div>
                       <div className="meal-generation-pulse"></div>
                       <div className="meal-generation-pulse delay-1"></div>
                       <div className="meal-generation-pulse delay-2"></div>
                       <div className="meal-generation-pulse delay-3"></div>
                     </div>
                     <h3 className="meal-generation-title">Crafting Your Perfect Meal Plan</h3>
                     <p className="meal-generation-subtitle">Our AI is analyzing your preferences and creating a personalized nutrition plan...</p>
                     <div className="meal-generation-benefits">
                       <div className="benefit-item">
                         <i className="fas fa-clock"></i>
                         <span>7-day comprehensive plan</span>
                       </div>
                       <div className="benefit-item">
                         <i className="fas fa-calculator"></i>
                         <span>Precise calorie calculations</span>
                       </div>
                       <div className="benefit-item">
                         <i className="fas fa-heart"></i>
                         <span>Balanced nutrition focus</span>
                       </div>
                     </div>
                     <div className="meal-generation-progress">
                       <div className="progress-bar">
                         <div className="progress-fill"></div>
                       </div>
                       <span className="progress-text">Generating meal plan...</span>
                     </div>
                   </div>
                 ) : noWorkoutPlan ? (
                   // Show no workout plan animation
                   <div className="no-workout-container">
                     <div className="no-workout-animation">
                       <div className="no-workout-icon">
                         <i className="fas fa-heart"></i>
                       </div>
                       <div className="no-workout-pulse"></div>
                       <div className="no-workout-pulse delay-1"></div>
                       <div className="no-workout-pulse delay-2"></div>
                     </div>
                     <h3 className="no-workout-title">Focus on Nutrition</h3>
                     <p className="no-workout-subtitle">You documented only meal plan, we recommend you do workout plan also for consistency</p>
                     <div className="no-workout-benefits">
                       <div className="benefit-item">
                         <i className="fas fa-check-circle"></i>
                         <span>Consistent meal timing</span>
                       </div>
                       <div className="benefit-item">
                         <i className="fas fa-check-circle"></i>
                         <span>Proper nutrition balance</span>
                       </div>
                       <div className="benefit-item">
                         <i className="fas fa-check-circle"></i>
                         <span>Healthy lifestyle foundation</span>
                       </div>
                     </div>
                   </div>
                 ) : (isStreamingWorkout || (workoutSections && workoutSections.length > 0)) ? (
                   // Show workout days in order, streaming or completed
                   <>
                     {console.log('Workout plan display - isStreamingWorkout:', isStreamingWorkout, 'workoutSections.length:', workoutSections?.length, 'plansComplete:', plansComplete)}
                     {workoutSections
                       .filter(day => day.dayNumber) // Show any day that exists
                       .sort((a, b) => a.dayNumber - b.dayNumber) // Sort by day number
                       .map((dayData) => (
                         <div key={`streaming-workout-day-${dayData.dayNumber}`} className="accordion-item generated">
                           <div
                             className="accordion-header"
                             data-day={`day${dayData.dayNumber}`}
                             onClick={() => toggleAccordion(`day${dayData.dayNumber}`, 'workout')}
                             style={{ cursor: 'pointer' }}
                           >
                             <div className="day-header-content">
                               <i className={`fas ${getWorkoutIcon(dayData.workoutType)} accordion-icon`}></i>
                               <span style={{ fontSize: '18px', fontWeight: '600' }}>
                                 Day {dayData.dayNumber}: {dayData.workoutType}
                               </span>
                         </div>
                             <div className="day-header-right">
                               <i
                                 className="fas fa-chevron-right accordion-arrow"
                                 style={{
                                   transform: openWorkoutAccordion === `day${dayData.dayNumber}` ? 'rotate(90deg)' : 'rotate(0deg)'
                                 }}
                               ></i>
                         </div>
                       </div>
                           <div
                             className="accordion-content"
                             style={{
                               display: openWorkoutAccordion === `day${dayData.dayNumber}` ? 'block' : 'none',
                               animation: openWorkoutAccordion === `day${dayData.dayNumber}` ? 'slideDown 0.3s ease forwards' : 'none',
                               width: '100%',
                               boxSizing: 'border-box'
                             }}
                           >
                             {dayData.workoutType === 'Rest Day' ? (
                               <p className="rest-day-message">Rest Day - No exercises scheduled</p>
                             ) : (
                               <ol className="numbered-list" start="1">
                                 {dayData.exercises.map((exercise, exerciseIndex) => (
                                   <li className="ai-coach-numbered-item" key={`exercise-${dayData.dayNumber}-${exerciseIndex}`}>
                                     {exercise.description}
                                   </li>
                                 ))}
                               </ol>
                             )}
                           </div>
                         </div>
                       ))}
                     
                     {/* Show loading effect below the last generated accordion */}
                     {isStreamingWorkout && (
                       <div className="generating-status">
                         <div className="generating-indicator">
                           <div className="generating-spinner"></div>
                           <span className="generating-text">Generating Workout Plan...</span>
                     </div>
                   </div>
                     )}
                   </>
                 ) : showWorkoutPlanChoice ? (
                   <div className="locked-container">
                     <div className="locked-card">
                       <div className="locked-icon-container">
                         <div className="locked-icon-background">
                           <i className="fas fa-dumbbell locked-background-icon"></i>
                         </div>
                         <div className="locked-icon-foreground">
                           <i className="fas fa-question-circle lock-icon"></i>
                         </div>
                       </div>
                       <h3 className="locked-title">Workout Plan</h3>
                       <p className="locked-subtitle">Waiting for your decision</p>
                     </div>
                   </div>
                 ) : (
                   // Show regular workout accordions when not streaming
                   workoutSections.map((section, index) => (
                  <div key={`workout-day-${section.dayNumber}`}>
                    <div className="accordion-item">
                    <div
                      className="accordion-header"
                      data-day={`day${section.dayNumber}`}
                      onClick={() => toggleAccordion(`day${section.dayNumber}`, 'workout')}
                    >
                      <div className="day-header-content">
                        <i className={`fas ${getWorkoutIcon(section.workoutType)} accordion-icon`}></i>
                        <span style={{ fontSize: '18px', fontWeight: '600' }}>Day {section.dayNumber}: {section.workoutType}</span>
                        {newlyCreatedDays.has(section.dayNumber) && (
                          <span style={{ 
                            marginLeft: '10px', 
                            fontSize: '12px', 
                            color: '#28a745',
                            fontWeight: '500',
                            backgroundColor: '#d4edda',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            border: '1px solid #c3e6cb'
                          }}>
                            <i className="fas fa-plus-circle" style={{ marginRight: '4px' }}></i>
                            New
                          </span>
                        )}
                        {isStreamingWorkout && section.exercises.length === 0 && !newlyCreatedDays.has(section.dayNumber) && (
                          <span style={{ 
                            marginLeft: '10px', 
                            fontSize: '14px', 
                            color: '#666',
                            fontStyle: 'italic'
                          }}>
                            <i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>
                            Generating exercises...
                          </span>
                        )}
                      </div>
                      <div className="day-header-right">
                        <i
                          className="fas fa-chevron-right accordion-arrow"
                          style={{
                            transform: openWorkoutAccordion === `day${section.dayNumber}` ? 'rotate(90deg)' : 'rotate(0deg)'
                          }}
                        ></i>
                      </div>
                    </div>
                    <div
                      className="accordion-content"
                      style={{
                        display: openWorkoutAccordion === `day${section.dayNumber}` ? 'block' : 'none',
                        animation: openWorkoutAccordion === `day${section.dayNumber}` ? 'slideDown 0.3s ease forwards' : 'none',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      {section.workoutType === 'Rest Day' ? (
                        <p className="rest-day-message">Rest Day - No exercises scheduled</p>
                      ) : (
                        <div>
                          <ol className="numbered-list" start="1">
                            {section.exercises.map((exercise, exerciseIndex) => (
                              <li className="ai-coach-numbered-item" key={`exercise-${section.dayNumber}-${exerciseIndex}`}>
                                {exercise.description}
                              </li>
                            ))}
                          </ol>
                          {isStreamingWorkout && section.exercises.length === 0 && (
                            <div style={{ 
                              textAlign: 'center', 
                              padding: '20px', 
                              color: '#666',
                              fontStyle: 'italic'
                            }}>
                              <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                              Generating exercises for this day...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                ))
                 )}
              </div>
            </div>
          </div>

          {/* Suggestions Section - Only show when we have plans */}
          {((mealPlansByDay && mealPlansByDay.length > 0) || (workoutSections && workoutSections.length > 0 && !noWorkoutPlan)) && (personalizedSuggestions || isLoadingSuggestions) && (
            <div className="suggestions-section">
              <div 
                className="suggestions-header accordion-header"
                onClick={() => setOpenSuggestionsAccordion(!openSuggestionsAccordion)}
                style={{ cursor: 'pointer' }}
              >
                <div className="suggestions-header-left">
                  
                  <h2>Personalized Suggestions</h2>
                </div>
                <i
                  className="fas fa-chevron-right accordion-arrow"
                  style={{
                    transform: openSuggestionsAccordion ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }}
                ></i>
              </div>
              <div 
                className="suggestions-content accordion-content"
                style={{
                  display: openSuggestionsAccordion ? 'block' : 'none',
                  animation: openSuggestionsAccordion ? 'slideDown 0.3s ease forwards' : 'none'
                }}
              >
                {isLoadingSuggestions ? (
                  <div className="suggestions-loading">
                    <div className="loading-spinner"></div>
                    <span className="loading-text">Generating personalized suggestions...</span>
                  </div>
                ) : (
                  <div className="suggestions-text">
                    {personalizedSuggestions.split('\n').map((line, index) => {
                      const trimmedLine = line.trim();
                      
                      // Handle meal plan explanation - only show if meal plan exists
                      if (trimmedLine.startsWith('MEAL PLAN EXPLANATION:') && mealPlansByDay && mealPlansByDay.length > 0) {
                        const explanation = trimmedLine.replace('MEAL PLAN EXPLANATION:', '').trim();
                        return (
                          <div key={index} className="explanation-section meal-explanation">
                            <div className="explanation-header">
                              <i className="fas fa-utensils explanation-icon"></i>
                              <h3>Meal Plan Focus</h3>
                            </div>
                            <p className="explanation-text">{explanation}</p>
                          </div>
                        );
                      }
                      
                      // Handle workout plan explanation - only show if workout plan exists
                      if (trimmedLine.startsWith('WORKOUT PLAN EXPLANATION:') && workoutSections && workoutSections.length > 0 && !noWorkoutPlan) {
                        const explanation = trimmedLine.replace('WORKOUT PLAN EXPLANATION:', '').trim();
                        return (
                          <div key={index} className="explanation-section workout-explanation">
                            <div className="explanation-header">
                              <i className="fas fa-dumbbell explanation-icon"></i>
                              <h3>Workout Plan Focus</h3>
                            </div>
                            <p className="explanation-text">{explanation}</p>
                          </div>
                        );
                      }
                      
                      // Handle recommendation section
                      if (trimmedLine.startsWith('RECOMMENDATION:')) {
                        const explanation = trimmedLine.replace('RECOMMENDATION:', '').trim();
                        return (
                          <div key={index} className="explanation-section recommendation-explanation">
                            <div className="explanation-header">
                              <i className="fas fa-lightbulb explanation-icon"></i>
                              <h3>Recommendation</h3>
                            </div>
                            <p className="explanation-text">{explanation}</p>
                          </div>
                        );
                      }
                      
                      // Handle suggestions
                      if (trimmedLine.includes('•')) {
                        return (
                          <div key={index} className="suggestion-item">
                            <i className="fas fa-star suggestion-bullet"></i>
                            <span className="suggestion-content">{trimmedLine.replace('•', '').trim()}</span>
                          </div>
                        );
                      }
                      
                      // Handle section headers
                      if (trimmedLine === 'PERSONALIZED SUGGESTIONS:') {
                        return (
                          <div key={index} className="suggestions-section-header">
                            <i className="fas fa-lightbulb section-icon"></i>
                            <h3>Personalized Suggestions</h3>
                          </div>
                        );
                      }
                      
                      return null;
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Profile Save Popup */}
      {showProfileSavePopup && (
        <div className="profile-save-popup">
          <div className="popup-content">
            <h3>{useExistingProfile ? 'Update Your Profile?' : "You don't have a profile yet"}</h3>
            <p>{useExistingProfile
              ? 'We detected new or updated information in your prompt. Would you like to update your profile with these details?'
              : "We found these details in your prompt. Do you want to save them as your profile?"}
            </p>
            <ul>
              {extractedProfileData.height && <li>Height: {extractedProfileData.height} cm</li>}
              {extractedProfileData.weight && <li>Weight: {extractedProfileData.weight} kg</li>}
              {extractedProfileData.age && <li>Age: {extractedProfileData.age}</li>}
              {extractedProfileData.gender && <li>Gender: {extractedProfileData.gender}</li>}
              {extractedProfileData.activityLevel && <li>Activity Level: {extractedProfileData.activityLevel}</li>}
              {extractedProfileData.dietaryRestrictions && <li>Dietary Restrictions: {extractedProfileData.dietaryRestrictions}</li>}
              {extractedProfileData.allergies && <li>Allergies: {extractedProfileData.allergies}</li>}
              {extractedProfileData.healthGoals && <li>Health Goals: {extractedProfileData.healthGoals}</li>}
            </ul>
            <div className="popup-buttons">
              <button 
                className="popup-button cancel"
                onClick={() => setShowProfileSavePopup(false)}
              >
                Skip
              </button>
              <button 
                className="popup-button save"
                onClick={handleUpdateProfile}
              >
                {useExistingProfile ? 'Update Profile' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Choice Popup */}
      {showProfileChoicePopup && (
        <div className="profile-choice-popup">
          <div className="popup-content">
            <h3>Use Existing Profile?</h3>
            <p>You have existing profile information. Would you like to use it for this recommendation?</p>
            <div className="popup-buttons">
              <button 
                className="popup-button cancel"
                onClick={() => handleUseProfileChoice(false)}
              >
                No, Use Prompt Only
              </button>
              <button 
                className="popup-button save"
                onClick={() => handleUseProfileChoice(true)}
              >
                Yes, Use My Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Update Popup */}
      {showProfileUpdatePopup && (
        <div className="profile-update-popup" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="popup-content" style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '20px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
            textAlign: 'center'
          }}>
            <h2 style={{ 
              marginBottom: '20px', 
              color: '#333',
              fontSize: '24px',
              fontWeight: '600'
            }}>
              {userProfileData && userProfileData.height && userProfileData.weight ? 'Update Your Profile?' : "You don't have a profile yet"}
            </h2>
            <p style={{ 
              marginBottom: '25px', 
              color: '#666',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              {userProfileData && userProfileData.height && userProfileData.weight 
                ? 'We found these updated details in your prompt. Would you like to update your profile?'
                : 'We found these details in your prompt. Do you want to save them to your profile?'}
            </p>
            
            <div style={{ 
              textAlign: 'left',
              marginBottom: '30px',
              fontSize: '18px',
              color: '#333',
              lineHeight: '1.8'
            }}>
              {'weight' in changedProfileFields && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Weight:</span> <span style={{ fontWeight: '500' }}>{changedProfileFields.weight} kg</span>
                </div>
              )}
              {'height' in changedProfileFields && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Height:</span> <span style={{ fontWeight: '500' }}>{changedProfileFields.height} cm</span>
                </div>
              )}
              {'age' in changedProfileFields && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Age:</span> <span style={{ fontWeight: '500' }}>{changedProfileFields.age} years</span>
                </div>
              )}
              {'gender' in changedProfileFields && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Gender:</span> <span style={{ fontWeight: '500' }}>{changedProfileFields.gender}</span>
                </div>
              )}
              {'activityLevel' in changedProfileFields && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Activity Level:</span> <span style={{ fontWeight: '500' }}>{changedProfileFields.activityLevel}</span>
                </div>
              )}
              {changedProfileFields.dietaryRestrictions && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Dietary Restrictions:</span> <span style={{ fontWeight: '500' }}>{changedProfileFields.dietaryRestrictions}</span>
                </div>
              )}
              {changedProfileFields.allergies && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Allergies:</span> <span style={{ fontWeight: '500' }}>{changedProfileFields.allergies}</span>
                </div>
              )}
              {changedProfileFields.healthGoals && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Health Goals:</span> <span style={{ fontWeight: '500' }}>{changedProfileFields.healthGoals}</span>
                </div>
              )}
            </div>
            
            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'center'
            }}>
              <button 
                onClick={() => setShowProfileUpdatePopup(false)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  backgroundColor: '#e8e8e8',
                  color: '#666',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minWidth: '80px'
                }}
              >
                Skip
              </button>
              <button 
                onClick={handleUpdateProfile}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minWidth: '120px'
                }}
              >
                {userProfileData && userProfileData.height && userProfileData.weight ? 'Update Profile' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Form Popup */}
      {showProfileForm && (
        <div className="profile-form-popup" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="popup-content" style={{
            backgroundColor: 'white',
            padding: '32px',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '85%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            textAlign: 'center',
            position: 'relative'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333', fontSize: '24px', fontWeight: '600' }}>
              Complete Your Profile
            </h2>
            <p style={{ marginBottom: '25px', color: '#666', fontSize: '16px', lineHeight: '1.5' }}>
              Please review and complete your details to get personalized recommendations.
            </p>
            
            <form onSubmit={handleProfileFormSubmit} style={{ textAlign: 'left' }}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profileAge">Age <span className="required-asterisk">*</span></label>
                  <input
                    type="number"
                    id="profileAge"
                    min="16"
                    max="100"
                    required
                    value={profileFormData.age}
                    onChange={(e) => setProfileFormData({...profileFormData, age: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="profileGender">Gender <span className="required-asterisk">*</span></label>
                  <select
                    id="profileGender"
                    required
                    value={profileFormData.gender}
                    onChange={(e) => setProfileFormData({...profileFormData, gender: e.target.value})}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profileHeight">Height (cm) <span className="required-asterisk">*</span></label>
                  <input
                    type="number"
                    id="profileHeight"
                    min="120"
                    max="250"
                    required
                    value={profileFormData.height}
                    onChange={(e) => setProfileFormData({...profileFormData, height: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="profileCurrentWeight">Current Weight (kg) <span className="required-asterisk">*</span></label>
                  <input
                    type="number"
                    id="profileCurrentWeight"
                    min="30"
                    max="200"
                    step="0.1"
                    required
                    value={profileFormData.currentWeight}
                    onChange={(e) => setProfileFormData({...profileFormData, currentWeight: e.target.value})}
                  />
                </div>
              </div>
              
                             <div className="form-row">
                 <div className="form-group">
                   <label htmlFor="profileTargetWeight">Target Weight (kg) <span className="required-asterisk">*</span></label>
                   <input
                     type="number"
                     id="profileTargetWeight"
                     min="30"
                     max="200"
                     step="0.1"
                     required
                     value={profileFormData.targetWeight}
                     onChange={(e) => setProfileFormData({...profileFormData, targetWeight: e.target.value})}
                   />
                 </div>
                 <div className="form-group">
                   <label htmlFor="profileActivityLevel">Activity Level <span className="required-asterisk">*</span></label>
                   <select
                     id="profileActivityLevel"
                     required
                     value={profileFormData.activityLevel}
                     onChange={(e) => setProfileFormData({...profileFormData, activityLevel: e.target.value})}
                   >
                     <option value="">Select activity level</option>
                     <option value="sedentary">Sedentary (little or no exercise)</option>
                     <option value="light">Lightly active (light exercise 1-3 days/week)</option>
                     <option value="moderate">Moderately active (moderate exercise 3-5 days/week)</option>
                     <option value="active">Very active (hard exercise 6-7 days/week)</option>
                     <option value="very active">Extra active (very hard exercise & physical job)</option>
                   </select>
                 </div>
               </div>
               
               <div className="form-row">
                 <div className="form-group">
                   <label htmlFor="profileWorkoutDays">Workout Days Per Week <span className="required-asterisk">*</span></label>
                   <select
                     id="profileWorkoutDays"
                     required
                     value={profileFormData.workoutDays}
                     onChange={(e) => setProfileFormData({...profileFormData, workoutDays: e.target.value})}
                   >
                     <option value="1">1 day per week</option>
                     <option value="2">2 days per week</option>
                     <option value="3">3 days per week</option>
                     <option value="4">4 days per week</option>
                     <option value="5">5 days per week</option>
                     <option value="6">6 days per week</option>
                     <option value="7">7 days per week</option>
                   </select>
                 </div>
                 <div className="form-group">
                   <label htmlFor="profileTimeline">Target Timeline (months) <span className="required-asterisk">*</span></label>
                   <input
                     type="range"
                     id="profileTimeline"
                     min="1"
                     max="12"
                     required
                     value={profileFormData.targetTimeline}
                     onChange={(e) => setProfileFormData({...profileFormData, targetTimeline: e.target.value})}
                   />
                   <div className="range-value">{profileFormData.targetTimeline} months</div>
                 </div>
               </div>
              
              <div className="form-group">
                <label htmlFor="profileGoal">Goal</label>
                <input
                  type="text"
                  id="profileGoal"
                  value={profileFormData.goal}
                  onChange={(e) => setProfileFormData({...profileFormData, goal: e.target.value})}
                  placeholder="Your fitness goal"
                />
              </div>
              
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
                <button 
                  type="button"
                  onClick={() => setShowProfileForm(false)}
                  style={{
                      padding: '10px 24px',
                      borderRadius: '8px',
                    backgroundColor: '#e8e8e8',
                    color: '#666',
                    border: 'none',
                      fontSize: '14px',
                    fontWeight: '500',
                      cursor: 'pointer',
                      minWidth: '80px'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{
                      padding: '10px 24px',
                    border: 'none',
                      borderRadius: '8px',
                    backgroundColor: '#7c3aed',
                    color: 'white',
                      fontSize: '14px',
                    fontWeight: '500',
                      cursor: 'pointer',
                      minWidth: '120px'
                  }}
                >
                  Calculate Calories
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calorie Results Popup */}
      {showCalorieResults && calculatedCalories && (
        <div className="calorie-results-popup" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="popup-content">
            <h2>Your Daily Calorie Target</h2>
            
            <div className="calorie-target-container">
              <div className="calorie-target-value">
                {calculatedCalories.targetCalories}
              </div>
              <div className="calorie-target-label">
                calories per day
              </div>
              <div className="calorie-tdee-info">
                TDEE: {calculatedCalories.tdee} calories
              </div>
              
              {/* Know More Links */}
              <div className="calorie-links-container">
                <button 
                  onClick={() => navigate('/details?type=tdee')}
                  className="calorie-link-button"
                >
                  know more about TDEE
                </button>
                <span className="calorie-link-separator">|</span>
                <button 
                  onClick={() => navigate('/details?type=calories')}
                  className="calorie-link-button"
                >
                  know more about calorie calculation
                </button>
              </div>
            </div>
            
            <p className="calorie-info-text">
              Based on your profile, you need to consume {calculatedCalories.targetCalories} calories per day to achieve your {profileFormData.goal} goal.
            </p>
            
            <div className="calorie-popup-buttons">
              <button 
                onClick={() => handleMealPlanChoice(false)}
                className="calorie-popup-button cancel"
              >
                No, Thanks
              </button>
              <button 
                onClick={() => handleMealPlanChoice(true)}
                className="calorie-popup-button generate"
              >
                Generate Meal Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workout Plan Choice Popup */}
      {showWorkoutPlanChoice && (
        <div className="workout-choice-popup" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="popup-content" style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '20px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
            textAlign: 'center'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333', fontSize: '24px', fontWeight: '600' }}>
              Generate Workout Plan?
            </h2>
            <p style={{ marginBottom: '30px', color: '#666', fontSize: '16px', lineHeight: '1.5' }}>
              Your meal plan is ready! Would you also like to generate a personalized workout plan?
            </p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => handleWorkoutPlanChoice(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#e8e8e8',
                  color: '#666',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minWidth: '90px',
                  lineHeight: '1.2'
                }}
              >
                <div>No,</div>
                <div>Thanks</div>
              </button>
              <button 
                onClick={() => handleWorkoutPlanChoice(true)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minWidth: '110px',
                  lineHeight: '1.2'
                }}
              >
                <div>Yes, Generate</div>
                <div>Workout Plan</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workout Days Confirmation Popup */}
      {showWorkoutDaysConfirmation && (
        <div className="workout-days-popup" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="popup-content" style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '20px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
            textAlign: 'center'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333', fontSize: '24px', fontWeight: '600' }}>
              Confirm Workout Days
            </h2>
            <p style={{ marginBottom: '20px', color: '#666', fontSize: '16px', lineHeight: '1.5' }}>
              We are generating <strong>{selectedWorkoutDays} days</strong> workout plan based on your input.
            </p>
            <p style={{ marginBottom: '30px', color: '#666', fontSize: '14px' }}>
              You can change the number of days if needed:
            </p>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: '500', color: '#333' }}>
                Number of workout days per week:
              </label>
              <select 
                value={selectedWorkoutDays}
                onChange={(e) => setSelectedWorkoutDays(parseInt(e.target.value))}
                style={{
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px',
                  width: '120px',
                  textAlign: 'center',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value={1}>1 day</option>
                <option value={2}>2 days</option>
                <option value={3}>3 days</option>
                <option value={4}>4 days</option>
                <option value={5}>5 days</option>
                <option value={6}>6 days</option>
                <option value={7}>7 days</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => handleWorkoutDaysConfirmation(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#e8e8e8',
                  color: '#666',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minWidth: '90px',
                  lineHeight: '1.2'
                }}
              >
                <div>No,</div>
                <div>Thanks</div>
              </button>
              <button 
                onClick={() => handleWorkoutDaysConfirmation(true)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minWidth: '110px',
                  lineHeight: '1.2'
                }}
              >
                <div>Yes, Generate</div>
                <div>Workout Plan</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showSuccessPopup && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#10b981',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <i className="fas fa-check-circle" style={{ fontSize: '20px' }}></i>
          <span style={{ fontSize: '16px', fontWeight: '500' }}>{successMessage}</span>
        </div>
      )}

      {/* Error Popup */}
      {showErrorPopup && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#dc2626',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <i className="fas fa-exclamation-triangle" style={{ fontSize: '20px' }}></i>
          <span style={{ fontSize: '16px', fontWeight: '500' }}>{errorPopupMessage}</span>
        </div>
      )}

      {/* CSS Styles for Meal Generation Animation */}
      <style>{`
        .meal-generation-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          background: transparent;
          border-radius: 16px;
          margin: 20px 0;
          position: relative;
          overflow: hidden;
        }

        .meal-generation-animation {
          position: relative;
          margin-bottom: 30px;
        }

        .meal-generation-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #10b981, #34d399);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          color: white;
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
          animation: mealBounce 2s ease-in-out infinite;
          z-index: 2;
          position: relative;
        }

        .meal-generation-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          border: 3px solid #10b981;
          border-radius: 50%;
          opacity: 0;
          animation: mealPulse 2s ease-in-out infinite;
        }

        .meal-generation-pulse.delay-1 {
          animation-delay: 0.3s;
        }

        .meal-generation-pulse.delay-2 {
          animation-delay: 0.6s;
        }

        .meal-generation-pulse.delay-3 {
          animation-delay: 0.9s;
        }

        .meal-generation-title {
          font-size: 28px;
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #10b981, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .meal-generation-subtitle {
          font-size: 16px;
          color: #666;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .meal-generation-benefits {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
          width: 100%;
          max-width: 300px;
        }

        .meal-generation-benefits .benefit-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 8px;
          font-size: 14px;
          color: #2c3e50;
        }

        .meal-generation-benefits .benefit-item i {
          color: #10b981;
          font-size: 16px;
        }

        .meal-generation-progress {
          width: 100%;
          max-width: 300px;
        }

        .progress-bar {
          width: 100%;
          height: 6px;
          background: rgba(16, 185, 129, 0.2);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #34d399);
          border-radius: 3px;
          animation: progressFill 3s ease-in-out infinite;
        }

        .progress-text {
          font-size: 14px;
          color: #10b981;
          font-weight: 500;
        }

        @keyframes mealBounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }

        @keyframes mealPulse {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }

        @keyframes progressFill {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
          }
        }
      `}</style>

      {/* CSS Styles for No Workout Animation */}
      <style>{`
        .no-workout-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          background: transparent;
          border-radius: 16px;
          margin: 20px 0;
          position: relative;
          overflow: hidden;
        }

        .no-workout-animation {
          position: relative;
          margin-bottom: 30px;
        }

        .no-workout-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #10b981, #34d399);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          color: white;
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
          animation: heartbeat 2s ease-in-out infinite;
          z-index: 2;
          position: relative;
        }

        .no-workout-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          border: 3px solid #10b981;
          border-radius: 50%;
          opacity: 0;
          animation: pulse 2s ease-in-out infinite;
        }

        .no-workout-pulse.delay-1 {
          animation-delay: 0.5s;
        }

        .no-workout-pulse.delay-2 {
          animation-delay: 1s;
        }

        .no-workout-title {
          font-size: 28px;
          font-weight: 700;
          color: #2c3e50;
          margin: 0 0 15px 0;
          background: linear-gradient(135deg, #10b981, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .no-workout-subtitle {
          font-size: 16px;
          color: #6c757d;
          margin: 0 0 30px 0;
          line-height: 1.6;
          max-width: 400px;
        }

        .no-workout-benefits {
          display: flex;
          flex-direction: column;
          gap: 15px;
          width: 100%;
          max-width: 350px;
        }

        .benefit-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
          animation: slideInUp 0.6s ease-out;
          backdrop-filter: blur(10px);
        }

        .benefit-item:nth-child(1) {
          animation-delay: 0.2s;
        }

        .benefit-item:nth-child(2) {
          animation-delay: 0.4s;
        }

        .benefit-item:nth-child(3) {
          animation-delay: 0.6s;
        }

        .benefit-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.15);
        }

        .benefit-item i {
          color: #28a745;
          font-size: 18px;
        }

        .benefit-item span {
          font-size: 14px;
          font-weight: 500;
          color: #495057;
        }

        @keyframes heartbeat {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default AIFitnessCoach;


