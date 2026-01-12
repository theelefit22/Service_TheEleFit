# Firebase Storage Format for AI Coach

This document describes the updated Firebase storage format for AI Coach conversation data, ensuring that data is stored in the exact format specified:

1. Timestamp
2. User email
3. User name
4. Profile option (yes/no)
5. Profile details or free style prompt
6. Meal and workout plan data only (no extra data)

## Updated Data Structure

### Collection: `aicoach`

Each document in the `aicoach` collection represents a single conversation between a user and the AI Coach.

#### Document Structure:
```javascript
{
  userId: string,           // User's Firebase UID
  prompt: string,           // User's input/prompt
  response: string,         // AI's response
  timestamp: Timestamp,     // Firestore server timestamp
  createdAt: Date,          // JavaScript Date object
  metadata: {
    // Required fields
    timestamp: string,              // ISO timestamp string
    userEmail: string,              // User's email address
    userName: string,               // User's display name
    
    // Profile usage tracking
    profileOption: string,          // 'yes' or 'no' - profile usage option
    
    // Conditional data based on profile usage
    profileDetails: {               // Only present when profileOption is 'yes'
      age: number,
      gender: string,
      height: number,
      weight: number,
      activityLevel: string,
      targetWeight: number,
      timeline: number
    } | null,
    
    freeStylePrompt: string,        // Only present when profileOption is 'no'
    
    // Plan data (only meal and workout plan data)
    planData: {
      hasMealPlan: boolean,         // Whether response contains meal plan
      hasWorkoutPlan: boolean,      // Whether response contains workout plan
      mealPlanContent: string,      // Extracted meal plan content
      workoutPlanContent: string    // Extracted workout plan content
    },
    
    // Additional metadata
    promptLength: number,           // Length of the prompt
    responseLength: number,         // Length of the response
  }
}
```

## Implementation Details

### In `AiCoach.js` Component

The `saveConversationData` function has been updated to store data in the correct format:

1. **Timestamp, User Email, and User Name**: These are always stored
2. **Profile Option**: Either 'yes' or 'no' based on whether the user used their profile
3. **Conditional Data**:
   - If profile was used ('yes'): Store profile details
   - If profile was not used ('no'): Store the free style prompt
4. **Plan Data**: Only the meal and workout plan content is stored (no extra data)

### Example Usage

When a user uses their profile:
```javascript
const metadata = {
  timestamp: new Date().toISOString(),
  userEmail: "user@example.com",
  userName: "John Doe",
  profileOption: "yes",
  profileDetails: {
    age: 25,
    gender: "male",
    height: 170,
    weight: 70,
    activityLevel: "moderate",
    targetWeight: 65,
    timeline: 3
  },
  planData: {
    hasMealPlan: true,
    hasWorkoutPlan: true,
    mealPlanContent: "MEAL_PLAN:\nDay 1: ...",
    workoutPlanContent: "WORKOUT_PLAN:\nDay 1: ..."
  },
  promptLength: 120,
  responseLength: 500
};
```

When a user uses a free style prompt:
```javascript
const metadata = {
  timestamp: new Date().toISOString(),
  userEmail: "user@example.com",
  userName: "John Doe",
  profileOption: "no",
  freeStylePrompt: "I want to lose 10 pounds in 3 months...",
  planData: {
    hasMealPlan: true,
    hasWorkoutPlan: true,
    mealPlanContent: "MEAL_PLAN:\nDay 1: ...",
    workoutPlanContent: "WORKOUT_PLAN:\nDay 1: ..."
  },
  promptLength: 120,
  responseLength: 500
};
```

## Benefits of This Implementation

1. **Data Consistency**: All conversations are stored in a consistent format
2. **Storage Efficiency**: Only necessary data is stored (no extra metadata)
3. **Easy Retrieval**: Data can be easily queried based on profile usage
4. **Compliance**: Follows the exact format specified in the requirements
5. **Scalability**: Clean structure allows for easy expansion if needed

## Testing

To verify the implementation:
1. Use the AI Coach with a profile
2. Use the AI Coach with a free style prompt
3. Check Firebase Firestore to verify the data is stored in the correct format