// Test the extractPlanContent function logic
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

// Test with the user's example data
const userExample = `MEAL_PLAN:Day 1:

- Breakfast (275 kcal):

  1. Oats — 30g — 115 kcal

  2. Banana — 145g — 130 kcal

  3. Almond milk — 190ml — 30 kcal

- Lunch (390 kcal):

  1. Brown rice — 125g — 160 kcal

  2. Lentils — 155g — 180 kcal

  3. Carrot — 120g — 50 kcal

- Snack (110 kcal):

  1. Apple — 210g — 110 kcal

- Dinner (410 kcal):

  1. Zucchini — 195g — 35 kcal

  2. Tempeh — 145g — 280 kcal

  3. Green beans — 195g — 60 kcal

  4. Walnuts — 5g — 35 kcal

Total Daily Calories: 1185 kcal

Day 2:

- Breakfast (285 kcal):

  1. Multi-grain toast — 80g — 200 kcal

  2. Papaya — 200g — 85 kcal

- Lunch (405 kcal):

  1. Quinoa — 115g — 140 kcal

  2. Broccoli — 165g — 55 kcal

  3. Cauliflower — 155g — 40 kcal

  4. Pumpkin seeds — 30g — 170 kcal

- Snack (135 kcal):

  1. Strawberries — 280g — 90 kcal

  2. Orange — 95g — 45 kcal

- Dinner (340 kcal):

  1. Aloo — 120g — 95 kcal

  2. Dal — 170g — 195 kcal

  3. Palak — 220g — 50 kcal

Total Daily Calories: 1165 kcal

Day 3:

- Breakfast (285 kcal):

  1. Idli — 200g — 270 kcal

  2. Blueberries — 25g — 15 kcal

- Lunch (395 kcal):

  1. Basmati rice — 125g — 160 kcal

  2. Rajma — 175g — 225 kcal

  3. Spinach — 55g — 10 kcal

- Snack (130 kcal):

  1. Almonds — 10g — 60 kcal

  2. Guava — 105g — 70 kcal

- Dinner (345 kcal):

  1. Chapati — 80g — 190 kcal

  2. Matar Paneer — 115g — 115 kcal

  3. Pumpkin seeds — 5g — 30 kcal

  4. Mango — 20g — 10 kcal

Total Daily Calories: 1155 kcal

Day 4:

- Breakfast (290 kcal):

  1. Oats — 50g — 195 kcal

  2. Apple — 185g — 95 kcal

- Lunch (390 kcal):

  1. Paneer Tikka — 220g — 265 kcal

  2. Gobi — 250g — 60 kcal

  3. Green beans — 215g — 65 kcal

- Snack (120 kcal):

  1. Cheddar cheese — 15g — 60 kcal

  2. Pear — 115g — 60 kcal

- Dinner (330 kcal):

  1. Lemon rice — 95g — 140 kcal

  2. Tofu — 90g — 130 kcal

  3. Broccoli — 175g — 60 kcal

Total Daily Calories: 1130 kcal

Day 5:

- Breakfast (290 kcal):

  1. Whole wheat bread — 80g — 200 kcal

  2. Yogurt — 150g — 90 kcal

- Lunch (400 kcal):

  1. Lemon rice — 155g — 230 kcal

  2. Dal — 115g — 135 kcal

  3. Carrot — 90g — 35 kcal

- Snack (110 kcal):

  1. Watermelon — 365g — 110 kcal

- Dinner (340 kcal):

  1. Brown rice — 130g — 170 kcal

  2. Paneer Tikka — 80g — 95 kcal

  3. Cauliflower — 145g — 35 kcal

  4. Orange — 85g — 40 kcal

Total Daily Calories: 1140 kcal

Day 6:

- Breakfast (305 kcal):

  1. Paratha — 80g — 195 kcal

  2. Papaya — 255g — 110 kcal

- Lunch (390 kcal):

  1. Pulao — 130g — 195 kcal

  2. Matar — 140g — 115 kcal

  3. Carrot — 200g — 80 kcal

- Snack (120 kcal):

  1. Banana — 135g — 120 kcal

- Dinner (330 kcal):

  1. Zucchini — 230g — 40 kcal

  2. Eggs (cooked) — 85g — 130 kcal

  3. Mushroom — 195g — 70 kcal

  4. Spinach — 245g — 55 kcal

  5. Walnuts — 5g — 35 kcal

Total Daily Calories: 1145 kcal

Day 7:

- Breakfast (295 kcal):

  1. Dosa — 190g — 255 kcal

  2. Mango — 65g — 40 kcal

- Lunch (395 kcal):

  1. Chole — 180g — 260 kcal

  2. Palak — 280g — 65 kcal

  3. Carrot — 170g — 70 kcal

- Snack (105 kcal):

  1. Orange — 220g — 105 kcal

- Dinner (405 kcal):

  1. Basmati rice — 80g — 105 kcal

  2. Matar Paneer — 110g — 110 kcal

  3. Cottage cheese — 55g — 55 kcal

  4. Green beans — 345g — 105 kcal

  5. Pumpkin seeds — 5g — 30 kcal

Total Daily Calories: 1200 kcal

END-OF-PLAN-SUGGESTION:

This meal plan includes a balanced variety of proteins, grains, and vegetables across the week ensuring nutritional diversity. Consider adjusting portions slightly if energy levels fluctuate, keeping in mind the target weight of 48 kg within 3 weeks for health goals.

WORKOUT_PLAN:
Day 1: Upper Body

1. Push-ups - 3 sets × 12 reps
2. Pull-ups - 3 sets × 8 reps
3. Dumbbell shoulder press - 3 sets × 10 reps
4. Bicep curls - 3 sets × 12 reps
5. Tricep dips - 3 sets × 10 reps

Day 2: Lower Body

1. Squats - 4 sets × 12 reps
2. Lunges - 3 sets × 10 reps each leg
3. Deadlifts - 3 sets × 8 reps
4. Calf raises - 3 sets × 15 reps
5. Leg press - 3 sets × 12 reps

Day 3: Cardio & Core

1. 30-minute run at moderate pace
2. Plank - 3 sets × 45 seconds
3. Russian twists - 3 sets × 20 reps
4. Mountain climbers - 3 sets × 30 reps
5. Bicycle crunches - 3 sets × 20 reps each side

END-OF-PLAN-SUGGESTION:

This workout plan provides a balanced approach to strength and cardio training. Focus on proper form and gradually increase intensity as you progress.`;

console.log('Extracting meal plan content...');
const mealPlanContent = extractPlanContent(userExample, 'MEAL_PLAN:');
console.log('Meal plan content length:', mealPlanContent ? mealPlanContent.length : 0);
console.log('Meal plan content preview:', mealPlanContent ? mealPlanContent.substring(0, 200) + '...' : 'null');

console.log('\nExtracting workout plan content...');
const workoutPlanContent = extractPlanContent(userExample, 'WORKOUT_PLAN:');
console.log('Workout plan content length:', workoutPlanContent ? workoutPlanContent.length : 0);
console.log('Workout plan content preview:', workoutPlanContent ? workoutPlanContent.substring(0, 200) + '...' : 'null');

console.log('\nTest completed successfully!');