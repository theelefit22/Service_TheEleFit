#!/usr/bin/env python3
"""
Simple test script to verify backend is running and accessible
"""

import requests
import json

BASE_URL = "http://localhost:5000"

def test_server_running():
    """Test if server is running"""
    print("Testing server connectivity...")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print(f"✓ Server is running: {response.text}")
            return True
        else:
            print(f"✗ Server returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to server at http://localhost:5000")
        print("Make sure the Flask server is running: python new-app.py")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_cors_headers():
    """Test CORS headers"""
    print("\nTesting CORS headers...")
    try:
        response = requests.options(
            f"{BASE_URL}/calculate-calories",
            headers={
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        )
        
        headers = response.headers
        print(f"CORS Headers received:")
        print(f"  Access-Control-Allow-Origin: {headers.get('Access-Control-Allow-Origin', 'NOT SET')}")
        print(f"  Access-Control-Allow-Methods: {headers.get('Access-Control-Allow-Methods', 'NOT SET')}")
        print(f"  Access-Control-Allow-Headers: {headers.get('Access-Control-Allow-Headers', 'NOT SET')}")
        
        if headers.get('Access-Control-Allow-Origin'):
            print("✓ CORS headers are configured")
            return True
        else:
            print("✗ CORS headers missing")
            return False
    except Exception as e:
        print(f"✗ Error testing CORS: {e}")
        return False

def test_calculate_calories():
    """Test calorie calculation endpoint"""
    print("\nTesting /calculate-calories endpoint...")
    try:
        response = requests.post(
            f"{BASE_URL}/calculate-calories",
            json={
                "age": 30,
                "weight": 70,
                "height": 175,
                "gender": "male",
                "activityLevel": "moderate",
                "targetWeight": 65,
                "timeline": 12
            },
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Endpoint working")
            print(f"  Target calories: {data.get('targetCalories', 'N/A')}")
            return True
        else:
            print(f"✗ Failed with status {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def main():
    print("=" * 50)
    print("Backend Connectivity Test")
    print("=" * 50)
    
    # Run tests
    server_ok = test_server_running()
    
    if server_ok:
        cors_ok = test_cors_headers()
        calories_ok = test_calculate_calories()
        
        print("\n" + "=" * 50)
        if server_ok and cors_ok and calories_ok:
            print("✓ All tests passed! Backend is ready.")
        else:
            print("✗ Some tests failed. Check the errors above.")
    else:
        print("\n" + "=" * 50)
        print("✗ Server is not running. Start it with: python new-app.py")
    
    print("=" * 50)

if __name__ == "__main__":
    main()
