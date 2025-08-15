import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { saveFeedback } from '../services/feedbackService';
import { 
  saveGroceryList, 
  getUserGroceryLists, 
  updateGroceryList, 
  deleteGroceryList,
  getGroceryListById 
} from '../services/groceryListService';
import { initTableScrollHelpers, cleanupTableScrollHelpers } from '../utils/tableScrollHelper';
import "./GroceryListProcessor.css"

// Add CSV export utility function
const exportToCSV = (data, filename) => {
  // Get current user's email (or username) and format it for filename
  const userEmail = auth.currentUser?.email || 'guest';
  const username = userEmail.split('@')[0]; // Get part before @ for cleaner filename
  
  // Create human-readable timestamp
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[now.getMonth()];
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  
  // Format time in 12-hour format with AM/PM
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  const time = `${hours}-${minutes}${ampm}`;
  
  // Create filename with human-readable timestamp
  const formattedFilename = `${username}_${day}${month}${year}_${time}_GroceryList.csv`;

  // Define headers
  const headers = ['No.', 'Item Name', 'Quantity', 'Category', 'Meal Time'];
  
  // Helper function to escape and quote CSV fields
  const escapeField = (field) => {
    // If field contains commas, quotes, or spaces, wrap it in quotes
    if (typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes(' '))) {
      // Replace any quotes with double quotes (CSV standard)
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  // Sort data by category alphabetically
  const sortedData = [...data].sort((a, b) => {
    // Handle undefined or null categories
    const catA = a.category || '';
    const catB = b.category || '';
    return catA.localeCompare(catB);
  });

  // Convert data to CSV format with proper escaping
  const csvData = sortedData.map((item, index) => [
    index + 1,
    escapeField(item.item),
    escapeField(`${item.total_quantity} ${item.unit}`),
    escapeField(item.category),
    escapeField(item.meal_time || '')
  ]);
  
  // Combine headers and data with proper escaping
  const csvContent = [
    headers.map(escapeField).join(','),
    ...csvData.map(row => row.join(','))
  ].join('\n');
  
  // Create blob with UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', formattedFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url); // Clean up the URL object
};

// Add PDFTile component before the main GroceryListProcessor component
const PDFTile = ({ file, isActive, isSliding, onRemove, onClick }) => {
  return (
    <div 
      className={`glp-file-tile ${isActive ? 'active' : ''} ${isSliding ? 'sliding' : ''}`}
      onClick={onClick}
    >
      <button 
        className="glp-remove-file"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>
      <div className="glp-file-tile-icon">📄</div>
      <div className="glp-file-tile-name">{file.name}</div>
      <div className="glp-file-tile-size">
        {(file.size / 1024).toFixed(2)} KB
      </div>
    </div>
  );
};

function GroceryListProcessor() {
  const [files, setFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    item: '',
    category: '',
    meal_time: ''
  });
  const [unitSystem, setUnitSystem] = useState('metric');
  const [activeFilters, setActiveFilters] = useState([]);
  const [filterload,setFilterLoad]=useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [completedItems, setCompletedItems] = useState([]);
  const [currentListId, setCurrentListId] = useState(null);
  const [savedLists, setSavedLists] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Add unit change animation state at the top with other state declarations
  const [unitChangeAnimation, setUnitChangeAnimation] = useState(false);

  // Add state for feedback form
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackData, setFeedbackData] = useState({
    uiRating: 0,
    processRating: 0,
    comments: ''
  });

  // Check authentication status
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setIsAuthenticated(!!user);
      if (user) {
        loadSavedLists();
      }
    });
    return () => unsubscribe();
  }, []);

  // Load saved lists for authenticated user
  const loadSavedLists = async () => {
    console.log('Loading saved lists...');
    try {
      const lists = await getUserGroceryLists();
      console.log('Loaded lists:', lists);
      setSavedLists(lists);
    } catch (err) {
      console.error('Error loading saved lists:', err);
      setError('Failed to load saved lists');
    }
  };

  const saveCurrentList = async () => {
    console.log('Starting saveCurrentList...');
    console.log('Auth state:', isAuthenticated);
    console.log('Current result:', result);
  
    if (!isAuthenticated) {
      console.log('User not authenticated, skipping save');
      return;
    }
  
    // Validate result data before saving
    if (!result?.items || !Array.isArray(result.items)) {
      console.log('No valid data to save, skipping');
      return;
    }
  
    try {
      setLoading(true);
      console.log('Preparing list data for save...');
      
      const listData = {
        items: result.items,
        completedItems: completedItems || [],
        unitSystem: unitSystem || 'metric',
        filters: filters || {},
        name: files[activeFileIndex]?.name || 'Untitled List',
        timestamp: new Date().toISOString()
      };
  
      console.log('List data to save:', listData);
  
      if (currentListId) {
        console.log('Updating existing list:', currentListId);
        await updateGroceryList(currentListId, listData);
      } else {
        console.log('Creating new list...');
        const newListId = await saveGroceryList(listData);
        console.log('New list created with ID:', newListId);
        setCurrentListId(newListId);
      }
  
      // Reload lists after saving
      await loadSavedLists();
      
      setError(null);
      console.log('List saved successfully!');
    } catch (err) {
      console.error('Error saving list:', err);
      setError('Failed to save list. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const loadSavedList = async (listId) => {
    try {
      setLoading(true);
      const list = await getGroceryListById(listId);
      
      if (!list) {
        throw new Error('List not found');
      }
  
      setResult({ items: list.items });  // Ensure proper structure
      setCompletedItems(list.completedItems || []);
      setUnitSystem(list.unitSystem || 'metric');
      setFilters(list.filters || {});
      setCurrentListId(listId);
      setError(null);
    } catch (err) {
      console.error('Error loading list:', err);
      setError('Failed to load grocery list');
    } finally {
      setLoading(false);
    }
  };
  // Delete a saved list
  const deleteSavedList = async (listId) => {
    if (!listId) {
      console.log('No list ID provided, skipping delete');
      return;
    }

    try {
      setLoading(true);
      await deleteGroceryList(listId);
     
      if (currentListId === listId) {
        setCurrentListId(null);
        setResult(null);
        setCompletedItems([]);
      }
      
      // Reload lists after successful delete
      await loadSavedLists();
      setError(null);
    } catch (err) {
      console.error('Error deleting list:', err);
      // Don't show error to user for background operation
    } finally {
      setLoading(false);
    }
  };

  // Load cached results from localStorage on component mount
  useEffect(() => {
    const cachedResults = localStorage.getItem('pdfResults');
    if (cachedResults) {
      try {
        setResult(JSON.parse(cachedResults));
      } catch (err) {
        console.error('Error loading cached results:', err);
        localStorage.removeItem('pdfResults');
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null); // Clear previous results

    try {
      // Process all files in sequence
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });

      const response = await fetch('http://localhost:5002/process-pdf', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process PDF');
      }

      // Validate data structure before processing
      if (!data || (!Array.isArray(data) && !Array.isArray(data.items))) {
        console.error('Invalid data structure received:', data);
        throw new Error('Invalid response format from server');
      }

      // Ensure data has the correct structure
      const processedResult = {
        items: Array.isArray(data) ? data : (data.items || [])
      };

      // Validate processed result before using
      if (!processedResult.items || !Array.isArray(processedResult.items)) {
        throw new Error('Failed to process items from PDF');
      }

      console.log('Processed result:', processedResult);
      
      // Ensure loading stays visible while rendering
      await new Promise(resolve => setTimeout(resolve, 800));
      setResult(processedResult);
      
      // Save to Firebase if user is authenticated and it's new data
      if (isAuthenticated) {
        console.log('User is authenticated, saving to Firebase...');
        await saveCurrentList();
      } else {
        console.log('User is not authenticated, skipping Firebase save');
      }
    } catch (err) {
      console.error('Error details:', err);
      setError('Could not process the PDF files. Please make sure they are valid grocery lists.');
    } finally {
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    if (droppedFiles.length > 0) {
      handleFilesSelection(droppedFiles);
        } else {
      setError('Please drop PDF files only');
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(
      file => file.type === 'application/pdf'
    );
    handleFilesSelection(selectedFiles);
  };

  const handleFilesSelection = (selectedFiles) => {
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      setError(null);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
    
    if (activeFileIndex === index) {
      setActiveFileIndex(null);
    } else if (activeFileIndex > index) {
      setActiveFileIndex(prev => prev - 1);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    // Only show loading indicator if we're adding text, not removing
    if (value.length > filters[name].length) {
      setFilterLoad(true);
    }
    
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [name]: value
      };
      
      // Update active filters
      const activeFilters = Object.entries(newFilters)
        .filter(([_, val]) => val !== '')
        .map(([key, val]) => ({ key, value: val }));
      setActiveFilters(activeFilters);

      // Auto-save when filters change
      if (isAuthenticated && result && currentListId) {
        const listData = {
          items: result.items,
          completedItems,
          unitSystem,
          filters: newFilters,
          name: files[activeFileIndex]?.name || 'Untitled List',
          timestamp: new Date().toISOString()
        };
        
        updateGroceryList(currentListId, listData).catch(err => {
          console.error('Error auto-saving filters:', err);
        });
      }
      
      return newFilters;
    });
  };

  const removeFilter = (filterKey) => {
    // Don't show loading when removing filters
    setFilters(prev => {
      const newFilters = {
      ...prev,
      [filterKey]: ''
      };

      // Auto-save when removing filter
      if (isAuthenticated && result && currentListId) {
        const listData = {
          items: result.items,
          completedItems,
          unitSystem,
          filters: newFilters,
          name: files[activeFileIndex]?.name || 'Untitled List',
          timestamp: new Date().toISOString()
        };
        
        updateGroceryList(currentListId, listData).catch(err => {
          console.error('Error auto-saving filters:', err);
        });
      }

      return newFilters;
    });
    
    // Update active filters
    setActiveFilters(prev => prev.filter(filter => filter.key !== filterKey));
  };

  const convertUnits = (quantity, fromUnit) => {
    if (unitSystem === 'metric') return { quantity, unit: fromUnit };
    
    const conversionFactors = {
      'g': {
        'us': { factor: 0.00220462, unit: 'lb' },
        'uk': { factor: 0.00220462, unit: 'lb' }
      },
      'ml': {
        'us': { factor: 0.033814, unit: 'fl oz' },
        'uk': { factor: 0.035195, unit: 'fl oz' }
      }
    };

    if (!conversionFactors[fromUnit] || !conversionFactors[fromUnit][unitSystem]) {
      return { quantity, unit: fromUnit };
    }

    const { factor, unit } = conversionFactors[fromUnit][unitSystem];
    return {
      quantity: (quantity * factor).toFixed(2),
      unit
    };
  };

  const [filteredItems, setFilteredItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [mealTimes, setMealTimes] = useState([]);

  // Update the result state management
  useEffect(() => {
    let isMounted = true;

    const updateResult = async () => {
      if (result?.items) {
        // Only show loading for initial data load or when adding filters, not when removing
        const isAddingFilter = 
          (filters.item && filters.item.length > 0) || 
          (filters.category && filters.category.length > 0) || 
          (filters.meal_time && filters.meal_time.length > 0);
          
        if (isAddingFilter) {
          setFilterLoad(true);
        }
        
        try {
          // Add small delay to ensure smooth transition, but only if adding filters
          if (isAddingFilter) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          if (isMounted) {
            // Update filtered items
            const filtered = result.items.filter(item => {
              const matchesItem = filters.item === '' || 
                item.item.toLowerCase().includes(filters.item.toLowerCase());
              
              const matchesCategory = filters.category === '' || 
                item.category === filters.category;
              
              // Improved meal time matching
              const matchesMealTime = filters.meal_time === '' || 
                (item.meal_time && (
                  // Direct match
                  item.meal_time === filters.meal_time || 
                  // Match in comma-separated list
                  (typeof item.meal_time === 'string' && 
                   item.meal_time.split(',').map(t => t.trim()).includes(filters.meal_time))
                ));
              
              return matchesItem && matchesCategory && matchesMealTime;
            });

            // Update categories and meal times
            const cats = [...new Set(result.items.map(item => item.category))];
            
            // Improved meal times extraction to ensure "Dinner" is included
            const times = [...new Set(result.items
              .flatMap(item => {
                // Handle different formats of meal_time data
                if (!item.meal_time) return [];
                
                // If it's already a string with comma separation
                if (typeof item.meal_time === 'string' && item.meal_time.includes(',')) {
                  return item.meal_time.split(',').map(time => time.trim());
                }
                
                // If it's a simple string (like "Dinner", "Lunch", etc.)
                return [item.meal_time];
              })
              .filter(Boolean) // Remove any undefined or empty values
            )];
            
            // Ensure standard meal times are always included
            const standardMealTimes = ["Breakfast", "Lunch", "Dinner", "Snack"];
            const allMealTimes = [...new Set([...times, ...standardMealTimes])];
            
            console.log("Extracted meal times:", allMealTimes); // Debug log
            
            // Set all states at once to minimize re-renders
            setCategories(cats);
            setMealTimes(allMealTimes);
            setFilteredItems(filtered);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
            setFilterLoad(false);
          }
        }
      }
    };

    updateResult();

    return () => {
      isMounted = false;
    };
  }, [result, filters]);

  // Add a useEffect to handle result updates
  useEffect(() => {
    let isMounted = true;

    const processResult = async () => {
      if (result?.items) {
        // Keep loading state while processing
        setLoading(true);
        
        try {
          // Add delay to ensure smooth transition
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (!isMounted) return;
          
          // Process the items
          const filtered = result.items.filter(item => {
            const matchesItem = filters.item === '' || 
              item.item.toLowerCase().includes(filters.item.toLowerCase());
            
            const matchesCategory = filters.category === '' || 
              item.category === filters.category;
            
            // Improved meal time matching
            const matchesMealTime = filters.meal_time === '' || 
              (item.meal_time && (
                // Direct match
                item.meal_time === filters.meal_time || 
                // Match in comma-separated list
                (typeof item.meal_time === 'string' && 
                 item.meal_time.split(',').map(t => t.trim()).includes(filters.meal_time))
              ));
            
            return matchesItem && matchesCategory && matchesMealTime;
          });

          // Update the filtered items
          setFilteredItems(filtered);
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      }
    };

    // Only run this effect on initial result load, not on filter changes
    if (!filters.item && !filters.category && !filters.meal_time) {
      processResult();
    }

    return () => {
      isMounted = false;
    };
  }, [result]);

  // Add scroll detection for table
  useEffect(() => {
    // Make sure tables are scrollable
    const makeTablesScrollable = () => {
      const tables = document.querySelectorAll('.glp-table-responsive');
      tables.forEach(table => {
        // Force horizontal scrolling to be enabled
        table.style.overflowX = 'auto';
        
        // Check if table needs horizontal scrolling
        const needsScroll = table.scrollWidth > table.clientWidth;
        
        // Add a class if scrolling is needed
        if (needsScroll) {
          table.classList.add('needs-horizontal-scroll');
        } else {
          table.classList.remove('needs-horizontal-scroll');
        }
      });
    };
    
    // Run immediately and on window resize
    makeTablesScrollable();
    window.addEventListener('resize', makeTablesScrollable);
    
    // Initialize table scroll helpers to prevent page scrolling when table is scrolled
    initTableScrollHelpers();
    
    // Clean up
    return () => {
      window.removeEventListener('resize', makeTablesScrollable);
      cleanupTableScrollHelpers();
    };
  }, [filteredItems]);

  const handleEditClick = (item) => {
    setEditingItem(item);
    setEditedName(item.item);
  };

  // Auto-save whenever result changes
  useEffect(() => {
    const autoSave = async () => {
      if (result && isAuthenticated) {
        try {
          await saveCurrentList();
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
      }
    };

    autoSave();
  }, [result, isAuthenticated]);

  // Auto-save when list items are modified
  const handleSaveEdit = async (index) => {
    if (editedName.trim() !== '') {
      const updatedItems = [...result.items];
      updatedItems[index] = { ...updatedItems[index], item: editedName.trim() };
      const updatedResult = { ...result, items: updatedItems };
      setResult(updatedResult);
      setEditingItem(null);
      setEditedName('');
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditedName('');
  };

  const handleDropdownClick = (index, event) => {
    event.stopPropagation();
    setActiveDropdown(activeDropdown === index ? null : index);
  };

  const handleCompleteItem = async (index) => {
    setCompletedItems(prev => {
      const newCompletedItems = [...prev, index];
      // Auto-save when completing items
      if (isAuthenticated && result) {
        const listData = {
          items: result.items,
          completedItems: newCompletedItems,
          unitSystem,
          filters,
          name: files[activeFileIndex]?.name || 'Untitled List',
          timestamp: new Date().toISOString()
        };
        
        if (currentListId) {
          updateGroceryList(currentListId, listData).catch(err => {
            console.error('Error auto-saving completion status:', err);
          });
        }
      }
      return newCompletedItems;
    });
    setActiveDropdown(null);
  };

  const handleUndoComplete = async (index) => {
    setCompletedItems(prev => {
      const newCompletedItems = prev.filter(i => i !== index);
      // Auto-save when undoing completion
      if (isAuthenticated && result) {
        const listData = {
          items: result.items,
          completedItems: newCompletedItems,
          unitSystem,
          filters,
          name: files[activeFileIndex]?.name || 'Untitled List',
          timestamp: new Date().toISOString()
        };
        
        if (currentListId) {
          updateGroceryList(currentListId, listData).catch(err => {
            console.error('Error auto-saving completion status:', err);
          });
        }
      }
      return newCompletedItems;
    });
    setActiveDropdown(null);
  };

  // Add click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.glp-dropdown')) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update the handleUnitChange function to ensure it works correctly
  const handleUnitChange = (e) => {
    const newUnitSystem = e.target.checked ? 'us' : 'metric';
    console.log('Changing unit system to:', newUnitSystem);
    
    // Trigger animation
    setUnitChangeAnimation(true);
    
    // Update unit system
    setUnitSystem(newUnitSystem);
    
    // Reset animation after a delay
    setTimeout(() => setUnitChangeAnimation(false), 500);
    
    // Auto-save when unit system changes
    if (isAuthenticated && result && currentListId) {
      const listData = {
        items: result.items,
        completedItems,
        unitSystem: newUnitSystem,
        filters,
        name: files[activeFileIndex]?.name || 'Untitled List',
        timestamp: new Date().toISOString()
      };
      
      updateGroceryList(currentListId, listData).catch(err => {
        console.error('Error auto-saving unit system:', err);
      });
    }
  };

  // Handle feedback form input changes
  const handleFeedbackChange = (e) => {
    const { name, value } = e.target;
    setFeedbackData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle rating changes
  const handleRatingChange = (e) => {
    const { name, value } = e.target;
    setFeedbackData(prev => ({
      ...prev,
      [name]: parseInt(value, 10)
    }));
  };

  // Handle feedback form submission
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Save feedback to Firestore
      if (isAuthenticated && auth.currentUser) {
        await saveFeedback({
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email,
          uiRating: feedbackData.uiRating,
          processRating: feedbackData.processRating,
          comments: feedbackData.comments,
          page: "GroceryListProcessor"
        });
        console.log('Feedback saved to Firestore');
      } else {
        console.log('User not authenticated, feedback not saved');
      }
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
    
    // Show thank you message
    setFeedbackSubmitted(true);
    
    // Close the feedback form after a delay
    setTimeout(() => {
      setShowFeedback(false);
      // Reset for next time
      setTimeout(() => {
        setFeedbackSubmitted(false);
        setFeedbackData({
          uiRating: 0,
          processRating: 0,
          comments: ''
        });
      }, 300);
    }, 2000);
  };

  // Add UI elements for saved lists
  return (
    <div className="glp-app-container">
      <div className="glp-hero-section">
        <div className="glp-hero-content">
          <div className="glp-brand">
            <h1>Grocery List Organizer</h1>
            <p className="glp-tagline">Making healthy shopping easier</p>
          </div>

          <div className="glp-benefits-grid">
            <div className="glp-benefit-card">
              <span className="glp-benefit-icon">📋</span>
              <h3>Smart Lists</h3>
              <p>Automatically organize your grocery items by category</p>
            </div>
            <div className="glp-benefit-card">
              <span className="glp-benefit-icon">🛒</span>
              <h3>Easy Shopping</h3>
              <p>Get your shopping list organized and ready to go</p>
            </div>
            <div className="glp-benefit-card">
              <span className="glp-benefit-icon">💪</span>
              <h3>Stay Healthy</h3>
              <p>Keep track of your nutritious food choices</p>
            </div>
            <div className="glp-benefit-card">
              <span className="glp-benefit-icon">⚡</span>
              <h3>Save Time</h3>
              <p>Quick and efficient grocery list processing</p>
            </div>
          </div>
        </div>
      </div>


      <div className="glp-main-content">
        <div className="glp-upload-section">
          <p className="glp-upload-description">
            Drop your PDF files here and we'll organize them for you
          </p>

          <form onSubmit={handleSubmit} className="glp-upload-form">
            {/* Keep existing single file upload container */}
            <div 
              className={`glp-file-upload-zone ${files.length > 0 ? 'glp-has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="glp-upload-icon">
                {files.length > 0 ? '📄' : '📁'}
              </div>
              <div className="glp-upload-text">
                {files.length > 0 ? (
                  <>
                    <p className="glp-file-name">{files.length} file(s) selected</p>
                    <p className="glp-file-size">
                      {(files.reduce((acc, file) => acc + file.size, 0) / 1024).toFixed(2)} KB total
                    </p>
                  </>
                ) : (
                  <>
                    <p className="glp-upload-title">Drag & drop your PDFs here</p>
                    <p className="glp-upload-subtitle">or click to browse files</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="glp-file-input"
                id="glp-file-input"
                multiple
              />
            </div>

            {/* Add multi-file display container */}
            {files.length > 0 && (
              <div className="glp-multi-file-container">
                {files.map((file, index) => (
                  <PDFTile
                    key={file.name + index}
                    file={file}
                    isActive={index === activeFileIndex}
                    isSliding={index < activeFileIndex}
                    onRemove={() => handleRemoveFile(index)}
                    onClick={() => setActiveFileIndex(index)}
                  />
                ))}
                
                {/* Add file button */}
                <label className="glp-add-file-tile" htmlFor="glp-file-input">
                  <div className="glp-add-file-icon">+</div>
                  <div className="glp-add-file-text">Add More</div>
                </label>
              </div>
            )}

            <div className="glp-button-container">
              <button 
                type="submit" 
                disabled={files.length === 0 || loading}
                className="glp-process-button"
              >
                {loading ? 'Processing...' : 'Process PDFs'}
              </button>
              {/* Remove clear cache button */}
            </div>
            
            {error && (
              <div className="glp-error">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            {loading && (
              <div className="glp-loading-container">
                <div className="glp-loader">
                  <div>
                    <ul>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                      <li>
                        <svg fill="currentColor" viewBox="0 0 90 120">
                          <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z"></path>
                        </svg>
                      </li>
                    </ul>
                  </div>
                  <span >Processing your list...</span>
                </div>
              </div>
            )}
          </form>
        </div>

        {result && (
          <div className="glp-results-section">
            <div className="glp-filters-toggle">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="glp-toggle-filters-button"
              >
                <span className="button-text">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
              </button>
              <button 
                onClick={() => exportToCSV(filteredItems)}
                className="glp-export-button"
              >
                <span className="button-text">Export as CSV</span>
              </button>
            </div>

            <div className={`glp-filters-section ${showFilters ? 'glp-show' : 'glp-hide'}`}>
              <h2>Filters</h2>
              
              <div className="glp-active-filters">
                {activeFilters.map(filter => (
                  <div key={filter.key} className="glp-filter-chip" onClick={() => removeFilter(filter.key)}>
                    {filter.key}: {filter.value}
                    <span className="glp-remove-filter">×</span>
                  </div>
                ))}
              </div>

              <div className="glp-filter-controls">
                <div className="glp-filter-group">
                  <label htmlFor="filter-item">Item Name:</label>
                  <input
                    id="filter-item"
                    type="text"
                    name="item"
                    value={filters.item}
                    onChange={handleFilterChange}
                    placeholder="Search items..."
                  />
                </div>

                <div className="glp-filter-group">
                  <label htmlFor="filter-category">Category:</label>
                  <select
                    id="filter-category"
                    name="category"
                    value={filters.category}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="glp-filter-group">
                  <label htmlFor="filter-meal-time">Meal Time:</label>
                  <select
                    id="filter-meal-time"
                    name="meal_time"
                    value={filters.meal_time}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Meal Times</option>
                    {mealTimes.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div className="glp-unit-toggle">
  <label>Unit System:</label>
  <div className="glp-toggle-container">
    <label className={`glp-toggle-switch ${unitChangeAnimation ? 'glp-unit-change' : ''}`}>
      <input
        type="checkbox"
        checked={unitSystem !== 'metric'}
        onChange={handleUnitChange}
        className="glp-toggle-input"
      />
      <span className="glp-toggle-slider">
        <span className="glp-toggle-labels">
          <span className="glp-label-metric">M</span>
          <span className="glp-label-imperial">I</span>
        </span>
      </span>
    </label>
    <span className="glp-toggle-text">
      {unitSystem === 'metric' ? 'Metric' : 'Imperial'}
    </span>
  </div>
</div>
              </div>
            </div>

            <div className="glp-items-container">
              {filterload ? (
                <div className="glp-loading-text">Loading...</div>
              ) : filteredItems && filteredItems.length > 0 ? (
                <div className="glp-table-responsive">
                  <table className="glp-modern-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Item Name</th>
                        <th>Quantity</th>
                        <th>Category</th>
                        <th>Meal Time</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item, index) => {
                        const converted = convertUnits(item.total_quantity, item.unit);
                        const isDropdownActive = activeDropdown === index;
                        const isCompleted = completedItems.includes(index);
                        
                        return (
                          <tr 
                            key={index} 
                            className={`glp-table-row ${isCompleted ? 'glp-completed' : ''} ${isDropdownActive ? 'glp-dropdown-active' : ''}`}
                          >
                            <td className="glp-serial-number">{index + 1}</td>
                            <td>
                              {editingItem === item ? (
                                <input
                                  type="text"
                                  className="glp-edit-input"
                                  value={editedName}
                                  onChange={(e) => setEditedName(e.target.value)}
                                  autoFocus
                                />
                              ) : (
                                <span className="glp-item-name">
                                  {item.item}
                                </span>
                              )}
                            </td>
                            <td>{converted.quantity} {converted.unit}</td>
                            <td>{item.category}</td>
                            <td>{item.meal_time}</td>
                            <td className="glp-actions-cell">
                              {editingItem === item ? (
                                <div className="glp-action-buttons">
                                  <button
                                    className="glp-action-btn glp-save-btn"
                                    onClick={() => handleSaveEdit(index)}
                                    title="Save"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    className="glp-action-btn glp-cancel-btn"
                                    onClick={handleCancelEdit}
                                    title="Cancel"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className={`glp-dropdown ${isDropdownActive ? 'glp-active' : ''}`}>
                                  <button 
                                    className="glp-three-dots-btn"
                                    onClick={(e) => handleDropdownClick(index, e)}
                                  >
                                    ⋮
                                  </button>
                                  {isDropdownActive && <div className="glp-dropdown-overlay" />}
                                  <div className={`glp-dropdown-menu ${isDropdownActive ? 'glp-show' : ''}`}>
                                    {!isCompleted && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditClick(item);
                                          setActiveDropdown(null);
                                        }}
                                      >
                                        <span>✎</span> Edit
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        isCompleted ? handleUndoComplete(index) : handleCompleteItem(index);
                                      }}
                                      className={isCompleted ? 'glp-undo-btn' : 'glp-complete-btn'}
                                    >
                                      <span>{isCompleted ? '↺' : '✓'}</span>
                                      {isCompleted ? 'Undo' : 'Complete'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : result?.items?.length === 0 ? (
                <div className="glp-no-results">No items found in the list</div>
              ) : (
                <div className="glp-no-results">
                  {error ? error : 'No items match your filters'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Remove this section that had the save button */}
      {/* {result && isAuthenticated && (
        <div className="glp-save-actions">
          <button onClick={saveCurrentList} disabled={loading}>
            {currentListId ? 'Update List' : 'Save List'}
          </button>
        </div>
      )} */}

      <footer className="glp-app-footer">
        <div className="glp-footer-content">
          <div className="glp-footer-info">
            <h3>EleFit</h3>
            <p>Making healthy shopping easier</p>
          </div>
          <div className="glp-footer-features">
            <p>✓ Smart Organization</p>
            <p>✓ Time Saving</p>
            <p>✓ Easy Shopping</p>
          </div>
        </div>
      </footer>

      {/* Feedback Button */}
      <button 
        className="feedback-button sticky" 
        onClick={() => setShowFeedback(true)}
        aria-label="Provide Feedback"
      >
        <i className="fas fa-comments"></i>
        <span>Feedback</span>
      </button>

      {/* Feedback Overlay */}
      <div className={`feedback-overlay ${showFeedback ? 'active' : ''}`}>
        <div className="feedback-form">
          <button 
            className="close-button" 
            onClick={() => setShowFeedback(false)}
            aria-label="Close Feedback Form"
          >
            &times;
          </button>
          
          {feedbackSubmitted ? (
            <div className="feedback-thank-you">
              <h2>Thank You!</h2>
              <p>Your feedback has been submitted successfully.</p>
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit}>
              <h2>We Value Your Feedback</h2>
              
              <div className="form-group">
                <label>How would you rate the UI?</label>
                <div className="rating">
                  {[5, 4, 3, 2, 1].map(star => (
                    <React.Fragment key={`ui-${star}`}>
                      <input 
                        type="radio" 
                        id={`ui-star-${star}`} 
                        name="uiRating" 
                        value={star} 
                        onChange={handleRatingChange}
                        checked={feedbackData.uiRating === star}
                      />
                      <label htmlFor={`ui-star-${star}`}>★</label>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label>How would you rate the grocery list processing?</label>
                <div className="rating">
                  {[5, 4, 3, 2, 1].map(star => (
                    <React.Fragment key={`process-${star}`}>
                      <input 
                        type="radio" 
                        id={`process-star-${star}`} 
                        name="processRating" 
                        value={star} 
                        onChange={handleRatingChange}
                        checked={feedbackData.processRating === star}
                      />
                      <label htmlFor={`process-star-${star}`}>★</label>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="feedback-comments">Please share any suggestions or issues:</label>
                <textarea
                  id="feedback-comments"
                  name="comments"
                  value={feedbackData.comments}
                  onChange={handleFeedbackChange}
                  placeholder="Your feedback helps us improve..."
                ></textarea>
              </div>
              
              <button type="submit">Submit Feedback</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function getCategoryIcon(category) {
  const icons = {
    'Proteins': '🥩',
    'Fruits': '🍎',
    'Vegetables': '🥬',
    'Grains': '🌾',
    'Dairy': '🥛',
    'Nuts/Seeds': '🥜',
    'Fats/Oils': '🫒',
    'Beverages': '🥤',
    'Others': '🛒'
  };
  return icons[category] || '🛒';
}

export default GroceryListProcessor;

// Add some CSS for the loading text
const styles = `
.glp-loading-text {
  margin-top: 1rem;
  color: #666;
  text-align: center;
  font-size: 1.1rem;
}
`;

// Add the styles to the document
const styleSheet = document.createElement('style');
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);