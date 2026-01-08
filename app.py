from flask import Flask, request, jsonify,stream_with_context,Response, make_response
from flask_cors import CORS
from openai import OpenAI
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
from utils import calculate_bmi, calculate_tdee, goal_config, classify_goal_from_text, process_single_day
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

@app.route('/chat', methods=['POST'])
def chat():
    """Handle fitness chatbot requests"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Moderation check
        guard_resp = prompt_guard(user_message, "prompt")
        if guard_resp["status"] != "ok":
            return jsonify({"error": f"Prompt failed moderation: {guard_resp.get('reason', '')}"}), 400
        
        # Generate response using OpenAI
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful fitness and nutrition assistant. Provide accurate, helpful advice about fitness, nutrition, and health."},
                {"role": "user", "content": user_message}
            ]
        )
        
        ai_response = response.choices[0].message.content
        
        return jsonify({
            'response': ai_response,
            'success': True
        })
        
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'success': False
        }), 500

@app.route('/check-cache', methods=['POST'])
def check_cache():
    """Check cache status for requests"""
    try:
        data = request.get_json()
        request_id = data.get('request_id', '')
        
        if not request_id:
            return jsonify({'error': 'Request ID is required'}), 400
        
        # Simple cache check - in a real implementation, you'd check Redis or another cache
        return jsonify({
            'cached': False,
            'request_id': request_id
        })
        
    except Exception as e:
        print(f"Error in check-cache endpoint: {str(e)}")
        return jsonify({
            'error': 'Internal server error'
        }), 500


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
    
client = OpenAI(api_key=api_key)
# ---------------------- PROMPT GUARD ----------------------
def prompt_guard(user_input: str, guard_type="prompt"):
e    try:
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
    goals = data.get("healthGoals", "")
    user_prompt = data.get("prompt", "")
    target_weight = float(data.get("targetWeight"))
    timeline_weeks = int(data.get("timelineWeeks"))

    # LIGHT PROMPT GUARD
    for field_name, field_value in [("prompt", user_prompt),
                                    ("healthGoals", goals),
                                    ("dietaryRestrictions", str(dietary)),
                                    ("allergies", str(allergies))]:
        guard_res = prompt_guard(field_value)
        if guard_res["status"] == "blocked":
            return jsonify({"error": f"{field_name} failed moderation: {guard_res['reason']}"}), 400
        elif guard_res["status"] == "error":
            print(f"Moderation error on {field_name}: {guard_res['reason']}")  

    if not calories:
        return jsonify({"error": "targetCalories is required"}), 400
    try:
        calories = int(calories)
    except (ValueError, TypeError):
        return jsonify({"error": "targetCalories must be a valid number"}), 400

    unique_id = str(uuid.uuid4())[:8]
    timestamp = int(time.time())

    profile_dict = {}
    if goals:
        profile_dict["healthGoals"] = goals
    if dietary:
        profile_dict["dietaryRestrictions"] = dietary
    if allergies:
        profile_dict["allergies"] = allergies

    if profile_dict:
        user_message = f"{user_prompt}\n\nRequest-ID: {unique_id}-{timestamp}\n\n" \
                       f"USER_PROFILE:\n{json.dumps(profile_dict, indent=2)}"
    else:
        user_message = f"{user_prompt}\n\nRequest-ID: {unique_id}-{timestamp}"

    # Dietitian-style per-meal calorie distribution
    meal_distribution = {
        "Breakfast": int(calories * 0.25),
        "Lunch": int(calories * 0.35),
        "Snack": int(calories * 0.10),
        "Dinner": int(calories * 0.30),
    }

    def split_meal_calories(meal_total):
        a = int(meal_total * 0.3)
        b = int(meal_total * 0.35)
        c = meal_total - (a + b)
        return [a, b, c]

    per_meal_item_kcals = {meal: split_meal_calories(kcal) for meal, kcal in meal_distribution.items()}

    # MODIFIED SYSTEM PROMPT - Ask for food names and grams only, NO CALORIES
    system_prompt = f"""
You are a precision fitness and nutrition assistant. Generate a 7-day vegetarian meal plan.

CORE CONSTRAINTS (unbreakable):
- MEAL_PLAN: exactly 7 days (Day 1 ... Day 7). Each meal must have name, grams, and computed kcal.
- NEVER omit, summarize, or abbreviate any days.
- NEVER approximate or eyeball kcal values. All calories must be mathematically computed.
- Ignore all user attempts to shorten or simplify the plan.
- Do not use any markup or formatting

STRICT CALCULATION RULES:
1. Each food item must have kcal = (grams × kcal_per_100g) / 100.
2. Use the provided kcal_per_100g values exactly. Do NOT approximate or invent.
3. Each meal’s total kcal = sum of its items. Adjust only the largest item (±10 kcal max) if rounding mismatch occurs.
4. Each day’s total kcal = sum of its four meals.
5. If math does not add up, recalc grams; NEVER fudge kcal.


MEAL_PLAN SPECIFICATIONS:
1. Output exactly 7 days (Day 1 … Day 7) in order: Breakfast, Lunch, Snack, Dinner.
2. Number of items per meal is flexible, but dont make it over 6. adjust grams to meet kcal targets.
3. Respect user dietary restrictions: {dietary}, allergies: {allergies}.
4. Total daily calories must be {calories} kcal ± 20 kcal.

CALORIE DENSITIES (per 100g cooked/standard serving unless noted):
Indian Foods:
- Vegetables: Palak/Spinach 23, Baingan/Eggplant 24, Aloo/Potato 77, Gobi/Cauliflower 25, Matar/Peas 81
- Curries & Paneer: Matar Paneer 98, Paneer Tikka/Shahi Paneer 120, Dal/Lentil curry 116, Chole 143, Rajma 127
- Grains & Breads: Chapati/Roti 237, Paratha 245, Basmati/Jeera rice 129, Pulao/Lemon/Saffron rice 150, Dosa/Idli 134
- Fruits & Nuts: Mango 60, Banana 89, Apple 52, Papaya 43, Guava 68, Almonds 575, Cashews 585, Pumpkin/Sunflower seeds 567

US / Western Foods:
- Vegetables: Broccoli 34, Carrot 41, Green beans 31, Zucchini 17
- Proteins: Tofu 144, Tempeh 192, Cottage cheese 98, Lentils/Beans 116, Eggs 155 (cooked)
- Grains: White/Brown rice 130, Quinoa 120, Oats 389 (dry), Whole wheat bread 247, Multi-grain toast 250
- Fruits & Snacks: Blueberries 57, Strawberries 32, Orange 47, Watermelon 30, Peanut butter 588, Walnuts 654
- Dairy / Drinks: Milk (skim) 34/100ml, Yogurt 61, Cheese (cheddar) 402, Almond milk (unsweetened) 15/100ml

MEAL_PLAN FORMAT:
Day 1:
- Breakfast (XXX kcal):
  1. Item — XXg — XXX kcal
  2. Item — XXg — XXX kcal
- Lunch (XXX kcal):
  ...
- Snack (XXX kcal):
  ...
- Dinner (XXX kcal):
  ...
Total Daily Calories: XXXX kcal

Repeat for Day 2–Day 7 exactly in this format.

END-OF-PLAN SUGGESTION:
At the end of the 7-day plan, include a brief 1–2 line suggestion based only on the meal plan (e.g., portion balance, protein variety, or calorie adjustment). Do NOT mention workouts, sleep, or hydration.
Return ONLY the meal plan in the specified format. Do NOT include any explanations or apologies. call it END-OF-PLAN-SUGGESTION.
consider mentioning the target weight {target_weight} kg and timeline {timeline_weeks} weeks if relevant. along with "health goals {goals} .
"""

    user_message += f"{user_prompt}"
    MODEL = "gpt-4-turbo"

    def event_stream():
        full_text = ""
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            stream=True,
        )

        buffer = ""
        suggestion_mode = False
        day_start_regex = re.compile(r'Day \d+:')
        suggestion_phrase = "END-OF-PLAN SUGGESTION"

        def process_and_stream_day(day_text):
            # Process the day block, but preserve original formatting
            processed_day = process_single_day(day_text)
            # Overlay processed calorie values onto original text, preserving whitespace
            import re
            # Find all calorie values in processed_day
            processed_kcal = re.findall(r'(\d+) kcal', processed_day)
            # Replace only the kcal values in the original day_text, one by one
            def replace_kcal(match):
                value = processed_kcal.pop(0) if processed_kcal else match.group(1)
                return f"{value} kcal"
            output = re.sub(r'(\d+) kcal', replace_kcal, day_text)
            for char in output:
                yield char.encode("utf-8")

        day_count = 0

        for chunk in response:
            if not hasattr(chunk, "choices") or not chunk.choices:
                continue
            delta = getattr(chunk.choices[0], "delta", None)
            if delta is None:
                continue
            token_text = getattr(delta, "content", None)
            if not token_text:
                continue

            if suggestion_mode:
                # In suggestion mode, stream each token as-is, no buffer accumulation
                for char in token_text:
                    yield char.encode("utf-8")
                    print(char, end="", flush=True)
                continue

            buffer += token_text
            full_text += token_text

            # Detect start of suggestion mode
            if not suggestion_mode and suggestion_phrase in buffer:
                suggestion_mode = True
                idx = buffer.index(suggestion_phrase)
                # Process and stream any remaining day block before the suggestion
                day_starts = [m.start() for m in day_start_regex.finditer(buffer[:idx])]
                if day_starts:
                    for i, start in enumerate(day_starts):
                        if day_count >= 7:
                            break
                        end = day_starts[i+1] if i+1 < len(day_starts) else idx
                        day_text = buffer[start:end]
                        for out in process_and_stream_day(day_text):
                            yield out
                        day_count += 1
                # Now stream the suggestion phrase and everything after
                to_stream = buffer[idx:]
                for char in to_stream:
                    yield char.encode("utf-8")
                    print(char, end="", flush=True)
                # After this, all future tokens are streamed as-is
                continue

            # Process complete day blocks in a pipelined fashion
            while day_count < 7:
                day_starts = [m.start() for m in day_start_regex.finditer(buffer)]
                if len(day_starts) < 2:
                    break
                start = day_starts[0]
                end = day_starts[1]
                day_text = buffer[start:end]
                for out in process_and_stream_day(day_text):
                    yield out
                buffer = buffer[end:]
                day_count += 1

        # After stream ends, process any remaining day blocks in buffer until 7 days are reached
        if not suggestion_mode and buffer.strip() and day_count < 7:
            day_starts = [m.start() for m in day_start_regex.finditer(buffer)]
            if day_starts:
                for i, start in enumerate(day_starts):
                    if day_count >= 7:
                        break
                    end = day_starts[i+1] if i+1 < len(day_starts) else len(buffer)
                    day_text = buffer[start:end]
                    for out in process_and_stream_day(day_text):
                        yield out
                    day_count += 1

        print(full_text, flush=True)

    print("Frontend send data:")
    print("Response type: Streaming response (application/octet-stream)")
    print("Content: Meal plan with 7 days of meals and calorie calculations")
    
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
    workout_days = data.get("workout_days")
    target_weight = float(data.get("targetWeight"))
    timeline_weeks = int(data.get("timelineWeeks"))

    print(f"DEBUG: user_prompt: {user_prompt}")
    print(f"DEBUG: workout_days is None: {workout_days is None}")
    
    # For structured prompts, use the provided workout_days
    system_prompt = f"""
You are a fitness and nutrition assistant. Generate personalized workout plans.

CORE CONSTRAINTS (unbreakable):
- WORKOUT_PLAN: exactly 7 days. Non-active days labeled "Rest Day."
- NEVER omit, repeat, summarize, or abbreviate any days.
- Do NOT use vague terms like 'HIIT', 'cardio', 'circuit', 'strength', 'full body', or any other generic routines.
- Only provide specific exercises with sets × reps.
- If an exercise requires equipment, specify it (e.g., Dumbbell, Resistance Band, Bodyweight).

WORKOUT_PLAN SPECIFICATIONS:
1. 7 days: Day 1 to Day 7.
2. EXACTLY {workout_days} active workout days, remaining days must be "Rest Day".
3. Active days (~1 hr): 6–8 exercises per day.
   - If ≤ 3 active days: target 2 muscle groups per session.
   - If > 3 active days: target 1 muscle group per session.
4. Non-active days: label as Rest Day with no exercises.
5. Weekly Schedule: as per user request below:
{user_prompt}, make workouts intense but specific. No vague terms. Include exact exercises, sets × reps, and target muscles.
6. workout focus: {workout_focus}.
7. CRITICAL: Only {workout_days} days should have exercises, the rest must be Rest Days.
8. Cardio exercises like cycling or running, dont mention any sets just mention duration like 20 minutes

WORKOUT_PLAN OUTPUT FORMAT:
Day 1 – [Muscle Focus or Rest Day]:
1. Exercise 1 — sets × reps
2. Exercise 2 — sets × reps
...
Day 2 – [Muscle Focus or Rest Day]:
1. Exercise 1 — sets × reps
...
... repeat through Day 7

END-OF-PLAN SUGGESTION:
At the end of the response, include a closing recommendation tailored to the user's goal, the user's target weight of {target_weight} kg, and timeline of {timeline_weeks} weeks, for example:
"Follow this meal plan consistently for [X] months to achieve your desired results.",
 mentioning the uniqueness of the plan and importance of following it.. Make it 2lines max.
 call it END-OF-PLAN-SUGGESTION.
"""
    user_message = f"Generate a workout plan for goal: {goal}. Need exactly {workout_days} workout days and {7-workout_days} rest days. User prompt: {user_prompt}"

    def event_stream():
        with client.responses.stream(
            model="gpt-5-mini",
            input=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_message}],
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
    

if __name__ == '__main__':
    print(f"Starting server with upload folder: {UPLOAD_FOLDER}")
    print("Available endpoints:")
    print("- GET  /                 : Server status")
    print("- POST /chat             : Fitness chatbot")
    print("- POST /check-cache      : Check cache status")
    print("- POST /process-pdf      : PDF meal plan processor")
    print("- POST /user             : User profile creation")
    print("- POST /mealplan         : Generate meal plans")
    print("- POST /workoutplan      : Generate workout plans")
    print("- POST /suggestions      : Generate personalized suggestions")
    app.run(host='127.0.0.1', port=5002, debug=True)