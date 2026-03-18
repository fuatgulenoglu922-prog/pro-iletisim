import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, onAuthStateChanged, signOut,
  browserPopupRedirectResolver, signInWithRedirect
} from './firebase';
import { User, Message, Friendship } from './types';
import { 
  Send, User as UserIcon, LogOut, Search, Sparkles, MessageSquare, Loader2, ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import Markdown from 'react-markdown';

const APP_VERSION = "1.0.0";
const REPO_OWNER = "fuatgulenoglu922-prog";
const REPO_NAME = "pro-iletisim";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const { doc, getDoc, setDoc } = await import('./firebase');
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
      // Kesin çözüm için Popup metoduna geçiyoruz
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    } catch (err: any) {
      console.error("Giriş hatası:", err);
      // Eğer popup engellenirse Redirect'e düşüyoruz (Yedek plan)
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr: any) {
        setError("Giriş Hatası: " + (redirectErr.message || "Bilinmeyen hata"));
        setLoginLoading(false);
      }
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
        <p className="text-white/50 text-sm font-medium italic">Sorunlar giderildi, giriş yapmaya hazırsınız.</p>

        <button
          onClick={handleLogin}
          disabled={loginLoading}
          className="w-full pro-gradient p-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-indigo-500/10"
        >
          {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Google ile Giriş Yap"}
          <ChevronRight className="w-5 h-5" />
        </button>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px] leading-relaxed">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex bg-[#050505] text-white">
      <div className="m-auto text-center space-y-6">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-indigo-500/20 shadow-2xl">
            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-[#050505]"></div>
        </div>
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight tracking-wide uppercase">HOŞGELDİN</h2>
          <p className="text-indigo-400 font-bold text-xl">{user.displayName}</p>
          <p className="text-white/30 font-mono text-xs pt-2">SİSTEM AKTİF • #{user.id4}</p>
        </div>
        <button onClick={() => signOut(auth)} className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold transition-all">GÜVENLİ ÇIKIŞ YAP</button>
      </div>
    </div>
  );
}
