import os
import io
import json
import requests
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import PyPDF2
import traceback

# --- Configuration ---
load_dotenv()
print("Loading environment variables...")
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
print(f"API Key found: {'Yes' if deepseek_api_key else 'No'}")
print(f"API Key length: {len(deepseek_api_key) if deepseek_api_key else 'N/A'}")
print(f"API Key first 5 chars: {deepseek_api_key[:5]}... last 4 chars: ...{deepseek_api_key[-4:]}" if deepseek_api_key else "No API key found")
if not deepseek_api_key:
    raise ValueError("DEEPSEEK_API_KEY environment variable not set.")

# DeepSeek API configuration
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"  # Using the standard chat model
print(f"Using DeepSeek API URL: {DEEPSEEK_API_URL}")
print(f"Using DeepSeek Model: {DEEPSEEK_MODEL}")

flask_port = os.getenv("FLASK_PORT", 5001)
app = Flask(__name__)

# --- Helper Functions ---
def extract_text_from_pdf(file_bytes):
    """Extracts text from PDF file bytes."""
    try:
        pdf_file = io.BytesIO(file_bytes); reader = PyPDF2.PdfReader(pdf_file); text = ""
        for page in reader.pages: 
            page_text = page.extract_text()
            if page_text: text += page_text + "\n"
        summary = (text[:1500] + '...') if len(text) > 1500 else text
        if text and not summary: summary = text # Handle very short PDFs
        # print(f"Extracted text length: {len(text)}, Summary length: {len(summary)}") # Optional debug log
        return {"summary": summary, "full_text": text}
    except Exception as e: print(f"!!! PDF Extract Error: {e}"); traceback.print_exc(); return {"summary": "Could not parse resume.", "full_text": ""}

def generate_deepseek_content(prompt, is_analysis=False, temperature=0.7, max_tokens=4000):
    try:
        print("\n--- Sending Prompt to DeepSeek (start) ---")
        print(prompt[:600] + ("..." if len(prompt) > 600 else ""))
        print("--- (End of DeepSeek Prompt Snippet) ---\n")

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
        print(f"Payload: {json.dumps(payload)[:200]}...")
        
        print(f"Sending POST request to {DEEPSEEK_API_URL}")
        response = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload)
        print(f"DeepSeek API Status: {response.status_code}")
        print(f"DeepSeek API Response Headers: {dict(response.headers)}")
        print(f"DeepSeek API Response: {response.text[:500]}...")  # Limit for brevity
        
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
        
        print(f"   DeepSeek Generated Text (start): {generated_text[:100]}...")
        return generated_text
    except Exception as e:
        print(f"!!! EXCEPTION during DeepSeek API call: {e}")
        traceback.print_exc()
        error_type = type(e).__name__
        error_details = str(e)
        print(f"    Error Details: {error_details}")
        return f"[AI_SERVICE_ERROR: {error_type} - {error_details[:100]}]"
    
# --- API Endpoints ---
@app.route('/process-resume', methods=['POST'])
def process_resume():
    """ Receives PDF file bytes, extracts text, returns summary. """
    print("--- /process-resume ---")
    if 'resume' not in request.files: return jsonify({"error": "No resume file part"}), 400
    file = request.files['resume']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    if file and file.filename.lower().endswith('.pdf'):
        try:
            file_bytes = file.read(); resume_data = extract_text_from_pdf(file_bytes)
            if resume_data.get("summary", "").startswith("Could not parse"): return jsonify({"error": "Failed to parse PDF content."}), 500
            if not resume_data.get("summary") and not resume_data.get("full_text"): resume_data["summary"] = "(Resume empty/unreadable)"
            print("--- /process-resume: OK ---")
            return jsonify(resume_data)
        except Exception as e: print(f"!!! /process-resume Error: {e}"); traceback.print_exc(); return jsonify({"error": f"Could not process file: {e}"}), 500
    else: return jsonify({"error": "Invalid file type"}), 400

@app.route('/generate-question', methods=['POST'])
def get_question():
    """Generates an interview question using DeepSeek, avoiding previous ones."""
    data = request.json
    role = data.get('role', 'candidate')
    difficulty = data.get('difficulty', 'medium')
    resume_summary = data.get('resume_summary', 'No resume provided.')
    previous_questions = data.get('previous_questions', [])
    is_first_question = data.get('is_first_question', False)
    max_questions = data.get('max_questions', 0)  # New parameter for question limit
    current_question_num = len(previous_questions) + 1
    
    print(f"\n--- /generate-question (First: {is_first_question}, Question #{current_question_num}) ---")
    
    # Check if we've reached the maximum number of questions
    if max_questions > 0 and current_question_num > max_questions:
        print(f"   Maximum questions ({max_questions}) reached.")
        return jsonify({
            "question": "Interview complete. Thank you for your time.",
            "interview_complete": True
        })
    
    difficulty_map = {
        "easy": "introductory concepts/behavioral", 
        "medium": "scenario-based/technical", 
        "hard": "complex design/strategic"
    }
    
    if previous_questions: 
        previous_questions_formatted = "\n".join(f"- \"{q}\"" for q in previous_questions)
    else: 
        previous_questions_formatted = "None"
    
    prompt_lines = [
        f"You are an expert interviewer for a {role} ({difficulty} level).", 
        "\nResume Summary:", 
        f"\"\"\"\n{resume_summary}\n\"\"\"", 
        f"\nInterview Difficulty: {difficulty} (focus on: {difficulty_map.get(difficulty, 'standard topics')})"
    ]
    
    if is_first_question: 
        prompt_lines.extend([
            "\n**INSTRUCTION:** This is the **first question**.", 
            f"Ask a common introductory background question suitable for a {role}.", 
            "Examples: 'Tell me about yourself...' or 'Walk me through resume...'", 
            "Adapt slightly."
        ])
    else: 
        prompt_lines.extend([
            "\n**CRITICAL INSTRUCTION:** Generate ONE SINGLE **NEW** question, DIFFERENT from below.", 
            f"\n**Previously Asked:**\n{previous_questions_formatted}", 
            "\n**Requirements:**", 
            "1. Relevant to the role", 
            "2. Use Resume information if applicable", 
            "3. Unique from previous questions", 
            "4. Type appropriate for difficulty level", 
            "5. Vary question style"
        ])
    
    prompt_lines.extend([
        "\n**Output Format:**", 
        "ONLY the question text. No introductions or markdown."
    ])
    
    prompt = "\n".join(prompt_lines)
    print("   Attempting to generate question from DeepSeek...")
    question = generate_deepseek_content(prompt)
    print(f"   Question generation finished. Result (start): {question[:100]}...")
    
    if not question: 
        question = "[AI_GENERATION_FAILED: Empty]"
    
    response_data = {
        "question": question,
        "interview_complete": False
    }
    
    # If this is the last question, mark it
    if max_questions > 0 and current_question_num == max_questions:
        response_data["is_last_question"] = True
    
    print(f"--- /generate-question: Sending response ---")
    return jsonify(response_data)

@app.route('/evaluate-response', methods=['POST'])
def evaluate():
    """Evaluates a candidate's response using DeepSeek."""
    data = request.json
    question = data.get('question')
    response_text = data.get('response')
    role = data.get('role')
    difficulty = data.get('difficulty')
    
    print(f"\n--- /evaluate-response ---")
    
    if not question or not response_text: 
        print("   Error: Missing question or response")
        return jsonify({"error": "Missing question or response"}), 400
    
    prompt = f"""Act as helpful coach. Context: {difficulty} {role}. Q: "{question}" A: "{response_text}" Instruct: Brief (2-4 sentences) constructive feedback... Output: ONLY feedback text."""
    
    print("   Attempting to generate feedback from DeepSeek...")
    feedback = generate_deepseek_content(prompt)
    print(f"   Feedback generation finished. Result (start): {feedback[:100]}...")
    
    if not feedback: 
        feedback = "[AI_FEEDBACK_FAILED: Empty]"
    
    print(f"--- /evaluate-response: Sending response ---")
    return jsonify({"feedback": feedback})

@app.route('/generate-analysis', methods=['POST'])
def get_analysis():
    """Generates a detailed post-interview analysis based on the interaction history."""
    data = request.json
    role = data.get('role', 'candidate')
    difficulty = data.get('difficulty', 'medium')
    history = data.get('history', [])
    
    print(f"\n--- /generate-analysis ---")
    
    if not history: 
        print("   Error: History missing")
        return jsonify({"error": "History missing."}), 400
    
    transcript = ""
    for i, entry in enumerate(history): 
        transcript += f"**Q{i+1}:** {entry.get('q', 'N/A')}\n**A:** {entry.get('a', 'N/A')}\n**F:** {entry.get('f', 'N/A')}\n\n"
    
    prompt = f"""Analyze mock interview. Context: {role} ({difficulty}). Transcript: --- START --- {transcript} --- END --- Task: Based *only* on transcript, provide structured analysis (Markdown). --- START ANALYSIS --- ### 1. Checklist A.Tech... B.Behavioral... C.Cultural Fit... ### 2. Metrics (1-5/NA) Tech:[...] PS:[...] Comm:[...] Conf:[...] Init:[...] ### 3. Strengths/Weaknesses S:[List] W:[List] ### 4. Overall/Recommend Sum:[...] Rec:[...] --- END ANALYSIS --- IMPORTANT: Use *only* transcript. Objective. Markdown."""
    
    print("   Attempting to generate analysis from DeepSeek...")
    analysis_text = generate_deepseek_content(prompt, is_analysis=True)
    print(f"   Analysis generation finished. Result (start): {analysis_text[:100]}...")
    
    if analysis_text.startswith("[AI_"): 
        print(f"   Analysis failed: {analysis_text}")
        return jsonify({"error": f"Failed to generate analysis: {analysis_text}"}), 500
    
    try: # Extract content
        start_marker = "--- START ANALYSIS ---"
        end_marker = "--- END ANALYSIS ---"
        start_index = analysis_text.find(start_marker)
        end_index = analysis_text.find(end_marker)
        
        if start_index != -1 and end_index != -1 and start_index < end_index:
             extracted_analysis = analysis_text[start_index + len(start_marker):end_index].strip()
             if extracted_analysis: 
                 analysis_text = extracted_analysis
                 print("   Successfully extracted analysis between markers.")
             else: 
                 print("   Warn: Analysis markers found but content empty.")
        else: 
            print("   Warn: Analysis markers not found.")
    except Exception as parse_err: 
        print(f"   Warn: Error parsing markers: {parse_err}")
    
    print(f"--- /generate-analysis: Sending response ---")
    return jsonify({"analysis": analysis_text})

# --- Run Flask App ---
if __name__ == '__main__':
    print(f"Starting AI Service on port {flask_port}...")
    # Set debug=False for production/stability
    app.run(host='0.0.0.0', port=int(flask_port), debug=False)
