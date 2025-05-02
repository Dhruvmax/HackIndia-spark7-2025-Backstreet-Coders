require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const PYTHON_API_URL = process.env.PYTHON_API_URL;

if (!PYTHON_API_URL) { 
    console.error("FATAL ERROR: PYTHON_API_URL not defined."); 
    process.exit(1); 
}

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// --- In-Memory Storage ---
const interviewSessions = {}; // { sessionId: { role, difficulty, resumeSummary, questions, answers, currentQ, history } }

// --- Resume Upload Handling ---
const uploadDir = path.join(__dirname, 'uploads'); 
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({ 
    destination: (req, file, cb) => cb(null, uploadDir), 
    filename: (req, file, cb) => { 
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9); 
        cb(null, `resume-upload-${unique}${path.extname(file.originalname)}`); 
    } 
});

const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => { 
        if (path.extname(file.originalname).toLowerCase() !== '.pdf') 
            return cb(new Error('Only PDF allowed'), false); 
        cb(null, true); 
    } 
}).single('resume');

// --- API Endpoints ---

// Resume Upload Endpoint
app.post('/api/upload-resume', (req, res) => {
    upload(req, res, async function (multerErr) {
        if (multerErr) { 
            console.error("Multer Error:", multerErr.message); 
            return res.status(multerErr.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
                      .json({ message: multerErr.message }); 
        }
        if (!req.file) { 
            return res.status(400).json({ message: 'No file uploaded.' }); 
        }
        
        console.log(`Resume uploaded: ${req.file.filename}`);
        try {
            const fileBuffer = fs.readFileSync(req.file.path);
            const formData = new FormData();
            formData.append('resume', fileBuffer, { 
                filename: req.file.filename, 
                contentType: req.file.mimetype 
            });
            
            console.log(`Attempting call to Python /process-resume`);
            const processResponse = await axios.post(
                `${PYTHON_API_URL}/process-resume`, 
                formData, 
                { 
                    headers: { ...formData.getHeaders() }, 
                    timeout: 30000 
                }
            );
            
            if (processResponse.data?.summary) {
                fs.unlink(req.file.path, (err) => { 
                    if (err) console.error("Err deleting temp file:", err); 
                });
                
                console.log(`Resume processed OK.`);
                res.status(200).json({ 
                    message: 'Resume processed!', 
                    summary: processResponse.data.summary 
                });
            } else {
                throw new Error(processResponse.data?.error || 'Invalid response from AI service (summary missing).');
            }
        } catch (error) {
            console.error(`*** Resume processing error ***: ${error.message}`);
            if (error.response) console.error(" -> Python Response:", error.response.data);
            
            // Cleanup on error
            if (req.file?.path && fs.existsSync(req.file.path)) {
                fs.unlink(req.file.path, (err) => { 
                    if (err) console.error("Err deleting temp file on error:", err); 
                });
            }
            
            res.status(500).json({ 
                message: error.message || 'Failed to process resume via AI.' 
            });
        }
    });
});

// Start Interview Endpoint
app.post('/api/start-interview', async (req, res) => {
    const { role, difficulty, resumeSummary } = req.body;
    
    if (!role || !difficulty || !resumeSummary) {
        return res.status(400).json({ 
            message: 'Role, difficulty and resume summary are required.' 
        });
    }
    
    const sessionId = crypto.randomUUID();
    interviewSessions[sessionId] = {
        role,
        difficulty,
        resumeSummary,
        questions: [],
        answers: [],
        currentQ: 0,
        history: [],
        totalQuestions: 3 // Default to 3 questions
    };
    
    try {
        // Get first question
        const questionRes = await axios.post(
            `${PYTHON_API_URL}/generate-question`, 
            { 
                role, 
                difficulty, 
                resume_summary: resumeSummary, 
                previous_questions: [], 
                is_first_question: true 
            }, 
            { timeout: 60000 }
        );
        
        const question = questionRes.data?.question;
        if (!question) {
            throw new Error('Failed to generate first question');
        }
        
        interviewSessions[sessionId].questions.push(question);
        
        res.status(200).json({
            sessionId,
            question,
            questionNumber: 1,
            totalQuestions: interviewSessions[sessionId].totalQuestions
        });
    } catch (error) {
        console.error('Error starting interview:', error.message);
        delete interviewSessions[sessionId];
        res.status(500).json({ 
            message: error.message || 'Failed to start interview' 
        });
    }
});

// Submit Answer and Get Next Question
app.post('/api/submit-answer', async (req, res) => {
    const { sessionId, answer } = req.body;
    
    if (!sessionId || !answer) {
        return res.status(400).json({ 
            message: 'Session ID and answer are required.' 
        });
    }
    
    const session = interviewSessions[sessionId];
    if (!session) {
        return res.status(404).json({ 
            message: 'Session not found' 
        });
    }
    
    try {
        // Store answer
        const currentQuestion = session.questions[session.currentQ];
        session.answers.push(answer);
        session.currentQ++;
        
        // Get feedback
        const feedbackRes = await axios.post(
            `${PYTHON_API_URL}/evaluate-response`, 
            { 
                question: currentQuestion, 
                response: answer, 
                role: session.role, 
                difficulty: session.difficulty 
            }, 
            { timeout: 25000 }
        );
        
        const feedback = feedbackRes.data?.feedback || "[No feedback]";
        session.history.push({ 
            q: currentQuestion, 
            a: answer, 
            f: feedback 
        });
        
        // Check if interview is complete
        if (session.currentQ >= session.totalQuestions) {
            // Get final analysis
            const analysisRes = await axios.post(
                `${PYTHON_API_URL}/generate-analysis`, 
                { 
                    role: session.role, 
                    difficulty: session.difficulty, 
                    history: session.history 
                }, 
                { timeout: 60000 }
            );
            
            const analysis = analysisRes.data?.analysis || "[No analysis]";
            
            res.status(200).json({
                feedback,
                analysis,
                interviewComplete: true
            });
            
            // Clean up session
            delete interviewSessions[sessionId];
        } else {
            // Get next question
            const questionRes = await axios.post(
                `${PYTHON_API_URL}/generate-question`, 
                { 
                    role: session.role, 
                    difficulty: session.difficulty, 
                    resume_summary: session.resumeSummary, 
                    previous_questions: session.questions, 
                    is_first_question: false 
                }, 
                { timeout: 60000 }
            );
            
            const nextQuestion = questionRes.data?.question;
            if (!nextQuestion) {
                throw new Error('Failed to generate next question');
            }
            
            session.questions.push(nextQuestion);
            
            res.status(200).json({
                feedback,
                nextQuestion,
                questionNumber: session.currentQ + 1,
                totalQuestions: session.totalQuestions,
                interviewComplete: false
            });
        }
    } catch (error) {
        console.error('Error processing answer:', error.message);
        res.status(500).json({ 
            message: error.message || 'Failed to process answer' 
        });
    }
});

// Feedback Submission
app.post('/api/submit-feedback', (req, res) => {
    const { rating, comments } = req.body;
    if (!rating) { 
        return res.status(400).json({ message: 'Rating required.' }); 
    }
    
    console.log(`Feedback received: R=${rating}, C="${comments}"`);
    // TODO: Store feedback in DB
    
    res.status(200).json({ message: 'Feedback received!' });
});

// Serve Frontend Fallback
app.get('*', (req, res) => { 
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return res.status(404).send('Not Found'); 
    }
    res.sendFile(path.join(__dirname, '../frontend', 'index.html')); 
});

// --- Start Server ---
server.listen(PORT, () => { 
    console.log(`Backend running on http://localhost:${PORT}`); 
    console.log(`Expecting AI at: ${PYTHON_API_URL}`); 
});