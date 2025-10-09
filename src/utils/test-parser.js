import { parsePrompt } from './promptParser.js';

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
  
  // Enhanced regex pattern to catch more variations of END-OF suggestions
  const cleanContent = content.split(/END-OF-PLAN[\s-]?SUGGESTION:|END-OF-PLAN SUGG:|END-OF-PLAN:|END-OF|END OF|end-of|end of|Follow this plan|consistently.*achieve|Closing Recommendation|To achieve your goal|To effectively|RECOMMENDATION:|SUGGESTION:|Note:|Important:|Remember to|Make sure to|Don't forget to|It's important to|You should|Try to|Consider|Keep in mind|Follow this|^Follow$|months to achieve|desired results|Follow this plan consistently|for.*months|achieve your desired|your goal and following|END-OF-PLAN SUGGESTIONS|END-OF-PLAN SUGGEST|SUGGESTION|SUGGEST|RECOMMENDATION|RECOMMEND|CLOSING|CLOSE|FINAL|FINAL NOTE|FINAL SUGGESTION|FINAL RECOMMENDATION/i)[0];
  
  return cleanContent.trim();
};

// Utility function to check if a line contains recommendation/suggestion content
export const isRecommendationContent = (line) => {
  if (!line) return false;
  
  const recommendationPatterns = [
    /Follow this plan/i,
    /Follow this/i,
    /^Follow$/i,
    /consistently.*achieve/i,
    /END-OF-PLAN[\s-]?SUGGESTION/i,
    /END-OF-PLAN SUGG/i,
    /END-OF-PLAN/i,
    /END-OF/i,
    /END OF/i,
    /end-of/i,
    /end of/i,
    /Closing Recommendation/i,
    /To achieve your goal/i,
    /To effectively/i,
    /RECOMMENDATION:/i,
    /SUGGESTION:/i,
    /SUGGESTION/i,
    /SUGGEST/i,
    /RECOMMENDATION/i,
    /RECOMMEND/i,
    /CLOSING/i,
    /CLOSE/i,
    /FINAL/i,
    /FINAL NOTE/i,
    /FINAL SUGGESTION/i,
    /FINAL RECOMMENDATION/i,
    /Note:/i,
    /Important:/i,
    /Remember to/i,
    /Make sure to/i,
    /Don't forget to/i,
    /It's important to/i,
    /You should/i,
    /Try to/i,
    /Consider/i,
    /Keep in mind/i,
    /months to achieve/i,
    /desired results/i,
    /Follow this plan consistently/i,
    /for.*months/i,
    /achieve your desired/i,
    /your goal and following/i,
    /END-OF-PLAN SUGGESTIONS/i,
    /END-OF-PLAN SUGGEST/i
  ];
  
  return recommendationPatterns.some(pattern => pattern.test(line));
};
