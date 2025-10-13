# AI Coach Firebase Integration

This document describes the Firebase integration for storing and retrieving AI Coach conversation data.

## Overview

The AI Coach Firebase integration allows the application to:
- Store user prompts and AI responses in a Firebase Firestore database
- Retrieve conversation history for users
- Provide conversation statistics and search functionality
- Maintain conversation metadata for analytics

## Database Structure

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
    // User identification
    userName: string,               // User's display name
    userEmail: string,              // User's email address
    userType: string,               // User type (e.g., 'user', 'expert')
    
    // Profile usage tracking
    usedProfile: boolean,           // Whether user profile was used
    profileOption: string,          // 'yes' or 'no' - profile usage option
    
    // Form details (what was sent to frontend)
    formDetails: {
      fitnessGoal: string,          // User's fitness goal prompt
      formData: object,             // Form data from UI
      profileFormData: object,      // Profile form data
      extractedProfileData: object, // Data extracted from prompt
      userProfileData: object,      // Complete user profile data
      calculatedCalories: object,   // Calculated calorie data
    },
    
    // Backend parameters (if no profile used)
    backendParameters: {
      prompt: string,               // Original prompt sent to backend
      userDetails: object,          // User details sent to backend
      endpoint: string,             // Backend endpoint used
      // For meal plans:
      targetCalories?: number,      // Target calories for meal plan
      dietaryRestrictions?: array,  // Dietary restrictions
      allergies?: array,           // Allergies
      healthGoals?: string,        // Health goals
      targetWeight?: number,       // Target weight
      timelineWeeks?: number,      // Timeline in weeks
      // For workout plans:
      goal?: string,               // Fitness goal
      workout_focus?: string,      // Workout focus
      workout_days?: number,       // Number of workout days
    } | null,                      // null if profile was used
    
    // Response data (meal plan, workout plan data sent to frontend)
    responseData: {
      type: string,                 // Type of response (e.g., 'complete_plan', 'meal_plan', 'workout_plan')
      hasMealPlan: boolean,         // Whether response contains meal plan
      hasWorkoutPlan: boolean,      // Whether response contains workout plan
      mealPlansByDay: array,        // Meal plans data sent to frontend
      workoutSections: array,       // Workout sections data sent to frontend
      endOfPlanSuggestion: string,  // End of plan suggestion
      streaming: boolean,           // Whether response was streamed
      completedDays: number,        // Number of completed days (for meal plans)
    },
    
    // Additional metadata
    timestamp: string,              // ISO timestamp string
    promptLength: number,           // Length of the prompt
    responseLength: number,         // Length of the response
  }
}
```

## Service Functions

### `saveAiCoachData(userId, prompt, response, metadata)`
Saves a conversation to Firebase.

**Parameters:**
- `userId` (string): The user's Firebase UID
- `prompt` (string): The user's input/prompt
- `response` (string): The AI's response
- `metadata` (object, optional): Additional metadata

**Returns:** Promise<string> - Document ID of the saved conversation

### `fetchAiCoachHistory(userId, limit)`
Retrieves conversation history for a user.

**Parameters:**
- `userId` (string): The user's Firebase UID
- `limit` (number, optional): Maximum number of conversations to fetch (default: 50)

**Returns:** Promise<Array> - Array of conversation objects

### `getAiCoachConversation(conversationId)`
Gets a specific conversation by ID.

**Parameters:**
- `conversationId` (string): The conversation document ID

**Returns:** Promise<Object|null> - Conversation object or null if not found

### `updateAiCoachConversation(conversationId, updateData)`
Updates an existing conversation.

**Parameters:**
- `conversationId` (string): The conversation document ID
- `updateData` (object): Data to update

**Returns:** Promise<void>

### `deleteAiCoachConversation(conversationId)`
Deletes a conversation.

**Parameters:**
- `conversationId` (string): The conversation document ID

**Returns:** Promise<void>

### `getAiCoachStats(userId)`
Gets conversation statistics for a user.

**Parameters:**
- `userId` (string): The user's Firebase UID

**Returns:** Promise<Object> - Statistics object

### `searchAiCoachConversations(userId, searchTerm)`
Searches conversations by content.

**Parameters:**
- `userId` (string): The user's Firebase UID
- `searchTerm` (string): Term to search for

**Returns:** Promise<Array> - Array of matching conversations

## Integration in AiCoach Component

The AI Coach component automatically:
1. Loads conversation history when the user is authenticated
2. Saves conversation data after each AI response with comprehensive details
3. Displays conversation history in a collapsible section
4. Shows conversation metadata, timestamps, and request parameters

### Key Features:
- **Comprehensive Data Storage**: All AI responses are saved with complete request parameters
- **Backend Parameter Tracking**: Every parameter sent to backend APIs is stored
- **User Profile Integration**: Complete user profile data is included
- **Request/Response Mapping**: Full traceability of what was sent and received
- **History Display**: Users can view their conversation history with request details
- **Metadata Tracking**: Rich metadata is stored for analytics
- **Search Functionality**: Conversations can be searched by content
- **Statistics**: Conversation statistics are available

### Data Captured for Each Interaction:

#### 1. **Complete Plan Generation**
- User prompt
- User details (age, weight, height, gender, activity level, goal, target weight, timeline)
- Backend endpoint used
- Complete AI response
- Profile completion status

#### 2. **Meal Plan Generation**
- Target calories
- Dietary restrictions and allergies
- Health goals
- Target weight and timeline
- Streaming status and completed days
- Complete meal plan response

#### 3. **Workout Plan Generation**
- Fitness goal and workout focus
- Number of workout days
- Target weight and timeline
- Streaming status
- Complete workout plan response

#### 4. **Calorie Calculations**
- User details for TDEE calculation
- Calculated calorie data
- BMR, TDEE, and macro breakdowns
- Goal-specific recommendations

## Usage Example

```javascript
import { saveAiCoachData, fetchAiCoachHistory } from '../services/aicoachService';

// Save a conversation
const conversationId = await saveAiCoachData(
  user.uid,
  "I want to lose weight",
  "Here's your personalized plan...",
  { type: 'complete_plan', hasMealPlan: true }
);

// Fetch conversation history
const history = await fetchAiCoachHistory(user.uid);
console.log('User has', history.length, 'conversations');
```

## Security Rules

Make sure to add appropriate Firestore security rules for the `aicoach` collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /aicoach/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

## Testing

Run the test script to verify the integration:

```bash
node test-aicoach-firebase.js
```

This will test all the service functions and verify that the Firebase integration is working correctly.

## Benefits

1. **Data Persistence**: All conversations are saved and can be retrieved
2. **User Experience**: Users can view their conversation history
3. **Analytics**: Rich metadata enables detailed analytics
4. **Search**: Users can search through their past conversations
5. **Scalability**: Firebase handles scaling automatically
6. **Real-time**: Data is available in real-time across devices
