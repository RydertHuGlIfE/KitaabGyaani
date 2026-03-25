from flask import Flask, send_from_directory, request, send_file, session, redirect, url_for, jsonify, Response, render_template
import os
from dotenv import load_dotenv
load_dotenv()  # Load .env file

import google.generativeai as genai
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
import webbrowser
import json 
import random
import time
import requests
import PyPDF2
import base64
import uuid
from io import BytesIO
from flask_socketio import SocketIO, emit, join_room, leave_room

# Serve React build from frontend/dist
REACT_BUILD = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')
app = Flask(__name__, static_folder=REACT_BUILD, static_url_path='')

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 
ALLOWED_EXTENSIONS = {'pdf'}
app.secret_key = "nullisgreat"   

# SocketIO for real-time collaborative sessions
socketio = SocketIO(app, cors_allowed_origins="*")

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-flash-lite-latest", generation_config={
    "temperature": 0.7,
    "max_output_tokens": 20480
})

# In-memory storage - no files saved to disk (Vercel compatible)
uploaded_pdf_text = {}  # Store extracted text
uploaded_pdf_data = {}  # Store PDF bytes for viewer

# Collaborative sessions storage
# sessions[sessionId] = {
#     'pdf_filename': str,
#     'pdf_data': bytes,
#     'pdf_text': str,
#     'annotations': [],
#     'chat_messages': [],
#     'connected_users': 0
# }
collab_sessions = {}

# ── React SPA routes ──────────────────────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    # Let API routes pass through (they are defined below and take priority)
    full = os.path.join(REACT_BUILD, path)
    if path and os.path.exists(full):
        response = send_from_directory(REACT_BUILD, path)
    else:
        response = send_from_directory(REACT_BUILD, 'index.html')
    
    # Disable caching for React build files so updates are seen immediately
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/viewer')
def viewer():
    if 'pdf_filename' not in session:
        return redirect(url_for('index'))
    return render_template("viewer.html")

@app.route('/get-pdf-info')
def get_pdf_info():
    filename = session.get('pdf_filename')
    multi_filenames = session.get('multi_pdf_filenames', [])
    if not filename and not multi_filenames:
        return jsonify({"error": "No PDF loaded"}), 400
    return jsonify({
        "filename": filename,
        "multi_pdf_filenames": multi_filenames
    })


@app.route('/upload-pdf', methods=['POST'])
def upload_pdf():
    try:
        if 'pdf_file' not in request.files:
            return jsonify({"error": "No file selected"}), 400
        
        file = request.files['pdf_file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type. Please upload a PDF file."}), 400
            
        filename = secure_filename(file.filename)
        
        # Read PDF into memory (no disk write - Vercel compatible!)
        pdf_bytes = file.read()
        
        # Store PDF bytes for viewer
        uploaded_pdf_data[filename] = pdf_bytes
        
        # Extract text using PyPDF2 from memory
        print(f"Extracting text from {filename} using PyPDF2 (in-memory)...")
        pdf_text = ""
        try:
            pdf_file_obj = BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file_obj)
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    pdf_text += page_text + "\n"
        except Exception as e:
            return jsonify({"error": f"Failed to read PDF: {str(e)}"}), 400
        
        if not pdf_text.strip():
            return jsonify({"error": "Could not extract text from PDF. The file might be scanned or image-based."}), 400
        
        # Store the extracted text
        uploaded_pdf_text[filename] = pdf_text
        session['pdf_filename'] = filename
        
        print(f"PDF text extracted successfully: {len(pdf_text)} characters (in-memory)")
        
        return jsonify({
            "success": True,
            "filename": filename,
            "message": "PDF uploaded and text extracted successfully",
            "text_length": len(pdf_text)
        })
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


@app.route('/upload-multiple-pdfs', methods=['POST'])
def upload_multiple_pdfs():
    """Upload up to 5 PDFs at once for combined analysis."""
    try:
        files = request.files.getlist('pdf_files')
        if not files or all(f.filename == '' for f in files):
            return jsonify({"error": "No files selected"}), 400

        MAX_FILES = 5
        if len(files) > MAX_FILES:
            return jsonify({"error": f"Maximum {MAX_FILES} PDFs allowed at once."}), 400

        uploaded = []
        filenames = []

        for file in files:
            if file.filename == '':
                continue
            if not allowed_file(file.filename):
                return jsonify({"error": f"'{file.filename}' is not a PDF."}), 400

            filename = secure_filename(file.filename)
            pdf_bytes = file.read()

            # Store bytes for viewer
            uploaded_pdf_data[filename] = pdf_bytes

            # Extract text in-memory
            pdf_text = ""
            try:
                pdf_file_obj = BytesIO(pdf_bytes)
                pdf_reader = PyPDF2.PdfReader(pdf_file_obj)
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        pdf_text += page_text + "\n"
            except Exception as e:
                return jsonify({"error": f"Failed to read '{filename}': {str(e)}"}), 400

            if not pdf_text.strip():
                return jsonify({"error": f"Could not extract text from '{filename}'. It may be scanned."}), 400

            uploaded_pdf_text[filename] = pdf_text
            filenames.append(filename)
            uploaded.append({"filename": filename, "text_length": len(pdf_text)})
            print(f"Multi-upload: extracted {len(pdf_text)} chars from {filename}")

        if not filenames:
            return jsonify({"error": "No valid PDFs were processed."}), 400

        # Store multi-pdf list in session; also set the first as the "active" single PDF
        session['multi_pdf_filenames'] = filenames
        session['pdf_filename'] = filenames[0]  # so single-PDF features still work on first file


        return jsonify({
            "success": True,
            "files": uploaded,
            "message": f"{len(filenames)} PDF(s) uploaded successfully."
        })

    except Exception as e:
        print(f"Multi-upload error: {str(e)}")
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


def get_combined_pdf_content(limit=60000):
    """Aggregates text from all uploaded PDFs in the session."""
    filenames = session.get('multi_pdf_filenames', [])
    if not filenames:
        single = session.get('pdf_filename', '')
        filenames = [single] if single else []

    if not filenames:
        return None, 0

    combined_sections = []
    total_chars = 0
    per_file_limit = limit // max(1, len(filenames))

    for fname in filenames:
        text = uploaded_pdf_text.get(fname, '')
        if not text: continue
        
        chunk = text[:per_file_limit]
        combined_sections.append(f"--- DOCUMENT: {fname} ---\n{chunk}")
        total_chars += len(chunk)
        if total_chars >= limit: break
        
    return "\n\n".join(combined_sections), len(filenames)


@app.route('/pdf/<filename>')
def serve_pdf(filename):
    # Serve PDF from memory (no disk read - Vercel compatible!)
    pdf_bytes = uploaded_pdf_data.get(filename)
    if pdf_bytes:
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={'Content-Disposition': f'inline; filename={filename}'}
        )
    return jsonify({"error": "PDF not found"}), 404

@app.route('/switch-pdf', methods=['POST'])
def switch_pdf():
    data = request.get_json()
    filename = data.get('filename')
    if not filename:
        return jsonify({"error": "No filename provided"}), 400
    
    if filename not in uploaded_pdf_text:
        return jsonify({"error": "PDF not found in current session"}), 404
        
    session['pdf_filename'] = filename
    return jsonify({"success": True})

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '')
    
    pdf_content, doc_count = get_combined_pdf_content()
    if not pdf_content:
        return jsonify({"error": "No PDF content found. Please re-upload."}), 400

    prompt = f"""
You are a helpful AI assistant. Answer questions based on the provided PDF content.
The user has uploaded {doc_count} document(s). Analyze them comprehensively.

PDF CONTENT:
{pdf_content}

IMPORTANT OUTPUT RULES:
- Output valid HTML only (no Markdown, no backslash).
- Do NOT use ``` or mention 'html'.
- Use <h3> for titles, <ol><li> for lists, <strong> for bold, <p> for paragraphs.
- If multiple documents are present, specify which document you are referring to when answering.
- Answer as concisely as possible.

USER QUESTION:
{user_message}"""

    if user_message.startswith("search youtube for:"):
        topic = user_message.replace("search youtube for:", "").strip()
        search_url = f"https://www.youtube.com/results?search_query={topic.replace(' ', '+')}"
        webbrowser.open(search_url)
        return jsonify({"response": f"<p>Opened YouTube search for <strong>{topic}</strong> in your browser! 🎥</p>", "is_html": True})

    try:
        response = model.generate_content(prompt)
        if not response.candidates:
            return jsonify({"error": "AI failed to generate a response (empty candidates)."}), 500
            
        ai_response = response.text if hasattr(response, 'text') else "".join([p.text for p in response.candidates[0].content.parts])
        return jsonify({"response": ai_response, "is_html": True})
    except Exception as e:
        print(e)
        return jsonify({"error": f"Error generating response: {str(e)}"}), 500


@app.route('/summarize', methods=['POST'])
def summarize():
    pdf_content, doc_count = get_combined_pdf_content()
    if not pdf_content:
        return jsonify({"error": "No PDF content found."}), 400

    prompt = f"""
You are a helpful assistant. Provide a comprehensive summary of these {doc_count} PDF document(s).

PDF CONTENT:
{pdf_content}

STRUCTURE:
<h3>1. Main topics and key points</h3>
<ol><li>...</li></ol>

<h3>2. Important findings or conclusions</h3>
<ol><li>...</li></ol>

<h3>3. Significant data or statistics</h3>
<ol><li>...</li></ol>

<h3>4. Overall synthesis across documents</h3>
<p>...</p>

Output valid HTML only using <h3>, <ol>, <li>, <strong>, <p>. Be concise.
"""

    try:
        response = model.generate_content(prompt)
        if not response.candidates:
            return jsonify({"error": "AI failed to generate a response (empty candidates)."}), 500
            
        ai_response = response.text if hasattr(response, 'text') else "".join([p.text for p in response.candidates[0].content.parts])
        return jsonify({"response": ai_response, "is_html": True})
    except Exception as e:
        return jsonify({"error": f"Error generating summary: {str(e)}"}), 500


@app.route('/quiz/start', methods=['POST'])
def start_quiz():
    pdf_content, doc_count = get_combined_pdf_content()
    if not pdf_content:
        return jsonify({"error": "No PDF content found."}), 400

    seed = random.randint(1000, 9999)
    prompt = f"""
    You are a quiz generator. Create questions based on these {doc_count} document(s).

    PDF CONTENT:
    {pdf_content}

    Use seed {seed}.
    Generate 5 MCQs and 5 theoretical questions based on the content of all documents.

    Use the unique identifier **{seed}** to ensure variety.

    Generate 5 multiple-choice questions and 5 theoretical questions based on the document.
    For MCQs, return options in this exact format:
    ["A) option text" \\n, "B) option text" \\n, "C) option text" \\n, "D) option text" \\n]

    Return **ONLY a valid JSON object** with no other text.
    {{
      "mcq": [
        {{"q": "question text", "options": ["A) ...","B) ...","C) ...","D) ..."], "answer": "B"}}
      ],
      "theory": [
        "Theory question 1?",
        "Theory question 2?"
      ]
    }}
    """

    try:
        response = model.generate_content(prompt)
        if not response.candidates:
            return jsonify({"error": "AI failed to generate a quiz (empty candidates)."}), 500
            
        raw_text = response.text if hasattr(response, 'text') else response.candidates[0].content.parts[0].text
        raw_text = raw_text.strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.strip("`")
        if raw_text.lower().startswith("json"):
            raw_text = raw_text[4:].strip()

        quiz_data = json.loads(raw_text)

        session['quiz'] = {
            "mcq": quiz_data["mcq"],
            "theory": quiz_data["theory"],
            "current_mcq": 0,
            "current_theory": 0,
            "phase": "mcq",
            "answers": []
        }
        session.modified = True

        first_q = quiz_data["mcq"][0]
        return jsonify({
            "instruction": "Please type options only in (A / B / C / D)",
            
            "question": first_q["q"],
            "options": first_q["options"]
        })

    except Exception as e:
        return jsonify({"error": f"Error generating Quiz: {str(e)}"}), 500


@app.route('/quiz/answer', methods=['POST'])
def quiz_answer():
    data = request.json
    user_answer = data.get("answer", "")

    quiz = session.get('quiz', None)
    if not quiz:
        return jsonify({"error": "Quiz not started"}), 400

    # --- MCQ MODE ---
    if quiz["phase"] == "mcq":
        q_index = quiz["current_mcq"]
        question = quiz["mcq"][q_index]["q"]
        correct_U = quiz["mcq"][q_index]["answer"].strip().upper()
        correct_L = quiz["mcq"][q_index]["answer"].strip().lower()

        is_correct = user_answer == correct_U or user_answer == correct_L
        result = {
            "question": question,
            "your_answer": user_answer,
            "correct_answer": correct_U,
            "is_correct": is_correct
        }
        quiz["answers"].append(result)
        quiz["current_mcq"] += 1

        if quiz["current_mcq"] >= len(quiz["mcq"]):
            total = len(quiz["mcq"])
            correct_count = sum(1 for ans in quiz["answers"] if ans.get("is_correct"))
            score_msg = f"<h3>MCQ Round Completed!</h3><p>You scored <strong>{correct_count}/{total}</strong>.</p>"

            quiz["phase"] = "theory"
            session['quiz'] = quiz

            return jsonify({
                "result": result,
                "message": score_msg,
                "all_mcq_results": quiz["answers"],
                "next_question": quiz["theory"][0]
            })

        else:
            next_q = quiz["mcq"][quiz["current_mcq"]]
            session['quiz'] = quiz
            return jsonify({
                "result": result,
                "next_question": next_q["q"],
                "options": next_q["options"]
            })

    # --- THEORY MODE ---
    elif quiz["phase"] == "theory":
        q_index = quiz["current_theory"]
        question = quiz["theory"][q_index]

        eval_prompt = f"""
        Evaluate this theoretical answer:
        Question: {question}
        User Answer: {user_answer}

        Analyse on:
        - Coverage of topic
        - Depth of knowledge
        - Confidence Score (out of 10)
        - Marks out of 5

        Return clean bullet points only.
        """
        response = model.generate_content(eval_prompt)
        if not response.candidates:
            feedback = "AI failed to evaluate the answer (empty candidates)."
        else:
            feedback = response.text if hasattr(response, 'text') else response.candidates[0].content.parts[0].text

        quiz["answers"].append({
            "question": question,
            "answer": user_answer,
            "evaluation": feedback
        })
        quiz["current_theory"] += 1

        # if more theory left 
        if quiz["current_theory"] < len(quiz["theory"]):
            next_q = quiz["theory"][quiz["current_theory"]]
            session['quiz'] = quiz
            return jsonify({
                "feedback": feedback,
                "next_question": next_q
            })

        # if finished all theory
        else:
            mcq_results = [a for a in quiz["answers"] if "is_correct" in a]
            total_mcq = len(mcq_results)
            correct_mcq = sum(1 for a in mcq_results if a["is_correct"])
            score_msg = f"<h3>Quiz Completed!</h3><p>Your MCQ Score: <strong>{correct_mcq}/{total_mcq}</strong></p>"

            all_results = quiz["answers"]

            # EXIT QUIZ MODE
            session.pop('quiz', None)

            return jsonify({
                "feedback": feedback,
                "message": score_msg + "<p>You are now back to normal mode</p>",
                "all_results": all_results
            })


@app.route("/mindmap", methods=['POST'])
def mindmap():
    pdf_content, doc_count = get_combined_pdf_content(limit=40000)
    if not pdf_content:
        return jsonify({"error": "No PDF loaded"}), 400
    
    prompt = f"""You are a sophisticated AI. Create a detailed mindmap visual breakdown for these {doc_count} document(s).
    
    PDF CONTENT:
    {pdf_content}
    
    Structure the mindmap to cover all key aspects of all uploaded files.
    
    IMPORTANT OUTPUT RULES:
    - Output valid HTML only (no Markdown, no backslashes).
    - Use <h3> for titles, <ol><li> for lists, <strong> for bold.
    - Be extremely comprehensive.
    """
    
    try:
        response = model.generate_content(prompt)
        ai_res = "".join([p.text for p in response.candidates[0].content.parts])
        return jsonify({"response": ai_res, "is_html": True})
    except Exception as e:
        return jsonify({"error": f"Error Generating the mind map {str(e)}"}), 500
    
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(e):
    return jsonify({"error": "File too large. Maximum size is 50MB."}), 413


@app.errorhandler(413)
def handle_413(e):
    return jsonify({"error": "File too large. Maximum size is 50MB."}), 413


# ══════════════════════════════════════════════════════════════════════
# COLLABORATIVE SESSION ROUTES
# ══════════════════════════════════════════════════════════════════════

@app.route('/api/session/create', methods=['POST'])
def create_session():
    """Create a new collaborative session from the current user's PDF."""
    filename = session.get('pdf_filename')
    if not filename or filename not in uploaded_pdf_data:
        return jsonify({"error": "No PDF loaded. Please upload a PDF first."}), 400

    session_id = uuid.uuid4().hex[:12]  # Short unique ID
    collab_sessions[session_id] = {
        'pdf_filename': filename,
        'pdf_data': uploaded_pdf_data[filename],
        'pdf_text': uploaded_pdf_text.get(filename, ''),
        'annotations': [],
        'chat_messages': [],
        'connected_users': 0
    }

    # Build the shareable link
    host = request.host_url.rstrip('/')
    link = f"{host}/session?sessionid={session_id}"

    return jsonify({
        "success": True,
        "sessionId": session_id,
        "link": link
    })


@app.route('/api/session/<session_id>/info')
def session_info(session_id):
    """Return metadata for a collaborative session."""
    sess = collab_sessions.get(session_id)
    if not sess:
        return jsonify({"error": "Session not found"}), 404

    return jsonify({
        "sessionId": session_id,
        "pdf_filename": sess['pdf_filename'],
        "annotations": sess['annotations'],
        "chat_messages": sess['chat_messages'],
        "connected_users": sess['connected_users']
    })


@app.route('/api/session/<session_id>/pdf')
def session_pdf(session_id):
    """Serve the PDF bytes for a collaborative session."""
    sess = collab_sessions.get(session_id)
    if not sess:
        return jsonify({"error": "Session not found"}), 404

    return Response(
        sess['pdf_data'],
        mimetype='application/pdf',
        headers={'Content-Disposition': f'inline; filename={sess["pdf_filename"]}'}
    )


@app.route('/api/session/<session_id>/chat', methods=['POST'])
def session_chat(session_id):
    """Handle chat within a collaborative session — stores and broadcasts."""
    sess = collab_sessions.get(session_id)
    if not sess:
        return jsonify({"error": "Session not found"}), 404

    data = request.get_json()
    user_message = data.get('message', '')
    sender = data.get('sender', 'Anonymous')

    pdf_content = sess['pdf_text'][:60000]
    if not pdf_content:
        return jsonify({"error": "No PDF content in this session."}), 400

    prompt = f"""
You are a helpful AI assistant. Answer questions based on the provided PDF content.

PDF CONTENT:
{pdf_content}

IMPORTANT OUTPUT RULES:
- Output valid HTML only (no Markdown, no backslash).
- Do NOT use ``` or mention 'html'.
- Use <h3> for titles, <ol><li> for lists, <strong> for bold, <p> for paragraphs.
- Answer as concisely as possible.

USER QUESTION:
{user_message}"""

    try:
        response = model.generate_content(prompt)
        if not response.candidates:
            return jsonify({"error": "AI failed to generate a response."}), 500

        ai_response = response.text if hasattr(response, 'text') else "".join(
            [p.text for p in response.candidates[0].content.parts]
        )

        # Store the message in session
        chat_entry = {
            'sender': sender,
            'message': user_message,
            'aiResponse': ai_response,
            'timestamp': time.time()
        }
        sess['chat_messages'].append(chat_entry)

        # Broadcast to all users in the room
        socketio.emit('chat_update', chat_entry, room=session_id)

        return jsonify({"response": ai_response, "is_html": True})
    except Exception as e:
        print(e)
        return jsonify({"error": f"Error generating response: {str(e)}"}), 500


# ══════════════════════════════════════════════════════════════════════
# SOCKETIO EVENTS
# ══════════════════════════════════════════════════════════════════════

@socketio.on('join_session')
def handle_join_session(data):
    """User joins a collaborative session room."""
    session_id = data.get('sessionId')
    username = data.get('username', 'Anonymous')
    sess = collab_sessions.get(session_id)
    if not sess:
        emit('error', {'message': 'Session not found'})
        return

    join_room(session_id)
    sess['connected_users'] += 1

    # Send existing state to the joining user
    emit('session_state', {
        'annotations': sess['annotations'],
        'chat_messages': sess['chat_messages'],
        'connected_users': sess['connected_users']
    })

    # Notify others that someone joined
    emit('user_joined', {
        'username': username,
        'connected_users': sess['connected_users']
    }, room=session_id, include_self=False)


@socketio.on('leave_session')
def handle_leave_session(data):
    """User leaves a collaborative session room."""
    session_id = data.get('sessionId')
    username = data.get('username', 'Anonymous')
    sess = collab_sessions.get(session_id)
    if not sess:
        return

    leave_room(session_id)
    sess['connected_users'] = max(0, sess['connected_users'] - 1)

    emit('user_left', {
        'username': username,
        'connected_users': sess['connected_users']
    }, room=session_id)


@socketio.on('new_annotation')
def handle_new_annotation(data):
    """Receive and broadcast a new annotation."""
    session_id = data.get('sessionId')
    annotation = data.get('annotation')
    sess = collab_sessions.get(session_id)
    if not sess or not annotation:
        return

    sess['annotations'].append(annotation)
    emit('annotation_update', annotation, room=session_id, include_self=False)


@socketio.on('disconnect')
def handle_disconnect():
    """Handle user disconnection — decrement counters."""
    pass  # Room cleanup is handled automatically by Flask-SocketIO


if __name__ == '__main__':
    socketio.run(app, debug=True)

application = app
