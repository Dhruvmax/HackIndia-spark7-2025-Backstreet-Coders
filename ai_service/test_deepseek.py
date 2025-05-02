import os
import json
import requests
from dotenv import load_dotenv

# --- Configuration ---
load_dotenv()
print("Loading environment variables...")
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
print(f"API Key found: {'Yes' if deepseek_api_key else 'No'}")
print(f"API Key length: {len(deepseek_api_key) if deepseek_api_key else 'N/A'}")
print(f"API Key first 5 chars: {deepseek_api_key[:5]}... last 4 chars: ...{deepseek_api_key[-4:]}" if deepseek_api_key else "No API key found")

# DeepSeek API configuration
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
print(f"Using DeepSeek API URL: {DEEPSEEK_API_URL}")
print(f"Using DeepSeek Model: {DEEPSEEK_MODEL}")

def generate_deepseek_content(prompt, temperature=0.7, max_tokens=100):
    """Test function that mimics the one in app.py but with more logging"""
    try:
        print("\n--- Sending Prompt to DeepSeek ---")
        print(f"Prompt: {prompt}")

        messages = [{"role": "user", "content": prompt}]
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {deepseek_api_key}"
        }
        print(f"Using Authorization header: Bearer {deepseek_api_key[:5]}...{deepseek_api_key[-4:]}")
        
        payload = {
            "model": DEEPSEEK_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        print(f"Payload: {json.dumps(payload)}")
        
        print(f"Sending POST request to {DEEPSEEK_API_URL}")
        response = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload)
        print(f"DeepSeek API Status: {response.status_code}")
        print(f"DeepSeek API Response Headers: {dict(response.headers)}")
        print(f"DeepSeek API Response: {response.text}")
        
        if response.status_code != 200:
            print(f"!! WARNING: DeepSeek API error: {response.status_code} - {response.text}")
            return f"[AI_ERROR: API returned status {response.status_code}]"
        
        response_json = response.json()
        print(f"--- DeepSeek Response Received ---")
        
        if "choices" not in response_json or not response_json["choices"]:
            print(f"!! WARNING: DeepSeek response missing choices: {response_json}")
            return "[AI_ERROR: No choices in response]"
        
        generated_text = response_json["choices"][0]["message"]["content"].strip()
        if not generated_text:
            print(f"!! WARNING: DeepSeek responded with empty text")
            return "[AI_EMPTY_RESPONSE]"
        
        print(f"DeepSeek Generated Text: {generated_text}")
        return generated_text
    except Exception as e:
        import traceback
        print(f"!!! EXCEPTION during DeepSeek API call: {e}")
        traceback.print_exc()
        return f"[AI_SERVICE_ERROR: {str(e)}]"

# Run a test query
if __name__ == "__main__":
    test_prompt = "Generate a single interview question for a software developer."
    print("\n=== Testing DeepSeek API with a simple prompt ===")
    result = generate_deepseek_content(test_prompt)
    print("\n=== Test Results ===")
    print(f"Success: {'Yes' if not result.startswith('[AI_ERROR') else 'No'}")
    print(f"Generated text: {result}")