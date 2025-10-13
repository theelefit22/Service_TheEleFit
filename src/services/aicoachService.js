import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Save AI Coach conversation data to Firebase
 * @param {string} userId - The user's UID
 * @param {string} prompt - The user's input/prompt
 * @param {string} response - The AI's response
 * @param {Object} metadata - Additional metadata (optional)
 * @returns {Promise<string>} - Document ID of the saved conversation
 */
export const saveAiCoachData = async (userId, prompt, response, metadata = {}) => {
  try {
    console.log('Saving AI Coach data to Firebase:', { userId, prompt: prompt.substring(0, 100) + '...', response: response.substring(0, 100) + '...' });
    
    if (!userId) {
      throw new Error('User ID is required to save AI Coach data');
    }
    
    if (!prompt || !response) {
      throw new Error('Both prompt and response are required');
    }

    const conversationData = {
      userId: userId,
      prompt: prompt,
      response: response,
      timestamp: serverTimestamp(),
      createdAt: new Date(),
      metadata: {
        promptLength: prompt.length,
        responseLength: response.length,
        ...metadata
      }
    };

    // Log the comprehensive data being saved
    console.log('Comprehensive conversation data structure:', {
      userId: conversationData.userId,
      promptLength: conversationData.prompt.length,
      responseLength: conversationData.response.length,
      metadataKeys: Object.keys(conversationData.metadata),
      hasRequestParams: !!conversationData.metadata.requestParams,
      hasUserProfileData: !!conversationData.metadata.userProfileData,
      hasCalculatedCalories: !!conversationData.metadata.calculatedCalories
    });

    const docRef = await addDoc(collection(db, 'aicoach'), conversationData);
    console.log('AI Coach data saved successfully with ID:', docRef.id);
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving AI Coach data:', error);
    throw error;
  }
};

/**
 * Fetch AI Coach conversation history for a user
 * @param {string} userId - The user's UID
 * @param {number} limit - Maximum number of conversations to fetch (default: 50)
 * @returns {Promise<Array>} - Array of conversation objects
 */
export const fetchAiCoachHistory = async (userId, limit = 50) => {
  try {
    console.log('Fetching AI Coach history for user:', userId);
    
    if (!userId) {
      throw new Error('User ID is required to fetch AI Coach history');
    }

    // Try with orderBy first, fallback to without orderBy if index doesn't exist
    let q;
    try {
      q = query(
        collection(db, 'aicoach'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc')
      );
    } catch (indexError) {
      console.log('Index not found, trying without orderBy:', indexError);
      // Fallback: query without orderBy and sort in memory
      q = query(
        collection(db, 'aicoach'),
        where('userId', '==', userId)
      );
    }

    const querySnapshot = await getDocs(q);
    const conversations = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamp to JavaScript Date
        timestamp: data.timestamp?.toDate() || data.createdAt,
        createdAt: data.createdAt
      });
    });

    // Sort by timestamp if we didn't use orderBy
    if (!q._query.orderBy || q._query.orderBy.length === 0) {
      conversations.sort((a, b) => {
        const timeA = new Date(a.timestamp || a.createdAt);
        const timeB = new Date(b.timestamp || b.createdAt);
        return timeB - timeA; // Newest first
      });
    }

    // Limit results
    const limitedConversations = conversations.slice(0, limit);
    console.log(`Fetched ${limitedConversations.length} AI Coach conversations`);
    console.log('Sample conversation:', limitedConversations[0]);
    
    return limitedConversations;
  } catch (error) {
    console.error('Error fetching AI Coach history:', error);
    // Return empty array instead of throwing to prevent UI crashes
    return [];
  }
};

/**
 * Get a specific AI Coach conversation by ID
 * @param {string} conversationId - The conversation document ID
 * @returns {Promise<Object|null>} - Conversation object or null if not found
 */
export const getAiCoachConversation = async (conversationId) => {
  try {
    console.log('Fetching AI Coach conversation:', conversationId);
    
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const docRef = doc(db, 'aicoach', conversationId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        timestamp: data.timestamp?.toDate() || data.createdAt,
        createdAt: data.createdAt
      };
    } else {
      console.log('No conversation found with ID:', conversationId);
      return null;
    }
  } catch (error) {
    console.error('Error fetching AI Coach conversation:', error);
    throw error;
  }
};

/**
 * Update an existing AI Coach conversation
 * @param {string} conversationId - The conversation document ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<void>}
 */
export const updateAiCoachConversation = async (conversationId, updateData) => {
  try {
    console.log('Updating AI Coach conversation:', conversationId);
    
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const docRef = doc(db, 'aicoach', conversationId);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: new Date()
    });
    
    console.log('AI Coach conversation updated successfully');
  } catch (error) {
    console.error('Error updating AI Coach conversation:', error);
    throw error;
  }
};

/**
 * Delete an AI Coach conversation
 * @param {string} conversationId - The conversation document ID
 * @returns {Promise<void>}
 */
export const deleteAiCoachConversation = async (conversationId) => {
  try {
    console.log('Deleting AI Coach conversation:', conversationId);
    
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const docRef = doc(db, 'aicoach', conversationId);
    await deleteDoc(docRef);
    
    console.log('AI Coach conversation deleted successfully');
  } catch (error) {
    console.error('Error deleting AI Coach conversation:', error);
    throw error;
  }
};

/**
 * Get AI Coach conversation statistics for a user
 * @param {string} userId - The user's UID
 * @returns {Promise<Object>} - Statistics object
 */
export const getAiCoachStats = async (userId) => {
  try {
    console.log('Fetching AI Coach stats for user:', userId);
    
    if (!userId) {
      throw new Error('User ID is required to fetch AI Coach stats');
    }

    const conversations = await fetchAiCoachHistory(userId, 1000); // Get more for stats
    
    const stats = {
      totalConversations: conversations.length,
      totalPrompts: conversations.length,
      totalResponses: conversations.length,
      averagePromptLength: 0,
      averageResponseLength: 0,
      firstConversation: null,
      lastConversation: null,
      conversationsByMonth: {}
    };

    if (conversations.length > 0) {
      // Calculate averages
      const totalPromptLength = conversations.reduce((sum, conv) => sum + (conv.metadata?.promptLength || 0), 0);
      const totalResponseLength = conversations.reduce((sum, conv) => sum + (conv.metadata?.responseLength || 0), 0);
      
      stats.averagePromptLength = Math.round(totalPromptLength / conversations.length);
      stats.averageResponseLength = Math.round(totalResponseLength / conversations.length);
      
      // Get first and last conversations
      stats.firstConversation = conversations[conversations.length - 1]; // Oldest
      stats.lastConversation = conversations[0]; // Newest
      
      // Group by month
      conversations.forEach(conv => {
        const date = new Date(conv.timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        stats.conversationsByMonth[monthKey] = (stats.conversationsByMonth[monthKey] || 0) + 1;
      });
    }

    console.log('AI Coach stats calculated:', stats);
    return stats;
  } catch (error) {
    console.error('Error fetching AI Coach stats:', error);
    throw error;
  }
};

/**
 * Search AI Coach conversations by content
 * @param {string} userId - The user's UID
 * @param {string} searchTerm - Term to search for
 * @returns {Promise<Array>} - Array of matching conversations
 */
export const searchAiCoachConversations = async (userId, searchTerm) => {
  try {
    console.log('Searching AI Coach conversations:', { userId, searchTerm });
    
    if (!userId) {
      throw new Error('User ID is required to search AI Coach conversations');
    }
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new Error('Search term must be at least 2 characters long');
    }

    const conversations = await fetchAiCoachHistory(userId, 1000); // Get more for search
    
    const searchTermLower = searchTerm.toLowerCase();
    const matchingConversations = conversations.filter(conv => 
      conv.prompt.toLowerCase().includes(searchTermLower) ||
      conv.response.toLowerCase().includes(searchTermLower)
    );

    console.log(`Found ${matchingConversations.length} matching conversations`);
    return matchingConversations;
  } catch (error) {
    console.error('Error searching AI Coach conversations:', error);
    throw error;
  }
};
