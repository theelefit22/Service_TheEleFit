from flask import Flask, request, jsonify, render_template, stream_with_context,Response, make_response
from flask_cors import CORS
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
import openai

# Initialize Flask app
app = Flask(__name__)
executor = ThreadPoolExecutor(max_workers=4)
tasks = {}

# Enable CORS for all routes - simplified for development
CORS(app, 
     origins="*",  # Allow all origins in development
     allow_headers=["Content-Type", "Authorization", "Accept"],
     methods=["GET", "POST", "OPTIONS"],
     supports_credentials=True)

# Add explicit OPTIONS handling for preflight requests
@app.after_request
def after_request(response):
    # Add CORS headers to every response
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    
    # For SSE responses, add specific headers
    if request.path in ['/mealplan', '/workoutplan'] and request.method == 'POST':
        response.headers['Content-Type'] = 'text/event-stream'
        response.headers['Cache-Control'] = 'no-cache'
        response.headers['X-Accel-Buffering'] = 'no'
    
    return response

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("WARNING: OPENAI_API_KEY environment variable is not set")
    print("Please set it using: export OPENAI_API_KEY='your-api-key'")
    # Use a placeholder to prevent crashes during development
    api_key = "sk-placeholder"
    
openai.api_key = api_key

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
        response = openai.ChatCompletion.create(
            model="gpt-4",
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
    
@app.route('/calculate-calories', methods=['POST', 'OPTIONS'])
def calculate_calories():
    """Calculate daily target calories based on user profile"""
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        
        # Extract data with defaults
        age = int(data.get('age', 30))
        weight = float(data.get('weight', 70))
        height = float(data.get('height', 170))
        gender = data.get('gender', 'other')
        activity_level = data.get('activityLevel', 'moderate')
        target_weight = float(data.get('targetWeight', weight))
        timeline = int(data.get('timeline', 12))  # weeks
        
        # Calculate BMI
        bmi = calculate_bmi(weight, height)
        
        # Calculate TDEE
        tdee = calculate_tdee(age, weight, height, gender, activity_level)
        
        # Determine goal category based on weight change
        weight_change = target_weight - weight
        
        if weight_change < -2:
            goal_category = 'weight_loss'
        elif weight_change > 2:
            goal_category = 'muscle_gain'
        else:
            goal_category = 'maintenance'
        
        # Get daily calorie offset from goal config
        daily_offset = goal_config[goal_category]["daily_offset"]
        
        # Calculate target calories
        target_calories = tdee + daily_offset
        
        # Ensure minimum safe calories
        if goal_category == 'weight_loss':
            min_calories = 1200 if gender == 'female' else 1500
            target_calories = max(target_calories, min_calories)
        
        return jsonify({
            'bmi': round(bmi, 1),
            'tdee': round(tdee),
            'targetCalories': round(target_calories),
            'goalCategory': goal_category,
            'deficit': round(daily_offset),
            'weightChange': round(weight_change, 1),
            'timeline': timeline
        })
        
    except Exception as e:
        print(f"Error calculating calories: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/mealplan", methods=["POST", "OPTIONS"])
def meal_plan():
    if request.method == "OPTIONS":
        return "", 200
        
    data = request.get_json()
    calories = data.get("targetCalories", 2000)
    dietary_restrictions = data.get("dietaryRestrictions", "")
    allergies = data.get("allergies", "")
    prompt = data.get("prompt", "")
    
    # Check if client accepts SSE
    accept_header = request.headers.get('Accept', '')
    if 'text/event-stream' not in accept_header:
        # Return regular JSON response for non-SSE clients
        try:
            messages = [
                {"role": "system", "content": "You are a professional nutritionist creating personalized meal plans."},
                {"role": "user", "content": f"""Create a 7-day meal plan with the following requirements:
                - Target calories per day: {calories}
                - Dietary restrictions: {dietary_restrictions if dietary_restrictions else 'None'}
                - Allergies: {allergies if allergies else 'None'}
                - User request: {prompt}
                
                Format each day clearly with Day 1, Day 2, etc., and include Breakfast, Lunch, Dinner, and Snacks."""}
            ]
            
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=messages,
                temperature=0.7,
                max_tokens=2000
            )
            
            return jsonify({"mealPlan": response.choices[0].message.content})
        except Exception as e:
            print(f"Error generating meal plan: {str(e)}")
            return jsonify({"error": str(e)}), 500
    
    # SSE streaming response
    def generate():
        try:
            messages = [
                {"role": "system", "content": "You are a professional nutritionist creating personalized meal plans."},
                {"role": "user", "content": f"""Create a 7-day meal plan with the following requirements:
                - Target calories per day: {calories}
                - Dietary restrictions: {dietary_restrictions if dietary_restrictions else 'None'}
                - Allergies: {allergies if allergies else 'None'}
                - User request: {prompt}
                
                Format each day clearly with Day 1, Day 2, etc., and include Breakfast, Lunch, Dinner, and Snacks."""}
            ]
            
            stream = openai.ChatCompletion.create(
                model="gpt-4",
                messages=messages,
                temperature=0.7,
                max_tokens=2000,
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    data = {
                        "choices": [{
                            "delta": {
                                "content": chunk.choices[0].delta.content
                            }
                        }]
                    }
                    yield f"data: {json.dumps(data)}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"Error in meal plan stream: {str(e)}")
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )

@app.route("/workoutplan", methods=["POST", "OPTIONS"])
def workout_plan():
    if request.method == "OPTIONS":
        return "", 200
        
    data = request.get_json()
    goal = data.get("goal", "")
    fitness_level = data.get("fitnessLevel", "beginner")
    fitness_goals = data.get("fitnessGoals", "general fitness")
    prompt = data.get("prompt", "")
    
    # Check if client accepts SSE
    accept_header = request.headers.get('Accept', '')
    if 'text/event-stream' not in accept_header:
        # Return regular JSON response for non-SSE clients
        try:
            messages = [
                {"role": "system", "content": "You are a professional fitness trainer creating personalized workout plans."},
                {"role": "user", "content": f"""Create a 7-day workout plan with the following requirements:
                - Fitness level: {fitness_level}
                - Fitness goals: {fitness_goals}
                - User request: {prompt}
                
                Format each day clearly with Day 1, Day 2, etc., and include specific exercises with sets and reps."""}
            ]
            
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=messages,
                temperature=0.7,
                max_tokens=2000
            )
            
            return jsonify({"workoutPlan": response.choices[0].message.content})
        except Exception as e:
            print(f"Error generating workout plan: {str(e)}")
            return jsonify({"error": str(e)}), 500
    
    # SSE streaming response
    def generate():
        try:
            messages = [
                {"role": "system", "content": "You are a professional fitness trainer creating personalized workout plans."},
                {"role": "user", "content": f"""Create a 7-day workout plan with the following requirements:
                - Fitness level: {fitness_level}
                - Fitness goals: {fitness_goals}
                - User request: {prompt}
                
                Format each day clearly with Day 1, Day 2, etc., and include specific exercises with sets and reps."""}
            ]
            
            stream = openai.ChatCompletion.create(
                model="gpt-4",
                messages=messages,
                temperature=0.7,
                max_tokens=2000,
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    data = {
                        "choices": [{
                            "delta": {
                                "content": chunk.choices[0].delta.content
                            }
                        }]
                    }
                    yield f"data: {json.dumps(data)}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"Error in workout plan stream: {str(e)}")
            error_data = {"error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )

@app.route("/user", methods=["POST"])
def user_details():
    data = request.get_json()

    # Extract user details
    age = data.get("age")
    weight = data.get("weight")
    height = data.get("height")
    gender = data.get("gender")
    activity_level = data.get("activityLevel", "moderate")
    goal = data.get("goal", "")
    prompt = data.get("prompt", "")
    target_weight = data.get("targetWeight", weight)
    timeline = data.get("timeline", 12)  # weeks

    # Validation
    if not all([age, weight, height]):
        return jsonify({"error": "Age, weight, and height are required"}), 400

    try:
        age = int(age)
        weight = float(weight)
        height = float(height)
        target_weight = float(target_weight) if target_weight else weight
        timeline = int(timeline)
    except ValueError:
        return jsonify({"error": "Invalid numeric values"}), 400

    # Calculate BMI
    bmi = calculate_bmi(weight, height)
    
    # Calculate TDEE
    tdee = calculate_tdee(age, weight, height, gender, activity_level)
    
    # Determine goal category
    weight_change = target_weight - weight
    
    if goal:
        goal_category = classify_goal_from_text(goal)
    else:
        if weight_change < -2:
            goal_category = 'weight_loss'
        elif weight_change > 2:
            goal_category = 'muscle_gain'
        else:
            goal_category = 'maintenance'

    # Daily calories offset
    daily_offset = goal_config[goal_category]["daily_offset"]
    
    # Calculate target calories
    target_calories = tdee + daily_offset
    
    # Ensure minimum safe calories
    if goal_category == 'weight_loss':
        # Minimum safe calories (1200 for women, 1500 for men)
        min_calories = 1200 if gender == 'female' else 1500
        target_calories = max(target_calories, min_calories)

    return jsonify({
        "bmi": round(bmi, 1),
        "tdee": round(tdee),
        "targetCalories": round(target_calories),
        "goalCategory": goal_category,
        "weightChange": round(weight_change, 1),
        "timeline": timeline
    })

REQUIRED_FIELDS = [
    "age",
    "weight",
    "height",
    "gender",
    "activityLevel",
    "targetWeight",
    "timelineWeeks"
]

if __name__ == '__main__':
    print(f"Starting server with upload folder: {UPLOAD_FOLDER}")
    print("Available endpoints:")
    print("- GET  /                 : Server status")
    print("- POST /chat             : Fitness chatbot")
    print("- POST /check-cache      : Check cache status")
    print("- POST /process-pdf      : PDF meal plan processor")
    app.run(host='127.0.0.1', port=5002, debug=True)