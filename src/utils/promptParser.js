// Advanced Regular Expressions for Profile Details
const heightPatterns = [
  // Metric with natural language
  /(?:i\s*(?:am|'m|stand))?\s*(?:about|around|approximately)?\s*(\d+\.?\d*)\s*(?:cm|centimeters?|meters?|m)(?:\s+tall|\s+in\s+height)?/i,
  /(?:my\s+)?(?:height|size)\s*(?:is|:|=|~)?\s*(\d+\.?\d*)\s*(?:cm|centimeters?|meters?|m)/i,
  // Imperial with natural language
  /(?:i\s*(?:am|'m|stand))?\s*(?:about|around|approximately)?\s*(\d+)\s*(?:ft|feet|foot|')\s*(?:and)?\s*(\d+)?(?:\s*(?:inches|in|"|″))?/i,
  /(?:my\s+)?(?:height|size)\s*(?:is|:|=|~)?\s*(\d+)\s*(?:ft|feet|foot|')\s*(?:and)?\s*(\d+)?(?:\s*(?:inches|in|"|″))?/i,
  // Additional variations
  /(\d+\.?\d*)\s*(?:feet|foot|ft)\s*(?:(\d+)\s*(?:in(?:ches)?|"|″))?(?:\s+tall)?/i,
  /standing\s+at\s+(\d+\.?\d*)\s*(cm|m|ft|feet|foot|')/i,
  /height[:=]?\s*(\d+\.?\d*)\s*(cm|m|ft|feet|foot|')/i
];

const weightPatterns = [
  // Current weight with natural language
  /(?:i\s*(?:am|'m))?\s*(?:currently|presently|now)?\s*(?:about|around|approximately)?\s*(\d+\.?\d*)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/i,
  /(?:my\s+)?(?:current\s+)?(?:weight|mass)\s*(?:is|:|=|~)?\s*(\d+\.?\d*)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/i,
  // Weight with additional context
  /(?:i\s+)?weigh(?:ing)?\s*(?:about|around|approximately)?\s*(\d+\.?\d*)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/i,
  /(?:current(?:ly)?|present(?:ly)?|now)\s+at\s+(\d+\.?\d*)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/i,
  // Target weight mentions
  /(?:target|goal|desired|aim(?:ing)?|want(?:ing)?)\s*(?:weight|to\s+be|to\s+reach)\s*(?:is|:|of)?\s*(\d+\.?\d*)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/i,
  // Additional variations
  /weight[:=]?\s*(\d+\.?\d*)\s*(kg|kilos?|kilograms?|lbs?|pounds?)/i
];

const agePatterns = [
  // Direct age mentions with more variations
  /(?:i\s*(?:am|'m))?\s*(?:a\s+)?(\d+)(?:\s*[-]\s*years?\s*old|\s+y(?:ears?)?[\s-]*old|\s+y\.?o\.?|years?\s+of\s+age)?/i,
  /(?:my\s+)?age\s*(?:is|:|=|~)?\s*(\d+)(?:\s*(?:years?|yrs?|y\.?o\.?))?/i,
  // Stand-alone number after "I am/I'm"
  /i\s*(?:am|'m)\s*(\d+)(?:\s|$)/i,
  // Age at start of sentence or after punctuation
  /(?:^|[.!?]\s+)(\d+)\s*(?:years?|yrs?|y\.?o\.?)?(?:\s+old)?/i,
  // Age with context words
  /(?:aged?|aging)\s*(?:about|around|approximately)?\s*(\d+)/i,
  // Age ranges (takes first number)
  /(?:between\s+)?(\d+)(?:\s*[-–]\s*\d+)?\s*(?:years?\s*old|y\.?o\.?)?/i,
  // Date of birth patterns
  /(?:born|dob|date\s+of\s+birth|birth\s*date)\s*(?::|is|in|on)?\s*(\d{1,2})[-./](\d{1,2})[-./](\d{4})/i,
  /(?:born|dob|date\s+of\s+birth|birth\s*date)\s*(?::|is|in|on)?\s*(\d{4})[-./](\d{1,2})[-./](\d{1,2})/i,
  // Simple number after age indicators
  /\b(?:age|aging|aged?)[:=]?\s*(\d+)\b/i
];

const genderPatterns = [
  // Direct mentions with natural language
  /(?:i\s*(?:am|'m|identify\s+as))?\s*(?:a\s+)?(male|female|man|woman|boy|girl|non-binary|nonbinary|enby)/i,
  /(?:my\s+)?(?:gender|sex)\s*(?:is|:|=)?\s*(male|female|man|woman|boy|girl|non-binary|nonbinary|enby)/i,
  // Pronouns and identity
  /(?:i\s+use\s+)(he\/him|she\/her|they\/them)/i,
  /(?:prefer\s+to\s+be\s+referred\s+to\s+as\s+)(?:a\s+)?(male|female|man|woman|non-binary|nonbinary)/i,
  // Additional variations
  /gender[:=]?\s*(male|female|non-binary|nonbinary)/i
];

const activityPatterns = [
  // Direct activity level mentions
  /(?:my\s+)?(?:activity|lifestyle)\s*(?:level|is|:|=)?\s*(sedentary|light|moderate|active|very\s*active)/i,
  // Exercise frequency patterns
  /(?:i\s+)?(?:exercise|work\s*out|train)\s*(\d+)\s*(?:to|-)\s*(\d+)?\s*(?:times|days)\s*(?:per|a|every)\s*week/i,
  /(?:i\s+)?(?:exercise|work\s*out|train)\s*(?:about|around|approximately)?\s*(\d+)\s*(?:times|days)\s*(?:per|a|every)\s*week/i,
  // Lifestyle descriptions
  /(?:i\s+(?:am|'m))?\s*(?:quite|very|super|extremely)?\s*(active|inactive|sedentary)/i,
  /(?:i\s+(?:have|work))?\s*(?:a\s+)?(desk|office|active|physical|demanding)\s*(?:job|work|lifestyle)/i,
  // Exercise habits
  /(?:i\s+)?(rarely|never|sometimes|occasionally|regularly|daily|every\s*day)\s*(?:exercise|work\s*out|train)/i,
  /(?:do\s+)(no|little|some|lots?\s+of|regular)\s*(?:exercise|training|physical\s+activity)/i,
  // Sports and fitness
  /(?:i\s+(?:am|'m))?\s*(?:a[n]?\s+)?(athlete|gym\s*rat|fitness\s*enthusiast|bodybuilder|runner|cyclist)/i,
  /(?:play|do)\s+(?:competitive\s+)?(sports|athletics|gym|fitness)/i
];

const dietaryPatterns = [
  // Diet type identification
  /(?:i\s*(?:am|'m))?\s*(?:a\s+)?(vegan|vegetarian|pescatarian|flexitarian|omnivore)/i,
  /(?:follow(?:ing)?|on)\s*(?:a\s+)?(vegan|vegetarian|pescatarian|keto|paleo|mediterranean)\s*(?:diet|lifestyle)?/i,
  // Restrictions and preferences
  /(?:avoid|don't\s+eat|can't\s+eat|no)\s*(meat|dairy|gluten|nuts|fish|eggs|soy|shellfish)/i,
  /(?:my\s+)?(?:dietary|diet)\s*(?:restrictions?|preferences?|needs?)\s*(?:is|are|:|include)?\s*([^.,!?]+)/i,
  // Allergies and intolerances
  /(?:i\s+(?:am|'m))?\s*(?:allergic|intolerant)\s*to\s*([^.,!?]+)/i,
  /(?:have|suffer\s+from)\s*(?:a[n]?\s+)?(allergy|intolerance)\s*to\s*([^.,!?]+)/i,
  /(?:food\s*)?(?:allergies?|intolerances?)\s*(?::|include|are)?\s*([^.,!?]+)/i,
  // Additional variations
  /(?:cannot|can't)\s*(?:eat|consume|have)\s*([^.,!?]+)(?:\s+due\s+to\s+(?:allergy|intolerance))?/i,
  /sensitive\s*to\s*([^.,!?]+)/i
];

const healthGoalPatterns = [
  // Direct goal statements
  /(?:i\s*(?:want|need|would\s+like|aim|hope|wish)\s*to)\s*(gain|lose|maintain|build|improve|increase|reduce|get|become)\s*(?:some|more|extra|better)?\s*(?:weight|mass|muscle|strength|fitness|health|flexibility)/i,
  
  // Want-based patterns
  /(?:want(?:ing)?|looking|aim(?:ing)?|try(?:ing)?|goal)\s*(?:is|to)?\s*(?:to\s+)?(gain|lose|maintain|build|improve|increase|reduce|get|become)/i,
  
  // Simple mentions of goals
  /(?:to\s+)?(gain|lose|maintain)\s*(?:some|more|extra)?\s*(?:weight|mass|muscle|pounds?|kg|kilos?)/i,
  
  // Specific fitness goals
  /(?:get|become|stay|be)\s*(?:more)?\s*(fit|healthy|strong|flexible|lean|muscular|athletic)/i,
  /(?:build|gain|increase)\s*(?:more|some)?\s*(muscle|strength|endurance|stamina|flexibility|power)/i,
  /(?:improve|enhance|boost)\s*(health|fitness|physique|body|performance|energy|condition)/i,
  
  // Body composition goals
  /(?:reduce|lose|burn|cut)\s*(?:some|more|extra)?\s*(fat|belly|weight|calories)/i,
  /(?:tone|toning|define|sculpt)\s*(body|muscle|physique|abs)/i,
  
  // Training specific goals
  /(?:bulk|cut|bulk\s*up|cutting|lean\s*out|slim\s*down)/i,
  
  // General improvement
  /(?:better|improve|enhance)\s*(?:my)?\s*(?:shape|form|body|health|fitness)/i,
  
  // Implicit goals
  /(?:too|very|so)\s*(?:skinny|thin|underweight|light|slim)/i,
  /(?:too|very|so)\s*(?:heavy|fat|overweight|big)/i,
  
  // Need-based statements
  /need\s*(?:to)?\s*(gain|lose|build|improve|increase|reduce|get|become)/i,
  
  // Should-based statements
  /should\s*(?:probably)?\s*(gain|lose|build|improve|increase|reduce|get|become)/i,
  
  // Advised/recommended goals
  /(?:advised|recommended|told)\s*(?:to|that\s+i\s+(?:should|need))?\s*(gain|lose|build|improve|increase|reduce|get|become)/i,
  
  // Size change goals
  /(?:bigger|smaller|leaner|stronger|fitter|healthier|more\s*muscular)/i,
  
  // Weight-specific goals without action verbs
  /(?:target|goal)\s*weight\s*(?:is|:)?\s*\d+/i,
  
  // Health improvement
  /(?:health|fitness)\s*(?:improvement|goals?|targets?)/i
];

// Convert height to centimeters
// Helper function to calculate age from date of birth
const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Helper function to calculate confidence score for a match
const calculateConfidence = (match, context, pattern) => {
  let score = 0;
  
  // Base confidence from pattern match
  score += match ? 0.5 : 0;
  
  // Context words increase confidence
  const contextWords = ['my', 'i am', 'i\'m', 'current', 'about', 'approximately'];
  contextWords.forEach(word => {
    if (context.toLowerCase().includes(word)) score += 0.1;
  });
  
  // Multiple number formats increase confidence
  if (pattern.source.includes('\\d+\\.?\\d*')) score += 0.1;
  
  // Unit variations increase confidence
  if (pattern.source.includes('(?:')) score += 0.1;
  
  return Math.min(score, 1.0); // Cap at 1.0
};

// Enhanced unit conversion with validation
const convertToCm = (value, unit, confidence) => {
  // Validate input
  if (!value || isNaN(value)) return null;
  
  const normalizedUnit = unit?.toLowerCase()?.trim();
  let result;
  
  switch (normalizedUnit) {
    case 'm':
    case 'meter':
    case 'meters':
      result = value * 100;
      break;
    case 'ft':
    case 'feet':
    case 'foot':
    case "'":
      // Handle feet and inches format
      if (String(value).includes('.')) {
        // Decimal feet (e.g., 5.8 feet)
        const feet = Math.floor(value);
        const inches = (value - feet) * 12;
        result = (feet * 30.48) + (inches * 2.54);
      } else if (String(value).includes(',') || unit.includes('"')) {
        // Format: feet,inches or feet'inches"
        const [feet, inches = 0] = String(value).split(/[,']/).map(Number);
        result = (feet * 30.48) + (inches * 2.54);
      } else {
        // Just feet
        result = value * 30.48;
      }
      break;
    default:
      // Assume cm if no unit or unrecognized unit
      result = value;
  }
  
  // Validate result within reasonable range (50cm - 300cm)
  if (result < 50 || result > 300) {
    if (confidence > 0.8) {
      // High confidence but unreasonable value - might be wrong unit
      if (result < 50) result *= 100; // Might be meters
      if (result > 300) result /= 100; // Might be millimeters
    } else {
      return null;
    }
  }
  
  return Math.round(result);
};

// Enhanced weight conversion with validation
const convertToKg = (value, unit, confidence) => {
  // Validate input
  if (!value || isNaN(value)) return null;
  
  const normalizedUnit = unit?.toLowerCase()?.trim();
  let result;
  
  if (normalizedUnit?.startsWith('lb')) {
    result = value * 0.453592;
  } else {
    // Assume kg if no unit or unrecognized unit
    result = value;
  }
  
  // Validate result within reasonable range (20kg - 300kg)
  if (result < 20 || result > 300) {
    if (confidence > 0.8) {
      // High confidence but unreasonable value - might be wrong unit
      if (result < 20 && normalizedUnit !== 'kg') result *= 2.20462; // Might be pounds
      if (result > 300) result /= 2.20462; // Might be pounds
    } else {
      return null;
    }
  }
  
  return Math.round(result);
};

// Helper function to find the best match from multiple patterns
const findBestMatch = (text, patterns) => {
  const matches = patterns
    .map(pattern => {
      const match = text.match(pattern);
      return match ? { pattern, match } : null;
    })
    .filter(Boolean);

  if (!matches.length) return null;

  // Prefer matches that come earlier in the text
  return matches.reduce((best, current) => {
    if (!best) return current;
    return current.match.index < best.match.index ? current : best;
  });
};

// Process date of birth string to ISO format
const processDOB = (day, month, year) => {
  try {
    // Handle both DD/MM/YYYY and YYYY/MM/DD formats
    const date = year.length === 4 
      ? new Date(year, parseInt(month) - 1, parseInt(day))
      : new Date(day, parseInt(month) - 1, parseInt(year));
    
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch (e) {
    console.error('Error processing DOB:', e);
    return null;
  }
};

// Extract activity level from text description
const determineActivityLevel = (text) => {
  const activityLevels = {
    sedentary: ['sedentary', 'desk job', 'rarely', 'never exercise', "don't exercise"],
    light: ['light', 'occasionally', 'sometimes', '1-2 times', 'walking'],
    moderate: ['moderate', '2-3 times', 'weekly', 'regular'],
    active: ['active', '4-5 times', 'very active', 'athlete', 'daily exercise'],
    'very active': ['professional', 'intense', 'every day', 'hardcore']
  };

  for (const [level, keywords] of Object.entries(activityLevels)) {
    if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
      return level;
    }
  }
  return 'moderate'; // Default
};

// Extract measurements from prompt
// Confidence threshold for accepting matches
const CONFIDENCE_THRESHOLD = 0.6;

export const extractMeasurements = (prompt) => {
  const measurements = {};
  console.log('Processing prompt:', prompt);
  
  // Clean and normalize input
  const cleanPrompt = prompt.toLowerCase()
    .replace(/[\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Multiple passes with different techniques
  const passes = [
    // First pass: Exact pattern matching
    () => {
      // Height detection with confidence scoring
      const heightMatches = heightPatterns.map(pattern => {
        const match = cleanPrompt.match(pattern);
        if (match) {
          const confidence = calculateConfidence(match, cleanPrompt, pattern);
          if (confidence >= CONFIDENCE_THRESHOLD) {
            const value = parseFloat(match[1]);
            const unit = match[2] || (match[3] ? "'" : 'cm');
            const heightInCm = convertToCm(value, unit, confidence);
            if (heightInCm) {
              return { value: heightInCm, confidence };
            }
          }
        }
        return null;
      }).filter(Boolean);

      if (heightMatches.length > 0) {
        // Use the match with highest confidence
        const bestMatch = heightMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        measurements.height = bestMatch.value;
        console.log('Detected height:', measurements.height, 'cm', '(confidence:', bestMatch.confidence, ')');
      }

      // Weight detection with confidence scoring
      const weightMatches = weightPatterns.map(pattern => {
        const match = cleanPrompt.match(pattern);
        if (match) {
          const confidence = calculateConfidence(match, cleanPrompt, pattern);
          if (confidence >= CONFIDENCE_THRESHOLD) {
            const value = parseFloat(match[1]);
            const unit = match[2];
            const weightInKg = convertToKg(value, unit, confidence);
            if (weightInKg) {
              return { value: weightInKg, confidence };
            }
          }
        }
        return null;
      }).filter(Boolean);

      if (weightMatches.length > 0) {
        const bestMatch = weightMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        measurements.weight = bestMatch.value;
        console.log('Detected weight:', measurements.weight, 'kg', '(confidence:', bestMatch.confidence, ')');
      }

      // Age/DOB detection with validation
      const ageMatches = agePatterns.map(pattern => {
        const match = cleanPrompt.match(pattern);
        if (match) {
          const confidence = calculateConfidence(match, cleanPrompt, pattern);
          if (confidence >= CONFIDENCE_THRESHOLD) {
            if (match[3]) { // DOB format
              const dob = processDOB(match[1], match[2], match[3]);
              if (dob) {
                const age = calculateAge(dob);
                if (age >= 13 && age <= 120) {
                  return { value: dob, type: 'dob', confidence };
                }
              }
            } else {
              const age = parseInt(match[1], 10);
              if (age >= 13 && age <= 120) {
                const today = new Date();
                const birthYear = today.getFullYear() - age;
                const dob = `${birthYear}-01-01`;
                return { value: dob, type: 'age', confidence };
              }
            }
          }
        }
        return null;
      }).filter(Boolean);

      if (ageMatches.length > 0) {
        const bestMatch = ageMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        measurements.dateOfBirth = bestMatch.value;
        console.log('Detected DOB:', measurements.dateOfBirth, '(confidence:', bestMatch.confidence, ')');
      }

      // Gender detection with improved mapping
      const genderMatches = genderPatterns.map(pattern => {
        const match = cleanPrompt.match(pattern);
        if (match) {
          const confidence = calculateConfidence(match, cleanPrompt, pattern);
          if (confidence >= CONFIDENCE_THRESHOLD) {
            let gender = match[1].toLowerCase();
            // Enhanced gender mapping
            const genderMap = {
              'man': 'male', 'boy': 'male', 'male': 'male', 'he': 'male', 'him': 'male',
              'woman': 'female', 'girl': 'female', 'female': 'female', 'she': 'female', 'her': 'female',
              'non-binary': 'non-binary', 'nonbinary': 'non-binary', 'enby': 'non-binary', 'they': 'non-binary'
            };
            return { value: genderMap[gender] || gender, confidence };
          }
        }
        return null;
      }).filter(Boolean);

      if (genderMatches.length > 0) {
        const bestMatch = genderMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        if (['male', 'female', 'non-binary'].includes(bestMatch.value)) {
          measurements.gender = bestMatch.value;
          console.log('Detected gender:', measurements.gender, '(confidence:', bestMatch.confidence, ')');
        }
      }

      // Activity level detection with improved accuracy
      const activityMatches = activityPatterns.map(pattern => {
        const match = cleanPrompt.match(pattern);
        if (match) {
          const confidence = calculateConfidence(match, cleanPrompt, pattern);
          if (confidence >= CONFIDENCE_THRESHOLD) {
            let level = determineActivityLevel(match[0]);
            return { value: level, confidence };
          }
        }
        return null;
      }).filter(Boolean);

      if (activityMatches.length > 0) {
        const bestMatch = activityMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        measurements.activityLevel = bestMatch.value;
        console.log('Detected activity level:', measurements.activityLevel, '(confidence:', bestMatch.confidence, ')');
      } else {
        measurements.activityLevel = 'moderate'; // Default
      }

      // Dietary restrictions with improved parsing
      const dietaryMatches = dietaryPatterns.map(pattern => {
        const match = cleanPrompt.match(pattern);
        if (match) {
          const confidence = calculateConfidence(match, cleanPrompt, pattern);
          if (confidence >= CONFIDENCE_THRESHOLD) {
            const restrictions = match[1]
              .toLowerCase()
              .split(/[,&]/)
              .map(item => item.trim())
              .filter(Boolean);
            return { value: restrictions, confidence };
          }
        }
        return null;
      }).filter(Boolean);

      if (dietaryMatches.length > 0) {
        const bestMatch = dietaryMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        measurements.dietaryRestrictions = bestMatch.value.join(', ');
        console.log('Detected dietary restrictions:', measurements.dietaryRestrictions, '(confidence:', bestMatch.confidence, ')');
      } else {
        measurements.dietaryRestrictions = '';
      }

      // Allergy detection with improved patterns
      const allergyMatches = [
        ...dietaryPatterns.filter(p => p.source.includes('allerg')),
        /allerg(?:y|ies|ic)\s+to\s+([^.,!?]+)/i
      ].map(pattern => {
        const match = cleanPrompt.match(pattern);
        if (match) {
          const confidence = calculateConfidence(match, cleanPrompt, pattern);
          if (confidence >= CONFIDENCE_THRESHOLD) {
            return { 
              value: match[1].trim(),
              confidence
            };
          }
        }
        return null;
      }).filter(Boolean);

      if (allergyMatches.length > 0) {
        const bestMatch = allergyMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        measurements.allergies = bestMatch.value;
        console.log('Detected allergies:', measurements.allergies, '(confidence:', bestMatch.confidence, ')');
      } else {
        measurements.allergies = '';
      }

      // Health goals with improved categorization
      const goalMatches = healthGoalPatterns.map(pattern => {
        const match = cleanPrompt.match(pattern);
        if (match) {
          const confidence = calculateConfidence(match, cleanPrompt, pattern);
          if (confidence >= CONFIDENCE_THRESHOLD) {
            const goalText = match[0].toLowerCase();
            let healthGoal;
            let contextScore = 1.0;

            // Weight-related goal detection
            const currentWeight = measurements.weight;
            const weightMentioned = goalText.match(/\b(weight|mass|kg|pounds?|lbs?)\b/);
            
            // Goal categorization with context awareness
            if (goalText.match(/\b(gain|bulk|mass|bigger|muscle|more\s*weight|heavier)\b/)) {
              healthGoal = 'muscle_gain';
              if (weightMentioned) contextScore += 0.2;
              if (currentWeight) {
                // If current weight is mentioned, it adds context to the goal
                contextScore += 0.2;
              }
            } else if (goalText.match(/\b(lose|cut|slim|tone|reduce|lighter|leaner)\b/)) {
              healthGoal = 'weight_loss';
              if (weightMentioned) contextScore += 0.2;
              if (currentWeight) {
                contextScore += 0.2;
              }
            } else if (goalText.match(/\b(fit|health|cardio|endurance|better|improve)\b/)) {
              healthGoal = 'get_fit';
              if (goalText.match(/\b(health|fitness|condition)\b/)) contextScore += 0.2;
            } else if (goalText.match(/\b(strong|strength|power|muscle|build)\b/)) {
              healthGoal = 'get_stronger';
              if (goalText.match(/\b(strength|stronger|building)\b/)) contextScore += 0.2;
            } else if (goalText.match(/\b(flexible|mobility|stretch|yoga)\b/)) {
              healthGoal = 'get_flexible';
              if (goalText.match(/\b(flexibility|stretching|mobility)\b/)) contextScore += 0.2;
            } else {
              // Implicit goal detection from context
              if (currentWeight) {
                const bmi = currentWeight / Math.pow((measurements.height || 170) / 100, 2);
                if (bmi < 18.5) {
                  healthGoal = 'muscle_gain';
                  contextScore = 0.7; // Lower confidence for implicit goals
                } else if (bmi > 25) {
                  healthGoal = 'weight_loss';
                  contextScore = 0.7;
                } else {
                  healthGoal = 'get_fit';
                  contextScore = 0.6;
                }
              } else {
                healthGoal = 'get_fit';
                contextScore = 0.5; // Lowest confidence for default goal
              }
            }
            
            // Adjust confidence based on context
            confidence *= contextScore;

            return { value: healthGoal, confidence };
          }
        }
        return null;
      }).filter(Boolean);

      if (goalMatches.length > 0) {
        const bestMatch = goalMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        measurements.healthGoals = bestMatch.value;
        console.log('Detected health goal:', measurements.healthGoals, '(confidence:', bestMatch.confidence, ')');
      } else {
        measurements.healthGoals = 'get_fit';
      }
    },
    
    // Second pass: Context-based extraction
    () => {
      // Look for relationships between measurements
      if (measurements.height && !measurements.weight) {
        // Try to find weight near height mentions
        const heightIndex = cleanPrompt.indexOf(measurements.height.toString());
        if (heightIndex !== -1) {
          const nearbyText = cleanPrompt.substring(Math.max(0, heightIndex - 50), 
                                                 Math.min(cleanPrompt.length, heightIndex + 50));
          weightPatterns.some(pattern => {
            const match = nearbyText.match(pattern);
            if (match) {
              const value = parseFloat(match[1]);
              const unit = match[2];
              const weightInKg = convertToKg(value, unit, 0.7); // Slightly lower confidence for context matches
              if (weightInKg) {
                measurements.weight = weightInKg;
                return true;
              }
            }
            return false;
          });
        }
      }

      // Try to infer missing values from context
      if (!measurements.activityLevel) {
        if (cleanPrompt.includes('gym') || cleanPrompt.includes('workout') || 
            cleanPrompt.includes('exercise') || cleanPrompt.includes('training')) {
          measurements.activityLevel = 'active';
          console.log('Inferred activity level from context:', measurements.activityLevel);
        }
      }
    },

    // Third pass: Validation and cross-referencing
    () => {
      // Validate height-weight relationship
      if (measurements.height && measurements.weight) {
        const bmi = measurements.weight / Math.pow(measurements.height / 100, 2);
        if (bmi < 15 || bmi > 45) {
          // Suspicious BMI, might be wrong units
          console.log('Warning: Suspicious BMI detected:', bmi);
          if (bmi < 15) {
            // Try converting weight from kg to lbs
            measurements.weight = Math.round(measurements.weight * 2.20462);
          } else if (bmi > 45) {
            // Try converting weight from lbs to kg
            measurements.weight = Math.round(measurements.weight / 2.20462);
          }
        }
      }

      // Ensure consistent gender references
      if (measurements.gender) {
        const pronouns = cleanPrompt.match(/\b(he|him|his|she|her|hers|they|them|their)\b/ig);
        if (pronouns) {
          const pronounMap = {
            'male': ['he', 'him', 'his'],
            'female': ['she', 'her', 'hers'],
            'non-binary': ['they', 'them', 'their']
          };
          
          const detectedPronouns = pronouns.map(p => p.toLowerCase());
          const genderFromPronouns = Object.entries(pronounMap).find(([, pronouns]) =>
            detectedPronouns.some(p => pronouns.includes(p))
          )?.[0];

          if (genderFromPronouns && genderFromPronouns !== measurements.gender) {
            console.log('Warning: Gender pronouns mismatch detected');
          }
        }
      }
    }
  ];

  // Run all passes
  passes.forEach(pass => pass());

  console.log('Final extracted measurements:', measurements);
  return measurements;
};

// Check if any measurements were found
export const hasMeasurements = (measurements) => {
  return Object.values(measurements).some(value => value !== null);
};
