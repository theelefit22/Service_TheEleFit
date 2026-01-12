# Error Report: Calorie Discrepancy Between Backend and Frontend

## Issue Summary
**Problem**: Frontend displays different calorie values than what the backend calculates and processes.

**Impact**: Users see inconsistent calorie information, which affects trust and usability of the meal planning feature.

## Error Details

### What Users See:
- **Frontend Display**: 
  ```
  Breakfast
  270 cal
  Whole wheat bread - 50g (130 kcal)
  Cottage cheese - 80g (85 kcal)
  Strawberry - 150g (55 kcal)
  ```

### What Backend Calculates:
- **Backend Console Output**:
  ```
  === DEBUG: ROUNDING PROCESS ===
  Breakfast:
    Whole wheat bread: 124 kcal → 125 kcal
    Cottage cheese: 78 kcal → 80 kcal
    Strawberry: 48 kcal → 50 kcal
  === END ROUNDING DEBUG ===
  ```

### The Discrepancy:
- Backend processes: 124 kcal → 125 kcal (rounded)
- Frontend shows: 130 kcal (original unprocessed value)

## Root Cause Analysis

### 1. Backend Processing (Working Correctly)
- File: `utils.py` - `process_single_day()` function
- **What it does**: Rounds individual item calories to nearest 5
- **Status**: ✅ Working correctly

### 2. Streaming Response Issue (The Problem)
- File: `app.py` - `process_and_stream_day()` function (lines 872-877)
- **What was wrong**: Complex overlay logic that failed to properly replace original calorie values with processed ones
- **The flawed code**:
  ```python
  def process_and_stream_day(day_text):
      processed_day = process_single_day(day_text)
      # Find all calorie values in processed_day
      processed_kcal = re.findall(r'(\d+) kcal', processed_day)
      # Replace only the kcal values in the original day_text, one by one
      def replace_kcal(match):
          value = processed_kcal.pop(0) if processed_kcal else match.group(1)
          return f"{value} kcal"
      output = re.sub(r'(\d+) kcal', replace_kcal, day_text)
  ```

### 3. Frontend Parsing (Working Correctly)
- File: `src/pages/AiCoach.js` - `parseResponseLiveImmediate()` function
- **What it does**: Parses streaming response and extracts calorie values
- **Status**: ✅ Working correctly (parsing what it receives)
