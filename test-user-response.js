// Test the extractPlanContent function with the actual user response data
function extractPlanContent(response, planType) {
  // Find the start of the plan
  const startIndex = response.indexOf(planType);
  if (startIndex === -1) return null;
  
  // For workout plan, look for more specific end markers
  if (planType === 'WORKOUT_PLAN:') {
    // Look for the end of the workout plan (END-OF-PLAN marker, next MEAL_PLAN, or end of string)
    const endIndexMarkers = [
      response.indexOf('END-OF-PLAN', startIndex),
      response.indexOf('MEAL_PLAN:', startIndex + planType.length),
      response.indexOf('\n\n\n', startIndex), // Triple newline as section separator
      response.length
    ].filter(index => index !== -1); // Remove -1 values
    
    const endIndex = Math.min(...endIndexMarkers);
    const planContent = response.substring(startIndex, endIndex).trim();
    return planContent || null;
  }
  
  // For meal plan, look for the next plan type or end of string
  const nextPlanStart = response.indexOf('WORKOUT_PLAN:', startIndex + planType.length);
  const endIndex = nextPlanStart !== -1 ? nextPlanStart : response.length;
  
  // Extract and return the plan content
  const planContent = response.substring(startIndex, endIndex).trim();
  return planContent || null;
}

// User's actual response from Firebase
const userResponse = `MEAL_PLAN:Day 1:

- Breakfast (295 kcal):

  1. Oats — 50g — 195 kcal

  2. Blueberries — 100g — 55 kcal

  3. Almond milk (unsweetened) — 300ml — 45 kcal

- Lunch (400 kcal):

  1. Brown rice — 195g — 255 kcal

  2. Broccoli — 245g — 85 kcal

  3. Carrot — 145g — 60 kcal

- Snack (105 kcal):

  1. Apple — 145g — 75 kcal

  2. Walnuts — 5g — 30 kcal

- Dinner (340 kcal):

  1. Chapati — 80g — 190 kcal

  2. Dal — 130g — 150 kcal

Total Daily Calories: 1140 kcal

Day 2:

- Breakfast (300 kcal):

  1. Multi-grain toast — 60g — 150 kcal

  2. Cottage cheese — 100g — 100 kcal

  3. Strawberries — 150g — 50 kcal

- Lunch (395 kcal):

  1. Quinoa — 205g — 245 kcal

  2. Spinach — 205g — 50 kcal

  3. Eggplant — 205g — 50 kcal

  4. Zucchini — 255g — 45 kcal

  5. Lemon juice (for dressing) — 20ml — 5 kcal

- Snack (115 kcal):

  1. Banana — 95g — 85 kcal

  2. Pumpkin seeds — 5g — 30 kcal

- Dinner (340 kcal):

  1. Basmati rice — 90g — 115 kcal

  2. Chole — 140g — 200 kcal

  3. Salad (with lemon juice) — 140g — 25 kcal

Total Daily Calories: 1150 kcal

Day 3:

- Breakfast (275 kcal):

  1. Idli — 85g — 115 kcal

  2. Coconut chutney — 35g — 100 kcal

  3. Papaya — 135g — 60 kcal

- Lunch (390 kcal):

  1. Paneer Tikka — 180g — 215 kcal

  2. Cauliflower — 205g — 50 kcal

  3. Peas — 155g — 125 kcal

- Snack (110 kcal):

  1. Guava — 165g — 110 kcal

  2. Skim milk — 15ml — 0 kcal

- Dinner (345 kcal):

  1. Roti — 85g — 200 kcal

  2. Rajma — 85g — 110 kcal

  3. Carrot — 85g — 35 kcal

Total Daily Calories: 1120 kcal

Day 4:

- Breakfast (285 kcal):

  1. Dosa — 90g — 120 kcal

  2. Sambar — 140g — 110 kcal

  3. Mango — 90g — 55 kcal

- Lunch (400 kcal):

  1. Brown rice — 135g — 175 kcal

  2. Tofu — 135g — 195 kcal

  3. Spinach — 135g — 30 kcal

- Snack (125 kcal):

  1. Orange — 200g — 95 kcal

  2. Almonds — 5g — 30 kcal

- Dinner (355 kcal):

  1. Lemon rice — 100g — 150 kcal

  2. Dal — 150g — 175 kcal

  3. Green beans — 100g — 30 kcal

Total Daily Calories: 1165 kcal

Day 5:

- Breakfast (285 kcal):

  1. Paratha — 50g — 125 kcal

  2. Yogurt — 190g — 115 kcal

  3. Apple — 90g — 45 kcal

- Lunch (395 kcal):

  1. Jeera rice — 195g — 250 kcal

  2. Zucchini — 245g — 40 kcal

  3. Matar Paneer — 105g — 105 kcal

- Snack (150 kcal):

  1. Watermelon — 395g — 120 kcal

  2. Cashews — 5g — 30 kcal

- Dinner (330 kcal):

  1. Chapati — 85g — 200 kcal

  2. Paneer Tikka — 85g — 100 kcal

  3. Broccoli — 85g — 30 kcal

Total Daily Calories: 1160 kcal

Day 6:

- Breakfast (280 kcal):

  1. Oats — 40g — 155 kcal

  2. Banana — 90g — 80 kcal

  3. Almond milk (unsweetened) — 290ml — 45 kcal

- Lunch (395 kcal):

  1. Pulao — 145g — 220 kcal

  2. Matar — 145g — 115 kcal

  3. Carrot — 145g — 60 kcal

- Snack (105 kcal):

  1. Apple — 145g — 75 kcal

  2. Walnuts — 5g — 30 kcal

- Dinner (355 kcal):

  1. White rice — 150g — 195 kcal

  2. Rajma — 125g — 160 kcal

Total Daily Calories: 1135 kcal

Day 7:

- Breakfast (285 kcal):

  1. Idli — 115g — 155 kcal

  2. Tomato chutney — 65g — 55 kcal

  3. Papaya — 165g — 70 kcal

  4. Skim milk — 65ml — 5 kcal

- Lunch (400 kcal):

  1. Basmati rice — 120g — 155 kcal

  2. Chole — 170g — 245 kcal

- Snack (125 kcal):

  1. Orange — 200g — 95 kcal

  2. Almonds — 5g — 30 kcal

- Dinner (335 kcal):

  1. Roti — 90g — 215 kcal

  2. Palak Paneer — 75g — 105 kcal

  3. Cucumber salad — 90g — 15 kcal

Total Daily Calories: 1145 kcal

END-OF-PLAN-SUGGESTION: This plan integrates diverse protein sources, including legumes, paneer, and tofu, consistent with maintaining a vegetarian diet. Consider the portion survey to ensure satiation without overeating, keeping aligned with the health goals and target weight of 48 kg over the next 3 weeks.`;

console.log('Testing with user response data...');
console.log('Response length:', userResponse.length);
console.log('Contains MEAL_PLAN:', userResponse.includes('MEAL_PLAN:'));
console.log('Contains WORKOUT_PLAN:', userResponse.includes('WORKOUT_PLAN:'));

console.log('\nExtracting meal plan content...');
const mealPlanContent = extractPlanContent(userResponse, 'MEAL_PLAN:');
console.log('Meal plan content length:', mealPlanContent ? mealPlanContent.length : 0);
console.log('Meal plan content preview:', mealPlanContent ? mealPlanContent.substring(0, 200) + '...' : 'null');

console.log('\nExtracting workout plan content...');
const workoutPlanContent = extractPlanContent(userResponse, 'WORKOUT_PLAN:');
console.log('Workout plan content length:', workoutPlanContent ? workoutPlanContent.length : 0);
console.log('Workout plan content preview:', workoutPlanContent ? workoutPlanContent.substring(0, 200) + '...' : 'null');

console.log('\nTest completed!');