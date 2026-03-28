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
from youtube_transcript_api import YouTubeTranscriptApi
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

def clean_mermaid_syntax(text):
    if not text: return ""
    
    # Remove markdown blocks
    text = text.strip()
    if "```mermaid" in text:
        text = text.split("```mermaid")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    
    lines = text.split('\n')
    cleaned_lines = []
    
    # Ensure it starts with flowchart TD if nothing specified
    has_header = False
    for line in lines:
        if any(h in line for h in ["flowchart", "graph", "sequenceDiagram", "gantt"]):
            has_header = True
            break
    if not has_header:
        cleaned_lines.append("flowchart TD")

    for line in lines:
        line = line.strip()
        if not line: continue
        
        # Handle Node labels to be super strict for Mermaid v10
        # Replace all [label] with ["label"] and (label) with ("label")
        if '[' in line and ']' in line and '["' not in line:
            parts = line.split('[', 1)
            suffix = parts[1].rsplit(']', 1)
            label = suffix[0].replace('"', "'").replace('(', '').replace(')', '')
            line = f'{parts[0]}["{label}"]{suffix[1]}'
        elif '(' in line and ')' in line and '("' not in line:
            parts = line.split('(', 1)
            suffix = parts[1].rsplit(')', 1)
            label = suffix[0].replace('"', "'").replace('[', '').replace(']', '')
            line = f'{parts[0]}("{label}"){suffix[1]}'
            
        cleaned_lines.append(line)
     
    # Final safety: remove mermaid keyword if it leaked in
    result = "\n".join(cleaned_lines)
    if result.startswith("mermaid"):
        result = result[7:].strip()
        
    return result

# In-memory storage - no files saved to disk (Vercel compatible)
uploaded_pdf_text = {}
uploaded_pdf_data = {}

# In-memory collaborative sessions
collab_sessions = {}

# (React SPA routes moved to bottom)

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
        session.pop('multi_pdf_filenames', None)
        
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


def get_combined_pdf_content(limit=60000, filenames=None):
    """Aggregates text from all uploaded PDFs in the session."""
    if filenames is None:
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

@app.route('/youtube/summarize', methods=['POST'])
def youtube_summarize():
    data = request.get_json()
    url = data.get('url', '')
    
    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({"error": "Invalid YouTube URL. Please provide a valid link."}), 400
        
    try:
        api = YouTubeTranscriptApi()
        transcript_data = api.fetch(video_id, languages=['en', 'en-GB', 'hi'])
        full_transcript = " ".join([t.text if hasattr(t, 'text') else t['text'] for t in transcript_data])
        
        prompt = f"""
        Summarize the following YouTube video transcript in detail using bullet points.
        TRANSCRIPT:
        {full_transcript[:15000]} 

        RULES:
        - Output HTML ONLY (<h3>, <ol>, <li>, <p>).
        - Use <h3> for the main title.
        - Be concise but comprehensive.
        - If no content is found, say "No summary available".
        """
        
        response = model.generate_content(prompt)
        ai_res = response.text if hasattr(response, 'text') else "".join([p.text for p in response.candidates[0].content.parts])
        return jsonify({"response": ai_res, "is_html": True})
        
    except Exception as e:
        error_msg = str(e)
        return jsonify({"error": f"YouTube Error: {error_msg[:100]}"}), 500

def extract_video_id(url):
    import re
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'youtu\.be\/([0-9A-Za-z_-]{11})',
        r'embed\/([0-9A-Za-z_-]{11})'
    ]
    for p in patterns:
        match = re.search(p, url)
        if match: return match.group(1)
    return None

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
        return jsonify({"response": f"<p>Opened YouTube search for <strong>{topic}</strong> in your browser!</p>", "is_html": True})

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
    data = request.get_json() or {}
    mode = data.get("mode", "mcq_game") # 'mcq_game' or 'theory'

    pdf_content, doc_count = get_combined_pdf_content()
    if not pdf_content:
        return jsonify({"error": "No PDF content found."}), 400

    seed = random.randint(1000, 9999)
    if mode == "theory":
        prompt = f"""
        You are a quiz generator. Create exactly 20 theoretical questions based on these {doc_count} document(s).
        PDF CONTENT:
        {pdf_content}

        Return ONLY a valid JSON object with no other text.
        {{
          "theory": [
            "Theory question 1?",
            "Theory question 2?",
            "Theory question 3?",
            "..."
          ]
        }}
        """
    else:
        prompt = f"""
        You are a quiz generator. Create exactly 20 multiple-choice questions based on these {doc_count} document(s).
        PDF CONTENT:
        {pdf_content}

        Use seed {seed}.
        For MCQs, return options in this exact format:
        ["A) option text", "B) option text", "C) option text", "D) option text"]

        Return ONLY a valid JSON object with no other text.
        {{
          "mcq": [
            {{"q": "question text", "options": ["A) ...","B) ...","C) ...","D) ..."], "answer": "B"}}
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

        if mode == "theory":
            session['quiz'] = {
                "theory": quiz_data.get("theory", []),
                "current_theory": 0,
                "phase": "theory",
                "answers": [],
                "mode": "theory"
            }
            session.modified = True
            
            if not session['quiz']['theory']:
                return jsonify({"error": "Failed to parse theory questions."}), 500

            return jsonify({
                "instruction": "Answer the theoretical questions descriptively.",
                "question": session['quiz']["theory"][0]
            })
        else:
            session['quiz'] = {
                "mcq": quiz_data.get("mcq", []),
                "current_mcq": 0,
                "phase": "mcq",
                "answers": [],
                "lives": 4,
                "mode": "mcq_game"
            }
            session.modified = True
            
            if not session['quiz']['mcq']:
                return jsonify({"error": "Failed to parse MCQ questions."}), 500

            first_q = session['quiz']["mcq"][0]
            return jsonify({
                "instruction": "Space Invaders Mode: Shoot the correct option. You have 4 lives.",
                "question": first_q["q"],
                "options": first_q["options"],
                "lives": 4,
                "mode": "mcq_game"
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
        
        mcq_data = quiz["mcq"][q_index]
        correct_raw = mcq_data.get("answer", mcq_data.get("correct_answer", ""))
        if isinstance(correct_raw, list):
            correct_raw = correct_raw[0] if len(correct_raw) > 0 else ""
            
        correct_U = str(correct_raw).strip().upper()
        ans_U = str(user_answer).strip().upper()
        
        # Robust matching: correct answer starts with user's letter (e.g., 'B' for 'B) Option')
        is_correct = False
        if correct_U and ans_U:
            is_correct = correct_U.startswith(ans_U) or ans_U.startswith(correct_U) or ans_U == correct_U
            
        if not is_correct:
            quiz["lives"] = quiz.get("lives", 4) - 1

        result = {
            "question": question,
            "your_answer": user_answer,
            "correct_answer": correct_U,
            "is_correct": is_correct
        }
        quiz["answers"].append(result)
        quiz["current_mcq"] += 1
        
        lives = quiz.get("lives", 4)
        total = len(quiz["mcq"])
        correct_count = sum(1 for ans in quiz["answers"] if ans.get("is_correct"))

        if lives <= 0:
            score_msg = f"<h3>Game Over!</h3><p>You ran out of lives. You scored <strong>{correct_count}</strong> correctly.</p>"
            session.pop('quiz', None)
            return jsonify({
                "result": result,
                "message": score_msg,
                "all_mcq_results": quiz["answers"],
                "game_over": True,
                "lives": 0
            })

        if quiz["current_mcq"] >= total:
            score_msg = f"<h3>Victory!</h3><p>You have defeated the alien fleet and scored <strong>{correct_count}/{total}</strong>!</p>"
            session.pop('quiz', None)
            return jsonify({
                "result": result,
                "message": score_msg,
                "all_mcq_results": quiz["answers"],
                "game_over": True,
                "lives": lives
            })

        else:
            next_q = quiz["mcq"][quiz["current_mcq"]]
            session['quiz'] = quiz
            return jsonify({
                "result": result,
                "next_question": next_q["q"],
                "options": next_q["options"],
                "lives": lives
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
        total_theory = len(quiz["theory"])

        # if more theory left 
        if quiz["current_theory"] < total_theory:
            next_q = quiz["theory"][quiz["current_theory"]]
            session['quiz'] = quiz
            return jsonify({
                "feedback": feedback,
                "next_question": next_q,
                "progress": f"{{quiz['current_theory']}}/{{total_theory}}"
            })

        # if finished all theory
        else:
            score_msg = f"<h3>Theory Quiz Completed!</h3><p>You answered all {{total_theory}} questions.</p>"
            all_results = quiz["answers"]
            session.pop('quiz', None)

            return jsonify({
                "feedback": feedback,
                "message": score_msg,
                "all_results": all_results,
                "game_over": True
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
    
@app.route("/visualize", methods=['POST'])
def visualize():
    pdf_content, doc_count = get_combined_pdf_content(limit=40000)
    if not pdf_content:
        return jsonify({"error": "No PDF loaded"}), 400
    
    prompt = f"""
    Generate a valid Mermaid.js flowchart code based on these {doc_count} document(s).
    
    PDF CONTENT:
    {pdf_content}

    Requirements:  
    - Output ONLY raw Mermaid code (no markdown blocks, no explanations).
    - Use "flowchart TD" syntax.
    - IMPORTANT: All node labels MUST be wrapped in double quotes: ID["Label Text"].
    - DO NOT use double quotes INSIDE a label text. Use single quotes if needed.
    - Remove any special characters like parentheses (), square brackets [], or semicolons ; from INSIDE the label text.
    - Ensure nodes are clearly separated.
    """
    
    try:
        response = model.generate_content(prompt)
        if not response.candidates:
            return jsonify({"error": "AI failed to generate a flowchart (empty candidates)."}), 500
            
        ai_res = response.text if hasattr(response, 'text') else "".join([p.text for p in response.candidates[0].content.parts])
        ai_res = clean_mermaid_syntax(ai_res)
        return jsonify({"mermaid_code": ai_res.strip()})
    except Exception as e:
        return jsonify({"error": f"Error generating the flowchart: {str(e)}"}), 500

@app.route("/visualize/subtopic", methods=['POST'])
def visualize_subtopic():
    data = request.get_json()
    subtopic_name = data.get('subtopic_name', '')
    
    if not subtopic_name:
         return jsonify({"error": "No subtopic name provided"}), 400
         
    pdf_content, doc_count = get_combined_pdf_content(limit=30000)
    if not pdf_content:
        return jsonify({"error": "No PDF loaded"}), 400
        
    prompt = f"""
    Generate clear and concise revision notes for the subtopic "{subtopic_name}" based on these {doc_count} document(s).
    
    PDF CONTENT:
    {pdf_content}

    Requirements:  
    - Present the notes in a structured, easy-to-read format (using short paragraphs or bullet points).  
    - Cover all the key concepts, definitions, formulas (if any), and important points needed for quick revision.  
    - Keep the content descriptive but concise — enough for quick understanding without being overly detailed.  
    - Ensure accuracy based ONLY on the provided document(s).
    - Format output in Markdown.
    """
    
    try:
        response = model.generate_content(prompt)
        if not response.candidates:
            return jsonify({"error": "AI failed to generate subtopic content (empty candidates)."}), 500
            
        ai_res = response.text if hasattr(response, 'text') else "".join([p.text for p in response.candidates[0].content.parts])
        return jsonify({"content": ai_res.strip()})
    except Exception as e:
        return jsonify({"error": f"Error generating subtopic content: {str(e)}"}), 500

def slugify_meme_text(text):
    """Formats text for memegen.link URLs."""
    if not text: return "_"
    # Special character replacements according to memegen.link API
    # Spaces to _, underscores to __, dashes to --, ? to ~q, etc.
    text = text.replace("_", "__").replace("-", "--").replace(" ", "_")
    replacements = [
        ("?", "~q"), ("&", "~a"), ("%", "~p"), ("#", "~h"), ("/", "~s"), ("\\", "~b"), ("\"", "''")
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    return text

@app.route('/memes/generate', methods=['POST'])
def generate_ai_memes():
    """Generates AI memes using PDF content and strict memegen.link templates."""
    # 1. Get current PDF content for context
    pdf_text, doc_count = get_combined_pdf_content(limit=15000) # Small limit for speed
    filename = session.get('pdf_filename', 'Study')
    
    # Map of ID to (Display Name, Required Segments)
    MEME_REGISTRY = {
        "drake": ("Drake Hotline Bling", 2),
        "doge": ("Doge", 4),
        "gru": ("Gru's Plan", 4),
        "rollsafe": ("Roll Safe / Think About It", 2)
    }
    
    selected_ids = random.sample(list(MEME_REGISTRY.keys()), 4)
    template_info = [f"{tid} ({MEME_REGISTRY[tid][1]} segments)" for tid in selected_ids]
    
    prompt = f"""
    You are an AI Meme Generator specializing in Academic Life and the specific topics in this PDF.
    
    CONTENT CONTEXT (PDF): 
    "{pdf_text[:5000]}"
    
    TASK: Generate 4 hilarious memes that relate the PDF content above to student life struggles.
    TEMPLATES: {", ".join(template_info)}
    
    RETURN ONLY a JSON list of 4 objects:
    [
      {{"id": "template_id", "captions": ["Caption 1", "Caption 2", ...]}}
    ]
    
    RULES:
    - VERY IMPORTANT: Each caption MUST be under 35 characters.
    - The 'captions' list MUST match the segment count for that template.
    - Use specific terms from the PDF content in the jokes.
    - RETURN ONLY VALID JSON.
    """

    try:
        response = model.generate_content(prompt)
        raw_text = response.text.strip()
        
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].split("```")[0].strip()
            
        ai_meme_data = json.loads(raw_text)
        
        memes_output = []
        for item in ai_meme_data:
            tid = item.get('id')
            if tid not in MEME_REGISTRY: continue
            
            # Zero-risk slugification for Memegen.link
            def safe_slug(s):
                if not s: return "_"
                import re
                # 1. Clean punctuation and force uppercase
                s = s.upper().strip()
                s = re.sub(r'[^A-Z0-9\s]', '', s) # Keep only letters, numbers, and spaces
                # 2. Limit length to 40 chars per segment to avoid 404s
                s = s[:40].strip()
                # 3. Final URL formatting (spaces to _)
                return s.replace(" ", "_") if s else "_"

            captions = [safe_slug(c) for c in item.get('captions', [])]
            
            # Force segment count match
            req_len = MEME_REGISTRY[tid][1]
            while len(captions) < req_len: captions.append("_")
            captions = captions[:req_len]
            
            url = f"https://api.memegen.link/images/{tid}/{'/'.join(captions)}.png"
            print(f"DEBUG: Generated Meme URL: {url}")
            memes_output.append({
                "url": url,
                "name": MEME_REGISTRY[tid][0]
            })

        return jsonify({"memes": memes_output})
    except Exception as e:
        import sys
        print(f"Meme Generation Error: {str(e)}")
        sys.stdout.flush()
        # Fallback memes (exactly 4)
        return jsonify({"memes": [
            {"url": "https://api.memegen.link/images/drake/opening_100_page_pdf/asking_ai_assistant_for_meme.png", "name": "Drake Fallback"},
            {"url": "https://api.memegen.link/images/rollsafe/if_i_dont_open_the_pdf/i_cant_fail_the_exam.png", "name": "Safe Fallback"},
            {"url": "https://api.memegen.link/images/gru/read_the_first_page/forget_everything/forget_everything/check_memes_instead.png", "name": "Gru Fallback"},
            {"url": "https://api.memegen.link/images/doge/so_pdf/much_study/very_confusion/wow.png", "name": "Doge Fallback"}
        ]})

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
    multi_filenames = session.get('multi_pdf_filenames', [])
    if not filename or filename not in uploaded_pdf_data:
        return jsonify({"error": "No PDF loaded. Please upload a PDF first."}), 400

    session_id = uuid.uuid4().hex[:12]
    collab_sessions[session_id] = {
        'pdf_filename': filename,
        'multi_pdf_filenames': multi_filenames,
        'annotations': {},
        'chat_messages': [],
        'connected_users': 0,
        'quiz': None,
        'visualize_state': None,
        'whiteboard_annotations': []
    }


    for fname in (multi_filenames if multi_filenames else [filename]):
        collab_sessions[session_id]['annotations'][fname] = []

    host = request.host_url.rstrip('/')
    link = f"{host}/session?sessionid={session_id}"
    return jsonify({"success": True, "sessionId": session_id, "link": link})


@app.route('/api/session/<session_id>/info')
def session_info(session_id):
    """Return metadata for a collaborative session."""
    sess = collab_sessions.get(session_id)
    if not sess:
        return jsonify({"error": "Session not found"}), 404
    return jsonify({
        "sessionId": session_id,
        "pdf_filename": sess['pdf_filename'],
        "multi_pdf_filenames": sess['multi_pdf_filenames'],
        "annotations": sess['annotations'].get(sess['pdf_filename'], []),
        "chat_messages": sess['chat_messages'],
        "connected_users": sess['connected_users'],
        "quiz": sess['quiz'],
        "visualize_state": sess['visualize_state'],
        "whiteboard_annotations": sess.get('whiteboard_annotations', [])
    })



@app.route('/api/session/<session_id>/pdf')
def session_pdf(session_id):
    """Serve the PDF bytes for a collaborative session."""
    sess = collab_sessions.get(session_id)
    if not sess:
        return jsonify({"error": "Session not found"}), 404
    filename = sess['pdf_filename']
    pdf_bytes = uploaded_pdf_data.get(filename)
    if not pdf_bytes:
        return jsonify({"error": "PDF data not found in memory"}), 500
    return Response(
        pdf_bytes,
        mimetype='application/pdf',
        headers={'Content-Disposition': f'inline; filename={filename}'}
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

    filenames = sess.get('multi_pdf_filenames') or [sess['pdf_filename']]
    pdf_content, doc_count = get_combined_pdf_content(limit=60000, filenames=filenames)
    if not pdf_content:
        return jsonify({"error": "No PDF content in this session."}), 400

    prompt = f"""You are a helpful AI assistant. Answer questions based on the provided PDF content.

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
        chat_entry = {
            'sender': sender,
            'message': user_message,
            'aiResponse': ai_response,
            'timestamp': time.time()
        }
        sess['chat_messages'].append(chat_entry)
        socketio.emit('chat_update', chat_entry, room=session_id)
        return jsonify({"response": ai_response, "is_html": True})
    except Exception as e:
        print(e)
        return jsonify({"error": f"Error generating response: {str(e)}"}), 500


@app.route('/api/session/<session_id>/summarize', methods=['POST'])
def session_summarize(session_id):
    sess = collab_sessions.get(session_id)
    if not sess: return jsonify({"error": "Session not found"}), 404
    data = request.get_json()
    sender = data.get('sender', 'Anonymous')
    filenames = sess.get('multi_pdf_filenames') or [sess['pdf_filename']]
    pdf_content, doc_count = get_combined_pdf_content(limit=60000, filenames=filenames)
    if not pdf_content: return jsonify({"error": "No PDF content found."}), 400

    prompt = f"""You are a helpful assistant. Provide a comprehensive summary of these {doc_count} PDF document(s).
PDF CONTENT:
{pdf_content}
STRUCTURE:
<h3>1. Main topics and key points</h3><ol><li>...</li></ol>
<h3>2. Important findings or conclusions</h3><ol><li>...</li></ol>
<h3>3. Significant data or statistics</h3><ol><li>...</li></ol>
<h3>4. Overall synthesis across documents</h3><p>...</p>
Output valid HTML only using <h3>, <ol>, <li>, <strong>, <p>. Be concise."""

    try:
        response = model.generate_content(prompt)
        ai_res = response.text if hasattr(response, 'text') else "".join([p.text for p in response.candidates[0].content.parts])
        chat_entry = {'sender': sender, 'message': 'Summarize this PDF', 'aiResponse': ai_res, 'timestamp': time.time()}
        sess['chat_messages'].append(chat_entry)
        socketio.emit('chat_update', chat_entry, room=session_id)
        return jsonify({"response": ai_res, "is_html": True})
    except Exception as e:
        return jsonify({"error": f"Error generating summary: {str(e)}"}), 500


@app.route('/api/session/<session_id>/mindmap', methods=['POST'])
def session_mindmap(session_id):
    sess = collab_sessions.get(session_id)
    if not sess: return jsonify({"error": "Session not found"}), 404
    data = request.get_json()
    sender = data.get('sender', 'Anonymous')
    filenames = sess.get('multi_pdf_filenames') or [sess['pdf_filename']]
    pdf_content, doc_count = get_combined_pdf_content(limit=40000, filenames=filenames)
    if not pdf_content: return jsonify({"error": "No PDF loaded"}), 400
    
    prompt = f"""You are a sophisticated AI. Create a detailed mindmap visual breakdown for these {doc_count} document(s).
PDF CONTENT:
{pdf_content}
Structure the mindmap to cover all key aspects of all uploaded files.
IMPORTANT OUTPUT RULES:
- Output valid HTML only (no Markdown, no backslashes).
- Use <h3> for titles, <ol><li> for lists, <strong> for bold.
- Be extremely comprehensive."""
    
    try:
        response = model.generate_content(prompt)
        ai_res = response.text if hasattr(response, 'text') else "".join([p.text for p in response.candidates[0].content.parts])
        chat_entry = {'sender': sender, 'message': 'Create a mind map for this PDF', 'aiResponse': ai_res, 'timestamp': time.time()}
        sess['chat_messages'].append(chat_entry)
        socketio.emit('chat_update', chat_entry, room=session_id)
        return jsonify({"response": ai_res, "is_html": True})
    except Exception as e:
        return jsonify({"error": f"Error Generating mind map: {str(e)}"}), 500


@app.route('/api/session/<session_id>/visualize', methods=['POST'])
def session_visualize(session_id):
    sess = collab_sessions.get(session_id)
    if not sess: return jsonify({"error": "Session not found"}), 404
    filenames = sess.get('multi_pdf_filenames') or [sess['pdf_filename']]
    pdf_content, doc_count = get_combined_pdf_content(limit=40000, filenames=filenames)
    if not pdf_content: return jsonify({"error": "No PDF loaded"}), 400
    
    prompt = f"""Generate a Mermaid.js flowchart mapping out the key concepts in these {doc_count} document(s).
    PDF CONTENT:
    {pdf_content}
    Rules: 
    - Use "flowchart TD" syntax. 
    - Output ONLY raw Mermaid code (no markdown blocks, no explanations).
    - IMPORTANT: All node labels MUST be wrapped in double quotes: ID["Label Text"].
    - DO NOT use double quotes INSIDE a label text.
    - Remove any special characters like parentheses (), square brackets [], or semicolons ; from INSIDE the label text.
    """
    try:
        response = model.generate_content(prompt)
        ai_res = response.text if hasattr(response, 'text') else "".join([p.text for p in response.candidates[0].content.parts])
        ai_res = clean_mermaid_syntax(ai_res)
        sess['visualize_state'] = ai_res
        socketio.emit('visualize_update', {'mermaidCode': ai_res}, room=session_id)
        return jsonify({"mermaid_code": ai_res})
    except Exception as e:
        return jsonify({"error": f"Error generating flowchart: {str(e)}"}), 500


@app.route('/api/session/<session_id>/quiz/start', methods=['POST'])
def session_quiz_start(session_id):
    sess = collab_sessions.get(session_id)
    if not sess: return jsonify({"error": "Session not found"}), 404
    filenames = sess.get('multi_pdf_filenames') or [sess['pdf_filename']]
    pdf_content, doc_count = get_combined_pdf_content(limit=60000, filenames=filenames)
    if not pdf_content: return jsonify({"error": "No PDF content found."}), 400

    seed = random.randint(1000, 9999)
    prompt = f"""You are a quiz generator. Create questions based on these {doc_count} document(s).
            PDF CONTENT:
            {pdf_content}
            Generate 5 multiple-choice questions and 5 theoretical questions. Seed {seed}.
            For MCQs, return options in this exact format: ["A) ...", "B) ...", "C) ...", "D) ..."]
            Return ONLY a valid JSON object:
            {{"mcq": [{{"q":"...","options":["A)","B)","C)","D)"],"answer":"B"}}], "theory":["...","..."]}}"""

    try:
        response = model.generate_content(prompt)
        raw_text = response.text if hasattr(response, 'text') else response.candidates[0].content.parts[0].text
        raw_text = raw_text.strip().strip("`")
        if raw_text.lower().startswith("json"): raw_text = raw_text[4:].strip()
        
        quiz_data = json.loads(raw_text)
        sess['quiz'] = {
            "mcq": quiz_data["mcq"],
            "theory": quiz_data["theory"],
            "current_mcq": 0,
            "current_theory": 0,
            "phase": "mcq",
            "answers": []
        }
        first_q = quiz_data["mcq"][0]
        
        msg = f"<b>First Question:</b> {first_q['q']}<br><i>Options: {', '.join(first_q['options'])}</i>"
        chat_entry = {'sender': 'System', 'message': 'Started a quiz', 'aiResponse': msg, 'timestamp': time.time()}
        socketio.emit('quiz_started', {"chat_entry": chat_entry, "quiz_state": sess['quiz']}, room=session_id)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Error generating Quiz: {str(e)}"}), 500


@app.route('/api/session/<session_id>/quiz/answer', methods=['POST'])
def session_quiz_answer(session_id):
    sess = collab_sessions.get(session_id)
    if not sess or not sess.get('quiz'): return jsonify({"error": "Quiz not started"}), 400
    
    data = request.json
    user_answer = data.get("answer", "")
    sender = data.get("sender", "Anonymous")
    quiz = sess['quiz']

    if quiz["phase"] == "mcq":
        q_index = quiz["current_mcq"]
        question = quiz["mcq"][q_index]["q"]
        correct_U = quiz["mcq"][q_index]["answer"].strip().upper()
        correct_L = quiz["mcq"][q_index]["answer"].strip().lower()
        is_correct = user_answer == correct_U or user_answer == correct_L
        
        quiz["answers"].append({
            "question": question, "your_answer": user_answer, 
            "correct_answer": correct_U, "is_correct": is_correct, "user": sender
        })
        quiz["current_mcq"] += 1

        prefix = f"<b>{sender} answered:</b> {user_answer} - "
        prefix += "✅ Correct!" if is_correct else f"❌ Incorrect. Right answer: <strong>{correct_U}</strong>"

        if quiz["current_mcq"] >= len(quiz["mcq"]):
            quiz["phase"] = "theory"
            next_q = quiz["theory"][0]
            msg = f"{prefix}<br><br><h3>MCQ Round Completed!</h3><b>Next Question (Theory):</b> {next_q}"
            chat_entry = {'sender': 'System', 'message': '', 'aiResponse': msg, 'timestamp': time.time()}
            socketio.emit('quiz_answered', {"chat_entry": chat_entry, "quiz_state": quiz}, room=session_id)
        else:
            next_q = quiz["mcq"][quiz["current_mcq"]]
            opts = f"<br><i>Options: {', '.join(next_q['options'])}</i>"
            msg = f"{prefix}<br><br><b>Next Question:</b> {next_q['q']}{opts}"
            chat_entry = {'sender': 'System', 'message': '', 'aiResponse': msg, 'timestamp': time.time()}
            socketio.emit('quiz_answered', {"chat_entry": chat_entry, "quiz_state": quiz}, room=session_id)
            
        return jsonify({"success": True})

    elif quiz["phase"] == "theory":
        q_index = quiz["current_theory"]
        question = quiz["theory"][q_index]

        eval_prompt = f"Evaluate this theoretical answer:\nQuestion: {question}\nUser Answer: {user_answer}\nAnalyse on: Coverage, Depth, Confidence Score, Marks. Return clean bullet points only."
        response = model.generate_content(eval_prompt)
        feedback = response.text if hasattr(response, 'text') else response.candidates[0].content.parts[0].text

        quiz["answers"].append({"question": question, "answer": user_answer, "evaluation": feedback, "user": sender})
        quiz["current_theory"] += 1
        
        prefix = f"<b>{sender} answered:</b> {user_answer}<br><br><b>Feedback:</b><br>{feedback}"

        if quiz["current_theory"] < len(quiz["theory"]):
            next_q = quiz["theory"][quiz["current_theory"]]
            msg = f"{prefix}<br><br><b>Next Question (Theory):</b> {next_q}"
            chat_entry = {'sender': 'System', 'message': '', 'aiResponse': msg, 'timestamp': time.time()}
            socketio.emit('quiz_answered', {"chat_entry": chat_entry, "quiz_state": quiz}, room=session_id)
        else:
            mcq_results = [a for a in quiz["answers"] if "is_correct" in a]
            correct_mcq = sum(1 for a in mcq_results if a["is_correct"])
            
            html = f"{prefix}<br><br><h3>📜 Quiz Summary</h3><p>Total MCQ Score: <strong>{correct_mcq}/{len(mcq_results)}</strong></p>"
            for item in quiz["answers"]:
                if "is_correct" in item:
                    html += f"<div style='margin-bottom:10px;padding-left:10px;border-left:3px solid {'#22c55e' if item['is_correct'] else '#ef4444'}'>"
                    html += f"<p><strong>Q ({item['user']}):</strong> {item['question']}</p>"
                    html += f"<p>Answer: {item['your_answer']} &nbsp; Correct: {item['correct_answer']} &nbsp; {'✅' if item['is_correct'] else '❌'}</p></div>"
                elif "evaluation" in item:
                    html += f"<div style='margin-bottom:10px'><p><strong>Theory Q ({item['user']}):</strong> {item['question']}</p>"
                    html += f"<p><strong>Evaluation:</strong> {item['evaluation']}</p></div>"
            
            chat_entry = {'sender': 'System', 'message': '', 'aiResponse': html, 'timestamp': time.time()}
            sess['quiz'] = None # Reset
            socketio.emit('quiz_answered', {"chat_entry": chat_entry, "quiz_state": None}, room=session_id)
            
        return jsonify({"success": True})


@socketio.on('join_session')
def handle_join_session(data):
    session_id = data.get('sessionId')
    username = data.get('username', 'Anonymous')
    sess = collab_sessions.get(session_id)
    if not sess:
        emit('error', {'message': 'Session not found'})
        return
    join_room(session_id)
    sess['connected_users'] += 1
    emit('session_state', {
        'annotations': sess['annotations'].get(sess['pdf_filename'], []),
        'chat_messages': sess['chat_messages'],
        'connected_users': sess['connected_users'],
        'quiz': sess['quiz'],
        'visualize_state': sess['visualize_state'],
        'whiteboard_annotations': sess.get('whiteboard_annotations', [])
    })

    emit('user_joined', {
        'username': username,
        'connected_users': sess['connected_users']
    }, room=session_id, include_self=False)


@socketio.on('leave_session')
def handle_leave_session(data):
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
    session_id = data.get('sessionId')
    annotation = data.get('annotation')
    filename = data.get('filename')
    sess = collab_sessions.get(session_id)
    if not sess or not annotation or not filename:
        return
    if filename not in sess['annotations']:
        sess['annotations'][filename] = []
    sess['annotations'][filename].append(annotation)
    emit('annotation_update', {'annotation': annotation, 'filename': filename}, room=session_id, include_self=False)


@socketio.on('clear_annotations')
def handle_clear_annotations(data):
    session_id = data.get('sessionId')
    filename = data.get('filename')
    sess = collab_sessions.get(session_id)
    if not sess or not filename:
        return
    # Clear annotations for this PDF in memory
    sess['annotations'][filename] = []
    # Broadcast to everyone in the room
    emit('annotations_cleared', {'filename': filename}, room=session_id)


@socketio.on('new_whiteboard_annotation')
def handle_new_whiteboard_annotation(data):
    session_id = data.get('sessionId')
    annotation = data.get('annotation')
    sess = collab_sessions.get(session_id)
    if not sess or not annotation:
        return
    if 'whiteboard_annotations' not in sess:
        sess['whiteboard_annotations'] = []
    sess['whiteboard_annotations'].append(annotation)
    emit('whiteboard_update', {'annotation': annotation}, room=session_id, include_self=False)


@socketio.on('clear_whiteboard')
def handle_clear_whiteboard(data):
    session_id = data.get('sessionId')
    sess = collab_sessions.get(session_id)
    if not sess:
        return
    sess['whiteboard_annotations'] = []
    emit('whiteboard_cleared', room=session_id)


@socketio.on('switch_pdf')

def handle_switch_pdf(data):
    session_id = data.get('sessionId')
    filename = data.get('filename')
    username = data.get('username', 'Anonymous')
    sess = collab_sessions.get(session_id)
    if not sess or not filename:
        return
    if filename in sess['multi_pdf_filenames'] or filename == sess['pdf_filename']:
        sess['pdf_filename'] = filename
        emit('pdf_switched', {
            'filename': filename,
            'username': username,
            'annotations': sess['annotations'].get(filename, [])
        }, room=session_id)


@socketio.on('disconnect')
def handle_disconnect():
    pass  # Room cleanup handled automatically by Flask-SocketIO


@app.route('/api/session/<session_id>/youtube/summarize', methods=['POST'])
def session_youtube_summarize(session_id):
    sess = collab_sessions.get(session_id)
    if not sess: return jsonify({"error": "Session not found"}), 404
    data = request.get_json()
    url = data.get('url', '')
    sender = data.get('sender', 'Anonymous')
    
    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({"error": "Invalid YouTube URL."}), 400
        
    try:
        api = YouTubeTranscriptApi()
        transcript_data = api.fetch(video_id, languages=['en', 'en-GB', 'hi'])
        full_transcript = " ".join([t.text if hasattr(t, 'text') else t['text'] for t in transcript_data])
        
        prompt = f"""Summarize this YouTube video transcript in bullet points.
        TRANSCRIPT: {full_transcript[:10000]}
        Output HTML ONLY (<h3>, <ol>, <li>, <p>)."""
        
        response = model.generate_content(prompt)
        ai_res = response.text if hasattr(response, 'text') else "".join([p.text for p in response.candidates[0].content.parts])
        
        chat_entry = {'sender': sender, 'message': f'Summarize video: {url}', 'aiResponse': ai_res, 'timestamp': time.time()}
        sess['chat_messages'].append(chat_entry)
        socketio.emit('chat_update', chat_entry, room=session_id)
        
        return jsonify({"response": ai_res, "is_html": True})
    except Exception as e:
        return jsonify({"error": f"YouTube Error: {str(e)[:100]}"}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    full = os.path.join(REACT_BUILD, path)
    if path and os.path.exists(full):
        response = send_from_directory(REACT_BUILD, path)
    else:
        response = send_from_directory(REACT_BUILD, 'index.html')
    
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/viewer')
def viewer():
    return send_from_directory(REACT_BUILD, 'index.html')

if __name__ == '__main__':
    socketio.run(app, debug=True)

application = app