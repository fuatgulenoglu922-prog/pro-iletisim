import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut, getRedirectResult
} from './firebase';
import { User, Message, Friendship, OperationType, FirestoreErrorInfo } from './types';
import { 
  Send, User as UserIcon, LogOut, Search, Plus, Settings, 
  Sparkles, Mic, MessageSquare, Shield, Crown, Terminal,
  ChevronRight, Hash, Zap, Volume2, Lock, Download, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const APP_VERSION = "1.0.0";
const REPO_OWNER = "fuatgulenoglu922-prog";
const REPO_NAME = "pro-iletisim";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [activeChat, setActiveChat] = useState<string | 'AI' | null>(null);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Redirect dönüşünü kontrol et
    getRedirectResult(auth).catch((err) => {
      console.error("Redirect hatası:", err);
      setError("Giriş yönlendirmesi başarısız: " + err.message);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            const id4 = Math.floor(1000 + Math.random() * 9000).toString();
            const newUser: User = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'İsimsiz',
              email: firebaseUser.email || '',
              id4,
              role: firebaseUser.email === 'fuatgulenoglu922@gmail.com' ? 'CEO' : 'User',
              isPro: false,
              photoURL: firebaseUser.photoURL || undefined
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
          }
        } catch (err) {
          setError("Kullanıcı verisi alınamadı.");
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    setError(null);
    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err: any) {
      setError("Giriş hatası: " + (err.message || "Bilinmeyen hata"));
      setLoginLoading(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#050505]">
      <Loader2 className="w-10 h-10 text-white animate-spin opacity-20" />
    </div>
  );

  if (!user) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505] p-6 text-white">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full glass p-8 rounded-3xl text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Pro İletişim</h1>
          <p className="text-white/50">Modern ve profesyonel iletişim.</p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loginLoading}
          className={cn(
            "w-full pro-gradient p-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all",
            loginLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"
          )}
        >
          {loginLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Giriş Yapılıyor...
            </>
          ) : (
            <>
              Google ile Giriş Yap
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex bg-[#050505] text-white overflow-hidden">
      {/* ... (Geri kalan UI aynı kalacak, sadece giriş kısmını düzelttik) ... */}
      <div className="flex-1 flex items-center justify-center">Giriş Yapıldı! Hoşgeldin {user.displayName}</div>
    </div>
  );
}
