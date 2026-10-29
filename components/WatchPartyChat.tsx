import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageSquare } from 'lucide-react';
import { getSupabase, getCurrentUser } from '../services/bd';

interface Message {
  id: string;
  wikidataid: string;
  userid: string;
  email: string;
  message: string;
  created_at: string;
}

interface WatchPartyChatProps {
  roomId: string;
}

export const WatchPartyChat: React.FC<WatchPartyChatProps> = ({ roomId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initChat = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      const supabase = await getSupabase();
      if (!supabase) return;

      // 1. Carregar mensagens iniciais
      const { data } = await supabase
        .from('chatmovie')
        .select('*')
        .eq('wikidataid', roomId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (data) setMessages(data);

      // 2. Inscrever em tempo real
      const channel = supabase
        .channel(`watch_party:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chatmovie',
            filter: `wikidataid=eq.${roomId}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    initChat();
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const supabase = await getSupabase();
    if (!supabase) return;

    const { error } = await supabase.from('chatmovie').insert([{
      wikidataid: roomId,
      userid: user.id,
      email: user.email,
      message: newMessage.trim()
    }]);

    if (error) {
      console.error("Erro ao enviar mensagem:", error.message);
    } else {
      setNewMessage('');
    }
  };

  return (
    <div className="d-flex flex-column h-100 bg-dark border-start border-secondary" style={{ width: '300px' }}>
      <div className="p-3 border-bottom border-secondary bg-black bg-opacity-50 d-flex align-items-center gap-2">
        <MessageSquare size={18} className="text-danger" />
        <h6 className="m-0 fw-bold text-uppercase small tracking-wider">Cine-Clube Chat</h6>
      </div>

      <div className="flex-grow-1 overflow-auto p-3 custom-scrollbar d-flex flex-column gap-3">
        {messages.length === 0 ? (
          <div className="text-center py-5 opacity-20">
            <MessageSquare size={32} className="mx-auto mb-2" />
            <p className="small">Comece a conversa!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`d-flex flex-column ${msg.userid === user?.id ? 'align-items-end' : 'align-items-start'}`}>
              <div className="d-flex align-items-center gap-1 mb-1">
                <User size={10} className="text-secondary" />
                <span className="xsmall text-secondary fw-bold">{msg.email.split('@')[0]}</span>
              </div>
              <div 
                className={`p-2 rounded-3 small ${msg.userid === user?.id ? 'bg-danger text-white' : 'bg-secondary bg-opacity-25 text-white'}`}
                style={{ maxWidth: '90%', wordBreak: 'break-word' }}
              >
                {msg.message}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 border-top border-secondary bg-black bg-opacity-30">
        <div className="input-group input-group-sm">
          <input
            type="text"
            className="form-control bg-dark text-white border-secondary"
            placeholder="Sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button className="btn btn-danger" type="submit">
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
};
