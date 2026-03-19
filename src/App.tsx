import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, db, onAuthStateChanged, signOut,
  doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc
} from './firebase';
import { User, Message, Friendship, OperationType, FirestoreErrorInfo } from './types';
import {
  Send, User as UserIcon, LogOut, Search, Sparkles, MessageSquare, Shield, Crown,
  Zap, Volume2, Lock, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const VOICE_CHANGERS = [
  "Robot", "Helyum", "Dev", "Sincap", "Mağara", "Radyo", "Sualtı", "Telefon", "Uzaylı", "Canavar",
  "Katedral", "Stadyum", "Küçük Oda", "Büyük Salon", "Metalik", "Yankı", "Ters", "Hızlı", "Yavaş", "Kalın",
  "İnce", "Korkunç", "Komik", "Ciddi", "Fısıltı", "Bağırma", "Mekanik", "Elektrikli", "Buz", "Ateş",
  "Rüzgar", "Yağmur", "Gök Gürültüsü", "Kuş", "Kedi", "Köpek", "Aslan", "Kurt", "Kartal", "Ejderha",
  "Siber", "Neon", "Retro", "Gelecek", "Antik", "Büyülü", "Karanlık", "Aydınlık", "Efsanevi", "Tanrısal"
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [activeChat, setActiveChat] = useState<string | 'AI' | null>(null);
  const [inputText, setInputText] = useState('');
  const [proPassword, setProPassword] = useState('');
  const [showProModal, setShowProModal] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [searchId, setSearchId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // OTOMATİK GİRİŞ SİSTEMİ (Test amaçlı CEO olarak başlatır)
    const mockUser: User = {
      uid: "CEO_ACCOUNT_ID",
      displayName: "CEO Fuat",
      email: "fuatgulenoglu922@gmail.com",
      id4: "0001",
      role: "CEO",
      isPro: true,
      photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=CEO"
    };

    // Uygulama açıldığında direkt bu kullanıcıyla başlar
    setTimeout(() => {
      setUser(mockUser);
      setLoading(false);
    }, 1500);

    /* Firebase gerçek girişi devredışı bırakıldı
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // ...
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
    */
  }, []);

  useEffect(() => {
    if (user) {
      socketRef.current = io();
      socketRef.current.emit('join_room', user.uid);
      socketRef.current.on('receive_message', (message: Message) => {
        setMessages((prev) => [...prev, message]);
      });
      return () => { socketRef.current?.disconnect(); };
    }
  }, [user]);

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !activeChat) return;
    const newMessage: Message = {
      senderId: user.uid,
      receiverId: activeChat,
      text: inputText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
  };

  if (loading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505] space-y-4">
      <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      <p className="text-white/20 font-mono text-xs uppercase tracking-[0.3em]">Sistem Yükleniyor</p>
    </div>
  );

  return (
    <div className="h-screen w-screen flex bg-[#050505] overflow-hidden text-white">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/10 flex flex-col glass">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 p-1 border border-white/10">
                <img src={user?.photoURL} alt="" className="w-full h-full rounded-xl object-cover" />
              </div>
              <div>
                <p className="font-bold text-sm tracking-tight">{user?.displayName}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-white/50 border border-white/5">#{user?.id4}</span>
                  <Crown className="w-3 h-3 text-yellow-400" />
                </div>
              </div>
            </div>
            <button className="p-2 hover:bg-white/5 rounded-xl transition-colors">
              <LogOut className="w-5 h-5 text-white/20" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              placeholder="Sistemde Ara..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          <p className="px-3 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-4">Ana Kanallar</p>
          <button
            onClick={() => setActiveChat('AI')}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-[2rem] transition-all group",
              activeChat === 'AI' ? "bg-white/10 border border-white/10" : "hover:bg-white/5"
            )}
          >
            <div className="w-10 h-10 rounded-2xl pro-gradient flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">Pro AI</p>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Aktif Sistem</p>
            </div>
          </button>
        </div>

        <div className="p-4">
          <div className="w-full pro-gradient p-5 rounded-[2.5rem] flex items-center justify-between shadow-2xl shadow-indigo-500/20">
            <div className="flex items-center gap-3">
              <div className="bg-black/20 p-2 rounded-xl">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest">CEO PANEL</span>
            </div>
            <Shield className="w-4 h-4 opacity-50" />
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {activeChat ? (
          <>
            <div className="p-8 border-b border-white/10 flex items-center justify-between glass">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-[2rem] pro-gradient flex items-center justify-center shadow-2xl">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="font-black text-2xl tracking-tighter uppercase">Pro AI Asistan</h2>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Yapay Zeka Çevrimiçi</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {messages.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, x: msg.senderId === user?.uid ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i}
                  className={cn("flex flex-col max-w-[70%]", msg.senderId === user?.uid ? "ml-auto items-end" : "items-start")}
                >
                  <div className={cn(
                    "p-5 rounded-[2rem] text-sm leading-relaxed shadow-xl",
                    msg.senderId === user?.uid
                      ? "bg-white text-black font-bold rounded-tr-none"
                      : "glass rounded-tl-none border-white/5"
                  )}>
                    <Markdown>{msg.text}</Markdown>
                  </div>
                  <span className="text-[9px] text-white/10 mt-3 font-black uppercase tracking-widest">
                    İletildi • {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </motion.div>
              ))}
              <div ref={scrollRef} />
            </div>

            <div className="p-8">
              <div className="glass p-3 rounded-[2.5rem] flex items-center gap-3 border-white/5 shadow-2xl">
                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Sisteme komut verin..."
                  className="flex-1 bg-transparent border-none focus:outline-none px-6 text-sm font-medium"
                />
                <button
                  onClick={sendMessage}
                  className="w-12 h-12 bg-white text-black rounded-[1.5rem] flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-8">
            <div className="w-32 h-32 rounded-[3rem] glass flex items-center justify-center border-white/5 shadow-2xl animate-bounce">
              <MessageSquare className="w-12 h-12 text-indigo-500" />
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black uppercase tracking-tighter">İletişim Paneli</h3>
              <p className="text-white/20 max-w-sm mx-auto text-sm font-medium">Güvenli ve şifreli CEO hattı aktif. Görüşmeye başlamak için soldan bir birim seçin.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
