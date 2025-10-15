
import re
def calculate_bmi(weight_kg, height_cm):
    height_m = height_cm / 100
    return round(weight_kg / (height_m ** 2), 2)

def calculate_tdee(weight_kg, height_cm, age, gender, activity_level):
    height_m = height_cm / 100
    bmi = calculate_bmi(weight_kg, height_cm)
    
    # BMR: Mifflin-St Jeor Equation
    if gender == "male":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

    activity_factors = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very active": 1.9
    }
    return int(bmr * activity_factors.get(activity_level, 1.55))

goal_config = {
    "weight_loss": {"calorie_offset": -500, "workout_focus": "Fat Burn & Cardio"},
    "muscle_gain": {"calorie_offset": +500, "workout_focus": "Strength & Hypertrophy"},
    "get_fit": {"calorie_offset": 0, "workout_focus": "Mixed Cardio and Strength"},
    "get_stronger": {"calorie_offset": +300, "workout_focus": "Progressive Overload & Compound Lifts"},
    "get_flexible": {"calorie_offset": 0, "workout_focus": "Mobility, Yoga, and Stretching"},
    "default": {"calorie_offset": 0, "workout_focus": "Mixed Cardio and Strength"}  # Default config
}


user_profile_default = {
    "name": "John Doe",
    "weight": 70,
    "height": 175,
    "age": 26,
    "gender": "male",
    "activity_level": "moderate",  
    "goal": "weight_loss",         
    "location": "USA",
    "preferences": ["non-vegetarian"],
    "allergies": ["gluten"]
}

def classify_goal_from_text(goal_text: str) -> str:
    goal_text = goal_text.lower()

    if re.search(r"(lose|shed|drop)\s+(weight|fat)", goal_text) or \
       re.search(r"fat\s+loss", goal_text) or \
       re.search(r"weight\s+loss", goal_text) or \
       re.search(r"slim\s+down", goal_text):
        return "weight_loss"

    if re.search(r"(gain|build|increase)\s+(muscle|mass)", goal_text) or \
       re.search(r"muscle\s+gain", goal_text) or \
       re.search(r"bulk", goal_text):
        return "muscle_gain"

    if re.search(r"(get|become|feel)\s+(stronger|strong)", goal_text) or \
       re.search(r"increase\s+strength", goal_text) or \
       re.search(r"lift\s+heavier", goal_text):
        return "get_stronger"

    if re.search(r"(become|get|improve)\s+(flexible|mobility)", goal_text) or \
       re.search(r"(yoga|stretching|mobility\s+training)", goal_text):
        return "get_flexible"

    if re.search(r"get\s+fit", goal_text) or \
       re.search(r"(stay|keep)\s+(active|healthy)", goal_text) or \
       re.search(r"overall\s+fitness", goal_text) or \
       re.search(r"improve\s+fitness", goal_text):
        return "get_fit"

    # Default fallback
    return "get_fit"

import re

def round_to_5(value):
    """Round a value to the nearest 5."""
    return int(round(value / 5) * 5)

def parse_quantity(quantity_str):
    """Parse quantity string to extract numeric value and unit."""
    match = re.match(r'(\d+(?:\.\d+)?)\s*(\w*)', quantity_str.strip())
    if match:
        return float(match.group(1)), match.group(2)
    return 0, ''


def process_single_day(day_string, target_calories, min_qty=5):
    """
    Processes a single day's meal plan string safely:
      - Skips zero-quantity/zero-calorie items.
      - Adjusts meals to target calories without dropping items below `min_qty`.
      - Rounds quantities and calories to nearest 5.
    """
    meal_distribution = {
        "Breakfast": int(target_calories * 0.25),
        "Lunch": int(target_calories * 0.35),
        "Snack": int(target_calories * 0.10),
        "Dinner": int(target_calories * 0.30),
    }

    # Parse day number
    day_match = re.search(r"Day (\d+):", day_string)
    day_number = day_match.group(1) if day_match else "1"

    # Parse meals
    meal_plan = {}
    meal_pattern = r"- (.*?) \((\d+) kcal\):"
    meals = re.findall(meal_pattern, day_string)

    for meal_name, meal_kcal in meals:
        meal_plan[meal_name] = {"stated_total": int(meal_kcal), "items": []}

        # Extract meal section
        meal_section_pattern = rf"- {re.escape(meal_name)} \({meal_kcal} kcal\):(.*?)(?=\n- |\nTotal Daily Calories|$)"
        meal_section_match = re.search(meal_section_pattern, day_string, re.DOTALL)

        if meal_section_match:
            meal_section = meal_section_match.group(1)
            # Parse items (skip "Adjust" items)
            item_pattern = r"\d+\. (.*?) — (.*?) — (\d+) kcal"
            items = re.findall(item_pattern, meal_section)

            for item_name, quantity, item_kcal in items:
                if item_name.strip().lower().startswith("adjust"):
                    continue
                qty_value, unit = parse_quantity(quantity)
                calories = int(item_kcal)
                if qty_value > 0 and calories > 0:
                    meal_plan[meal_name]["items"].append({
                        "name": item_name.strip(),
                        "quantity": qty_value,
                        "unit": unit if unit else 'g',
                        "calories": calories,
                        "density": calories / qty_value  # kcal per g
                    })

    # Adjust meals safely
    for meal_name, meal_data in meal_plan.items():
        target_meal_calories = meal_distribution.get(meal_name, meal_data["stated_total"])
        current_total = sum(item["calories"] for item in meal_data["items"])
        adjustment_needed = target_meal_calories - current_total

        if abs(adjustment_needed) > 25:
            # Calculate total density
            total_density = sum(item["density"] for item in meal_data["items"]) or 1

            for item in meal_data["items"]:
                proportion = item["density"] / total_density
                delta_calories = adjustment_needed * proportion
                delta_qty = delta_calories / item["density"]

                # Prevent going below min_qty
                new_qty = max(item["quantity"] + delta_qty, min_qty)
                item["quantity"] = new_qty
                item["calories"] = new_qty * item["density"]

    # Round all values to nearest 5
    for meal_data in meal_plan.values():
        for item in meal_data["items"]:
            item["quantity"] = round_to_5(item["quantity"])
            item["calories"] = round_to_5(item["quantity"] * item["density"])

    # Final totals
    for meal_data in meal_plan.values():
        meal_data["total"] = sum(item["calories"] for item in meal_data["items"])
    daily_total = sum(meal["total"] for meal in meal_plan.values())

    # Format output
    output = f"Day {day_number}:\n"
    for meal_name, meal_data in meal_plan.items():
        output += f"- {meal_name} ({meal_data['total']} kcal):\n"
        for i, item in enumerate(meal_data["items"], 1):
            output += f"  {i}. {item['name']} — {item['quantity']}{item['unit']} — {item['calories']} kcal\n"
    output += f"Total Daily Calories: {daily_total} kcal"

    return output
