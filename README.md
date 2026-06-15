# Nexus AI — Smart Study Assistant

An AI-powered study SaaS application built with React + Vite (frontend) and Express + MongoDB (backend). Features Gemini AI for intelligent responses, PDF document analysis with RAG, image analysis, voice input, and persistent chat history.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, Framer Motion |
| Backend | Express 5, MongoDB + Mongoose, Multer |
| AI | Google Gemini 2.5 Flash, Gemini Embeddings |
| Auth | Clerk |

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Google Gemini API Key
- Clerk Account (for authentication)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd AI-Study-SaaS
npm run install:all
```

### 2. Environment Setup

Copy the example files and add your keys:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

### 3. Run Development Servers

```bash
# Start backend (port 5000)
npm run dev:backend

# Start frontend (port 5173) — in another terminal
npm run dev:frontend
```

## Project Structure

```
AI-Study-SaaS/
├── frontend/           # React + Vite app
│   ├── src/
│   │   ├── App.jsx     # Main application component
│   │   ├── main.jsx    # Entry point with Clerk provider
│   │   └── index.css   # Tailwind + custom styles
│   └── public/         # Static assets
├── backend/            # Express API server
│   ├── index.js        # Server, routes, AI logic
│   └── uploads/        # Temporary PDF uploads
└── package.json        # Root workspace scripts
```

## Features

- **AI Chat** — Powered by Gemini 2.5 Flash with streaming responses
- **PDF Analysis** — Upload PDFs and ask questions (RAG with embeddings)
- **Image Analysis** — Upload images for AI-powered analysis
- **Voice Input** — Speech-to-text for hands-free interaction
- **Chat History** — Persistent conversations stored in MongoDB
- **Authentication** — Secure login via Clerk
