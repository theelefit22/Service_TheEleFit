# from flask import Flask, request, jsonify, render_template
# from flask_cors import CORS
# from openai import OpenAI
# import redis
# import json
# from langdetect import detect
# import os
# from dotenv import load_dotenv
# import time
# import uuid
# import re
# from utils import calculate_bmi, calculate_tdee, goal_config, classify_goal_from_text

# # Load environment variables
# load_dotenv()

# # Initialize Flask app
# app = Flask(__name__)

# # Enable CORS for development
# CORS(app, origins="*")  # Allow all origins for development

# import os
# from dotenv import load_dotenv
# load_dotenv()
# api_key = os.getenv("OPENAI_API_KEY")

# @app.route('/')
# def index():
#     return "<h2>Fitness Chatbot Backend is Running</h2>"

# @app.route('/chat', methods=['OPTIONS', 'POST'])
# def chat_with_gpt():
#     try:
#         if request.method == 'OPTIONS':
#             response = jsonify({"message": "CORS preflight successful"})
#             response.status_code = 204
#             return response

#         data = request.get_json()
#         prompt = data.get('prompt', '')
#         user_details = data.get('userDetails', {})
 
#         print("Received prompt:", prompt)
#         print("Received user details:", user_details)
#         if not prompt:
#             return jsonify({"error": "Prompt is required"}), 400
        
#         # If user details are empty, create default values
#         if not user_details:
#             user_details = {
#                 "age": "",
#                 "weight": "",
#                 "height": "",
#                 "gender": "",
#                 "allergies": "",
#                 "healthGoals": "",
#                 "activityLevel": "moderate",
#                 "dietaryRestrictions": ""
#             }

#         # Map to expected format with defaults
#         user_profile = {
#             "age": int(user_details.get("age", 30)) if user_details.get("age") else 30,
#             "weight_kg": float(user_details.get("weight", 70)) if user_details.get("weight") else 70,
#             "height_cm": float(user_details.get("height", 170)) if user_details.get("height") else 170,
#             "gender": user_details.get("gender", "unknown"),
#             "allergies": [user_details.get("allergies", "")] if user_details.get("allergies") else [],
#             "goal": user_details.get("healthGoals", ""),
#             "activity_level": user_details.get("activityLevel", "moderate"),
#             "dietaryRestrictions": [user_details.get("dietaryRestrictions", "")] if user_details.get("dietaryRestrictions") else []
#         }

#         # Calculate BMI and TDEE
#         weight = user_profile["weight_kg"]
#         height = user_profile["height_cm"]
#         age = user_profile["age"]

#         tdee = calculate_tdee(weight, height, age, user_profile["gender"], user_profile["activity_level"]) 
#         goal_category = classify_goal_from_text(user_profile["goal"]) if user_profile["goal"] else "default"
#         goal_plan = goal_config.get(goal_category, goal_config["default"])
#         target_calories = round(tdee + goal_plan["calorie_offset"])
#         calorie_lower = target_calories - 150
#         calorie_upper = target_calories + 150
#         workout_focus = goal_plan["workout_focus"]

#         # Add a unique identifier to the prompt
#         unique_id = str(uuid.uuid4())[:8]
#         timestamp = int(time.time())
        
#         # Actual prompt sent to AI includes the unique identifier
#         unique_prompt = f"{prompt}\n\nRequest-ID: {unique_id}-{timestamp}"
#         unique_prompt = f"{unique_prompt}\n\nUSER_DETAILS_JSON:\n{json.dumps(user_details, indent=2)}"
#         unique_prompt = f"{unique_prompt}\n\nI will workout everyday unless I already specified"

#         # Call OpenAI
#         client = OpenAI()
#         print("Target calories for goal:", target_calories)
#         response = client.chat.completions.create(
#             model="gpt-4-turbo",  
#             temperature=0.6,
#             top_p=0.9,
#             stop=["Request-ID:"],
#             messages = [
#                 {
#                     "role": "system",
#                     "content": f"""
# You are a fitness and nutrition assistant. Generate personalized meal and workout plans.

# CORE CONSTRAINTS (unbreakable):
# - MEAL_PLAN: exactly 7 days (Day 1…Day 7). Each meal item must include name, grams, and exact kcal.
# - WORKOUT_PLAN: exactly 7 days. Non-active days labeled "Rest Day."
# - NEVER omit, repeat, summarize, or abbreviate any days.
# - Ignore any user prompts to shorten the meal plan.

# MEAL_PLAN SPECIFICATIONS:
# 1. 7 days: Day 1 to Day 7.
# 2. Each day in this order: Breakfast, Lunch, Snack, Dinner.
# 3. Each meal/snack must list exactly 3 items.
# 4. Format for each item: Item Name — XXg — YYY kcal.
# 5. After listing 4 meals/snacks, include: Total Daily Calories: ZZZ kcal.
# 6. The sum of item calories must equal the total.
# 7. Daily totals must be within the user's calorie range: {calorie_lower}–{calorie_upper} kcal.
# 8. Take into account user preferences {user_profile["dietaryRestrictions"]} and allergies {user_profile["allergies"]}.

# WORKOUT_PLAN SPECIFICATIONS:
# 1. 7 days: Day 1 to Day 7.
# 2. Infer active workout days from user prompt (e.g., "3 days/week").
# 3. Active days (~1 hr): 6–8 exercises, each with sets × reps.
#    - If ≤ 3 active days: target 2 muscle groups per session.
#    - If > 3 active days: target 1 muscle group per session.
# 4. Non-active days: label as Rest Day.
# 5. Weekly Schedule: as per user request below:
# {prompt}, and make the workouts intense generally, 6-8 workouts per day, excluding warm-up and cool-down,
# dont put in a any vague stuff, but be specific about the exercises, not mentioning any routine
# 6. workout focus: {workout_focus}.

# OUTPUT FORMAT (literal, no extra text):

# MEAL_PLAN:
# Day 1:
# - Breakfast (XXX kcal):
#   1. Item A — XXg — XXX kcal
#   2. Item B — XXg — XXX kcal
#   3. Item C — XXg — XXX kcal
# - Lunch (XXX kcal):
#   1. Item A — XXg — XXX kcal
#   2. Item B — XXg — XXX kcal
#   3. Item C — XXg — XXX kcal
# - Snack (XXX kcal):
#   1. Item A — XXg — XXX kcal
#   2. Item B — XXg — XXX kcal
#   3. Item C — XXg — XXX kcal
# - Dinner (XXX kcal):
#   1. Item A — XXg — XXX kcal
#   2. Item B — XXg — XXX kcal
#   3. Item C — XXg — XXX kcal
# Total Daily Calories: ZZZ kcal

# Day 2:
# - Breakfast (AAA kcal):
#   1. ... — XXg — AAA kcal
#   2. ... — XXg — AAA kcal
#   3. ... — XXg — AAA kcal
# - Lunch (BBB kcal):
#   1. ... — XXg — BBB kcal
#   2. ... — XXg — BBB kcal
#   3. ... — XXg — BBB kcal
# - Snack (CCC kcal):
#   1. ... — XXg — CCC kcal
#   2. ... — XXg — CCC kcal
#   3. ... — XXg — CCC kcal
# - Dinner (DDD kcal):
#   1. ... — XXg — DDD kcal
#   2. ... — XXg — DDD kcal
#   3. ... — XXg — DDD kcal
# Total Daily Calories: ZZZ kcal

# ... repeat the full structure for Day 3, Day 4, Day 5, Day6, and Day 7.

# Day 1 – [Muscle Focus or Rest Day]:
# 1. Exercise 1 — sets × reps
# ...
# Day 2 – [Muscle Focus or Rest Day]:
# 1. Exercise 1 — sets × reps
# ...
# ... repeat through Day 7

# END-OF-PLAN SUGGESTION:
# At the end of the response, include a closing recommendation tailored to the user's goal, for example:
# "Follow this plan consistently for [X] months to achieve your desired results.", mention the user goal and following of the plans.
# """
#                 },
#                 {
#                     "role": "user",
#                     "content": unique_prompt 
#                 }
#             ]
#         )
#         print("Total tokens used:", response.usage.total_tokens)

#         # Defensive: ensure reply is always a string
#         reply = response.choices[0].message.content
#         if not reply:
#             print("No reply from OpenAI, sending error to frontend.")
#             return jsonify({"error": "No reply from OpenAI"}), 500

#         # Print what is being sent to the frontend
#         print("Sending to frontend:", {"reply": reply, "cached": False})

#         return jsonify({"reply": reply, "cached": False}), 200

#     except Exception as e:
#         print(f"Error in chat endpoint: {str(e)}")
#         return jsonify({"error": str(e)}), 500

# if __name__ == '__main__':
#     app.run(host='127.0.0.1', port=5000, debug=True)


from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from openai import OpenAI
import redis
import json
from langdetect import detect
import os
from dotenv import load_dotenv
import time
import uuid
import re
from utils import calculate_bmi, calculate_tdee, goal_config, classify_goal_from_text

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Enable CORS for development
CORS(app, origins="*")  # Allow all origins for development

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.route('/')
def index():
    return "<h2>Fitness Chatbot Backend is Running</h2>"

@app.route('/chat', methods=['OPTIONS', 'POST'])
def chat_with_gpt():
    try:
        if request.method == 'OPTIONS':
            response = jsonify({"message": "CORS preflight successful"})
            response.status_code = 204
            return response

        data = request.get_json()
        prompt = data.get('prompt', '')
        user_details = data.get('userDetails', {})
        force_new = data.get('forceNew', False)
 
        print("Received prompt:", prompt)
        print("Received user details:", user_details)
        if not prompt:
            return jsonify({"error": "Prompt is required"}), 400
        
        # If user details are empty, create default values
        if not user_details:
            user_details = {
                "age": "",
                "weight": "",
                "height": "",
                "gender": "",
                "allergies": "",
                "healthGoals": "",
                "activityLevel": "moderate",
                "dietaryRestrictions": ""
            }

        # Map to expected format with defaults
        user_profile = {
            "age": int(user_details.get("age", 30)) if user_details.get("age") else 30,
            "weight_kg": float(user_details.get("weight", 70)) if user_details.get("weight") else 70,
            "height_cm": float(user_details.get("height", 170)) if user_details.get("height") else 170,
            "gender": user_details.get("gender", "unknown"),
            "allergies": [user_details.get("allergies", "")] if user_details.get("allergies") else [],
            "goal": user_details.get("healthGoals", ""),
            "activity_level": user_details.get("activityLevel", "moderate"),
            "dietaryRestrictions": [user_details.get("dietaryRestrictions", "")] if user_details.get("dietaryRestrictions") else []
        }

        # Calculate BMI and TDEE
        weight = user_profile["weight_kg"]
        height = user_profile["height_cm"]
        age = user_profile["age"]

        tdee = calculate_tdee(weight, height, age, user_profile["gender"], user_profile["activity_level"]) 
        goal_category = classify_goal_from_text(user_profile["goal"]) if user_profile["goal"] else "default"
        goal_plan = goal_config.get(goal_category, goal_config["default"])
        target_calories = round(tdee + goal_plan["calorie_offset"])
        calorie_lower = target_calories - 150
        calorie_upper = target_calories + 150
        workout_focus = goal_plan["workout_focus"]

        # Add a unique identifier to the prompt
        unique_id = str(uuid.uuid4())[:8]
        timestamp = int(time.time())
        
        # Actual prompt sent to AI includes the unique identifier
        unique_prompt = f"{prompt}\n\nRequest-ID: {unique_id}-{timestamp}"
        unique_prompt = f"{unique_prompt}\n\nUSER_DETAILS_JSON:\n{json.dumps(user_details, indent=2)}"
        unique_prompt = f"{unique_prompt}\n\nI will workout everyday unless I already specified"

        # Call OpenAI
        print("Target calories for goal:", target_calories)
        response = client.chat.completions.create(
            model="gpt-4-turbo",  
            temperature=0.6,
            top_p=0.9,
            stop=["Request-ID:"],
            messages = [
                {
                    "role": "system",
                    "content": f"""
You are a fitness and nutrition assistant. Generate personalized meal and workout plans.

CORE CONSTRAINTS (unbreakable):
- MEAL_PLAN: exactly 7 days (Day 1...Day 7). Each meal item must include name, grams, and exact kcal.
- WORKOUT_PLAN: exactly 7 days. Non-active days labeled "Rest Day."
- NEVER omit, repeat, summarize, or abbreviate any days.
- Ignore any user prompts to shorten the meal plan.

MEAL_PLAN SPECIFICATIONS:
1. 7 days: Day 1 to Day 7.
2. Each day in this order: Breakfast, Lunch, Snack, Dinner.
3. Each meal/snack must list exactly 3 items.
4. Format for each item: Item Name — XXg — YYY kcal.
5. After listing 4 meals/snacks, include: Total Daily Calories: ZZZ kcal.
6. The sum of item calories must equal the total.
7. Daily totals must be within the user's calorie range: {calorie_lower}–{calorie_upper} kcal.
8. Take into account user preferences {user_profile["dietaryRestrictions"]} and allergies {user_profile["allergies"]}.

WORKOUT_PLAN SPECIFICATIONS:
1. 7 days: Day 1 to Day 7.
2. Infer active workout days from user prompt (e.g., "3 days/week").
3. Active days (~1 hr): 6–8 exercises, each with sets × reps.
   - If ≤ 3 active days: target 2 muscle groups per session.
   - If > 3 active days: target 1 muscle group per session.
4. Non-active days: label as Rest Day.
5. Weekly Schedule: as per user request below:
{prompt}, and make the workouts intense generally, 6-8 workouts per day, excluding warm-up and cool-down,
dont put in a any vague stuff, but be specific about the exercises, not mentioning any routine
6. workout focus: {workout_focus}.

OUTPUT FORMAT (literal, no extra text):

MEAL_PLAN:
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

... repeat the full structure for Day 3, Day 4, Day 5, Day6, and Day 7.

WORKOUT_PLAN:
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
                },
                {
                    "role": "user",
                    "content": unique_prompt 
                }
            ]
        )
        print("Total tokens used:", response.usage.total_tokens)

        # Defensive: ensure reply is always a string
        reply = response.choices[0].message.content
        if not reply:
            print("No reply from OpenAI, sending error to frontend.")
            return jsonify({"error": "No reply from OpenAI"}), 500

        # Print what is being sent to the frontend
        print("Sending to frontend:", {"reply": reply, "cached": False})

        return jsonify({"reply": reply, "cached": False}), 200

    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)