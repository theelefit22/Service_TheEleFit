import "./AiCoach.css";
import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ref, push, serverTimestamp, get } from 'firebase/database';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { database, db, auth } from '../services/firebase';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { parsePrompt } from '../utils/promptParser';

const AIFitnessCoach = () => {
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
  
  // New states for the enhanced flow
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [calculatedCalories, setCalculatedCalories] = useState(null);
  const [showCalorieResults, setShowCalorieResults] = useState(false);
  const [showMealPlanChoice, setShowMealPlanChoice] = useState(false);
  const [showWorkoutPlanChoice, setShowWorkoutPlanChoice] = useState(false);
  const [streamingMealPlan, setStreamingMealPlan] = useState('');
  const [streamingWorkoutPlan, setStreamingWorkoutPlan] = useState('');
    const [isStreamingMeal, setIsStreamingMeal] = useState(false);
  const [isStreamingWorkout, setIsStreamingWorkout] = useState(false);
  const [personalizedSuggestions, setPersonalizedSuggestions] = useState('');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [openSuggestionsAccordion, setOpenSuggestionsAccordion] = useState(false);
  const [copyButtonClicked, setCopyButtonClicked] = useState(false);
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

  // Utility functions
  const cleanText = (text) => {
    return text
      .replace(/[^\w\s.,()-:]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getApiUrl = (endpoint = 'chat') => {
    return `http://localhost:5002/${endpoint}`;
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
        'weight_loss': 'lose_weight',
        'muscle_gain': 'build_muscle',
        'toning': 'get_fit',
        'maintenance': 'maintain_weight',
        'strength': 'get_stronger',
        'endurance': 'get_fit',
        'fitness': 'get_fit',
        'recomposition': 'get_fit'
      };
      data.healthGoals = goalMapping[parsedData.goal] || 'get_fit';
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

    // Create helpful error message
    let errorMessage = `To provide personalized recommendations, I need some additional information:\n\n`;
    errorMessage += `Missing: ${missingFields.join(', ')}\n\n`;
    errorMessage += `Please add these details to your request:\n`;
    suggestions.forEach((suggestion, index) => {
      errorMessage += `${index + 1}. ${suggestion}\n`;
    });
    errorMessage += `\nExample: "I am a 25-year-old male, 5'8\" tall, weighing 70 kg, moderately active, and I want to gain weight."`;

    return { isValid: false, message: errorMessage, missingFields, suggestions };
  };

  // Check if user has profile data in Firebase
  const checkUserProfile = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          hasProfile: !!userData.height && !!userData.weight && !!userData.age,
          profileData: userData
        };
      }
      return { hasProfile: false, profileData: null };
    } catch (error) {
      console.error('Error checking user profile:', error);
      return { hasProfile: false, profileData: null };
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

    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
        setValidationError('Please log in to get personalized recommendations.');
        setIsLoading(false);
        return;
      }

      // Extract profile data from prompt
      const extractedData = extractProfileData(fitnessGoal);
      setExtractedProfileData(extractedData);

      // Check user profile status first, regardless of extracted data
      const { hasProfile, profileData } = await checkUserProfile(auth.currentUser.uid);

      if (hasProfile) {
        // User has profile - ask if they want to use it
        setShowProfileChoicePopup(true);
        setIsLoading(false);
        return;
      }

      // Validate extracted data and show specific error messages for missing fields
      const validation = validateProfileData(extractedData, fitnessGoal);
      if (!validation.isValid) {
        setValidationError(validation.message);
        setIsLoading(false);
        return;
      }

      // Check if this is natural language input with enough profile data
      if (extractedData.age && extractedData.gender && extractedData.height && extractedData.weight && extractedData.activityLevel) {
        // Process as natural language input (only when no existing profile)
        await handleNaturalLanguageInput(fitnessGoal);
        return;
      }

      // No profile exists - proceed with prompt and extracted data
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
      
      // Parse the prompt to extract user details
      const extractedData = parsePrompt(fitnessGoal);
      console.log('Extracted data from prompt:', extractedData);
      
      // Check if we have enough data to calculate calories
      if (extractedData.age && extractedData.gender && extractedData.height && extractedData.weight && extractedData.activityLevel) {
        // Calculate calories immediately
        setIsLoading(true);
        try {
          const response = await fetch(getApiUrl('user'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              age: parseInt(extractedData.age),
              weight: parseFloat(extractedData.weight),
              height: parseFloat(extractedData.height),
              gender: extractedData.gender,
              activityLevel: extractedData.activityLevel,
              targetWeight: parseFloat(extractedData.targetWeight?.value || extractedData.weight),
              timelineWeeks: parseInt(extractedData.timeline?.value || 12),
              goal: extractedData.goal || 'Get Fit'
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
        // Not enough data, show error with specific missing fields
        const missingFields = [];
        if (!extractedData.age) missingFields.push('age');
        if (!extractedData.gender) missingFields.push('gender');
        if (!extractedData.height) missingFields.push('height');
        if (!extractedData.weight) missingFields.push('weight');
        if (!extractedData.activityLevel) missingFields.push('activity level');
        
        setSuccessMessage(`Please provide the following missing information in your prompt: ${missingFields.join(', ')}. Example: "I am a 25-year-old male, my height is 175 cm, weight is 80 kg. My activity level is moderately active."`);
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 8000);
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
        !profileFormData.activityLevel) {
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
          age: parseInt(profileFormData.age),
          weight: parseFloat(profileFormData.currentWeight),
          height: parseFloat(profileFormData.height),
          gender: profileFormData.gender,
          activityLevel: profileFormData.activityLevel,
          targetWeight: parseFloat(profileFormData.targetWeight),
          timelineWeeks: parseInt(profileFormData.targetTimeline) * 4, // Convert months to weeks
          goal: profileFormData.goal
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
    
    if (!generateMealPlan) {
      setSuccessMessage('Thank you for using AI Coach!');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);
      return;
    }

    // Generate meal plan with streaming and live accordion updates
    setIsStreamingMeal(true);
    setStreamingMealPlan('');
    setShowPlans(true); // Show the plans section immediately
    setMealPlansByDay([]); // Clear previous data
    setWorkoutSections([]);
    
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
          parseResponseLive(liveResponse, 'meal');
        } catch (parseError) {
          // Continue streaming even if parsing fails temporarily
          console.log('Temporary parse error (continuing):', parseError.message);
        }
      }

      // Final parse for complete meal plan
      const finalResponse = `MEAL_PLAN:${accumulatedText}`;
      parseResponse(finalResponse);
      setIsStreamingMeal(false);
      setShowWorkoutPlanChoice(true);
      
    } catch (error) {
      console.error('Error generating meal plan:', error);
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
    }
  };

  // Handle workout plan generation choice
     const handleWorkoutPlanChoice = async (generateWorkoutPlan) => {
     setShowWorkoutPlanChoice(false);
     
     if (!generateWorkoutPlan) {
       // Generate suggestions even when user selects No to workout plan
       const fallbackSuggestions = generateFallbackSuggestions();
       setPersonalizedSuggestions(fallbackSuggestions);
       setOpenSuggestionsAccordion(true);
       
       setSuccessMessage('Thank you for using AI Coach!');
       setShowSuccessPopup(true);
       setTimeout(() => setShowSuccessPopup(false), 3000);
       return; // Keep showing meal plan only
     }

     // Generate workout plan with streaming
     setIsStreamingWorkout(true);
     setStreamingWorkoutPlan('');
     
     try {
       // For natural language input (no profile selected), send the complete original prompt
       // For profile-based input, use the structured data
       let workoutPrompt;
       let workoutDays = null; // Let backend auto-detect if not specified
       
       console.log('=== CONDITION CHECK ===');
       console.log('useExistingProfile:', useExistingProfile);
       console.log('showProfileForm:', showProfileForm);
       console.log('profileFormData.workoutDays:', profileFormData.workoutDays);
       console.log('profileFormData.goal:', profileFormData.goal);
       console.log('Boolean check for workoutDays:', !!profileFormData.workoutDays);
       console.log('Condition result:', useExistingProfile || showProfileForm || !!profileFormData.workoutDays);
       console.log('fitnessGoal (original prompt):', fitnessGoal);
       
       if (useExistingProfile || showProfileForm || !!profileFormData.workoutDays) {
         // User has profile, is using form, or has form data - use structured approach
         console.log('Using structured approach');
         workoutDays = parseInt(profileFormData.workoutDays || extractedProfileData?.workoutDays) || 5;
         workoutPrompt = `Generate workout plan for ${extractedProfileData?.goal || profileFormData.goal || 'fitness'} goal, I prefer to workout ${workoutDays} days per week`;
       } else {
         console.log('Using natural language approach - sending original prompt directly to AI');
         // Natural language input - send the complete original prompt directly to AI
         workoutPrompt = fitnessGoal; // Use the original user prompt
         workoutDays = null; // Let AI determine workout days from the prompt
       }
       
       console.log('=== WORKOUT PLAN DEBUG ===');
       console.log('extractedProfileData:', extractedProfileData);
       console.log('profileFormData:', profileFormData);
       console.log('useExistingProfile:', useExistingProfile);
       console.log('showProfileForm:', showProfileForm);
       console.log('profileFormData.workoutDays:', profileFormData.workoutDays);
       console.log('Final workout days being sent:', workoutDays);
       
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
        
        // Parse and update workout plans in real-time
        try {
          const liveResponse = `WORKOUT_PLAN:${accumulatedText}`;
          parseResponseLive(liveResponse, 'workout');
        } catch (parseError) {
          console.log('Temporary workout parse error (continuing):', parseError.message);
        }
      }

      // Parse the complete workout plan
      const fullResponse = `MEAL_PLAN:${streamingMealPlan}\n\nWORKOUT_PLAN:${accumulatedText}`;
      parseResponse(fullResponse);
      
      setIsStreamingWorkout(false);
      
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
      setIsStreamingWorkout(false);
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
    }
  };

  const generateSuggestions = async (workoutPlanText = '') => {
    try {
      setIsLoadingSuggestions(true);
      setPersonalizedSuggestions('');
      
      // Create summaries of the plans
      const mealPlanSummary = mealPlansByDay.map(day => 
        `Day ${day.dayNumber}: ${day.meals.map(meal => `${meal.type} (${meal.calories || calculateMealCalories(meal.items)} cal)`).join(', ')}`
      ).join('\n');
      
      const workoutPlanSummary = workoutPlanText ? 
        workoutPlanText.substring(0, 500) + '...' : 
        workoutSections.map(section => 
          `Day ${section.dayNumber}: ${section.workoutType}`
        ).join('\n');
      
      console.log('DEBUG: Generating suggestions with data:', {
        prompt: fitnessGoal,
        mealPlanSummary,
        workoutPlanSummary
      });
      
      console.log('DEBUG: Making suggestions API call to:', 'http://127.0.0.1:5002/suggestions');
      console.log('DEBUG: Request data:', {
        prompt: fitnessGoal,
        mealPlanSummary,
        workoutPlanSummary
      });
      
      const response = await fetch('http://127.0.0.1:5002/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: fitnessGoal,
          mealPlanSummary,
          workoutPlanSummary
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setPersonalizedSuggestions(data.suggestions);
        console.log('DEBUG: Suggestions generated:', data.suggestions);
        // Auto-expand suggestions when they're loaded
        setOpenSuggestionsAccordion(true);
      } else {
        console.error('Error in suggestions response:', data.error);
      }
      
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
    const suggestions = [
      '• Follow this meal plan for 7 days and you will achieve your goal',
      '• Follow this workout plan for 7 days and you will achieve your goal',
      '• Stay consistent with your meal plan by preparing meals in advance',
      '• Track your water intake - aim for at least 2.5L daily',
      '• Get 7-9 hours of quality sleep each night for optimal recovery',
      '• Take progress photos weekly to track your transformation'
    ];
    
    return `MEAL PLAN EXPLANATION: Your meal plan is designed to support your fitness goals with balanced nutrition and proper calorie distribution throughout the day.

WORKOUT PLAN EXPLANATION: Your workout plan focuses on progressive training that will help you build strength, improve endurance, and achieve your desired results.

PERSONALIZED SUGGESTIONS:
${suggestions.join('\n')}`;
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


  // Live parsing function for streaming updates
  const parseResponseLive = (response, type = 'meal') => {
    if (type === 'meal') {
      const mealPlanMatch = response.match(/MEAL_PLAN:([\s\S]*?)(?=WORKOUT_PLAN:|$)/i);
      if (!mealPlanMatch) return;
      
      const mealPlanRaw = mealPlanMatch[1].trim();
      const mealPlansByDay = [];
      
      // Don't initialize all days - only create days as they are generated
      
      // Parse available days
      const mealPlanLines = mealPlanRaw.split('\n').map(line => line.trim()).filter(Boolean);
      let currentDay = null;
      let currentMealType = null;
      
      mealPlanLines.forEach(line => {
        const dayMatch = line.match(/Day\s*(\d+):/i);
        if (dayMatch) {
          currentDay = parseInt(dayMatch[1]);
          
          // Create day if it doesn't exist
          if (!mealPlansByDay.find(day => day.dayNumber === currentDay)) {
            mealPlansByDay.push({
              dayNumber: currentDay,
              meals: [
                { type: 'Breakfast', calories: 0, items: [] },
                { type: 'Lunch', calories: 0, items: [] },
                { type: 'Snack', calories: 0, items: [] },
                { type: 'Dinner', calories: 0, items: [] }
              ]
            });
          }
          return;
        }
        
        const mealTypeMatch = line.match(/(Breakfast|Lunch|Snack|Dinner)\s*(?:\((\d+)\s*(?:kcal|calories?)?\)|(?:\s*-\s*)?(\d+)\s*(?:kcal|calories?))?(?:\s*:|$)/i);
        if (mealTypeMatch && currentDay && currentDay <= 7) {
          currentMealType = mealTypeMatch[1];
          const calories = parseInt(mealTypeMatch[2] || mealTypeMatch[3]) || 0;
          
          const dayData = mealPlansByDay.find(day => day.dayNumber === currentDay);
          if (dayData) {
            const mealIndex = dayData.meals.findIndex(m => m.type === currentMealType);
            if (mealIndex !== -1) {
              dayData.meals[mealIndex].calories = calories;
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
          
          const dayData = mealPlansByDay.find(day => day.dayNumber === currentDay);
          if (dayData) {
            const mealIndex = dayData.meals.findIndex(m => m.type === currentMealType);
            if (mealIndex !== -1) {
              dayData.meals[mealIndex].items.push({
                description: description,
                calories: itemCalories
              });
            }
          }
        }
      });
      
      // Update state with live data
      setMealPlansByDay(mealPlansByDay);
         } else if (type === 'workout') {
       const workoutPlanMatch = response.match(/WORKOUT_PLAN:([\s\S]*?)(?=END-OF-PLAN SUGGESTION:|$)/i);
       if (!workoutPlanMatch) return;
       
       const workoutPlanRaw = workoutPlanMatch[1].trim();
       const workoutSections = [];
       
       // Don't initialize all days - only create days as they are generated
      
      // Parse available days
      const workoutPlanLines = workoutPlanRaw.split('\n').map(line => line.trim()).filter(Boolean);
      let currentWorkoutDay = null;
      let currentWorkoutType = null;
      
      workoutPlanLines.forEach(line => {
        let dayMatch = line.match(/Day\s*(\d+)(?:\s*-\s*|\s*:\s*)([^:]+)(?::|$)/i);
        if (!dayMatch) {
          dayMatch = line.match(/Day\s*(\d+)\s*[-:]?\s*(.*)/i);
        }
        
        if (dayMatch) {
          currentWorkoutDay = parseInt(dayMatch[1]);
          currentWorkoutType = dayMatch[2] ? dayMatch[2].trim() : 'Training Day';
          
          if (currentWorkoutType.includes(':')) {
            currentWorkoutType = currentWorkoutType.replace(/:/g, '').trim();
          }
          
          // Create day if it doesn't exist
          if (currentWorkoutDay > 0 && currentWorkoutDay <= 7) {
            if (!workoutSections.find(day => day.dayNumber === currentWorkoutDay)) {
              workoutSections.push({
                dayNumber: currentWorkoutDay,
                workoutType: currentWorkoutType,
                exercises: []
              });
            } else {
              // Update existing day
              const dayData = workoutSections.find(day => day.dayNumber === currentWorkoutDay);
              if (dayData) {
                dayData.workoutType = currentWorkoutType;
              }
            }
          }
          return;
        }
        
        // Parse exercises
        if (currentWorkoutDay && currentWorkoutDay <= 7 && (/^(\d+\s*[.)]|[\-•●])/.test(line))) {
          const exercise = line.replace(/^(\d+\s*[.)]|[\-•●])\s*/, '').trim();
          const dayData = workoutSections.find(day => day.dayNumber === currentWorkoutDay);
          if (dayData) {
            dayData.exercises.push({
              number: dayData.exercises.length + 1,
              description: exercise
            });
          }
        }
      });
      
      // Update state with live workout data
      setWorkoutSections(workoutSections);
    }
  };

  const parseResponse = (response) => {
    let cleanedResponse = formatResponse(response);
    
    console.log('Cleaned response for parsing:', cleanedResponse);

    // Extract end-of-plan suggestion first, but don't remove it yet
    const suggestionMatch = cleanedResponse.match(/END-OF-PLAN SUGGESTION:([\s\S]*)$/i);
    if (suggestionMatch) {
      setEndOfPlanSuggestion(suggestionMatch[1].trim());
    } else {
      setEndOfPlanSuggestion('Follow this plan consistently to achieve your desired results.');
    }

    const mealPlanMatch = cleanedResponse.match(/MEAL_PLAN:([\s\S]*?)(?=WORKOUT_PLAN:|$)/i);
    let workoutPlanMatch = cleanedResponse.match(/WORKOUT_PLAN:([\s\S]*?)(?=END-OF-PLAN SUGGESTION:|$)/i);
    if (!workoutPlanMatch) {
      console.log('Trying alternate workout plan pattern');
      workoutPlanMatch = cleanedResponse.match(/(?:WORKOUT|EXERCISE)[\s_]*PLAN:?([\s\S]*?)(?=END-OF-PLAN SUGGESTION:|$)/i);
    }
    
    if (!workoutPlanMatch && cleanedResponse.includes('###')) {
      console.log('Trying to find workout section using markdown headers');
      const sections = cleanedResponse.split(/###\s+/);
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].toLowerCase().includes('workout') || 
            sections[i].toLowerCase().includes('exercise')) {
          workoutPlanMatch = {1: sections[i]};
          break;
        }
      }
    }
    
    const defaultMealPlan = [];
    for (let i = 1; i <= 7; i++) {
      defaultMealPlan.push({
        dayNumber: i,
        meals: [
          { type: 'Breakfast', calories: 0, items: [{ description: 'Oatmeal with berries - 1/2 cup', calories: 150 }, { description: 'Greek yogurt - 150g', calories: 120 }, { description: 'Almonds - 10 pieces', calories: 70 }] },
          { type: 'Lunch', calories: 0, items: [{ description: 'Grilled chicken salad - 200g', calories: 200 }, { description: 'Whole grain bread - 1 slice', calories: 80 }, { description: 'Olive oil dressing - 1 tbsp', calories: 120 }] },
          { type: 'Snack', calories: 0, items: [{ description: 'Apple - 1 medium', calories: 95 }, { description: 'Peanut butter - 1 tbsp', calories: 90 }, { description: 'Celery sticks - 2 pieces', calories: 15 }] },
          { type: 'Dinner', calories: 0, items: [{ description: 'Baked salmon - 150g', calories: 200 }, { description: 'Steamed broccoli - 1 cup', calories: 55 }, { description: 'Brown rice - 1/2 cup', calories: 110 }] }
        ]
      });
    }
    
    const defaultWorkout = [];
    for (let i = 1; i <= 7; i++) {
      defaultWorkout.push({
        dayNumber: i,
        workoutType: 'Rest Day',
        exercises: []
      });
    }
    
    if (!mealPlanMatch) {
      console.error('Response missing required meal plan section');
      setMealPlansByDay(defaultMealPlan);
      setWorkoutSections(defaultWorkout);
      return;
    }

    const mealPlanRaw = mealPlanMatch[1].trim();
    const workoutPlanRaw = workoutPlanMatch ? workoutPlanMatch[1].trim() : '';
    
    console.log('Extracted meal plan:', mealPlanRaw);
    console.log('Extracted workout plan:', workoutPlanRaw);
    
    let extractedWorkoutContent = workoutPlanRaw;
    
    if (!workoutPlanRaw) {
      console.warn('No workout plan section found - attempting to extract workout info from full response');
      const fullResponseLines = cleanedResponse.split('\n');
      const workoutLines = [];
      let foundWorkoutSection = false;
      
      for (let i = 0; i < fullResponseLines.length; i++) {
        const line = fullResponseLines[i];
        if (!foundWorkoutSection) {
          if (line.match(/work\s*out|exercise|training/i) && 
              !line.match(/meal|breakfast|lunch|dinner|snack/i)) {
            foundWorkoutSection = true;
            workoutLines.push(line);
          }
        } else {
          if (!line.match(/meal|breakfast|lunch|dinner|snack/i) ||
              line.match(/day\s*\d+|exercise|workout|training/i)) {
            workoutLines.push(line);
          }
        }
      }
      
      if (workoutLines.length > 0) {
        console.log('Found potential workout content:', workoutLines.join('\n'));
        extractedWorkoutContent = workoutLines.join('\n');
        if (!extractedWorkoutContent.match(/day\s*\d+|exercise|workout|training/i)) {
          console.log('Extracted content doesn\'t look like workout content, using default');
          extractedWorkoutContent = '';
        }
      }
    }

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

    // Process workout plan
    const workoutSections = [];
    for (let i = 1; i <= 7; i++) {
      workoutSections.push({
        dayNumber: i,
        workoutType: 'Training Day', // Default, will be overridden by backend response
        exercises: []
      });
    }

    let currentWorkoutDay = null;
    let currentWorkoutType = null;
    let currentExercises = [];

    if (extractedWorkoutContent) {
      const workoutPlanLines = extractedWorkoutContent.split('\n').map(line => line.trim()).filter(Boolean);
      let isProcessingWorkout = false;

      workoutPlanLines.forEach((line, index) => {
        console.log(`Processing workout line ${index}: ${line}`);
        
        let dayMatch = line.match(/Day\s*(\d+)(?:\s*-\s*|\s*:\s*)([^:]+)(?::|$)/i);
        if (!dayMatch) {
          dayMatch = line.match(/Day\s*(\d+)\s*[-:]?\s*(.*)/i);
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
          
          if (currentWorkoutType.includes(':')) {
            currentWorkoutType = currentWorkoutType.replace(/:/g, '').trim();
          }
          
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

        if (isProcessingWorkout && (/^(\d+\s*[.)]|[\-•●])/.test(line) || /^\d+\s*[.)]/.test(line))) {
          const exercise = line.replace(/^(\d+\s*[.)]|[\-•●])\s*/, '').trim();
          if (currentWorkoutDay && currentWorkoutDay <= 7) {
            const section = workoutSections.find(s => s.dayNumber === currentWorkoutDay);
            if (section) {
              console.log(`Adding exercise to day ${currentWorkoutDay}: ${exercise}`);
              section.exercises.push({
                number: section.exercises.length + 1,
                description: exercise
              });
            } else {
              console.warn(`Cannot add exercise - day ${currentWorkoutDay} not found in sections`);
            }
          } else {
            console.warn(`Cannot add exercise - no current workout day set`);
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
      if (section.workoutType.toLowerCase().includes('rest')) {
        section.exercises = [];
        section.workoutType = 'Rest Day';
      } else if (section.exercises.length === 0) {
        section.workoutType = 'Rest Day';
      } else {
        section.exercises.forEach((exercise, idx) => {
          exercise.number = idx + 1;
        });
      }
    });

    console.log('Processed meal plans:', mealPlansByDay);
    console.log('Processed workouts:', workoutSections);

    setMealPlansByDay(mealPlansByDay);
    setWorkoutSections(workoutSections);
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
      activityLevel: extractedData.activityLevel
    });
    
    // Clear profileFormData to ensure natural language approach is used
    setProfileFormData({
      age: '',
      gender: '',
      height: '',
      currentWeight: '',
      targetWeight: '',
      activityLevel: '',
      targetTimeline: '3',
      workoutDays: '',
      goal: ''
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
            age: parseInt(extractedData.age),
            weight: parseFloat(extractedData.weight),
            height: parseFloat(extractedData.height),
            gender: extractedData.gender,
            activityLevel: extractedData.activityLevel,
            targetWeight: parseFloat(extractedData.targetWeight?.value || extractedData.weight),
            timelineWeeks: parseInt(extractedData.timeline?.value || 12),
            goal: extractedData.goal || 'Get Fit'
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
      // Not enough data, show error with specific missing fields
      const missingFields = [];
      if (!extractedData.age) missingFields.push('age');
      if (!extractedData.gender) missingFields.push('gender');
      if (!extractedData.height) missingFields.push('height');
      if (!extractedData.weight) missingFields.push('weight');
      if (!extractedData.activityLevel) missingFields.push('activity level');
      
      setSuccessMessage(`Please provide the following missing information in your prompt: ${missingFields.join(', ')}. Example: "I am a 25-year-old male, my height is 175 cm, weight is 80 kg. My activity level is moderately active."`);
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 8000);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // If we have a natural language prompt, process it first
    if (naturalLanguagePrompt) {
      handleNaturalLanguageInput(naturalLanguagePrompt);
    }
    
    if (!currentPopupGoal) return;
    
    // Check if user has profile data first
    if (auth.currentUser) {
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
        // Continue with form validation if profile check fails
      }
    }
    
    if (!formData.age || !formData.gender || !formData.height || 
        !formData.currentWeight || !formData.targetWeight || 
        !formData.activityLevel || !formData.workoutDays) {
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
      if (!isInShopifyContext() && process.env.NODE_ENV === 'development') {
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

      const actuallyLoggedIn = isActuallyLoggedIn();
      setIsCustomerLoggedIn(actuallyLoggedIn);
      setInputLocked(!actuallyLoggedIn);

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
    const interval = setInterval(checkShopifyCustomer, 2000);
    return () => clearInterval(interval);
  }, []);

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
        {validationError && (
          <div className="validation-error-message" style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '8px',
            marginTop: '10px',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
            {validationError}
          </div>
        )}
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
                    <label htmlFor="timeframe">Target Timeframe (months) <span className="optional-label">(Optional)</span></label>
                    <input
                      type="range"
                      id="timeframe"
                      name="timeframe"
                      min="1"
                      max="12"
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
        
          <div className="plans-grid">
            <div className="plan-section meal-section">
              <div className="plan-header">
                <i className="fas fa-utensils plan-icon"></i>
                <h2>Meal Plan</h2>
              </div>
              
              <div className="accordion" id="mealAccordion" ref={mealAccordionRef}>
                {mealPlansByDay.map((dayPlan, index) => (
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
                                {meal.items.map((item, index) => (
                                  <li className="ai-coach-numbered-item" key={`${dayPlan.dayNumber}-${meal.type}-item-${index}`}>
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
                    
                    {/* Show generating status after the last completed accordion */}
                    {isStreamingMeal && index === mealPlansByDay.length - 1 && (
                      <div className="generating-status">
                        <div className="generating-indicator">
                          <div className="generating-spinner"></div>
                          <span className="generating-text">Generating Meal Plan...</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
                         <div className={`plan-section workout-section ${isStreamingMeal ? 'locked-section' : ''}`}>
               <div className="plan-header">
                 <i className="fas fa-dumbbell plan-icon"></i>
                 <h2>Workout Plan</h2>
               </div>
               

               <div className="accordion" id="workoutAccordion" ref={workoutAccordionRef}>
                 {isStreamingMeal ? (
                   <div className="locked-container">
                     <div className="locked-card">
                       <div className="locked-icon-container">
                         <div className="locked-icon-background">
                           <i className="fas fa-dumbbell locked-background-icon"></i>
                         </div>
                         <div className="locked-icon-foreground">
                           <i className="fas fa-lock lock-icon"></i>
                         </div>
                       </div>
                       
                     </div>
                   </div>
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
                        <ol className="numbered-list" start="1">
                          {section.exercises.map((exercise, index) => (
                            <li className="ai-coach-numbered-item" key={`exercise-${section.dayNumber}-${index}`}>
                              {exercise.description}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    </div>
                    
                    {/* Show generating status after the last completed accordion */}
                    {isStreamingWorkout && index === workoutSections.length - 1 && (
                      <div className="generating-status">
                        <div className="generating-indicator">
                          <div className="generating-spinner"></div>
                          <span className="generating-text">Generating Workout Plan...</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
                 )}
              </div>
            </div>
          </div>

          {/* Suggestions Section */}
          {(personalizedSuggestions || isLoadingSuggestions) && (
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
                      
                      // Handle meal plan explanation
                      if (trimmedLine.startsWith('MEAL PLAN EXPLANATION:')) {
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
                      
                      // Handle workout plan explanation
                      if (trimmedLine.startsWith('WORKOUT PLAN EXPLANATION:')) {
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
                   <label htmlFor="profileTimeline">Target Timeline (months)</label>
                   <input
                     type="range"
                     id="profileTimeline"
                     min="1"
                     max="12"
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
              Your Daily Calorie Target
            </h2>
            
            <div style={{ 
              marginBottom: '30px', 
              padding: '25px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '15px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ 
                fontSize: '56px', 
                fontWeight: 'bold', 
                color: '#7c3aed', 
                marginBottom: '8px',
                lineHeight: '1'
              }}>
                {calculatedCalories.targetCalories}
              </div>
              <div style={{ 
                fontSize: '20px', 
                color: '#666',
                marginBottom: '8px',
                fontWeight: '500'
              }}>
                calories per day
              </div>
              <div style={{ 
                fontSize: '16px', 
                color: '#888',
                fontWeight: '400'
              }}>
                TDEE: {calculatedCalories.tdee} calories
              </div>
            </div>
            
            <p style={{ marginBottom: '30px', color: '#666', fontSize: '16px', lineHeight: '1.5' }}>
              Based on your profile, you need to consume {calculatedCalories.targetCalories} calories per day to achieve your {profileFormData.goal} goal.
            </p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => handleMealPlanChoice(false)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  backgroundColor: '#e8e8e8',
                  color: '#666',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minWidth: '100px'
                }}
              >
                No, Thanks
              </button>
              <button 
                onClick={() => handleMealPlanChoice(true)}
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
    </div>
  );
};

export default AIFitnessCoach;