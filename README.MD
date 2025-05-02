# AI Mock Interview Platform (Example)

This project demonstrates a basic AI-powered mock interview platform using:

*   **Frontend:** Vanilla HTML, CSS, JavaScript (Web Speech API, WebSockets)
*   **Backend:** Node.js, Express, WebSockets (`ws`), JWT, Multer
*   **AI Service:** Python, Flask, Google Gemini API (`google-generativeai`), PDF Parsing (`PyPDF2`)

**Features:**

*   User Registration/Login (in-memory)
*   PDF Resume Upload & Basic Parsing
*   Selectable Role & Difficulty
*   AI-Generated Questions based on Role/Resume (Intro + Specific)
*   Voice Input (Speech-to-Text via Web Speech API)
*   Voice Output (Text-to-Speech via Web Speech API)
*   Real-time AI Feedback on Answers
*   Duplicate Question Prevention (with retries)
*   Configurable Interview Length (currently 3 questions)
*   Post-Interview Performance Analysis Generation

**Disclaimer:** This is a simplified example. Production systems require databases, robust error handling, enhanced security (password hashing, HTTPS, input validation, etc.), sophisticated resume parsing, potentially fine-tuned models, and better UI/UX. Rate limiting on APIs is also crucial.

## Prerequisites

*   Node.js & npm
*   Python 3 & pip
*   Google Gemini API Key (preferably with access to Gemini 1.5 Pro)
*   A PDF resume file

## Setup

1.  **Clone:** `git clone <repository-url>` & `cd ai-mock-interview`
2.  **Configure AI Service:**
    *   `cd ai_service`
    *   Create `.env` file (see example) with your `GEMINI_API_KEY` and `FLASK_PORT=5001`.
    *   *(Optional: Create/activate Python virtual environment)*
    *   `pip install -r requirements.txt`
3.  **Configure Node.js Backend:**
    *   `cd ../backend`
    *   Create `.env` file (see example) with `PORT=3000`, a strong `JWT_SECRET`, and `PYTHON_API_URL=http://localhost:5001`.
    *   `npm install`

## Running

1.  **Start AI Service:**
    *   In one terminal (in `ai_service` directory): `python app.py`
2.  **Start Backend:**
    *   In a second terminal (in `backend` directory): `npm start` (or `npm run dev`)
3.  **Access Frontend:**
    *   Open browser to `http://localhost:3000` (or backend `PORT`).

## Usage Flow

1.  Register & Login.
2.  Upload PDF resume.
3.  Enter target role & select difficulty.
4.  Click "Start Interview".
5.  Listen to the AI introduction and questions.
6.  Click "Speak Answer" to respond (allow microphone access).
7.  Receive feedback after each answer.
8.  After the final question/feedback, view the generated performance analysis.
9.  The session concludes with prompts for candidate questions and closing remarks.


to run PS C:\Users\dhruv\Downloads\interview\ai_service> python app.py  on terminal 1
to run PS C:\Users\dhruv\Downloads\interview\backend> npm start on terminal 2