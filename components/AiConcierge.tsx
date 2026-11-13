import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Sparkles, Bot } from 'lucide-react';
import { Movie, AppLanguage } from '../types';
import { APP_TRANSLATIONS } from '../constants';
import { streamAssistantChat, ChatHistoryMessage } from '../services/geminiService';

interface AiConciergeProps {
    catalog: Movie[];
    language: AppLanguage | string;
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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const t = APP_TRANSLATIONS[language as AppLanguage] || APP_TRANSLATIONS['en'];

    const toggleOpen = () => {
        setIsOpen(!isOpen);
        if (!isOpen && messages.length === 0) {
            // Initial greeting
            setMessages([{ 
                role: 'model', 
                text: t.aiGreeting || (language === 'pt' 
                    ? "Olá! Eu sou o Assistente IA. Posso recomendar clássicos do nosso catálogo ou responder perguntas sobre a história do cinema. Como posso ajudar?" 
                    : "Hello! I am Assistant AI. I can recommend classics from our catalog or answer questions about film history. How can I help?") 
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
        const previousMessages: ChatHistoryMessage[] = messages;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            let fullResponse = "";
            setMessages(prev => [...prev, { role: 'model', text: "" }]);

            await streamAssistantChat({
                catalog,
                language,
                history: previousMessages,
                message: userMsg,
                onChunk: (chunkText) => {
                    fullResponse += chunkText;
                    setMessages(prev => {
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1] = { role: 'model', text: fullResponse };
                        return newHistory;
                    });
                },
            });
        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length - 1].role === 'model' && updated[updated.length - 1].text === "") {
                    updated[updated.length - 1] = { role: 'model', text: "Sorry, I encountered an error. Please try again." };
                    return updated;
                }
                return [...updated, { role: 'model', text: "Sorry, I encountered an error. Please try again." }];
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="position-fixed bottom-0 end-0 m-4 z-3" style={{ zIndex: 9999 }}>
            {!isOpen && (
                <button 
                    onClick={toggleOpen}
                    className="btn btn-dark position-fixed rounded-pill shadow-lg d-flex align-items-center gap-2 border border-warning hover-scale side-collapsible-btn"
                    style={{ 
                        bottom: '24px', 
                        right: '16px', 
                        zIndex: 9999, 
                        padding: '8px 16px',
                        boxShadow: '0 4px 20px rgba(255, 193, 7, 0.45)',
                        background: 'rgba(30, 25, 10, 0.95)'
                    }}
                    title={t.assistantAi || 'Assistant AI'}
                >
                    <Bot size={20} className="text-warning flex-shrink-0" />
                    <span className="fw-bold text-white small text-nowrap label-text">{t.assistantAi || 'Assistant AI'}</span>
                </button>
            )}

            {isOpen && (
                <div className="card bg-dark border-secondary shadow-lg d-flex flex-column" style={{ width: '350px', height: '500px', borderRadius: '12px' }}>
                    {/* Header */}
                    <div className="card-header bg-gradient-to-r from-primary-custom to-black border-bottom border-secondary d-flex justify-content-between align-items-center py-3">
                        <div className="d-flex align-items-center gap-2">
                            <Bot size={18} className="text-warning" />
                            <h6 className="m-0 fw-bold text-white">{t.assistantAi || 'Assistant AI'}</h6>
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
                                placeholder={t.aiPlaceholder || "Ask something..."}
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