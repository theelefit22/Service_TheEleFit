import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './DetailsPage.css';

const DetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('tdee');

  useEffect(() => {
    // Get the type from URL search params
    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get('type');
    if (type === 'calories' || type === 'tdee') {
      setActiveTab(type);
    }
  }, [location]);

  const tdeeContent = {
    title: "What is TDEE?",
    content: [
      {
        heading: "Total Daily Energy Expenditure (TDEE)",
        text: "TDEE represents the total number of calories your body burns in a 24-hour period, including all activities and metabolic processes. Our system uses the scientifically proven Mifflin-St Jeor Equation for accurate calculations."
      },
      {
        heading: "TDEE Calculation Formula (Mifflin-St Jeor Equation):",
        text: "Our backend uses the most accurate BMR calculation method:",
        list: [
          "For Males: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) + 5",
          "For Females: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) - 161",
          "TDEE = BMR × Activity Level Factor"
        ]
      },
      {
        heading: "Activity Level Factors Used in Our System:",
        list: [
          "Sedentary (little/no exercise): 1.2",
          "Light (light exercise 1-3 days/week): 1.375",
          "Moderate (moderate exercise 3-5 days/week): 1.55",
          "Active (hard exercise 6-7 days/week): 1.725",
          "Very Active (very hard exercise, physical job): 1.9"
        ]
      },
      {
        heading: "BMI Calculation (Body Mass Index):",
        text: "Our system also calculates BMI for health assessments:",
        list: [
          "BMI = Weight (kg) ÷ (Height (m))²",
          "Underweight: BMI < 18.5",
          "Normal weight: BMI 18.5-24.9",
          "Overweight: BMI 25-29.9",
          "Obese: BMI ≥ 30"
        ]
      },
      {
        heading: "Why We Use Mifflin-St Jeor Equation:",
        list: [
          "Most accurate for modern populations",
          "Accounts for gender differences in metabolism",
          "Validated through extensive research studies",
          "Better predictor than older Harris-Benedict equation",
          "Used in clinical and fitness settings worldwide"
        ]
      },
      {
        heading: "Factors Affecting Your TDEE:",
        list: [
          "Body Weight - Heavier bodies require more energy",
          "Height - Taller people have higher metabolic rates",
          "Age - Metabolism slows by ~2% per decade after 25",
          "Gender - Males typically have 10-15% higher TDEE",
          "Activity Level - Exercise significantly increases daily burn",
          "Muscle Mass - Each pound of muscle burns ~6 calories/day at rest"
        ]
      }
    ]
  };

  const caloriesContent = {
    title: "How Calorie Targets are Calculated",
    content: [
      {
        heading: "Our Calorie Calculation Process:",
        text: "Your daily calorie target is calculated using your TDEE and goal-specific adjustments. Our system accounts for safe, sustainable weight changes over your specified timeline."
      },
      {
        heading: "Step-by-Step Calculation:",
        steps: [
          "1. Calculate TDEE using Mifflin-St Jeor equation",
          "2. Determine total calorie change needed: (Target Weight - Current Weight) × 7,700 calories/kg",
          "3. Calculate daily calorie offset: Total Change ÷ (Timeline in weeks × 7 days)",
          "4. Apply safety limits: Max ±1,000 calories/day adjustment",
          "5. Final Target = TDEE + Daily Offset (rounded to nearest whole number)"
        ]
      },
      {
        heading: "Goal-Specific Configurations:",
        list: [
          "Weight Loss: Focuses on Fat Burn & Cardio workouts",
          "Muscle Gain: Emphasizes Strength & Hypertrophy training",
          "Get Fit: Balanced Mixed Cardio and Strength approach",
          "Get Stronger: Progressive Overload & Compound Lifts",
          "Get Flexible: Mobility, Yoga, and Stretching focus"
        ]
      },
      {
        heading: "Scientific Foundation (7,700 calories = 1kg fat):",
        text: "Our calculations are based on the scientifically established principle that 1 kilogram of body fat contains approximately 7,700 calories. This allows for precise timeline-based calorie adjustments.",
        list: [
          "1 kg fat loss requires 7,700 calorie deficit",
          "1 kg fat gain requires 7,700 calorie surplus",
          "Safe weight loss: 0.5-1 kg per week",
          "Safe weight gain: 0.25-0.5 kg per week"
        ]
      },
      {
        heading: "Safety Constraints in Our System:",
        list: [
          "Maximum daily deficit: 1,000 calories (prevents metabolic damage)",
          "Maximum daily surplus: 1,000 calories (prevents excessive fat gain)",
          "Automatic timeline adjustment for extreme goals",
          "BMI considerations for appropriate targets",
          "Age and gender-specific safety limits"
        ]
      },
      {
        heading: "Goal Classification System:",
        text: "Our AI analyzes your input text and automatically classifies your fitness goal using pattern recognition:",
        list: [
          "Weight Loss: Detected from phrases like 'lose weight', 'shed fat', 'slim down'",
          "Muscle Gain: Identified from 'build muscle', 'gain mass', 'bulk up'",
          "Get Stronger: Recognized from 'get stronger', 'increase strength', 'lift heavier'",
          "Get Flexible: Found in 'improve flexibility', 'yoga', 'mobility training'",
          "Get Fit: Default for 'overall fitness', 'stay healthy', 'improve fitness'"
        ]
      },
      {
        heading: "Timeline Calculation Logic:",
        text: "When no timeline is specified, our system automatically calculates safe timelines:",
        list: [
          "≤2kg change: 8 weeks (2 months)",
          "≤5kg change: 12 weeks (3 months)",
          "≤10kg change: 16 weeks (4 months)",
          ">10kg change: 24 weeks (6 months)"
        ]
      }
    ]
  };

  const renderContent = (content) => {
    return content.map((section, index) => (
      <div key={index} className="content-section">
        <h3 className="section-heading">{section.heading}</h3>
        {section.text && <p className="section-text">{section.text}</p>}
        {section.list && (
          <ul className="section-list">
            {section.list.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
        {section.steps && (
          <ol className="section-steps">
            {section.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
      </div>
    ));
  };

  return (
    <div className="details-page">
      <div className="details-container">
        <button 
          className="back-button"
          onClick={() => navigate(-1)}
        >
          <i className="fas fa-arrow-left"></i>
          Back
        </button>

        <div className="details-header">
          <h1 className="details-title">Calorie & TDEE Information</h1>
          <p className="details-subtitle">
            Understanding the science behind your personalized recommendations
          </p>
        </div>

        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'tdee' ? 'active' : ''}`}
            onClick={() => setActiveTab('tdee')}
          >
            <i className="fas fa-calculator"></i>
            About TDEE
          </button>
          <button
            className={`tab-button ${activeTab === 'calories' ? 'active' : ''}`}
            onClick={() => setActiveTab('calories')}
          >
            <i className="fas fa-bullseye"></i>
            Calorie Calculation
          </button>
        </div>

        <div className="details-content">
          {activeTab === 'tdee' && (
            <div className="tab-content">
              <h2 className="content-title">{tdeeContent.title}</h2>
              {renderContent(tdeeContent.content)}
            </div>
          )}

          {activeTab === 'calories' && (
            <div className="tab-content">
              <h2 className="content-title">{caloriesContent.title}</h2>
              {renderContent(caloriesContent.content)}
            </div>
          )}
        </div>

        <div className="details-footer">
          <div className="disclaimer">
            <i className="fas fa-info-circle"></i>
            <p>
              <strong>Disclaimer:</strong> These calculations use the scientifically validated Mifflin-St Jeor equation 
              and established metabolic principles (7,700 calories = 1kg fat). All formulas and safety constraints 
              are implemented in our backend system for accurate, personalized recommendations. Individual results may vary 
              based on genetics, medical conditions, and adherence. For medical concerns or specialized dietary needs, 
              consult with a qualified healthcare professional or registered dietitian.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsPage;