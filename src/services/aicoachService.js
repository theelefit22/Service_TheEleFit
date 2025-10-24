import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Save AI Coach conversation data to Firebase Firestore
 * @param {string} userId - The user's Firebase UID
 * @param {string} prompt - The user's input/prompt
 * @param {string} response - The AI's response
 * @param {object} metadata - Additional metadata
 * @returns {Promise<string>} - Document ID of the saved conversation
 */
export const saveAiCoachData = async (userId, prompt, response, metadata = {}) => {
  try {
    // First, check if a conversation with the same prompt already exists for this user
    // within the last few minutes (to handle streaming responses)
    const recentThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    const q = query(
      collection(db, 'aicoach'),
      where('userId', '==', userId),
      where('prompt', '==', prompt)
    );
    
    const querySnapshot = await getDocs(q);
    let existingConversation = null;
    
    // Look for a recent conversation with the same prompt
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);
      
      // If this conversation is recent, consider it the same conversation
      if (timestamp > recentThreshold) {
        existingConversation = { id: doc.id, ...data };
      }
    });
    
    const conversationData = {
      userId,
      prompt,
      response,
      timestamp: serverTimestamp(),
      createdAt: new Date(),
      metadata
    };

    let docRef;
    
    if (existingConversation) {
      // Update existing conversation instead of creating a new one
      console.log('Updating existing conversation with ID:', existingConversation.id);
      const docRefToUpdate = doc(db, 'aicoach', existingConversation.id);
      await updateDoc(docRefToUpdate, conversationData);
      docRef = { id: existingConversation.id };
    } else {
      // Create new conversation
      console.log('Creating new conversation');
      docRef = await addDoc(collection(db, 'aicoach'), conversationData);
    }
    
    console.log('Conversation saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
};

/**
 * Fetch AI Coach conversation history for a user
 * @param {string} userId - The user's Firebase UID
 * @param {number} limitCount - Maximum number of conversations to fetch (default: 50)
 * @returns {Promise<Array>} - Array of conversation objects
 */
export const fetchAiCoachHistory = async (userId, limitCount = 50) => {
  try {
    // Create query to fetch user's conversations without orderBy first to avoid index issues
    let q = query(
      collection(db, 'aicoach'),
      where('userId', '==', userId)
    );

    // Apply limit
    q = query(q, limit(limitCount));

    const querySnapshot = await getDocs(q);
    const conversations = [];

    querySnapshot.forEach((doc) => {
      conversations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort conversations by timestamp in descending order (newest first)
    conversations.sort((a, b) => {
      // Handle cases where timestamp might be missing
      const timestampA = a.timestamp?.toDate?.() || new Date(a.timestamp) || new Date(0);
      const timestampB = b.timestamp?.toDate?.() || new Date(b.timestamp) || new Date(0);
      return timestampB - timestampA;
    });

    console.log(`Fetched ${conversations.length} conversations for user ${userId}`);
    return conversations;
  } catch (error) {
    console.error('Error fetching AI Coach history:', error);
    throw error;
  }
};

/**
 * Get a specific conversation by ID
 * @param {string} conversationId - The conversation document ID
 * @returns {Promise<Object|null>} - Conversation object or null if not found
 */
export const getAiCoachConversation = async (conversationId) => {
  try {
    const docRef = doc(db, 'aicoach', conversationId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw error;
  }
};

/**
 * Update an existing conversation
 * @param {string} conversationId - The conversation document ID
 * @param {object} updateData - Data to update
 * @returns {Promise<void>}
 */
export const updateAiCoachConversation = async (conversationId, updateData) => {
  try {
    const docRef = doc(db, 'aicoach', conversationId);
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating conversation:', error);
    throw error;
  }
};

/**
 * Delete a conversation
 * @param {string} conversationId - The conversation document ID
 * @returns {Promise<void>}
 */
export const deleteAiCoachConversation = async (conversationId) => {
  try {
    const docRef = doc(db, 'aicoach', conversationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
};

/**
 * Get conversation statistics for a user
 * @param {string} userId - The user's Firebase UID
 * @returns {Promise<Object>} - Statistics object
 */
export const getAiCoachStats = async (userId) => {
  try {
    const q = query(
      collection(db, 'aicoach'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const conversations = [];

    querySnapshot.forEach((doc) => {
      conversations.push(doc.data());
    });

    const totalConversations = conversations.length;
    const totalPromptLength = conversations.reduce((sum, conv) => sum + (conv.metadata?.promptLength || 0), 0);
    const totalResponseLength = conversations.reduce((sum, conv) => sum + (conv.metadata?.responseLength || 0), 0);

    return {
      totalConversations,
      averagePromptLength: totalConversations > 0 ? Math.round(totalPromptLength / totalConversations) : 0,
      averageResponseLength: totalConversations > 0 ? Math.round(totalResponseLength / totalConversations) : 0
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
};

/**
 * Search conversations by content
 * @param {string} userId - The user's Firebase UID
 * @param {string} searchTerm - Term to search for
 * @returns {Promise<Array>} - Array of matching conversations
 */
export const searchAiCoachConversations = async (userId, searchTerm) => {
  try {
    const q = query(
      collection(db, 'aicoach'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const conversations = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (
        data.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.response?.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        conversations.push({
          id: doc.id,
          ...data
        });
      }
    });

    return conversations;
  } catch (error) {
    console.error('Error searching conversations:', error);
    throw error;
  }
};