
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


def process_single_day(day_string):
    """
    Processes a single day's meal plan string by rounding item calories and
    calculating meal and total daily calories based on the rounded item calories.

    Args:
        day_string: A string containing the meal plan for a single day.

    Returns:
        A string containing the corrected meal plan.
    """
    meal_plan = {}
    meal_pattern = r"- (.*) \((\d+) kcal\):"
    item_pattern = r"\d+\. (.*) — (.*) — (\d+) kcal"

    meals = re.findall(meal_pattern, day_string)

    for meal_name, meal_kcal in meals:
         meal_plan[meal_name] = {"stated_calories": int(meal_kcal), "items": []}
         meal_section_pattern = rf"- {re.escape(meal_name)} \({meal_kcal} kcal\):(.*?)($|- |\*\*Day \d+:)"
         meal_section_match = re.search(meal_section_pattern, day_string, re.DOTALL)

         if meal_section_match:
             meal_section = meal_section_match.group(1)
             items = re.findall(item_pattern, meal_section)
             for item_name, quantity, item_kcal in items:
                 meal_plan[meal_name]["items"].append({
                     "item_name": item_name.strip(),
                     "quantity": quantity.strip(),
                     "stated_calories": int(item_kcal) # Keep original stated calories for rounding
                 })

    # Round item calories to the nearest 5
    print("=== DEBUG: ROUNDING PROCESS ===")
    for meal_name, meal_data in meal_plan.items():
        print(f"\n{meal_name}:")
        for item in meal_data['items']:
            original_item_calories = item['stated_calories']
            rounded_item_calories = round(original_item_calories / 5) * 5
            print(f"  {item['item_name']}: {original_item_calories} kcal → {rounded_item_calories} kcal")
            item['stated_calories'] = rounded_item_calories
    print("=== END ROUNDING DEBUG ===\n")

    # Calculate meal totals and update stated meal calories
    print("=== DEBUG: MEAL TOTALS AFTER ROUNDING ===")
    for meal_name, meal_data in meal_plan.items():
        calculated_meal_total = sum(item['stated_calories'] for item in meal_data['items'])
        print(f"{meal_name}: {calculated_meal_total} kcal")
        meal_data['stated_calories'] = calculated_meal_total # Update stated meal calories to the calculated total
    print("=== END MEAL TOTALS DEBUG ===\n")

    # Calculate total daily calories and update stated total daily calories
    final_total_daily_calories = sum(meal_data['stated_calories'] for meal_name, meal_data in meal_plan.items())
    print(f"=== DEBUG: FINAL DAILY TOTAL: {final_total_daily_calories} kcal ===\n")

    # Compare with stated total (sum of meal stated calories)
    stated_total = sum(int(kcal) for kcal in re.findall(r'Total Daily Calories: (\d+) kcal', day_string))
    if stated_total == 0:
        # fallback: sum meal headers
        stated_total = sum(int(meal_kcal) for _, meal_kcal in re.findall(r'- .* \((\d+) kcal\):', day_string))

    discrepancy = abs(final_total_daily_calories - stated_total)
    if discrepancy > 100:
        # Increase each item's calories by 5 and recalculate
        for meal_name, meal_data in meal_plan.items():
            for item in meal_data['items']:
                item['stated_calories'] += 5
        # Recalculate meal totals
        for meal_name, meal_data in meal_plan.items():
            meal_data['stated_calories'] = sum(item['stated_calories'] for item in meal_data['items'])
        final_total_daily_calories = sum(meal_data['stated_calories'] for meal_name, meal_data in meal_plan.items())

    # Generate updated text
    day_match = re.search(r"Day (\d+):", day_string)
    day_number = day_match.group(1) if day_match else "N/A"
    output_string = f"Day {day_number}:\n"

    for meal_name, meal_data in meal_plan.items():
        output_string += f"\n- {meal_name} ({meal_data['stated_calories']} kcal):\n" # Use calculated meal total
        for i, item in enumerate(meal_data['items']):
            output_string += f"  {i+1}. {item['item_name']} — {item['quantity']} — {item['stated_calories']} kcal\n"

    output_string += f"\nTotal Daily Calories: {final_total_daily_calories} kcal\n" # Use calculated total daily calories

    return output_string