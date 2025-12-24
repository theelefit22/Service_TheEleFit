import "./AiCoach.css";
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import { gsap } from 'gsap'; // No longer needed - using video instead of animated icons
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import { ref, push, serverTimestamp, get } from 'firebase/database';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { database, db, auth } from '../services/firebase';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import { parsePrompt } from '../utils/promptParser';
import { cleanWorkoutContent, isRecommendationContent } from '../utils/test-parser';
import { useAuth } from '../hooks/useAuth';
import { saveAiCoachData, fetchAiCoachHistory } from '../services/aicoachService';
import { historySecure } from '../utils/Secure';
import CalorieResultsPopup from '../components/CalorieResultsPopup';


// Missing Profile Fields Form Component
const MissingProfileFieldsForm = ({ missingFields, currentProfileData, onSave, onGenerate, onCancel }) => {
  const [weightError, setWeightError] = useState('');
  const [ageError, setAgeError] = useState('');
  const [heightError, setHeightError] = useState('');
  const [currentWeightError, setCurrentWeightError] = useState('');
  const [targetWeightError, setTargetWeightError] = useState('');

  const [formData, setFormData] = useState({
    age: currentProfileData?.age || '',
    height: currentProfileData?.height || '',
    heightUnit: currentProfileData?.heightUnit || 'cm',
    weight: currentProfileData?.weight || '',
    weightUnit: currentProfileData?.weightUnit || 'kg',
    gender: currentProfileData?.gender || '',
    activityLevel: currentProfileData?.activityLevel || '',
    workoutDays: currentProfileData?.workoutDays || '5', // Pre-fill from profile
    targetWeight: currentProfileData?.targetWeight || '', // Pre-fill from profile
    targetWeightUnit: currentProfileData?.targetWeightUnit || 'kg',
    targetTimeline: currentProfileData?.targetTimeline || '3', // Pre-fill from profile
    targetTimelineUnit: 'months'
  });

  // Refs for focusing on required fields
  const ageRef = useRef(null);
  const genderRef = useRef(null);
  const activityLevelRef = useRef(null);
  const workoutDaysRef = useRef(null);

  // Update form data when currentProfileData changes
  useEffect(() => {
    const newFormData = {
      age: currentProfileData?.age || '',
      height: currentProfileData?.height || '',
      heightUnit: currentProfileData?.heightUnit || 'cm',
      weight: currentProfileData?.weight || '',
      weightUnit: currentProfileData?.weightUnit || 'kg',
      gender: currentProfileData?.gender || '',
      activityLevel: currentProfileData?.activityLevel || '',
      workoutDays: currentProfileData?.workoutDays || '5', // Pre-fill from profile
      targetWeight: currentProfileData?.targetWeight || '', // Pre-fill from profile
      targetWeightUnit: currentProfileData?.targetWeightUnit || 'kg',
      targetTimeline: currentProfileData?.targetTimeline || '3', // Pre-fill from profile
      targetTimelineUnit: 'months'
    };
    setFormData(newFormData);
  }, [currentProfileData]);

  // Function to focus on the first missing required field
  const focusOnFirstMissingField = () => {
    // Check required fields in order: age, gender, activityLevel
    if (!formData.age) {
      ageRef.current?.focus();
      // Add temporary red border to highlight the missing field
      if (ageRef.current) {
        ageRef.current.style.border = '2px solid #ef4444';
        ageRef.current.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.3)';
        setTimeout(() => {
          if (ageRef.current) {
            ageRef.current.style.border = '1px solid #d1d5db';
            ageRef.current.style.boxShadow = 'none';
          }
        }, 2000);
      }
      return;
    }

    if (!formData.gender) {
      genderRef.current?.focus();
      // Add temporary red border to highlight the missing field
      if (genderRef.current) {
        genderRef.current.style.border = '2px solid #ef4444';
        genderRef.current.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.3)';
        setTimeout(() => {
          if (genderRef.current) {
            genderRef.current.style.border = '1px solid #d1d5db';
            genderRef.current.style.boxShadow = 'none';
          }
        }, 2000);
      }
      return;
    }

    if (!formData.activityLevel) {
      activityLevelRef.current?.focus();
      // Add temporary red border to highlight the missing field
      if (activityLevelRef.current) {
        activityLevelRef.current.style.border = '2px solid #ef4444';
        activityLevelRef.current.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.3)';
        setTimeout(() => {
          if (activityLevelRef.current) {
            activityLevelRef.current.style.border = '1px solid #d1d5db';
            activityLevelRef.current.style.boxShadow = 'none';
          }
        }, 2000);
      }
      return;
    }
  };

  // Call focus function when component mounts
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      focusOnFirstMissingField();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newFormData = {
        ...prev,
        [field]: value
      };

      // Check age validation when age changes
      if (field === 'age') {
        validateAge(value);
      }

      // Check height validation when height or height unit changes
      if (field === 'height' || field === 'heightUnit') {
        const height = field === 'height' ? value : newFormData.height;
        const unit = field === 'heightUnit' ? value : newFormData.heightUnit;
        validateHeight(height, unit);
      }

      // Check current weight validation when weight or weight unit changes
      if (field === 'weight' || field === 'weightUnit') {
        const weight = field === 'weight' ? value : newFormData.weight;
        const unit = field === 'weightUnit' ? value : newFormData.weightUnit;
        validateCurrentWeight(weight, unit);
      }

      // Check target weight validation when target weight or target weight unit changes
      if (field === 'targetWeight' || field === 'targetWeightUnit') {
        const targetWeight = field === 'targetWeight' ? value : newFormData.targetWeight;
        const unit = field === 'targetWeightUnit' ? value : newFormData.targetWeightUnit;
        validateTargetWeight(targetWeight, unit);
      }

      // Check weight comparison validation when weight, target weight, or their units change
      if (field === 'weight' || field === 'targetWeight' || field === 'weightUnit' || field === 'targetWeightUnit') {
        const currentWeight = field === 'weight' ? value : newFormData.weight;
        const targetWeight = field === 'targetWeight' ? value : newFormData.targetWeight;
        const currentUnit = field === 'weightUnit' ? value : newFormData.weightUnit;
        const targetUnit = field === 'targetWeightUnit' ? value : newFormData.targetWeightUnit;

        validateWeights(currentWeight, targetWeight, currentUnit, targetUnit);
      }

      return newFormData;
    });
  };

  const validateWeights = (currentWeight, targetWeight, currentUnit, targetUnit) => {
    const current = parseFloat(currentWeight);
    const target = parseFloat(targetWeight);

    // Check if units are different
    if (currentUnit && targetUnit && currentUnit !== targetUnit) {
      setWeightError('Current weight and target weight should use the same units');
      return;
    }

    // Check if weights are equal
    if (!isNaN(current) && !isNaN(target) && current === target) {
      setWeightError('Current weight and target weight should not be the same');
    } else {
      setWeightError('');
    }
  };

  const validateAge = (age) => {
    const ageNum = parseFloat(age);

    if (!age || age === '') {
      setAgeError('Age is required');
      return;
    }

    if (isNaN(ageNum)) {
      setAgeError('Please enter a valid age');
      return;
    }

    if (ageNum < 13) {
      setAgeError('Age must be at least 13 years');
      return;
    }

    if (ageNum > 120) {
      setAgeError('Age must be less than 120 years');
      return;
    }

    setAgeError('');
  };

  const validateHeight = (height, unit) => {
    const heightNum = parseFloat(height);

    if (!height || height === '') {
      setHeightError('Height is required');
      return;
    }

    if (isNaN(heightNum)) {
      setHeightError('Please enter a valid height');
      return;
    }

    if (unit === 'cm') {
      if (heightNum < 90) {
        setHeightError('Height must be at least 90 cm');
        return;
      }
      if (heightNum > 250) {
        setHeightError('Height must be less than 250 cm');
        return;
      }
    } else if (unit === 'ft') {
      if (heightNum < 3) {
        setHeightError('Height must be at least 3 ft');
        return;
      }
      if (heightNum > 8) {
        setHeightError('Height must be less than 8 ft');
        return;
      }
    }

    setHeightError('');
  };

  const validateCurrentWeight = (weight, unit) => {
    const weightNum = parseFloat(weight);

    if (!weight || weight === '') {
      setCurrentWeightError('Current weight is required');
      return;
    }

    if (isNaN(weightNum)) {
      setCurrentWeightError('Please enter a valid weight');
      return;
    }

    if (weightNum <= 0) {
      setCurrentWeightError('Weight must be greater than 0');
      return;
    }

    if (unit === 'kg') {
      if (weightNum < 30) {
        setCurrentWeightError('Weight must be at least 30 kg');
        return;
      }
      if (weightNum > 650) {
        setCurrentWeightError('Weight must be less than 650 kg');
        return;
      }
    } else if (unit === 'lbs') {
      if (weightNum < 66) {
        setCurrentWeightError('Weight must be at least 66 lbs');
        return;
      }
      if (weightNum > 1433) {
        setCurrentWeightError('Weight must be less than 1433 lbs');
        return;
      }
    }

    setCurrentWeightError('');
  };

  const validateTargetWeight = (weight, unit) => {
    const weightNum = parseFloat(weight);

    if (!weight || weight === '') {
      setTargetWeightError('Target weight is required');
      return;
    }

    if (isNaN(weightNum)) {
      setTargetWeightError('Please enter a valid weight');
      return;
    }

    if (weightNum <= 0) {
      setTargetWeightError('Weight must be greater than 0');
      return;
    }

    if (unit === 'kg') {
      if (weightNum < 30) {
        setTargetWeightError('Weight must be at least 30 kg');
        return;
      }
      if (weightNum > 650) {
        setTargetWeightError('Weight must be less than 650 kg');
        return;
      }
    } else if (unit === 'lbs') {
      if (weightNum < 66) {
        setTargetWeightError('Weight must be at least 66 lbs');
        return;
      }
      if (weightNum > 1433) {
        setTargetWeightError('Weight must be less than 1433 lbs');
        return;
      }
    }

    setTargetWeightError('');
  };


  const getFieldLabel = (field) => {
    const labels = {
      age: 'Age',
      height: 'Height',
      weight: 'Weight',
      gender: 'Gender',
      activityLevel: 'Activity Level',
      workoutDays: 'Workout Days per Week',
      targetWeight: 'Target Weight',
      targetTimeline: 'Target Timeline'
    };
    return labels[field] || field;
  };

  const isFieldRequired = (field) => {
    // Always require all fields for the default prompt
    const alwaysRequired = ['age', 'height', 'weight', 'gender', 'activityLevel', 'targetWeight', 'targetTimeline', 'workoutDays'];
    return alwaysRequired.includes(field);
  };

  return (
    <div style={{ textAlign: 'left' }}>
      <div className="form-row" style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Age Field */}
        <div className="form-group" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Age
            {isFieldRequired('age') && <span style={{ color: '#ef4444', fontWeight: '600' }}> *</span>}
          </label>
          <input
            ref={ageRef}
            type="number"
            value={formData.age || ''}
            onChange={(e) => {
              handleInputChange('age', e.target.value);
            }}
            onBlur={(e) => {
              validateAge(e.target.value);
            }}
            placeholder="Enter age"
            style={{
              width: '100%',
              padding: '12px 16px',
              border: ageError ? '1px solid #ef4444' : '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              color: '#374151',
              background: '#ffffff',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
            required={isFieldRequired('age')}
            min="13"
            max="120"
          />
          {ageError && (
            <div style={{
              color: '#ef4444',
              fontSize: '12px',
              marginTop: '4px',
              fontWeight: '500'
            }}>
              {ageError}
            </div>
          )}
        </div>

        {/* Height Field with Unit Selection */}
        <div className="form-group" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Height
            {isFieldRequired('height') && <span style={{ color: '#ef4444', fontWeight: '600' }}> *</span>}
          </label>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <input
              type="number"
              value={formData.height || ''}
              onChange={(e) => {
                handleInputChange('height', e.target.value);
              }}
              onBlur={(e) => {
                validateHeight(e.target.value, formData.heightUnit);
              }}
              placeholder="Enter height"
              style={{
                flex: '1 1 65%',
                padding: '12px 16px',
                border: heightError ? '1px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                color: '#374151',
                background: '#ffffff',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                width: '65%'
              }}
              required={isFieldRequired('height')}
              min={formData.heightUnit === 'ft' ? '3' : '90'}
              max={formData.heightUnit === 'ft' ? '8' : '250'}
              step={formData.heightUnit === 'ft' ? '0.1' : '1'}
            />
            <select
              value={formData.heightUnit || 'cm'}
              onChange={(e) => {
                console.log('Height unit changed:', e.target.value);
                handleInputChange('heightUnit', e.target.value);
              }}
              style={{
                flex: '0 0 35%',
                padding: '12px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                color: '#374151',
                background: '#ffffff',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                width: '35%',
                fontWeight: '500',
                textAlign: 'left',
                minWidth: '60px'
              }}
            >
              <option value="cm">cm</option>
              <option value="ft">ft</option>
            </select>
          </div>
          {heightError && (
            <div style={{
              color: '#ef4444',
              fontSize: '12px',
              marginTop: '4px',
              fontWeight: '500'
            }}>
              {heightError}
            </div>
          )}
        </div>

        {/* Weight Field with Unit Selection */}
        <div className="form-group" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Weight
            {isFieldRequired('weight') && <span style={{ color: '#ef4444', fontWeight: '600' }}> *</span>}
          </label>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <input
              type="number"
              value={formData.weight || ''}
              onChange={(e) => {
                handleInputChange('weight', e.target.value);
              }}
              onBlur={(e) => {
                validateCurrentWeight(e.target.value, formData.weightUnit);
              }}
              placeholder="Enter weight"
              style={{
                flex: '1 1 70%',
                padding: '12px 16px',
                border: currentWeightError ? '1px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                color: '#374151',
                background: '#ffffff',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                width: '70%'
              }}
              required={isFieldRequired('weight')}
              min="30"
              max="650"
            />
            <select
              value={formData.weightUnit || 'kg'}
              onChange={(e) => {
                console.log('Weight unit changed:', e.target.value);
                handleInputChange('weightUnit', e.target.value);
              }}
              style={{
                flex: '0 0 35%',
                padding: '12px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                color: '#374151',
                background: '#ffffff',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                width: '35%',
                fontWeight: '500',
                textAlign: 'left',
                minWidth: '60px'
              }}
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
          </div>
          {currentWeightError && (
            <div style={{
              color: '#ef4444',
              fontSize: '12px',
              marginTop: '4px',
              fontWeight: '500'
            }}>
              {currentWeightError}
            </div>
          )}
        </div>

        {/* Gender Field */}
        <div className="form-group" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Gender
            {isFieldRequired('gender') && <span style={{ color: '#ef4444', fontWeight: '600' }}> *</span>}
          </label>
          <select
            ref={genderRef}
            value={formData.gender || ''}
            onChange={(e) => handleInputChange('gender', e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              color: '#374151',
              background: '#ffffff',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
            required={isFieldRequired('gender')}
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="form-row" style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Activity Level Field */}
        <div className="form-group" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Activity Level
            {isFieldRequired('activityLevel') && <span style={{ color: '#ef4444', fontWeight: '600' }}> *</span>}
          </label>
          <select
            ref={activityLevelRef}
            value={formData.activityLevel || ''}
            onChange={(e) => handleInputChange('activityLevel', e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              color: '#374151',
              background: '#ffffff',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
            required={isFieldRequired('activityLevel')}
          >
            <option value="">Select Activity Level</option>
            <option value="sedentary">Sedentary</option>
            <option value="light">Lightly Active</option>
            <option value="moderate">Moderately Active</option>
            <option value="active">Very Active</option>
            <option value="very-active">Extra Active</option>
          </select>
        </div>

        {/* Workout Days Field */}
        <div className="form-group" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Workout Days per Week
            {isFieldRequired('workoutDays') && <span style={{ color: '#ef4444', fontWeight: '600' }}> *</span>}
          </label>
          <select
            ref={workoutDaysRef}
            value={formData.workoutDays || '5'}
            onChange={(e) => handleInputChange('workoutDays', e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              color: '#374151',
              background: '#ffffff',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
            required={isFieldRequired('workoutDays')}
          >
            <option value="">Select Days</option>
            <option value="1">1 day</option>
            <option value="2">2 days</option>
            <option value="3">3 days</option>
            <option value="4">4 days</option>
            <option value="5">5 days</option>
            <option value="6">6 days</option>
            <option value="7">7 days</option>
          </select>
        </div>
      </div>

      <div className="form-row" style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Target Weight Field with Unit Selection */}
        <div className="form-group" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Target Weight
            {isFieldRequired('targetWeight') && <span style={{ color: '#ef4444', fontWeight: '600' }}> *</span>}
          </label>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <input
              type="number"
              value={formData.targetWeight || ''}
              onChange={(e) => {
                handleInputChange('targetWeight', e.target.value);
              }}
              onBlur={(e) => {
                validateTargetWeight(e.target.value, formData.targetWeightUnit);
              }}
              placeholder="Enter target weight"
              style={{
                flex: '1 1 65%',
                padding: '12px 16px',
                border: targetWeightError ? '1px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                color: '#374151',
                background: '#ffffff',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                width: '65%'
              }}
              required={isFieldRequired('targetWeight')}
              min="30"
              max="650"
            />
            <select
              value={formData.targetWeightUnit || 'kg'}
              onChange={(e) => {
                console.log('Target weight unit changed:', e.target.value);
                handleInputChange('targetWeightUnit', e.target.value);
              }}
              style={{
                flex: '0 0 35%',
                padding: '12px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                color: '#374151',
                background: '#ffffff',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                width: '35%',
                fontWeight: '500',
                textAlign: 'left',
                minWidth: '60px'
              }}
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
          </div>
          {targetWeightError && (
            <div style={{
              color: '#ef4444',
              fontSize: '12px',
              marginTop: '4px',
              fontWeight: '500'
            }}>
              {targetWeightError}
            </div>
          )}
          {weightError && (
            <div style={{
              color: '#ef4444',
              fontSize: '14px',
              marginTop: '8px',
              fontWeight: '500'
            }}>
              {weightError}
            </div>
          )}
        </div>

        {/* Target Timeline Field with Unit Selection */}
        <div className="form-group" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            Target Timeline (months)
            {isFieldRequired('targetTimeline') && <span style={{ color: '#ef4444', fontWeight: '600' }}> *</span>}
          </label>
          <input
            type="range"
            value={formData.targetTimeline || '3'}
            onChange={(e) => {
              handleInputChange('targetTimeline', e.target.value);
            }}
            style={{
              width: '100%',
              padding: '8px 0',
              background: 'transparent',
              outline: 'none',
              marginBottom: '8px'
            }}
            required={isFieldRequired('targetTimeline')}
            min="1"
            max="12"
            step="1"
          />
          <div style={{
            fontSize: '14px',
            color: '#6b7280',
            fontWeight: '500',
            textAlign: 'center',
            padding: '4px 8px',
            background: '#f3f4f6',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            marginTop: '8px'
          }}>
            {formData.targetTimeline || '3'} months
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '15px',
        justifyContent: 'center',
        marginTop: '30px'
      }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '12px 24px',
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
          type="button"
          onClick={() => onSave(formData)}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: '#4E3580',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            minWidth: '100px'
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            // Validate required fields before generating
            if (!formData.age) {
              ageRef.current?.focus();
              // Add visual feedback for missing field
              if (ageRef.current) {
                ageRef.current.style.border = '2px solid #ef4444';
                ageRef.current.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.3)';
                setTimeout(() => {
                  if (ageRef.current) {
                    ageRef.current.style.border = ageError ? '1px solid #ef4444' : '1px solid #d1d5db';
                    ageRef.current.style.boxShadow = 'none';
                  }
                }, 2000);
              }
              setAgeError('Age is required');
              return;
            }
            if (!formData.gender) {
              genderRef.current?.focus();
              // Add visual feedback for missing field
              if (genderRef.current) {
                genderRef.current.style.border = '2px solid #ef4444';
                genderRef.current.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.3)';
                setTimeout(() => {
                  if (genderRef.current) {
                    genderRef.current.style.border = '1px solid #d1d5db';
                    genderRef.current.style.boxShadow = 'none';
                  }
                }, 2000);
              }
              return;
            }
            if (!formData.activityLevel) {
              activityLevelRef.current?.focus();
              // Add visual feedback for missing field
              if (activityLevelRef.current) {
                activityLevelRef.current.style.border = '2px solid #ef4444';
                activityLevelRef.current.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.3)';
                setTimeout(() => {
                  if (activityLevelRef.current) {
                    activityLevelRef.current.style.border = '1px solid #d1d5db';
                    activityLevelRef.current.style.boxShadow = 'none';
                  }
                }, 2000);
              }
              return;
            }
            onGenerate(formData);
          }}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: '#CDD954',
            color: 'black',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            minWidth: '120px'
          }}
        >
          Generate
        </button>
      </div>
    </div>
  );
};


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
  const [workoutPlanSuggestion, setWorkoutPlanSuggestion] = useState('');
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

  // AI Coach conversation history state
  const [conversationHistory, setConversationHistory] = useState([]);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showConversationDetail, setShowConversationDetail] = useState(false);
  const [combinedConversationData, setCombinedConversationData] = useState({
    prompt: '',
    mealPlanResponse: '',
    workoutPlanResponse: '',
    isMealPlanComplete: false,
    isWorkoutPlanComplete: false
  });
  const [userProfileData, setUserProfileData] = useState(null);
  const [changedProfileFields, setChangedProfileFields] = useState({});
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorPopupMessage, setErrorPopupMessage] = useState('');
  const [showMissingProfileFieldsPopup, setShowMissingProfileFieldsPopup] = useState(false);
  const [missingProfileFieldsData, setMissingProfileFieldsData] = useState({});

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
  const [originalMealPlanResponse, setOriginalMealPlanResponse] = useState(''); // Store original response
  const [streamingWorkoutPlan, setStreamingWorkoutPlan] = useState('');
  const [isStreamingMeal, setIsStreamingMeal] = useState(false);
  const [currentMealDay, setCurrentMealDay] = useState(0); // Track current day being generated
  const [isStreamingWorkout, setIsStreamingWorkout] = useState(false);
  const [incompleteExerciseBuffer, setIncompleteExerciseBuffer] = useState('');
  const [exerciseBuffer, setExerciseBuffer] = useState({});
  const [lastParsedLength, setLastParsedLength] = useState(0);
  const [newlyCreatedDays, setNewlyCreatedDays] = useState(new Set());
  const [personalizedSuggestions, setPersonalizedSuggestions] = useState('');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [openSuggestionsAccordion, setOpenSuggestionsAccordion] = useState(false);
  const [userHasToggledAccordion, setUserHasToggledAccordion] = useState(false);
  const [copyButtonClicked, setCopyButtonClicked] = useState(false);
  const [plansComplete, setPlansComplete] = useState(false);
  const [showWorkoutDaysConfirmation, setShowWorkoutDaysConfirmation] = useState(false);
  const [selectedWorkoutDays, setSelectedWorkoutDays] = useState(7);
  const [profileFormData, setProfileFormData] = useState({
    age: '',
    gender: '',
    height: '',
    heightUnit: 'cm',
    currentWeight: '',
    currentWeightUnit: 'kg',
    targetWeight: '',
    targetWeightUnit: 'kg',
    activityLevel: '',
    targetTimeline: '3',
    workoutDays: '5',
    goal: ''
  });
  const [profileWeightError, setProfileWeightError] = useState('');
  const [profileAgeError, setProfileAgeError] = useState('');
  const [profileHeightError, setProfileHeightError] = useState('');
  const [profileCurrentWeightError, setProfileCurrentWeightError] = useState('');
  const [profileTargetWeightError, setProfileTargetWeightError] = useState('');

  // Test function to display dummy meal and workout plans
  const showTestPlans = () => {
    // Dummy meal plans
    const dummyMealPlans = [
      {
        dayNumber: 1,
        meals: [
          {
            type: "Breakfast",
            totalCalories: 450,
            items: [
              { description: "Oatmeal with berries and almonds", calories: 300 },
              { description: "Green tea", calories: 0 }
            ]
          },
          {
            type: "Lunch",
            totalCalories: 550,
            items: [
              { description: "Grilled chicken salad with mixed vegetables", calories: 350 },
              { description: "Whole wheat roll", calories: 120 },
              { description: "Apple", calories: 80 }
            ]
          },
          {
            type: "Dinner",
            totalCalories: 600,
            items: [
              { description: "Baked salmon with quinoa and steamed broccoli", calories: 450 },
              { description: "Side salad with olive oil dressing", calories: 150 }
            ]
          }
        ]
      },
      {
        dayNumber: 2,
        meals: [
          {
            type: "Breakfast",
            totalCalories: 420,
            items: [
              { description: "Greek yogurt with honey and granola", calories: 280 },
              { description: "Banana", calories: 105 },
              { description: "Coffee with almond milk", calories: 35 }
            ]
          },
          {
            type: "Lunch",
            totalCalories: 580,
            items: [
              { description: "Turkey and avocado wrap with whole wheat tortilla", calories: 420 },
              { description: "Carrot sticks with hummus", calories: 160 }
            ]
          },
          {
            type: "Dinner",
            totalCalories: 620,
            items: [
              { description: "Lean beef stir-fry with brown rice and mixed vegetables", calories: 480 },
              { description: "Miso soup", calories: 140 }
            ]
          }
        ]
      }
    ];

    // Dummy workout plans
    const dummyWorkoutPlans = [
      {
        dayNumber: 1,
        workoutType: "Upper Body",
        exercises: [
          { description: "Push-ups - 3 sets × 12 reps" },
          { description: "Pull-ups - 3 sets × 8 reps" },
          { description: "Dumbbell shoulder press - 3 sets × 10 reps" },
          { description: "Bicep curls - 3 sets × 12 reps" },
          { description: "Tricep dips - 3 sets × 10 reps" }
        ]
      },
      {
        dayNumber: 2,
        workoutType: "Lower Body",
        exercises: [
          { description: "Squats - 4 sets × 12 reps" },
          { description: "Lunges - 3 sets × 10 reps each leg" },
          { description: "Deadlifts - 3 sets × 8 reps" },
          { description: "Calf raises - 3 sets × 15 reps" },
          { description: "Leg press - 3 sets × 12 reps" }
        ]
      },
      {
        dayNumber: 3,
        workoutType: "Cardio & Core",
        exercises: [
          { description: "30-minute run at moderate pace" },
          { description: "Plank - 3 sets × 45 seconds" },
          { description: "Russian twists - 3 sets × 20 reps" },
          { description: "Mountain climbers - 3 sets × 30 reps" },
          { description: "Bicycle crunches - 3 sets × 20 reps each side" }
        ]
      }
    ];

    // Set the dummy data
    setMealPlansByDay(dummyMealPlans);
    setWorkoutSections(dummyWorkoutPlans);
    setShowPlans(true);
    setPlansComplete(true);
    setIsStreamingMeal(false);
    setWorkoutPlanChoice(true);
    setNoWorkoutPlan(false);
  };

  // Profile weight validation function
  const validateProfileWeights = (currentWeight, targetWeight, currentUnit, targetUnit) => {
    const current = parseFloat(currentWeight);
    const target = parseFloat(targetWeight);

    // Check if units are different
    if (currentUnit && targetUnit && currentUnit !== targetUnit) {
      setProfileWeightError('Current weight and target weight should use the same units');
      return;
    }

    // Check if weights are equal
    if (!isNaN(current) && !isNaN(target) && current === target) {
      setProfileWeightError('Current weight and target weight should not be the same');
    } else {
      setProfileWeightError('');
    }
  };

  // Profile age validation function
  const validateProfileAge = (age) => {
    const ageNum = parseFloat(age);

    if (!age || age === '') {
      setProfileAgeError('Age is required');
      return;
    }

    if (isNaN(ageNum)) {
      setProfileAgeError('Please enter a valid age');
      return;
    }

    if (ageNum < 13) {
      setProfileAgeError('Age must be at least 13 years');
      return;
    }

    if (ageNum > 120) {
      setProfileAgeError('Age must be less than 120 years');
      return;
    }

    setProfileAgeError('');
  };

  // Profile height validation function
  const validateProfileHeight = (height, unit) => {
    const heightNum = parseFloat(height);

    if (!height || height === '') {
      setProfileHeightError('Height is required');
      return;
    }

    if (isNaN(heightNum)) {
      setProfileHeightError('Please enter a valid height');
      return;
    }

    if (unit === 'cm') {
      if (heightNum < 90) {
        setProfileHeightError('Height must be at least 90 cm');
        return;
      }
      if (heightNum > 250) {
        setProfileHeightError('Height must be less than 250 cm');
        return;
      }
    } else if (unit === 'ft') {
      if (heightNum < 3) {
        setProfileHeightError('Height must be at least 3 ft');
        return;
      }
      if (heightNum > 8) {
        setProfileHeightError('Height must be less than 8 ft');
        return;
      }
    }

    setProfileHeightError('');
  };

  // Profile current weight validation function
  const validateProfileCurrentWeight = (weight, unit) => {
    const weightNum = parseFloat(weight);

    if (!weight || weight === '') {
      setProfileCurrentWeightError('Current weight is required');
      return;
    }

    if (isNaN(weightNum)) {
      setProfileCurrentWeightError('Please enter a valid weight');
      return;
    }

    if (weightNum <= 0) {
      setProfileCurrentWeightError('Weight must be greater than 0');
      return;
    }

    if (unit === 'kg') {
      if (weightNum < 30) {
        setProfileCurrentWeightError('Weight must be at least 30 kg');
        return;
      }
      if (weightNum > 650) {
        setProfileCurrentWeightError('Weight must be less than 650 kg');
        return;
      }
    } else if (unit === 'lbs') {
      if (weightNum < 66) {
        setProfileCurrentWeightError('Weight must be at least 66 lbs');
        return;
      }
      if (weightNum > 1433) {
        setProfileCurrentWeightError('Weight must be less than 1433 lbs');
        return;
      }
    }

    setProfileCurrentWeightError('');
  };

  // Profile target weight validation function
  const validateProfileTargetWeight = (weight, unit) => {
    const weightNum = parseFloat(weight);

    if (!weight || weight === '') {
      setProfileTargetWeightError('Target weight is required');
      return;
    }

    if (isNaN(weightNum)) {
      setProfileTargetWeightError('Please enter a valid weight');
      return;
    }

    if (weightNum <= 0) {
      setProfileTargetWeightError('Weight must be greater than 0');
      return;
    }

    if (unit === 'kg') {
      if (weightNum < 30) {
        setProfileTargetWeightError('Weight must be at least 30 kg');
        return;
      }
      if (weightNum > 650) {
        setProfileTargetWeightError('Weight must be less than 650 kg');
        return;
      }
    } else if (unit === 'lbs') {
      if (weightNum < 66) {
        setProfileTargetWeightError('Weight must be at least 66 lbs');
        return;
      }
      if (weightNum > 1433) {
        setProfileTargetWeightError('Weight must be less than 1433 lbs');
        return;
      }
    }

    setProfileTargetWeightError('');
  };

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

  // Load conversation history when user is authenticated
  useEffect(() => {
    if (user && isAuthenticated) {
      console.log('Loading conversation history for user:', user.uid);
      loadConversationHistory();
    }
  }, [user, isAuthenticated]);

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

  // Load user profile data when user changes
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserProfileData(userData);
          } else {
            setUserProfileData(null);
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
          setUserProfileData(null);
        }
      } else {
        setUserProfileData(null);
      }
    };
    loadUserProfile();
  }, [user]);

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
    return `https://yantraprise.com/${endpoint}`;
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

  // Helper function to format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Invalid Date';

    let date;

    // Handle different timestamp formats
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      // Firebase Timestamp object
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // JavaScript Date object
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      // ISO string
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Unix timestamp (milliseconds)
      date = new Date(timestamp);
    } else {
      // Try to parse as Date
      date = new Date(timestamp);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleString();
  };

  // Load conversation history from Firebase
  const loadConversationHistory = async () => {
    if (!user) {
      console.log('No user found, skipping conversation history load');
      return;
    }

    try {
      console.log('Loading conversation history for user:', user.uid);
      setIsLoadingHistory(true);
      const history = await fetchAiCoachHistory(user.uid);
      console.log('Raw history from Firebase:', history);

      // Ensure history is always an array
      const validHistory = Array.isArray(history) ? history : [];
      setConversationHistory(validHistory);
      console.log('Loaded conversation history:', validHistory.length, 'conversations');
    } catch (error) {
      console.error('Error loading conversation history:', error);
      // Set empty array on error to prevent UI issues
      setConversationHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Save conversation data to Firebase with structured details
  const saveConversationData = async (prompt, response, requestParams = {}, metadata = {}) => {
    console.log('saveConversationData called with:', { prompt, response, requestParams, metadata });

    if (!user) {
      console.log('No user found, skipping conversation save');
      return;
    }

    try {
      console.log('Saving structured conversation data:', {
        userId: user.uid,
        promptLength: prompt.length,
        responseLength: response.length,
        requestParams,
        metadata
      });

      // Get user name and email
      const userName = user.displayName || userProfileData?.firstName + ' ' + userProfileData?.lastName || 'Anonymous';
      const userEmail = user.email || userProfileData?.email || '';

      // Determine if profile was used - use explicit user choice
      const usedProfile = useExistingProfile === true;

      console.log('Profile usage details:', {
        useExistingProfile,
        userProfileData,
        usedProfile
      });

      // Structure the data properly according to requirements
      const conversationMetadata = {
        // Required fields: timestamp, user email, user name
        timestamp: new Date().toISOString(),
        userEmail: userEmail,
        userName: userName,

        // Profile usage tracking
        profileOption: usedProfile === true ? 'yes' : 'no',

        // Store only necessary data based on profile usage
        ...(usedProfile
          ? {
            // If profile was used, store profile details
            profileDetails: {
              age: userProfileData?.age,
              gender: userProfileData?.gender,
              height: userProfileData?.height,
              weight: userProfileData?.weight,
              activityLevel: userProfileData?.activityLevel,
              targetWeight: userProfileData?.targetWeight,
              timeline: userProfileData?.targetTimeline
            }
          }
          : {
            // If profile was not used, store the free style prompt
            freeStylePrompt: prompt
          }
        ),

        // Store only meal and workout plan data (no extra data)
        planData: {
          hasMealPlan: response.includes('MEAL_PLAN:'),
          hasWorkoutPlan: response.includes('WORKOUT_PLAN:'),
          mealPlanContent: response.includes('MEAL_PLAN:') ? extractPlanContent(response, 'MEAL_PLAN:') : null,
          workoutPlanContent: response.includes('WORKOUT_PLAN:') ? extractPlanContent(response, 'WORKOUT_PLAN:') : null,
          // Add structured workout plan data from component state
          structuredWorkoutPlan: workoutSections && workoutSections.length > 0 ? workoutSections : null
        },

        // Additional metadata
        promptLength: prompt.length,
        responseLength: response.length,
        ...metadata
      };

      console.log('Final conversation metadata to be saved:', conversationMetadata);

      const conversationId = await saveAiCoachData(user.uid, prompt, response, conversationMetadata);
      console.log('Structured conversation data saved successfully with ID:', conversationId);

      // Reload conversation history to include the new entry
      console.log('Reloading conversation history after save...');
      await loadConversationHistory();
    } catch (error) {
      console.error('Error saving conversation data:', error);
    }
  };

  // Helper function to extract plan content
  const extractPlanContent = (response, planType) => {
    // Find the start of the plan
    const startIndex = response.indexOf(planType);
    if (startIndex === -1) return null;

    // For workout plan, look for more specific end markers
    if (planType === 'WORKOUT_PLAN:') {
      // Look for the end of the workout plan (END-OF-PLAN marker, next MEAL_PLAN, or end of string)
      const endIndexMarkers = [
        response.indexOf('END-OF-PLAN', startIndex),
        response.indexOf('MEAL_PLAN:', startIndex + planType.length),
        response.indexOf('\n\n\n', startIndex), // Triple newline as section separator
        response.length
      ].filter(index => index !== -1); // Remove -1 values

      const endIndex = Math.min(...endIndexMarkers);
      const planContent = response.substring(startIndex, endIndex).trim();
      return planContent || null;
    }

    // For meal plan, look for the next plan type or end of string
    const nextPlanStart = response.indexOf('WORKOUT_PLAN:', startIndex + planType.length);
    const endIndex = nextPlanStart !== -1 ? nextPlanStart : response.length;

    // Extract and return the plan content
    const planContent = response.substring(startIndex, endIndex).trim();
    return planContent || null;
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
    console.log('DEBUG: Final extracted data fields:', {
      age: data.age,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      activityLevel: data.activityLevel
    });
    return data;
  };

  // Validation function to check for required fields and return specific error messages
  const validateProfileData = (extractedData, originalPrompt) => {
    console.log('DEBUG: validateProfileData called with:', extractedData);
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

  // Weight validation function to check if current weight equals target weight
  const validateWeightValues = (currentWeight, targetWeight) => {
    const current = parseFloat(currentWeight);
    const target = parseFloat(targetWeight);

    // Check if weights are valid numbers
    if (isNaN(current) || isNaN(target)) {
      return { isValid: true }; // Let other validation handle invalid numbers
    }

    // Check if current weight equals target weight (with small tolerance for floating point)
    if (Math.abs(current - target) < 0.1) {
      return {
        isValid: false,
        showPopup: true,
        currentWeight: current,
        targetWeight: target
      };
    }

    return { isValid: true };
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

  // Save combined conversation when both plans are complete
  useEffect(() => {
    const saveCombinedConversation = async () => {
      if (combinedConversationData.isMealPlanComplete && combinedConversationData.isWorkoutPlanComplete) {
        // Combine both responses
        const combinedResponse = `${combinedConversationData.mealPlanResponse}\n\n${combinedConversationData.workoutPlanResponse}`;

        // Create combined metadata
        const combinedMetadata = {
          type: 'complete_plan',
          hasMealPlan: true,
          hasWorkoutPlan: true,
          responseLength: combinedResponse.length
        };

        // Save the combined conversation
        await saveConversationData(
          combinedConversationData.prompt,
          combinedResponse,
          {},
          combinedMetadata
        );

        // Reset the combined conversation data
        setCombinedConversationData({
          prompt: '',
          mealPlanResponse: '',
          workoutPlanResponse: '',
          isMealPlanComplete: false,
          isWorkoutPlanComplete: false
        });
      } else if (combinedConversationData.isMealPlanComplete && !combinedConversationData.isWorkoutPlanComplete) {
        // If only meal plan is complete and user chose not to generate workout plan
        // Save just the meal plan
        const mealPlanMetadata = {
          type: 'meal_plan_only',
          hasMealPlan: true,
          hasWorkoutPlan: false,
          responseLength: combinedConversationData.mealPlanResponse.length
        };

        await saveConversationData(
          combinedConversationData.prompt,
          combinedConversationData.mealPlanResponse,
          {},
          mealPlanMetadata
        );

        // Reset the combined conversation data
        setCombinedConversationData({
          prompt: '',
          mealPlanResponse: '',
          workoutPlanResponse: '',
          isMealPlanComplete: false,
          isWorkoutPlanComplete: false
        });
      }
    };

    saveCombinedConversation();
  }, [combinedConversationData]);

  // Save profile data to Firebase
  const saveProfileData = async (data) => {
    try {
      if (!user) return false;

      const userRef = doc(db, 'users', user.uid);
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
        // Validate extracted data and show specific error messages for missing fields
        const validation = validateProfileData(extractedData, fitnessGoal);
        if (!validation.isValid) {
          setValidationError(validation.message);
          setIsLoading(false);
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

      // Save conversation data to Firebase with all request parameters
      const requestParams = {
        prompt: fitnessGoal,
        userDetails: userDetails,
        endpoint: 'complete_plan'
      };

      await saveConversationData(fitnessGoal, formattedResponse, requestParams, {
        type: 'complete_plan',
        hasMealPlan: formattedResponse.includes('MEAL_PLAN:'),
        hasWorkoutPlan: formattedResponse.includes('WORKOUT_PLAN:'),
        responseLength: formattedResponse.length
      });

      // Check for profile updates - always compare extracted data with existing profile
      if (Object.keys(extractedData).length > 0 && user) {
        const changedFields = {};

        // Check if user has a profile
        const userRef = doc(db, 'users', user.uid);
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
    const userRef = doc(db, 'users', user.uid);
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
      // Check if user is authenticated using the useAuth hook
      if (!isAuthenticated || !user) {
        setErrorPopupMessage('Please log in to get personalized recommendations.');
        setShowErrorPopup(true);
        setTimeout(() => setShowErrorPopup(false), 5000);
        setIsLoading(false);
        return;
      }

      // Extract profile data from prompt
      const extractedData = extractProfileData(fitnessGoal);
      setExtractedProfileData(extractedData);

      // Check user profile status
      const { hasProfile, hasCompleteProfile, profileData } = await checkUserProfile(user.uid);

      // NEW: Check if we have extracted data from the prompt AND user has existing profile
      if (extractedData.age && extractedData.gender && extractedData.height && extractedData.weight && extractedData.activityLevel) {
        // If user has a complete profile, ask if they want to use it
        if (hasCompleteProfile) {
          // User has complete profile - ask if they want to use it
          setShowProfileChoicePopup(true);
          setIsLoading(false);
          return;
        } else {
          // No existing profile, process as natural language input
          console.log('Processing with extracted data from prompt:', extractedData);
          await handleNaturalLanguageInput(fitnessGoal, true); // bypass profile check
          return;
        }
      }

      // If user has a complete profile, ask if they want to use it
      if (hasCompleteProfile) {
        // User has complete profile - ask if they want to use it
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

          // Save calorie calculation to Firebase
          const calorieRequestParams = {
            prompt: fitnessGoal,
            userDetails: {
              age: parseInt(extractedData.age),
              weight: parseFloat(extractedData.weight),
              height: parseFloat(extractedData.height),
              gender: extractedData.gender,
              activityLevel: extractedData.activityLevel,
              goal: extractedData.goal,
              targetWeight: parseFloat(extractedData.targetWeight?.value || extractedData.targetWeight),
              timeline: parseInt(extractedData.targetTimeline || 12)
            },
            endpoint: 'user_calorie_calculation'
          };

          await saveConversationData(fitnessGoal, JSON.stringify(calorieData), calorieRequestParams, {
            type: 'calorie_calculation',
            responseLength: JSON.stringify(calorieData).length
          });

        } catch (error) {
          console.error('Error calculating calories:', error);
          setIsLoading(false);
          let errorMessage = 'Failed to calculate calories. ';
          if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Make sure the backend server is running on ';
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
        setValidationError(validation.message);
      }
    }
  };

  const loadProfileDataToForm = async () => {
    try {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setProfileFormData({
            age: userData.age || '',
            gender: userData.gender || '',
            height: userData.height || '',
            heightUnit: userData.heightUnit || 'cm',
            currentWeight: userData.weight || '',
            currentWeightUnit: userData.weightUnit || 'kg',
            targetWeight: userData.weight || '', // Default to current weight
            targetWeightUnit: userData.targetWeightUnit || userData.weightUnit || 'kg',
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
      if (user) {
        // Save only the changed fields
        const profileData = {
          ...changedProfileFields,
          updatedAt: serverTimestamp()
        };

        const userRef = doc(db, 'users', user.uid);
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

    // Validate age, height, and weights first
    validateProfileAge(profileFormData.age);
    validateProfileHeight(profileFormData.height, profileFormData.heightUnit);
    validateProfileCurrentWeight(profileFormData.currentWeight, profileFormData.currentWeightUnit);
    validateProfileTargetWeight(profileFormData.targetWeight, profileFormData.targetWeightUnit);

    // Check if there are any validation errors
    if (profileAgeError || profileHeightError || profileCurrentWeightError || profileTargetWeightError) {
      return;
    }

    // Validate required fields
    if (!profileFormData.age || !profileFormData.gender || !profileFormData.height ||
      !profileFormData.currentWeight || !profileFormData.targetWeight ||
      !profileFormData.activityLevel || !profileFormData.targetTimeline) {
      setSuccessMessage('Please fill in all required fields.');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);
      return;
    }

    // Check weight validation (units and values)
    const currentWeight = parseFloat(profileFormData.currentWeight);
    const targetWeight = parseFloat(profileFormData.targetWeight);

    // Check if units are different
    if (profileFormData.currentWeightUnit && profileFormData.targetWeightUnit &&
      profileFormData.currentWeightUnit !== profileFormData.targetWeightUnit) {
      setProfileWeightError('Current weight and target weight should use the same units');
      return;
    }

    // Check if weights are equal
    if (!isNaN(currentWeight) && !isNaN(targetWeight) && currentWeight === targetWeight) {
      setProfileWeightError('Current weight and target weight should not be the same');
      return;
    }


    setShowProfileForm(false);
    setIsLoading(true);
    await submitProfileFormData();
  };

  // Extract the actual submission logic into a separate function
  const submitProfileFormData = async () => {

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
        errorMessage += 'Make sure the backend server is running';
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
    setOriginalMealPlanResponse(''); // Clear original response
    setShowPlans(true); // Show the plans section immediately
    setMealPlansByDay([]); // Clear previous data
    setWorkoutSections([]);
    setPlansComplete(false); // Reset plans complete status
    setNoWorkoutPlan(false); // Reset no workout plan flag
    setIncompleteExerciseBuffer(''); // Clear incomplete exercise buffer
    setCurrentMealDay(0); // Reset current meal day counter

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
          dietaryRestrictions: useExistingProfile ? (userProfileData?.dietaryRestrictions || []) : [], // Only send if user chose to use profile
          allergies: useExistingProfile ? (userProfileData?.allergies || []) : [], // Only send if user chose to use profile
          healthGoals: extractedProfileData?.healthGoals || profileFormData?.goal,
          targetWeight: extractedProfileData?.targetWeight?.value || profileFormData?.targetWeight,
          timelineWeeks: parseInt(extractedProfileData?.timelineWeeks || profileFormData?.targetTimeline * 4 || 12),
          prompt: fitnessGoal || `Generate meal plan for ${extractedProfileData?.goal || profileFormData.goal || 'fitness'} goal`
        })
      });

      // Save conversation data to Firebase with all meal plan parameters
      const mealPlanParams1 = {
        targetCalories: calculatedCalories.targetCalories,
        dietaryRestrictions: useExistingProfile ? (userProfileData?.dietaryRestrictions || []) : [], // Only send if user chose to use profile
        allergies: useExistingProfile ? (userProfileData?.allergies || []) : [], // Only send if user chose to use profile
        healthGoals: extractedProfileData?.healthGoals || profileFormData?.goal,
        targetWeight: extractedProfileData?.targetWeight?.value || profileFormData?.targetWeight,
        timelineWeeks: parseInt(extractedProfileData?.timelineWeeks || profileFormData?.targetTimeline * 4 || 12),
        prompt: `Generate meal plan for ${extractedProfileData?.goal || profileFormData.goal || 'fitness'} goal`,
        endpoint: 'mealplan'
      };
      await saveConversationData(mealPlanParams1);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Meal plan error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let currentDayBuffer = '';
      let completedDays = 0;
      let isProcessingDay = false;
      let processedDayNumbers = new Set(); // Track which day numbers we've processed

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        currentDayBuffer += chunk;
        setStreamingMealPlan(accumulatedText);

        // Check if we have a complete day (look for "Day X:" followed by next "Day Y:" or end)
        const dayPattern = /Day\s+(\d+):/g;
        const dayMatches = [...currentDayBuffer.matchAll(dayPattern)];

        // Process complete days as they arrive
        while (dayMatches.length >= 2) {
          // We have at least 2 days, process the first complete day
          const firstDayStart = dayMatches[0].index;
          const secondDayStart = dayMatches[1].index;
          const completeDayText = currentDayBuffer.substring(firstDayStart, secondDayStart);

          // Parse and add the complete day
          try {
            const dayResponse = `MEAL_PLAN:${completeDayText}`;
            parseResponseLiveImmediate(dayResponse, 'meal');

            // Extract the actual day number from the response
            const dayNumberMatch = completeDayText.match(/Day\s+(\d+):/);
            if (dayNumberMatch) {
              const dayNumber = parseInt(dayNumberMatch[1]);
              if (dayNumber >= 1 && dayNumber <= 7 && !processedDayNumbers.has(dayNumber)) {
                processedDayNumbers.add(dayNumber);
                completedDays = processedDayNumbers.size; // Count actual processed days
                setCurrentMealDay(completedDays);
                console.log(`Completed day ${dayNumber} of meal plan (${completedDays} total processed)`);
                if (completedDays >= 7) {
                  console.log(`DEBUG: currentMealDay set to ${completedDays}, will show "Finalizing meal plan..."`);
                } else {
                  console.log(`DEBUG: currentMealDay set to ${completedDays}, will show "Generating Day ${completedDays + 1} of 7..."`);
                }
                console.log(`DEBUG: Progress will show "${completedDays} of 7 days completed"`);
              }
            }
          } catch (parseError) {
            console.log('Error parsing complete day:', parseError.message);
          }

          // Remove the processed day from buffer
          currentDayBuffer = currentDayBuffer.substring(secondDayStart);

          // Recheck for day patterns in the remaining buffer
          const remainingDayMatches = [...currentDayBuffer.matchAll(dayPattern)];
          if (remainingDayMatches.length < 2) {
            break;
          }
          dayMatches.splice(0, 1); // Remove the first match
          dayMatches[0] = remainingDayMatches[0]; // Update the first match
        }

        // Check if we have a complete day followed by END-OF-PLAN or end of stream
        if (dayMatches.length === 1 && completedDays < 7) {
          const dayStart = dayMatches[0].index;
          const suggestionIndex = currentDayBuffer.search(/END-OF-PLAN[\s-]?SUGGESTION/i) !== -1 ?
            currentDayBuffer.search(/END-OF-PLAN[\s-]?SUGGESTION/i) :
            currentDayBuffer.indexOf('**End-of-Plan Suggestion:**') !== -1 ?
              currentDayBuffer.indexOf('**End-of-Plan Suggestion:**') :
              currentDayBuffer.indexOf('**Recommendation:**');
          const totalCaloriesIndex = currentDayBuffer.indexOf('Total Daily Calories:');

          // If we found "Total Daily Calories" after the day start, we might have a complete day
          if (totalCaloriesIndex > dayStart) {
            // We have a complete day followed by total calories
            const completeDayText = currentDayBuffer.substring(dayStart, totalCaloriesIndex + 50); // Include some extra characters

            // Parse and add the complete day
            try {
              const dayResponse = `MEAL_PLAN:${completeDayText}`;
              parseResponseLiveImmediate(dayResponse, 'meal');

              // Extract the actual day number from the response
              const dayNumberMatch = completeDayText.match(/Day\s+(\d+):/);
              if (dayNumberMatch) {
                const dayNumber = parseInt(dayNumberMatch[1]);
                if (dayNumber >= 1 && dayNumber <= 7 && !processedDayNumbers.has(dayNumber)) {
                  processedDayNumbers.add(dayNumber);
                  completedDays = processedDayNumbers.size; // Count actual processed days
                  setCurrentMealDay(completedDays);
                  console.log(`Completed final day ${dayNumber} of meal plan (${completedDays} total processed)`);
                  if (completedDays >= 7) {
                    console.log(`DEBUG: currentMealDay set to ${completedDays}, will show "Finalizing meal plan..."`);
                  } else {
                    console.log(`DEBUG: currentMealDay set to ${completedDays}, will show "Generating Day ${completedDays + 1} of 7..."`);
                  }
                  console.log(`DEBUG: Progress will show "${completedDays} of 7 days completed"`);
                }
              }
            } catch (parseError) {
              console.log('Error parsing final day:', parseError.message);
            }
          } else if (suggestionIndex > dayStart) {
            // We have a complete day followed by suggestion
            const completeDayText = currentDayBuffer.substring(dayStart, suggestionIndex);

            // Parse and add the complete day
            try {
              const dayResponse = `MEAL_PLAN:${completeDayText}`;
              parseResponseLiveImmediate(dayResponse, 'meal');

              // Extract the actual day number from the response
              const dayNumberMatch = completeDayText.match(/Day\s+(\d+):/);
              if (dayNumberMatch) {
                const dayNumber = parseInt(dayNumberMatch[1]);
                if (dayNumber >= 1 && dayNumber <= 7 && !processedDayNumbers.has(dayNumber)) {
                  processedDayNumbers.add(dayNumber);
                  completedDays = processedDayNumbers.size; // Count actual processed days
                  setCurrentMealDay(completedDays);
                  console.log(`Completed final day ${dayNumber} of meal plan (${completedDays} total processed)`);
                  if (completedDays >= 7) {
                    console.log(`DEBUG: currentMealDay set to ${completedDays}, will show "Finalizing meal plan..."`);
                  } else {
                    console.log(`DEBUG: currentMealDay set to ${completedDays}, will show "Generating Day ${completedDays + 1} of 7..."`);
                  }
                  console.log(`DEBUG: Progress will show "${completedDays} of 7 days completed"`);
                }
              }
            } catch (parseError) {
              console.log('Error parsing final day:', parseError.message);
            }

            // Extract the suggestion text
            const suggestionText = currentDayBuffer.substring(suggestionIndex);
            console.log('DEBUG: Suggestion text to parse:', suggestionText.substring(0, 200) + '...');
            const suggestionMatch = suggestionText.match(/END-OF-PLAN[\s-]?SUGGESTION:?\s*(.*)/i) ||
              suggestionText.match(/\*\*End-of-Plan Suggestion:\*\*\s*(.*)/i) ||
              suggestionText.match(/\*\*Recommendation:\*\*\s*(.*)/i);
            if (suggestionMatch) {
              const extractedSuggestion = suggestionMatch[1].trim();
              console.log('DEBUG: Extracted suggestion from streaming:', extractedSuggestion);
              setEndOfPlanSuggestion(extractedSuggestion);
              // Suggestions will be auto-opened by useEffect when first available
              console.log('DEBUG: Set endOfPlanSuggestion and opened accordion');
            }
          }
        }

        // Force UI update to show completed days
        if (completedDays > 0) {
          setMealPlansByDay(prev => [...prev]);
        }

        // Parse and update meal plans in real-time with immediate parsing
        try {
          const liveResponse = `MEAL_PLAN:${accumulatedText}`;
          console.log('Parsing meal response:', liveResponse.substring(0, 200) + '...');

          // Use immediate parsing for real-time UI updates
          parseResponseLiveImmediate(liveResponse, 'meal');

          // Debug: Log current meal plans after parsing
          console.log('Current meal plans after parsing:', mealPlansByDay);
        } catch (parseError) {
          console.log('Temporary meal parse error (continuing):', parseError.message);
          // Fallback: try to create days from text
          createDaysFromText(accumulatedText, 'meal');
        }
      }

      // Final parse for complete meal plan - use the same parsing logic as streaming
      const finalResponse = `MEAL_PLAN:${accumulatedText}`;
      parseResponseLiveImmediate(finalResponse, 'meal');

      // Save conversation data to Firebase with all meal plan parameters
      const mealPlanRequestParams = {
        targetCalories: calculatedCalories.targetCalories,
        dietaryRestrictions: useExistingProfile ? (userProfileData?.dietaryRestrictions || []) : [], // Only send if user chose to use profile
        allergies: useExistingProfile ? (userProfileData?.allergies || []) : [], // Only send if user chose to use profile
        healthGoals: extractedProfileData?.healthGoals || profileFormData?.goal,
        targetWeight: extractedProfileData?.targetWeight?.value || profileFormData?.targetWeight,
        timelineWeeks: parseInt(extractedProfileData?.timelineWeeks || profileFormData?.targetTimeline * 4 || 12),
        prompt: fitnessGoal || `Generate meal plan for ${extractedProfileData?.goal || profileFormData.goal || 'fitness'} goal`,
        endpoint: 'mealplan'
      };

      await saveConversationData(fitnessGoal, finalResponse, mealPlanRequestParams, {
        type: 'meal_plan',
        streaming: true,
        responseLength: finalResponse.length
      });

      setCombinedConversationData(prev => ({
        ...prev,
        prompt: fitnessGoal,
        mealPlanResponse: finalResponse,
        isMealPlanComplete: true
      }));

      // Extract end-of-plan suggestion
      const suggestionMatch = accumulatedText.match(/END-OF-PLAN[\s-]?SUGGESTION:?\s*(.*)/i) ||
        accumulatedText.match(/\*\*End-of-Plan Suggestion:\*\*\s*(.*)/i) ||
        accumulatedText.match(/\*\*Recommendation:\*\*\s*(.*)/i);
      if (suggestionMatch) {
        const extractedSuggestion = suggestionMatch[1].trim();
        console.log('DEBUG: Extracted meal plan suggestion:', extractedSuggestion);
        setEndOfPlanSuggestion(extractedSuggestion);
        console.log('DEBUG: Set endOfPlanSuggestion:', extractedSuggestion);
      }

      console.log('Meal plan generation completed, setting isStreamingMeal to false');
      clearTimeout(mealStreamingTimeout); // Clear the timeout since we completed successfully
      setIsStreamingMeal(false);

      // Force a re-render to ensure UI updates
      setTimeout(() => {
        setMealPlansByDay(prev => [...prev]);
      }, 500);

      // Show workout plan choice popup
      setShowWorkoutPlanChoice(true);

    } catch (error) {
      console.error('Error generating meal plan:', error);
      console.log('Error occurred, setting isStreamingMeal to false');
      clearTimeout(mealStreamingTimeout); // Clear the timeout since we had an error
      setIsStreamingMeal(false);

      // Force a re-render to ensure UI updates
      setTimeout(() => {
        setMealPlansByDay(prev => [...prev]);
      }, 500);
      let errorMessage = 'Failed to generate meal plan. ';
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
      // Use actual backend suggestions if available, otherwise fallback
      if (endOfPlanSuggestion) {
        setPersonalizedSuggestions(endOfPlanSuggestion);
      } else {
        const fallbackSuggestions = generateFallbackSuggestions();
        setPersonalizedSuggestions(fallbackSuggestions);
      }
      // Auto-open suggestions when they are first generated
      if (!userHasToggledAccordion) {
        setOpenSuggestionsAccordion(true);
      }

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

      // Use the full user prompt for better context
      workoutPrompt = fitnessGoal || `Generate workout plan for ${extractedProfileData?.goal || profileFormData.goal || 'fitness'} goal, I prefer to workout ${workoutDays} days per week`;

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
          targetWeight: extractedProfileData?.targetWeight?.value || profileFormData?.targetWeight,
          timelineWeeks: parseInt(extractedProfileData?.timelineWeeks || profileFormData?.targetTimeline * 4 || 12),
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

      // Save conversation data to Firebase with all workout plan parameters
      const workoutPlanRequestParams = {
        goal: extractedProfileData?.goal || profileFormData.goal || 'fitness',
        workout_focus: calculatedCalories.WorkoutFocus || 'Mixed Cardio and Strength',
        workout_days: workoutDays,
        targetWeight: extractedProfileData?.targetWeight?.value || profileFormData?.targetWeight,
        timelineWeeks: parseInt(extractedProfileData?.timelineWeeks || profileFormData?.targetTimeline * 4 || 12),
        endpoint: 'workoutplan'
      };

      /*
      await saveConversationData(fitnessGoal, finalResponse, workoutPlanRequestParams, {
        type: 'workout_plan',
        streaming: true,
        responseLength: finalResponse.length
      });
      */

      setCombinedConversationData(prev => ({
        ...prev,
        prompt: fitnessGoal,
        workoutPlanResponse: finalResponse,
        isWorkoutPlanComplete: true
      }));

      // Extract workout plan suggestion (only if this is a workout plan response)
      const workoutSuggestionMatch = accumulatedText.match(/END-OF-PLAN[\s-]?SUGGESTION:?\s*(.*)/i) ||
        accumulatedText.match(/\*\*End-of-Plan Suggestion:\*\*\s*(.*)/i) ||
        accumulatedText.match(/\*\*Recommendation:\*\*\s*(.*)/i);
      if (workoutSuggestionMatch) {
        const extractedWorkoutSuggestion = workoutSuggestionMatch[1].trim();
        console.log('DEBUG: Extracted workout plan suggestion:', extractedWorkoutSuggestion);

        // Set workout plan suggestion - this should be separate from meal plan suggestion
        setWorkoutPlanSuggestion(extractedWorkoutSuggestion);
        console.log('DEBUG: Set workout plan suggestion:', extractedWorkoutSuggestion);

        // Suggestions will be auto-opened by useEffect when first available
      }

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
      // Use actual backend suggestions if available, otherwise fallback
      if (endOfPlanSuggestion) {
        setPersonalizedSuggestions(endOfPlanSuggestion);
      } else {
        const fallbackSuggestions = generateFallbackSuggestions();
        setPersonalizedSuggestions(fallbackSuggestions);
      }
      // Auto-open suggestions when they are first generated
      if (!userHasToggledAccordion) {
        setOpenSuggestionsAccordion(true);
      }

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

      // Use actual backend suggestions if available, otherwise generate fallback suggestions
      if (endOfPlanSuggestion) {
        setPersonalizedSuggestions(endOfPlanSuggestion);
      } else {
        const fallbackSuggestions = generateFallbackSuggestions();
        setPersonalizedSuggestions(fallbackSuggestions);
      }

      console.log('DEBUG: Generated suggestions:', endOfPlanSuggestion || 'fallback suggestions');
      // Auto-expand suggestions when they're loaded (only if user hasn't manually controlled it)
      if (!userHasToggledAccordion) {
        setOpenSuggestionsAccordion(true);
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

  // Save combined conversation when both plans are complete
  useEffect(() => {
    const saveCombinedConversation = async () => {
      if (combinedConversationData.isMealPlanComplete && combinedConversationData.isWorkoutPlanComplete) {
        // Combine both responses
        const combinedResponse = `${combinedConversationData.mealPlanResponse}\n\n${combinedConversationData.workoutPlanResponse}`;

        // Create combined metadata
        const combinedMetadata = {
          type: 'complete_plan',
          hasMealPlan: true,
          hasWorkoutPlan: true,
          responseLength: combinedResponse.length
        };

        // Save the combined conversation
        await saveConversationData(
          combinedConversationData.prompt,
          combinedResponse,
          {},
          combinedMetadata
        );

        // Reset the combined conversation data
        setCombinedConversationData({
          prompt: '',
          mealPlanResponse: '',
          workoutPlanResponse: '',
          isMealPlanComplete: false,
          isWorkoutPlanComplete: false
        });
      } else if (combinedConversationData.isMealPlanComplete && !combinedConversationData.isWorkoutPlanComplete) {
        // If only meal plan is complete and user chose not to generate workout plan
        // Save just the meal plan
        const mealPlanMetadata = {
          type: 'meal_plan_only',
          hasMealPlan: true,
          hasWorkoutPlan: false,
          responseLength: combinedConversationData.mealPlanResponse.length
        };

        await saveConversationData(
          combinedConversationData.prompt,
          combinedConversationData.mealPlanResponse,
          {},
          mealPlanMetadata
        );

        // Reset the combined conversation data
        setCombinedConversationData({
          prompt: '',
          mealPlanResponse: '',
          workoutPlanResponse: '',
          isMealPlanComplete: false,
          isWorkoutPlanComplete: false
        });
      }
    };

    saveCombinedConversation();
  }, [combinedConversationData]);

  // Remove the duplicate useEffect hook
  // The useEffect hook below is a duplicate and causes conflicts
  // It has been removed to prevent double saving of conversation data

  // Check for profile updates after plan generation
  const checkForProfileUpdates = async () => {
    try {
      if (!user) return;

      const userRef = doc(db, 'users', user.uid);
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


  // Function to check if user has all required profile fields for default prompt
  const checkRequiredProfileFields = (profileData) => {
    const requiredFields = ['age', 'height', 'weight', 'gender', 'activityLevel'];
    const missingFields = [];

    requiredFields.forEach(field => {
      if (!profileData || !profileData[field]) {
        missingFields.push(field);
      }
    });

    return {
      hasAllFields: missingFields.length === 0,
      missingFields: missingFields
    };
  };

  const handleCopyDefaultPrompt = async () => {
    try {
      // Always show popup with all fields pre-filled from profile data
      setMissingProfileFieldsData({
        missingFields: [], // No missing fields since we're pre-filling everything
        currentProfileData: userProfileData || {}
      });
      setShowMissingProfileFieldsPopup(true);
      return;

      let defaultPrompt = `I am a [age]-year-old [gender], my height is [height] cm, weight is [weight] kg. My activity level is [activity level] (e.g., sedentary, lightly active, moderately active, very active). I want to workout [number of workout days] days per week. My target weight is [target weight] kg, and I want to achieve this goal in [target timeline] months.`;

      // If user has profile data, populate the prompt with actual values
      if (userProfileData) {
        const age = userProfileData.age || '[age]';
        const gender = userProfileData.gender || '[gender]';
        const height = userProfileData.height || '[height]';
        const heightUnit = userProfileData.heightUnit || 'cm';
        const weight = userProfileData.weight || '[weight]';
        const weightUnit = userProfileData.weightUnit || 'kg';
        const activityLevel = userProfileData.activityLevel || '[activity level]';
        const workoutDays = userProfileData.workoutDays || '[number of workout days]';
        const targetWeight = userProfileData.targetWeight || '[target weight]';
        const targetWeightUnit = userProfileData.targetWeightUnit || 'kg';
        const timeline = userProfileData.targetTimeline || '[target timeline]';
        const timelineUnit = userProfileData.targetTimelineUnit || 'weeks';

        // Only include the example text if we don't have actual activity level data
        const activityLevelText = userProfileData.activityLevel
          ? `My activity level is ${activityLevel}.`
          : `My activity level is ${activityLevel} (e.g., sedentary, lightly active, moderately active, very active).`;

        defaultPrompt = `I am a ${age}-year-old ${gender}, my height is ${height} ${heightUnit}, weight is ${weight} ${weightUnit}. ${activityLevelText} I want to workout ${workoutDays} days per week. My target weight is ${targetWeight} ${targetWeightUnit}, and I want to achieve this goal in ${timeline} ${timelineUnit}.`;
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(defaultPrompt);

      // Automatically paste into fitness goal input field
      setFitnessGoal(defaultPrompt);

      setCopyButtonClicked(true);
      setTimeout(() => setCopyButtonClicked(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  // Validation function for profile data
  const validateProfileDataForSave = (formData) => {
    const errors = [];

    // Validate age
    const age = parseFloat(formData.age);
    if (!formData.age || isNaN(age) || age < 13 || age > 120) {
      errors.push('Please enter a valid age (13-120 years)');
    }

    // Validate height
    const height = parseFloat(formData.height);
    if (!formData.height || isNaN(height)) {
      errors.push('Please enter a valid height');
    } else if (formData.heightUnit === 'cm' && (height < 90 || height > 250)) {
      errors.push('Height must be between 90-250 cm');
    } else if (formData.heightUnit === 'ft' && (height < 3 || height > 8)) {
      errors.push('Height must be between 3-8 ft');
    }

    // Validate weight
    const weight = parseFloat(formData.weight);
    if (!formData.weight || isNaN(weight)) {
      errors.push('Please enter a valid weight');
    } else if (formData.weightUnit === 'kg' && (weight < 30 || weight > 650)) {
      errors.push('Weight must be between 30-650 kg');
    } else if (formData.weightUnit === 'lbs' && (weight < 66 || weight > 1433)) {
      errors.push('Weight must be between 66-1433 lbs');
    }

    // Validate gender
    if (!formData.gender) {
      errors.push('Please select a gender');
    }

    // Validate activity level
    if (!formData.activityLevel) {
      errors.push('Please select an activity level');
    }

    return errors;
  };

  // Handler for saving profile data only
  const handleSaveProfile = async (formData) => {
    console.log('DEBUG: handleSaveProfile called with:', formData);
    try {
      if (!isAuthenticated || !user) {
        setErrorPopupMessage('Please log in to save your profile.');
        setShowErrorPopup(true);
        setTimeout(() => setShowErrorPopup(false), 5000);
        return;
      }

      // Validate all form data before saving
      const validationErrors = validateProfileDataForSave(formData);
      if (validationErrors.length > 0) {
        // Don't show popup error - let the individual field validation errors show below inputs
        return;
      }

      // Update user profile with the new data, but exclude target weight, timeline, and workout days
      const userRef = doc(db, 'users', user.uid);
      const { targetWeight: targetW, targetWeightUnit: targetWU, targetTimeline: targetT, targetTimelineUnit: targetTU, workoutDays: workoutD, ...dataToSave } = formData;

      // Ensure important profile fields are included in the data to save
      const updatedProfileData = {
        ...userProfileData,
        ...dataToSave,
        age: formData.age,
        height: formData.height,
        heightUnit: formData.heightUnit,
        weight: formData.weight,
        weightUnit: formData.weightUnit,
        gender: formData.gender,
        activityLevel: formData.activityLevel,
        updatedAt: new Date().toISOString()
      };

      await setDoc(userRef, updatedProfileData, { merge: true });

      // Update local state
      setUserProfileData(updatedProfileData);

      setSuccessMessage('Profile saved successfully!');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);

    } catch (error) {
      console.error('Error updating profile:', error);
      setErrorPopupMessage('Failed to update profile. Please try again.');
      setShowErrorPopup(true);
      setTimeout(() => setShowErrorPopup(false), 5000);
    }
  };

  // Handler for generating default prompt only
  const handleGeneratePrompt = async (formData) => {
    console.log('DEBUG: handleGeneratePrompt called with:', formData);
    try {
      // Validate all form data before generating prompt
      const validationErrors = validateProfileDataForSave(formData);
      if (validationErrors.length > 0) {
        // Don't show popup error - let the individual field validation errors show below inputs

        // Focus on the first required field that has an error
        setTimeout(() => {
          if (!formData.age) {
            const ageInput = document.getElementById('profileAge');
            if (ageInput) ageInput.focus();
          } else if (!formData.gender) {
            const genderSelect = document.getElementById('profileGender');
            if (genderSelect) genderSelect.focus();
          } else if (!formData.height) {
            const heightInput = document.getElementById('profileHeight');
            if (heightInput) heightInput.focus();
          } else if (!formData.currentWeight) {
            const weightInput = document.getElementById('profileCurrentWeight');
            if (weightInput) weightInput.focus();
          } else if (!formData.targetWeight) {
            const targetWeightInput = document.getElementById('profileTargetWeight');
            if (targetWeightInput) targetWeightInput.focus();
          } else if (!formData.activityLevel) {
            const activitySelect = document.getElementById('profileActivityLevel');
            if (activitySelect) activitySelect.focus();
          } else if (!formData.workoutDays) {
            const workoutDaysSelect = document.getElementById('profileWorkoutDays');
            if (workoutDaysSelect) workoutDaysSelect.focus();
          } else if (!formData.targetTimeline) {
            const timelineInput = document.getElementById('profileTimeline');
            if (timelineInput) timelineInput.focus();
          }
        }, 100);

        return;
      }

      // Generate and paste the default prompt
      const age = formData.age || '[age]';
      const gender = formData.gender || '[gender]';
      const height = formData.height || '[height]';
      const heightUnit = formData.heightUnit || 'cm';
      const weight = formData.weight || '[weight]';
      const weightUnit = formData.weightUnit || 'kg';
      const activityLevel = formData.activityLevel || '[activity level]';
      const workoutDays = formData.workoutDays || '[number of workout days]';
      const targetWeight = formData.targetWeight || '[target weight]';
      const targetWeightUnit = formData.targetWeightUnit || 'kg';
      const timeline = formData.targetTimeline || '[target timeline]';
      const timelineUnit = 'months';

      const activityLevelText = activityLevel
        ? `My activity level is ${activityLevel}.`
        : `My activity level is ${activityLevel} (e.g., sedentary, lightly active, moderately active, very active).`;

      const defaultPrompt = `I am a ${age}-year-old ${gender}, my height is ${height} ${heightUnit}, weight is ${weight} ${weightUnit}. ${activityLevelText} I want to workout ${workoutDays} days per week. My target weight is ${targetWeight} ${targetWeightUnit}, and I want to achieve this goal in ${timeline} ${timelineUnit}.`;

      // Copy to clipboard
      await navigator.clipboard.writeText(defaultPrompt);

      // Automatically paste into fitness goal input field
      console.log('DEBUG: Attempting to set fitness goal with:', defaultPrompt);
      setFitnessGoal(defaultPrompt);

      // Close popup
      setShowMissingProfileFieldsPopup(false);

      setCopyButtonClicked(true);
      setTimeout(() => setCopyButtonClicked(false), 2000);

      setSuccessMessage('Default prompt generated and copied to clipboard!');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);

    } catch (error) {
      console.error('Error generating prompt:', error);
      setErrorPopupMessage('Failed to generate prompt. Please try again.');
      setShowErrorPopup(true);
      setTimeout(() => setShowErrorPopup(false), 5000);
    }
  };

  const handleMissingProfileFieldsCancel = () => {
    setShowMissingProfileFieldsPopup(false);
    setMissingProfileFieldsData({});
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
      // More accurate regex to extract meal plan content
      const mealPlanMatch = response.match(/MEAL_PLAN:([\s\S]*?)(?=WORKOUT_PLAN:|END-OF-PLAN[\s-]?SUGGESTION:|\*\*End-of-Plan Suggestion:\*\*|\*\*Recommendation:\*\*|$)/i);
      if (!mealPlanMatch) return;

      const mealPlanRaw = mealPlanMatch[1].trim();

      // Parse available days incrementally with improved regex
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
          // More flexible day matching patterns with better regex
          const dayMatch = line.match(/Day\s*(\d+)(?:\s*[:-]\s*|\s+)(.*)/i) || line.match(/Day\s*(\d+)$/i);
          if (dayMatch) {
            const dayNumber = parseInt(dayMatch[1]);
            // Only process days 1-7
            if (dayNumber >= 1 && dayNumber <= 7) {
              currentDay = dayNumber;
              console.log(`DEBUG: Found Day ${currentDay}`);
            } else {
              console.log(`DEBUG: Skipping Day ${dayNumber} (not in range 1-7)`);
            }

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

          // Improved meal type matching with better calorie extraction
          const mealTypeMatch = line.match(/(Breakfast|Lunch|Snack|Dinner)\s*\((\d+)\s*(?:kcal|calories?)?\)(?:\s*:|$)/i);
          if (mealTypeMatch && currentDay && currentDay <= 7) {
            currentMealType = mealTypeMatch[1];
            const calories = parseInt(mealTypeMatch[2]) || 0;
            console.log(`DEBUG: Found meal type: ${currentMealType} with ${calories} kcal for Day ${currentDay}`);
            console.log(`DEBUG: Setting meal totalCalories to ${calories} for ${currentMealType}`);

            const dayData = updatedMealPlans.find(day => day.dayNumber === currentDay);
            if (dayData) {
              const mealIndex = dayData.meals.findIndex(m => m.type === currentMealType);
              if (mealIndex !== -1) {
                dayData.meals[mealIndex].calories = calories;
                // Add a totalCalories field to distinguish from calculated calories
                dayData.meals[mealIndex].totalCalories = calories;
                console.log(`DEBUG: Set ${currentMealType} totalCalories to ${calories} for Day ${currentDay}`);
                hasChanges = true;
              }
            }
            return;
          }

          // Parse meal items with improved regex to handle the exact format from backend
          // Format: "  1. Oats (dry) — 60g — 234 kcal"
          const itemMatch = line.match(/^\s*\d+\.\s*(.*?)\s*[-–—]\s*(.*?)\s*[-–—]\s*(\d+)\s*(?:kcal|calories?|cal)\s*$/i);
          if (itemMatch && currentDay && currentMealType && currentDay <= 7) {
            const itemName = itemMatch[1].trim();
            const itemQty = itemMatch[2].trim();
            const itemCalories = parseInt(itemMatch[3]) || 0;

            console.log('DEBUG: Parsed item:', itemName, itemQty, itemCalories, 'from line:', line);
            console.log('DEBUG: Raw calories text:', itemMatch[3], 'Parsed calories:', itemCalories);
            console.log('DEBUG: Current meal type:', currentMealType, 'Current day:', currentDay);
            const description = itemQty ? `${itemName} - ${itemQty}` : itemName;

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

          // Handle Total Daily Calories line
          const totalCaloriesMatch = line.match(/Total Daily Calories:\s*(\d+)\s*(?:kcal|calories?|cal)/i);
          if (totalCaloriesMatch && currentDay && currentDay <= 7) {
            // We don't need to do anything special here since we're already tracking meal calories
            console.log(`Found total calories for day ${currentDay}: ${totalCaloriesMatch[1]}`);
          }
        });

        return hasChanges ? updatedMealPlans : prevMealPlans;
      });
    } else if (type === 'workout') {
      // Enhanced regex pattern to properly extract workout plan and stop before recommendations/suggestions
      const workoutPlanMatch = response.match(/WORKOUT_PLAN:([\s\S]*?)(?=\b(?:END-OF-PLAN[\s-]?SUGGESTION|END-OF-PLAN SUGG|END-OF-PLAN|END-OF|END OF)\b[:]?|\b(?:Follow this plan consistently|Closing Recommendation|To achieve your goal|To effectively)\b[:]?|\b(?:RECOMMENDATION|SUGGESTION|CLOSING|FINAL NOTE|FINAL SUGGESTION|FINAL RECOMMENDATION)\b[:]|$)/i);

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
          // Skip if this line is just "END-OF" or similar
          if (line.trim().toUpperCase() === 'END-OF' || line.trim().toUpperCase() === 'END OF') {
            console.log(`Skipping END-OF line: "${line}"`);
            return;
          }

          // Preprocess line to fix common OCR issues
          line = line
            .replace(/(\d+)\s*x\s*(\d+)/g, '$1 × $2') // Only convert x to × when between numbers (multiplication)
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
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

          // Handle potential OCR line breaks and continuation lines
          // Check if this line might be a continuation of the previous exercise
          if (currentWorkoutDay && line.trim() && !line.match(/^Day\s*\d+/i) && !line.match(/^\d+\s*[.)]/)) {
            const dayData = updatedWorkoutSections.find(day => day.dayNumber === currentWorkoutDay);
            if (dayData && dayData.exercises.length > 0) {
              const lastExercise = dayData.exercises[dayData.exercises.length - 1];
              const currentLine = line.trim();

              // Check if this line looks like it should be appended to the last exercise
              // (e.g., sets/reps that got split to a new line)
              if (currentLine.match(/^\d+\s*[x×]\s*\d+/) || // Sets x reps format
                currentLine.match(/^\d+\s*[-–—]\s*\d+/) || // Sets - reps format
                currentLine.match(/per\s+side/i) || // "per side" text
                currentLine.match(/^\d+\s*reps?/i) || // Just reps
                currentLine.match(/^\d+\s*sets?/i)) { // Just sets

                // Append to the last exercise
                lastExercise.description += ' ' + currentLine;
                hasChanges = true;
                console.log(`Appended continuation to exercise ${lastExercise.number}: ${currentLine}`);
                return;
              }
            }
          }

          // Handle orphaned numbers (like "5" appearing alone before "Dumbbell Shrugs")
          // Skip lines that are just a single number without context
          if (line.trim().match(/^\d+$/) && line.trim().length <= 2) {
            console.log(`Skipping orphaned number: "${line.trim()}"`);
            return;
          }

          // Parse exercises using improved number-based approach with better OCR handling
          // Handle various formats: "1. Exercise", "1 Exercise", "1) Exercise", etc.
          const exerciseNumberMatch = line.match(/^(\d+)\s*[.)]\s*(.*)/) ||
            line.match(/^(\d+)\s+(.*)/) ||
            line.match(/^(\d+)\s*[-–—]\s*(.*)/);

          if (currentWorkoutDay && exerciseNumberMatch) {
            const exerciseNumber = parseInt(exerciseNumberMatch[1]);
            let exerciseText = exerciseNumberMatch[2].trim();

            // Clean up common OCR issues
            exerciseText = exerciseText
              .replace(/(\d+)\s*x\s*(\d+)/g, '$1 × $2') // Only convert x to × when between numbers (multiplication)
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim();

            // Only convert dashes to regular hyphen if they appear to be separators (not part of exercise name)
            // Look for patterns like "Exercise Name - 4 x 8" or "Exercise Name — 4 x 8"
            if (exerciseText.match(/\s+[-–—]\s+\d+\s*[x×]/)) {
              exerciseText = exerciseText.replace(/\s+[-–—]\s+/, ' - ');
            }

            console.log(`Found exercise ${exerciseNumber}: "${exerciseText}"`);

            // Skip if exercise is too short or incomplete (likely streaming artifact)
            if (exerciseText.length < 3) {
              console.log(`Skipping incomplete exercise: "${exerciseText}"`);
              return;
            }

            // Skip if this looks like a day header or recommendation content
            if (exerciseText.toLowerCase().includes('day') && exerciseText.length < 20) {
              console.log(`Skipping day header: "${exerciseText}"`);
              return;
            }

            // Skip if this is just "END-" or similar end markers
            if (exerciseText.match(/^END[-–—]?$/i) || exerciseText.match(/^END\s*$/i)) {
              console.log(`Skipping end marker: "${exerciseText}"`);
              return;
            }

            // Skip suggestion content like "Follow", "Follow this", etc.
            if (exerciseText.match(/^Follow(\s+this)?\s*$/i) ||
              exerciseText.match(/^Follow(\s+this)?\s*plan/i) ||
              exerciseText.match(/^Remember\s+to/i) ||
              exerciseText.match(/^Make\s+sure\s+to/i) ||
              exerciseText.match(/^Don't\s+forget\s+to/i)) {
              console.log(`Skipping suggestion content: "${exerciseText}"`);
              return;
            }

            // Check if this is a new exercise number (not seen before)
            const dayData = updatedWorkoutSections.find(day => day.dayNumber === currentWorkoutDay);
            if (dayData) {
              // Skip if this is END-OF or recommendation content
              if (isRecommendationContent(exerciseText) || exerciseText.trim().toUpperCase() === 'END-OF') {
                console.log(`Skipping END-OF/recommendation content: "${exerciseText}"`);
                return;
              }

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

          // Fallback: handle exercises without numbers (plain text) with improved OCR handling
          if (currentWorkoutDay && /^[A-Za-z]/.test(line) && !line.match(/^Day\s*\d+/i)) {
            let exercise = line.trim();

            // Clean up common OCR issues in plain text exercises
            exercise = exercise
              .replace(/(\d+)\s*x\s*(\d+)/g, '$1 × $2') // Only convert x to × when between numbers (multiplication)
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim();

            // Only convert dashes to regular hyphen if they appear to be separators (not part of exercise name)
            // Look for patterns like "Exercise Name - 4 x 8" or "Exercise Name — 4 x 8"
            if (exercise.match(/\s+[-–—]\s+\d+\s*[x×]/)) {
              exercise = exercise.replace(/\s+[-–—]\s+/, ' - ');
            }

            console.log(`Processing plain text exercise: "${exercise}"`);

            // Skip if exercise is too short or incomplete
            if (exercise.length < 3) {
              console.log(`Skipping incomplete exercise: "${exercise}"`);
              return;
            }

            // Skip if this looks like a day header
            if (exercise.toLowerCase().includes('day') && exercise.length < 20) {
              console.log(`Skipping day header: "${exercise}"`);
              return;
            }

            // Skip if this is just "END-" or similar end markers
            if (exercise.match(/^END[-–—]?$/i) || exercise.match(/^END\s*$/i)) {
              console.log(`Skipping end marker: "${exercise}"`);
              return;
            }

            // Skip suggestion content like "Follow", "Follow this", etc.
            if (exercise.match(/^Follow(\s+this)?\s*$/i) ||
              exercise.match(/^Follow(\s+this)?\s*plan/i) ||
              exercise.match(/^Remember\s+to/i) ||
              exercise.match(/^Make\s+sure\s+to/i) ||
              exercise.match(/^Don't\s+forget\s+to/i)) {
              console.log(`Skipping suggestion content: "${exercise}"`);
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
              // Skip if this is END-OF or recommendation content
              if (isRecommendationContent(exercise) || exercise.trim().toUpperCase() === 'END-OF') {
                console.log(`Skipping END-OF/recommendation content: "${exercise}"`);
                return;
              }

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

  // Parse original streaming response to get accurate calorie values
  const parseOriginalResponse = (originalResponse) => {
    if (!originalResponse) return;

    console.log('DEBUG: Parsing original response for accurate calories');

    // Extract meal plan from original response
    const mealPlanMatch = originalResponse.match(/MEAL_PLAN:([\s\S]*?)(?=WORKOUT_PLAN:|$)/i);
    if (!mealPlanMatch) return;

    const mealPlanRaw = mealPlanMatch[1].trim();
    const mealPlanLines = mealPlanRaw.split('\n').map(line => line.trim()).filter(Boolean);

    let currentDay = null;
    let currentMealType = null;
    let currentMealItems = [];
    let updatedMealPlans = [...mealPlansByDay];

    mealPlanLines.forEach((line, index) => {
      // Check for day headers
      const dayMatch = line.match(/Day\s+(\d+):/i);
      if (dayMatch) {
        const dayNumber = parseInt(dayMatch[1]);
        // Only process days 1-7
        if (dayNumber >= 1 && dayNumber <= 7) {
          currentDay = dayNumber;
          currentMealType = null;
          currentMealItems = [];

          console.log(`DEBUG: Found Day ${currentDay} in original response`);

          // Ensure day exists in meal plans
          if (!updatedMealPlans.find(day => day.dayNumber === currentDay)) {
            updatedMealPlans.push({
              dayNumber: currentDay,
              meals: []
            });
          }
        } else {
          console.log(`DEBUG: Skipping Day ${dayNumber} (not in range 1-7) in original response`);
        }
        return;
      }

      // Check for meal type headers
      const mealTypeMatch = line.match(/(Breakfast|Lunch|Snack|Dinner)\s*\((\d+)\s*kcal\):/i);
      if (mealTypeMatch && currentDay && currentDay <= 7) {
        currentMealType = mealTypeMatch[1];
        const mealCalories = parseInt(mealTypeMatch[2]);

        // Find or create the day
        let dayData = updatedMealPlans.find(day => day.dayNumber === currentDay);
        if (!dayData) {
          dayData = { dayNumber: currentDay, meals: [] };
          updatedMealPlans.push(dayData);
        }

        // Find or create the meal
        let mealData = dayData.meals.find(m => m.type === currentMealType);
        if (!mealData) {
          mealData = {
            type: currentMealType,
            items: [],
            totalCalories: mealCalories // Use backend's exact stated meal total
          };
          dayData.meals.push(mealData);
        } else {
          mealData.totalCalories = mealCalories; // Use backend's exact stated meal total
        }

        console.log(`DEBUG: Set ${currentMealType} total calories to ${mealCalories} for Day ${currentDay}`);

        currentMealItems = mealData.items;
        return;
      }

      // Parse meal items with original calorie values - handle complex patterns and malformed lines
      const itemMatch = line.match(/^\d+\.\s*(.*?)\s*[-–—]\s*(.*?)\s*[-–—]\s*(.*?)(?:\s*kcal)?$/i);
      if (itemMatch && currentDay && currentMealType && currentDay <= 7) {
        const itemName = itemMatch[1].trim();
        const itemQty = itemMatch[2].trim();
        const caloriesText = itemMatch[3].trim();

        // Handle multiple calorie values (e.g., "87 + 68" or "216 + 11")
        let itemCalories = 0;
        if (caloriesText.includes('+')) {
          // Sum multiple calorie values
          const calorieParts = caloriesText.split('+').map(part => parseInt(part.trim()) || 0);
          itemCalories = calorieParts.reduce((sum, cal) => sum + cal, 0);
        } else {
          // Single calorie value - extract number even if "kcal" is missing
          const numberMatch = caloriesText.match(/(\d+)/);
          itemCalories = numberMatch ? parseInt(numberMatch[1]) : 0;
        }

        console.log('DEBUG: Original parse item:', itemName, itemQty, itemCalories, 'from line:', line);

        const description = itemQty ? `${itemName} - ${itemQty}` : itemName;

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
              console.log(`DEBUG: Added item to ${currentMealType}:`, description, itemCalories, 'kcal');
            } else {
              console.log(`DEBUG: Item already exists in ${currentMealType}:`, description, itemCalories, 'kcal');
            }
          }
        }
      }
    });

    // Update the meal plans with original calorie values
    setMealPlansByDay(updatedMealPlans);
    console.log('DEBUG: Updated meal plans with original calorie values');
    console.log('DEBUG: Final meal plans:', updatedMealPlans);

    // Debug meal totals
    updatedMealPlans.forEach(day => {
      console.log(`DEBUG: Day ${day.dayNumber} meal totals:`);
      day.meals.forEach(meal => {
        console.log(`  ${meal.type}: ${meal.totalCalories} kcal (${meal.items.length} items)`);
      });
    });
  };

  const parseResponse = (response) => {
    let cleanedResponse = formatResponse(response);

    console.log('Cleaned response for parsing:', cleanedResponse);

    // Extract end-of-plan suggestion first, but don't remove it yet
    // Enhanced patterns to catch meal plan suggestions more comprehensively
    let suggestionMatch = cleanedResponse.match(/END-OF-PLAN[\s-]?SUGGESTION:?\s*([\s\S]*)$/i) ||
      cleanedResponse.match(/\*\*End-of-Plan Suggestion:\*\*\s*([\s\S]*)$/i) ||
      cleanedResponse.match(/\*\*Recommendation:\*\*\s*([\s\S]*)$/i) ||
      cleanedResponse.match(/\*\*Meal Plan Recommendation:\*\*\s*([\s\S]*)$/i) ||
      cleanedResponse.match(/MEAL[\s-]?PLAN[\s-]?SUGGESTION:?\s*([\s\S]*)$/i) ||
      cleanedResponse.match(/MEAL[\s-]?PLAN[\s-]?RECOMMENDATION:?\s*([\s\S]*)$/i) ||
      cleanedResponse.match(/DIET[\s-]?RECOMMENDATION:?\s*([\s\S]*)$/i) ||
      cleanedResponse.match(/NUTRITION[\s-]?ADVICE:?\s*([\s\S]*)$/i) ||
      cleanedResponse.match(/FOOD[\s-]?GUIDANCE:?\s*([\s\S]*)$/i);
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
    if (!suggestionMatch) {
      // Additional patterns for meal plan specific suggestions
      suggestionMatch = cleanedResponse.match(/For[\s-]?your[\s-]?meal[\s-]?plan([\s\S]*)$/i) ||
        cleanedResponse.match(/Based[\s-]?on[\s-]?your[\s-]?profile([\s\S]*)$/i) ||
        cleanedResponse.match(/Your[\s-]?nutrition[\s-]?plan([\s\S]*)$/i) ||
        cleanedResponse.match(/Dietary[\s-]?Guidance([\s\S]*)$/i) ||
        cleanedResponse.match(/Nutritional[\s-]?Advice([\s\S]*)$/i);
    }

    if (suggestionMatch) {
      const extractedSuggestion = suggestionMatch[1].trim();
      console.log('DEBUG: Extracted suggestion from backend:', extractedSuggestion);
      setEndOfPlanSuggestion(extractedSuggestion);
      // Suggestions will be auto-opened by useEffect when first available
      console.log('DEBUG: Set endOfPlanSuggestion from parseResponse and opened accordion');
      console.log('DEBUG: Meal plan suggestion set to:', extractedSuggestion);
    } else {
      console.log('DEBUG: No suggestion found, using fallback');
      setEndOfPlanSuggestion('Follow this plan consistently to achieve your desired results.');
    }

    const mealPlanMatch = cleanedResponse.match(/MEAL_PLAN:([\s\S]*?)(?=WORKOUT_PLAN:|$)/i);

    // Enhanced regex pattern to properly extract workout plan and stop before recommendations/suggestions
    let workoutPlanMatch = cleanedResponse.match(/WORKOUT_PLAN:([\s\S]*?)(?=\b(?:END-OF-PLAN[\s-]?SUGGESTION|END-OF-PLAN SUGG|END-OF-PLAN|END-OF|END OF)\b[:]?|\b(?:Follow this plan consistently|Closing Recommendation|To achieve your goal|To effectively)\b[:]?|\b(?:RECOMMENDATION|SUGGESTION|CLOSING|FINAL NOTE|FINAL SUGGESTION|FINAL RECOMMENDATION)\b[:]|$)/i);

    if (!workoutPlanMatch) {
      console.log('Trying alternate workout plan pattern');
      workoutPlanMatch = cleanedResponse.match(/(?:WORKOUT|EXERCISE)[\s_]*PLAN:?([\s\S]*?)(?=\b(?:END-OF-PLAN[\s-]?SUGGESTION|END-OF-PLAN SUGG|END-OF-PLAN|END-OF|END OF)\b[:]?|\b(?:Follow this plan consistently|Closing Recommendation|To achieve your goal|To effectively)\b[:]?|\b(?:RECOMMENDATION|SUGGESTION|CLOSING|FINAL NOTE|FINAL SUGGESTION|FINAL RECOMMENDATION)\b[:]|$)/i);
    }

    // Additional safeguard: if we still have issues, try to find the workout content by looking for day patterns
    if (!workoutPlanMatch) {
      console.log('Attempting to extract workout content by day patterns');
      const workoutSectionMatch = cleanedResponse.match(/(WORKOUT_PLAN:|EXERCISE_PLAN:|###\s*Workout.*?)[\s\S]*?(?=\b(?:END-OF-PLAN[\s-]?SUGGESTION|END-OF-PLAN SUGG|END-OF-PLAN|END-OF|END OF)\b[:]?|\b(?:Follow this plan consistently|Closing Recommendation|To achieve your goal|To effectively)\b[:]?|\b(?:RECOMMENDATION|SUGGESTION|CLOSING|FINAL NOTE|FINAL SUGGESTION|FINAL RECOMMENDATION)\b[:]|$)/i);
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
              // Add totalCalories field to distinguish from calculated calories
              mealPlansByDay[dayIndex].meals[mealIndex].totalCalories = calories;
            }
          }
        }
        return;
      }

      // Parse meal items with improved regex to handle the exact format from backend
      // Format: "  1. Oats (dry) — 60g — 234 kcal"
      const itemMatch = line.match(/^\s*\d+\.\s*(.*?)\s*[-–—]\s*(.*?)\s*[-–—]\s*(\d+)\s*(?:kcal|calories?|cal)\s*$/i);
      if (itemMatch) {
        const itemName = cleanItemText(itemMatch[1]);
        const itemQty = itemMatch[2].trim();
        const itemCalories = parseInt(itemMatch[3]) || 0;

        console.log('DEBUG: Final parse item:', itemName, itemQty, itemCalories, 'from line:', line);
        const description = itemQty ? `${itemName} - ${itemQty}` : itemName;

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
    // No fallback meal generation - only use exact backend data

    // Process workout plan - create only days with actual workouts
    const workoutSections = [];

    // We'll populate workout sections as we parse them, rather than pre-creating all 7 days
    // This prevents unnecessary rest days from being added

    let currentWorkoutDay = null;
    let currentWorkoutType = null;
    let currentExercises = [];

    if (extractedWorkoutContent) {
      const workoutPlanLines = extractedWorkoutContent.split('\n').map(line => line.trim()).filter(Boolean);
      let isProcessingWorkout = false;

      // Filter out any recommendation text that might have slipped through
      const filteredWorkoutLines = workoutPlanLines.filter(line =>
        !line.match(/Follow this plan|consistently.*achieve|END-OF-PLAN[\s-]?SUGGESTION|END-OF-PLAN SUGG|END-OF-PLAN|END-OF|END OF|end-of|end of|Closing Recommendation|To achieve your goal|To effectively|SUGGESTION|SUGGEST|RECOMMENDATION|RECOMMEND|CLOSING|CLOSE|FINAL|FINAL NOTE|FINAL SUGGESTION|FINAL RECOMMENDATION/i)
      );

      filteredWorkoutLines.forEach((line, index) => {
        console.log(`Processing workout line ${index}: ${line}`);

        // Skip if this line is just "END-OF" or similar
        if (line.trim().toUpperCase() === 'END-OF' || line.trim().toUpperCase() === 'END OF') {
          console.log(`Skipping END-OF line: "${line}"`);
          return;
        }

        // Check for exclusion messages like "Day 5:, 6, and 7 are not included"
        const exclusionMatch = line.match(/Day\s*(\d+)[:,]\s*(\d+),\s*and\s*(\d+)\s*are\s*not\s*included/i);
        if (exclusionMatch) {
          const day1 = parseInt(exclusionMatch[1]);
          const day2 = parseInt(exclusionMatch[2]);
          const day3 = parseInt(exclusionMatch[3]);

          // Set these days as Rest Day
          [day1, day2, day3].forEach(dayNum => {
            if (dayNum >= 1 && dayNum <= 7) {
              let section = workoutSections.find(s => s.dayNumber === dayNum);
              if (!section) {
                section = {
                  dayNumber: dayNum,
                  workoutType: 'Rest Day',
                  exercises: []
                };
                workoutSections.push(section);
              } else {
                section.workoutType = 'Rest Day';
                section.exercises = [];
              }
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
            let section = workoutSections.find(s => s.dayNumber === dayNum);
            if (!section) {
              section = {
                dayNumber: dayNum,
                workoutType: 'Rest Day',
                exercises: []
              };
              workoutSections.push(section);
            } else {
              section.workoutType = 'Rest Day';
              section.exercises = [];
            }
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
            const section = workoutSections.find(s => s.dayNumber === currentWorkoutDay);
            if (section) {
              section.exercises = currentExercises;
              section.workoutType = currentWorkoutType;
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
            let section = workoutSections.find(s => s.dayNumber === currentWorkoutDay);
            if (!section) {
              section = {
                dayNumber: currentWorkoutDay,
                workoutType: currentWorkoutType,
                exercises: []
              };
              workoutSections.push(section);
            } else {
              section.workoutType = currentWorkoutType;
            }
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
                  // Skip if this is END-OF or recommendation content
                  if (isRecommendationContent(exercise) || exercise.trim().toUpperCase() === 'END-OF') {
                    console.log(`Skipping END-OF/recommendation content: "${exercise}"`);
                    return;
                  }

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
        let section = workoutSections.find(s => s.dayNumber === currentWorkoutDay);
        if (!section) {
          section = {
            dayNumber: currentWorkoutDay,
            workoutType: currentWorkoutType || 'Training Day',
            exercises: currentExercises
          };
          workoutSections.push(section);
        } else {
          section.exercises = currentExercises;
          section.workoutType = currentWorkoutType;
        }
      }
    }

    // Ensure rest days are properly handled and remove empty rest days
    workoutSections.forEach(section => {
      if (section.workoutType.toLowerCase().includes('rest') ||
        section.workoutType.toLowerCase().includes('recovery') ||
        section.workoutType.toLowerCase().includes('off')) {
        section.exercises = [];
        section.workoutType = 'Rest Day';
      } else if (section.exercises.length === 0) {
        // If no exercises are scheduled and it's not explicitly a rest day,
        // we should remove this section rather than mark it as a rest day
        section.shouldRemove = true;
      } else {
        section.exercises.forEach((exercise, idx) => {
          exercise.number = idx + 1;
        });
      }
    });

    // Remove sections marked for removal
    const filteredWorkoutSections = workoutSections.filter(section => !section.shouldRemove);

    // Only add rest days if specifically requested or if there are gaps in the workout schedule
    // For now, we'll just use the filtered sections without adding extra rest days

    console.log('Processed meal plans:', mealPlansByDay);
    console.log('Processed workouts:', filteredWorkoutSections);

    // Update state with filtered workout sections
    setWorkoutSections(filteredWorkoutSections);

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
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Check if user has complete profile data
          if (userData.age && userData.gender && userData.height && userData.weight && userData.activityLevel) {
            // User has profile - show "use profile" popup unless explicitly bypassed
            if (!bypassProfileCheck) {
              setUserProfileData(userData);
              setShowProfileChoicePopup(true);
              return;
            }
            // If bypassed, we still want to set the user profile data for later use
            setUserProfileData(userData);
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
      heightUnit: extractedData.heightUnit || 'cm',
      currentWeight: extractedData.weight || '',
      currentWeightUnit: extractedData.weightUnit || 'kg',
      targetWeight: extractedData.targetWeight?.value || extractedData.weight || '',
      targetWeightUnit: extractedData.targetWeightUnit || extractedData.weightUnit || 'kg',
      activityLevel: extractedData.activityLevel || 'moderate',
      targetTimeline: extractedData.timelineWeeks ? Math.floor(extractedData.timelineWeeks / 4) : '3',
      workoutDays: extractedData.frequency || '5',
      goal: extractedData.goal || fitnessGoal || ''
    });

    // Check if we have enough data to calculate calories
    if (extractedData.age && extractedData.gender && extractedData.height && extractedData.weight && extractedData.activityLevel) {
      // Validate weight values - check if current weight equals target weight
      const currentWeight = extractedData.weight;
      const targetWeight = extractedData.targetWeight?.value || extractedData.weight;
      const weightValidation = validateWeightValues(currentWeight, targetWeight);


      // Calculate calories immediately
      setIsLoading(true);
      await submitNaturalLanguageData(extractedData, prompt);
    } else {
      // Not enough data, show detailed error with specific missing fields
      const validation = validateProfileData(extractedData, fitnessGoal);
      setValidationError(validation.message);
    }
  };

  // Extract the natural language submission logic into a separate function
  const submitNaturalLanguageData = async (extractedData, prompt) => {
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
        errorMessage += 'Make sure the backend server is running';
      } else {
        errorMessage += 'Please try again.';
      }
      setSuccessMessage(errorMessage);
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 5000);
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
      !formData.activityLevel || formData.activityLevel === '' || !formData.workoutDays || !formData.timeframe) {
      setSuccessMessage('Please fill in all required fields.');
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);
      return;
    }

    // Validate weight values - check if current weight equals target weight

    // Calculate calories first - copy exact logic from handleNaturalLanguageInput
    setIsLoading(true);
    await submitFormData();
  };

  // Extract the actual form submission logic into a separate function
  const submitFormData = async () => {

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
        heightUnit: formData.heightUnit || 'cm',
        currentWeight: formData.currentWeight,
        currentWeightUnit: formData.currentWeightUnit || 'kg',
        targetWeight: formData.targetWeight,
        targetWeightUnit: formData.targetWeightUnit || 'kg',
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
        errorMessage += 'Make sure the backend server is running';
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

  // Removed estimateCalories function - only use exact backend values

  // Simple function to sum meal totals (only for display when backend total is missing)
  const calculateDailyCalories = (meals) => {
    if (!meals || meals.length === 0) return 0;
    return meals.reduce((sum, meal) => {
      // Use backend's stated meal total, not calculated total
      return sum + (meal.totalCalories || meal.calories || 0);
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

  const PlanPDFDocument = ({ fitnessGoal, mealPlansByDay, workoutSections, endOfPlanSuggestion, workoutPlanSuggestion }) => (
    <Document>
      <Page size={{ width: 600, height: 2000 }} style={pdfStyles.body}>
        {/* EleFit Logo */}
        <Image
          style={pdfStyles.logo}
          src="/elefit.jpg"
        />
        {/* AI Fitness Plan Title */}
        <Text style={pdfStyles.mainTitle}>AI Fitness Plan</Text>
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
                <Text style={{ ...pdfStyles.tableCellLast, ...pdfStyles.caloriesHeader }}>Calories</Text>
              </View>
              {day.meals.map((meal, j) => (
                <View key={j} style={[pdfStyles.tableRow, j % 2 === 0 ? pdfStyles.tableRowEven : pdfStyles.tableRowOdd]}>
                  <Text style={{ ...pdfStyles.tableCell, ...pdfStyles.mealTypeCell }}>{meal.type}</Text>
                  <View style={{ ...pdfStyles.tableCell, ...pdfStyles.mealItemsCell }}>
                    {meal.items.map((item, k) => (
                      <Text key={k} style={pdfStyles.mealItem}>- {item.description} ({item.calories} kcal)</Text>
                    ))}
                  </View>
                  <Text style={{ ...pdfStyles.tableCellLast, ...pdfStyles.caloriesCell }}>{meal.totalCalories || meal.calories}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        {/* Only show Workout Plan section if there are workout sections with exercises */}
        {workoutSections && workoutSections.some(section => section.exercises && section.exercises.length > 0) && (
          <>
            <Text style={pdfStyles.sectionTitle}>Workout Plan</Text>
            {workoutSections
              .filter(section => section.workoutType !== 'Rest Day' || section.exercises.length > 0)
              .map((section, i) => (
                <View key={i} style={pdfStyles.daySection}>
                  <Text style={pdfStyles.dayTitle}>Day {section.dayNumber}: {section.workoutType}</Text>
                  {section.workoutType === 'Rest Day' && section.exercises.length === 0 ? (
                    <Text style={pdfStyles.text}>Rest Day - No exercises scheduled</Text>
                  ) : (
                    <View>
                      {section.exercises.map((ex, j) => (
                        <Text key={j} style={pdfStyles.text}>{j + 1}. {ex.description}</Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
          </>
        )}
        {/* Show Personalized Suggestions section with both Meal Plan Focus and Workout Plan Focus */}
        {(mealPlansByDay && mealPlansByDay.length > 0 && endOfPlanSuggestion && endOfPlanSuggestion.trim() !== '') ||
          (workoutSections && workoutSections.some(section => section.exercises && section.exercises.length > 0) && workoutPlanSuggestion && workoutPlanSuggestion.trim() !== '') ? (
          <>
            <Text style={pdfStyles.sectionTitle}>Personalized Suggestions</Text>
            {/* Show Meal Plan Focus section if meal plan exists */}
            {mealPlansByDay && mealPlansByDay.length > 0 && endOfPlanSuggestion && endOfPlanSuggestion.trim() !== '' && (
              <>
                <Text style={pdfStyles.subSectionTitle}>Meal Plan Focus</Text>
                <Text style={pdfStyles.text}>{endOfPlanSuggestion}</Text>
              </>
            )}
            {/* Show Workout Plan Focus section if workout plan exists */}
            {workoutSections && workoutSections.some(section => section.exercises && section.exercises.length > 0) && workoutPlanSuggestion && workoutPlanSuggestion.trim() !== '' && (
              <>
                <Text style={pdfStyles.subSectionTitle}>Workout Plan Focus</Text>
                <Text style={pdfStyles.text}>{workoutPlanSuggestion}</Text>
              </>
            )}
          </>
        ) : (
          /* Fallback to generic Recommendation section if no specific suggestions */
          (endOfPlanSuggestion || workoutPlanSuggestion) && (
            <>
              <Text style={pdfStyles.sectionTitle}>Recommendation</Text>
              <Text style={pdfStyles.text}>{endOfPlanSuggestion || workoutPlanSuggestion}</Text>
            </>
          )
        )}
      </Page>
    </Document>
  );

  const pdfStyles = StyleSheet.create({
    body: {
      padding: 24,
      fontSize: 12,
      fontFamily: 'Helvetica',
      backgroundColor: '#FFFFFF', // White background
      // Prevent page breaks by allowing content to flow
    },
    logo: {
      width: 200,
      height: 130,
      alignSelf: 'center'
    },
    mainTitle: {
      fontSize: 24,
      marginBottom: 20,
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#4E3580' // Purple
    },
    sectionTitle: {
      fontSize: 18,
      marginTop: 20,
      marginBottom: 12,
      fontWeight: 'bold',
      color: '#4E3580', // Purple
      backgroundColor: 'rgba(78, 53, 128, 0.1)', // Light purple background
      padding: 8,
      borderRadius: 4
    },
    subSectionTitle: {
      fontSize: 16,
      marginTop: 15,
      marginBottom: 8,
      fontWeight: 'bold',
      color: '#4E3580', // Purple
      fontStyle: 'italic'
    },
    daySection: {
      marginBottom: 18,
      // Remove breakInside to allow content to flow
    },
    dayTitle: {
      fontSize: 16,
      marginBottom: 10,
      fontWeight: 'bold',
      color: '#4E3580' // Purple
    },
    text: {
      marginBottom: 8,
      color: '#000000' // Black text
    },
    table: {
      display: 'table',
      width: '100%',
      marginBottom: 12,
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: '#4E3580', // Purple border
      // Remove breakInside to allow content to flow
      // Use fixed table layout for consistent column widths
      tableLayout: 'fixed'
    },
    tableRow: {
      flexDirection: 'row'
    },
    tableCol: {
      width: '50%',
      padding: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: '#4E3580' // Purple border
    },
    tableHeader: {
      backgroundColor: '#4E3580', // Purple background
      color: '#FFFFFF' // White text
    },
    tableFooter: {
      backgroundColor: '#4E3580', // Purple background
      color: '#FFFFFF' // White text
    },
    tableFooterText: {
      textAlign: 'right'
    },
    signature: {
      marginTop: 20,
      marginBottom: 20,
      textAlign: 'center',
      color: '#4E3580' // Purple
    },
    signatureLine: {
      width: '100%',
      height: 1,
      backgroundColor: '#4E3580' // Purple
    },
    tableRowHeader: {
      flexDirection: 'row',
      backgroundColor: '#4E3580', // Purple header
      color: 'white',
      borderBottomWidth: 1,
      borderBottomColor: '#C8DA2B', // Lime green border
      borderBottomStyle: 'solid',
      // Ensure consistent row header height
      minHeight: 30,
      // Remove right border for single column header
      borderRightWidth: 0,
      // Ensure consistent vertical alignment
      alignItems: 'center'
    },
    tableRow: {
      flexDirection: 'row',
      minHeight: 25,
      alignItems: 'stretch', // Changed from flex-start to stretch for better alignment
      // Ensure rows maintain consistent height
      flexGrow: 0,
      flexShrink: 0,
      // Prevent wrapping
      flexWrap: 'nowrap',
      // Ensure consistent vertical alignment
      justifyContent: 'flex-start'
    },
    tableRowEven: {
      backgroundColor: 'rgba(200, 218, 43, 0.1)' // Light lime green background
    },
    tableRowOdd: {
      backgroundColor: 'rgba(78, 53, 128, 0.05)' // Very light purple background
    },
    tableCell: {
      flex: 1,
      padding: 6,
      fontSize: 11,
      borderRightWidth: 1,
      borderRightColor: '#4E3580', // Purple border
      borderRightStyle: 'solid',
      borderBottomWidth: 1, // Add bottom border for consistent cell borders
      borderBottomColor: '#4E3580', // Purple border
      borderBottomStyle: 'solid',
      color: '#000000', // Black text
      textAlign: 'left', // Ensure consistent text alignment
      // Fix for column line breaking - ensure consistent height
      minHeight: 25,
      // Ensure cells stretch to fill available height
      flexGrow: 1,
      flexShrink: 1,
      // Prevent text wrapping issues
      whiteSpace: 'nowrap',
      // Ensure consistent vertical alignment
      alignItems: 'flex-start'
    },
    // Remove the last border on the rightmost cell to prevent double borders
    tableCellLast: {
      flex: 1,
      padding: 6,
      fontSize: 11,
      color: '#000000', // Black text
      textAlign: 'left', // Ensure consistent text alignment
      minHeight: 25,
      borderBottomWidth: 1, // Add bottom border for consistent cell borders
      borderBottomColor: '#4E3580', // Purple border
      borderBottomStyle: 'solid',
      // Remove right border for the last cell
      borderRightWidth: 0,
      // Ensure cells stretch to fill available height
      flexGrow: 1,
      flexShrink: 1,
      // Prevent text wrapping issues
      whiteSpace: 'nowrap',
      // Ensure consistent vertical alignment
      alignItems: 'flex-start'
    },
    mealTypeHeader: {
      fontWeight: 'bold',
      backgroundColor: '#C8DA2B', // Lime green
      color: '#000000', // Black text
      // Fixed width for consistent column alignment
      width: '20%',
      // Ensure consistent text alignment
      textAlign: 'center'
    },
    mealItemsHeader: {
      fontWeight: 'bold',
      backgroundColor: '#4E3580', // Purple
      color: '#FFFFFF', // White text
      // Fixed width for consistent column alignment
      width: '60%',
      // Ensure consistent text alignment
      textAlign: 'center'
    },
    caloriesHeader: {
      fontWeight: 'bold',
      backgroundColor: '#C8DA2B', // Lime green (consistent with brand)
      color: '#000000', // Black text
      // Fixed width for consistent column alignment
      width: '20%',
      // Remove right border for the last header cell
      borderRightWidth: 0,
      // Ensure consistent text alignment
      textAlign: 'center'
    },
    mealTypeCell: {
      color: '#4E3580', // Purple
      fontWeight: 'bold',
      // Fixed width for consistent column alignment
      width: '20%',
      // Ensure consistent text alignment
      textAlign: 'center'
    },
    mealItemsCell: {
      color: '#000000', // Black text
      // Fixed width for consistent column alignment
      width: '60%',
      // Ensure consistent text alignment
      textAlign: 'left'
    },
    caloriesCell: {
      color: '#4E3580', // Purple (consistent with meal type)
      fontWeight: 'bold',
      textAlign: 'center',
      // Fixed width for consistent column alignment
      width: '20%'
    },
    mealItem: {
      fontSize: 10,
      marginBottom: 2,
      color: '#000000', // Black text
      // Allow text wrapping within meal items
      whiteSpace: 'normal',
      wordWrap: 'break-word'
    },
  });

  const mergePdfPagesVertically = async (pdfBytes) => {
    try {
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Get the number of pages
      const pageCount = pdfDoc.getPages().length;

      if (pageCount <= 1) {
        // If there's only one page, return the original PDF
        return pdfBytes;
      }

      // Create a new PDF document
      const newPdfDoc = await PDFDocument.create();

      // Set a standard width and calculate total height
      const standardWidth = 600;
      let totalHeight = 0;
      const pageHeights = [];

      // First pass: calculate total height
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPages()[i];
        const { width, height } = page.getSize();
        const scaledHeight = (height * standardWidth) / width;
        pageHeights.push(scaledHeight);
        totalHeight += scaledHeight;
      }

      // Create a new page with combined height
      const newPage = newPdfDoc.addPage([standardWidth, totalHeight]);

      // Second pass: embed and draw pages
      let currentY = totalHeight;
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPages()[i];
        const embeddedPage = await newPdfDoc.embedPage(page);
        const pageHeight = pageHeights[i];
        currentY -= pageHeight;

        // Draw the page
        newPage.drawPage(embeddedPage, {
          x: 0,
          y: currentY,
          xScale: standardWidth / page.getWidth(),
          yScale: standardWidth / page.getWidth(),
        });
      }

      // Save and return the new PDF
      const mergedPdfBytes = await newPdfDoc.save();
      return mergedPdfBytes;
    } catch (error) {
      console.error('Error merging PDF pages:', error);
      // Return original PDF if merging fails
      return pdfBytes;
    }
  };

  // Function to trigger PDF download with single page
  const downloadSinglePagePdf = async () => {
    try {
      // Create a Blob from the PDF document
      const pdfBlob = await PlanPDFDocument(
        fitnessGoal,
        mealPlansByDay,
        workoutSections,
        endOfPlanSuggestion
      ).toBlob();

      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'AI_Fitness_Plan_Single_Page.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating single page PDF:', error);
    }
  };

  // Old icon animation - now using video instead
  // useEffect(() => {
  //   if (isLoading) {
  //     console.log('Loading state changed to true, triggering animation');
  //     animateLoadingIcons();
  //   }
  // }, [isLoading]);

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

  // Auto-open suggestions accordion when suggestions are first available (but respect user's manual interaction)
  useEffect(() => {
    if (endOfPlanSuggestion && endOfPlanSuggestion.trim() !== '') {
      // Only auto-open if the user hasn't manually interacted with the accordion
      if (!userHasToggledAccordion) {
        setOpenSuggestionsAccordion(true);
        console.log('DEBUG: Auto-opening suggestions accordion for first time');
      } else {
        console.log('DEBUG: User has manually controlled accordion, not auto-opening');
      }
      console.log('DEBUG: Suggestions are available:', endOfPlanSuggestion.substring(0, 100) + '...');
    }
  }, [endOfPlanSuggestion, userHasToggledAccordion]);

  // Old icon animation function - no longer needed with video
  // const animateLoadingIcons = () => {
  //   const icons = document.querySelectorAll('.loader-icon');
  //   gsap.set(icons, { opacity: 1, y: 0, scale: 1, rotation: 0 });
  //
  //   const masterTimeline = gsap.timeline({ repeat: -1 });
  //
  //   icons.forEach((icon, index) => {
  //     const duration =  2;
  //     const delay = index * 0.2;
  //
  //     masterTimeline.to(icon, {
  //       keyframes: [
  //         { y: -15, scale: 1.1, rotation: 360, duration: duration/2, ease: "power1.inOut" },
  //         { y: 0, scale: 1, rotation: 360, duration: duration/2, ease: "power1.inOut" }
  //       ],
  //     }, delay);
  //   });
  //
  //   gsap.to('.loading-text', {
  //     scale: 1.05,
  //     duration: 1,
  //     repeat: -1,
  //     yoyo: true,
  //     ease: "power1.inOut"
  //   });
  //
  //   gsap.to('.loading-text', {
  //     backgroundPosition: '100% 50%',
  //     duration: 3,
  //     repeat: -1,
  //     yoyo: true,
  //     ease: "none"
  //   });
  // };

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
      {/* <button
        onClick={showTestPlans}
        style={{
          padding: '10px 20px',
          backgroundColor: '#7c3aed',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '20px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = '#6d28d9'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#7c3aed'}
      >
        Show Test Plans
      </button> */}
      <div className="input-section">
        {isActuallyLoggedIn() && (
          <div className="welcome-message" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              {(() => {
                const customerName = getCustomerName();
                return customerName ? `Welcome back, ${customerName}!` : null;
              })()}
            </div>
            {historySecure && (
              <button
                className="conversation-history-btn"
                onClick={() => setShowConversationHistory(!showConversationHistory)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#CDD954',
                  color: 'black',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  marginLeft: 'auto'
                }}
              >
                {showConversationHistory ? 'Hide' : 'Show'} History ({conversationHistory.length})
              </button>
            )}
          </div>
        )}
        {/* Input Wrapper with Generate Prompt Button Inside */}
        <div className="input-wrapper-with-button">
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
          {/* Generate Prompt Button - Inside the input */}
          <Tooltip
            title="Creates a personalized prompt using your profile information (age, weight, height, goals, etc.)"
            placement="top"
            arrow
          >
            <span>
              <button
                className={`generate-prompt-inline-button ${copyButtonClicked ? 'clicked' : ''}`}
                onClick={handleCopyDefaultPrompt}
                disabled={!!currentPopupGoal}
              >
                <i className={`fas ${copyButtonClicked ? 'fa-check' : 'fa-lightbulb'}`}></i>
              </button>
            </span>
          </Tooltip>
        </div>

        {/* Get Recommendations Button - Below the input */}
        <button
          className={`recommend-button-main ${currentPopupGoal ? 'disabled' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            handleRecommendation();
          }}
          disabled={!!currentPopupGoal}
          aria-disabled={!!currentPopupGoal}
        >
          <span className="button-text">GET RECOMMENDATIONS</span>
          <i className="fas fa-arrow-right button-icon"></i>
        </button>

        {inputError && (
          <div className="input-error-message">
            <i className="fas fa-exclamation-circle"></i> Please enter your fitness goal first
          </div>
        )}

        {validationError && (
          <div className="input-error-message">
            <i className="fas fa-exclamation-circle"></i> {validationError}
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
                          max="650"
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
                          max="650"
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
        <div className="loading-video-overlay">
          <div className="loading-video-container">
            <div className="loading-header">
              <CircularProgress
                size={20}
                thickness={4}
                sx={{ color: '#ffffff' }}
              />
              <p className="loading-title">Generating your plan</p>
            </div>
            <video
              className="loading-video"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src={require('../assets/loading-animation.mp4')} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}

      {/* Conversation History */}
      {historySecure && showConversationHistory && (
        <div className="conversation-history" style={{
          margin: '20px 0',
          padding: '20px',
          backgroundColor: '#4a4a4a',
          borderRadius: '8px',
          border: '1px solid #666666',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'right', marginBottom: '15px' }}>

            <button
              onClick={loadConversationHistory}
              disabled={isLoadingHistory}
              style={{
                padding: '6px 12px',
                backgroundColor: 'black',
                color: '#CDD954',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoadingHistory ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                opacity: isLoadingHistory ? 0.6 : 1
              }}
            >
              <i className={`fas ${isLoadingHistory ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} style={{ marginRight: '4px' }}></i>
              Refresh
            </button>
          </div>
          {isLoadingHistory ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'white' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '20px', color: '#6366f1' }}></i>
              <p style={{ marginTop: '10px', color: 'white' }}>Loading conversation history...</p>
            </div>
          ) : conversationHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'white' }}>
              <i className="fas fa-comments" style={{ fontSize: '24px', marginBottom: '10px', color: 'white' }}></i>
              <p style={{ color: 'white' }}>No conversation history yet. Start chatting with the AI Coach!</p>
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'white' }}>
                Debug: User ID: {user?.uid || 'No user'}, History count: {conversationHistory.length}
              </div>
              <button
                onClick={async () => {
                  console.log('Manually refreshing conversation history...');
                  await loadConversationHistory();
                }}
                style={{
                  marginTop: '10px',
                  padding: '6px 12px',
                  backgroundColor: '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                <i className="fas fa-sync-alt" style={{ marginRight: '4px' }}></i>
                Refresh History
              </button>
            </div>
          ) : (
            <div>
              {/* History table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                gap: '10px',
                padding: '10px',
                backgroundColor: 'black',
                borderRadius: '4px',
                fontWeight: 'bold',
                marginBottom: '10px',
                color: 'black'
              }}>
                <div style={{ color: '#CDD954' }}>Timestamp</div>
                <div style={{ color: '#CDD954' }}>Profile Used</div>
                <div style={{ color: '#CDD954' }}>Meal Plan</div>
                <div style={{ color: '#CDD954' }}>Workout Plan</div>
              </div>

              {/* History items in table format */}
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
                scrollbarColor: '#888888 #5a5a5a'
              }}>
                <style jsx>{`
                  div::-webkit-scrollbar {
                    width: 6px;
                  }
                  div::-webkit-scrollbar-track {
                    background: #5a5a5a;
                  }
                  div::-webkit-scrollbar-thumb {
                    background: #888888;
                    border-radius: 3px;
                  }
                  div::-webkit-scrollbar-thumb:hover {
                    background: #aaaaaa;
                  }
                `}</style>
                {conversationHistory.map((conversation, index) => (
                  <div
                    key={conversation.id}
                    onClick={() => {
                      // Show detailed view when clicking on a history item
                      setSelectedConversation(conversation);
                      setShowConversationDetail(true);
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      gap: '10px',
                      padding: '12px 10px',
                      backgroundColor: '#5a5a5a',
                      borderRadius: '4px',
                      border: '1px solid #777777',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      color: 'white'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6a6a6a'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5a5a5a'}
                  >
                    <div style={{ color: 'white' }}>
                      {formatTimestamp(conversation.timestamp)}
                    </div>
                    <div style={{ color: 'white', textAlign: 'center' }}>
                      {conversation.metadata?.profileOption === 'yes' ? 'Yes' : 'No'}
                    </div>
                    <div style={{ color: 'white', textAlign: 'center' }}>
                      {conversation.metadata?.planData?.hasMealPlan ? 'Yes' : 'No'}
                    </div>
                    <div style={{ color: 'white', textAlign: 'center' }}>
                      {(conversation.metadata?.planData?.hasWorkoutPlan || conversation.metadata?.planData?.structuredWorkoutPlan) ? 'Yes' : 'No'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conversation Detail Modal */}
      {showConversationDetail && selectedConversation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            color: 'black'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '15px',
              paddingBottom: '10px',
              borderBottom: '1px solid #eee'
            }}>
              <h3 style={{ color: 'black' }}>Conversation Details</h3>
              <button
                onClick={() => setShowConversationDetail(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: '15px', color: 'black' }}>
              <strong style={{ color: 'black' }}>Timestamp:</strong> {formatTimestamp(selectedConversation.timestamp)}
            </div>

            <div style={{ marginBottom: '15px', color: 'black' }}>
              <strong style={{ color: 'black' }}>Profile Used:</strong> {selectedConversation.metadata?.profileOption === 'yes' ? 'Yes' : 'No'}
            </div>

            {selectedConversation.metadata?.profileOption === 'yes' && selectedConversation.metadata?.profileDetails && (
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: 'black' }}>Profile Details:</strong>
                <div style={{
                  marginTop: '5px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  color: 'black'
                }}>
                  <div style={{ color: 'black' }}>Age: {selectedConversation.metadata.profileDetails.age}</div>
                  <div style={{ color: 'black' }}>Gender: {selectedConversation.metadata.profileDetails.gender}</div>
                  <div style={{ color: 'black' }}>Height: {selectedConversation.metadata.profileDetails.height} cm</div>
                  <div style={{ color: 'black' }}>Weight: {selectedConversation.metadata.profileDetails.weight} kg</div>
                  <div style={{ color: 'black' }}>Activity Level: {selectedConversation.metadata.profileDetails.activityLevel}</div>
                  <div style={{ color: 'black' }}>Target Weight: {selectedConversation.metadata.profileDetails.targetWeight} kg</div>
                  <div style={{ color: 'black' }}>Timeline: {selectedConversation.metadata.profileDetails.timeline} months</div>
                </div>
              </div>
            )}

            {selectedConversation.metadata?.profileOption !== 'yes' && selectedConversation.metadata?.freeStylePrompt && (
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: 'black' }}>Free Style Prompt:</strong>
                <div style={{
                  marginTop: '5px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  color: 'black'
                }}>
                  <div style={{ color: 'black' }}>{selectedConversation.metadata.freeStylePrompt}</div>
                </div>
              </div>
            )}

            {selectedConversation.metadata?.planData?.mealPlanContent && (
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: 'black' }}>Meal Plan:</strong>
                <div style={{
                  marginTop: '5px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  whiteSpace: 'pre-wrap',
                  color: 'black'
                }}>
                  {selectedConversation.metadata.planData.mealPlanContent}
                </div>
              </div>
            )}

            {selectedConversation.metadata?.planData?.workoutPlanContent && (
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: 'black' }}>Workout Plan:</strong>
                <div style={{
                  marginTop: '5px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  whiteSpace: 'pre-wrap',
                  color: 'black'
                }}>
                  {selectedConversation.metadata.planData.workoutPlanContent}
                </div>
              </div>
            )}

            {/* Display structured workout plan data if available */}
            {selectedConversation.metadata?.planData?.structuredWorkoutPlan && (
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ color: 'black' }}>Structured Workout Plan:</strong>
                <div style={{
                  marginTop: '5px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  color: 'black'
                }}>
                  {selectedConversation.metadata.planData.structuredWorkoutPlan.map((day, index) => (
                    <div key={index} style={{ marginBottom: '10px' }}>
                      <h4 style={{ color: 'black', marginBottom: '5px' }}>Day {day.dayNumber}: {day.workoutType}</h4>
                      <ul style={{ paddingLeft: '20px', margin: 0 }}>
                        {day.exercises.map((exercise, exIndex) => (
                          <li key={exIndex} style={{ color: 'black', marginBottom: '3px' }}>
                            {exercise.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowConversationDetail(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showPlans && (
        <div className="plans-container" id="plansContainer" ref={plansContainerRef}>
          {plansComplete && (
            <div style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '24px'
            }}>
              <PDFDownloadLink
                document={<PlanPDFDocument fitnessGoal={fitnessGoal} mealPlansByDay={mealPlansByDay} workoutSections={workoutSections} endOfPlanSuggestion={endOfPlanSuggestion} workoutPlanSuggestion={workoutPlanSuggestion} />}
                fileName="AI_Fitness_Plan.pdf"
                style={{ textDecoration: 'none' }}
              >
                {({ loading }) => (
                  <button className="pdf-download-button">
                    <i className="fas fa-file-pdf"></i>
                    <span>{loading ? 'Preparing PDF...' : 'Download PDF'}</span>
                    {!loading && <i className="fas fa-download"></i>}
                  </button>
                )}
              </PDFDownloadLink>
            </div>
          )}

          <div className={`plans-grid ${(isStreamingMeal || showWorkoutPlanChoice || showWorkoutDaysConfirmation || workoutPlanChoice !== true) ? 'single-column' : 'two-columns'}`}>
            <div className={`plan-section meal-section ${(isStreamingMeal || showWorkoutPlanChoice || showWorkoutDaysConfirmation || workoutPlanChoice !== true) ? '' : 'slide-left'}`}>
              <div className="plan-header">
                <i className="fas fa-utensils plan-icon"></i>
                <h2 className="mealpan-header-text-h2">Meal Plan</h2>
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
                              <span style={{ fontSize: '18px', fontWeight: '600' }}>Day {dayData.dayNumber}</span>
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
                                        {meal.totalCalories || meal.calories} cal
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
                          <span className="generating-text">
                            {currentMealDay === 0
                              ? "Preparing meal plan..."
                              : currentMealDay >= 7
                                ? "Finalizing meal plan..."
                                : `Generating Day ${currentMealDay + 1} of 7...`}
                          </span>
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
                            <span style={{ fontSize: '18px', fontWeight: '600' }}>Day {dayPlan.dayNumber}</span>
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
                                      {meal.totalCalories || meal.calories} cal
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
            <div className={`plan-section workout-section ${(isStreamingMeal || showWorkoutPlanChoice || showWorkoutDaysConfirmation || workoutPlanChoice !== true) ? 'hidden-during-meal' : ''} ${isStreamingMeal ? 'locked-section' : ''}`}>
              {!isStreamingMeal && !noWorkoutPlan && (
                <div className="plan-header">
                  <i className="fas fa-dumbbell plan-icon"></i>
                  <h2>Workout Plan</h2>
                </div>
              )}


              <div className="accordion" id="workoutAccordion" ref={workoutAccordionRef}>
                {(isStreamingMeal && !mealPlansByDay.length) ? (
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
          {(() => {
            const hasPlans = (mealPlansByDay && mealPlansByDay.length > 0) || (workoutSections && workoutSections.length > 0 && !noWorkoutPlan);
            const hasSuggestions = endOfPlanSuggestion || workoutPlanSuggestion || personalizedSuggestions || isLoadingSuggestions;
            console.log('DEBUG: Suggestions section condition - hasPlans:', hasPlans, 'hasSuggestions:', hasSuggestions);
            console.log('DEBUG: mealPlansByDay.length:', mealPlansByDay?.length, 'workoutSections.length:', workoutSections?.length, 'noWorkoutPlan:', noWorkoutPlan);
            console.log('DEBUG: endOfPlanSuggestion length:', endOfPlanSuggestion?.length, 'workoutPlanSuggestion length:', workoutPlanSuggestion?.length, 'personalizedSuggestions length:', personalizedSuggestions?.length);
            console.log('DEBUG: openSuggestionsAccordion:', openSuggestionsAccordion);
            console.log('DEBUG: Will show suggestions section:', hasPlans && hasSuggestions);
            console.log('DEBUG: endOfPlanSuggestion value:', endOfPlanSuggestion);
            return hasPlans && hasSuggestions;
          })() && (
              <div className="suggestions-section" >
                <div
                  className="suggestions-header accordion-header"
                  onClick={() => {
                    setOpenSuggestionsAccordion(!openSuggestionsAccordion);
                    setUserHasToggledAccordion(true);
                  }}
                  style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '12px 16px',
                    backgroundColor: openSuggestionsAccordion ? '#f8f9fa' : '#ffffff',
                    borderBottom: openSuggestionsAccordion ? '1px solid #e9ecef' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div className="suggestions-header-left" >
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                      Personalized Suggestions
                    </h2>
                    <span style={{
                      fontSize: '12px',
                      color: '#6c757d',
                      marginLeft: '8px',
                      fontStyle: 'italic'
                    }}>
                      Click to {openSuggestionsAccordion ? 'hide' : 'show'}
                    </span>
                  </div>
                  <i
                    className="fas fa-chevron-right accordion-arrow"
                    style={{
                      transform: openSuggestionsAccordion ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s ease',
                      fontSize: '14px',
                      color: '#6c757d'
                    }}
                  ></i>
                </div>
                <div
                  className="suggestions-content accordion-content"
                  style={{
                    display: openSuggestionsAccordion ? 'block' : 'none',
                    maxHeight: openSuggestionsAccordion ? '1000px' : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease, opacity 0.3s ease',
                    opacity: openSuggestionsAccordion ? 1 : 0,
                    padding: openSuggestionsAccordion ? '16px' : '0px'
                  }}
                  ref={(el) => {
                    if (el) {
                      console.log('DEBUG: Suggestions content element display style:', el.style.display);
                      console.log('DEBUG: Suggestions content element computed display:', window.getComputedStyle(el).display);
                      console.log('DEBUG: Suggestions content element height:', el.offsetHeight);
                      console.log('DEBUG: Suggestions content element innerHTML length:', el.innerHTML.length);
                    }
                  }}
                >
                  {isLoadingSuggestions ? (
                    <div className="suggestions-loading">
                      <div className="loading-spinner"></div>
                      <span className="loading-text">Generating personalized suggestions...</span>
                    </div>
                  ) : (
                    <div className="suggestions-text">
                      {(() => {
                        // Show both meal and workout suggestions if both exist
                        const hasMealSuggestion = endOfPlanSuggestion && endOfPlanSuggestion.trim() !== '';
                        const hasWorkoutSuggestion = workoutPlanSuggestion && workoutPlanSuggestion.trim() !== '';

                        console.log('DEBUG: Suggestions content rendering - hasMealSuggestion:', hasMealSuggestion, 'hasWorkoutSuggestion:', hasWorkoutSuggestion);
                        console.log('DEBUG: Suggestions content rendering - endOfPlanSuggestion:', endOfPlanSuggestion);
                        console.log('DEBUG: Suggestions content rendering - workoutPlanSuggestion:', workoutPlanSuggestion);
                        console.log('DEBUG: Suggestions content rendering - personalizedSuggestions:', personalizedSuggestions);
                        console.log('DEBUG: Suggestions content rendering - isLoadingSuggestions:', isLoadingSuggestions);

                        const suggestions = [];

                        // Add meal plan suggestion if it exists
                        if (hasMealSuggestion) {
                          suggestions.push(
                            <div key="meal-suggestion" className="explanation-section meal-explanation">
                              <div className="explanation-header">
                                <i className="fas fa-utensils explanation-icon"></i>
                                <h3>Meal Plan Focus</h3>
                              </div>
                              <p className="explanation-text">{endOfPlanSuggestion}</p>
                            </div>
                          );
                        }

                        // Add workout plan suggestion if it exists
                        if (hasWorkoutSuggestion) {
                          suggestions.push(
                            <div key="workout-suggestion" className="explanation-section workout-explanation">
                              <div className="explanation-header">
                                <i className="fas fa-dumbbell explanation-icon"></i>
                                <h3>Workout Plan Focus</h3>
                              </div>
                              <p className="explanation-text">{workoutPlanSuggestion}</p>
                            </div>
                          );
                        }

                        // Fallback to old logic if no specific suggestions
                        if (suggestions.length === 0) {
                          const suggestionsToShow = personalizedSuggestions || 'Follow this plan consistently to achieve your desired results.';
                          const renderedContent = suggestionsToShow.split('\n').map((line, index) => {
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

                            // Handle regular text (fallback for any other content)
                            if (trimmedLine && trimmedLine.length > 0) {
                              // Check if this is a meal plan suggestion (no workout plan exists)
                              const isMealPlanOnly = !workoutSections || workoutSections.length === 0 || noWorkoutPlan;

                              if (isMealPlanOnly) {
                                // Show as meal plan focus
                                return (
                                  <div key={index} className="explanation-section meal-explanation">
                                    <div className="explanation-header">
                                      <i className="fas fa-utensils explanation-icon"></i>
                                      <h3>Meal Plan Focus</h3>
                                    </div>
                                    <p className="explanation-text">{trimmedLine}</p>
                                  </div>
                                );
                              } else {
                                // Show as general suggestion
                                return (
                                  <p key={index} className="suggestion-text">
                                    {trimmedLine}
                                  </p>
                                );
                              }
                            }

                            return null;
                          });
                          console.log('DEBUG: Rendered content length:', renderedContent.length);
                          console.log('DEBUG: Rendered content:', renderedContent);
                          return renderedContent;
                        }

                        // Return the structured suggestions
                        console.log('DEBUG: Returning structured suggestions:', suggestions.length);
                        return suggestions;
                      })()}
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
                style={{
                  backgroundColor: '#BCCE32',
                  color: 'black',
                }}
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
                style={{
                  backgroundColor: '#C8DA2B',
                  color: 'black'
                }}
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
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 10000,
          paddingTop: '90px'
        }}>
          <div className="popup-content" style={{
            backgroundColor: 'white',
            padding: window.innerWidth < 768 ? '20px' : '40px',
            borderRadius: '20px',
            maxWidth: '500px',
            width: window.innerWidth < 768 ? '95%' : '90%',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
            textAlign: 'center',
            margin: '10px'
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
                className="popup-button save"
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#BCCE32',
                  color: 'black',
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

      {/* Missing Profile Fields Popup */}
      {showMissingProfileFieldsPopup && (
        <div className="missing-profile-fields-popup" style={{
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
            padding: window.innerWidth < 768 ? '20px' : '40px',
            borderRadius: '20px',
            maxWidth: '600px',
            width: window.innerWidth < 768 ? '95%' : '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
            textAlign: 'center',
            margin: '10px'
          }}>
            <h2 style={{
              marginBottom: '20px',
              color: '#333',
              fontSize: '24px',
              fontWeight: '600'
            }}>
              Generate Default Prompt
            </h2>
            <p style={{
              marginBottom: '25px',
              color: '#666',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              Review and modify your information to generate a personalized default prompt.
            </p>

            <MissingProfileFieldsForm
              missingFields={missingProfileFieldsData.missingFields || []}
              currentProfileData={missingProfileFieldsData.currentProfileData || {}}
              onSave={handleSaveProfile}
              onGenerate={handleGeneratePrompt}
              onCancel={handleMissingProfileFieldsCancel}
            />
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
            padding: window.innerWidth < 768 ? '20px' : '32px',
            borderRadius: '16px',
            maxWidth: '600px',
            width: window.innerWidth < 768 ? '95%' : '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            textAlign: 'center',
            position: 'relative',
            margin: '10px'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333', fontSize: '24px', fontWeight: '600' }}>
              Complete Your Profile
            </h2>
            <p style={{ marginBottom: '25px', color: '#666', fontSize: '16px', lineHeight: '1.5' }}>
              Please review and complete your details to get personalized recommendations.
            </p>

            <form onSubmit={handleProfileFormSubmit} style={{ textAlign: 'left' }}>
              <div className="form-row" style={{
                display: 'grid',
                gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr',
                gap: '16px',
                marginBottom: '20px'
              }}>
                <div className="form-group">
                  <label htmlFor="profileAge">Age <span className="required-asterisk">*</span></label>
                  <input
                    type="number"
                    id="profileAge"
                    min="13"
                    max="120"
                    required
                    value={profileFormData.age}
                    onChange={(e) => {
                      const newAge = e.target.value;
                      const newFormData = { ...profileFormData, age: newAge };
                      setProfileFormData(newFormData);
                      validateProfileAge(newAge);
                    }}
                    onBlur={(e) => {
                      validateProfileAge(e.target.value);
                    }}
                    style={{
                      border: profileAgeError ? '1px solid #ef4444' : '1px solid #d1d5db'
                    }}
                  />
                  {profileAgeError && (
                    <div style={{
                      color: '#ef4444',
                      fontSize: '12px',
                      marginTop: '4px',
                      fontWeight: '500'
                    }}>
                      {profileAgeError}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="profileGender">Gender <span className="required-asterisk">*</span></label>
                  <select
                    id="profileGender"
                    required
                    value={profileFormData.gender}
                    onChange={(e) => setProfileFormData({ ...profileFormData, gender: e.target.value })}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row" style={{
                display: 'grid',
                gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr',
                gap: '16px',
                marginBottom: '20px'
              }}>
                <div className="form-group">
                  <label htmlFor="profileHeight">Height <span className="required-asterisk">*</span></label>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <input
                      type="number"
                      id="profileHeight"
                      min={profileFormData.heightUnit === 'ft' ? '3' : '90'}
                      max={profileFormData.heightUnit === 'ft' ? '8' : '250'}
                      step={profileFormData.heightUnit === 'ft' ? '0.01' : '1'}
                      required
                      value={profileFormData.height}
                      onChange={(e) => {
                        const newHeight = e.target.value;
                        const newFormData = { ...profileFormData, height: newHeight };
                        setProfileFormData(newFormData);
                        validateProfileHeight(newHeight, newFormData.heightUnit);
                      }}
                      onBlur={(e) => {
                        validateProfileHeight(e.target.value, profileFormData.heightUnit);
                      }}
                      placeholder="Enter height"
                      style={{
                        flex: '1 1 65%',
                        padding: '12px 16px',
                        border: profileHeightError ? '1px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        color: '#374151',
                        background: '#ffffff',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box',
                        width: '65%'
                      }}
                    />
                    <select
                      value={profileFormData.heightUnit || 'cm'}
                      onChange={(e) => {
                        const newUnit = e.target.value;
                        const newFormData = { ...profileFormData, heightUnit: newUnit };
                        setProfileFormData(newFormData);
                        validateProfileHeight(newFormData.height, newUnit);
                      }}
                      style={{
                        flex: '0 0 35%',
                        padding: '12px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        color: '#374151',
                        background: '#ffffff',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box',
                        width: '35%',
                        fontWeight: '500',
                        textAlign: 'left',
                        minWidth: '60px'
                      }}
                    >
                      <option value="cm">cm</option>
                      <option value="ft">ft</option>
                    </select>
                  </div>
                  {profileHeightError && (
                    <div style={{
                      color: '#ef4444',
                      fontSize: '12px',
                      marginTop: '4px',
                      fontWeight: '500'
                    }}>
                      {profileHeightError}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="profileCurrentWeight">Current Weight <span className="required-asterisk">*</span></label>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <input
                      type="number"
                      id="profileCurrentWeight"
                      min="30"
                      max="650"
                      step="0.1"
                      required
                      value={profileFormData.currentWeight}
                      onChange={(e) => {
                        const newWeight = e.target.value;
                        const newFormData = { ...profileFormData, currentWeight: newWeight };
                        setProfileFormData(newFormData);
                        validateProfileCurrentWeight(newWeight, newFormData.currentWeightUnit);
                        validateProfileWeights(newWeight, newFormData.targetWeight, newFormData.currentWeightUnit, newFormData.targetWeightUnit);
                      }}
                      onBlur={(e) => {
                        validateProfileCurrentWeight(e.target.value, profileFormData.currentWeightUnit);
                        validateProfileWeights(e.target.value, profileFormData.targetWeight, profileFormData.currentWeightUnit, profileFormData.targetWeightUnit);
                      }}
                      placeholder="Enter current weight"
                      style={{
                        flex: '1 1 70%',
                        padding: '12px 16px',
                        border: profileCurrentWeightError ? '1px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        color: '#374151',
                        background: '#ffffff',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box'
                      }}
                    />
                    <select
                      value={profileFormData.currentWeightUnit || 'kg'}
                      onChange={(e) => {
                        const newUnit = e.target.value;
                        const newFormData = { ...profileFormData, currentWeightUnit: newUnit };
                        setProfileFormData(newFormData);
                        validateProfileCurrentWeight(newFormData.currentWeight, newUnit);
                        validateProfileWeights(newFormData.currentWeight, newFormData.targetWeight, newUnit, newFormData.targetWeightUnit);
                      }}
                      style={{
                        padding: '12px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        color: '#374151',
                        background: '#ffffff',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box',
                        width: '35%',
                        fontWeight: '500',
                        textAlign: 'left',
                        minWidth: '60px'
                      }}
                    >
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                    </select>
                  </div>
                  {profileCurrentWeightError && (
                    <div style={{
                      color: '#ef4444',
                      fontSize: '12px',
                      marginTop: '4px',
                      fontWeight: '500'
                    }}>
                      {profileCurrentWeightError}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-row" style={{
                display: 'grid',
                gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr',
                gap: '16px',
                marginBottom: '20px'
              }}>
                <div className="form-group">
                  <label htmlFor="profileTargetWeight">Target Weight <span className="required-asterisk">*</span></label>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <input
                      type="number"
                      id="profileTargetWeight"
                      min="30"
                      max="650"
                      step="0.1"
                      required
                      value={profileFormData.targetWeight}
                      onChange={(e) => {
                        const newWeight = e.target.value;
                        const newFormData = { ...profileFormData, targetWeight: newWeight };
                        setProfileFormData(newFormData);
                        validateProfileTargetWeight(newWeight, newFormData.targetWeightUnit);
                        validateProfileWeights(newFormData.currentWeight, newWeight, newFormData.currentWeightUnit, newFormData.targetWeightUnit);
                      }}
                      onBlur={(e) => {
                        validateProfileTargetWeight(e.target.value, profileFormData.targetWeightUnit);
                        validateProfileWeights(profileFormData.currentWeight, e.target.value, profileFormData.currentWeightUnit, profileFormData.targetWeightUnit);
                      }}
                      placeholder="Enter target weight"
                      style={{
                        flex: '1 1 65%',
                        padding: '12px 16px',
                        border: profileTargetWeightError ? '1px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        color: '#374151',
                        background: '#ffffff',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box',
                        width: '65%'
                      }}
                    />
                    <select
                      value={profileFormData.targetWeightUnit || 'kg'}
                      onChange={(e) => {
                        const newUnit = e.target.value;
                        const newFormData = { ...profileFormData, targetWeightUnit: newUnit };
                        setProfileFormData(newFormData);
                        validateProfileTargetWeight(newFormData.targetWeight, newUnit);
                        validateProfileWeights(newFormData.currentWeight, newFormData.targetWeight, newFormData.currentWeightUnit, newUnit);
                      }}
                      style={{
                        flex: '0 0 35%',
                        padding: '12px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '16px',
                        color: '#374151',
                        background: '#ffffff',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box',
                        width: '35%',
                        fontWeight: '500',
                        textAlign: 'left',
                        minWidth: '60px'
                      }}
                    >
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                    </select>
                  </div>
                  {profileTargetWeightError && (
                    <div style={{
                      color: '#ef4444',
                      fontSize: '12px',
                      marginTop: '4px',
                      fontWeight: '500'
                    }}>
                      {profileTargetWeightError}
                    </div>
                  )}
                  {profileWeightError && (
                    <div style={{
                      color: '#ef4444',
                      fontSize: '14px',
                      marginTop: '8px',
                      fontWeight: '500'
                    }}>
                      {profileWeightError}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="profileActivityLevel">Activity Level <span className="required-asterisk">*</span></label>
                  <select
                    id="profileActivityLevel"
                    required
                    value={profileFormData.activityLevel}
                    onChange={(e) => setProfileFormData({ ...profileFormData, activityLevel: e.target.value })}
                  >
                    <option value="">Select activity level</option>
                    <option value="sedentary">Sedentary (little or no exercise)</option>
                    <option value="light">Lightly active (light exercise 1-3 days/week)</option>
                    <option value="moderate">Moderately active (moderate exercise 3-5 days/week)</option>
                    <option value="active">Very active (hard exercise 6-7 days/week)</option>
                    <option value="very-active">Extra active (very hard exercise & physical job)</option>
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
                    onChange={(e) => setProfileFormData({ ...profileFormData, workoutDays: e.target.value })}
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
                    step="1"
                    required
                    value={profileFormData.targetTimeline}
                    onChange={(e) => setProfileFormData({ ...profileFormData, targetTimeline: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 0',
                      background: 'transparent',
                      outline: 'none',
                      marginBottom: '8px'
                    }}
                  />
                  <div style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    fontWeight: '500',
                    textAlign: 'center',
                    padding: '4px 8px',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    marginTop: '8px'
                  }}>
                    {profileFormData.targetTimeline} months
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="profileGoal">Goal</label>
                <input
                  type="text"
                  id="profileGoal"
                  value={profileFormData.goal}
                  onChange={(e) => setProfileFormData({ ...profileFormData, goal: e.target.value })}
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
                    backgroundColor: '#BCCE32',
                    color: 'black',
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
        <CalorieResultsPopup
          calculatedCalories={calculatedCalories}
          profileFormData={profileFormData}
          onGenerateMealPlan={() => handleMealPlanChoice(true)}
          onClose={() => handleMealPlanChoice(false)}
        />
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
                  backgroundColor: '#C8DA2B',
                  color: 'black',
                  fontSize: '14px',
                  fontWeight: '700',
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
            maxWidth: '600px',
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
                  backgroundColor: '#C8DA2B',
                  color: 'black',
                  fontSize: '14px',
                  fontWeight: '700',
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

      {/* Success Popup - REMOVED as per user request */}
      {/* {showSuccessPopup && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#6b7280',
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
      )} */}

      {/* Error Popup */}
      {showErrorPopup && (
        <div style={{
          position: 'fixed',
          top: '100px', // Moved down below the navbar (navbar height is 80px, adding 20px spacing)
          right: '20px',
          backgroundColor: '#dc2626',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 10001, // Kept high z-index but should be above navbar z-index of 999
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





