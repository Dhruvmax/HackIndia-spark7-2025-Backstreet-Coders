// --- DOM Elements ---
const setupSection = document.getElementById('setup-section');
const interviewSection = document.getElementById('interview-section');
const analysisSection = document.getElementById('analysis-section');
const resumeFileInput = document.getElementById('resume-file');
const uploadResumeBtn = document.getElementById('upload-resume-btn');
const uploadStatus = document.getElementById('upload-status');
const resumeSummaryContainer = document.getElementById('resume-summary-container');
const resumeSummaryEl = document.getElementById('resume-summary');
const roleInput = document.getElementById('role');
const difficultySelect = document.getElementById('difficulty');
const startInterviewBtn = document.getElementById('start-interview-btn');
const setupErrorEl = document.getElementById('setup-error');
const interviewProgress = document.getElementById('interview-progress');
const chatOutput = document.getElementById('chat-output');
const speakBtn = document.getElementById('speak-btn');
const speechStatus = document.getElementById('speech-status');
const sessionStatus = document.getElementById('session-status');
const analysisContent = document.getElementById('analysis-content');
const downloadAnalysisBtn = document.getElementById('download-analysis-btn');
const feedbackStatus = document.getElementById('feedback-status');
const submitFeedbackBtn = document.getElementById('submit-feedback-btn');
const startNewInterviewBtn = document.getElementById('start-new-interview-btn');

// --- State ---
let recognition = null;
let isListening = false;
let resumeUploaded = false;
let currentResumeSummary = "";
let currentAnalysisText = "";
let currentSessionId = null;

// --- API URLs ---
const API_BASE_URL = window.location.origin;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupSpeechRecognition();
    showView('setup-section');
    
    // Event Listeners
    uploadResumeBtn.addEventListener('click', handleResumeUpload);
    startInterviewBtn.addEventListener('click', startInterview);
    speakBtn.addEventListener('click', handleSpeakButtonClick);
    downloadAnalysisBtn.addEventListener('click', handleDownloadAnalysis);
    submitFeedbackBtn.addEventListener('click', handleSubmitFeedback);
    startNewInterviewBtn.addEventListener('click', showSetupView);
    roleInput.addEventListener('input', checkCanStartInterview);
    
    resumeFileInput.addEventListener('change', () => { 
        resumeUploaded = false; 
        currentResumeSummary = ""; 
        resumeSummaryContainer.style.display = 'none'; 
        uploadStatus.textContent = ''; 
        checkCanStartInterview(); 
    });
});

// --- View Management ---
function showView(viewId) { 
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none'); 
    const v = document.getElementById(viewId); 
    if (v) v.style.display = 'block'; 
    else console.error(`View ${viewId} not found.`); 
}

function showSetupView() {
    showView('setup-section');
    chatOutput.innerHTML = ''; 
    analysisContent.innerHTML = '<p class="status">No analysis.</p>';
    currentAnalysisText = ""; 
    currentResumeSummary = ""; 
    downloadAnalysisBtn.disabled = true;
    resumeUploaded = false; 
    resumeSummaryContainer.style.display = 'none'; 
    resumeFileInput.value = '';
    roleInput.value = ''; 
    updateStatus(sessionStatus, ''); 
    updateStatus(speechStatus, 'Ready for setup.');
    updateStatus(uploadStatus, ''); 
    updateStatus(setupErrorEl, ''); 
    interviewProgress.textContent = '';
    const ratingInputs = document.querySelectorAll('input[name="rating"]'); 
    ratingInputs.forEach(input => input.checked = false);
    const commentsInput = document.getElementById('comments'); 
    if(commentsInput) commentsInput.value = '';
    feedbackStatus.textContent = ''; 
    submitFeedbackBtn.disabled = false;
    checkCanStartInterview();
}

// --- Check if Interview Can Start ---
function checkCanStartInterview() {
    const roleFilled = roleInput.value.trim() !== '';
    startInterviewBtn.disabled = !(roleFilled && resumeUploaded && currentResumeSummary);
    
    if (!resumeUploaded || !currentResumeSummary) { 
        updateStatus(setupErrorEl, 'Upload & process resume first.', false); 
    }
    else if (!roleFilled) { 
        updateStatus(setupErrorEl, 'Enter target role.', false); 
    }
    else { 
        updateStatus(setupErrorEl, ''); 
    }
}

// --- Resume Upload ---
async function handleResumeUpload(event) {
    event.preventDefault();
    const file = resumeFileInput.files[0];
    if (!file) { 
        updateStatus(uploadStatus, 'Select PDF file.', true); 
        return; 
    }
    if (file.type !== 'application/pdf') { 
        updateStatus(uploadStatus, 'Only PDF allowed.', true); 
        return; 
    }
    
    const formData = new FormData(); 
    formData.append('resume', file);
    
    updateStatus(uploadStatus, 'Uploading & Processing...'); 
    uploadResumeBtn.disabled = true; 
    startInterviewBtn.disabled = true;
    resumeUploaded = false; 
    currentResumeSummary = ""; 
    resumeSummaryContainer.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/upload-resume`, { 
            method: 'POST', 
            body: formData 
        });
        
        const data = await response.json();
        if (!response.ok) { 
            throw new Error(data.message || `Upload failed (${response.status})`); 
        }
        
        updateStatus(uploadStatus, data.message);
        currentResumeSummary = data.summary;
        console.log("Stored resume summary:", currentResumeSummary ? currentResumeSummary.substring(0, 50) + "..." : "EMPTY/NULL");
        resumeSummaryEl.textContent = currentResumeSummary;
        resumeSummaryContainer.style.display = 'block';
        resumeUploaded = true;
    } catch (error) {
        updateStatus(uploadStatus, `Upload failed: ${error.message}`, true); 
        console.error('Resume upload error:', error);
        resumeUploaded = false; 
        currentResumeSummary = ""; 
        resumeSummaryContainer.style.display = 'none';
    } finally {
        uploadResumeBtn.disabled = false; 
        resumeFileInput.value = ''; 
        checkCanStartInterview();
    }
}

// --- Interview Flow ---
async function startInterview() {
    startInterviewBtn.disabled = true;
    
    if (!resumeUploaded || !currentResumeSummary) { 
        updateStatus(setupErrorEl, 'Process resume.', true); 
        checkCanStartInterview(); 
        return; 
    }
    
    const role = roleInput.value.trim(); 
    const difficulty = difficultySelect.value;
    
    if (!role) { 
        updateStatus(setupErrorEl, 'Specify role.', true); 
        checkCanStartInterview(); 
        return; 
    }
    
    chatOutput.innerHTML = ''; 
    updateStatus(sessionStatus, 'Starting...'); 
    updateStatus(setupErrorEl, '');
    interviewProgress.textContent = 'Starting...'; 
    currentAnalysisText = "";
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/start-interview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role,
                difficulty,
                resumeSummary: currentResumeSummary
            })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to start interview');
        }
        
        currentSessionId = data.sessionId;
        showView('interview-section');
        speakBtn.disabled = false;
        
        // Display intro message
        displayMessage('AI', `Hello! This mock interview for the ${role} role will consist of ${data.totalQuestions} questions. Let's begin.`, 'ai-message');
        
        // Display first question
        setTimeout(() => {
            displayMessage('AI', data.question, 'ai-message');
            speak(data.question);
            updateStatus(speechStatus, 'Your turn. Click the mic to answer.');
            interviewProgress.textContent = `Question ${data.questionNumber} / ${data.totalQuestions}`;
        }, 1500);
        
    } catch (error) {
        updateStatus(setupErrorEl, `Failed to start interview: ${error.message}`, true);
        console.error('Interview start error:', error);
        startInterviewBtn.disabled = false;
    }
}

async function submitAnswer(answer) {
    if (!currentSessionId || !answer) return;
    
    updateStatus(speechStatus, 'Processing your answer...');
    speakBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/submit-answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: currentSessionId,
                answer: answer
            })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to submit answer');
        }
        
        // Display feedback
        displayMessage('AI Coach', data.feedback, 'ai-feedback');
        speak(data.feedback);
        
        if (data.interviewComplete) {
            // Interview complete
            updateStatus(sessionStatus, 'Complete! View analysis & provide feedback.');
            speakBtn.disabled = true;
            interviewProgress.textContent = "Finished";
            
            // Display analysis
            currentAnalysisText = data.analysis;
            displayAnalysis(data.analysis);
            showView('analysis-section');
        } else {
            // Next question
            setTimeout(() => {
                displayMessage('AI', data.nextQuestion, 'ai-message');
                speak(data.nextQuestion);
                updateStatus(speechStatus, 'Your turn. Click the mic to answer.');
                interviewProgress.textContent = `Question ${data.questionNumber} / ${data.totalQuestions}`;
                speakBtn.disabled = false;
            }, 1000);
        }
    } catch (error) {
        updateStatus(sessionStatus, `Error: ${error.message}`, true);
        console.error('Answer submission error:', error);
        speakBtn.disabled = true;
    }
}

// --- Speech Recognition ---
function setupSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) { 
        updateStatus(speechStatus, 'Speech Recognition not supported.', true); 
        if(speakBtn) speakBtn.disabled = true; 
        return; 
    }
    
    recognition = new SpeechRecognition(); 
    recognition.continuous = false; 
    recognition.lang = 'en-US'; 
    recognition.interimResults = false; 
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => { 
        isListening = true; 
        updateStatus(speechStatus, 'Listening... Speak clearly.'); 
        speakBtn.querySelector('.btn-text').textContent = 'Stop Listening'; 
        speakBtn.classList.add('listening'); 
    };
    
    recognition.onresult = (event) => { 
        const transcript = event.results[event.results.length - 1][0].transcript.trim(); 
        console.log('Transcript:', transcript); 
        displayMessage('You', transcript, 'user-message'); 
        submitAnswer(transcript);
    };
    
    recognition.onerror = (event) => { 
        console.error('Speech error:', event.error, event.message); 
        let msg = `Speech error: ${event.error}.`; 
        if (event.error === 'not-allowed') msg = 'Mic permission denied.'; 
        else if (event.error === 'no-speech') msg = 'No speech detected.'; 
        updateStatus(speechStatus, msg, true); 
        isListening = false; 
        speakBtn.querySelector('.btn-text').textContent = 'Speak Answer'; 
        speakBtn.classList.remove('listening'); 
        if(speakBtn) speakBtn.disabled = false; 
    };
    
    recognition.onend = () => { 
        isListening = false; 
        speakBtn.querySelector('.btn-text').textContent = 'Speak Answer'; 
        speakBtn.classList.remove('listening'); 
        if (speechStatus.textContent === 'Listening... Speak clearly.') { 
            updateStatus(speechStatus, 'Stopped listening.'); 
            if(speakBtn) speakBtn.disabled = false; 
        } 
    };
    
    if(speakBtn) speakBtn.innerHTML = '<i class="fas fa-microphone"></i> <span class="btn-text">Speak Answer</span>';
}

function handleSpeakButtonClick() { 
    if (!recognition) return; 
    if (isListening) { 
        try { recognition.stop(); } catch (e) {} 
    } else { 
        try { recognition.start(); } catch (error) { 
            updateStatus(speechStatus, "Mic start error.", true); 
            if(speakBtn) speakBtn.disabled = false; 
        } 
    } 
}

// --- Text-to-Speech ---
function speak(text) { 
    if ('speechSynthesis' in window) { 
        try { 
            speechSynthesis.cancel(); 
            const utt = new SpeechSynthesisUtterance(text); 
            utt.lang = 'en-US'; 
            utt.onerror = (e) => { console.error("TTS error:", e.error); }; 
            speechSynthesis.speak(utt); 
        } catch (e) { console.error("TTS init error:", e); } 
    } else { 
        console.warn('TTS not supported.'); 
    } 
}

// --- UI Updates ---
function updateStatus(element, message, isError = false, append = false) { 
    if (!element) return; 
    if (append && element.textContent && !element.classList.contains('error-message')) { 
        element.textContent += ` ${message}`; 
    } else { 
        element.textContent = message; 
    } 
    element.classList.toggle('error-message', isError); 
}

function displayMessage(sender, text, className) { 
    const el = document.createElement('p'); 
    const safeSender = sender.replace(/</g, "&lt;"); 
    const safeText = text.replace(/</g, "&lt;"); 
    el.innerHTML = `<strong>${safeSender}:</strong> ${safeText}`; 
    if (className) el.classList.add(className); 
    chatOutput.appendChild(el); 
    chatOutput.scrollTop = chatOutput.scrollHeight; 
}

function displayAnalysis(markdownText) { 
    currentAnalysisText = markdownText; 
    const container = document.getElementById('analysis-content'); 
    if (container) renderMarkdown(container, markdownText); 
    const chatEl = document.createElement('div'); 
    chatEl.classList.add('analysis-message'); 
    renderMarkdown(chatEl, markdownText); 
    chatOutput.appendChild(chatEl); 
    chatOutput.scrollTop = chatOutput.scrollHeight; 
    downloadAnalysisBtn.disabled = false; 
}

// Simple Markdown to HTML Renderer
function renderMarkdown(container, markdown) { 
    if (!container) return; 
    let safe = markdown.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    safe = safe.replace(/^### (.*$)/gim, '<h3>$1</h3>'); 
    safe = safe.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>'); 
    safe = safe.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>'); 
    safe = safe.replace(/(<li>.*?<\/li>\s*)+/gim, (match) => `<ul>${match.replace(/<br>\s*<\/li>/g, '</li>').replace(/<li><br>/g, '<li>')}</ul>`); 
    safe = safe.replace(/\n/g, '<br>'); 
    safe = safe.replace(/<ul><br>/gim, '<ul>').replace(/<br><\/ul>/gim, '</ul>'); 
    safe = safe.replace(/<h3><br>/gim, '<h3>').replace(/<br><\/h3>/gim, '</h3>'); 
    container.innerHTML = safe; 
}

// --- Analysis Download ---
function handleDownloadAnalysis() { 
    if (!currentAnalysisText) return; 
    const blob = new Blob([currentAnalysisText], { type: 'text/markdown;charset=utf-8' }); 
    const link = document.createElement('a'); 
    const url = URL.createObjectURL(blob); 
    link.href = url; 
    link.download = 'interview-analysis.md'; 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
    URL.revokeObjectURL(url); 
}

// --- User Feedback Submission ---
async function handleSubmitFeedback() { 
    const ratingEl = document.querySelector('input[name="rating"]:checked'); 
    const commentsEl = document.getElementById('comments'); 
    const rating = ratingEl ? ratingEl.value : null; 
    const comments = commentsEl ? commentsEl.value.trim() : ''; 
    
    if (!rating) { 
        updateStatus(feedbackStatus, 'Select rating.', true); 
        return; 
    } 
    
    updateStatus(feedbackStatus, 'Submitting...'); 
    submitFeedbackBtn.disabled = true; 
    
    try { 
        const response = await fetch(`${API_BASE_URL}/api/submit-feedback`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ rating, comments }), 
        }); 
        
        const data = await response.json(); 
        if (!response.ok) throw new Error(data.message || 'Submit failed'); 
        
        updateStatus(feedbackStatus, 'Thank you!'); 
        document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false); 
        commentsEl.value = ''; 
    } catch (error) { 
        updateStatus(feedbackStatus, `Feedback error: ${error.message}`, true); 
        submitFeedbackBtn.disabled = false; 
        console.error("Feedback error:", error); 
    } 
}