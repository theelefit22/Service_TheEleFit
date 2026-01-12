import { firestore } from './firebase';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

/**
 * Save user feedback to Firestore
 * @param {Object} feedbackData - The feedback data to save
 * @param {string} feedbackData.userId - The user ID
 * @param {string} feedbackData.userEmail - The user email
 * @param {number} feedbackData.uiRating - Rating for UI (1-5)
 * @param {number} feedbackData.processRating - Rating for process (1-5)
 * @param {string} feedbackData.comments - User comments
 * @param {string} feedbackData.page - The page where feedback was submitted
 * @returns {Promise<string>} - The ID of the created feedback document
 */
export const saveFeedback = async (feedbackData) => {
  try {
    const feedbackRef = collection(firestore, 'feedback');
    const docRef = await addDoc(feedbackRef, {
      ...feedbackData,
      timestamp: serverTimestamp()
    });
    
    console.log('Feedback saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving feedback:', error);
    throw error;
  }
};

/**
 * Get feedback for a specific user
 * @param {string} userId - The user ID to get feedback for
 * @returns {Promise<Array>} - Array of feedback documents
 */
export const getUserFeedback = async (userId) => {
  try {
    const feedbackRef = collection(firestore, 'feedback');
    const q = query(
      feedbackRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting user feedback:', error);
    throw error;
  }
};

/**
 * Get all feedback for a specific page
 * @param {string} page - The page to get feedback for
 * @returns {Promise<Array>} - Array of feedback documents
 */
export const getPageFeedback = async (page) => {
  try {
    const feedbackRef = collection(firestore, 'feedback');
    const q = query(
      feedbackRef,
      where('page', '==', page),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting page feedback:', error);
    throw error;
  }
}; 