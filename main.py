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
from io import BytesIO

# Serve React build from frontend/dist
REACT_BUILD = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')
app = Flask(__name__, static_folder=REACT_BUILD, static_url_path='')

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 
ALLOWED_EXTENSIONS = {'pdf'}
app.secret_key = "nullisgreat"   

genai.configure(api_key="AIzaSyD8AmRNv-Q5uS7BS8CSqais4XPFEzTjslo")

model = genai.GenerativeModel("gemini-flash-lite-latest", generation_config={
    "temperature": 0.7,
    "max_output_tokens": 20480
})

# In-memory storage - no files saved to disk (Vercel compatible)
uploaded_pdf_text = {}  # Store extracted text
uploaded_pdf_data = {}  # Store PDF bytes for viewer

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
        files = request.files.getlist('pdf_files[]')
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


@app.route('/summarize-multiple', methods=['POST'])
def summarize_multiple():
    """Summarize and synthesize content across multiple uploaded PDFs."""
    filenames = session.get('multi_pdf_filenames', [])
    if not filenames:
        # Fall back to single PDF if multi list is empty
        single = session.get('pdf_filename', '')
        if single:
            filenames = [single]
        else:
            return jsonify({"error": "No PDFs loaded"}), 400

    PER_PDF_LIMIT = 30000
    TOTAL_LIMIT = 80000
    combined_sections = []
    total_chars = 0

    for fname in filenames:
        pdf_text = uploaded_pdf_text.get(fname, '')
        if not pdf_text:
            continue
        chunk = pdf_text[:PER_PDF_LIMIT]
        if total_chars + len(chunk) > TOTAL_LIMIT:
            chunk = pdf_text[:max(0, TOTAL_LIMIT - total_chars)]
        combined_sections.append(f"=== Document: {fname} ===\n{chunk}")
        total_chars += len(chunk)
        if total_chars >= TOTAL_LIMIT:
            break

    if not combined_sections:
        return jsonify({"error": "PDF text not found. Please re-upload."}), 400

    combined_content = "\n\n".join(combined_sections)
    doc_count = len(combined_sections)
    doc_names = ", ".join(filenames[:doc_count])

    prompt = f"""You are a helpful assistant. The user has uploaded {doc_count} PDF document(s): {doc_names}.
Provide a comprehensive combined HTML summary that synthesizes information across all documents.

DOCUMENTS:
{combined_content}

STRUCTURE YOUR RESPONSE AS:
<h3>📚 Combined Summary ({doc_count} Documents)</h3>
<p>Brief overview of what these documents collectively cover.</p>

<h3>1. Key Topics &amp; Main Points (per document)</h3>
<ol><li>...</li></ol>

<h3>2. Common Themes &amp; Connections</h3>
<ol><li>...</li></ol>

<h3>3. Important Findings &amp; Conclusions</h3>
<ol><li>...</li></ol>

<h3>4. Overall Synthesis</h3>
<p>...</p>

IMPORTANT OUTPUT RULES:
- Output valid HTML only (no Markdown, no backslashes, no ``` tags).
- Use <h3> for section titles, <ol><li> for lists, <strong> for bold, <p> for paragraphs.
- Be concise yet comprehensive. Use bullet points where suitable.
- Do NOT include <script> tags or event handlers."""

    try:
        response = model.generate_content(prompt)
        if not response.candidates:
            return jsonify({"error": "AI failed to generate a response (empty candidates)."}), 500
        ai_response = response.text if hasattr(response, 'text') else "".join([p.text for p in response.candidates[0].content.parts])
        return jsonify({"response": ai_response, "is_html": True})
    except Exception as e:
        return jsonify({"error": f"Error generating combined summary: {str(e)}"}), 500


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

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '')
    filename = session.get('pdf_filename', '')

    if not filename:
        return jsonify({"error": "No PDF loaded"}), 400
    
    # Get the extracted PDF text
    pdf_text = uploaded_pdf_text.get(filename)
    if not pdf_text:
        return jsonify({"error": "PDF text not found. Please re-upload."}), 400

    # Limit text to avoid token limits (first 50000 chars ~ 12500 tokens)
    pdf_content = pdf_text[:50000]

    prompt = f"""
You are a helpful assistant. Answer questions based on the following PDF content.

PDF CONTENT:
{pdf_content}

IMPORTANT OUTPUT RULES:
- Output valid HTML only (no Markdown, no backslashes) but dont mention html in the text and neither use ```.
- Use <h3> for section titles.
- Use <ol><li> for numbered lists.
- Use <strong> for bold.
- Use <p> for paragraphs.
- Do not include <script> or event handlers.
- use "  " this spacing for the bullet points and = this for subpoints
While Making bullet points give a space after heading eg 
try to give most answers in bullet points unless asked...
try to be as consice and give a short answer as well unless asked in detail 
and dont use ``` or html words in the response and make it look clean
instead of numbers use bullet points
Answer should be shortest possible yet provide adequate content

if there is casual responses like hello or thank you in USER QUESTION: 
ignore PDF CONTENT and just respond accordingly for hi just respond like a normal chatbot

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
    filename = session.get('pdf_filename', '')

    if not filename:
        return jsonify({"error": "No PDF loaded"}), 400
    
    # Get the extracted PDF text
    pdf_text = uploaded_pdf_text.get(filename)
    if not pdf_text:
        return jsonify({"error": "PDF text not found. Please re-upload."}), 400

    # Limit text to avoid token limits
    pdf_content = pdf_text[:50000]

    prompt = f"""
You are a helpful assistant. Provide an HTML-only summary of this PDF document.

PDF CONTENT:
{pdf_content}

STRUCTURE:
<h3>1. Main topics and key points</h3>
<ol><li>...</li></ol>

<h3>2. Important findings or conclusions</h3>
<ol><li>...</li></ol>

<h3>3. Significant data or statistics</h3>
<ol><li>...</li></ol>

<h3>4. Overall theme and purpose</h3>
<p>...</p>

try to give most answers in bullet points unless asked...
try to be as consice and give a short answer as well unless asked in detail 
and dont use ``` or html words in the response and make it look clean
instead of numbers use bullet pts"""

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
    filename = session.get('pdf_filename', '')

    if not filename:
        return jsonify({"error": "No PDF Loaded"}), 400

    # Get the extracted PDF text
    pdf_text = uploaded_pdf_text.get(filename)
    if not pdf_text:
        return jsonify({"error": "PDF text not found. Please re-upload."}), 400

    # Limit text to avoid token limits
    pdf_content = pdf_text[:50000]

    seed = random.randint(1000, 9999)

    prompt = f"""
    You are a quiz generator. Create questions based on this PDF content.

    PDF CONTENT:
    {pdf_content}

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
    filename = session.get('pdf_filename', '')
    
    if not filename:
        return jsonify({"error": "No PDF loaded"}), 400
    
    # Get the extracted PDF text
    pdf_text = uploaded_pdf_text.get(filename)
    if not pdf_text:
        return jsonify({"error": "PDF text not found. Please re-upload."}), 400
    
    # Limit text to avoid token limits
    pdf_content = pdf_text[:50000]
    
    prompt = f"""You are a highly sophisticated AI. Create the best mindmap based on this PDF content.
    
    PDF CONTENT:
    {pdf_content}
    
    Anyone that lays eyes upon this piece should say I need this to study for my exam. 
    Just say "Generating Mindmap:" and create the mindmap.
    Everything from the PDF should be covered, dont leave anything.
    
    IMPORTANT OUTPUT RULES:
    - Output valid HTML only (no Markdown, no backslashes) but dont mention html in the text and neither use ```.
    - Use <h3> for section titles.
    - Use <ol><li> for numbered lists.
    - Use <strong> for bold.
    - Use <p> for paragraphs.
    - Do not include <script> or event handlers.
    - use "  " this spacing for the bullet points and = this for subpoints
    - dont use ``` html tags
    Create the mindmap using bullet points or otherwise as suitable."""
    
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


if __name__ == '__main__':
    app.run(debug=True)

application = app