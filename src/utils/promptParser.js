// promptparser.js
export class PromptParser {
  constructor() {
    this.patterns = {
      age: [
        // Shorthand formats like "28M", "25F", "M40", "F22"
        /\b(\d{1,3})\s*[mf]\b/gi,
        /\b[mf]\s*(\d{1,3})\b/gi,
        
        // Standard age patterns
        /(\d{1,3})\s*(?:years?|yrs?|yo|y\.?o\.?|y\/o)(?:\s*old)?/gi,
        /(\d{1,3})[-–~]?year[-–~]old/gi,
        /age\s*[:=]?\s*(\d{1,3})/gi,
        
        // "I am X" patterns
        /i\s+(?:am|'m)\s+(\d{1,3})(?:\s|$|\.|,|;)/gi,
        /i'm\s+(\d{1,3})(?:\s|$|\.|,|;)/gi,
        
        // Standalone age at beginning or after punctuation
        /(?:^|[.!?,]\s*)(\d{1,3})(?:\s*,|\s+(?:years?|yrs?|y\.?o\.?))/gi,
        
        // Just the number followed by comma (common in shorthand)
        /(?:^|\s)(\d{1,3})\s*,(?:\s|$)/gi
      ],
      gender: [
        // Shorthand at beginning like "M40", "F22"
        /^\s*([mf])\d+/gi,
        /\b([mf])(\d{1,3})\b/gi,
        
        // Standard gender patterns
        /\b(male|female|man|woman|boy|girl)\b/gi,
        
        // Single letter M/F
        /\b([mf])\b(?!t\b|eet\b)/gi, // Avoid matching "ft" or "feet"
        
        // Gender with colon/equals
        /gender\s*[:=]?\s*(male|female|m|f)/gi,
        
        // "I am a" patterns
        /i\s+(?:am|'m)\s+(?:a\s+)?(man|woman|boy|girl|male|female)/gi
      ],
      height: [
        // Imperial patterns - feet and inches with various quote styles
        /(\d+)\s*['’`]\s*(\d+)\s*["”]?/gi, // 5'9" or 5'9 or 5’9” format
        /(\d+)\s*['’`]\s*(\d+)\s*(?:inches?|in)?/gi, // 5'9in or 5'9 inches
        /(\d+)\s*(?:ft|feet|foot)\s*(\d+)\s*(?:inches?|in)?/gi, // 5 ft 9 in
        
        // Decimal feet patterns
        /(\d+(?:\.\d+)?)\s*(?:ft|feet|foot)/gi, // 5.4 ft
        /(\d+)\.(\d+)\s*(?:ft|feet|foot)?/gi, // 5.10 (treated as 5'10")
        
        // Apostrophe only patterns (feet only)
        /(\d+)\s*['’`](?:\s*|$)/gi, // 5' format
        
        // Metric patterns
        /(\d{3})\s*(?:cm|centimeters?)?/gi, // 170 cm or just 170 (3 digits likely cm)
        /(\d{2,3})\s*cm/gi, // explicit cm
        
        // Height with label
        /height\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|cm)?/gi
      ],
      weight: [
        // Explicit unit patterns
        /(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)\b/gi,
        /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|lb)\b/gi,
        
        // Shorthand without space: "165lb", "80kg"
        /(\d+)(?:kg|lbs?)\b/gi,
        
        // Weight with label
        /weight\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:kg|lbs?)?/gi,
        
        // Standalone numbers that might be weight (context-dependent)
        // Will be handled in extractWeight logic
      ],
      goal: [
        /\b(lose\s*weight|weight\s*loss|slim\s*down|fat\s*loss|reduce\s*fat|cut\s*fat|drop\s*weight)\b/gi,
        /\b(gain\s*weight|weight\s*gain|bulk\s*up|build\s*muscle|muscle\s*gain|add\s*mass|put\s*on\s*weight)\b/gi,
        /\b(ton(?:e|ing)|tone\s*up|define\s*muscles|sculpt|get\s*toned)\b/gi,
        /\b(maintain|keep|stay|remain)\b/gi,
        /\b(get\s*stronger|strength|build\s*strength|powerlifting)\b/gi,
        /\b(endurance|stamina|cardiovascular|cardio)\b/gi,
        /\b(fitness|health|healthy|wellness|overall\s*health)\b/gi,
        /\b(body\s*recomposition|recomp)\b/gi,
        
        // Enhanced patterns for "want muscle" type phrases
        /\b(want|wanna|need|desire|looking\s+to|aim\s+to|try(?:ing)?\s+to)\s+(?:to\s+)?(muscle|bulk|gain\s+muscle)\b/gi,
        /\b(want|wanna|need|desire|looking\s+to|aim\s+to|try(?:ing)?\s+to)\s+(?:to\s+)?(lose\s+weight|slim\s+down|drop\s+weight|cut\s+fat)\b/gi
      ],
      activity: [
        /\b(running|jogging|walking|hiking)\b/gi,
        /\b(gym|weightlifting|lifting|weights|strength\s*training)\b/gi,
        /\b(yoga|pilates|stretching|flexibility)\b/gi,
        /\b(swimming|cycling|biking|spinning)\b/gi,
        /\b(zumba|dance|dancing|aerobics)\b/gi,
        /\b(boxing|martial\s*arts|fighting|mma)\b/gi,
        /\b(football|soccer|basketball|sports|athletics)\b/gi,
        /\b(hiit|high\s*intensity|interval\s*training)\b/gi,
        /\b(home\s*workouts|bodyweight|calisthenics)\b/gi
      ],
      activityLevel: [
        /\b(sedentary|inactive|not\s*active|desk\s*job|office\s*work)\b/gi,
        /\b(lightly\s*active|light\s*activity|somewhat\s*active|occasionally\s*active)\b/gi,
        /\b(moderately\s*active|moderate\s*activity|fairly\s*active|regularly\s*active)\b/gi,
        /\b(very\s*active|highly\s*active|extremely\s*active|very\s*fit)\b/gi,
        /\b(extra\s*active|super\s*active|athlete|athletic)\b/gi,
        /\b(activity\s*level\s*[:=]?\s*(sedentary|lightly\s*active|moderately\s*active|very\s*active|extra\s*active))\b/gi
      ],
      frequency: [
        /(\d+)\s*(?:times|x)\s*(?:per|a)\s*(?:week|wk)/gi,
        /(\d+)\s*(?:days?)\s*(?:per|a)\s*(?:week|wk)/gi,
        /(\d+)\s*(?:times|x|days?)\s*(?:per|a)\s*(?:week|wk)/gi,
        /work\s*out\s*(\d+)\s*(?:times|x|days?)\s*(?:per|a)\s*(?:week|wk)/gi,
        /exercise\s*(\d+)\s*(?:times|x|days?)\s*(?:per|a)\s*(?:week|wk)/gi,
        /train\s*(\d+)\s*(?:times|x|days?)\s*(?:per|a)\s*(?:week|wk)/gi,
        /(\d+)\s*(?:times|x|days?)\s*(?:per|a)\s*(?:week|wk)\s*(?:workout|exercise|training)/gi,
        /every\s*day|daily|7\s*(?:times|x)\s*(?:per|a)\s*week/gi,
        /(\d+)\s*[-–]\s*(\d+)\s*(?:times|x|days?)\s*(?:per|a)\s*(?:week|wk)/gi,
        /(\d+)\s*(?:times|x|days?)\s*(?:per|a)\s*(?:week|wk)\s*(?:of\s*)?(?:workout|exercise|training|gym)/gi
      ],
      targetWeight: [
        /my\s*target\s*weight\s*is\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/gi,
        /target\s*weight\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/gi,
        /goal\s*weight\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/gi,
        /want\s*to\s*(?:be|reach|get\s*to)\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/gi,
        /reach\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/gi,
        /get\s*to\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/gi,
        /achieve\s*this\s*goal\s*in.*?(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/gi,
        /want\s*to\s*achieve.*?(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/gi,
        /target\s*is\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)/gi,
        // Patterns without units but with weight context
        /my\s*target\s*weight\s*is\s*(\d+(?:\.\d+)?)(?:\s|$|\.|,|;)/gi,
        /target\s*weight\s*[:=]?\s*(\d+(?:\.\d+)?)(?:\s|$|\.|,|;)/gi,
        /goal\s*weight\s*[:=]?\s*(\d+(?:\.\d+)?)(?:\s|$|\.|,|;)/gi
      ],
      timeline: [
        /in\s*(\d+)\s*(?:months?|mo|month)/gi,
        /within\s*(\d+)\s*(?:months?|mo|month)/gi,
        /over\s*(\d+)\s*(?:months?|mo|month)/gi,
        /(\d+)\s*(?:months?|mo|month)\s*(?:time|period|duration)/gi,
        /achieve\s*this\s*goal\s*in\s*(\d+)\s*(?:months?|mo|month)/gi,
        /want\s*to\s*achieve.*?in\s*(\d+)\s*(?:months?|mo|month)/gi,
        /(\d+)\s*(?:weeks?|wk|week)/gi,
        /(\d+)\s*(?:years?|yr|y|year)/gi,
        /in\s*(\d+)\s*(?:weeks?|wk|week)/gi,
        /in\s*(\d+)\s*(?:years?|yr|y|year)/gi
      ]
    };
  }

  parse(prompt) {
    const result = {
      age: null,
      gender: null,
      height: null,
      weight: null,
      goal: null,
      activity: [],
      activityLevel: null,
      frequency: null,
      targetWeight: null,
      timeline: null,
      units: {
        height: 'cm',
        weight: 'kg'
      }
    };

    // Store original prompt for reference
    const originalPrompt = prompt.toLowerCase();
    
    // Extract age
    result.age = this.extractAge(originalPrompt);
    
    // Extract gender
    result.gender = this.extractGender(originalPrompt);
    
    // Extract height and detect units
    const heightResult = this.extractHeight(originalPrompt);
    result.height = heightResult.value;
    result.units.height = heightResult.unit;
    
    // Extract weight and detect units
    const weightResult = this.extractWeight(originalPrompt);
    result.weight = weightResult.value;
    result.units.weight = weightResult.unit;
    
    // Extract goal
    result.goal = this.extractGoal(originalPrompt);
    
    // Extract activity
    result.activity = this.extractActivity(originalPrompt);
    
    // Extract activity level
    result.activityLevel = this.extractActivityLevel(originalPrompt);
    
    // Extract frequency
    result.frequency = this.extractFrequency(originalPrompt);
    
    // Extract target weight
    result.targetWeight = this.extractTargetWeight(originalPrompt);
    
    // Extract timeline
    result.timeline = this.extractTimeline(originalPrompt);
    
    console.log('DEBUG: Final parsed result:', result);

    return result;
  }

  extractAge(text) {
    for (const pattern of this.patterns.age) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const age = parseInt(match[1]);
        if (age && age >= 10 && age <= 120) {
          return age;
        }
      }
    }
    return null;
  }

  extractGender(text) {
    // First check for shorthand formats like "28M", "F25", "M40"
    const shorthandPattern = /\b(\d{1,3})\s*([mf])\b/gi;
    const shorthandMatches = [...text.matchAll(shorthandPattern)];
    for (const match of shorthandMatches) {
      const gender = match[2].toLowerCase();
      if (gender === 'm') return 'male';
      if (gender === 'f') return 'female';
    }
    
    // Check reverse shorthand "M40", "F22"
    const reverseShorthandPattern = /\b([mf])(\d{1,3})\b/gi;
    const reverseMatches = [...text.matchAll(reverseShorthandPattern)];
    for (const match of reverseMatches) {
      const gender = match[1].toLowerCase();
      if (gender === 'm') return 'male';
      if (gender === 'f') return 'female';
    }
    
    // Then check standard patterns
    for (const pattern of this.patterns.gender) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const gender = match[1].toLowerCase();
        if (gender === 'm' || gender === 'male' || gender === 'man' || gender === 'boy') {
          return 'male';
        } else if (gender === 'f' || gender === 'female' || gender === 'woman' || gender === 'girl') {
          return 'female';
        }
      }
    }
    return null;
  }

  extractHeight(text) {
    console.log('DEBUG: Extracting height from text:', text);
    
    // First check for explicit cm patterns (highest priority)
    const explicitCmPattern = /(\d{2,3})\s*(?:cm|centimeters?)/gi;
    const explicitCmMatches = [...text.matchAll(explicitCmPattern)];
    for (const match of explicitCmMatches) {
      const value = parseInt(match[1]);
      if (value >= 140 && value <= 220) {
        console.log('DEBUG: Found explicit height in cm:', value);
        return { value, unit: 'cm' };
      }
    }
    
    // Enhanced feet and inches patterns with various quote styles
    const feetInchesPatterns = [
      /(\d+)\s*[''`]\s*(\d+)\s*[""]?/gi, // 5'9" or 5'9 or 5'9" format
      /(\d+)\s*[''`]\s*(\d+)\s*(?:inches?|in)?/gi, // 5'9in or 5'9 inches
      /(\d+)\s*(?:ft|feet|foot)\s*(\d+)\s*(?:inches?|in)?/gi, // 5 ft 9 in
    ];
    
    for (const pattern of feetInchesPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const feet = parseInt(match[1]);
        const inches = parseInt(match[2]);
        if (feet >= 4 && feet <= 7 && inches >= 0 && inches < 12) {
          return { value: this.feetInchesToCm(feet, inches), unit: 'cm' };
        }
      }
    }
    
    // Check for decimal feet patterns like 5.4 ft, 5.10 ft, 5.11 ft
    const decimalFeetPattern = /(\d+)\.(\d+)\s*(?:ft|feet|foot)?/gi;
    let matches = [...text.matchAll(decimalFeetPattern)];
    for (const match of matches) {
      const wholeFeet = parseInt(match[1]);
      const decimal = match[2];
      
      // Check if it's in the context of height (4-7 feet range)
      if (wholeFeet >= 4 && wholeFeet <= 7) {
        // Check if decimal represents inches (like 5.10 = 5'10", 5.11 = 5'11")
        if (decimal.length <= 2) {
          const inches = parseInt(decimal);
          if (inches >= 0 && inches < 12) {
            return { value: this.feetInchesToCm(wholeFeet, inches), unit: 'cm' };
          }
        }
        // Otherwise treat as decimal feet (5.5 = 5'6")
        const totalFeet = parseFloat(match[0]);
        const fractionalInches = Math.round((totalFeet - wholeFeet) * 12);
        return { value: this.feetInchesToCm(wholeFeet, fractionalInches), unit: 'cm' };
      }
    }
    
    // Check for feet with explicit ft/feet
    const feetPattern = /(\d+)\s*(?:ft|feet|foot)(?:\s+(\d+)\s*(?:in|inches?))?/gi;
    matches = [...text.matchAll(feetPattern)];
    for (const match of matches) {
      const feet = parseInt(match[1]);
      const inches = match[2] ? parseInt(match[2]) : 0;
      if (feet >= 4 && feet <= 7) {
        return { value: this.feetInchesToCm(feet, inches), unit: 'cm' };
      }
    }
    
    // Check for cm patterns (already checked above, but keeping as fallback)
    const cmPattern = /(\d{2,3})\s*(?:cm|centimeters?)/gi;
    matches = [...text.matchAll(cmPattern)];
    for (const match of matches) {
      const value = parseInt(match[1]);
      if (value >= 140 && value <= 220) {
        console.log('DEBUG: Found height in cm (fallback):', value);
        return { value, unit: 'cm' };
      }
    }
    
    // Check for standalone 3-digit numbers (likely cm)
    const threeDigitPattern = /\b(1[4-9]\d|2[0-2]\d)\b(?!\s*(?:lbs?|pounds?|kg|kilos?))/gi;
    matches = [...text.matchAll(threeDigitPattern)];
    for (const match of matches) {
      const value = parseInt(match[1]);
      if (value >= 140 && value <= 220) {
        // Check it's not weight by looking at context
        const beforeMatch = text.substring(Math.max(0, match.index - 10), match.index);
        if (!/weight|weigh|kg|lbs?|pounds?/.test(beforeMatch)) {
          return { value, unit: 'cm' };
        }
      }
    }
    
    // Check for feet with apostrophe (like 5'3)
    const apostrophePattern = /(\d+)\s*['’`](?:\s*|$)/gi;
    matches = [...text.matchAll(apostrophePattern)];
    for (const match of matches) {
      const feet = parseInt(match[1]);
      if (feet >= 4 && feet <= 7) {
        // Assume it's feet only (like 5')
        return { value: this.feetToCm(feet), unit: 'cm' };
      }
    }
    
    // Enhanced parsing for feet/inches with space
    const feetInchesSpacePattern = /(\d+)\s*(?:ft|feet|foot)\s*(\d+)\s*(?:in|inches?)?/gi;
    matches = [...text.matchAll(feetInchesSpacePattern)];
    for (const match of matches) {
      const feet = parseInt(match[1]);
      const inches = parseInt(match[2]);
      if (feet >= 4 && feet <= 7 && inches >= 0 && inches < 12) {
        return { value: this.feetInchesToCm(feet, inches), unit: 'cm' };
      }
    }
    
    return { value: null, unit: 'cm' };
  }

  extractWeight(text) {
    // First try explicit patterns with units
    for (const pattern of this.patterns.weight) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const value = parseFloat(match[1]);
        if (value) {
          const fullMatch = match[0].toLowerCase();
          
          // Check for explicit units
          if (/lbs?|pounds?|lb/.test(fullMatch)) {
            return { value: this.lbsToKg(value), unit: 'kg' };
          } else if (/kg|kilos?|kilograms?/.test(fullMatch)) {
            return { value, unit: 'kg' };
          }
        }
      }
    }
    
    // If no explicit unit found, look for standalone numbers that could be weight
    // This handles cases like "28M, 5.8, 160, want muscle"
    const numberPattern = /\b(\d{2,3})\b(?!\s*(?:cm|years?|yrs?|old|[mf]\b))/gi;
    const matches = [...text.matchAll(numberPattern)];
    
    for (const match of matches) {
      const value = parseFloat(match[1]);
      if (value) {
        // Skip if this number is likely height (already extracted)
        if (value >= 140 && value <= 220) {
          // Could be cm height, check context
          const beforeMatch = text.substring(Math.max(0, match.index - 10), match.index);
          const afterMatch = text.substring(match.index + match[0].length, Math.min(text.length, match.index + match[0].length + 10));
          
          // Skip if surrounded by height indicators
          if (/height|tall|cm/.test(beforeMatch + afterMatch)) {
            continue;
          }
        }
        
        // Make educated guess based on value range
        if (value >= 40 && value <= 150) {
          // Likely kg
          return { value, unit: 'kg' };
        } else if (value >= 90 && value <= 350) {
          // Likely lbs
          return { value: this.lbsToKg(value), unit: 'kg' };
        }
      }
    }
    
    return { value: null, unit: 'kg' };
  }

  extractGoal(text) {
    const lowerText = text.toLowerCase();
    
    // Priority order matters - check more specific patterns first
    
    // Check for weight comparison first (target weight vs current weight)
    const currentWeightMatch = lowerText.match(/(?:weight|weighing)\s*(?:is|of)?\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)?/i);
    const targetWeightMatch = lowerText.match(/(?:target\s*weight|goal\s*weight|want\s*to\s*(?:be|reach|get\s*to)|achieve)\s*(?:is|of)?\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)?/i);
    
    if (currentWeightMatch && targetWeightMatch) {
      const currentWeight = parseFloat(currentWeightMatch[1]);
      const targetWeight = parseFloat(targetWeightMatch[1]);
      
      if (targetWeight < currentWeight) {
        console.log('DEBUG: Detected weight loss goal from weight comparison:', currentWeight, '->', targetWeight);
        return 'weight_loss';
      } else if (targetWeight > currentWeight) {
        console.log('DEBUG: Detected weight gain goal from weight comparison:', currentWeight, '->', targetWeight);
        return 'weight_gain';
      }
    }
    
    // Weight gain patterns (must check before muscle gain)
    if (/\b(gain\s+weight|weight\s+gain|increase\s+weight|put\s+on\s+weight)\b/i.test(lowerText)) {
      return 'weight_gain';
    }
    
    // Weight loss patterns
    if (/\b(lose\s+weight|loose\s+weight|weight\s+loss|slim\s+down|fat\s+loss|reduce\s+fat|cut\s+fat|drop\s+weight|lose\s+fat|loose\s+fat|reduce\s+belly|slim\s+waist|cut\s+fat|fat\s+reduction|lose\s+belly\s+fat|loose\s+belly\s+fat|cutting\s+fat)\b/i.test(lowerText) ||
        (/\bcut\b/i.test(lowerText) && /\b(fat|weight)\b/i.test(lowerText)) ||
        (/\bslim\b/i.test(lowerText) && !(/\bmuscle\b/i.test(lowerText)))) {
      return 'weight_loss';
    }
    
    // Muscle gain patterns - enhanced to catch "want muscle"
    if (/\b(gain\s+muscle|muscle\s+gain|build\s+muscle|bulk\s+up|bulk|add\s+mass|gain\s+lean\s+muscle|increase\s+muscle|muscle\s+building)\b/i.test(lowerText) ||
        (/\bwant\s+to\s+bulk\b/i.test(lowerText)) ||
        (/\bbulk\b/i.test(lowerText) && !(/\bweight\b/i.test(lowerText))) ||
        (/\bwant\s+muscle\b/i.test(lowerText)) ||
        (/\b(want|wanna|need|desire|looking\s+to|aim\s+to|try(?:ing)?\s+to)\s+(?:to\s+)?(muscle|bulk|gain\s+muscle)\b/i.test(lowerText))) {
      return 'muscle_gain';
    }
    
    // Toning patterns
    if (/\b(tone|toning|toned|tone\s+up|tone\s+body|tone\s+muscle|define|sculpt|get\s+toned)\b/i.test(lowerText)) {
      return 'toning';
    }
    
    // Maintenance patterns
    if (/\b(maintain|maintenance|keep|stay|remain)\b/i.test(lowerText) && 
        /\b(weight|fitness|current|shape)\b/i.test(lowerText)) {
      return 'weight_maintenance';
    }
    
    // Strength patterns
    if (/\b(strength|stronger|build\s+strength|powerlifting|get\s+strong|strength\s+training)\b/i.test(lowerText) &&
        !(/\btraining\b/i.test(lowerText) && !/\bstrength\s+training\b/i.test(lowerText))) {
      return 'strength';
    }
    
    // Endurance patterns
    if (/\b(endurance|stamina|cardiovascular|cardio|improve\s+stamina|build\s+endurance)\b/i.test(lowerText)) {
      return 'endurance';
    }
    
    // Body recomposition patterns
    if (/\b(body\s+recomposition|recomp|recomposition)\b/i.test(lowerText)) {
      return 'body_recomposition';
    }
    
    // Fitness patterns (generic)
    if (/\b(fitness|health|healthy|wellness|overall\s+health)\b/i.test(lowerText) && 
        /\b(goal|aim|want|improve)\b/i.test(lowerText)) {
      return 'fitness';
    }
    
    // Additional edge cases
    if (/\bfitness\s+goal\s*:\s*\w+/i.test(lowerText)) {
      // Extract goal after "fitness goal:"
      const goalMatch = lowerText.match(/fitness\s+goal\s*:\s*(\w+)/i);
      if (goalMatch) {
        const goalWord = goalMatch[1];
        if (goalWord.includes('lose') || goalWord.includes('cut') || goalWord.includes('slim')) return 'weight_loss';
        if (goalWord.includes('gain') || goalWord.includes('bulk') || goalWord.includes('muscle')) return 'muscle_gain';
        if (goalWord.includes('maintain')) return 'weight_maintenance';
        if (goalWord.includes('strength')) return 'strength';
        if (goalWord.includes('fitness')) return 'fitness';
      }
    }
    
    // Check for goals after "goal:" or "aim:"
    const goalPatternMatch = lowerText.match(/\b(?:goal|aim)\s*[:=]?\s*([\w\s]+?)(?:[,.]|$)/i);
    if (goalPatternMatch) {
      const goalPhrase = goalPatternMatch[1].trim();
      if (goalPhrase.includes('fat') && (goalPhrase.includes('loss') || goalPhrase.includes('reduction'))) return 'weight_loss';
      if (goalPhrase.includes('weight') && goalPhrase.includes('gain')) return 'weight_gain';
      if (goalPhrase.includes('muscle') && goalPhrase.includes('gain')) return 'muscle_gain';
      if (goalPhrase.includes('maintain')) return 'weight_maintenance';
      if (goalPhrase.includes('strength')) return 'strength';
      if (goalPhrase.includes('endurance')) return 'endurance';
      if (goalPhrase.includes('tone') || goalPhrase.includes('toning')) return 'toning';
      if (goalPhrase.includes('fitness')) return 'fitness';
    }
    
    // Handle shorthand patterns like "want muscle", "want to bulk", etc.
    if (/\b(want|wanna|need|desire|looking\s+to)\s+(?:to\s+)?(bulk|gain\s+muscle|build\s+muscle|add\s+muscle)\b/i.test(lowerText)) {
      return 'muscle_gain';
    }
    
    if (/\b(want|wanna|need|desire|looking\s+to)\s+(?:to\s+)?(lose\s+weight|loose\s+weight|slim\s+down|drop\s+weight|cut\s+fat)\b/i.test(lowerText)) {
      return 'weight_loss';
    }
    
    if (/\b(want|wanna|need|desire|looking\s+to)\s+(?:to\s+)?(tone|tone\s+up|get\s+toned|define)\b/i.test(lowerText)) {
      return 'toning';
    }
    
    if (/\b(want|wanna|need|desire|looking\s+to)\s+(?:to\s+)?(get\s+stronger|build\s+strength|increase\s+strength)\b/i.test(lowerText)) {
      return 'strength';
    }
    
    return null;
  }

  extractActivity(text) {
    const activities = [];
    
    for (const pattern of this.patterns.activity) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const activity = match[0].toLowerCase();
        if (!activities.includes(activity)) {
          activities.push(activity);
        }
      }
    }
    
    return activities;
  }

  extractActivityLevel(text) {
    for (const pattern of this.patterns.activityLevel) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const activityLevel = match[0].toLowerCase();
        
        // Map to standard activity levels
        if (activityLevel.includes('sedentary') || activityLevel.includes('inactive') || activityLevel.includes('desk job') || activityLevel.includes('office work')) {
          return 'sedentary';
        } else if (activityLevel.includes('lightly active') || activityLevel.includes('light activity') || activityLevel.includes('somewhat active') || activityLevel.includes('occasionally active')) {
          return 'lightly active';
        } else if (activityLevel.includes('moderately active') || activityLevel.includes('moderate activity') || activityLevel.includes('fairly active') || activityLevel.includes('regularly active')) {
          return 'moderately active';
        } else if (activityLevel.includes('very active') || activityLevel.includes('highly active') || activityLevel.includes('extremely active') || activityLevel.includes('very fit')) {
          return 'very active';
        } else if (activityLevel.includes('extra active') || activityLevel.includes('super active') || activityLevel.includes('athlete') || activityLevel.includes('athletic')) {
          return 'extra active';
        }
      }
    }
    
    return null;
  }

  extractFrequency(text) {
    console.log('DEBUG: Extracting frequency from text:', text);
    for (const pattern of this.patterns.frequency) {
      const matches = [...text.matchAll(pattern)];
      console.log('DEBUG: Pattern matches:', pattern, matches);
      for (const match of matches) {
        console.log('DEBUG: Processing match:', match);
        if (match[0].includes('every day') || match[0].includes('daily')) {
          console.log('DEBUG: Found daily/every day, returning 7');
          return 7;
        } else if (match[1] && match[2]) {
          // Range (e.g., 3-4 times per week)
          const min = parseInt(match[1]);
          const max = parseInt(match[2]);
          const result = Math.round((min + max) / 2);
          console.log('DEBUG: Found range, returning:', result);
          return result;
        } else if (match[1]) {
          // Single value (e.g., 3 times per week)
          const result = parseInt(match[1]);
          console.log('DEBUG: Found single value, returning:', result);
          return result;
        }
      }
    }
    console.log('DEBUG: No frequency found, returning null');
    return null;
  }

  extractTargetWeight(text) {
    console.log('DEBUG: Extracting target weight from text:', text);
    for (const pattern of this.patterns.targetWeight) {
      const matches = [...text.matchAll(pattern)];
      console.log('DEBUG: Target weight pattern matches for pattern', pattern, ':', matches);
      for (const match of matches) {
        console.log('DEBUG: Processing target weight match:', match);
        const value = parseFloat(match[1]);
        if (value && value >= 30 && value <= 300) { // Reasonable weight range
          const fullMatch = match[0].toLowerCase();
          console.log('DEBUG: Full match text:', fullMatch);
          
          // Check for explicit units
          if (/lbs?|pounds?|lb/.test(fullMatch)) {
            console.log('DEBUG: Found target weight in lbs, converting to kg:', value);
            return { value: this.lbsToKg(value), unit: 'kg' };
          } else if (/kg|kilos?|kilograms?/.test(fullMatch)) {
            console.log('DEBUG: Found target weight in kg:', value);
            return { value, unit: 'kg' };
          } else {
            // Default to kg if no unit specified but validate range
            if (value >= 30 && value <= 200) { // Reasonable kg range
              console.log('DEBUG: Found target weight with no unit, defaulting to kg:', value);
              return { value, unit: 'kg' };
            } else {
              console.log('DEBUG: Target weight value out of reasonable range, skipping:', value);
            }
          }
        }
      }
    }
    console.log('DEBUG: No target weight found, returning null');
    return null;
  }

  extractTimeline(text) {
    console.log('DEBUG: Extracting timeline from text:', text);
    for (const pattern of this.patterns.timeline) {
      const matches = [...text.matchAll(pattern)];
      console.log('DEBUG: Timeline pattern matches:', pattern, matches);
      for (const match of matches) {
        console.log('DEBUG: Processing timeline match:', match);
        const value = parseInt(match[1]);
        if (value) {
          const fullMatch = match[0].toLowerCase();
          
          // Determine unit and convert to weeks
          if (fullMatch.includes('year') || fullMatch.includes('yr') || fullMatch.includes('y')) {
            console.log('DEBUG: Found timeline in years, converting to weeks:', value);
            return { value: value * 52, unit: 'weeks' };
          } else if (fullMatch.includes('month') || fullMatch.includes('mo')) {
            console.log('DEBUG: Found timeline in months, converting to weeks:', value);
            return { value: value * 4, unit: 'weeks' };
          } else if (fullMatch.includes('week') || fullMatch.includes('wk')) {
            console.log('DEBUG: Found timeline in weeks:', value);
            return { value, unit: 'weeks' };
          }
        }
      }
    }
    console.log('DEBUG: No timeline found, returning null');
    return null;
  }

  // Conversion utilities
  feetToCm(feet) {
    return Math.round(feet * 30.48);
  }

  feetInchesToCm(feet, inches) {
    return Math.round(feet * 30.48 + inches * 2.54);
  }

  lbsToKg(lbs) {
    // More precise conversion that matches expected test values
    const kg = lbs * 0.45359237;
    // Round to nearest whole number as per test expectations
    return Math.round(kg);
  }
}

// Utility function to parse prompts
export const parsePrompt = (prompt) => {
  const parser = new PromptParser();
  return parser.parse(prompt);
};

// Test function specifically for the failing test cases
export const testSpecificCases = () => {
  const testCases = [
    // The failing test cases
    { input: "Woman 22, 5’3”, goal: gain weight.", expected: { age: 22, gender: "female", height: 160, goal: "weight_gain" } },
    { input: "29F, 5’5”, goal: slim.", expected: { age: 29, gender: "female", height: 165, goal: "weight_loss" } },
    { input: "Woman 22, 5'3\", goal: gain weight.", expected: { age: 22, gender: "female", height: 160, goal: "weight_gain" } },
    { input: "29F, 5'5\", goal: slim.", expected: { age: 29, gender: "female", height: 165, goal: "weight_loss" } }
  ];

  console.log("Testing specific failing cases...");
  testCases.forEach((testCase, index) => {
    console.log(`\nTest case ${index + 1}: "${testCase.input}"`);
    try {
      const result = parsePrompt(testCase.input);
      console.log("Parsed result:", result);
      
      // Check if it matches expected
      let passed = true;
      for (const [key, value] of Object.entries(testCase.expected)) {
        if (result[key] !== value) {
          console.log(`❌ Mismatch: ${key}: expected ${value}, got ${result[key]}`);
          passed = false;
        }
      }
      
      if (passed) {
        console.log("✅ Test passed!");
      } else {
        console.log("❌ Test failed!");
      }
    } catch (error) {
      console.error("Error parsing:", error);
    }
  });
};

// Export default for convenience
export default PromptParser;