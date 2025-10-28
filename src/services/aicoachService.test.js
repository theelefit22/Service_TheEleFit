// Mock the Firebase module
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn()
}));

// Mock the firebase service
jest.mock('../services/firebase', () => ({
  db: {}
}));

import { 
  saveAiCoachData, 
  fetchAiCoachHistory, 
  getAiCoachConversation, 
  updateAiCoachConversation, 
  deleteAiCoachConversation 
} from './aicoachService';

describe('aicoachService', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up default mock implementations
    require('firebase/firestore').collection.mockReturnValue('mock-collection');
    require('firebase/firestore').query.mockReturnValue('mock-query');
    require('firebase/firestore').where.mockReturnValue('mock-query');
    require('firebase/firestore').orderBy.mockReturnValue('mock-query');
    require('firebase/firestore').limit.mockReturnValue('mock-query');
    require('firebase/firestore').serverTimestamp.mockReturnValue('mock-timestamp');
  });

  describe('saveAiCoachData', () => {
    test('saves new conversation data', async () => {
      // Mock that no existing conversation is found
      require('firebase/firestore').getDocs.mockResolvedValueOnce({
        forEach: (callback) => {},
      });
      
      // Mock successful document creation
      const mockDocRef = { id: 'test-doc-id' };
      require('firebase/firestore').addDoc.mockResolvedValueOnce(mockDocRef);

      const result = await saveAiCoachData(
        'user-123', 
        'Test prompt', 
        'Test response', 
        { test: 'metadata' }
      );

      expect(result).toBe('test-doc-id');
      expect(require('firebase/firestore').addDoc).toHaveBeenCalledWith(
        'mock-collection',
        expect.objectContaining({
          userId: 'user-123',
          prompt: 'Test prompt',
          response: 'Test response',
          metadata: { test: 'metadata' }
        })
      );
    });

    test('updates existing conversation if found', async () => {
      // Mock that an existing conversation is found
      const mockTimestamp = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      require('firebase/firestore').getDocs.mockResolvedValueOnce({
        forEach: (callback) => {
          callback({
            id: 'existing-doc-id',
            data: () => ({
              userId: 'user-123',
              prompt: 'Test prompt',
              timestamp: mockTimestamp
            })
          });
        }
      });
      
      // Mock successful document update
      require('firebase/firestore').doc.mockReturnValue('mock-doc-ref');
      require('firebase/firestore').updateDoc.mockResolvedValueOnce();

      const result = await saveAiCoachData(
        'user-123', 
        'Test prompt', 
        'Test response'
      );

      expect(result).toBe('existing-doc-id');
      expect(require('firebase/firestore').updateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({
          response: 'Test response'
        })
      );
    });
  });

  describe('fetchAiCoachHistory', () => {
    test('fetches conversation history for user', async () => {
      const mockConversations = [
        { id: '1', prompt: 'Test 1', response: 'Response 1', timestamp: new Date() },
        { id: '2', prompt: 'Test 2', response: 'Response 2', timestamp: new Date() }
      ];

      require('firebase/firestore').getDocs.mockResolvedValueOnce({
        forEach: (callback) => {
          mockConversations.forEach(conv => {
            callback({
              id: conv.id,
              data: () => conv
            });
          });
        }
      });

      const result = await fetchAiCoachHistory('user-123');

      expect(result).toHaveLength(2);
      // Note: The actual order might be different due to sorting, so we just check that both IDs are present
      const ids = result.map(conv => conv.id);
      expect(ids).toContain('1');
      expect(ids).toContain('2');
    });

    test('sorts conversations by timestamp', async () => {
      const olderDate = new Date(Date.now() - 10000);
      const newerDate = new Date();
      
      const mockConversations = [
        { id: '1', prompt: 'Old', timestamp: olderDate },
        { id: '2', prompt: 'New', timestamp: newerDate }
      ];

      require('firebase/firestore').getDocs.mockResolvedValueOnce({
        forEach: (callback) => {
          mockConversations.forEach(conv => {
            callback({
              id: conv.id,
              data: () => conv
            });
          });
        }
      });

      const result = await fetchAiCoachHistory('user-123');

      // Should be sorted newest first
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('1');
    });
  });

  describe('getAiCoachConversation', () => {
    test('returns conversation if found', async () => {
      const mockConversation = {
        id: 'test-id',
        prompt: 'Test prompt',
        response: 'Test response'
      };

      require('firebase/firestore').getDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'test-id',
        data: () => mockConversation
      });

      const result = await getAiCoachConversation('test-id');

      expect(result).toEqual({
        id: 'test-id',
        ...mockConversation
      });
    });

    test('returns null if conversation not found', async () => {
      require('firebase/firestore').getDoc.mockResolvedValueOnce({
        exists: () => false
      });

      const result = await getAiCoachConversation('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateAiCoachConversation', () => {
    test('updates conversation data', async () => {
      require('firebase/firestore').doc.mockReturnValue('mock-doc-ref');
      require('firebase/firestore').updateDoc.mockResolvedValueOnce();

      await updateAiCoachConversation('test-id', { test: 'update' });

      expect(require('firebase/firestore').doc).toHaveBeenCalledWith(
        {}, 
        'aicoach', 
        'test-id'
      );
      expect(require('firebase/firestore').updateDoc).toHaveBeenCalledWith(
        'mock-doc-ref', 
        { test: 'update' }
      );
    });
  });

  describe('deleteAiCoachConversation', () => {
    test('deletes conversation', async () => {
      require('firebase/firestore').doc.mockReturnValue('mock-doc-ref');
      require('firebase/firestore').deleteDoc.mockResolvedValueOnce();

      await deleteAiCoachConversation('test-id');

      expect(require('firebase/firestore').doc).toHaveBeenCalledWith(
        {}, 
        'aicoach', 
        'test-id'
      );
      expect(require('firebase/firestore').deleteDoc).toHaveBeenCalledWith(
        'mock-doc-ref'
      );
    });
  });
});