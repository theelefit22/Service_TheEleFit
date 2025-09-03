// Test script for enhanced prompt parser
import { extractMeasurements } from './src/utils/promptParser.js';

// Test cases with various input formats
const testCases = [
  // Basic formats
  {
    name: "Basic measurements",
    input: "I am 25 years old, 5'10\" tall, weigh 180 lbs, male, moderately active",
    expected: { height: 178, weight: 81.6, gender: 'male', activityLevel: 'moderate' }
  },
  
  // Edge cases with approximations
  {
    name: "Approximations and uncertainty",
    input: "I'm around 30, about 175cm tall, roughly 70kg, probably male, I think I exercise sometimes",
    expected: { height: 175, weight: 70, gender: 'male', activityLevel: 'light' }
  },
  
  // Natural language variations
  {
    name: "Natural language",
    input: "Hey, I'm a 28-year-old woman who stands at approximately 5 feet 6 inches and currently weighs somewhere around 140 pounds",
    expected: { height: 168, weight: 63.5, gender: 'female' }
  },
  
  // Medical context
  {
    name: "Medical context",
    input: "Doctor said I'm 32 years old, measured me at 180cm, scale showed 85kg, male patient",
    expected: { height: 180, weight: 85, gender: 'male' }
  },
  
  // Ranges and uncertainty
  {
    name: "Ranges and between values",
    input: "I'm between 25-30 years old, height is from 170 to 175cm, weight varies between 65-70kg",
    expected: { height: 172, weight: 67 }
  },
  
  // Informal language
  {
    name: "Informal language",
    input: "yo im like 22 or something, pretty tall maybe 6ft, dunno my weight but probably around 160lbs, guy btw",
    expected: { height: 183, weight: 72.6, gender: 'male' }
  },
  
  // Mixed units
  {
    name: "Mixed units",
    input: "Age: 35, Height: 1.75m, Weight: 150lbs, Gender: Female, Activity: Very active",
    expected: { height: 175, weight: 68, gender: 'female', activityLevel: 'very active' }
  },
  
  // Dietary restrictions and goals
  {
    name: "Dietary and goals",
    input: "I'm 40, 170cm, 80kg, male, want to lose weight, allergic to nuts, vegetarian diet",
    expected: { height: 170, weight: 80, gender: 'male', healthGoals: 'weight_loss', allergies: 'nuts', dietaryRestrictions: 'vegetarian' }
  },
  
  // Complex sentence structure
  {
    name: "Complex sentences",
    input: "So basically, I've been thinking about getting fit and I'm currently a 27-year-old male who happens to be about 5'9\" in height and my last weigh-in showed 175 pounds",
    expected: { height: 175, weight: 79.4, gender: 'male', healthGoals: 'get_fit' }
  },
  
  // Typos and misspellings
  {
    name: "Typos and misspellings",
    input: "im 26 yrs old, hieght is 172cm, wieght about 68kgs, femal, want to gain muscel",
    expected: { height: 172, weight: 68, gender: 'female', healthGoals: 'muscle_gain' }
  },
  
  // Numbers written as words
  {
    name: "Written numbers",
    input: "I am twenty-five years old, five feet ten inches tall, weigh one hundred seventy pounds",
    expected: { height: 178, weight: 77.1 }
  },
  
  // Missing information
  {
    name: "Partial information",
    input: "I'm 30 years old and want to get stronger, very active lifestyle",
    expected: { activityLevel: 'very active', healthGoals: 'get_stronger' }
  }
];

// Run tests
console.log('🧪 Testing Enhanced Prompt Parser\n');

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`\n📝 Test ${index + 1}: ${testCase.name}`);
  console.log(`Input: "${testCase.input}"`);
  
  try {
    const result = extractMeasurements(testCase.input);
    console.log('Result:', result);
    
    // Check if expected values match (with tolerance for floating point numbers)
    let testPassed = true;
    const tolerance = 2; // Allow 2 units tolerance for measurements
    
    Object.keys(testCase.expected).forEach(key => {
      const expected = testCase.expected[key];
      const actual = result[key];
      
      if (typeof expected === 'number' && typeof actual === 'number') {
        if (Math.abs(actual - expected) > tolerance) {
          console.log(`❌ ${key}: Expected ${expected}, got ${actual}`);
          testPassed = false;
        } else {
          console.log(`✅ ${key}: ${actual} (within tolerance of ${expected})`);
        }
      } else if (expected !== actual) {
        console.log(`❌ ${key}: Expected "${expected}", got "${actual}"`);
        testPassed = false;
      } else {
        console.log(`✅ ${key}: "${actual}"`);
      }
    });
    
    if (testPassed) {
      console.log('🎉 Test PASSED');
      passedTests++;
    } else {
      console.log('💥 Test FAILED');
    }
    
  } catch (error) {
    console.log('💥 Test FAILED with error:', error.message);
  }
  
  console.log('─'.repeat(60));
});

console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('🎉 All tests passed! The enhanced prompt parser is working correctly.');
} else {
  console.log('⚠️  Some tests failed. The prompt parser may need further improvements.');
}
