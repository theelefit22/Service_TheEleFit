#!/usr/bin/env python3
"""
Comprehensive test script for SSE streaming and API endpoints
"""

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:5000"

# Test data
test_profile = {
    "age": 30,
    "weight": 75,
    "height": 175,
    "gender": "male",
    "activityLevel": "moderate",
    "targetWeight": 70,
    "timeline": 12
}

test_meal_request = {
    "prompt": "I want to lose weight and build muscle",
    "userProfile": test_profile,
    "calories": 2200
}

test_workout_request = {
    "prompt": "I want to lose weight and build muscle",
    "userProfile": test_profile,
    "goalCategory": "weight_loss"
}

def test_server_status():
    """Test if server is running"""
    print("\n=== Testing Server Status ===")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ Server is running")
            return True
        else:
            print(f"❌ Server returned status: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure it's running on port 5000")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_cors_headers():
    """Test CORS headers on OPTIONS request"""
    print("\n=== Testing CORS Headers ===")
    try:
        # Test OPTIONS for /calculate-calories
        response = requests.options(f"{BASE_URL}/calculate-calories")
        headers = response.headers
        
        print("CORS Headers:")
        print(f"  Access-Control-Allow-Origin: {headers.get('Access-Control-Allow-Origin', 'Not set')}")
        print(f"  Access-Control-Allow-Methods: {headers.get('Access-Control-Allow-Methods', 'Not set')}")
        print(f"  Access-Control-Allow-Headers: {headers.get('Access-Control-Allow-Headers', 'Not set')}")
        
        if headers.get('Access-Control-Allow-Origin'):
            print("✅ CORS headers are configured")
            return True
        else:
            print("❌ CORS headers missing")
            return False
    except Exception as e:
        print(f"❌ Error testing CORS: {e}")
        return False

def test_calculate_calories():
    """Test /calculate-calories endpoint"""
    print("\n=== Testing /calculate-calories Endpoint ===")
    try:
        response = requests.post(
            f"{BASE_URL}/calculate-calories",
            json=test_profile,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Calorie calculation successful:")
            print(f"  BMI: {data.get('bmi')}")
            print(f"  TDEE: {data.get('tdee')} calories")
            print(f"  Target Calories: {data.get('targetCalories')} calories")
            print(f"  Goal Category: {data.get('goalCategory')}")
            return True
        else:
            print(f"❌ Failed with status {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_meal_plan_json():
    """Test /mealplan endpoint with JSON response"""
    print("\n=== Testing /mealplan Endpoint (JSON) ===")
    try:
        response = requests.post(
            f"{BASE_URL}/mealplan",
            json=test_meal_request,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"  # Request JSON response
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            meal_plan = data.get('mealPlan', '')
            if meal_plan:
                print("✅ Meal plan generated (JSON):")
                print(f"  Length: {len(meal_plan)} characters")
                print(f"  Preview: {meal_plan[:200]}...")
                return True
            else:
                print("❌ Empty meal plan received")
                return False
        else:
            print(f"❌ Failed with status {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_meal_plan_sse():
    """Test /mealplan endpoint with SSE streaming"""
    print("\n=== Testing /mealplan Endpoint (SSE) ===")
    try:
        response = requests.post(
            f"{BASE_URL}/mealplan",
            json=test_meal_request,
            headers={
                "Content-Type": "application/json",
                "Accept": "text/event-stream"  # Request SSE response
            },
            stream=True
        )
        
        if response.status_code == 200:
            print("✅ SSE stream started")
            content = ""
            chunk_count = 0
            
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data: '):
                        chunk_count += 1
                        data = line_str[6:]
                        if data == '[DONE]':
                            print(f"  Stream completed with {chunk_count} chunks")
                            break
                        try:
                            parsed = json.loads(data)
                            if 'choices' in parsed:
                                delta = parsed['choices'][0].get('delta', {})
                                content += delta.get('content', '')
                        except json.JSONDecodeError:
                            content += data
                        
                        # Show progress
                        if chunk_count % 10 == 0:
                            print(f"  Received {chunk_count} chunks...")
            
            if content:
                print(f"✅ Meal plan streamed successfully")
                print(f"  Total length: {len(content)} characters")
                print(f"  Preview: {content[:200]}...")
                return True
            else:
                print("❌ No content received in stream")
                return False
        else:
            print(f"❌ Failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_workout_plan_sse():
    """Test /workoutplan endpoint with SSE streaming"""
    print("\n=== Testing /workoutplan Endpoint (SSE) ===")
    try:
        response = requests.post(
            f"{BASE_URL}/workoutplan",
            json=test_workout_request,
            headers={
                "Content-Type": "application/json",
                "Accept": "text/event-stream"
            },
            stream=True
        )
        
        if response.status_code == 200:
            print("✅ SSE stream started")
            content = ""
            chunk_count = 0
            
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data: '):
                        chunk_count += 1
                        data = line_str[6:]
                        if data == '[DONE]':
                            print(f"  Stream completed with {chunk_count} chunks")
                            break
                        try:
                            parsed = json.loads(data)
                            if 'choices' in parsed:
                                delta = parsed['choices'][0].get('delta', {})
                                content += delta.get('content', '')
                        except json.JSONDecodeError:
                            content += data
                        
                        if chunk_count % 10 == 0:
                            print(f"  Received {chunk_count} chunks...")
            
            if content:
                print(f"✅ Workout plan streamed successfully")
                print(f"  Total length: {len(content)} characters")
                print(f"  Preview: {content[:200]}...")
                return True
            else:
                print("❌ No content received in stream")
                return False
        else:
            print(f"❌ Failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("=" * 50)
    print("SSE Streaming and API Test Suite")
    print("=" * 50)
    
    # Check if server is running first
    if not test_server_status():
        print("\n⚠️  Server is not running. Please start it with:")
        print("    python new-app.py")
        return
    
    # Run all tests
    tests = [
        ("CORS Headers", test_cors_headers),
        ("Calculate Calories", test_calculate_calories),
        ("Meal Plan (JSON)", test_meal_plan_json),
        ("Meal Plan (SSE)", test_meal_plan_sse),
        ("Workout Plan (SSE)", test_workout_plan_sse)
    ]
    
    results = []
    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, success))
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed: {e}")
            results.append((name, False))
        time.sleep(1)  # Small delay between tests
    
    # Summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! The SSE streaming is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Please check the error messages above.")

if __name__ == "__main__":
    main()
