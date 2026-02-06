import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Sparkles, Bot } from 'lucide-react';
import { Movie } from '../types';
import { createChatSession } from '../services/geminiService';
import { Chat, GenerateContentResponse } from "@google/genai";

interface AiConciergeProps {
    catalog: Movie[];
    language: string;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export const AiConcierge: React.FC<AiConciergeProps> = ({ catalog, language }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const toggleOpen = () => {
        setIsOpen(!isOpen);
        if (!isOpen && messages.length === 0) {
            // Initial greeting
            setMessages([{ 
                role: 'model', 
                text: language === 'pt' 
                    ? "Olá! Eu sou o Cine-Sage. Posso recomendar clássicos do nosso catálogo ou responder perguntas sobre a história do cinema. Como posso ajudar?" 
                    : "Hello! I am Cine-Sage. I can recommend classics from our catalog or answer questions about film history. How can I help?" 
            }]);
        }
    };

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            let chat = chatSession;
            if (!chat) {
                chat = createChatSession(catalog, language);
                setChatSession(chat);
            }

            // Stream response
            let fullResponse = "";
            const resultStream = await chat.sendMessageStream({ message: userMsg });
            
            setMessages(prev => [...prev, { role: 'model', text: "" }]);

            for await (const chunk of resultStream) {
                 const c = chunk as GenerateContentResponse;
                 const text = c.text || "";
                 fullResponse += text;
                 
                 setMessages(prev => {
                     const newHistory = [...prev];
                     newHistory[newHistory.length - 1] = { role: 'model', text: fullResponse };
                     return newHistory;
                 });
            }

        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="position-fixed bottom-0 end-0 m-4 z-3" style={{ zIndex: 9999 }}>
            {!isOpen && (
                <button 
                    onClick={toggleOpen}
                    className="btn btn-primary-custom rounded-circle p-3 shadow-lg hover-scale d-flex align-items-center justify-content-center"
                    style={{ width: '60px', height: '60px' }}
                    title="AI Concierge"
                >
                    <Bot size={28} />
                </button>
            )}

            {isOpen && (
                <div className="card bg-dark border-secondary shadow-lg d-flex flex-column" style={{ width: '350px', height: '500px', borderRadius: '12px' }}>
                    {/* Header */}
                    <div className="card-header bg-gradient-to-r from-primary-custom to-black border-bottom border-secondary d-flex justify-content-between align-items-center py-3">
                        <div className="d-flex align-items-center gap-2">
                            <Sparkles size={18} className="text-warning" />
                            <h6 className="m-0 fw-bold text-white">Cine-Sage AI</h6>
                        </div>
                        <button onClick={toggleOpen} className="btn btn-sm btn-icon text-white-50 hover-text-white p-0">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="card-body overflow-auto custom-scrollbar p-3 d-flex flex-column gap-3 bg-black bg-opacity-50">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`d-flex ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                                <div 
                                    className={`p-2 px-3 rounded-3 small lh-sm ${msg.role === 'user' ? 'bg-primary-custom text-white' : 'bg-secondary bg-opacity-25 text-light border border-secondary'}`}
                                    style={{ maxWidth: '85%' }}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="card-footer bg-dark border-top border-secondary p-2">
                        <div className="input-group">
                            <input 
                                type="text" 
                                className="form-control bg-black text-white border-secondary small shadow-none"
                                placeholder={language === 'pt' ? "Pergunte algo..." : "Ask something..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                disabled={isLoading}
                            />
                            <button 
                                className="btn btn-outline-secondary text-white border-secondary" 
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};