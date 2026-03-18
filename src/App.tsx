import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut,
  doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp 
} from './firebase';
import { User, Message, Friendship, OperationType, FirestoreErrorInfo } from './types';
import { 
  Send, User as UserIcon, LogOut, Search, Plus, Settings, 
  Sparkles, Mic, MessageSquare, Shield, Crown, Terminal,
  ChevronRight, Hash, Zap, Volume2, Lock, Download
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
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const response = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/package.json`);
        if (response.ok) {
          const data = await response.json();
          if (data.version !== APP_VERSION) setUpdateAvailable(true);
        }
      } catch (err) {}
    };
    checkUpdates();

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

  useEffect(() => {
    if (user) {
      socketRef.current = io();
      socketRef.current.emit('join_room', user.uid);
      socketRef.current.on('receive_message', (m: Message) => setMessages(p => [...p, m]));

      const q = query(collection(db, 'friendships'), where('status', '==', 'accepted'));
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const friendIds: string[] = [];
        snapshot.docs.forEach(doc => {
          const data = doc.data() as Friendship;
          if (data.user1 === user.uid) friendIds.push(data.user2);
          if (data.user2 === user.uid) friendIds.push(data.user1);
        });

        const friendProfiles: User[] = [];
        for (const id of friendIds) {
          const profileDoc = await getDoc(doc(db, 'users', id));
          if (profileDoc.exists()) friendProfiles.push(profileDoc.data() as User);
        }
        setFriends(friendProfiles);
      });

      return () => {
        socketRef.current?.disconnect();
        unsubscribe();
      };
    }
  }, [user]);

  useEffect(() => {
    if (activeChat && user && activeChat !== 'AI') {
      const q = query(
        collection(db, 'messages'),
        where('senderId', 'in', [user.uid, activeChat]),
        where('receiverId', 'in', [user.uid, activeChat])
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Message))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setMessages(msgs);
      });

      return () => unsubscribe();
    }
  }, [activeChat, user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async () => {
    try {
      // Mobil cihazlarda Redirect, webde Popup kullanıyoruz
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      setError('Giriş başarısız. Firebase domain ayarlarını kontrol edin.');
    }
  };

  const handleLogout = () => signOut(auth);

  const sendMessage = async () => {
    if (!inputText.trim() || !user || !activeChat) return;

    const newMessage: Message = {
      senderId: user.uid,
      receiverId: activeChat,
      text: inputText,
      timestamp: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'messages'), newMessage);
      socketRef.current?.emit('send_message', { room: activeChat, message: newMessage });
      setInputText('');
    } catch (err) {}
  };

  const activatePro = async () => {
    if (proPassword === 'ALİ' && user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { ...user, isPro: true }, { merge: true });
        setUser({ ...user, isPro: true });
        setShowProModal(false);
        setProPassword('');
      } catch (err) {}
    } else {
      setError('Hatalı şifre!');
    }
  };

  const addFriend = async () => {
    if (!searchId || !user) return;
    try {
      const userQuery = query(collection(db, 'users'), where('id4', '==', searchId));
      onSnapshot(userQuery, (snap) => {
        if (!snap.empty) {
          const targetUser = snap.docs[0].data() as User;
          if (targetUser.uid === user.uid) return;
          addDoc(collection(db, 'friendships'), {
            user1: user.uid,
            user2: targetUser.uid,
            status: 'accepted'
          });
          setSearchId('');
        }
      });
    } catch (err) {}
  };

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#050505]">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full" />
    </div>
  );

  if (!user) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505] p-6 text-white">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full glass p-8 rounded-3xl text-center space-y-8">
        <h1 className="text-4xl font-bold">Pro İletişim</h1>
        <p className="text-white/50">Modern ve profesyonel iletişim sistemi.</p>
        <button onClick={handleLogin} className="w-full pro-gradient p-4 rounded-2xl font-bold flex items-center justify-center gap-3">
          Google ile Giriş Yap <ChevronRight className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex bg-[#050505] text-white overflow-hidden">
      <div className="w-80 border-r border-white/10 flex flex-col glass">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                {user.photoURL ? <img src={user.photoURL} alt="" /> : <UserIcon className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-bold text-sm">{user.displayName}</p>
                <span className="id-badge">#{user.id4}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/5 rounded-xl"><LogOut className="w-5 h-5 text-white/50" /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input value={searchId} onChange={(e) => setSearchId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFriend()} placeholder="Arkadaş ekle (#ID)" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {updateAvailable && (
            <button onClick={() => window.open(`https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`, '_blank')} className="w-full bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-2xl text-yellow-500 text-xs font-bold animate-pulse">Yeni Versiyon Mevcut!</button>
          )}
          <button onClick={() => setActiveChat('AI')} className={cn("w-full flex items-center gap-3 p-3 rounded-2xl", activeChat === 'AI' ? "bg-white/10" : "")}>
            <div className="w-10 h-10 rounded-full pro-gradient flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
            <div className="text-left"><p className="text-sm font-bold">Pro AI</p></div>
          </button>
          {friends.map(f => (
            <button key={f.uid} onClick={() => setActiveChat(f.uid)} className={cn("w-full flex items-center gap-3 p-3 rounded-2xl", activeChat === f.uid ? "bg-white/10" : "")}>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">{f.photoURL ? <img src={f.photoURL} alt="" /> : <UserIcon className="w-5 h-5" />}</div>
              <div className="text-left"><p className="text-sm font-bold">{f.displayName}</p><p className="text-[10px] opacity-30">#{f.id4}</p></div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            <div className="p-6 border-b border-white/10 flex items-center justify-between glass">
              <h2 className="font-bold text-lg">{activeChat === 'AI' ? 'Pro AI Asistan' : friends.find(f => f.uid === activeChat)?.displayName}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex flex-col max-w-[80%]", msg.senderId === user.uid ? "ml-auto items-end" : "items-start")}>
                  <div className={cn("p-4 rounded-2xl text-sm", msg.senderId === user.uid ? "bg-white text-black" : "glass")}>
                    {msg.senderId === 'AI' ? <Markdown>{msg.text}</Markdown> : msg.text}
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <div className="p-6">
              <div className="glass p-2 rounded-3xl flex items-center gap-2">
                <input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Bir mesaj yazın..." className="flex-1 bg-transparent border-none focus:outline-none px-4 text-sm" />
                <button onClick={sendMessage} className="p-3 bg-white text-black rounded-2xl"><Send className="w-5 h-5" /></button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-12"><div className="space-y-2"><MessageSquare className="w-10 h-10 mx-auto opacity-20" /><h3 className="text-xl font-bold">Sohbet Başlatın</h3></div></div>
        )}
      </div>
    </div>
  );
}
