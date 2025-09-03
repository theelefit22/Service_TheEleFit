const { extractMeasurements } = require('./src/utils/promptParser');

// Test cases for age and weight detection
const testCases = [
  "I am 75 yrs old and my weight is 39 kgs.",
  "I am 75 years old and my weight is 39 kg",
  "My age is 75 and I weigh 39 kilograms",
  "75 years old, 39kg",
  "Age: 75, Weight: 39 kgs",
  "I'm a 75 year old person weighing 39 kgs",
  "Currently 75 yo and 39 kilos",
  "I am 25 years old and weigh 70 kg",
  "30 yrs old, weight is 65 kgs"
];

console.log('Testing Age and Weight Detection:\n');
console.log('='.repeat(50));

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: "${testCase}"`);
  const result = extractMeasurements(testCase);
  console.log(`  Age: ${result.age || 'Not detected'}`);
  console.log(`  Weight: ${result.weight ? result.weight + ' kg' : 'Not detected'}`);
  console.log(`  DOB: ${result.dateOfBirth || 'Not set'}`);
});

console.log('\n' + '='.repeat(50));
console.log('Test completed');
