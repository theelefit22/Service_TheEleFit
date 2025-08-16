


import "./AiCoach.css";
import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ref, push, serverTimestamp, get } from 'firebase/database';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { database, db, auth } from '../services/firebase';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { extractMeasurements } from '../utils/promptParser';

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
    experienceLevel: '',
    workoutDays: '',
    timeframe: '3',
    healthConditions: []
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

  const getApiUrl = () => {
    return 'https://yantraprise.com/chat';
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

  // Extract profile data from prompt using regex
  const extractProfileData = (prompt) => {
    const data = {};
    
    // Extract height (supports cm, ft+in)
    const heightMatch = prompt.match(/(\d+)\s*(?:ft|feet|foot|')\s*(\d+)?\s*(?:in|inch|")?|(\d+)\s*cm/i);
    if (heightMatch) {
      if (heightMatch[3]) {
        // CM format
        data.height = parseInt(heightMatch[3]);
      } else {
        // Feet+inches format
        const feet = parseInt(heightMatch[1]) || 0;
        const inches = parseInt(heightMatch[2]) || 0;
        data.height = Math.round((feet * 30.48) + (inches * 2.54));
      }
    }
    
    // Extract weight (supports kg and lbs)
    const weightMatch = prompt.match(/(\d+)\s*(?:kg|kgs|kilograms?)|(\d+)\s*(?:lb|lbs|pounds?)/i);
    if (weightMatch) {
      if (weightMatch[1]) {
        // KG format
        data.weight = parseInt(weightMatch[1]);
      } else if (weightMatch[2]) {
        // LBS format
        data.weight = Math.round(parseInt(weightMatch[2]) * 0.453592);
      }
    }
    
    // Extract age
    const ageMatch = prompt.match(/(\d+)\s*years? old|\bage\s*(\d+)/i);
    if (ageMatch) {
      data.age = parseInt(ageMatch[1] || ageMatch[2]);
    }
    
    // Extract gender
    const genderMatch = prompt.match(/\b(male|female|man|woman|boy|girl)\b/i);
    if (genderMatch) {
      const gender = genderMatch[0].toLowerCase();
      data.gender = gender.includes('male') || gender.includes('man') || gender.includes('boy') ? 'male' :
                    gender.includes('female') || gender.includes('woman') || gender.includes('girl') ? 'female' : '';
    }
    
    return data;
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
      const userDetails = useProfile 
        ? await getExistingProfileDetails() 
        : {
            height: extractedData.height || "",
            weight: extractedData.weight || "",
            age: "",
            gender: extractedData.gender || "",
            activityLevel: "moderate",
            healthGoals: "",
            dietaryRestrictions: [],
            allergies: []
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

      // Show save profile popup if extracted data is present and differs from profile
      let shouldShowPopup = false;
      if (Object.keys(extractedData).length > 0) {
        if (useProfile) {
          // Compare extractedData to existing profile
          const userRef = doc(db, 'users', auth.currentUser.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            for (const key of Object.keys(extractedData)) {
              if (extractedData[key] && extractedData[key] !== userData[key]) {
                shouldShowPopup = true;
                break;
              }
            }
          }
        } else {
          shouldShowPopup = true;
        }
      }
      if (shouldShowPopup) {
        setShowProfileSavePopup(true);
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

      // Check user profile status
      const { hasProfile, profileData } = await checkUserProfile(auth.currentUser.uid);

      if (hasProfile) {
        // User has profile - ask if they want to use it
        setShowProfileChoicePopup(true);
        setIsLoading(false);
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
    setIsLoading(true);

    try {
      await generatePlanWithProfileChoice(useProfile, extractedProfileData);
    } catch (error) {
      console.error('Error:', error);
      setValidationError('Failed to get recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      if (auth.currentUser) {
        // Prepare profile data from form
        const profileData = {
          height: parseInt(formData.height),
          weight: parseInt(formData.currentWeight),
          gender: formData.gender,
          activityLevel: formData.activityLevel,
          updatedAt: serverTimestamp()
        };

        // Save age directly
        if (formData.age) {
          profileData.age = parseInt(formData.age);
        }

        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, profileData, { merge: true });
        
        // Update local user profile data
        setUserProfileData({ ...userProfileData, ...profileData });
        
        alert('Profile updated successfully!');
        setShowProfileUpdatePopup(false);
      } else {
        alert('You must be logged in to update your profile.');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  const handleSaveProfile = async () => {
    // Filter out any undefined or null values
    const cleanedData = Object.entries(extractedProfileData).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[key] = value;
      }
      return acc;
    }, {});

    // Add timestamp
    const profileData = {
      ...cleanedData,
      updatedAt: serverTimestamp()
    };

    try {
      if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userRef, profileData, { merge: true });
        alert('Profile data saved successfully!');
      } else {
        alert('You must be logged in to save your profile.');
      }
    } catch (error) {
      console.error('Error saving profile data:', error);
      alert('Failed to save profile data. Please try again.');
    }
    setShowProfileSavePopup(false);
  };

  const parseResponse = (response) => {
    let cleanedResponse = formatResponse(response);
    
    console.log('Cleaned response for parsing:', cleanedResponse);

    // Extract end-of-plan suggestion
    const suggestionMatch = cleanedResponse.match(/END-OF-PLAN SUGGESTION:([\s\S]*)$/i);
    if (suggestionMatch) {
      setEndOfPlanSuggestion(suggestionMatch[1].trim());
      cleanedResponse = cleanedResponse.replace(/END-OF-PLAN SUGGESTION:[\s\S]*$/, '').trim();
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

    // Handle rest days (Days 5-7) and fill missing meals
    mealPlansByDay.forEach((dayPlan, index) => {
      const isRestDay = index >= 4; // Days 5, 6, 7 are rest days based on backend response
      dayPlan.meals.forEach(meal => {
        if (meal.items.length === 0) {
          if (isRestDay) {
            meal.items = [
              { description: `Balanced ${meal.type.toLowerCase()} - 1 serving`, calories: meal.type === 'Breakfast' ? 300 : meal.type === 'Lunch' ? 400 : meal.type === 'Snack' ? 150 : 450 }
            ];
          } else {
            meal.items = [
              { description: `Balanced ${meal.type.toLowerCase()} - 1 serving`, calories: meal.type === 'Breakfast' ? 300 : meal.type === 'Lunch' ? 400 : meal.type === 'Snack' ? 150 : 450 }
            ];
          }
          meal.calories = meal.calories || meal.items.reduce((sum, item) => sum + item.calories, 0);
        }
      });
    });

    // Process workout plan
    const workoutSections = [];
    for (let i = 1; i <= 7; i++) {
      workoutSections.push({
        dayNumber: i,
        workoutType: i > 4 ? 'Rest Day' : getWorkoutType(i),
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
      experienceLevel: '',
      workoutDays: '',
      timeframe: '3',
      healthConditions: []
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

  const handleNaturalLanguageInput = (prompt) => {
    console.log('Processing natural language input:', prompt);
    const extractedData = extractMeasurements(prompt);
    console.log('Extracted data:', extractedData);

    // Update form data with extracted measurements
    setFormData(prevData => ({
      ...prevData,
      age: extractedData.age || prevData.age,
      gender: extractedData.gender || prevData.gender,
      height: extractedData.height || prevData.height,
      currentWeight: extractedData.weight || prevData.currentWeight,
      activityLevel: extractedData.activityLevel || prevData.activityLevel,
      healthConditions: extractedData.allergies ? 
        [...(prevData.healthConditions || []), extractedData.allergies] : 
        prevData.healthConditions
    }));

    // Set fitness goal based on extracted health goals
    if (extractedData.healthGoals) {
      const goalMapping = {
        'muscle_gain': 'Build Muscle',
        'weight_loss': 'Lose Weight',
        'get_fit': 'Get Fit',
        'get_stronger': 'Get Stronger',
        'get_flexible': 'Stay Flexible',
      };
      const mappedGoal = goalMapping[extractedData.healthGoals];
      if (mappedGoal && suggestions.find(s => s.text === mappedGoal)) {
        handleSuggestionClick(mappedGoal);
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // If we have a natural language prompt, process it first
    if (naturalLanguagePrompt) {
      handleNaturalLanguageInput(naturalLanguagePrompt);
    }
    
    if (!currentPopupGoal) return;
    
    if (!formData.age || !formData.gender || !formData.height || 
        !formData.currentWeight || !formData.targetWeight || 
        !formData.activityLevel || !formData.experienceLevel || 
        !formData.workoutDays) {
      alert('Please fill in all required fields.');
      return;
    }
    
    setCurrentPopupGoal(null);
    setFitnessGoal(currentPopupGoal);
    
    const requestedDays = parseInt(formData.workoutDays) || 5;
    console.log(`Form submission requesting ${requestedDays} days per week`);
    
    const heightInMeters = parseFloat(formData.height) / 100;
    const bmi = parseFloat(formData.currentWeight) / (heightInMeters * heightInMeters);
    const bmiRounded = Math.round(bmi * 10) / 10;
    
    const weightDifference = parseFloat(formData.targetWeight) - parseFloat(formData.currentWeight);
    const weightGoalType = weightDifference < 0 ? "lose" : (weightDifference > 0 ? "gain" : "maintain");
    const absWeightDifference = Math.abs(weightDifference);
    
    let enhancedUserPrompt = `Goal: ${currentPopupGoal} (Please respond in English with both MEAL_PLAN and WORKOUT_PLAN). `;
    enhancedUserPrompt += `I am a ${formData.age} year old ${formData.gender} with a height of ${formData.height}cm and a BMI of ${bmiRounded}. `;
    enhancedUserPrompt += `My current weight is ${formData.currentWeight}kg and I want to ${weightGoalType} ${absWeightDifference}kg to reach ${formData.targetWeight}kg. `;
    enhancedUserPrompt += `I am ${formData.activityLevel} and have ${formData.experienceLevel} experience level. `;
    enhancedUserPrompt += `I prefer to workout ${formData.workoutDays} days per week. Please provide EXACTLY 7 days of meal plan and EXACTLY ${requestedDays} days of workout plan with appropriate rest days. `;
    
    if (formData.timeframe) {
      enhancedUserPrompt += `I want to achieve my goal in ${formData.timeframe} months. `;
    }
    
    if (formData.healthConditions.length > 0 && !formData.healthConditions.includes('none')) {
      enhancedUserPrompt += `I have the following health conditions: ${formData.healthConditions.join(', ')}. `;
      enhancedUserPrompt += `Please provide specific modifications for my meals and workouts that accommodate these health conditions. `;
    }
    
    console.log('Setting loading state to true for form submission');
    setIsLoading(true);
    setShowPlans(false);
  
    try {
      console.clear();
      
      const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: enhancedUserPrompt,
          forceNew: false
        })
      });

      if (!response.ok) {
        console.error('Server response not OK:', response.status, response.statusText);
        throw new Error(`Failed to fetch data from server: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Raw response from server:', data);
      
      if (!data.reply) {
        console.error('No reply in response data:', data);
        throw new Error('Server response missing reply field');
      }
      
      const cleanedResponse = formatResponse(data.reply);
      
      console.log('=== Fitness Plan Generated ===');
      console.log('Goal:', currentPopupGoal);
      console.log('Form Data:', formData);
      console.log('Requested Days:', requestedDays);
      console.log('\nChatGPT Response:');
      console.log(cleanedResponse);
      console.log('==================');

      if (!cleanedResponse.includes('MEAL_PLAN:') || !cleanedResponse.includes('WORKOUT_PLAN:')) {
        console.error('Response missing required sections:', cleanedResponse);
        const forcedResponse = `MEAL_PLAN:\nBreakfast: ${data.reply.includes('Breakfast') ? data.reply.split('Breakfast')[1].split('\n')[0] : 'Healthy breakfast options'}\n\nLunch: ${data.reply.includes('Lunch') ? data.reply.split('Lunch')[1].split('\n')[0] : 'Nutritious lunch options'}\n\nDinner: ${data.reply.includes('Dinner') ? data.reply.split('Dinner')[1].split('\n')[0] : 'Balanced dinner options'}\n\nWORKOUT_PLAN:\nDay 1: ${data.reply.includes('Day 1') ? data.reply.split('Day 1')[1].split('\n')[0] : 'Full body workout'}\n`;
        parseResponse(forcedResponse);
      } else {
        parseResponse(cleanedResponse);
      }
      
      setLastProcessedGoal(currentPopupGoal);
      setIsLoading(false);
      setShowPlans(true);

      // Check if user profile is incomplete and show popup AFTER plans are shown
      const isProfileIncomplete = !userProfileData || 
        !userProfileData.height || 
        !userProfileData.weight || 
        !userProfileData.age || 
        !userProfileData.gender || 
        !userProfileData.activityLevel;
      
      if (isProfileIncomplete) {
        // Delay showing the popup slightly to ensure plans are rendered first
        setTimeout(() => {
          setShowProfileUpdatePopup(true);
        }, 500);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setIsLoading(false);
      alert(`Failed to fetch recommendations: ${error.message}. Please try again.`);
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

  const animateLoadingIcons = () => {
    const icons = document.querySelectorAll('.loader-icon');
    gsap.set(icons, { opacity: 1, y: 0, scale: 1, rotation: 0 });
    
    const masterTimeline = gsap.timeline({ repeat: -1 });
    
    icons.forEach((icon, index) => {
      const duration = 2;
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
            className={`goal-input ${inputError ? 'input-error' : ''}`}
            placeholder="Enter your fitness goal..."
            value={fitnessGoal}
            onChange={(e) => {
              setFitnessGoal(e.target.value);
              setShowPlans(false);
              setValidationError('');
              e.target.style.height = '42px';
              const scrollHeight = e.target.scrollHeight;
              e.target.style.height = `${Math.max(scrollHeight, 42)}px`;
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleRecommendation();
              }
            }}
            rows="1"
          />
          <button
            className="recommend-button"
            onClick={(e) => {
              e.preventDefault();
              handleRecommendation();
            }}
          >
            Get Recommendations
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
          <div className="disclaimer-container">
            <div className="disclaimer-content">
              <i className="fas fa-info-circle disclaimer-icon"></i>
              <p className="disclaimer-text">Enter your personal details like height, weight, age to get more accurate results!</p>
            </div>
            <div className="disclaimer-animation-dot"></div>
          </div>
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
                      <label htmlFor="experienceLevel">Experience Level <span className="required-asterisk">*</span></label>
                      <select
                        id="experienceLevel"
                        name="experienceLevel"
                        required
                        value={formData.experienceLevel}
                        onChange={handleFormChange}
                      >
                        <option value="">Select experience level</option>
                        <option value="beginner">Beginner (0-1 year)</option>
                        <option value="intermediate">Intermediate (1-3 years)</option>
                        <option value="advanced">Advanced (3+ years)</option>
                      </select>
                    </div>
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
                        <option value="3">3 days per week</option>
                        <option value="4">4 days per week</option>
                        <option value="5">5 days per week</option>
                        <option value="6">6 days per week</option>
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
                  <div className="form-group">
                    <label htmlFor="healthConditions">Health Conditions (Optional)</label>
                    <select
                      id="healthConditions"
                      name="healthConditions"
                      multiple
                      value={formData.healthConditions}
                      onChange={handleFormChange}
                    >
                      <option value="none">None</option>
                      <option value="backPain">Back Pain</option>
                      <option value="jointIssues">Joint Issues</option>
                      <option value="heartCondition">Heart Condition</option>
                      <option value="diabetes">Diabetes</option>
                      <option value="asthma">Asthma</option>
                      <option value="hypertension">Hypertension</option>
                    </select>
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
                {mealPlansByDay.map((dayPlan) => (
                  <div key={`day-${dayPlan.dayNumber}`} className="accordion-item">
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
                ))}
              </div>
            </div>
            <div className="plan-section workout-section">
              <div className="plan-header">
                <i className="fas fa-dumbbell plan-icon"></i>
                <h2>Workout Plan</h2>
              </div>
              <div className="accordion" id="workoutAccordion" ref={workoutAccordionRef}>
                {workoutSections.map((section) => (
                  <div key={`workout-day-${section.dayNumber}`} className="accordion-item">
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
                ))}
              </div>
            </div>
          </div>
          <div className="disclaimer-container" style={{backgroundColor:'red' }}>
            <div className="disclaimer-content">
              <i className="fas fa-info-circle disclaimer-icon"></i>
              <p className="disclaimer-text"> {endOfPlanSuggestion}</p>
            </div>
            <div className="disclaimer-animation-dot"></div>
          </div>
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
                onClick={handleSaveProfile}
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
              You don't have a profile yet
            </h2>
            <p style={{ 
              marginBottom: '25px', 
              color: '#666',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              We found these details in your prompt. Do you want to save them as your profile?
            </p>
            
            <div style={{ 
              textAlign: 'left',
              marginBottom: '30px',
              fontSize: '18px',
              color: '#333',
              lineHeight: '1.8'
            }}>
              {formData.currentWeight && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Weight:</span> <span style={{ fontWeight: '500' }}>{formData.currentWeight} kg</span>
                </div>
              )}
              {formData.height && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Height:</span> <span style={{ fontWeight: '500' }}>{formData.height} cm</span>
                </div>
              )}
              {formData.age && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Age:</span> <span style={{ fontWeight: '500' }}>{formData.age} years</span>
                </div>
              )}
              {formData.gender && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Gender:</span> <span style={{ fontWeight: '500' }}>{formData.gender}</span>
                </div>
              )}
              {formData.activityLevel && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#666' }}>Activity Level:</span> <span style={{ fontWeight: '500' }}>{formData.activityLevel}</span>
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
                  padding: '12px 40px',
                  borderRadius: '10px',
                  backgroundColor: '#e8e8e8',
                  color: '#666',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#d8d8d8'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#e8e8e8'}
              >
                Skip
              </button>
              <button 
                onClick={handleUpdateProfile}
                style={{
                  padding: '12px 40px',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#6d28d9'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#7c3aed'}
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIFitnessCoach;