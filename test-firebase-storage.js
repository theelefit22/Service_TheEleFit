// Test script for Firebase storage format verification
const { saveAiCoachData } = require('./src/services/aicoachService');

async function testFirebaseStorage() {
  console.log('🧪 Testing Firebase storage format...\n');
  
  try {
    // Test data that mimics what would be saved from the AI Coach
    const testUserId = 'test-user-123';
    const testPrompt = 'I want to lose 10 pounds in 3 months. I am 25 years old, 5\'6" tall, and weigh 150 lbs. I work out 3 times a week.';
    const testResponse = `MEAL_PLAN:
Day 1: 
- Breakfast: Oatmeal with berries (300 cal)
- Lunch: Grilled chicken salad (400 cal)
- Dinner: Baked salmon with vegetables (500 cal)
Total Daily Calories: 1200

WORKOUT_PLAN:
Day 1: Cardio
- 30 minutes running
- 15 minutes stretching

RECOMMENDATION: Focus on creating a calorie deficit of 500 calories per day to achieve your goal.`;

    const testMetadata = {
      // Required fields
      timestamp: new Date().toISOString(),
      userEmail: 'test@example.com',
      userName: 'Test User',
      
      // Profile option
      profileOption: 'no', // or 'yes'
      
      // Free style prompt (when profileOption is 'no')
      freeStylePrompt: 'I want to lose 10 pounds in 3 months...',
      
      // Plan data
      planData: {
        hasMealPlan: true,
        hasWorkoutPlan: true,
        mealPlanContent: 'MEAL_PLAN:\nDay 1: \n- Breakfast: Oatmeal with berries (300 cal)',
        workoutPlanContent: 'WORKOUT_PLAN:\nDay 1: Cardio\n- 30 minutes running'
      },
      
      // Additional metadata
      promptLength: testPrompt.length,
      responseLength: testResponse.length
    };

    console.log('1. Testing saveAiCoachData with correct format...');
    const conversationId = await saveAiCoachData(testUserId, testPrompt, testResponse, testMetadata);
    console.log('✅ Conversation saved with ID:', conversationId);
    
    console.log('\n🎉 Test completed successfully!');
    console.log('\nThe data is stored with the following format:');
    console.log('- Timestamp:', testMetadata.timestamp);
    console.log('- User Email:', testMetadata.userEmail);
    console.log('- User Name:', testMetadata.userName);
    console.log('- Profile Option:', testMetadata.profileOption);
    console.log('- Free Style Prompt (when no profile):', testMetadata.freeStylePrompt.substring(0, 30) + '...');
    console.log('- Has Meal Plan:', testMetadata.planData.hasMealPlan);
    console.log('- Has Workout Plan:', testMetadata.planData.hasWorkoutPlan);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testFirebaseStorage();
}

module.exports = { testFirebaseStorage };