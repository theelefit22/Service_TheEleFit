import requests
import json

# Test the workout plan endpoint with 4 workout days
test_data = {
    "goal": "weight_loss",
    "workout_focus": "Mixed Cardio and Strength", 
    "workout_days": 4,
    "prompt": "Generate workout plan for weight_loss goal, I prefer to workout 4 days per week"
}

try:
    response = requests.post('http://127.0.0.1:5002/workoutplan', 
                           json=test_data,
                           headers={'Content-Type': 'application/json'})
    
    if response.status_code == 200:
        print("✅ Request successful!")
        print("Response content:")
        print(response.text)
        
        # Count workout days in response
        content = response.text.lower()
        workout_days = content.count('day') - content.count('rest day')
        print(f"\n📊 Analysis:")
        print(f"Total 'day' mentions: {content.count('day')}")
        print(f"Rest day mentions: {content.count('rest day')}")
        print(f"Estimated workout days: {workout_days}")
        
    else:
        print(f"❌ Request failed with status: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"❌ Error: {e}")
