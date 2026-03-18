import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, db, googleProvider, signInWithRedirect, onAuthStateChanged, signOut, getRedirectResult
} from './firebase';
import { User } from './types';
import { Loader2, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

const REPO_OWNER = "fuatgulenoglu922-prog";
const REPO_NAME = "pro-iletisim";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // KÖKTEN ÇÖZÜM: Chrome'dan dönüşü yakala ve oturumu zorla başlat
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("Giriş başarıyla yakalandı.");
        }
      } catch (err: any) {
        console.error("Redirect hatası:", err);
        if (err.code === 'auth/unauthorized-domain') {
          setError("HATA: Firebase'e 'localhost' eklememişsiniz!");
        } else if (err.code === 'auth/internal-error') {
          setError("Beyaz ekran hatası: SHA-1 kodunuzu Firebase Console'a eklemelisiniz.");
        }
      }
    };
    checkRedirect();

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
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      setError("Bağlantı Hatası: " + err.message);
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
        <h1 className="text-4xl font-bold tracking-tighter uppercase">Pro İletişim</h1>
        <p className="text-white/40 text-xs italic">Sistem SHA-1 doğrulaması bekliyor olabilir.</p>

        <button
          onClick={handleLogin}
          disabled={loginLoading}
          className="w-full pro-gradient p-5 rounded-[2rem] font-black flex items-center justify-center gap-3 active:scale-95 transition-all shadow-2xl shadow-indigo-500/20"
        >
          {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "GİRİŞ YAP"}
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
      <div className="m-auto text-center space-y-8 p-12 glass rounded-[3rem] border-white/5 shadow-2xl">
        <div className="w-32 h-32 rounded-full overflow-hidden border-8 border-indigo-500/10 mx-auto shadow-inner ring-4 ring-indigo-500/20">
          <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="space-y-2">
          <p className="text-indigo-400 font-black text-sm tracking-[0.3em] uppercase opacity-50">SİSTEME ERİŞİLDİ</p>
          <h2 className="text-4xl font-black uppercase leading-tight tracking-tighter">{user.displayName}</h2>
          <div className="inline-block px-4 py-1 bg-white/5 rounded-full border border-white/10 mt-4">
            <p className="text-white/30 font-mono text-[10px] uppercase">Kullanıcı ID: #{user.id4}</p>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="w-full py-4 bg-white/5 hover:bg-red-500/10 border border-white/5 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all hover:border-red-500/20">GÜVENLİ ÇIKIŞ</button>
      </div>
    </div>
  );
}
