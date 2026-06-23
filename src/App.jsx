import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Trash2, Plus, MessageSquare, PanelLeftClose, PanelLeftOpen, X, FileText, Copy, Check, Square, Sparkles, Mic, Image as ImageIcon, Pencil, Moon, Sun, Zap, BookOpen, Mail, Atom, ChevronDown, StopCircle, Volume2, VolumeX, Play } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast, { Toaster } from 'react-hot-toast';
import { SignedIn, SignedOut, SignIn, UserButton, useUser } from "@clerk/clerk-react";

// Nexus Logo component
const NexusLogo = ({ size = 32 }) => (
  <img src="/logo.svg" alt="Nexus AI" width={size} height={size} style={{ borderRadius: '8px' }} />
);

function App() {
  const { user } = useUser();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Basic States
  const [prompt, setPrompt] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);

  // File & Image States
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedImage, setAttachedImage] = useState(null);

  // UI States
  const [copiedIndex, setCopiedIndex] = useState(null);

  // TTS (Text-to-Speech) States
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const speechUtteranceRef = useRef(null);

  // Live Preview States
  const [previewCode, setPreviewCode] = useState(null);
  const [previewLang, setPreviewLang] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');

  // Voice States
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Theme State
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nexus-theme') || 'dark';
    }
    return 'dark';
  });

  const abortControllerRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nexus-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (user) fetchChats();
  }, [user]);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentChatId]);

  const fetchChats = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/chats`);
      const validChats = res.data.filter(chat => chat.messages && chat.messages.length > 0);
      const newChatRes = await axios.post(`${API_URL}/api/chats`);
      setChats([newChatRes.data, ...validChats]);
      setCurrentChatId(newChatRes.data._id);
      setChatHistory([]);
    } catch (error) {
      toast.error("Failed to load chats");
    }
  };

  const createNewChat = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/chats`);
      setChats(prev => [res.data, ...prev]);
      setCurrentChatId(res.data._id);
      setChatHistory([]);
      setAttachedFile(null);
      setAttachedImage(null);
    } catch (error) {
      toast.error("Failed to create new chat");
    }
  };

  const loadChat = (chat) => {
    setCurrentChatId(chat._id);
    setChatHistory(chat.messages || []);
    setAttachedFile(null);
    setAttachedImage(null);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Delete this chat?")) {
      try {
        await axios.delete(`${API_URL}/api/chats/${id}`);
        setChats(chats.filter(c => c._id !== id));
        if (currentChatId === id) { setChatHistory([]); setCurrentChatId(null); }
        toast.success("Chat deleted");
      } catch (error) { toast.error("Error deleting"); }
    }
  };

  const deleteAllChats = async () => {
    if (window.confirm("Delete ALL chat history? This cannot be undone.")) {
      try {
        await axios.delete(`${API_URL}/api/chats-all`);
        setChats([]);
        setChatHistory([]);
        setCurrentChatId(null);
        createNewChat();
        toast.success("History cleared!");
      } catch (error) { toast.error("Failed to clear history"); }
    }
  };

  const updateChatInDB = async (id, newMessages, currentPrompt) => {
    try {
      let title = chats.find(c => c._id === id)?.title;
      if ((title === "New Conversation" || title === "New Chat") && currentPrompt) {
        title = currentPrompt.substring(0, 30) + "...";
      }
      await axios.put(`${API_URL}/api/chats/${id}`, { messages: newMessages, title });
      setChats(prev => prev.map(c => c._id === id ? { ...c, title, messages: newMessages } : c));
    } catch (error) { console.error("Sync error"); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoadingPdf(true);
    try {
      const res = await axios.post(`${API_URL}/upload-pdf`, formData);
      setAttachedFile({ name: file.name, content: res.data.summary });
      toast.success("PDF attached successfully");
    } catch (err) { toast.error("PDF upload error"); }
    setLoadingPdf(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAttachedImage({ name: file.name, base64: reader.result });
    reader.readAsDataURL(file);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return toast.error("Browser doesn't support voice input");
      const r = new SpeechRecognition();
      r.continuous = false;
      r.interimResults = false;
      r.onstart = () => {
        setIsListening(true);
        toast("Listening...", { icon: '🎙️', style: { background: '#252529', color: '#e3e3e8', border: '1px solid rgba(255,255,255,0.1)' } });
      };
      r.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setPrompt(prev => {
          const newPrompt = (prev + ' ' + transcript).trim();
          // Auto-send after getting voice result
          setTimeout(() => {
            askAI(newPrompt);
          }, 300);
          return newPrompt;
        });
      };
      r.onerror = () => { setIsListening(false); toast.error("Voice recognition error"); };
      r.onend = () => setIsListening(false);
      recognitionRef.current = r;
      r.start();
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoadingChat(false);
      toast("Generation stopped", { icon: '⏹️', style: { background: '#252529', color: '#e3e3e8', border: '1px solid rgba(255,255,255,0.1)' } });
    }
  };

  const askAI = async (textOverride, isEdit = false, editIdx = null) => {
    const finalPrompt = textOverride || (isEdit ? editPrompt : prompt);
    if ((!finalPrompt || !finalPrompt.trim()) && !attachedFile && !attachedImage) return;
    if (!currentChatId) return;

    setPrompt('');
    setEditingIndex(null);
    setLoadingChat(true);
    abortControllerRef.current = new AbortController();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    let newHistory;
    let imageToSend = null;

    if (isEdit) {
      newHistory = chatHistory.slice(0, editIdx);
      newHistory.push({ role: 'user', content: finalPrompt });
    } else {
      newHistory = [...chatHistory];
      if (attachedImage) {
        imageToSend = attachedImage.base64;
        newHistory.push({ role: 'user', content: finalPrompt, image: attachedImage.base64 });
        setAttachedImage(null);
      } else {
        if (attachedFile) {
          newHistory.push({ role: 'system', content: `📄 ${attachedFile.name} attached.` });
          setAttachedFile(null);
        }
        newHistory.push({ role: 'user', content: finalPrompt });
      }
    }

    newHistory.push({ role: 'ai', content: '' });
    setChatHistory(newHistory);

    try {
      const response = await fetch(`${API_URL}/ask-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, image: imageToSend }),
        signal: abortControllerRef.current.signal
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let aiText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
        setChatHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'ai', content: aiText };
          return updated;
        });
      }
      updateChatInDB(currentChatId, [...newHistory.slice(0, -1), { role: 'ai', content: aiText }], finalPrompt);
    } catch (error) {
      if (error.name !== 'AbortError') toast.error("AI Error — check backend connection");
    }
    setLoadingChat(false);
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success("Copied!", { style: { background: '#252529', color: '#e3e3e8', border: '1px solid rgba(255,255,255,0.1)' } });
  };

  // ====== TTS Functions ======
  const stripMarkdown = (md) => {
    return md
      .replace(/```[\s\S]*?```/g, ' code block omitted ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[\-\*]{3,}/g, '')
      .replace(/\|/g, ' ')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const speakMessage = useCallback((text, idx) => {
    if (speakingIndex === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = stripMarkdown(text);
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    // Try to pick a good English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
      || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    speechUtteranceRef.current = utterance;
    setSpeakingIndex(idx);
    window.speechSynthesis.speak(utterance);
  }, [speakingIndex]);

  // Stop TTS if we switch chats
  useEffect(() => {
    window.speechSynthesis.cancel();
    setSpeakingIndex(null);
  }, [currentChatId]);

  // Preload voices
  useEffect(() => {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

  // ====== Live Preview Functions ======
  const isPreviewableCode = (lang) => {
    if (!lang) return false;
    const lower = lang.toLowerCase();
    return ['html', 'htm', 'css', 'javascript', 'js', 'jsx', 'svg'].includes(lower);
  };

  const openPreview = (code, lang) => {
    setPreviewCode(code);
    setPreviewLang(lang);
  };

  const closePreview = () => {
    setPreviewCode(null);
    setPreviewLang(null);
  };

  const buildPreviewHtml = (code, lang) => {
    const l = lang?.toLowerCase();
    if (l === 'html' || l === 'htm') {
      // If it already has <html> or <body>, use as-is
      if (code.includes('<html') || code.includes('<body') || code.includes('<!DOCTYPE')) {
        return code;
      }
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,sans-serif;background:#0e0e11;color:#e3e3e8;}</style></head><body>${code}</body></html>`;
    }
    if (l === 'css') {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${code}</style></head><body><div class="demo"><h1>CSS Preview</h1><p>This is a preview of your CSS styles.</p><button>Sample Button</button></div></body></html>`;
    }
    if (l === 'javascript' || l === 'js' || l === 'jsx') {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:20px;font-family:system-ui,sans-serif;background:#0e0e11;color:#e3e3e8;}</style></head><body><div id="root"></div><script>${code}<\/script></body></html>`;
    }
    if (l === 'svg') {
      return `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0e0e11;}</style></head><body>${code}</body></html>`;
    }
    return code;
  };

  const starterPrompts = [
    { icon: <BookOpen className="w-4 h-4" />, text: "Summarize my PDF briefly", desc: "Document analysis" },
    { icon: <Mail className="w-4 h-4" />, text: "Help me write a professional email", desc: "Writing assistance" },
    { icon: <Atom className="w-4 h-4" />, text: "Explain Quantum Physics simply", desc: "Learn anything" },
    { icon: <Zap className="w-4 h-4" />, text: "Generate a Python function for me", desc: "Code generation" },
  ];

  // Custom code block renderer for dark theme
  const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    const lang = match ? match[1] : null;
    const canPreview = isPreviewableCode(lang);

    if (!inline && match) {
      return (
        <div className="rounded-xl overflow-hidden my-3 border border-[rgba(255,255,255,0.08)]">
          <div className="code-header">
            <span>{lang}</span>
            <div className="flex items-center gap-1.5">
              {canPreview && (
                <button
                  onClick={() => openPreview(codeString, lang)}
                  className="code-preview-btn flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md transition-all duration-200"
                  title="Live Preview"
                >
                  <Play className="w-3 h-3" />
                  <span>Preview</span>
                </button>
              )}
              <button
                onClick={() => { navigator.clipboard.writeText(codeString); toast.success("Code copied!"); }}
                className="text-[var(--text-muted)] hover:text-[var(--accent-blue)] transition-colors p-1 rounded"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <SyntaxHighlighter
            style={oneDark}
            language={lang}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: '0 0 12px 12px',
              background: '#0e0e11',
              padding: '16px',
              fontSize: '13px',
            }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }
    return <code className={className} {...props}>{children}</code>;
  };

  return (
    <div className="flex h-screen overflow-x-hidden overflow-y-hidden relative" style={{ background: 'var(--bg-primary)' }}>
      {/* Ambient Background */}
      <div className="ambient-bg" />

      <Toaster position="top-center" toastOptions={{
        style: { background: 'var(--toast-bg)', color: 'var(--toast-color)', border: '1px solid var(--border-default)', fontSize: '13px', fontWeight: 500 },
      }} />

      <SignedOut>
        <div className="flex h-screen w-full items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
          <div className="ambient-bg" />
          <div className="relative z-10">
            <SignIn />
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        {/* ============ SIDEBAR ============ */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Mobile backdrop overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mobile-sidebar-overlay md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: -280, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -280, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="glass mobile-sidebar md:relative md:mobile-sidebar-none flex flex-col h-full z-20 overflow-hidden"
                style={{ minWidth: 0, width: 280 }}
              >
              {/* Sidebar Header */}
              <div className="p-5 pt-6">
                <div className="flex items-center gap-3 mb-6 px-1">
                  <NexusLogo size={28} />
                  <span className="gradient-text font-extrabold text-lg tracking-tight">Nexus AI</span>
                </div>
                <button
                  id="new-chat-btn"
                  onClick={createNewChat}
                  className="flex items-center gap-2.5 w-full p-3.5 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{
                    background: 'rgba(138,180,248,0.08)',
                    border: '1px solid rgba(138,180,248,0.15)',
                    color: '#8ab4f8',
                  }}
                  onMouseEnter={e => { e.target.style.background = 'rgba(138,180,248,0.14)'; }}
                  onMouseLeave={e => { e.target.style.background = 'rgba(138,180,248,0.08)'; }}
                >
                  <Plus className="w-4 h-4" /> New Chat
                </button>
              </div>

              {/* Chat List */}
              <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 mb-3 mt-1" style={{ color: 'var(--text-muted)' }}>
                  Recent Chats
                </p>
                {chats.map(chat => (
                  <div
                    key={chat._id}
                    onClick={() => loadChat(chat)}
                    className={`flex items-center justify-between group cursor-pointer px-3 py-3 rounded-xl text-sm mb-1 transition-all duration-200 ${currentChatId === chat._id
                      ? 'sidebar-item active'
                      : 'sidebar-item'
                      }`}
                    style={currentChatId === chat._id ? { color: '#8ab4f8' } : { color: 'var(--text-secondary)' }}
                  >
                    <div className="flex items-center gap-3 truncate min-w-0">
                      <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />
                      <span className="truncate font-medium text-[13px]">{chat.title}</span>
                    </div>
                    <button
                      onClick={(e) => deleteChat(e, chat._id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all duration-200"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.target.style.color = '#ef4444'}
                      onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Bottom Actions */}
              <div className="p-3 mx-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={deleteAllChats}
                  className="flex items-center gap-2.5 w-full p-3 text-xs rounded-lg transition-all duration-200"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.target.style.color = '#ef4444'; e.target.style.background = 'rgba(239,68,68,0.08)'; }}
                  onMouseLeave={e => { e.target.style.color = 'var(--text-muted)'; e.target.style.background = 'transparent'; }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All History
                </button>
              </div>

              {/* User Profile */}
              <div className="p-5" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--sidebar-bottom-bg)' }}>
                <div className="flex items-center gap-3 text-sm">
                  <UserButton />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[13px]" style={{ color: 'var(--text-primary)' }}>{user?.fullName}</p>
                    <p className="truncate text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Free Plan</p>
                  </div>
                </div>
              </div>
            </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ============ MAIN CHAT AREA ============ */}
        <div className="flex-1 flex flex-col h-full relative z-10 transition-all duration-300 ease-in-out">

          {/* Header */}
          <header
            className="h-16 flex items-center px-5 justify-between sticky top-0 z-10"
            style={{
              background: 'var(--header-bg)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-3">
              <button
                id="sidebar-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl transition-all duration-200"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.target.style.background = 'var(--sidebar-hover)'; e.target.style.color = 'var(--accent-blue)'; }}
                onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-muted)'; }}
              >
                {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
              </button>
              {!sidebarOpen && (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
                  <NexusLogo size={24} />
                  <span className="gradient-text font-bold text-base tracking-tight">Nexus AI</span>
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                id="theme-toggle"
                onClick={toggleTheme}
                className="theme-toggle"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                <div className="theme-toggle-knob">
                  {theme === 'dark'
                    ? <Moon className="w-3 h-3 text-white" />
                    : <Sun className="w-3 h-3 text-white" />
                  }
                </div>
              </button>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full hidden sm:inline-block" style={{ background: 'var(--glow-blue)', color: 'var(--accent-blue)', border: `1px solid var(--border-default)` }}>
                Gemini 2.5 Flash
              </span>
            </div>
          </header>

          {/* Chat Messages Area */}
          <div className={`flex-1 overflow-y-auto px-4 md:px-8 custom-scrollbar flex flex-col ${chatHistory.length === 0 ? 'py-4' : 'py-8'}`}>
            <div className={`max-w-3xl mx-auto w-full ${chatHistory.length === 0 ? 'flex-1 flex flex-col justify-center items-center' : 'space-y-8 pb-56'}`}>

              {/* ===== WELCOME SCREEN ===== */}
              {chatHistory.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  className="flex flex-col items-center justify-center text-center"
                >
                  {/* Animated Logo */}
                  <motion.div
                    className="mb-3 md:mb-5 animate-float"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <div className="relative">
                      <div className="absolute inset-0 rounded-3xl animate-pulse-glow" style={{ background: 'rgba(138,180,248,0.1)', filter: 'blur(20px)' }} />
                      <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(138,180,248,0.08)', border: '1px solid rgba(138,180,248,0.15)' }}>
                        <NexusLogo size={window.innerWidth < 640 ? 28 : 40} />
                      </div>
                    </div>
                  </motion.div>

                  <motion.h1
                    className="text-2xl sm:text-3xl md:text-5xl font-extrabold mb-2 md:mb-3 tracking-tight welcome-title"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <span style={{ color: 'var(--text-primary)' }}>Hello, </span>
                    <span className="gradient-text">{user?.firstName}</span>
                  </motion.h1>

                  <motion.p
                    className="text-xs sm:text-sm md:text-base max-w-md leading-relaxed px-4 md:px-0"
                    style={{ color: 'var(--text-muted)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    I'm Nexus, your AI-powered assistant. Ask me anything, upload documents, or analyze images.
                  </motion.p>
                </motion.div>
              ) : (
                /* ===== CHAT MESSAGES ===== */
                chatHistory.map((msg, idx) => (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    key={idx}
                    className={`flex gap-3 group relative ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-4 max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar — hidden on small phones */}
                      <div className={`w-8 h-8 rounded-xl items-center justify-center flex-shrink-0 mt-1 hidden sm:flex`} style={msg.role === 'user'
                          ? { background: 'linear-gradient(135deg, #669df6, #8ab4f8)', boxShadow: '0 4px 12px rgba(138,180,248,0.25)' }
                          : { background: 'rgba(138,180,248,0.08)', border: '1px solid rgba(138,180,248,0.15)' }
                        }>
                        {msg.role === 'user'
                          ? <User className="w-4 h-4 text-white" />
                          : <NexusLogo size={20} />
                        }
                      </div>

                      {/* Message Content */}
                      <div className="relative min-w-0">
                        {msg.role === 'user' && editingIndex === idx ? (
                          /* Edit Mode */
                          <div className="rounded-2xl p-4 w-[300px] md:w-[500px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent-blue)' }}>
                            <textarea
                              className="w-full p-2 outline-none resize-none text-sm font-medium rounded-lg"
                              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                              value={editPrompt}
                              onChange={(e) => setEditPrompt(e.target.value)}
                              rows="3"
                            />
                            <div className="flex justify-end gap-2 mt-3">
                              <button
                                onClick={() => setEditingIndex(null)}
                                className="text-xs px-4 py-2 rounded-lg font-semibold transition-all"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => askAI(null, true, idx)}
                                className="text-xs px-4 py-2 rounded-lg font-semibold text-white transition-all"
                                style={{ background: 'linear-gradient(135deg, #669df6, #8ab4f8)' }}
                              >
                                Update & Resend
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Normal Message */
                          <div className={`rounded-2xl ${msg.role === 'user' ? 'msg-user' : 'msg-ai prose-dark'}`}>
                            {msg.image && (
                              <img
                                src={msg.image}
                                className="max-w-xs md:max-w-sm rounded-xl mb-3 image-badge"
                                alt="Attached"
                              />
                            )}
                            <div className="prose prose-sm max-w-none prose-dark leading-relaxed">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{ code: CodeBlock }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>

                            {/* Desktop Hover Actions — hidden on touch */}
                            <div className={`desktop-msg-actions absolute top-0 ${msg.role === 'user' ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col gap-1`}>
                              {msg.role === 'user' && (
                                <button
                                  onClick={() => { setEditingIndex(idx); setEditPrompt(msg.content); }}
                                  className="p-2 rounded-xl transition-all duration-200"
                                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
                                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {msg.role === 'ai' && msg.content && (
                                <button
                                  onClick={() => speakMessage(msg.content, idx)}
                                  className={`p-2 rounded-xl transition-all duration-200 ${speakingIndex === idx ? 'tts-speaking' : ''}`}
                                  style={speakingIndex === idx
                                    ? { background: 'rgba(138,180,248,0.15)', border: '1px solid rgba(138,180,248,0.3)', color: 'var(--accent-blue)' }
                                    : { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }
                                  }
                                  title={speakingIndex === idx ? 'Stop speaking' : 'Read aloud'}
                                >
                                  {speakingIndex === idx ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <button
                                onClick={() => copyToClipboard(msg.content, idx)}
                                className="p-2 rounded-xl transition-all duration-200"
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              >
                                {copiedIndex === idx ? <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Mobile Inline Actions — visible on touch devices */}
                            <div className="mobile-msg-actions" style={{ display: 'none' }}>
                              {msg.role === 'user' && (
                                <button
                                  onClick={() => { setEditingIndex(idx); setEditPrompt(msg.content); }}
                                  className="p-1.5 rounded-lg transition-all"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {msg.role === 'ai' && msg.content && (
                                <button
                                  onClick={() => speakMessage(msg.content, idx)}
                                  className={`p-1.5 rounded-lg transition-all ${speakingIndex === idx ? 'tts-speaking' : ''}`}
                                  style={{ color: speakingIndex === idx ? 'var(--accent-blue)' : 'var(--text-muted)' }}
                                >
                                  {speakingIndex === idx ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <button
                                onClick={() => copyToClipboard(msg.content, idx)}
                                className="p-1.5 rounded-lg transition-all"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {copiedIndex === idx ? <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}

              {/* Typing Indicator */}
              {loadingChat && chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.content === '' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(138,180,248,0.08)', border: '1px solid rgba(138,180,248,0.15)' }}>
                    <NexusLogo size={20} />
                  </div>
                  <div className="msg-ai rounded-2xl px-5 py-4 flex items-center gap-2">
                    <span className="typing-dot w-2 h-2 rounded-full" style={{ background: 'var(--accent-blue)' }}></span>
                    <span className="typing-dot w-2 h-2 rounded-full" style={{ background: 'var(--accent-blue)' }}></span>
                    <span className="typing-dot w-2 h-2 rounded-full" style={{ background: 'var(--accent-blue)' }}></span>
                    <span className="text-xs font-medium ml-2" style={{ color: 'var(--text-muted)' }}>Nexus is thinking...</span>
                  </div>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* ============ INPUT SECTION ============ */}
          <div
            className={chatHistory.length === 0 ? 'w-full px-4 md:px-8 pb-5 pt-2 z-20 input-section-mobile' : 'absolute bottom-0 w-full px-4 md:px-8 pb-5 pt-16 z-20 input-section-mobile'}
            style={chatHistory.length === 0 ? {} : { background: 'linear-gradient(to top, var(--bg-primary) 60%, transparent 100%)' }}
          >
            <div className="max-w-3xl mx-auto relative flex flex-col">

              {/* Attachment Previews */}
              <AnimatePresence>
                {(attachedFile || attachedImage) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="flex gap-2 mb-2 px-3"
                  >
                    {attachedFile && (
                      <div className="file-badge px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-semibold">
                        <FileText className="w-3.5 h-3.5" /> {attachedFile.name}
                        <button onClick={() => setAttachedFile(null)} className="ml-1 hover:opacity-70">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {attachedImage && (
                      <div className="relative rounded-xl overflow-hidden image-badge">
                        <img src={attachedImage.base64} className="h-14 w-14 object-cover" alt="Attached" />
                        <button
                          onClick={() => setAttachedImage(null)}
                          className="absolute top-0 right-0 p-0.5 rounded-bl-lg"
                          style={{ background: 'rgba(239,68,68,0.9)', color: 'white' }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Starter Cards — above input on welcome screen */}
              {chatHistory.length === 0 && (
                <motion.div
                  className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full mb-3"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  {starterPrompts.map((sp, i) => (
                    <motion.button
                      key={i}
                      onClick={() => askAI(sp.text)}
                      className="starter-card rounded-xl text-left group"
                      style={{ padding: '0.75rem' }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.08 }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(138,180,248,0.08)', color: '#8ab4f8' }}>
                          {sp.icon}
                        </div>
                        <p className="text-xs font-medium leading-tight" style={{ color: 'var(--text-secondary)' }}>{sp.text}</p>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {/* Input Bar */}
              <div className="glass-input rounded-2xl overflow-hidden">
                <div className="flex items-end px-4 py-3">
                  {/* Left Actions */}
                  <div className="flex items-center gap-1 pb-1.5 input-actions-left">
                    <label
                      className="p-2.5 rounded-xl cursor-pointer transition-all duration-200"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.background = 'rgba(138,180,248,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <FileText className="w-5 h-5" />
                      <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                    </label>
                    <label
                      className="p-2.5 rounded-xl cursor-pointer transition-all duration-200"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-cyan)'; e.currentTarget.style.background = 'rgba(6,182,212,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <ImageIcon className="w-5 h-5" />
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>

                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    id="chat-input"
                    className="flex-1 py-3.5 px-4 outline-none resize-none text-[15px] font-medium"
                    style={{
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      maxHeight: '140px',
                      lineHeight: '1.6',
                    }}
                    placeholder="Message Nexus..."
                    rows="1"
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        askAI();
                      }
                    }}
                  />

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5 pb-1.5">
                    {/* Mic Button */}
                    <button
                      id="mic-btn"
                      onClick={toggleListening}
                      className={`p-2.5 rounded-xl transition-all duration-200 ${isListening ? 'mic-listening' : ''}`}
                      style={isListening
                        ? { color: '#ef4444', background: 'rgba(239,68,68,0.1)' }
                        : { color: 'var(--text-muted)' }
                      }
                      onMouseEnter={e => { if (!isListening) { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.background = 'rgba(138,180,248,0.08)'; } }}
                      onMouseLeave={e => { if (!isListening) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; } }}
                    >
                      <Mic className="w-5 h-5" />
                    </button>

                    {/* Stop / Send Button */}
                    {loadingChat ? (
                      <button
                        id="stop-btn"
                        onClick={stopGeneration}
                        className="p-2.5 rounded-xl transition-all duration-200"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        <StopCircle className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        id="send-btn"
                        onClick={() => askAI()}
                        disabled={!prompt.trim() && !attachedFile && !attachedImage}
                        className="btn-send p-2.5 rounded-xl text-white"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-center text-[11px] mt-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                Nexus AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </div>

        {/* ============ LIVE CODE PREVIEW MODAL ============ */}
        <AnimatePresence>
          {previewCode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              onClick={closePreview}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="preview-modal relative w-[90vw] max-w-4xl h-[75vh] rounded-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                {/* Preview Header */}
                <div className="preview-modal-header flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
                      <span className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
                      <span className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4" style={{ color: '#22c55e' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Live Preview</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                        {previewLang}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={closePreview}
                    className="p-2 rounded-xl transition-all duration-200"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Preview Iframe */}
                <div className="flex-1 bg-white relative">
                  <iframe
                    title="Live Code Preview"
                    srcDoc={buildPreviewHtml(previewCode, previewLang)}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-modals"
                    style={{ background: '#ffffff' }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </SignedIn>
    </div>
  );
}

export default App;