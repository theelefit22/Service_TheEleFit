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

  // Refined regex pattern with word boundaries and more specific markers to avoid matching exercise terms like "Close" or "Final"
  const cleanContent = content.split(/\b(?:END-OF-PLAN[\s-]?SUGGESTION|END-OF-PLAN SUGG|END-OF-PLAN|END-OF|END OF)\b[:]?|\b(?:Follow this plan consistently|Closing Recommendation|To achieve your goal|To effectively)\b[:]?|\b(?:RECOMMENDATION|SUGGESTION|CLOSING|FINAL NOTE|FINAL SUGGESTION|FINAL RECOMMENDATION)\b[:]/i)[0];

  return cleanContent.trim();
};

// Utility function to check if a line contains recommendation/suggestion content
export const isRecommendationContent = (line) => {
  if (!line) return false;

  const recommendationPatterns = [
    /\bFollow this plan consistently\b/i,
    /\bEND-OF-PLAN[\s-]?SUGGESTION\b/i,
    /\bEND-OF-PLAN SUGG\b/i,
    /\bEND-OF-PLAN\b/i,
    /\bEND-OF\b/i,
    /\bEND OF\b/i,
    /\bClosing Recommendation\b/i,
    /\bTo achieve your goal\b/i,
    /\bTo effectively\b/i,
    /\bRECOMMENDATION\b[:]/i,
    /\bSUGGESTION\b[:]/i,
    /\bFINAL NOTE\b[:]/i,
    /\bFINAL SUGGESTION\b[:]/i,
    /\bFINAL RECOMMENDATION\b[:]/i,
    /^Note:/i,
    /^Important:/i,
    /^Remember to/i,
    /^Make sure to/i,
    /^Don't forget to/i,
    /^It's important to\b/i
  ];

  return recommendationPatterns.some(pattern => pattern.test(line));
};
