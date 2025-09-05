const { parsePrompt } = require('./promptParser.js');

const testPrompt = 'I am a 25-year-old male, my height is 175 cm, weight is 80 kg. My activity level is moderately active. I usually work out 4 days per week. My target weight is 70 kg, and I want to achieve this goal in 12 weeks.';

console.log('Testing prompt parser with user input:');
console.log('Input:', testPrompt);
console.log('\nParsed result:');
const result = parsePrompt(testPrompt);
console.log(JSON.stringify(result, null, 2));

// Test the extractProfileData function logic
const data = {};
if (result.frequency) {
  data.workoutDays = result.frequency.toString();
}
console.log('\nExtracted workoutDays:', data.workoutDays);
