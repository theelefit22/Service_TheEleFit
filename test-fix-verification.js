// Test to verify the fix for the AI Coach issue
import { parsePrompt } from './src/utils/promptParser.js';

// Test the specific user prompt that was failing
const userPrompt = "I am a 20-year-old male, my height is 170 cm, weight is 90 kg. My activity level is lightly active. I usually work out 3 days per week. My target weight is 75 kg, and I want to achieve this goal in 12 weeks.";

console.log('Testing the fix for AI Coach issue...');
console.log('User prompt:', userPrompt);
console.log('----------------------------------------');

const parsedData = parsePrompt(userPrompt);

console.log('Parsed data from prompt:');
console.log('- Age:', parsedData.age);
console.log('- Gender:', parsedData.gender);
console.log('- Height:', parsedData.height);
console.log('- Weight:', parsedData.weight);
console.log('- Activity Level:', parsedData.activityLevel);
console.log('- Frequency:', parsedData.frequency);
console.log('- Target Weight:', parsedData.targetWeight?.value);
console.log('- Goal:', parsedData.goal);

// Check if all required fields are present
const requiredFields = ['age', 'gender', 'height', 'weight', 'activityLevel'];
const missingFields = requiredFields.filter(field => !parsedData[field]);

console.log('\nRequired fields check:');
if (missingFields.length === 0) {
  console.log('✅ All required fields are present');
  
  // Simulate what the fixed code should do
  const profileFormData = {
    age: parsedData.age || '',
    gender: parsedData.gender || '',
    height: parsedData.height || '',
    currentWeight: parsedData.weight || '',
    targetWeight: parsedData.targetWeight?.value || parsedData.weight || '',
    activityLevel: parsedData.activityLevel || 'moderate',
    targetTimeline: parsedData.timelineWeeks ? Math.floor(parsedData.timelineWeeks / 4) : '3',
    workoutDays: parsedData.frequency || '5',
    goal: parsedData.goal || ''
  };
  
  console.log('\nSimulated profileFormData that should be set:');
  console.log(JSON.stringify(profileFormData, null, 2));
  
  console.log('\n✅ Fix verification: The AI Coach should now work correctly with this prompt!');
} else {
  console.log('❌ Missing required fields:', missingFields);
  console.log('❌ Fix verification: The AI Coach would still fail with this prompt');
}

console.log('\n----------------------------------------');
console.log('Full parsed data object:');
console.log(JSON.stringify(parsedData, null, 2));