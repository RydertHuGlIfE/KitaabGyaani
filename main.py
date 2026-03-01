from flask import Flask, render_template, request, send_file, session, redirect, url_for, jsonify, Response
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

app = Flask(__name__)

# In-memory storage for Vercel compatibility (no disk writes needed)
app.config['MAX_CONTENT_LENGTH'] = 4 * 1024 * 1024  # 4MB max (Vercel serverless limit)
ALLOWED_EXTENSIONS = {'pdf'}
app.secret_key = "nullisgreat"   

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash", generation_config={
    "temperature": 0.7,
    "max_output_tokens": 20480
})

# In-memory storage - no files saved to disk (Vercel compatible)
uploaded_pdf_text = {}  # Store extracted text
uploaded_pdf_data = {}  # Store PDF bytes for viewer

@app.route('/')
def index():
    return render_template("index.html")


@app.route('/pdfinput')
def pdfinput():
    return render_template("pdfinput.html")


@app.route('/wikipedia')
def wikipedia():
    return render_template("wikipedia.html")


@app.route('/wikipedia/search', methods=['POST'])
def wikipedia_search():
    data = request.get_json()
    query = data.get('query', '').strip()
    
    if not query:
        return jsonify({"error": "Please enter a search query"}), 400

    headers = {
        'User-agent': 'VortexMind/1.0 (vortex23001.local)'
    }
    
    try:
        # Search Wikipedia for the topic
        search_url = "https://en.wikipedia.org/w/api.php"
        search_params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "format": "json",
            "srlimit": 2
        }
        search_response = requests.get(search_url, params=search_params, headers=headers)
        search_data = search_response.json()
        
        if not search_data.get("query", {}).get("search"):
            return jsonify({"error": f"No Wikipedia article found for '{query}'"}), 404
        
        # Get the page title
        page_title = search_data["query"]["search"][0]["title"]
        
        # Fetch the full article content
        content_params = {
            "action": "query",
            "titles": page_title,
            "prop": "extracts",
            "exintro": False,
            "explaintext": True,
            "format": "json"
        }
        content_response = requests.get(search_url, params=content_params, headers=headers)
        content_data = content_response.json()
        
        pages = content_data.get("query", {}).get("pages", {})
        page_content = ""
        for page_id, page_info in pages.items():
            page_content = page_info.get("extract", "")
            break
        
        if not page_content:
            return jsonify({"error": "Could not fetch article content"}), 500
        
        # Limit content to avoid token limits (first 8000 chars)
        page_content = page_content[:8000]
        
    except Exception as e:
        print(e)
        return jsonify({"error": f"Error fetching from Wikipedia: {str(e)}"}), 500
    
    # Now summarize with AI
    prompt = f"""You are a helpful assistant. Summarize this Wikipedia article about "{page_title}":

WIKIPEDIA CONTENT:
{page_content}

IMPORTANT OUTPUT RULES:
- Output valid HTML only (no Markdown, no backslashes)
- Use <h3> for section titles
- Use <ul><li> for bullet points
- Use <strong> for important terms
- Use <p> for paragraphs
- Do not include <script> or event handlers
- Do not use ``` or mention HTML

Provide a well-structured summary with:
1. A brief overview/definition
2. Key facts and information  
3. Important details
4. Why it matters

Keep it informative but easy to read."""

    try:
        response = model.generate_content(prompt)
        ai_response = "".join([p.text for p in response.candidates[0].content.parts])
        return jsonify({
            "title": page_title,
            "summary": ai_response
        })
    except Exception as e:
        return jsonify({"error": f"Error generating summary: {str(e)}"}), 500


@app.route('/codehelper')
def codehelper():
    return render_template("codehelper.html")


@app.route('/humanizer')
def humanizer():
    return render_template("humanizer.html")


@app.route('/humanizer/convert', methods=['POST'])
def humanizer_convert():
    data = request.get_json()
    text = data.get('text', '').strip()
    style = data.get('style', 'natural')
    
    if not text:
        return jsonify({"error": "Please provide text to humanize"}), 400
    
    # Style-specific instructions
    style_instructions = {
        "natural": "Make it sound natural and conversational, like a real person wrote it. Add natural flow and varied sentence structures.",
        "casual": "Make it sound casual, friendly, and relaxed. Use informal language, contractions, and a warm tone.",
        "professional": "Make it sound professional and polished but still human. Maintain clarity and authority while avoiding robotic language.",
        "academic": "Make it sound academic and scholarly but readable. Use proper terminology while maintaining natural flow.",
        "creative": "Make it sound creative and engaging. Add personality, vivid language, and interesting phrasing."
    }
    
    style_guide = style_instructions.get(style, style_instructions["natural"])
    
    prompt = f"""You are an expert at rewriting AI-generated text to sound genuinely human-written.

ORIGINAL TEXT:
{text}

STYLE: {style.upper()}
{style_guide}

REWRITING RULES:
You are a human writer. These are your comprehensive writing guidelines. Anything that you output will adhere to these guidelines exactly.

    POSITIVE DIRECTIVES (How you SHOULD write)

    Clarity and brevity
    • Craft sentences that average 10–20 words and focus on a single idea, with the occasional longer sentence.

    Active voice and direct verbs
    • Use active voice 90 % of the time.

    Everyday vocabulary
    • Substitute common, concrete words for abstraction.

    Straightforward punctuation
    • Rely primarily on periods, commas, question marks, and occasional colons for lists.

    Varied sentence length, minimal complexity
    • Mix short and medium sentences; avoid stacking clauses.

    Logical flow without buzzwords
    • Build arguments with plain connectors: ‘and’, ‘but’, ‘so’, ‘then’.

    Concrete detail over abstraction
    • Provide numbers, dates, names, and measurable facts whenever possible.

    Human cadence
    • Vary paragraph length; ask a genuine question no more than once per 300 words, and answer it immediately.

    NEGATIVE DIRECTIVES (What you MUST AVOID)
    • Avoid buzzwords, clichés, and jargon.
    • Avoid complex sentence structures and long paragraphs.
    • Avoid passive voice and abstract language.
    • Avoid using technical terms or specialized vocabulary.
    • Avoid using complex sentence structures and long paragraphs.
    • Avoid using complex sentence structures and long paragraphs.



Use the following instraction and more examples to help you understand the guidelines better:

Must avoid words like: 


    advent
    akin
    along with
    amidst
    arduous
    cannot be overstated
    conversely
    delve <------------ Dead giveaway it's AI
    ecommerce
    entails
    entrenched
    essential
    foster
    foray
    furthermore
    glean
    grasp
    hinder
    i hope this email finds you well
    in conclusion
    in today’s rapidly evolving market
    integral
    intricate
    kaleidoscope
    linchpin
    manifold
    moreover
    multifaceted
    nuanced
    on the contrary
    pivotal
    plethora
    preemptively
    pronged
    realm
    robust
    strive
    tailor
    tapestry
    underpins
    unparalleled
    vast
    Tapestry
    Crucial
    Intricate
    Interplay
    Elevate
    Resonate
    Enhance
    Offerings
    Leverage
    Embark
    Delve
    underscores
    deep understanding", "crucial", "deliving", "elevate", "resonate", "enhance", "expertise", "offerings", "valuable", "leverage
    in the realm of 
    empower, unleash, unlock, elevate 
    embarked, delved, invaluable, relentless, groundbreaking, endeavour, enlightening, insights, esteemed, shed light, deep understanding, crucial, delving, elevate, resonate, enhance, expertise, offerings, valuable, leverage, Intricate, tapestry, foster, systemic, inherent, tapestry, treasure trove, testament, peril, landscape, delve, pertinent, synergy, explore, underscores, empower, unleash, unlock, elevate, foster, intricate, folks, pivotal, adhere, amplify, embarked, delved, invaluable, relentless, groundbreaking, endeavour, enlightening, insights, esteemed, shed light and cognizant, conceptualize, insights, crucial, foster, emphasize, valuable, complexity, recognize, adapt, promote, critique, comprehensive, implications, complementary, perspectives, holistic, discern, multifaceted, nuanced, underpinnings, cultivate, integral, profound, facilitate, encompass, elucidate, unravel, paramount, characterized, significant.  deep dive
 FOLLOW THIS WRITING STYLE:

• SHOULD use clear, simple language.
• SHOULD be spartan and informative.
• SHOULD use short, impactful sentences.
• SHOULD use active voice; avoid passive voice.
• SHOULD focus on practical, actionable insights.
• SHOULD use bullet point lists in social media posts.
• SHOULD use data and examples to support claims when possible.
• SHOULD use “you” and “your” to directly address the reader.
• AVOID using em dashes (—) anywhere in your response. Use only commas, periods, or other standard punctuation. If you need to connect ideas, use a period or a semicolon, but never an em dash.
• AVOID constructions like "...not just this, but also this".
• AVOID metaphors and clichés.
• AVOID generalizations.
• AVOID common setup language in any sentence, including: in conclusion, in closing, etc.
• AVOID output warnings or notes, just the output requested.
• AVOID unnecessary adjectives and adverbs.
• AVOID hashtags.
• AVOID semicolons.
• AVOID markdown.
• AVOID asterisks.
• AVOID these words:
“can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, enlightening, esteemed, shed light, craft, crafting, imagine, realm, game-changer, unlock, discover, skyrocket, abyss, not alone, in a world where, revolutionize, disruptive, utilize, utilizing, dive deep, tapestry, illuminate, unveil, pivotal, intricate, elucidate, hence, furthermore, realm, however, harness, exciting, groundbreaking, cutting-edge, remarkable, it, remains to be seen, glimpse into, navigating, landscape, stark, testament, in summary, in conclusion, moreover, boost, skyrocketing, opened up, powerful, inquiries, ever-evolving"

# IMPORTANT: Review your response and ensure no em dashes!
Return ONLY the rewritten text. No explanations, no quotes around it, no markdown - just the humanized text."""

    try:
        response = model.generate_content(prompt)
        ai_response = "".join([p.text for p in response.candidates[0].content.parts])
        return jsonify({"response": ai_response.strip()})
    except Exception as e:
        return jsonify({"error": f"Error humanizing text: {str(e)}"}), 500


@app.route('/codehelper/ask', methods=['POST'])
def codehelper_ask():
    data = request.get_json()
    code = data.get('code', '').strip()
    question = data.get('question', '').strip()
    mode = data.get('mode', 'explain')
    
    if not code and not question:
        return jsonify({"error": "Please provide code or a question"}), 400
    
    # Build prompt based on mode
    mode_prompts = {
        "explain": f"""You are an expert programming tutor. Explain the following code in detail.

CODE:
```
{code}
```

{f"USER'S SPECIFIC QUESTION: {question}" if question else ""}

Explain:
- What the code does step by step
- Key concepts used
- Any important patterns or techniques

Keep explanations clear and beginner-friendly.""",

        "debug": f"""You are an expert debugger. Analyze this code and find any bugs or issues.

CODE:
```
{code}
```

{f"ERROR/ISSUE DESCRIBED: {question}" if question else ""}

Provide:
- Identified bugs or issues
- Why they cause problems
- The corrected code
- Explanation of the fix""",

        "optimize": f"""You are a code optimization expert. Optimize the following code.

CODE:
```
{code}
```

{f"OPTIMIZATION FOCUS: {question}" if question else ""}

Provide:
- Analysis of current code efficiency
- Optimized version of the code
- Explanation of improvements made
- Time/space complexity comparison if applicable""",

        "error": f"""You are an expert error message explainer. Explain this programming error in simple, beginner-friendly terms.

{f"CODE CONTEXT: ```{code}```" if code else ""}

ERROR MESSAGE: {question}

Provide:
- What this error means in simple terms
- Why this error occurs (common causes)
- Step-by-step solution to fix it
- How to prevent this error in the future
- Example of correct code if applicable""",

        "question": f"""You are an expert programming assistant. Answer this coding question.

{f"CODE CONTEXT: ```{code}```" if code else ""}

QUESTION: {question}

Provide a clear, helpful answer with code examples if needed."""
    }
    
    base_prompt = mode_prompts.get(mode, mode_prompts["explain"])
    
    prompt = base_prompt + """

IMPORTANT OUTPUT RULES:
- Output valid HTML only (no Markdown syntax, no backslashes)
- Use <h3> for section titles
- Use <pre><code> for code blocks
- Use <ul><li> for bullet points
- Use <strong> for emphasis
- Use <p> for paragraphs
- Do not include <script> or event handlers
- Do not use ``` or mention HTML in your response"""

    try:
        response = model.generate_content(prompt)
        ai_response = "".join([p.text for p in response.candidates[0].content.parts])
        return jsonify({"response": ai_response})
    except Exception as e:
        return jsonify({"error": f"Error generating response: {str(e)}"}), 500


@app.route('/viewer')
def viewer():
    if 'pdf_filename' not in session:
        return redirect(url_for('index'))
    return render_template("viewer.html")

@app.route('/get-pdf-info')
def get_pdf_info():
    filename = session.get('pdf_filename')
    if not filename:
        return jsonify({"error": "No PDF loaded"}), 400
    return jsonify({"filename": filename})


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
        ai_response = "".join([p.text for p in response.candidates[0].content.parts])
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
        ai_response = "".join([p.text for p in response.candidates[0].content.parts])
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
        raw_text = response.candidates[0].content.parts[0].text.strip()

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
        feedback = response.candidates[0].content.parts[0].text

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
    

@app.route('/whiteboard')
def whiteboard():
    return render_template("whiteboard.html")


@app.route('/grapher')
def grapher():
    return render_template("grapher.html")


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

# Vercel serverless entry point
application = app