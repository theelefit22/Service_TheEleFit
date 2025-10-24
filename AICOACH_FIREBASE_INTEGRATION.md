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
- **Data Structure Compliance**: Data is stored in the exact format specified (timestamp, user email, user name, profile option, conditional data, plan data)
- **Storage Efficiency**: Only necessary data is stored (no extra metadata)
- **Conditional Storage**: Either profile details or free style prompt are stored based on user choice
- **Plan Data Focus**: Only meal and workout plan data is stored (no extra data)
- **History Display**: Users can view their conversation history with request details
- **Metadata Tracking**: Essential metadata is stored for analytics
- **Search Functionality**: Conversations can be searched by content
- **Statistics**: Conversation statistics are available

### Data Captured for Each Interaction:

#### When Profile is Used ('yes'):
- Timestamp
- User email
- User name
- Profile details (age, gender, height, weight, activity level, target weight, timeline)
- Meal plan content (if generated)
- Workout plan content (if generated)

#### When Free Style Prompt is Used ('no'):
- Timestamp
- User email
- User name
- Free style prompt
- Meal plan content (if generated)
- Workout plan content (if generated)

## Usage Example

```javascript
import { saveAiCoachData, fetchAiCoachHistory } from '../services/aicoachService';

// Save a conversation
const conversationId = await saveAiCoachData(
  user.uid,
  "I want to lose weight",
  "Here's your personalized plan...",
  { 
    timestamp: new Date().toISOString(),
    userEmail: "user@example.com",
    userName: "John Doe",
    profileOption: "no",
    freeStylePrompt: "I want to lose weight",
    planData: {
      hasMealPlan: true,
      hasWorkoutPlan: true,
      mealPlanContent: "MEAL_PLAN:\nDay 1: ...",
      workoutPlanContent: "WORKOUT_PLAN:\nDay 1: ..."
    },
    promptLength: 18,
    responseLength: 100
  }
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
7. **Compliance**: Data is stored in the exact format specified
8. **Efficiency**: Only necessary data is stored, reducing storage costs