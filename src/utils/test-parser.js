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

// Utility function to clean workout content and remove recommendation/suggestion sections
export const cleanWorkoutContent = (content) => {
  if (!content) return '';
  
  // Split the content and take only the part before any recommendation/suggestion keywords
  const cleanContent = content.split(/END-OF-PLAN SUGGESTION:|Follow this plan|consistently.*achieve|Closing Recommendation|To achieve your goal|To effectively|RECOMMENDATION:|SUGGESTION:|Note:|Important:/i)[0];
  
  return cleanContent.trim();
};

// Utility function to check if a line contains recommendation/suggestion content
export const isRecommendationContent = (line) => {
  if (!line) return false;
  
  const recommendationPatterns = [
    /Follow this plan/i,
    /consistently.*achieve/i,
    /END-OF-PLAN SUGGESTION/i,
    /Closing Recommendation/i,
    /To achieve your goal/i,
    /To effectively/i,
    /RECOMMENDATION:/i,
    /SUGGESTION:/i,
    /Note:/i,
    /Important:/i
  ];
  
  return recommendationPatterns.some(pattern => pattern.test(line));
};
