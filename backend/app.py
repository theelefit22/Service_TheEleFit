from fastapi import FastAPI, Request, Response, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import traceback
from flask_cors import CORS
from groq import AsyncGroq
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
from torch import chunk
from werkzeug.utils import secure_filename
from collections import defaultdict
from datetime import datetime
from utils import calculate_tdee, goal_config, classify_goal_from_text, process_single_day, calculate_macros
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor      
from logger_setup import mealplan_logger, workoutplan_logger,user_logger, error_logger
#from utils2 import chat_mimic
import random

# ============================================================
# UVLOOP SETUP (Linux/macOS only - provides ~10-30% async perf boost)
# ============================================================
try:
    import uvloop
    uvloop.install()
    print("[STARTUP] uvloop installed successfully - using high-performance event loop")
except ImportError:
    print("[STARTUP] uvloop not available (Windows?) - using default asyncio event loop")
except Exception as e:
    print(f"[STARTUP] uvloop setup failed: {e} - using default asyncio event loop")

# Initialize FastAPI app
app = FastAPI()

executor = ThreadPoolExecutor(max_workers=4)

# ============================================================
# PRE-GENERATION CACHE - Start generation from /user endpoint
# ============================================================
# Stores pre-generated meal plan data keyed by session_id
# Each entry contains: {'task': asyncio.Task, 'chunks': [], 'done': bool, 'error': str|None}
mealplan_cache = {}
CACHE_TTL_SECONDS = 300  # Clear old entries after 5 minutes

def cleanup_old_cache():
    """Remove cache entries older than TTL"""
    current_time = time.time()
    expired = [k for k, v in mealplan_cache.items() if current_time - v.get('created', 0) > CACHE_TTL_SECONDS]
    for k in expired:
        if k in mealplan_cache:
            task = mealplan_cache[k].get('task')
            if task and not task.done():
                task.cancel()
            del mealplan_cache[k]
    if expired:
        mealplan_logger.info(f"[CACHE_CLEANUP] Removed {len(expired)} expired entries")

allowed_origins = [
    "https://theelefit.com",
    "https://*.shopify.com",
    "https://*.shopifypreview.com",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://service.theelefit.com",
    "https://yantraprise.com",
    "https://*.netlify.app",
    "https://cheery-empanada-81a465.netlify.app"
]



app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Load environment variables from .env file
load_dotenv()

# Initialize Groq client
groq_api_key = os.getenv("GROQ_API_KEY")  # Get from https://console.groq.com
if not groq_api_key:
    raise RuntimeError("GROQ_API_KEY environment variable is not set.")
client = AsyncGroq(api_key=groq_api_key)
# Current directory
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Upload and response folders
UPLOAD_FOLDER = os.path.join(CURRENT_DIR, 'Uploads')  # Matches your setup
RESPONSE_FOLDER = os.path.join(CURRENT_DIR, 'responses')
ALLOWED_EXTENSIONS = {'pdf'}

# Max upload size (16MB)
MAX_CONTENT_LENGTH = 16 * 1024 * 1024

# Ensure directories exist
for folder in [UPLOAD_FOLDER, RESPONSE_FOLDER]:
    os.makedirs(folder, exist_ok=True)
    print(f"Ensured directory exists: {folder}")

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

async def call_groq_grocery_parser(prompt):
    """Call Groq API to parse grocery list"""
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a precise grocery list parser focused on accurate quantity extraction and aggregation."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1  # Lower temperature for more consistent results
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error calling Groq: {str(e)}")
        print(traceback.format_exc())
        raise Exception(f"Failed to process with Groq: {str(e)}")

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


class ChatRequest(BaseModel):
    message: str

@app.get("/", response_class=HTMLResponse)
async def index():
    return "<h2>Fitness Chatbot Backend is Running</h2>"


@app.post("/chat")
async def chat(req: ChatRequest):
    """Handle fitness chatbot requests (fully async)"""
    try:
        user_message = req.message.strip()

        if not user_message:
            raise HTTPException(status_code=400, detail="Message is required")

        # Moderation check (if synchronous, wrap later in executor)
        guard_resp = prompt_guard(user_message, "prompt")
        if guard_resp["status"] != "ok":
            raise HTTPException(
                status_code=400,
                detail=f"Prompt failed moderation: {guard_resp.get('reason', '')}",
            )

        # Async Groq call
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful fitness and nutrition assistant. Provide accurate, helpful advice about fitness, nutrition, and health.",
                },
                {"role": "user", "content": user_message},
            ],
        )

        ai_response = response.choices[0].message.content

        return {"response": ai_response, "success": True}

    except HTTPException:
        raise

    except Exception:
        print("Error in /chat:", traceback.format_exc())
        return JSONResponse(
            content={"error": "Internal server error", "success": False},
            status_code=500,
        )

class CheckCacheRequest(BaseModel):
    request_id: str

# ---------- Endpoint ----------
@app.post("/check-cache")
async def check_cache(req: CheckCacheRequest):
    """Check cache status for requests"""
    try:
        request_id = req.request_id.strip()
        if not request_id:
            raise HTTPException(status_code=400, detail="Request ID is required")

        # In real implementation, check Redis / DB cache here
        return {"cached": False, "request_id": request_id}

    except HTTPException:
        raise

    except Exception:
        print("Error in /check-cache:", traceback.format_exc())
        return JSONResponse(
            content={"error": "Internal server error"},
            status_code=500
        )

@app.post("/process-pdf")
async def process_pdf(files: list[UploadFile] = File(...)):
    """Process uploaded PDF files and extract grocery list"""
    try:
        print("=== Starting PDF processing ===")

        if not files:
            save_response_log("no_files", "", None, error="No files uploaded")
            raise HTTPException(status_code=400, detail="No files uploaded")

        all_grocery_data = {"items": []}

        for file in files:
            if file.filename == '':
                continue

            if not allowed_file(file.filename):
                save_response_log(file.filename, "", None, error=f'Invalid file type for {file.filename}')
                raise HTTPException(status_code=400, detail=f'Invalid file type for {file.filename}')

            try:
                filename = secure_filename(file.filename)
                filepath = os.path.join(UPLOAD_FOLDER, filename)

                print(f"Saving file to: {filepath}")
                with open(filepath, "wb") as f:
                    f.write(file.file.read())

                if not os.path.exists(filepath):
                    save_response_log(filename, "", None, error=f'Failed to save file at {filepath}')
                    raise HTTPException(status_code=500, detail=f'Failed to save file at {filepath}')

                print(f"Processing file: {filepath}")
                raw_text = extract_text_from_pdf(filepath)
                print("Text extracted successfully, length:", len(raw_text))

                if not raw_text:
                    error_msg = f'No text could be extracted from {file.filename}'
                    save_response_log(filename, "", None, error=error_msg)
                    raise HTTPException(status_code=400, detail=error_msg)

                prompt = generate_prompt(raw_text)
                print("Prompt generated, length:", len(prompt))

                response_text = await call_groq_grocery_parser(prompt)
                print("Groq response received, length:", len(response_text))

                file_grocery_data = extract_json(response_text)
                print(f"JSON extracted successfully for {file.filename}")

                save_response_log(filename, raw_text, file_grocery_data, ai_response=response_text)

                # Merge items
                if file_grocery_data and "items" in file_grocery_data:
                    for new_item in file_grocery_data["items"]:
                        found = False
                        for existing_item in all_grocery_data["items"]:
                            if (existing_item["item"] == new_item["item"] and
                                existing_item["category"] == new_item["category"] and
                                existing_item["meal_time"] == new_item["meal_time"]):
                                existing_item["total_quantity"] += new_item["total_quantity"]
                                found = True
                                break
                        if not found:
                            all_grocery_data["items"].append(new_item)

                # Cleanup
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
                raise HTTPException(status_code=500, detail=error_msg)

        if all_grocery_data["items"]:
            print("Returning combined grocery data")
            return JSONResponse(content=all_grocery_data)
        else:
            error_msg = 'No grocery data could be extracted from any file'
            save_response_log("multiple_files", "", None, error=error_msg)
            print(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

    except Exception as e:
        error_msg = f'Server error: {str(e)}'
        save_response_log("server_error", "", None, error=error_msg)
        print(error_msg)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)

REQUIRED_FIELDS = ["age", "weight", "height", "gender", "activityLevel"]

@app.post("/user")
async def user_endpoint(request: Request):
    try:
        data = await request.json() if hasattr(request, "json") else request.body()
        if isinstance(data, bytes):
            data = json.loads(data)
        user_logger.info("=== /user endpoint called ===")
        user_logger.info("Received data: %s", json.dumps(data, indent=2))

        # Handle both old and new format
        if "userDetails" in data:
            prompt = data.get("prompt", "")
            data = data.get("userDetails", {})

            if not prompt:
                raise HTTPException(status_code=400, detail="Prompt is required")
            if not data:
                raise HTTPException(status_code=400, detail="User details are required")

            missing_fields = [f for f in REQUIRED_FIELDS if f not in data or data[f] in (None, "", [])]
            if missing_fields:
                raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(missing_fields)}")

            age = int(data["age"])
            weight = float(data["weight"])
            height = float(data["height"])
            gender = str(data["gender"])
            activity_level = str(data["activityLevel"])
            goal = str(data.get("healthGoals", "")).strip()
            target_weight = float(data.get("targetWeight"))
            timeline_weeks = int(data.get("timelineWeeks"))

        # TDEE calculation
        tdee = calculate_tdee(weight, height, age, gender, activity_level)

        # Goal classification
        if goal:
            goal_category = classify_goal_from_text(goal)
            user_logger.info("Goal classification for '%s': %s", goal, goal_category)
        else:
            goal_category = classify_goal_from_text(prompt)
            user_logger.info("Goal classification for prompt '%s': %s", prompt, goal_category)

        # Daily calories offset
        weight_change = target_weight - weight
        total_calorie_change = weight_change * 7700
        daily_offset = total_calorie_change / (timeline_weeks * 7)
        daily_offset = max(min(daily_offset, 1000), -1000)
        capped = True if abs(daily_offset) == 1000 else False
        target_calories = max(round(tdee + daily_offset), 1000)
        macros = calculate_macros(weight, target_calories)
        workout_focus = goal_config[goal_category]['workout_focus']

        user_logger.info("=== CALCULATION RESULTS ===")
        user_logger.info("Current weight: %d kg", weight)
        user_logger.info("Target weight: %d kg", target_weight)
        user_logger.info("TDEE: %d", tdee)
        user_logger.info("Weight change: %d kg", weight_change)
        user_logger.info("Daily offset: %d", daily_offset)
        user_logger.info("Target calories: %d", target_calories)
        user_logger.info("Goal category: %s", goal_category)
        user_logger.info("Workout focus: %s", workout_focus)
        user_logger.info("Macros: %s", json.dumps(macros))
        user_logger.info("Capped: %s", str(capped))

        # Generate session ID for pre-generation
        session_id = f"{uuid.uuid4().hex[:12]}-{int(time.time())}"
        
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
            "WorkoutFocus": workout_focus,
            "macros": macros,
            "capped": capped
            # sessionId is passed via cookie - no frontend changes needed
        }
        
        # ============================================================
        # START PRE-GENERATION IN BACKGROUND
        # ============================================================
        # Prepare data for meal plan generation (same as /mealplan would receive)
        generation_data = {
            "targetCalories": target_calories,
            "dietaryRestrictions": [],  # Will be extracted from prompt
            "allergies": [],
            "healthGoals": goal,
            "prompt": prompt,
            "targetWeight": target_weight,
            "timelineWeeks": timeline_weeks,
            "weight": weight,
            "capped": capped
        }
        
        # Clean up old cache entries
        cleanup_old_cache()
        
        # Initialize cache entry
        mealplan_cache[session_id] = {
            'chunks': [],
            'done': False,
            'error': None,
            'created': time.time(),
            'task': None
        }
        
        # Start background generation task
        async def run_pregeneration():
            try:
                user_logger.info(f"[PREGEN] Starting pre-generation for session {session_id}")
                async for chunk in generate_mealplan_stream(generation_data):
                    if session_id in mealplan_cache:
                        mealplan_cache[session_id]['chunks'].append(chunk)
                if session_id in mealplan_cache:
                    mealplan_cache[session_id]['done'] = True
                    user_logger.info(f"[PREGEN] Completed for session {session_id}, {len(mealplan_cache[session_id]['chunks'])} chunks")
            except Exception as e:
                if session_id in mealplan_cache:
                    mealplan_cache[session_id]['error'] = str(e)
                    mealplan_cache[session_id]['done'] = True
                user_logger.error(f"[PREGEN] Error for session {session_id}: {e}")
        
        # Schedule the background task
        task = asyncio.create_task(run_pregeneration())
        mealplan_cache[session_id]['task'] = task
        user_logger.info(f"[PREGEN] Scheduled background generation for session {session_id}")

        # Set cookies - user_profile + session_id for pre-generation
        resp = JSONResponse(content=profile)
        resp.set_cookie(key="user_profile", value=json.dumps(profile), httponly=True, samesite="lax")
        resp.set_cookie(key="mealplan_session", value=session_id, httponly=True, samesite="lax", max_age=300)
        return resp

    except HTTPException as he:
        raise he
    except Exception as e:
        user_logger.error("Error in /user endpoint: %s", str(e))
        user_logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

def prompt_guard(user_input: str, guard_type="prompt"):
    try:
        # Safety moderation first
        mod_resp = client.moderations.create(
            model="omni-moderation-latest",
            input=user_input
        )
        if mod_resp.results[0].flagged:
            return {"status": "blocked", "reason": f"{guard_type} failed moderation"}

        text = user_input.lower()

        in_topic_keywords = [
            "calorie", "diet", "meal", "nutrition", "food", "protein",
            "carb", "fat", "vegetable", "fruit", "weight", "exercise",
            "health", "fitness", "breakfast", "lunch", "snack", "dinner"
        ]
        
        unrelated_keywords = [
            "movie", "film", "celebrity", "music", "concert", "festival",
            "politics", "election", "game", "gaming", "crypto", "stock",
            "porn", "gambling"
        ]

        # If obviously unrelated → block
        if any(word in text for word in unrelated_keywords):
            return {"status": "blocked", "reason": f"{guard_type} off-topic"}

        # If at least one in-topic word → ok
        if any(word in text for word in in_topic_keywords):
            return {"status": "ok"}

        # Otherwise: let it through (loose guard, not too strict)
        return {"status": "ok"}

    except Exception as e:
        return {"status": "error", "reason": str(e)}




def extract_dietary_from_prompt(user_prompt: str) -> dict:
    """
    Extract dietary restrictions and allergies mentioned in the user's text prompt.
    Returns dict with 'dietary' and 'allergies' lists.
    """
    prompt_lower = user_prompt.lower()
    
    extracted_dietary = []
    extracted_allergies = []
    
    # Vegetarian/Vegan detection
    if any(term in prompt_lower for term in ['vegan', 'plant based', 'plant-based']):
        extracted_dietary.append('vegan')
    elif any(term in prompt_lower for term in ['vegetarian', 'veg ', 'veg,', 'veg.', ' veg', 'no meat', 'no non-veg', 'no non veg', 'no nonveg']):
        extracted_dietary.append('vegetarian')
    
    # Specific restrictions
    if any(term in prompt_lower for term in ['no dairy', 'dairy free', 'dairy-free', 'lactose intolerant', 'no milk', 'no cheese', 'no paneer']):
        extracted_dietary.append('no dairy')
    if any(term in prompt_lower for term in ['gluten free', 'gluten-free', 'no gluten', 'celiac']):
        extracted_dietary.append('gluten-free')
    if any(term in prompt_lower for term in ['no egg', 'egg free', 'egg-free', 'no eggs']):
        extracted_dietary.append('no eggs')
    if any(term in prompt_lower for term in ['no fish', 'no seafood', 'no shellfish']):
        extracted_dietary.append('no seafood')
    if any(term in prompt_lower for term in ['no pork', 'no beef', 'no red meat']):
        extracted_dietary.append('no red meat')
    if any(term in prompt_lower for term in ['halal']):
        extracted_dietary.append('halal')
    if any(term in prompt_lower for term in ['kosher']):
        extracted_dietary.append('kosher')
    if any(term in prompt_lower for term in ['keto', 'ketogenic', 'low carb', 'low-carb']):
        extracted_dietary.append('keto/low-carb')
    
    # Allergy detection
    if any(term in prompt_lower for term in ['nut allergy', 'allergic to nuts', 'no nuts', 'nut-free']):
        extracted_allergies.append('nuts')
    if any(term in prompt_lower for term in ['peanut allergy', 'allergic to peanut']):
        extracted_allergies.append('peanuts')
    if any(term in prompt_lower for term in ['soy allergy', 'allergic to soy', 'no soy']):
        extracted_allergies.append('soy')
    
    return {'dietary': extracted_dietary, 'allergies': extracted_allergies}


async def extract_user_preferences_llm(client, user_prompt: str, dietary_restrictions: list = None, macros: dict = None) -> dict:
    """
    CURATOR AGENT: Analyzes user request + macro requirements to generate HIGH-PROTEIN meal examples.
    This is the brain that figures out HOW to meet protein targets with the user's cuisine.
    The generator will use these examples to build the full 7-day plan.
    """
    if not user_prompt or len(user_prompt.strip()) < 10:
        return {"directions": "", "raw": {}}
    
    dietary_context = ""
    if dietary_restrictions:
        dietary_context = f"\nDietary restrictions: {', '.join(dietary_restrictions)}"
    
    # Calculate per-meal protein targets
    protein_target = macros.get('protein_g', 120) if macros else 120
    calories_target = macros.get('calories', 1800) if macros else 1800
    
    # Meal distribution for protein
    breakfast_protein = int(protein_target * 0.20)  # 20% at breakfast
    lunch_protein = int(protein_target * 0.35)      # 35% at lunch
    snack_protein = int(protein_target * 0.10)      # 10% at snack
    dinner_protein = int(protein_target * 0.35)     # 35% at dinner
    
    extraction_prompt = f"""You are a NUTRITION CURATOR. Analyze the user's request and generate cuisine-appropriate, high-protein meal guidance.

USER REQUEST: "{user_prompt}"{dietary_context}

MACRO REQUIREMENTS:
- Daily Protein: {protein_target}g | Daily Calories: {calories_target} kcal
- Per-meal protein: Breakfast ~{breakfast_protein}g, Lunch ~{lunch_protein}g, Snack ~{snack_protein}g, Dinner ~{dinner_protein}g

STEP 1 - DETECT CUISINE:
- If user mentions a specific cuisine (Indian, Mexican, Italian, Asian, etc.) → use that
- If user mentions NO cuisine → default to WESTERN cuisine
- "Vegetarian" alone does NOT mean Indian - it means Western vegetarian unless Indian is specified

STEP 2 - DETECT DIETARY TYPE (ONLY what user said):
- Vegetarian → no meat, no fish, NO EGGS
- Vegan → no animal products
- Nothing specified → NON-VEG (all foods allowed)
- DO NOT ADD EXTRA RESTRICTIONS (no gluten-free, no dairy-free unless user asked)

STEP 3 - GENERATE GUIDANCE:
Based on the detected cuisine and dietary type, output:

1. CUISINE: [Detected or "Western (default)"]

2. DIETARY TYPE: [Non-veg/Vegetarian/Vegan] - ONLY what user specified

3. ALLOWED HIGH-PROTEIN FOODS:
   [List 6-8 protein-rich foods appropriate for THIS cuisine and dietary type]
   [Include protein content per 100g for each]

5. BREAKFAST IDEAS (~{breakfast_protein}g protein each):
   [List 4-5 breakfast-appropriate meals for THIS cuisine that hit the protein target]
   [Must be actual breakfast foods - not lunch/dinner dishes]

6. LUNCH/DINNER IDEAS (~{lunch_protein}g protein each):
   [List 5-6 complete meals: protein + ONE carb + vegetables]
   [Must hit the protein target using high-protein foods]

7. SNACK IDEAS (~{snack_protein}g protein each):
   [List 3-4 light, protein-rich snacks appropriate for THIS cuisine]

8. ALLOWED CARBS (ONE per meal):
   [List carb options appropriate for THIS cuisine]

9. FREQUENCY RULES:
   [If user mentioned any frequency preferences, note them here]

CRITICAL RULES:
- Generate foods appropriate for the DETECTED cuisine only
- Every meal example must hit the protein target
- Do NOT default to any specific cuisine - detect from user's words
- Western = default if no cuisine mentioned
- ONLY ENFORCE RESTRICTIONS USER EXPLICITLY MENTIONED
- If user said "vegetarian" ONLY → no meat/fish/eggs, BUT dairy is ALLOWED
- If user said "vegan" ONLY → no animal products
- DO NOT assume gluten-free, dairy-free, or any other restriction unless user said it
- "Vegetarian" does NOT mean "gluten-free" or "dairy-free"

Start with "CUISINE & NUTRITION GUIDE:" """

    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "user", "content": extraction_prompt}
            ],
            max_tokens=1200,  # More space for detailed protein-focused examples
            temperature=0.4,  # Slightly higher for creative meal combinations
        )
        
        instructions = response.choices[0].message.content.strip()
        mealplan_logger.info(f"[AI_EXTRACTION] Generated instructions: {len(instructions)} chars")
        
        # Return the LLM-generated instructions directly
        return {"directions": "\n\n" + instructions + "\n", "raw": {}}
        
    except Exception as e:
        mealplan_logger.warning(f"[AI_EXTRACTION] Failed: {e}")
        return {"directions": "", "raw": {}}


# ============================================================
# DIETARY RULES GENERATOR - Dynamic restriction enforcement
# ============================================================
async def generate_dietary_rules_llm(client, dietary_restrictions: list = None, allergies: list = None) -> str:
    """
    Use LLM to generate specific dietary enforcement rules based on user's restrictions.
    Returns plain text rules that get injected into the main meal plan prompt.
    """
    if not dietary_restrictions and not allergies:
        return ""
    
    dietary_str = ", ".join(dietary_restrictions) if dietary_restrictions else "None"
    allergies_str = ", ".join(allergies) if allergies else "None"
    
    rules_prompt = f"""Generate STRICT dietary enforcement rules for a meal planner based on these restrictions:

DIETARY RESTRICTIONS: {dietary_str}
ALLERGIES: {allergies_str}

YOUR TASK: Output rules ONLY for the restrictions listed above. Nothing more.

CRITICAL: ONLY GENERATE RULES FOR WHAT USER ASKED
- If user said "vegetarian" ONLY → output vegetarian rules ONLY (dairy IS allowed)
- If user said "vegan" ONLY → output vegan rules ONLY
- DO NOT add gluten-free, dairy-free, or any other restrictions unless user specified
- "Vegetarian" does NOT imply "gluten-free" or "dairy-free"

FORMAT YOUR OUTPUT EXACTLY LIKE THIS:

=== DIETARY RESTRICTIONS - STRICTLY ENFORCED ===

[For EACH restriction the user ACTUALLY specified:]
[RESTRICTION NAME]:
- NEVER include: [list banned foods for THIS restriction only]
- USE instead: [list safe alternatives]

RULES:
- VEGETARIAN means NO EGGS, but dairy (milk, cheese, yogurt, paneer) IS ALLOWED
- List specific food items, not categories
- For allergies, include hidden sources (e.g., "soy" includes tofu, tempeh, soy sauce, edamame)

Examples of what to output:

For "vegetarian":
VEGETARIAN:
- NEVER include: chicken, fish, meat, eggs, egg whites, omelette, scrambled eggs, beef, pork, shrimp, tuna, salmon
- USE instead: paneer, tofu, lentils, chickpeas, kidney beans, cottage cheese, Greek yogurt

For "gluten-free":
GLUTEN-FREE:
- NEVER include: wheat, roti, chapati, naan, paratha, bread, pasta, seitan, semolina, rava, couscous, bulgur, barley
- USE instead: rice, quinoa, millet, potatoes, sweet potato, gluten-free oats, corn tortilla

For "nut allergy":
NUT ALLERGY:
- NEVER include: almonds, cashews, walnuts, peanuts, pistachios, almond butter, peanut butter, almond milk
- USE instead: seeds (sunflower, pumpkin), oat milk, coconut milk

Now generate rules for ONLY: {dietary_str}, {allergies_str}

IMPORTANT: 
- If dietary restrictions is "vegetarian" → output ONLY vegetarian rules (no gluten-free, no dairy-free)
- If dietary restrictions is "None" → output nothing
- DO NOT invent additional restrictions

Output ONLY the rules section - no explanations:"""

    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "user", "content": rules_prompt}
            ],
            max_tokens=500,
            temperature=0.2,
        )
        
        rules = response.choices[0].message.content.strip()
        mealplan_logger.info(f"[DIETARY_RULES] Generated rules: {len(rules)} chars")
        
        return "\n\n" + rules + "\n"
        
    except Exception as e:
        mealplan_logger.warning(f"[DIETARY_RULES] Failed: {e}")
        return ""


# ============================================================
# VARIETY HELPER - Prevents duplicate meals on regeneration
# ============================================================
def get_variety_instructions(dietary=None, attempt_number=1):
    """
    Generate variety instructions for regenerated meals.
    No hardcoded food items - uses general category guidance only.
    """
    variety_seed = int(time.time() * 1000) + random.randint(1, 100000)
    
    # Parse dietary restrictions
    dietary_lower = [d.lower() if isinstance(d, str) else d for d in (dietary or [])]
    is_veg = any(d in ['vegetarian', 'vegan'] for d in dietary_lower)
    is_vegan = 'vegan' in dietary_lower
    no_dairy = any('dairy' in d for d in dietary_lower)
    gluten_free = any('gluten' in d for d in dietary_lower)
    
    # Build diet-specific guidance (general categories only)
    diet_guidance = []
    
    if is_vegan:
        diet_guidance.append("VEGAN: Use only plant-based proteins, no animal products")
    elif is_veg:
        diet_guidance.append("VEGETARIAN: No meat or fish")
    
    if no_dairy:
        diet_guidance.append("NO DAIRY: Avoid all milk products")
    
    if gluten_free:
        diet_guidance.append("GLUTEN-FREE: Avoid wheat and gluten-containing grains")
    
    diet_text = "\n".join(f"  • {g}" for g in diet_guidance) if diet_guidance else "  • Follow user's dietary preferences"
    
    variety_instruction = f"""
(Attempt #{attempt_number}, Seed: {variety_seed})
- Generate a different meal from previous attempts
- Don't repeat exact same dish as yesterday

DIETARY:
{diet_text}
"""
    
    return variety_instruction


async def fix_quantities_with_llm(client, model, original_day_text, day_number, target_calories, target_macros):
    """
    Lightweight LLM call to fix quantities while keeping densities sensible.
    Called only when post-processing can't fix macros without making densities unrealistic.
    Keeps same food items - only adjusts portion sizes realistically.
    
    CRITICAL: Validates output to prevent meal duplication bug.
    """
    mealplan_logger.info(f"[FIX_QUANTITIES] Adjusting quantities for Day {day_number}")
    
    # Count original meals for validation
    original_meal_count = len(re.findall(r'- (Breakfast|Lunch|Snack|Dinner)', original_day_text, re.IGNORECASE))
    mealplan_logger.info(f"[FIX_QUANTITIES] Original meal count: {original_meal_count}")
    
    # CRITICAL: Strip any existing "Day X:" header to prevent duplication
    # This prevents the LLM from seeing "Day 2:\nDay 2:\n- Breakfast..." which confuses it
    cleaned_day_text = re.sub(r'^Day\s*\d+\s*:\s*\n?', '', original_day_text.strip(), flags=re.IGNORECASE)
    
    # Extract just the 4 meals from original to prevent any confusion
    system_msg = """You adjust meal quantities. Output EXACTLY 4 meals for ONE day only. 
NEVER output more than 4 meals. NEVER repeat Breakfast/Lunch/Snack/Dinner.
If you output more than 4 meals, the system will crash."""

    correction_prompt = f"""Adjust gram amounts to hit targets. Keep SAME foods.

Day {day_number}:
{cleaned_day_text}

TARGETS: {target_calories} kcal, {target_macros['protein_g']}g protein

OUTPUT EXACTLY THIS STRUCTURE (4 meals only):
Day {day_number}:
- Breakfast (XXX kcal):
  1. Food - Xg - XXX kcal
  2. Food - Xg - XXX kcal
- Lunch (XXX kcal):
  1. Food - Xg - XXX kcal
  2. Food - Xg - XXX kcal
- Snack (XXX kcal):
  1. Food - Xg - XXX kcal
- Dinner (XXX kcal):
  1. Food - Xg - XXX kcal
  2. Food - Xg - XXX kcal

STOP after Dinner. Do not continue."""

    try:
        mealplan_logger.info(f"[FIX_QUANTITIES] ===== QUANTITY FIX FOR DAY {day_number} =====")
        mealplan_logger.info(f"[FIX_QUANTITIES] Target: {target_calories} kcal, {target_macros['protein_g']}g protein")
        mealplan_logger.info(f"[FIX_QUANTITIES] Cleaned text starts with: {cleaned_day_text[:100]}...")
        
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": correction_prompt}
            ],
            max_tokens=400,  # Very short - just 4 meals, prevents rambling
            temperature=0.1,  # Very low for deterministic output
            stop=["Day " + str(int(day_number) + 1), "END", "\n\nDay"],  # Stop if it tries to continue
        )
        
        corrected_text = response.choices[0].message.content
        
        # VALIDATION: Check for meal duplication before processing
        meal_matches = re.findall(r'- (Breakfast|Lunch|Snack|Dinner)', corrected_text, re.IGNORECASE)
        meal_count = len(meal_matches)
        
        mealplan_logger.info(f"[FIX_QUANTITIES] LLM output meal count: {meal_count}, meals: {meal_matches}")
        
        # If more than 4 meals, LLM duplicated - reject and return None
        if meal_count > 4:
            mealplan_logger.warning(f"[FIX_QUANTITIES] REJECTED - LLM duplicated meals ({meal_count} meals found, expected 4). Falling back to original.")
            return None
        
        # If 0 meals found, something went wrong
        if meal_count == 0:
            mealplan_logger.warning(f"[FIX_QUANTITIES] REJECTED - No meals found in LLM output")
            return None
        
        if corrected_text and f"Day {day_number}" in corrected_text:
            # Extract just the day content
            day_start_regex = re.compile(r'Day \d+:')
            day_starts = [m for m in day_start_regex.finditer(corrected_text)]
            
            target_day_start = None
            target_day_end = None
            
            for i, match in enumerate(day_starts):
                if f"Day {day_number}" in match.group(0) or match.group(0) == f"Day {day_number}:":
                    target_day_start = match.start()
                    target_day_end = day_starts[i + 1].start() if i + 1 < len(day_starts) else len(corrected_text)
                    break
            
            if target_day_start is not None:
                isolated_day_text = corrected_text[target_day_start:target_day_end]
                
                # Double-check isolated text doesn't have duplicates
                isolated_meal_count = len(re.findall(r'- (Breakfast|Lunch|Snack|Dinner)', isolated_day_text, re.IGNORECASE))
                if isolated_meal_count > 4:
                    mealplan_logger.warning(f"[FIX_QUANTITIES] REJECTED - Isolated day still has {isolated_meal_count} meals")
                    return None
                
                mealplan_logger.info(f"[FIX_QUANTITIES] Fixed Day {day_number}: {len(isolated_day_text)} chars, {isolated_meal_count} meals")
                
                # Process the corrected day
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    process_single_day,
                    isolated_day_text,
                    target_calories,
                    target_macros,
                    5,
                    day_number
                )
                
                if isinstance(result, tuple):
                    processed, _ = result
                else:
                    processed = result
                
                return processed
            else:
                # Use full response if no day marker found
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    process_single_day,
                    corrected_text,
                    target_calories,
                    target_macros,
                    5,
                    day_number
                )
                if isinstance(result, tuple):
                    processed, _ = result
                else:
                    processed = result
                return processed
        
        mealplan_logger.warning(f"[FIX_QUANTITIES] Failed for Day {day_number} - no valid content")
        return None
        
    except Exception as e:
        mealplan_logger.error(f"[FIX_QUANTITIES] Error for Day {day_number}: {str(e)}")
        return None


# ============================================================
# MEALPLAN STREAM GENERATOR - Used by both /user (pre-gen) and /mealplan
# ============================================================
async def generate_mealplan_stream(data: dict):
    """
    Core meal plan generation logic as an async generator.
    Yields encoded chunks that can be streamed or cached.
    """
    full_t_start = time.perf_counter()
    
    calories = data.get("targetCalories")
    dietary_explicit = data.get("dietaryRestrictions", [])
    allergies_explicit = data.get("allergies", [])
    goals = data.get("healthGoals", "")
    user_prompt = data.get("prompt", "")
    target_weight = int(data.get("targetWeight", 70))
    timeline_weeks = int(data.get("timelineWeeks", 12))
    weight_kg = float(data.get("weight")) if data.get("weight") else 70.0
    macros = calculate_macros(weight_kg, calories) if calories else {"protein_g": 135, "fat_g": 60, "carbs_g": 10, "fiber_g": 25}
    capped = data.get("capped") if data.get("capped") is not None else True
    
    # Extract dietary from prompt
    extracted = extract_dietary_from_prompt(user_prompt)
    dietary = list(set((dietary_explicit or []) + extracted['dietary']))
    allergies = list(set((allergies_explicit or []) + extracted['allergies']))
    
    mealplan_logger.info(f"[PREGEN_STREAM] Starting generation: {calories} kcal, dietary={dietary}")
    
    unique_id = str(uuid.uuid4())[:8]
    timestamp = int(time.time())
    
    # Diet context
    diet_context = ""
    if dietary or allergies:
        diet_context = "ADDITIONAL_DIETARY_DATA:\n"
        if dietary:
            diet_context += f"- Dietary Restrictions: {', '.join(dietary)}\n"
        if allergies:
            diet_context += f"- Allergies (STRICTLY AVOID): {', '.join(allergies)}\n"
    
    # Get curator instructions
    macros_with_calories = {**macros, 'calories': calories}
    user_preferences = await extract_user_preferences_llm(client, user_prompt, dietary, macros_with_calories)
    user_specific_directions = user_preferences.get("directions", "")
    
    # Get dietary rules
    dietary_rules = await generate_dietary_rules_llm(client, dietary, allergies)
    
    profile_dict = {
        "targetCalories": calories,
        "dietaryRestrictions": dietary or [],
        "allergies": allergies or [],
        "healthGoals": goals or "",
        "targetWeight": target_weight,
        "timelineWeeks": timeline_weeks,
        "macros": macros,
    }
    
    user_message = f"""
    USER_INPUT: {user_prompt}
    {diet_context}
    {user_specific_directions}
    USER_PROFILE: {json.dumps(profile_dict, indent=2)}
    NUTRITIONAL TARGETS:
    - Daily Protein: {macros['protein_g']}g, Fat: {macros['fat_g']}g, Carbs: {macros['carbs_g']}g
    Generate complete 7-day meal plan. Request-ID: {unique_id}-{timestamp}
    """
    
    # Simplified system prompt (full one is in the endpoint)
    system_prompt = f"""You are a meal plan generator. Output 7 days.
FORMAT: Day X: - Breakfast (XXX kcal): items... - Lunch: items... - Snack: items... - Dinner: items...
TARGETS: {calories} kcal/day, {macros['protein_g']}g protein, {macros['fat_g']}g fat, {macros['carbs_g']}g carbs
{dietary_rules}
END with: END-OF-PLAN-SUGGESTION: [tip]"""

    MODEL = "llama-3.3-70b-versatile"
    day_start_regex = re.compile(r'Day \d+:')
    
    try:
        stream = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_tokens=4096,
            temperature=0.9,
            stream=True,
        )
        
        buffer = ""
        day_count = 0
        
        async for chunk in stream:
            token_text = None
            try:
                if chunk.choices and chunk.choices[0].delta:
                    token_text = chunk.choices[0].delta.content
            except:
                token_text = None
            
            if not token_text:
                continue
            
            buffer += token_text
            
            # Check for complete days
            day_matches = list(day_start_regex.finditer(buffer))
            
            if len(day_matches) >= 2:
                for i in range(len(day_matches) - 1):
                    if day_count >= 7:
                        break
                    
                    start = day_matches[i].start()
                    end = day_matches[i + 1].start()
                    day_text = buffer[start:end].strip()
                    
                    # Process the day
                    loop = asyncio.get_event_loop()
                    result = await loop.run_in_executor(
                        executor, process_single_day, day_text, calories, macros, 5, day_count + 1
                    )
                    
                    if isinstance(result, tuple):
                        processed, anomaly_info = result
                    else:
                        processed = result
                    
                    processed += "\n"
                    yield processed.encode("utf-8")
                    
                    buffer = buffer[end:]
                    day_count += 1
        
        # Process remaining buffer
        if buffer.strip() and day_count < 7:
            remaining_days = list(day_start_regex.finditer(buffer))
            for i, match in enumerate(remaining_days):
                if day_count >= 7:
                    break
                start = match.start()
                end = remaining_days[i + 1].start() if i + 1 < len(remaining_days) else len(buffer)
                day_text = buffer[start:end].strip()
                
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    executor, process_single_day, day_text, calories, macros, 5, day_count + 1
                )
                
                if isinstance(result, tuple):
                    processed, _ = result
                else:
                    processed = result
                
                processed += "\n"
                yield processed.encode("utf-8")
                day_count += 1
        
        mealplan_logger.info(f"[PREGEN_STREAM] Completed {day_count} days")
        
    except Exception as e:
        error_msg = f"\n\nError: {str(e)}\n"
        yield error_msg.encode("utf-8")
        mealplan_logger.error(f"[PREGEN_STREAM] Error: {e}")


@app.post("/mealplan")
async def meal_plan(request: Request):
    data = await request.json()
    full_t_start = time.perf_counter()
    
    # ============================================================
    # CHECK FOR PRE-GENERATED DATA FROM /user ENDPOINT
    # ============================================================
    # Try to get sessionId from request body first, then from cookie (set by /user)
    session_id = data.get("sessionId") or request.cookies.get("mealplan_session")
    if session_id and session_id in mealplan_cache:
        cache_entry = mealplan_cache[session_id]
        mealplan_logger.info(f"[PREGEN_HIT] Found cached data for session {session_id}")
        
        async def stream_from_cache():
            """Stream pre-generated chunks, waiting for more if not done"""
            chunk_index = 0
            while True:
                # Get current state
                chunks = cache_entry.get('chunks', [])
                done = cache_entry.get('done', False)
                error = cache_entry.get('error')
                
                # Yield any new chunks
                while chunk_index < len(chunks):
                    yield chunks[chunk_index]
                    chunk_index += 1
                
                # Check if we're done
                if done:
                    if error:
                        mealplan_logger.error(f"[PREGEN_ERROR] {error}")
                    break
                
                # Wait a bit for more chunks
                await asyncio.sleep(0.05)
            
            # Cleanup cache entry after streaming
            if session_id in mealplan_cache:
                del mealplan_cache[session_id]
                mealplan_logger.info(f"[PREGEN_CLEANUP] Removed session {session_id} from cache")
        
        return StreamingResponse(stream_from_cache(), media_type="application/octet-stream")
    
    # No cached data - proceed with normal generation
    if session_id:
        mealplan_logger.info(f"[PREGEN_MISS] No cached data for session {session_id}, generating fresh")

    calories = data.get("targetCalories")
    dietary_explicit = data.get("dietaryRestrictions", [])
    allergies_explicit = data.get("allergies", [])
    goals = data.get("healthGoals", "")
    user_prompt = data.get("prompt", "")
    target_weight = int(data.get("targetWeight"))
    timeline_weeks = int(data.get("timelineWeeks"))
    weight_kg = float(data.get("weight")) if data.get("weight") else 70.0
    macros = calculate_macros(weight_kg, calories) if calories else {"protein_g": 135, "fat_g": 60, "carbs_g": 10, "fiber_g": 25}
    capped = data.get("capped") if data.get("capped") is not None else True
    
    # Extract dietary restrictions from user prompt text (in case they weren't passed explicitly)
    extracted = extract_dietary_from_prompt(user_prompt)
    
    # Merge extracted with explicit restrictions (avoid duplicates)
    dietary = list(set((dietary_explicit or []) + extracted['dietary']))
    allergies = list(set((allergies_explicit or []) + extracted['allergies']))
    
    mealplan_logger.info(f"[DIETARY_EXTRACTION] Explicit: {dietary_explicit}, Extracted from prompt: {extracted['dietary']}, Merged: {dietary}")

    unique_id = str(uuid.uuid4())[:8]
    timestamp = int(time.time())
    
    # Log the user prompt from frontend
    mealplan_logger.info(f"\n{'='*80}")
    mealplan_logger.info(f"[USER_PROMPT] Request ID: {unique_id}-{timestamp}")
    mealplan_logger.info(f"User Prompt from Frontend: {user_prompt}")
    mealplan_logger.info(f"Target Calories: {calories}")
    mealplan_logger.info(f"Dietary Restrictions: {dietary}")
    mealplan_logger.info(f"Allergies: {allergies}")
    mealplan_logger.info(f"Macros: Protein={macros['protein_g']}g, Fat={macros['fat_g']}g, Carbs={macros['carbs_g']}g")
    mealplan_logger.info(f"{'='*80}\n")

    profile_dict = {
        "targetCalories": calories,
        "dietaryRestrictions": dietary or [],
        "allergies": allergies or [],
        "healthGoals": goals or "",
        "targetWeight": target_weight or None,
        "timelineWeeks": timeline_weeks or None,
        "macros": macros,
        "target calories capped": capped
    }

    # Only add structured dietary data if exists
    diet_context = ""
    if dietary or allergies:
        diet_context = "ADDITIONAL_DIETARY_DATA:\n"
        if dietary:
            diet_context += f"- Dietary Restrictions: {', '.join(dietary) if isinstance(dietary, list) else dietary}\n"
        if allergies:
            diet_context += f"- Allergies (STRICTLY AVOID): {', '.join(allergies) if isinstance(allergies, list) else allergies}\n"
    
    # Extract user preferences using CURATOR AGENT with macro context
    preferences_start = time.perf_counter()
    # Pass macros with calories for protein-aware curation
    macros_with_calories = {**macros, 'calories': calories}
    user_preferences = await extract_user_preferences_llm(client, user_prompt, dietary, macros_with_calories)
    user_specific_directions = user_preferences.get("directions", "")
    preferences_time = (time.perf_counter() - preferences_start) * 1000
    mealplan_logger.info(f"[AI_EXTRACTION] Completed in {preferences_time:.0f}ms")
    
    # Generate dynamic dietary enforcement rules
    dietary_rules_start = time.perf_counter()
    dietary_rules = await generate_dietary_rules_llm(client, dietary, allergies)
    dietary_rules_time = (time.perf_counter() - dietary_rules_start) * 1000
    mealplan_logger.info(f"[DIETARY_RULES] Completed in {dietary_rules_time:.0f}ms")

    user_message = f"""
    USER_INPUT:
    {user_prompt}

    {diet_context}
    {user_specific_directions}
    USER_PROFILE:
    {json.dumps(profile_dict, indent=2)}
    NUTRITIONAL TARGETS (MANDATORY):
    - Daily Protein Target: {macros['protein_g']} g
    - Daily Fat Target: {macros['fat_g']} g
    - Daily Carbohydrate Target: {macros['carbs_g']} g

    IMPORTANT EXECUTION NOTE:
    - Meet protein grams using gram-based protein items; do not multiply non-gram items (eggs, slices, cups). Keep those as fixed single servings and adjust grams instead.

    follow all the dietary restrictions and allergies above strictly.
    Ensure total macros across each day stay within ±5% of these targets, while total calories stay within ±20 kcal of the targetCalories.
    If incase the user mentions anything about macros, like number of grams of protein, carbs, fat, please prioritize those over the calculated macros above.
    INSTRUCTION: Generate the complete 7-day meal plan following the exact format specified in your system instructions.
    Request-ID: {unique_id}-{timestamp}
    """

    system_prompt = f"""
You are a meal plan generator. Output EXACTLY 7 days using ONLY foods from the curator's allowed list.

FORMAT:
Day X:
- Breakfast (XXX kcal):
  1. Food - quantity - kcal - Xp/Xf/Xc
- Lunch (XXX kcal):
  1. Food - quantity - kcal - Xp/Xf/Xc
- Snack (XXX kcal):
  1. Food - quantity - kcal - Xp/Xf/Xc
- Dinner (XXX kcal):
  1. Food - quantity - kcal - Xp/Xf/Xc
Total: XXXX kcal

QUANTITY UNITS:
- GRAMS for: cooked foods, proteins, grains, vegetables (e.g., 150g, 200g)
- NATURAL UNITS for: bread (2 slices), fruits (1 apple), flatbreads (2 roti)

=== CORE MEAL STRUCTURE (EVERY MEAL) ===

⚠️ ONE PROTEIN SOURCE PER MEAL - MANDATORY ⚠️
- EVERY meal MUST have exactly ONE major protein source
- Use proteins from the curator's ALLOWED PROTEINS list only
- Minimum per meal: Breakfast 15g+, Lunch 30g+, Snack 10g+, Dinner 30g+

⚠️ ONE CARB SOURCE PER MEAL - STRICTLY ENFORCED ⚠️
- Each main meal gets EXACTLY ONE carb source - NEVER two
- CARB SOURCES: rice, roti, bread, pasta, quinoa, naan, paratha, tortilla, pita
- WRONG (NEVER DO):
  • Rice + Naan (2 carbs - WRONG)
  • Quinoa + Bread (2 carbs - WRONG)
  • Pasta + Garlic bread (2 carbs - WRONG)
- RIGHT:
  • Chicken + Rice + Vegetables (1 carb - CORRECT)
  • Paneer + 2 Roti + Salad (1 carb - CORRECT)
- Dal/curry/vegetables are NOT carbs - they accompany the carb

=== MEAL APPROPRIATENESS ===

BREAKFAST: Use breakfast foods only
- ALLOWED: oatmeal, toast, pancakes, idli, dosa, poha, upma, smoothie bowl, paratha
- NOT ALLOWED: plain rice, biryani, heavy curries, dal as main dish

SNACKS: Must be LIGHT (under 200 kcal)
- ALLOWED: fruits, nuts, yogurt, protein bars, hummus + veggies
- NOT ALLOWED: rice, roti, pasta, full meals, curries

LUNCH/DINNER: Full balanced meals
- Structure: ONE protein + ONE carb + vegetables

=== VARIETY & ROTATION (CRITICAL) ===

NATURAL ROTATION - NOT FORCED UNIQUENESS:
- Same dish can repeat 2-3 times across the week (realistic home cooking)
- But NEVER repeat the exact same meal on consecutive days
- Rotate through the curator's allowed proteins/dishes
- Different combinations each day: Day 1 chicken+rice, Day 2 fish+quinoa, Day 3 chicken+roti

FREQUENCY LIMITS - RESPECT USER PREFERENCES:
- If user says "X 3 times a week" → use X on exactly 3 days, other proteins on other days
- If user says "daily X" → use X every day
- If user says "occasional X" → use X 1-2 times only

{dietary_rules}

=== OUTPUT FORMAT ===

ITEM FORMAT: "Food name - Xg - XXX kcal - Xp/Xf/Xc"
(p=protein g, f=fat g, c=carbs g)

CRITICAL FORMAT RULES:
- Food name = JUST the food (e.g., "Greek yogurt", "Chicken breast", "Oatmeal")
- NEVER put quantities in food name (WRONG: "1/2 cup oats", RIGHT: "Oatmeal")
- Quantity = grams only (e.g., "150g", "200g")
- For eggs/slices: use "Eggs - 2 eggs - XXX kcal" or "Bread - 2 slices - XXX kcal"

EXAMPLES:
✓ 1. Greek yogurt - 200g - 130 kcal - 20p/0f/8c
✓ 2. Oatmeal - 80g - 100 kcal - 3p/2f/20c  
✓ 3. Eggs - 2 eggs - 140 kcal - 12p/10f/0c
✗ WRONG: 1/2 cup Greek yogurt - 200g - 130 kcal
✗ WRONG: 2 hard-boiled eggs - 100g - 140 kcal

USE COMMON FOODS: Stick to everyday, widely available foods from curator's list.

TARGETS:
- Daily: {calories} kcal, {macros['protein_g']}g protein, {macros['fat_g']}g fat, {macros['carbs_g']}g carbs
- Split: Breakfast 25%, Lunch 35%, Snack 10%, Dinner 30%

END with:
END-OF-PLAN-SUGGESTION: [brief tip for {target_weight}kg goal]
"""

    MODEL = "llama-3.3-70b-versatile"  # Groq's fastest high-quality model

    # Regex patterns
    day_start_regex = re.compile(r'Day \d+:')
    suggestion_phrase = re.compile(r'END[-_\s]?OF[-_\s]?PLAN[-_\s]?SUGGESTION[:\s]*', re.IGNORECASE)
    # USE_MIMIC = False
    async def event_stream():
        """Async generator for streaming the GPT output as raw bytes."""
        # print("Mealplan generation started")
        try:
            # Groq streaming uses stream=True parameter
            stream = await client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=4096,
                temperature=0.9,
                stream=True,
            )

            buffer = ""
            day_count = 0
            suggestion_mode = False
            processed_days_summary = []  # Track meals from processed days for variety
            
            async for chunk in stream:
                # Extract token text from Groq streaming response
                token_text = None
                try:
                    if chunk.choices and chunk.choices[0].delta:
                        token_text = chunk.choices[0].delta.content
                except Exception:
                    token_text = None

                if not token_text:
                    continue

                # If we're already in suggestion mode, stream everything directly
                if suggestion_mode:
                    yield token_text.encode("utf-8")
                    continue

                buffer += token_text

                # Check if suggestion marker found
                suggestion_match = suggestion_phrase.search(buffer)
                if suggestion_match and not suggestion_mode:
                    suggestion_mode = True
                    idx = suggestion_match.start()
                    
                    # Process any remaining complete days before the suggestion
                    pre_suggestion = buffer[:idx]
                    day_starts = [m.start() for m in day_start_regex.finditer(pre_suggestion)]
                    
                    if day_starts:
                        for i, start in enumerate(day_starts):
                            if day_count >= 7:
                                break
                            end = day_starts[i + 1] if i + 1 < len(day_starts) else len(pre_suggestion)
                            day_text = pre_suggestion[start:end]
                            
                            # Skip if too short
                            if len(day_text.strip()) < 50:
                                continue
                            
                            # Non-blocking processing with timing
                            expected_day = day_count + 1  # day_count is 0-indexed
                            proc_start = time.perf_counter()
                            loop = asyncio.get_event_loop()
                            result = await loop.run_in_executor(
                                executor,
                                process_single_day,
                                day_text,
                                calories,
                                macros,
                                5,  # min_qty
                                expected_day  # expected_day_number
                            )
                            proc_time = (time.perf_counter() - proc_start) * 1000
                            
                            # Handle tuple return (output, anomaly_info)
                            if isinstance(result, tuple):
                                processed, anomaly_info = result
                            else:
                                processed, anomaly_info = result, None
                            
                            # If anomaly detected, fix quantities (lightweight call)
                            if anomaly_info and anomaly_info.get('type') == 'calorie_deficit':
                                corrected = await fix_quantities_with_llm(
                                    client, MODEL, day_text, 
                                    anomaly_info['day_number'], calories, macros
                                )
                                if corrected:
                                    processed = corrected
                            
                            # Track this day's key items for variety in next days
                            processed_days_summary.append(f"Day {day_count+1}: {processed[:200]}...")
                            
                            # Stream immediately to frontend
                            processed += "\n"
                            yield processed.encode("utf-8")
                            await asyncio.sleep(0)
                            day_count += 1
                    
                    # Stream the suggestion
                    to_stream = buffer[idx:]
                    yield to_stream.encode("utf-8")
                    
                    buffer = ""
                    continue

                # Process complete days ONE AT A TIME as soon as we have 2 markers
                while day_count < 7:
                    day_starts = [m.start() for m in day_start_regex.finditer(buffer)]
                    if len(day_starts) < 2:
                        break
                    start = day_starts[0]
                    end = day_starts[1]
                    day_text = buffer[start:end]
                    
                    # Non-blocking processing with timing
                    expected_day = day_count + 1  # day_count is 0-indexed
                    proc_start = time.perf_counter()
                    loop = asyncio.get_event_loop()
                    result = await loop.run_in_executor(
                        executor,
                        process_single_day,
                        day_text,
                        calories,
                        macros,
                        5,  # min_qty
                        expected_day  # expected_day_number
                    )
                    proc_time = (time.perf_counter() - proc_start) * 1000
                    
                    # Handle tuple return (output, anomaly_info)
                    if isinstance(result, tuple):
                        processed, anomaly_info = result
                    else:
                        processed, anomaly_info = result, None
                    
                    # If anomaly detected (calories too low), fix quantities
                    if anomaly_info and anomaly_info.get('type') == 'calorie_deficit':
                        mealplan_logger.warning(f"[ANOMALY] Day {anomaly_info['day_number']} has calorie deficit. Fixing quantities...")
                        corrected = await fix_quantities_with_llm(
                            client, MODEL, day_text,
                            anomaly_info['day_number'], calories, macros
                        )
                        if corrected:
                            processed = corrected
                    
                    # Track this day's key items for variety in next days
                    processed_days_summary.append(f"Day {day_count+1}: {processed[:200]}...")
                    
                    # Stream this processed day immediately to frontend
                    processed += "\n"
                    yield processed.encode("utf-8")
                    
                    # Remove processed day from buffer and look for next day
                    buffer = buffer[end:]
                    day_count += 1

            # Process ALL remaining buffer content after stream ends
            if buffer.strip() and day_count < 7:
                # print(f"\n[DEBUG] Processing final buffer, day_count={day_count}, buffer_length={len(buffer)}")
                
                # Check for suggestion marker in remaining buffer
                suggestion_match = suggestion_phrase.search(buffer)
                
                if suggestion_match:
                    # Split buffer into days and suggestion
                    suggestion_start = suggestion_match.start()
                    pre_suggestion = buffer[:suggestion_start]
                    suggestion_text = buffer[suggestion_start:]
                else:
                    pre_suggestion = buffer
                    suggestion_text = ""
                
                # Process any remaining days - INCLUDING last day with only one marker
                if pre_suggestion.strip():
                    day_starts = list(day_start_regex.finditer(pre_suggestion))
                    # print(f"[DEBUG] Found {len(day_starts)} day markers in final buffer")
                    
                    # Check if the last day marker is incomplete (less than 300 chars OR missing "Total Daily")
                    if day_starts and day_count == 6:
                        last_day_start = day_starts[-1].start()
                        last_day_text = pre_suggestion[last_day_start:]
                        remaining_after_last_marker = len(last_day_text)
                        
                        # Day 7 is incomplete if:
                        # 1. Less than 300 chars after marker, OR
                        # 2. Doesn't contain "Total Daily" (which indicates completion)
                        is_incomplete = (remaining_after_last_marker < 300 or 
                                       "Total Daily" not in last_day_text)
                        
                        if is_incomplete:
                            # print(f"[DEBUG] Last day appears incomplete ({remaining_after_last_marker} chars, has 'Total Daily': {'Total Daily' in last_day_text}). Will skip and regenerate via fallback.")
                            # Remove the incomplete last day from processing - DON'T send it to frontend
                            day_starts = day_starts[:-1]
                            # Also clear the buffer so fallback knows to regenerate
                            buffer = pre_suggestion[:last_day_start] if last_day_start > 0 else ""
                    
                    for i in range(len(day_starts)):
                        if day_count >= 7:
                            break
                        start = day_starts[i].start()
                        # For last day, take everything to end of pre_suggestion
                        end = day_starts[i+1].start() if i+1 < len(day_starts) else len(pre_suggestion)
                        day_text = pre_suggestion[start:end]
                        
                        # CRITICAL: Don't skip short days at the end - Day 7 might be incomplete
                        # Only skip if it's truly empty (< 20 chars) or doesn't have "Day" in it
                        if len(day_text.strip()) < 20 or "Day" not in day_text:
                            print(f"[DEBUG] Skipping invalid day segment (length={len(day_text)})")
                            continue
                        
                        # print(f"[DEBUG] Processing final day {day_count + 1}, text_length={len(day_text)}")
                        
                        # Non-blocking processing
                        expected_day = day_count + 1  # day_count is 0-indexed
                        proc_start = time.perf_counter()
                        loop = asyncio.get_event_loop()
                        result = await loop.run_in_executor(
                            executor,
                            process_single_day,
                            day_text,
                            calories,
                            macros,
                            5,  # min_qty
                            expected_day  # expected_day_number
                        )
                        
                        # Handle tuple return (output, anomaly_info)
                        if isinstance(result, tuple):
                            processed, anomaly_info = result
                        else:
                            processed, anomaly_info = result, None
                        
                        # If anomaly detected, fix quantities
                        if anomaly_info and anomaly_info.get('type') == 'calorie_deficit':
                            mealplan_logger.warning(f"[ANOMALY] Day {anomaly_info['day_number']} has calorie deficit. Fixing quantities...")
                            corrected = await fix_quantities_with_llm(
                                client, MODEL, day_text,
                                anomaly_info['day_number'], calories, macros
                            )
                            if corrected:
                                processed = corrected
                        
                        processed += "\n"
                        yield processed.encode("utf-8")
                        day_count += 1
                        # print(f"[DEBUG] Completed day {day_count}, total processed so far")
                
                # Stream suggestion if present
                if suggestion_text:
                    end_marker_match = suggestion_phrase.search(suggestion_text)
                    if end_marker_match:
                        start_idx = end_marker_match.start()
                        suggestion_output = suggestion_text[start_idx:]
                    else:
                        suggestion_output = suggestion_text
                    yield suggestion_output.encode("utf-8")
            
            # FALLBACK: If we still don't have all 7 days, make a second targeted API call
            # Check both day_count and if there was an incomplete day detected
            if day_count < 7:
                # Send multiple keep-alive signals to prevent frontend timeout
                # Send a visible marker that frontend can detect but won't break parsing
                for _ in range(5):
                    yield "\n".encode("utf-8")
                    await asyncio.sleep(0.1)  # Small delay to ensure flushing
                
                # print(f"\n[FALLBACK] Only {day_count}/7 complete days. Making second API call for remaining days...")
                
                # Calculate which days are missing
                missing_days = list(range(day_count + 1, 8))
                missing_days_str = ", ".join([f"Day {d}" for d in missing_days])
                
                # Get variety instructions for fallback to prevent duplicates
                fallback_variety = get_variety_instructions(dietary=dietary, attempt_number=2)
                
                # Create a focused prompt for the missing days
                fallback_prompt = f"""
CRITICAL: The previous response was cut off. Generate ONLY the following missing days: {missing_days_str}
{fallback_variety}
Use the EXACT same format and constraints as before:
- Each meal: 3-5 items max
- Keep food names SHORT
- Daily calories: {calories} kcal (±20)
- Daily protein: {macros['protein_g']} g (±5%)
- Daily fat: {macros['fat_g']} g (±5%)
- Daily carbs: {macros['carbs_g']} g (±5%)
- Meal distribution: Breakfast 25%, Lunch 35%, Snack 10%, Dinner 30%
- Follow all dietary restrictions: {dietary if dietary else 'None'}
- Avoid allergies: {allergies if allergies else 'None'}

Generate ONLY these missing days in the exact format:
Day X:
- Breakfast (XXX kcal, XX g protein, XX g fat, XX g carbs, XX g fiber):
    1. Food item — quantity with unit — XXX kcal | XX g protein, XX g fat, XX g carbs, XX g fiber
...
Total Daily: XXXX kcal, XX g protein, XX g fat, XX g carbs, XX g fiber

Then add: END-OF-PLAN-SUGGESTION: [2-line suggestion for user's {target_weight}kg goal in {timeline_weeks} weeks]
"""
                
                try:
                    # Send keep-alive before creating stream
                    for _ in range(3):
                        yield "\n".encode("utf-8")
                        await asyncio.sleep(0.1)
                    
                    # Use streaming for fallback and process days in real-time
                    fallback_buffer = ""
                    fallback_day_count = 0
                    
                    # Groq streaming uses stream=True parameter
                    fallback_stream = await client.chat.completions.create(
                        model=MODEL,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": fallback_prompt}
                        ],
                        max_tokens=4096,
                        temperature=0.9,
                        stream=True,
                    )
                    
                    # Send immediate keep-alive before first token arrives
                    for _ in range(10):
                        yield "\n".encode("utf-8")
                        await asyncio.sleep(0.2)  # Spread over 2 seconds
                    
                    # Stream tokens and process days as they complete
                    async for chunk in fallback_stream:
                        token_text = None
                        try:
                            if chunk.choices and chunk.choices[0].delta:
                                token_text = chunk.choices[0].delta.content
                        except Exception:
                            token_text = None
                        
                        if not token_text:
                            continue
                        
                        # Send newline periodically to keep frontend spinner active
                        yield "\n".encode("utf-8")
                        
                        fallback_buffer += token_text
                        
                        # Check if we have complete days to process (look for 2 day markers or END marker)
                        while day_count < 7 and fallback_day_count < len(missing_days):
                            day_starts = [m.start() for m in day_start_regex.finditer(fallback_buffer)]
                            
                            # Need at least 2 markers to process a complete day
                            if len(day_starts) < 2:
                                # Check if we hit the end marker for last day
                                if "Total Daily" in fallback_buffer and len(day_starts) == 1:
                                    # Process the last day
                                    start = day_starts[0]
                                    day_text = fallback_buffer[start:]
                                    
                                    if len(day_text.strip()) > 100:
                                        expected_day = day_count + 1  # day_count is 0-indexed
                                        loop = asyncio.get_event_loop()
                                        result = await loop.run_in_executor(
                                            executor,
                                            process_single_day,
                                            day_text,
                                            calories,
                                            macros,
                                            5,  # min_qty
                                            expected_day  # expected_day_number
                                        )
                                        
                                        # Handle tuple return
                                        if isinstance(result, tuple):
                                            processed, anomaly_info = result
                                        else:
                                            processed, anomaly_info = result, None
                                        
                                        # Fix quantities if anomaly
                                        if anomaly_info and anomaly_info.get('type') == 'calorie_deficit':
                                            corrected = await fix_quantities_with_llm(
                                                client, MODEL, day_text,
                                                anomaly_info['day_number'], calories, macros
                                            )
                                            if corrected:
                                                processed = corrected
                                        
                                        processed += "\n"
                                        yield processed.encode("utf-8")
                                        day_count += 1
                                        fallback_day_count += 1
                                        fallback_buffer = ""  # Clear buffer after processing
                                break
                            
                            # Process the first complete day
                            start = day_starts[0]
                            end = day_starts[1]
                            day_text = fallback_buffer[start:end]
                            
                            if len(day_text.strip()) > 100:
                                expected_day = day_count + 1  # day_count is 0-indexed
                                loop = asyncio.get_event_loop()
                                result = await loop.run_in_executor(
                                    executor,
                                    process_single_day,
                                    day_text,
                                    calories,
                                    macros,
                                    5,  # min_qty
                                    expected_day  # expected_day_number
                                )
                                
                                # Handle tuple return
                                if isinstance(result, tuple):
                                    processed, anomaly_info = result
                                else:
                                    processed, anomaly_info = result, None
                                
                                # Fix quantities if anomaly
                                if anomaly_info and anomaly_info.get('type') == 'calorie_deficit':
                                    corrected = await fix_quantities_with_llm(
                                        client, MODEL, day_text,
                                        anomaly_info['day_number'], calories, macros
                                    )
                                    if corrected:
                                        processed = corrected
                                
                                processed += "\n"
                                yield processed.encode("utf-8")
                                day_count += 1
                                fallback_day_count += 1
                            
                            # Remove processed day from buffer
                            fallback_buffer = fallback_buffer[end:]
                    
                    # Process any remaining content in buffer (e.g., last day or suggestion)
                    if fallback_buffer.strip() and day_count < 7:
                        day_starts = list(day_start_regex.finditer(fallback_buffer))
                        if day_starts:
                            for i in range(len(day_starts)):
                                if day_count >= 7:
                                    break
                                start = day_starts[i].start()
                                end = day_starts[i+1].start() if i+1 < len(day_starts) else len(fallback_buffer)
                                day_text = fallback_buffer[start:end]
                                
                                if len(day_text.strip()) > 100:
                                    expected_day = day_count + 1  # day_count is 0-indexed
                                    loop = asyncio.get_event_loop()
                                    result = await loop.run_in_executor(
                                        executor,
                                        process_single_day,
                                        day_text,
                                        calories,
                                        macros,
                                        5,  # min_qty
                                        expected_day  # expected_day_number
                                    )
                                    
                                    # Handle tuple return
                                    if isinstance(result, tuple):
                                        processed, anomaly_info = result
                                    else:
                                        processed, anomaly_info = result, None
                                    
                                    # Fix quantities if anomaly
                                    if anomaly_info and anomaly_info.get('type') == 'calorie_deficit':
                                        corrected = await fix_quantities_with_llm(
                                            client, MODEL, day_text,
                                            anomaly_info['day_number'], calories, macros
                                        )
                                        if corrected:
                                            processed = corrected
                                    
                                    processed += "\n"
                                    yield processed.encode("utf-8")
                                    day_count += 1
                    
                    # Check for suggestion in remaining buffer
                    suggestion_match = suggestion_phrase.search(fallback_buffer)
                    if suggestion_match:
                        suggestion_text = fallback_buffer[suggestion_match.start():]
                        yield suggestion_text.encode("utf-8")
                    
                    # print(f"[FALLBACK] Completed. Total days: {day_count}/7")
                    
                except Exception as fallback_error:
                    error_msg = f"\n\n[FALLBACK ERROR] Failed to generate remaining days: {str(fallback_error)}\n"
                    print(error_msg)
                    yield error_msg.encode("utf-8")

        except Exception as e:
            error_msg = f"\n\nError generating meal plan: {str(e)}\n"
            yield error_msg.encode("utf-8")
        finally:
            total_ms = (time.perf_counter() - full_t_start) * 1000
            mealplan_logger.info(f"[ENDPOINT_TOTAL_TIME]{total_ms:.2f} ms")

    return StreamingResponse(event_stream(), media_type="application/octet-stream")



@app.post("/workoutplan")
async def workout_plan(request: Request):
    data = await request.json()
    workoutplan_logger.info("=== /workoutplan endpoint called ===")
    workoutplan_logger.info("Received data: %s", json.dumps(data, indent=2))

    goal = data.get("goal")
    workout_focus = data.get("workout_focus")
    user_prompt = data.get("prompt")
    workout_days = data.get("workout_days")
    target_weight = int(data.get("targetWeight"))
    timeline_weeks = int(data.get("timelineWeeks"))

    workoutplan_logger.info("=== PARSED INPUTS ===")
    workoutplan_logger.info("Goal: %s", goal)
    workoutplan_logger.info("Workout Focus: %s", workout_focus)
    workoutplan_logger.info("Workout Days: %d", workout_days)
    workoutplan_logger.info("Target Weight: %d kg", target_weight)
    workoutplan_logger.info("Timeline: %d weeks", timeline_weeks)
    workoutplan_logger.info("User Prompt: %s", user_prompt)
    workoutplan_logger.info("===================\n")

    system_prompt = f"""
You are a fitness and nutrition assistant. Generate personalized workout plans.

CORE CONSTRAINTS (unbreakable):
- WORKOUT_PLAN: exactly 7 days. Non-active days labeled "Rest Day."
- NEVER omit, repeat, summarize, or abbreviate any days.
- Do NOT use vague terms like 'HIIT', 'cardio', 'circuit', 'strength', 'full body', or any other generic routines.
- Only provide specific exercises with sets × reps.
- If an exercise requires equipment, specify it (e.g., Dumbbell, Resistance Band, Bodyweight).
- Do not generate any markdown or formatting anywhere in the output

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
9. Keep the Muscle focus phrase short like Chest, Back, Legs, Arms, Shoulders, Core, Full Body etc.


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

    # workoutplan_logger.info("=== SYSTEM PROMPT ===")
    # workoutplan_logger.info("%s", system_prompt)
    # workoutplan_logger.info("=== USER MESSAGE ===")
    # workoutplan_logger.info("%s", user_message)
    # workoutplan_logger.info("=====================\n")

    async def event_stream():
        workoutplan_logger.info("=== GROQ WORKOUT OUTPUT START ===")
        total_chars = 0
        
        try:
            # Groq streaming uses stream=True parameter
            stream = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=4096,
                temperature=0.9,
                stream=True,
            )
            
            # Iterate over the stream chunks
            async for chunk in stream:
                try:
                    if chunk.choices and chunk.choices[0].delta:
                        token_text = chunk.choices[0].delta.content
                        if token_text:
                            total_chars += len(token_text)
                            # Stream to frontend
                            yield token_text.encode("utf-8")
                except Exception:
                    continue
            
            workoutplan_logger.info("=== GROQ WORKOUT OUTPUT END ===")
            workoutplan_logger.info("Total characters streamed: %d", total_chars)

        except Exception as e:
            error_msg = f"\nException during streaming: {str(e)}\n{traceback.format_exc()}"
            workoutplan_logger.error("%s", error_msg)
            yield error_msg.encode("utf-8")

    return StreamingResponse(event_stream(), media_type="application/octet-stream")


if __name__ == "__main__":
    import uvicorn

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

    uvicorn.run("app:app", host="127.0.0.1", port=5002, reload=True)