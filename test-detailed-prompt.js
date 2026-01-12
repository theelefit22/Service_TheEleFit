import { parsePrompt } from './src/utils/promptParser.js';

// Test the specific user prompt
const userPrompt = "I am a 20-year-old male, my height is 170 cm, weight is 90 kg. My activity level is lightly active. I usually work out 3 days per week. My target weight is 75 kg, and I want to achieve this goal in 12 weeks.";

console.log('Testing user prompt:', userPrompt);
console.log('----------------------------------------');

const parsedData = parsePrompt(userPrompt);

console.log('Full parsed data from parsePrompt:');
console.log(JSON.stringify(parsedData, null, 2));

console.log('\n----------------------------------------');
console.log('Checking specific fields:');

console.log('Age:', parsedData.age);
console.log('Gender:', parsedData.gender);
console.log('Height:', parsedData.height);
console.log('Weight:', parsedData.weight);
console.log('Activity Level:', parsedData.activityLevel);
console.log('Frequency:', parsedData.frequency);
console.log('Target Weight:', parsedData.targetWeight);
console.log('Timeline:', parsedData.timeline);
console.log('Timeline Weeks:', parsedData.timelineWeeks);

// Now test the extractProfileData function
console.log('\n----------------------------------------');
console.log('Testing extractProfileData function:');

// Simulate the extractProfileData function logic
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

console.log('Extracted data:');
console.log(JSON.stringify(data, null, 2));

console.log('\n----------------------------------------');
console.log('Checking if all required fields are present:');
const requiredFields = ['age', 'gender', 'height', 'weight', 'activityLevel'];
const missingFields = requiredFields.filter(field => !data[field]);

if (missingFields.length === 0) {
  console.log('✅ All required fields extracted successfully!');
} else {
  console.log('❌ Missing required fields:', missingFields);
}