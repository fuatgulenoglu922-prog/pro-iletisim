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
    // Mobil giriş dönüşünü yakala
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        console.log("Redirect girişi başarılı");
      }
    }).catch((err) => {
      if (err.code === 'auth/unauthorized-domain') {
        setError("HATA: Firebase Console'da 'localhost' alan adı ekli değil!");
      } else {
        setError("Giriş Hatası: " + err.message);
      }
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
        } catch (err) {}
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
      // Android APK için en sağlam yöntem Redirect'tir
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        setError("Firebase Console > Authentication > Settings > Authorized Domains kısmına 'localhost' eklemeniz gerekiyor.");
      } else {
        setError("Bağlantı Hatası: " + err.message);
      }
      setLoginLoading(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#050505]">
      <Loader2 className="w-10 h-10 text-white animate-spin opacity-20" />
    </div>
  );

  if (!user) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505] p-6 text-white text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full glass p-8 rounded-3xl space-y-8">
        <h1 className="text-4xl font-bold">Pro İletişim</h1>
        <p className="text-white/50 text-sm">Giriş yapabilmek için lütfen bekleyin...</p>

        <button
          onClick={handleLogin}
          disabled={loginLoading}
          className="w-full pro-gradient p-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Google ile Giriş Yap"}
          <ChevronRight className="w-5 h-5" />
        </button>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] leading-relaxed">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex bg-[#050505] text-white">
      <div className="m-auto text-center space-y-4">
        <div className="w-20 h-20 rounded-full overflow-hidden mx-auto border-2 border-white/10">
          <img src={user.photoURL} alt="" />
        </div>
        <h2 className="text-2xl font-bold">Hoşgeldin, {user.displayName}</h2>
        <button onClick={() => signOut(auth)} className="px-6 py-2 glass rounded-xl text-xs opacity-50 hover:opacity-100">Çıkış Yap</button>
      </div>
    </div>
  );
}
