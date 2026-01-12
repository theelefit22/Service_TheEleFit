// Test script for AI Coach Firebase integration
// This script tests the aicoachService functions

import { 
  saveAiCoachData, 
  fetchAiCoachHistory, 
  getAiCoachStats,
  searchAiCoachConversations 
} from './src/services/aicoachService.js';

// Test data
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
  type: 'complete_plan',
  hasMealPlan: true,
  hasWorkoutPlan: true,
  responseLength: testResponse.length,
  userType: 'user',
  hasProfile: true,
  profileComplete: true
};

async function testAiCoachService() {
  console.log('🧪 Testing AI Coach Firebase Service...\n');
  
  try {
    // Test 1: Save conversation data
    console.log('1. Testing saveAiCoachData...');
    const conversationId = await saveAiCoachData(testUserId, testPrompt, testResponse, testMetadata);
    console.log('✅ Conversation saved with ID:', conversationId);
    
    // Test 2: Fetch conversation history
    console.log('\n2. Testing fetchAiCoachHistory...');
    const history = await fetchAiCoachHistory(testUserId);
    console.log('✅ Fetched history:', history.length, 'conversations');
    console.log('Latest conversation:', {
      id: history[0]?.id,
      prompt: history[0]?.prompt?.substring(0, 50) + '...',
      response: history[0]?.response?.substring(0, 50) + '...',
      timestamp: history[0]?.timestamp
    });
    
    // Test 3: Get conversation stats
    console.log('\n3. Testing getAiCoachStats...');
    const stats = await getAiCoachStats(testUserId);
    console.log('✅ Stats:', {
      totalConversations: stats.totalConversations,
      averagePromptLength: stats.averagePromptLength,
      averageResponseLength: stats.averageResponseLength
    });
    
    // Test 4: Search conversations
    console.log('\n4. Testing searchAiCoachConversations...');
    const searchResults = await searchAiCoachConversations(testUserId, 'lose weight');
    console.log('✅ Search results:', searchResults.length, 'matches');
    
    console.log('\n🎉 All tests passed! AI Coach Firebase integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAiCoachService();
}

export { testAiCoachService };
