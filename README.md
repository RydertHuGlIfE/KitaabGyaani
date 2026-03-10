# KitaabGyaani 🚀

An AI-powered PDF analyzer that helps you interact with your documents like never before. Extract key insights, generate quizzes, create mindmaps, and chat with multiple PDFs simultaneously—all powered by a **Local LLM**.

## ✨ Features

- **Multi-PDF Chat**: Upload and analyze multiple documents at once.
- **Smart Summarization**: Get comprehensive summaries of your documents.
- **Auto-Generated Quizzes**: Test your knowledge with MCQ and theoretical questions.
- **Visual Mindmaps**: Get a structured breakdown of complex topics.
- **YouTube Integration**: Quickly search for related educational content.
- **Interactive Viewer**: Seamlessly view PDFs while chatting with the AI.

## 🛠️ Technology Stack

- **Frontend**: React (Vite)
- **Backend**: Flask (Python)
- **AI Engine**: [Ollama](https://ollama.com/) (Running **Llama3**)

## ⚙️ Setup Instructions

### 1. Local Model Server (Remote Machine)
On your machine where the LLM is running, install Ollama and run:

```bash
export OLLAMA_HOST=Configure your own 
ollama serve
ollama run llama3
```

### 2. Backend (Main Machine)
Navigate to the root directory and update the `REMOTE_SERVER_URL` in `main.py` with your server's IP.

```bash
pip install -r requirements.txt # or install flask, requests, PyPDF2, python-dotenv
python main.py
```

### 3. Frontend
Navigate to the `frontend` directory:

```bash
npm install
npm run dev
```

## 🔒 Privacy & Architecture

Unlike cloud-based solutions, KitaabGyaani now uses **Local Models** via Ollama. This ensures your data stays within your local network and provides an offline-first experience.