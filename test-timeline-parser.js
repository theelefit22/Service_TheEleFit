const { parsePrompt } = require('./src/utils/promptParser');

// Test the specific user input
const userInput = "i am 36m,haign 5.5ft and having 60kg want to loose 5kgs weight .i do sedentary activty for 7days a week .give me a plan fro 6months to achgive my goal bt in the use ran meal andworupadn enditn showinf 12weeks ehci is wrong fix that";

console.log('Testing user input:');
console.log('Input:', userInput);
const result = parsePrompt(userInput);
console.log('Parsed result:', JSON.stringify(result, null, 2));

// Test specific timeline patterns
const timelineTests = [
  "give me a plan for 6 months",
  "plan for 12 weeks", 
  "want a plan for 3months",
  "need a 8weeks plan",
  "achieve this goal in 6months",
  "goal: 12weeks plan"
];

console.log('\nTesting timeline patterns:');
timelineTests.forEach((test, index) => {
  console.log(`\nTest ${index + 1}: "${test}"`);
  const result = parsePrompt(test);
  console.log('Timeline:', result.timeline);
  console.log('Timeline weeks:', result.timelineWeeks);
});