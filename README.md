# KitaabGenie 🧞‍♂️📚

KitaabGenie is a real-time collaborative PDF study application powered by AI. It allows users to upload multiple PDFs, share them in live study sessions, interact with an AI assistant to query document contents, generate summaries, take AI-evaluated quizzes, and create mindmaps—all in a seamless minimal-friction interface.

## ✨ Key Features

- **Multi-PDF Support:** Upload up to 5 PDFs simultaneously and seamlessly switch between them during your study session.
- **Real-Time Collaboration:** Generate a shareable session link to sync PDF navigation, chat messages, and annotations across multiple active users instantly using WebSockets.
- **AI-Powered Chat & Summarization:** Query your documents contextually. Powered by Google Generative AI (Gemini Flash Lite), you can ask questions, generate HTML-formatted comprehensive summaries, and even trigger YouTube searches directly from the chat prompt.
- **Interactive AI Quizzes:** Auto-generate Multiple-Choice (MCQ) and Theoretical quizzes based on the accumulated PDF knowledge. Features real-time AI scoring and detailed feedback.
- **Mindmap Generation:** Automatically generate structured, comprehensive HTML mindmap visual breakdowns based on the contents of all uploaded documents.
- **Vercel / Cloud Ready:** Stores extracted texts and PDF bytes efficiently in-memory, avoiding disk-write issues making it highly compatible with serverless/ephemeral environments.

## 🛠️ Tech Stack

- **Backend:** Python 3, Flask, Flask-SocketIO, PyPDF2, Google Generative AI (`gemini-flash-lite-latest`)
- **Frontend:** React 19, Vite, React Router DOM, Socket.io-client
- **Real-Time Sync:** WebSockets via SocketIO

## ⚙️ Prerequisites

- **Python 3.8+**
- **Node.js & npm** (v18+ recommended)
- **Google Gemini API Key** (Get one from [Google AI Studio](https://aistudio.google.com/))

## 🚀 Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/KitaabGenie.git
cd KitaabGenie
```

### 2. Backend Setup
Create and activate a Python virtual environment:
```bash
python -m venv venv
# On Windows: venv\Scripts\activate
# On macOS/Linux: source venv/bin/activate
```

Install the required Python dependencies:
```bash
pip install -r requirements.txt
```

Set up your environment variables:
Create a `.env` file in the root directory and add your Gemini API Key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Frontend Setup
Navigate to the frontend directory:
```bash
cd frontend
npm install
```

## 💻 Running the Application

You will need two terminal windows to run both the frontend and backend servers simultaneously.

**Terminal 1: Start the Backend (Flask & SocketIO)**
```bash
# Ensure you are in the root directory and the virtual environment is activated
python main.py
```
*(The backend runs on `http://127.0.0.1:5000` by default)*

**Terminal 2: Start the Frontend (Vite & React)**
```bash
cd frontend
npm run dev
```
*(The Vite development server will start, typically on `http://localhost:5173`)*

## 🧠 Project Architecture Overview

- `main.py`: The entry point for the Flask backend. Handles PDF upload/parsing in-memory, session management via SocketIO, and AI generation prompts via the Gemini API.
- `frontend/src/`: Contains the React components, handling routing, the PDF viewer interface, and the collaborative real-time SocketIO logic.
- **In-Memory Storage**: PDF bytes and extracted texts (`uploaded_pdf_data`, `uploaded_pdf_text`) are stored globally in memory. Collaborative sessions maintain independent states mapping to these in-memory blobs for fast, disk-free access.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page if you want to contribute.

## 📝 License

This project is licensed under the MIT License.