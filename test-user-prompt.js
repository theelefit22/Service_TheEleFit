import { parsePrompt } from './src/utils/promptParser.js';

// Test the specific user prompt
const userPrompt = "I am a 20-year-old male, my height is 170 cm, weight is 90 kg. My activity level is lightly active. I usually work out 3 days per week. My target weight is 75 kg, and I want to achieve this goal in 12 weeks.";

console.log('Testing user prompt:', userPrompt);
console.log('----------------------------------------');

const parsedData = parsePrompt(userPrompt);

console.log('Parsed data:');
console.log('Age:', parsedData.age);
console.log('Gender:', parsedData.gender);
console.log('Height:', parsedData.height);
console.log('Weight:', parsedData.weight);
console.log('Activity Level:', parsedData.activityLevel);
console.log('Frequency:', parsedData.frequency);
console.log('Target Weight:', parsedData.targetWeight);
console.log('Timeline:', parsedData.timeline);
console.log('Timeline Weeks:', parsedData.timelineWeeks);

// Check if all required fields are present
const requiredFields = ['age', 'gender', 'height', 'weight', 'activityLevel'];
const missingFields = requiredFields.filter(field => !parsedData[field]);

if (missingFields.length === 0) {
  console.log('\n✅ All required fields extracted successfully!');
  console.log('Ready to calculate calories with extracted data.');
} else {
  console.log('\n❌ Missing required fields:', missingFields);
}

console.log('\n----------------------------------------');
console.log('Full parsed data object:');
console.log(JSON.stringify(parsedData, null, 2));

// Test the specific patterns that should work
const testCases = [
  {
    input: "I am a 20-year-old male, my height is 170 cm, weight is 90 kg. My activity level is lightly active. I usually work out 3 days per week. My target weight is 75 kg, and I want to achieve this goal in 12 weeks.",
    expected: {
      age: 20,
      gender: 'male',
      height: 170,
      weight: 90,
      activityLevel: 'lightly active',
      frequency: 3,
      targetWeight: { value: 75 },
      goal: 'weight_loss' // because target weight < current weight
    }
  }
];

console.log('\n=== Running Test Cases ===');
testCases.forEach((testCase, index) => {
  console.log(`\nTest Case ${index + 1}:`);
  console.log('Input:', testCase.input);
  const result = parsePrompt(testCase.input);
  console.log('Result:', result);
  
  let passed = true;
  for (const [key, expectedValue] of Object.entries(testCase.expected)) {
    if (key === 'targetWeight') {
      if (!result[key] || result[key].value !== expectedValue.value) {
        console.log(`❌ Expected ${key}: ${expectedValue.value}, got: ${result[key]?.value}`);
        passed = false;
      }
    } else if (result[key] !== expectedValue) {
      console.log(`❌ Expected ${key}: ${expectedValue}, got: ${result[key]}`);
      passed = false;
    }
  }
  
  if (passed) {
    console.log('✅ Test passed!');
  } else {
    console.log('❌ Test failed!');
  }
});