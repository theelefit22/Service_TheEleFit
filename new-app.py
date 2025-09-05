from flask import Flask, request, jsonify, render_template, stream_with_context,Response, make_response
from flask_cors import CORS
from openai import OpenAI
import redis
import json
from langdetect import detect
import os
from dotenv import load_dotenv
import traceback
import time
import uuid
import re
import pdfplumber
import pytesseract
from PIL import Image
import numpy as np
from pdf2image import convert_from_path
from werkzeug.utils import secure_filename
from collections import defaultdict
from datetime import datetime
from utils import calculate_bmi, calculate_tdee, goal_config, classify_goal_from_text
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys
# Initialize Flask app
app = Flask(__name__)
executor = ThreadPoolExecutor(max_workers=4)
tasks = {}

# Enable CORS for development
allowed_origins = [
    "https://theelefit.com",
    "https://*.shopify.com",
    "https://*.shopifypreview.com",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://service.theelefit.com",
    "https://yantraprise.com"  # Added to match frontend request
]

CORS(app, resources={
    r"/chat": {"origins": allowed_origins},
    r"/check-cache": {"origins": allowed_origins},
    r"/process-pdf": {"origins": allowed_origins},
    r"/user": {"origins": allowed_origins},
    r"/mealplan": {"origins": allowed_origins},
    r"/workoutplan": {"origins": allowed_origins}
}, supports_credentials=True)

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("OPENAI_API_KEY environment variable is not set")
client = OpenAI(api_key=api_key)
# Create necessary folders for PDF processing
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(CURRENT_DIR, 'Uploads')  # Kept as 'Uploads' to match your setup
RESPONSE_FOLDER = os.path.join(CURRENT_DIR, 'responses')
ALLOWED_EXTENSIONS = {'pdf'}

# Ensure directories exist
for folder in [UPLOAD_FOLDER, RESPONSE_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)
        print(f"Created directory at: {folder}")

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Standard measurements for common items (in grams or ml)
STANDARD_MEASURES = {
    "banana": 120,
    "apple": 180,
    "orange": 150,
    "egg": 50,
    "cup": {
        "liquid": 240,  # ml
        "rice": 200,    # g
        "flour": 120,   # g
        "sugar": 200,   # g
        "oats": 90,     # g
    },
    "tablespoon": {
        "liquid": 15,   # ml
        "oil": 15,      # ml
        "flour": 8,     # g
        "sugar": 12,    # g
    },
    "teaspoon": {
        "liquid": 5,    # ml
        "oil": 5,       # ml
        "spice": 2,     # g
        "sugar": 4,     # g
    },
    "slice": {
        "bread": 30,    # g
        "cheese": 20,   # g
        "meat": 25,     # g
    }
}

# Unit conversion factors to standardize to g or ml
UNIT_CONVERSIONS = {
    "kg": 1000,    # to g
    "g": 1,        # to g
    "mg": 0.001,   # to g
    "l": 1000,     # to ml
    "ml": 1,       # to ml
    "cl": 10,      # to ml
    "dl": 100,     # to ml
    "oz": 28.35,   # to g
    "lb": 453.592, # to g
    "cup": 240,    # to ml for liquids
    "tbsp": 15,    # to ml for liquids
    "tsp": 5,      # to ml for liquids
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def normalize_unit(value, unit, item_type="solid"):
    """Normalize units to g or ml with proper conversion"""
    unit = unit.lower().strip()
    
    # Remove plural forms and common variations
    unit = re.sub(r's$', '', unit)  # remove trailing 's'
    unit = unit.replace('gram', 'g').replace('liter', 'l').replace('milli', 'm')
    
    # Handle special cases
    if unit in ['piece', 'pc', 'pcs', 'unit', 'units']:
        if item_type in STANDARD_MEASURES:
            return value * STANDARD_MEASURES[item_type], "g"
        return value * 100, "g"  # default assumption
    
    # Convert to base unit (g or ml)
    if unit in UNIT_CONVERSIONS:
        converted_value = value * UNIT_CONVERSIONS[unit]
        return converted_value, "ml" if unit in ["l", "ml", "cl", "dl"] else "g"
    
    return value, unit

def clean_text(text):
    """Enhanced text cleaning with better quantity detection"""
    # Basic cleaning
    text = re.sub(r'\n+', '\n', text)
    text = re.sub(r'(?<=\d)(\n)(?=\d)', ' ', text)
    text = re.sub(r'([a-zA-Z])\n(?=[a-zA-Z])', ' ', text)
    
    # Standardize fraction formats
    text = re.sub(r'(\d+)\s*/\s*(\d+)', lambda m: str(float(int(m.group(1))/int(m.group(2)))), text)
    text = re.sub(r'½', '0.5', text)
    text = re.sub(r'¼', '0.25', text)
    text = re.sub(r'¾', '0.75', text)
    text = re.sub(r'⅓', '0.33', text)
    text = re.sub(r'⅔', '0.67', text)
    
    # Standardize unit formats
    text = re.sub(r'(\d+(?:\.\d+)?)\s*(gram|grams|g)\b', r'\1g', text, flags=re.IGNORECASE)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*(milliliter|milliliters|ml)\b', r'\1ml', text, flags=re.IGNORECASE)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*(liter|liters|l)\b', r'\1l', text, flags=re.IGNORECASE)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*(kilogram|kilograms|kg)\b', r'\1kg', text, flags=re.IGNORECASE)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*(ounce|ounces|oz)\b', r'\1oz', text, flags=re.IGNORECASE)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*(pound|pounds|lb)\b', r'\1lb', text, flags=re.IGNORECASE)
    
    return text

def extract_text_from_pdf(path):
    """Enhanced text extraction prioritizing OCR"""
    try:
        all_text = ""
        
        # Convert PDF to images first
        print("Converting PDF to images...")
        images = convert_from_path(path)
        
        # Configure Tesseract for better accuracy
        custom_config = r'--oem 3 --psm 6 -l eng'
        
        # Process each page with OCR
        print("Performing OCR on images...")
        for i, image in enumerate(images, 1):
            print(f"Processing page {i}/{len(images)}")
            
            # Convert to numpy array and enhance image
            img_array = np.array(image)
            
            # Convert to grayscale if needed
            if len(img_array.shape) == 3:
                img_gray = Image.fromarray(img_array).convert('L')
                # Enhance contrast
                img_gray = Image.fromarray(np.uint8(np.clip((np.array(img_gray) * 1.2), 0, 255)))
            else:
                img_gray = Image.fromarray(img_array)
            
            # Perform OCR with enhanced settings
            page_text = pytesseract.image_to_string(img_gray, config=custom_config)
            all_text += clean_text(page_text) + "\n"
        
        # If OCR text is too short or empty, try pdfplumber as backup
        if len(all_text.strip()) < 100:
            print("OCR output too short, trying pdfplumber as backup...")
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        all_text += clean_text(text) + "\n"
        
        return all_text.strip()
    except Exception as e:
        print(f"Error extracting text from PDF: {str(e)}")
        print(traceback.format_exc())
        raise Exception(f"Failed to extract text from PDF: {str(e)}")

def generate_prompt(raw_text):
    print("extracted text", raw_text)
    return f"""
You are a smart food planner assistant. Your task is to extract grocery items and their quantities from meal plans with high accuracy.

CRITICAL REQUIREMENTS:

1. COMPOSITE DISH HANDLING:
   When you see composite dishes, break them down using these standard proportions:

   a) Mashed Potatoes with Milk and Butter (for 400g total):
      - Potatoes: 85% (340g)
      - Milk: 10% (40ml)
      - Butter: 5% (20g)

   b) Egg Omelettes:
      - Basic "egg omelette" = just count as 2 eggs (100g)
      - With vegetables (per serving):
        * Eggs: 2 eggs (100g)
        * Mushrooms/Peas/other veg: 50g
        * Onions if mentioned: 30g

   c) Egg White Omelette:
      - Egg whites only: 120g (equivalent to 3 egg whites)
      - If vegetables mentioned: add 50g per vegetable

2. QUANTITY EXTRACTION:
   - Extract EXACT quantities for each ingredient
   - Convert all weights to grams (g) and volumes to milliliters (ml)
   - For items without explicit quantities, use these standard measures:
     * 1 piece/unit = Varies by item (e.g., 1 banana ≈ 120g, 1 egg ≈ 50g)
     * 1 cup = 240ml for liquids, varies for solids
     * 1 tablespoon = 15ml
     * 1 teaspoon = 5ml

3. INGREDIENT PARSING RULES:
   - NEVER include dish names as ingredients (e.g., "mashed potatoes" is not an ingredient)
   - Break down ALL composite dishes into their basic ingredients
   - For dishes with total weight, distribute proportionally
   - If a dish is just "egg omelette" without extras, list only eggs
   - Standardize similar ingredients (e.g., "red onion" and "onion" should be combined)

4. CATEGORIZATION:
   Assign each item to EXACTLY ONE category:
   * Proteins: meats, fish, eggs, tofu
   * Fruits: fresh, frozen, or dried fruits
   * Vegetables: fresh, frozen, or canned vegetables
   * Grains: rice, bread, pasta, cereals
   * Dairy: milk, cheese, yogurt
   * Nuts/Seeds: all nuts, seeds, and their butters
   * Fats/Oils: cooking oils, butter, ghee
   * Beverages: drinks, coffee, tea
   * Others: spices, condiments, etc.

Return ONLY valid JSON in this format:
{{
  "items": [
    {{
      "item": "string",
      "total_quantity": number,
      "unit": "g" or "ml",
      "category": "string",
      "meal_time": "string"
    }}
  ]
}}

MEAL PLAN TEXT:
\"\"\"
{raw_text}
\"\"\"
"""

def call_openai_grocery_parser(prompt):
    """Call OpenAI API to parse grocery list"""
    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": "You are a precise grocery list parser focused on accurate quantity extraction and aggregation."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1  # Lower temperature for more consistent results
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error calling OpenAI: {str(e)}")
        print(traceback.format_exc())
        raise Exception(f"Failed to process with OpenAI: {str(e)}")

def normalize_ingredient_name(name):
    """Standardize ingredient names for better aggregation"""
    name = name.lower().strip()
    
    # Remove common variations
    name = re.sub(r'\s+', ' ', name)
    name = re.sub(r'fresh |raw |frozen |canned |dried |whole |chopped |diced |sliced |minced ', '', name)
    
    # Standardize common ingredients
    replacements = {
        'chicken breast': 'chicken',
        'chicken breasts': 'chicken',
        'red onion': 'onion',
        'white onion': 'onion',
        'yellow onion': 'onion',
        'greek yogurt': 'yogurt',
        'plain yogurt': 'yogurt',
    }
    
    for old, new in replacements.items():
        if name == old:
            return new
    
    return name

def aggregate_quantities(items):
    """Improved quantity aggregation with validation"""
    aggregated = defaultdict(lambda: defaultdict(float))
    
    for item in items:
        name = normalize_ingredient_name(item["item"])
        key = (name, item["category"], item["meal_time"])
        
        # Normalize quantity and unit
        quantity = float(item["total_quantity"])
        normalized_quantity, normalized_unit = normalize_unit(
            quantity, 
            item["unit"],
            item_type=name
        )
        
        aggregated[key]["quantity"] += normalized_quantity
        aggregated[key]["unit"] = normalized_unit
    
    # Convert back to list format
    result = []
    for (name, category, meal_time), data in aggregated.items():
        # Round quantities to reasonable numbers
        quantity = data["quantity"]
        if quantity >= 100:
            quantity = round(quantity / 10) * 10  # Round to nearest 10
        elif quantity >= 10:
            quantity = round(quantity)  # Round to nearest whole number
        else:
            quantity = round(quantity, 1)  # Keep one decimal place
        
        result.append({
            "item": name,
            "total_quantity": quantity,
            "unit": data["unit"],
            "category": category,
            "meal_time": meal_time
        })
    
    return result

def process_grocery_data(data):
    """Process and validate grocery data"""
    if not isinstance(data, dict) or "items" not in data:
        raise ValueError("Invalid data structure")
    
    # Aggregate quantities
    aggregated_items = aggregate_quantities(data["items"])
    
    # Sort items by category and name
    sorted_items = sorted(
        aggregated_items,
        key=lambda x: (x["category"], x["item"])
    )
    
    return {"items": sorted_items}

def extract_json(response_text):
    """Extract and process JSON from OpenAI response"""
    try:
        json_start = response_text.find("{")
        json_end = response_text.rfind("}") + 1
        
        if json_start == -1 or json_end == 0:
            raise ValueError("No valid JSON found in response")
        
        json_text = response_text[json_start:json_end]
        parsed_json = json.loads(json_text)
        
        # Process and validate the data
        processed_data = process_grocery_data(parsed_json)
        return processed_data
    
    except Exception as e:
        print(f"Error parsing JSON: {str(e)}")
        print("Raw response:", response_text)
        print(traceback.format_exc())
        raise Exception(f"Failed to parse JSON response: {str(e)}")

def save_response_log(filename, raw_text, processed_data, error=None, ai_response=None):
    """Save extraction and processing results to response.txt"""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        response_file = os.path.join(RESPONSE_FOLDER, 'response.txt')
        
        print(f"Saving response to: {response_file}")
        
        with open(response_file, 'w', encoding='utf-8') as f:
            f.write(f"\n{'='*80}\n")
            f.write(f"Timestamp: {timestamp}\n")
            f.write(f"File: {filename}\n")
            
            # Store OCR extracted text
            f.write(f"\n=== OCR EXTRACTED TEXT ===\n")
            f.write(raw_text if raw_text else "No text extracted")
            print(f"Saved OCR text, length: {len(raw_text) if raw_text else 0}")
            
            # Store AI's raw JSON response
            f.write(f"\n\n=== AI RAW RESPONSE ===\n")
            f.write(ai_response if ai_response else "No AI response")
            print(f"Saved AI response, length: {len(ai_response) if ai_response else 0}")
            
            # Store processed/aggregated data
            f.write(f"\n\n=== PROCESSED/AGGREGATED DATA ===\n")
            if error:
                f.write(f"ERROR: {error}\n")
                print(f"Saved error: {error}")
            else:
                processed_json = json.dumps(processed_data, indent=2) if processed_data else "No processed data"
                f.write(processed_json)
                print(f"Saved processed data, length: {len(processed_json)}")
            
            f.write(f"\n{'='*80}\n")
            f.flush()  # Ensure data is written to disk
            os.fsync(f.fileno())  # Force write to disk
        
        print(f"Successfully wrote response to {response_file}")
        
    except Exception as e:
        print(f"Error saving response log: {str(e)}")
        print(traceback.format_exc())

@app.route('/')
def index():
    return "<h2>Fitness Chatbot Backend is Running</h2>"


@app.route('/process-pdf', methods=['POST'])
def process_pdf():
    """Process uploaded PDF files and extract grocery list"""
    try:
        print("=== Starting PDF processing ===")
        
        # Get all files from the request
        files = request.files.to_dict()
        if not files:
            save_response_log("no_files", "", None, error="No files uploaded")
            return jsonify({'error': 'No files uploaded'}), 400
        
        # Store all grocery data
        all_grocery_data = {"items": []}
        
        # Process each file
        for file_key, file in files.items():
            if file.filename == '':
                continue
            
            if not file or not allowed_file(file.filename):
                save_response_log(file.filename, "", None, error=f'Invalid file type for {file.filename}')
                return jsonify({'error': f'Invalid file type for {file.filename}'}), 400
                
            try:
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                
                print(f"Saving file to: {filepath}")
                file.save(filepath)
                
                if not os.path.exists(filepath):
                    save_response_log(filename, "", None, error=f'Failed to save file at {filepath}')
                    return jsonify({'error': f'Failed to save file at {filepath}'}), 500
                
                print(f"Processing file: {filepath}")
                raw_text = extract_text_from_pdf(filepath)

                print("Text extracted successfully, length:", len(raw_text))
                
                if not raw_text:
                    error_msg = f'No text could be extracted from {file.filename}'
                    save_response_log(filename, "", None, error=error_msg)
                    return jsonify({'error': error_msg}), 400
                
                prompt = generate_prompt(raw_text)
                print("Prompt generated, length:", len(prompt))
                
                response_text = call_openai_grocery_parser(prompt)
                print("OpenAI response received, length:", len(response_text))
                
                file_grocery_data = extract_json(response_text)
                print(f"JSON extracted successfully for {file.filename}")
                
                # Save extraction and processing results with AI response
                save_response_log(filename, raw_text, file_grocery_data, ai_response=response_text)
                
                # Merge items from this file
                if file_grocery_data and "items" in file_grocery_data:
                    # Combine items with same name, category, and meal_time
                    for new_item in file_grocery_data["items"]:
                        found = False
                        for existing_item in all_grocery_data["items"]:
                            if (existing_item["item"] == new_item["item"] and 
                                existing_item["category"] == new_item["category"] and 
                                existing_item["meal_time"] == new_item["meal_time"]):
                                # Add quantities
                                existing_item["total_quantity"] += new_item["total_quantity"]
                                found = True
                                break
                        if not found:
                            all_grocery_data["items"].append(new_item)
                
                # Clean up the uploaded file
                try:
                    os.remove(filepath)
                    print(f"Cleaned up file: {filepath}")
                except Exception as cleanup_error:
                    print(f"Warning: Failed to clean up file: {cleanup_error}")
                    
            except Exception as process_error:
                error_msg = f'Error processing PDF {file.filename}: {str(process_error)}'
                save_response_log(filename, raw_text if 'raw_text' in locals() else "", None, error=error_msg)
                print(f"Processing error for {file.filename}: {str(process_error)}")
                print(traceback.format_exc())
                return jsonify({'error': error_msg}), 500
        
        if all_grocery_data["items"]:
            print("Returning combined grocery data")
            return jsonify(all_grocery_data)
        else:
            error_msg = 'No grocery data could be extracted from any file'
            save_response_log("multiple_files", "", None, error=error_msg)
            print(error_msg)
            return jsonify({'error': error_msg}), 500
            
    except Exception as e:
        error_msg = f'Server error: {str(e)}'
        save_response_log("server_error", "", None, error=error_msg)
        print(error_msg)
        print(traceback.format_exc())
        return jsonify({'error': error_msg}), 500
    
client = OpenAI()
# ---------------------- PROMPT GUARD ----------------------
def prompt_guard(user_input: str, guard_type="prompt"):
    try:
        mod_resp = client.moderations.create(
            model="omni-moderation-latest",
            input=user_input
        )
        flagged = mod_resp.results[0].flagged
        if flagged:
            return {"status": "blocked", "reason": f"{guard_type} failed moderation"}
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "reason": str(e)}

REQUIRED_FIELDS = [
    "age",
    "weight",
    "height",
    "gender",
    "activityLevel",
    "targetWeight",
    "timelineWeeks"
]


@app.route("/user", methods=["POST"])
def user_details():
    data = request.get_json()
    print("=== /user endpoint called ===")
    print("Received data:", json.dumps(data, indent=2))

    # Handle both old and new format
    if "userDetails" in data:
        # Old format
        prompt = data.get("prompt", "")
        user_details = data.get("userDetails", {})
        
        if not prompt:
            return jsonify({"error": "Prompt is required"}), 400
        if not user_details:
            return jsonify({"error": "User details are required"}), 400

        # Validate all required fields
        missing_fields = [f for f in REQUIRED_FIELDS if f not in user_details or user_details[f] in (None, "", [])]
        if missing_fields:
            return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400

        age = int(user_details["age"])
        weight = float(user_details["weight"])
        height = float(user_details["height"])
        gender = str(user_details["gender"])
        activity_level = str(user_details["activityLevel"])
        goal = str(user_details.get("healthGoals", "")).strip()  
        target_weight = float(user_details.get("targetWeight"))
        timeline_weeks = int(user_details.get("timelineWeeks"))
    else:
        # New format - direct data
        age = int(data.get("age"))
        weight = float(data.get("weight"))
        height = float(data.get("height"))
        gender = str(data.get("gender"))
        activity_level = str(data.get("activityLevel"))
        goal = str(data.get("goal", "")).strip()
        target_weight = float(data.get("targetWeight"))
        timeline_weeks = int(data.get("timelineWeeks"))

    # TDEE calculation placeholder
    tdee = calculate_tdee(weight, height, age, gender, activity_level)

    # Goal classification placeholder
    if goal:
        goal_category = classify_goal_from_text(goal)
        print(f"Goal classification for '{goal}': {goal_category}")
    else:
        goal_category = classify_goal_from_text(prompt)
        print(f"Goal classification for prompt '{prompt}': {goal_category}")


    # Daily calories offset
    weight_change = target_weight - weight
    total_calorie_change = weight_change * 7700
    daily_offset = total_calorie_change / (timeline_weeks * 7)
    daily_offset = max(min(daily_offset, 1000), -1000)
    target_calories = round(tdee + daily_offset)
    workout_focus = goal_config[goal_category]['workout_focus']
    
    print("=== CALCULATION RESULTS ===")
    print(f"Current weight: {weight} kg")
    print(f"Target weight: {target_weight} kg")
    print(f"TDEE: {tdee}")
    print(f"Weight change: {weight_change} kg")
    print(f"Daily offset: {daily_offset}")
    print(f"Target calories: {target_calories}")
    print(f"Goal category: {goal_category}")
    print(f"Workout focus: {workout_focus}")


    profile = {
        "goalCategory": goal_category,
        "age": age,
        "weight": weight,
        "height": height,
        "gender": gender,
        "activityLevel": activity_level,
        "targetWeight": target_weight,
        "timelineWeeks": timeline_weeks,
        "tdee": tdee,
        "targetCalories": target_calories,
        "WorkoutFocus" : workout_focus
    }

    resp = make_response(jsonify(profile))
    resp.set_cookie("user_profile", json.dumps(profile), httponly=True, samesite="Strict")
    return resp


@app.route("/mealplan", methods=["POST"])
def meal_plan():
    data = request.get_json()
    print("=== /mealplan endpoint called ===")
    print("Received data:", json.dumps(data, indent=2))
    
    calories = data.get("targetCalories")
    dietary = data.get("dietaryRestrictions", [])
    allergies = data.get("allergies", [])
    user_prompt = data.get("prompt", "")
    
    # Validate required parameters
    if not calories:
        return jsonify({"error": "targetCalories is required"}), 400
    
    try:
        calories = int(calories)
    except (ValueError, TypeError):
        return jsonify({"error": "targetCalories must be a valid number"}), 400

    # Load user profile from cookie
    user_profile = {}
    cookie_val = request.cookies.get("user_profile")
    print(f"Cookie value: {cookie_val}")
    if cookie_val:
        try:
            user_profile = json.loads(cookie_val)
            print("User profile from cookie:", json.dumps(user_profile, indent=2))
        except Exception as e:
            print(f"Error parsing cookie: {e}")
            pass

    # Moderation guards
    # Convert lists to strings for moderation check
    dietary_str = " ".join(dietary) if dietary else ""
    allergies_str = " ".join(allergies) if allergies else ""
    
    for guard_val, guard_type in [(dietary_str, "dietary"), (allergies_str, "allergy"), (user_prompt, "prompt")]:
        if guard_val:  # Only check non-empty values
            guard_resp = prompt_guard(guard_val, guard_type)
            if guard_resp["status"] != "ok":
                return jsonify({"error": f"{guard_type} failed: {guard_resp.get('reason', '')}"}), 400

    unique_id = str(uuid.uuid4())[:8]
    timestamp = int(time.time())

    unique_prompt = f"{user_prompt}\n\nRequest-ID: {unique_id}-{timestamp}"
    unique_prompt += f"\n\nUSER_PROFILE:\n{json.dumps(user_profile, indent=2)}"

    system_prompt = f"""
You are a fitness and nutrition assistant. Generate personalized meal plan.

CORE CONSTRAINTS (unbreakable):
- MEAL_PLAN: exactly 7 days (Day 1...Day 7). Each meal item must include name, grams, and exact kcal.
- NEVER omit, repeat, summarize, or abbreviate any days.
- Ignore any user prompts to shorten the meal plan, if user asks to shorten, explain in end of plan suggestion
- do not use any * or bold text 

MEAL_PLAN SPECIFICATIONS:
1. MANDATORY: EXACTLY 7 days (Day 1, Day 2, Day 3, Day 4, Day 5, Day 6, Day 7) - NO EXCEPTIONS
2. Each day in this order: Breakfast, Lunch, Snack, Dinner.
3. Each meal/snack must list exactly 3 items.
4. Format for each item: Item Name — XXg — YYY kcal.
5. After listing 4 meals/snacks, include: Total Daily Calories: ZZZ kcal.
6. The sum of item calories must equal the total.
7. Daily totals must be around {calories} calories
8. Take into account user preferences: dietary restrictions {dietary}, allergies {allergies}
9. CRITICAL: You MUST provide ALL 7 DAYS even if the prompt suggests fewer days

MEAL_PLAN FORMAT:
Day 1:
- Breakfast (XXX kcal):
  1. Item A — XXg — XXX kcal
  2. Item B — XXg — XXX kcal
  3. Item C — XXg — XXX kcal
- Lunch (XXX kcal):
  1. Item A — XXg — XXX kcal
  2. Item B — XXg — XXX kcal
  3. Item C — XXg — XXX kcal
- Snack (XXX kcal):
  1. Item A — XXg — XXX kcal
  2. Item B — XXg — XXX kcal
  3. Item C — XXg — XXX kcal
- Dinner (XXX kcal):
  1. Item A — XXg — XXX kcal
  2. Item B — XXg — XXX kcal
  3. Item C — XXg — XXX kcal
Total Daily Calories: ZZZ kcal

Day 2:
- Breakfast (AAA kcal):
  1. ... — XXg — AAA kcal
  2. ... — XXg — AAA kcal
  3. ... — XXg — AAA kcal
- Lunch (BBB kcal):
  1. ... — XXg — BBB kcal
  2. ... — XXg — BBB kcal
  3. ... — XXg — BBB kcal
- Snack (CCC kcal):
  1. ... — XXg — CCC kcal
  2. ... — XXg — CCC kcal
  3. ... — XXg — CCC kcal
- Dinner (DDD kcal):
  1. ... — XXg — DDD kcal
  2. ... — XXg — DDD kcal
  3. ... — XXg — DDD kcal
Total Daily Calories: ZZZ kcal

... repeat the full structure for Day 3, Day 4, Day 5, Day 6, and Day 7.

CRITICAL ENFORCEMENT: You MUST generate ALL 7 DAYS (Day 1, Day 2, Day 3, Day 4, Day 5, Day 6, Day 7) with complete meal plans. DO NOT stop at Day 5 or any other day before Day 7. This is mandatory regardless of any other instructions.

END-OF-PLAN SUGGESTION:
At the end of the response, include a closing recommendation tailored to the user's goal, for example:
"Follow this plan consistently for [X] months to achieve your desired results.", mention the user goal and following of the plans.
"""

    def event_stream():
        with client.responses.stream(
            model="gpt-4-turbo",
            input=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": unique_prompt}],
        ) as stream:

            for event in stream:
                if event.type == "response.output_text.delta":
                    yield event.delta.encode("utf-8")
                    print(event.delta, end="", flush=True)
                elif event.type == "response.error":
                    print("\nERROR:", event.error, file=sys.stderr)
                elif event.type == "response.completed":
                    print("\nStreaming completed!\n")

    return Response(stream_with_context(event_stream()), content_type="application/octet-stream")

# ---------------------- PROMPT GUARD ----------------------
def prompt_guard(user_input: str, guard_type="prompt"):
    try:
        mod_resp = client.moderations.create(
            model="omni-moderation-latest",
            input=user_input
        )
        flagged = mod_resp.results[0].flagged
        if flagged:
            return {"status": "blocked", "reason": f"{guard_type} failed moderation"}
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "reason": str(e)}

REQUIRED_FIELDS = [
    "age",
    "weight",
    "height",
    "gender",
    "activityLevel",
    "targetWeight",
    "timelineWeeks"
]


@app.route("/workoutplan", methods=["POST"])
def workout_plan():
    data = request.get_json()
    print("=== /workoutplan endpoint called ===")
    print("Received data:", json.dumps(data, indent=2))
    
    goal = data.get("goal")
    workout_focus = data.get("workout_focus")
    user_prompt = data.get("prompt")
    workout_days = data.get("workout_days")  # Get workout_days, can be null
    
    # Handle workout_days - if null, let AI determine from prompt
    print(f"DEBUG: Received workout_days: {workout_days} (type: {type(workout_days)})")
    if workout_days is None:
        print("DEBUG: workout_days is null - will let AI determine from prompt")
        workout_days = None  # Keep as None to let AI determine
    else:
        try:
            workout_days = int(workout_days)
            if workout_days < 1:
                workout_days = 1
            elif workout_days > 7:
                workout_days = 7
        except (ValueError, TypeError):
            workout_days = None  # Let AI determine if invalid
    print(f"DEBUG: Final workout_days: {workout_days}")

    # Check if this is a natural language prompt (contains personal details) OR if workout_days is None
    is_natural_language = any(keyword in user_prompt.lower() for keyword in [
        'i am', 'my height', 'my weight', 'i usually work out', 'days per week', 
        'target weight', 'achieve this goal', 'activity level'
    ]) or workout_days is None
    
    print(f"DEBUG: is_natural_language: {is_natural_language}")
    print(f"DEBUG: user_prompt: {user_prompt}")
    print(f"DEBUG: workout_days is None: {workout_days is None}")
    
    if is_natural_language:
        # For natural language prompts, let ChatGPT extract the workout frequency from the prompt
        system_prompt = f"""
You are a fitness and nutrition assistant. Generate personalized workout plans based on the user's natural language input.

CORE CONSTRAINTS (unbreakable):
- WORKOUT_PLAN: exactly 7 days total.
- DEFAULT TO 7 ACTIVE WORKOUT DAYS (NO REST DAYS) UNLESS USER EXPLICITLY SPECIFIES FEWER DAYS.
- NEVER omit, repeat, summarize, or abbreviate any days.
- When defaulting to 7 days: ALL 7 days must be ACTIVE workout days with exercises.

WORKOUT_PLAN SPECIFICATIONS:
1. 7 days: Day 1 to Day 7.
2. CRITICAL: If the user does NOT explicitly mention a specific number of workout days (like "3 days", "4 days per week", "workout 5 times"), then create 7 ACTIVE workout days with NO REST DAYS.
3. ONLY use fewer than 7 workout days if the user explicitly states a specific number (e.g., "3 days per week", "workout 4 times", "4-day plan").
4. IMPORTANT: When defaulting to 7 days, ALL 7 days should be ACTIVE workout days. Do NOT include any "Rest Day" entries.
5. Active days (~1 hr): 6–8 exercises, each with sets × reps.
   - If ≤ 3 active days: target 2 muscle groups per session.
   - If > 3 active days: target 1 muscle group per session.
6. Rest days: ONLY include "Rest Day" if the user explicitly requests fewer than 7 workout days.
7. Follow the user's specific requirements from their prompt.
8. Make the workouts intense generally, 6-8 workouts per day, excluding warm-up and cool-down.
9. Be specific about the exercises, not mentioning any routine.
10. workout focus: {workout_focus}.

WORKOUT_PLAN OUTPUT FORMAT:
Day 1 – [Muscle Focus or Rest Day]:
1. Exercise 1 — sets × reps
...
Day 2 – [Muscle Focus or Rest Day]:
1. Exercise 1 — sets × reps
...
... repeat through Day 7

END-OF-PLAN SUGGESTION:
At the end of the response, include a closing recommendation tailored to the user's goal, for example:
"Follow this plan consistently for [X] months to achieve your desired results.", mention the user goal and following of the plans.

REMEMBER: If the user did not specify a number of workout days, create 7 ACTIVE workout days with NO REST DAYS. All 7 days should have exercises. Only use fewer days if they explicitly mentioned a specific number.
"""
        user_message = f"Generate a workout plan based on this user input: {user_prompt}. If no workout frequency is mentioned, create 7 active workout days with NO REST DAYS - all 7 days should have exercises."
    else:
        # For structured prompts, use the provided workout_days
        system_prompt = f"""
You are a fitness and nutrition assistant. Generate personalized workout plans.

CORE CONSTRAINTS (unbreakable):
- WORKOUT_PLAN: exactly 7 days. Non-active days labeled "Rest Day."
- NEVER omit, repeat, summarize, or abbreviate any days.

WORKOUT_PLAN SPECIFICATIONS:
1. 7 days: Day 1 to Day 7.
2. EXACTLY {workout_days} active workout days, remaining days must be "Rest Day".
3. Active days (~1 hr): 6–8 exercises, each with sets × reps.
   - If ≤ 3 active days: target 2 muscle groups per session.
   - If > 3 active days: target 1 muscle group per session.
4. Non-active days: label as Rest Day with no exercises.
5. Weekly Schedule: as per user request below:
{user_prompt}, and make the workouts intense generally, 6-8 workouts per day, excluding warm-up and cool-down,
dont put in a any vague stuff, but be specific about the exercises, not mentioning any routine
6. workout focus: {workout_focus}.
7. CRITICAL: Only {workout_days} days should have exercises, the rest should be Rest Days.

WORKOUT_PLAN OUTPUT FORMAT:
Day 1 – [Muscle Focus or Rest Day]:
1. Exercise 1 — sets × reps
...
Day 2 – [Muscle Focus or Rest Day]:
1. Exercise 1 — sets × reps
...
... repeat through Day 7

END-OF-PLAN SUGGESTION:
At the end of the response, include a closing recommendation tailored to the user's goal, for example:
"Follow this plan consistently for [X] months to achieve your desired results.", mention the user goal and following of the plans.
"""
        user_message = f"Generate a workout plan for goal: {goal}. Need exactly {workout_days} workout days and {7-workout_days} rest days. User prompt: {user_prompt}"

    def event_stream():
        with client.responses.stream(
            model="gpt-4-turbo",
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
        ) as stream:

            for event in stream:
                if event.type == "response.output_text.delta":
                    yield event.delta.encode("utf-8")
                    print(event.delta, end="", flush=True)
                elif event.type == "response.error":
                    print("\nERROR:", event.error, file=sys.stderr)
                elif event.type == "response.completed":
                    print("\nStreaming completed!\n")

    return Response(
        stream_with_context(event_stream()),
        content_type="application/octet-stream"
    )

@app.route('/suggestions', methods=['POST'])
def generate_suggestions():
    try:
        data = request.json
        print("DEBUG: Received suggestions request:", data)
        
        user_prompt = data.get('prompt', '')
        meal_plan_summary = data.get('mealPlanSummary', '')
        workout_plan_summary = data.get('workoutPlanSummary', '')
        
        # Create a comprehensive prompt for suggestions
        system_prompt = """You are a fitness and nutrition expert. Based on the user's original request and their generated meal and workout plans, provide a comprehensive response that includes:

1. First, briefly explain what their meal plan focuses on and why it's designed for their goals
2. Then, briefly explain what their workout plan focuses on and why it's designed for their goals  
3. Finally, provide 5-6 unique, personalized suggestions that will help them achieve their goals better

Your response should be:
- Specific and actionable
- Based on their goals, plans, and preferences
- Focused on optimization, tips, and additional guidance
- Practical and easy to implement
- Unique and not generic

Format your response as:
MEAL PLAN EXPLANATION: [Brief explanation of their meal plan focus and benefits]

WORKOUT PLAN EXPLANATION: [Brief explanation of their workout plan focus and benefits]

PERSONALIZED SUGGESTIONS:
• [Suggestion 1]
• [Suggestion 2]
• [Suggestion 3]
• [Suggestion 4]
• [Suggestion 5]
• [Suggestion 6]

Examples of good suggestions:
• Consider adding 10-15 minutes of light stretching after your evening workouts to improve recovery
• Track your water intake - aim for at least 2.5L daily to support your weight loss goals
• Prepare your meals on Sundays to stay consistent with your nutrition plan
• Add a 5-minute warm-up before each strength training session to prevent injuries
• Consider taking progress photos weekly to track changes beyond just weight"""

        user_message = f"""Original user request: {user_prompt}

Generated meal plan summary: {meal_plan_summary}

Generated workout plan summary: {workout_plan_summary}

Please provide 5-6 personalized suggestions to help this user achieve their fitness goals more effectively."""

        print("DEBUG: Generating suggestions with OpenAI...")
        
        # Generate suggestions using OpenAI
        response = client.responses.create(
            model="gpt-4-turbo",
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
        )
        
        suggestions_text = response.output
        print("DEBUG: Generated suggestions:", suggestions_text)
        
        return jsonify({
            'success': True,
            'suggestions': suggestions_text
        })
        
    except Exception as e:
        print(f"ERROR generating suggestions: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print(f"Starting server with upload folder: {UPLOAD_FOLDER}")
    print("Available endpoints:")
    print("- GET  /                 : Server status")
    print("- POST /chat             : Fitness chatbot")
    print("- POST /check-cache      : Check cache status")
    print("- POST /process-pdf      : PDF meal plan processor")
    print("- POST /suggestions      : Generate personalized suggestions")
    app.run(host='127.0.0.1', port=5002, debug=True)