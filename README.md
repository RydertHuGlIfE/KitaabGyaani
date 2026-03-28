# KitaabGenie <3

KitaabGenie is a real-time collaborative AI study ecosystem. It transforms textbooks into interactive, gamified, and high-focus study sessions using Gemini AI (1.5 Flash), computer vision, and real-time synchronization.

## :-) Key Features

- **Multi-PDF Deep Analysis:** Upload up to 5 PDFs simultaneously for unified AI query and context. 
- **Real-Time Study Rooms:** Shared session links to sync PDF scrolling, chat, and whiteboard annotations via Socket.IO.
- **Auto-Summarizer & Mindmaps:** Instant HTML summaries and hierarchical breakdowns of your study materials.
- **Visual Concepts (Mermaid):** Automated generation of Mermaid.js flowcharts to visualize complex logic.
- **Gamified Quizzing:** Challenge yourself with "Space Invaders" MCQs (4-life system) or descriptive Theory Mode with AI evaluation.
- **Focus Mode (Eye-Tracking):** Real-time webcam monitoring via MediaPipe. Detects if you are sleeping or away from the frame to pause timers and trigger alarms. (o_o)
- **Binaural Beats Engine:** Integrated audio for Alpha/Beta/Theta brainwave entrainment to match your study mood.
- **Wellness Tools:** Integrated Pomodoro timer, Night Light (warm filter), and Inversion Filter (high contrast).
- **YouTube Summarizer:** Instant summaries of educational video transcripts directly within the platform.
- **Screen Recorder:** Capture your study sessions or AI interactions with the built-in screen/audio recorder. [REC]
- **Meme Carousel:** Take a quick break with random trending memes fetched via Imgflip API. :-P

## :-P Tech Stack

- **Foundations:** React 19, Vite, Flask, Python 3
- **Intelligence:** Google Gemini 1.5 Flash API
- **Real-Time:** WebSockets (Socket.IO)
- **Vision:** @mediapipe/tasks-vision
- **Games/Audio:** Three.js, Web Audio API

## (-_-) Prerequisites

- Python 3.8+
- Node.js & npm (v18+)
- Google Gemini API Key (get one at [Google AI Studio](https://aistudio.google.com/))

## (^.^) Installation & Setup

1. **Clone the repo:**
   ```bash
   git clone https://github.com/Ryder/KitaabGenie.git
   cd KitaabGenie
   ```

2. **Backend Setup:**
   ```bash
   python -m venv venv
   source venv/bin/activate # macOS/Linux
   pip install -r requirements.txt
   ```
   Add `GEMINI_API_KEY=your_key` to a `.env` file in the root.

3. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   ```

## (o_o) Running the App

1. **Terminal 1 (Backend):** `python main.py`
2. **Terminal 2 (Frontend):** `npm run dev`

Access the portal at `http://localhost:5173`

## (T_T) License
This project is licensed under the MIT License.