import os
import sys
from dotenv import load_dotenv

def check_env():
    """Check environment variables before and after loading .env file"""
    print("=== Environment Check ===")
    
    # Check Python version and environment
    print(f"Python version: {sys.version}")
    print(f"Current working directory: {os.getcwd()}")
    
    # Check for .env file
    env_file_path = os.path.join(os.getcwd(), '.env')
    print(f".env file exists: {os.path.exists(env_file_path)}")
    
    # Check DEEPSEEK_API_KEY before loading .env
    api_key_before = os.getenv("DEEPSEEK_API_KEY")
    print(f"API Key before load_dotenv(): {'Found' if api_key_before else 'Not found'}")
    
    # Load .env file
    load_dotenv()
    print("Loaded .env file")
    
    # Check DEEPSEEK_API_KEY after loading .env
    api_key_after = os.getenv("DEEPSEEK_API_KEY")
    print(f"API Key after load_dotenv(): {'Found' if api_key_after else 'Not found'}")
    if api_key_after:
        print(f"API Key length: {len(api_key_after)}")
        print(f"API Key first 5 chars: {api_key_after[:5]}... last 4 chars: ...{api_key_after[-4:]}")
    
    # List all environment variables (optional, may contain sensitive info)
    # print("\nAll environment variables:")
    # for key, value in os.environ.items():
    #     print(f"{key}: {'*' * min(len(value), 10)}")

if __name__ == "__main__":
    check_env()