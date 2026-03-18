import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, onAuthStateChanged, signOut, 
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
const REPO_OWNER = "fuatgulenoglu"; // Burayı kendi GitHub kullanıcı adınla değiştir
const REPO_NAME = "pro-iletisim";    // Burayı repo adınla değiştir

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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified || undefined,
      isAnonymous: auth.currentUser?.isAnonymous || undefined,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Hatası: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
    // Güncelleme Kontrolü
    const checkUpdates = async () => {
      try {
        const response = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/package.json`);
        if (response.ok) {
          const data = await response.json();
          if (data.version !== APP_VERSION) {
            setUpdateAvailable(true);
          }
        }
      } catch (err) {
        console.error("Güncelleme kontrolü başarısız:", err);
      }
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
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        }
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

      socketRef.current.on('receive_message', (message: Message) => {
        setMessages((prev) => [...prev, message]);
      });

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
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'friendships'));

      return () => {
        socketRef.current?.disconnect();
        unsubscribe();
      };
    }
  }, [user]);

  useEffect(() => {
    if (activeChat && user) {
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
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'messages'));

      return () => unsubscribe();
    }
  }, [activeChat, user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError('Giriş yapılamadı. Lütfen tekrar deneyin.');
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
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  };

  const activatePro = async () => {
    if (proPassword === 'ALİ' && user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { ...user, isPro: true }, { merge: true });
        setUser({ ...user, isPro: true });
        setShowProModal(false);
        setProPassword('');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
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
    } catch (err) {
      setError('Kullanıcı bulunamadı.');
    }
  };

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#050505]">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full"
      />
    </div>
  );

  if (!user) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505] p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass p-8 rounded-3xl text-center space-y-8"
      >
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Pro İletişim</h1>
          <p className="text-white/50">Modern, minimalist ve profesyonel iletişim.</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-left">
          <div className="glass p-4 rounded-2xl space-y-2">
            <Shield className="w-6 h-6 text-indigo-400" />
            <p className="text-xs font-medium">Güvenli</p>
          </div>
          <div className="glass p-4 rounded-2xl space-y-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            <p className="text-xs font-medium">Hızlı</p>
          </div>
        </div>

        <button 
          onClick={handleLogin}
          className="w-full pro-gradient p-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Google ile Giriş Yap
          <ChevronRight className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex bg-[#050505] overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/10 flex flex-col glass">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <UserIcon className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-bold text-sm">{user.displayName}</p>
                <div className="flex items-center gap-1.5">
                  <span className="id-badge">#{user.id4}</span>
                  {user.role === 'CEO' && <Crown className="w-3 h-3 text-yellow-400" />}
                  {user.role === 'Leader' && <Shield className="w-3 h-3 text-indigo-400" />}
                </div>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
              <LogOut className="w-5 h-5 text-white/50" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input 
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFriend()}
              placeholder="Arkadaş ekle (#ID)"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-white/20 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          {updateAvailable && (
            <div className="px-3 mb-4">
              <button
                onClick={() => window.open(`https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`, '_blank')}
                className="w-full bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-2xl flex items-center gap-3 text-yellow-500 animate-pulse"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs font-bold">Yeni Versiyon Mevcut!</span>
              </button>
            </div>
          )}

          <p className="px-3 text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Asistan</p>
          <button 
            onClick={() => setActiveChat('AI')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-2xl transition-all glass-hover",
              activeChat === 'AI' ? "bg-white/10 border-white/20" : "border-transparent"
            )}
          >
            <div className="w-10 h-10 rounded-full pro-gradient flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">Pro AI</p>
              <p className="text-xs text-white/50">Her zaman hazır</p>
            </div>
          </button>

          <p className="px-3 text-[10px] font-bold text-white/30 uppercase tracking-widest mt-6 mb-2">Arkadaşlar</p>
          {friends.map(friend => (
            <button 
              key={friend.uid}
              onClick={() => setActiveChat(friend.uid)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-2xl transition-all glass-hover",
                activeChat === friend.uid ? "bg-white/10 border-white/20" : "border-transparent"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                {friend.photoURL ? <img src={friend.photoURL} alt="" referrerPolicy="no-referrer" /> : <UserIcon className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">{friend.displayName}</p>
                <p className="text-[10px] font-mono opacity-30">#{friend.id4}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4">
          {!user.isPro ? (
            <button 
              onClick={() => setShowProModal(true)}
              className="w-full glass p-4 rounded-2xl flex items-center justify-between group hover:border-white/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span className="text-sm font-bold">Pro'ya Geç</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-all" />
            </button>
          ) : (
            <div className="w-full pro-gradient p-4 rounded-2xl flex items-center gap-3">
              <Crown className="w-5 h-5" />
              <span className="text-sm font-bold">Pro Üye</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {activeChat ? (
          <>
            <div className="p-6 border-b border-white/10 flex items-center justify-between glass">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  activeChat === 'AI' ? "pro-gradient" : "bg-white/5"
                )}>
                  {activeChat === 'AI' ? <Sparkles className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                </div>
                <div>
                  <h2 className="font-bold text-lg">
                    {activeChat === 'AI' ? 'Pro AI Asistan' : friends.find(f => f.uid === activeChat)?.displayName}
                  </h2>
                  <p className="text-xs text-white/50">
                    {activeChat === 'AI' ? 'Yapay zeka sistemi aktif' : 'Çevrimiçi'}
                  </p>
                </div>
              </div>
              
              {user.isPro && (
                <div className="flex items-center gap-2">
                  <div className="glass px-3 py-1.5 rounded-full flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {selectedVoice || 'Ses Değiştirici'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i} 
                  className={cn(
                    "flex flex-col max-w-[80%]",
                    msg.senderId === user.uid ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed",
                    msg.senderId === user.uid 
                      ? "bg-white text-black font-medium rounded-tr-none" 
                      : "glass rounded-tl-none"
                  )}>
                    {msg.senderId === 'AI' ? (
                      <div className="markdown-body prose prose-invert prose-sm max-w-none">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                  <span className="text-[10px] text-white/20 mt-2 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </motion.div>
              ))}
              <div ref={scrollRef} />
            </div>

            <div className="p-6">
              <div className="glass p-2 rounded-3xl flex items-center gap-2">
                <button className="p-3 hover:bg-white/5 rounded-2xl transition-colors text-white/30 hover:text-white">
                  <Mic className="w-5 h-5" />
                </button>
                <input 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Bir mesaj yazın..."
                  className="flex-1 bg-transparent border-none focus:outline-none px-2 text-sm"
                />
                <button 
                  onClick={sendMessage}
                  className="p-3 bg-white text-black rounded-2xl hover:scale-105 active:scale-95 transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
            <div className="w-24 h-24 rounded-full glass flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-white/20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Sohbet Başlatın</h3>
              <p className="text-white/30 max-w-xs">Soldaki listeden bir arkadaşınızı seçin veya Pro AI ile konuşmaya başlayın.</p>
            </div>
          </div>
        )}
      </div>

      {/* Pro Modal */}
      <AnimatePresence>
        {showProModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-2xl w-full glass rounded-3xl overflow-hidden"
            >
              <div className="pro-gradient p-8 text-center space-y-2">
                <Crown className="w-12 h-12 mx-auto mb-4" />
                <h2 className="text-3xl font-bold">Pro Özellikler</h2>
                <p className="opacity-80">Gelişmiş ses değiştiriciler ve özel roller.</p>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Ses Değiştiriciler (50+)</p>
                    <div className="h-64 overflow-y-auto custom-scrollbar grid grid-cols-1 gap-2 pr-2">
                      {VOICE_CHANGERS.map(voice => (
                        <button 
                          key={voice}
                          onClick={() => setSelectedVoice(voice)}
                          className={cn(
                            "w-full text-left p-3 rounded-xl text-xs transition-all",
                            selectedVoice === voice ? "bg-white text-black font-bold" : "glass-hover"
                          )}
                        >
                          {voice}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-sm font-bold">Aktivasyon Şifresi</p>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input 
                          type="password"
                          value={proPassword}
                          onChange={(e) => setProPassword(e.target.value)}
                          placeholder="Şifreyi girin"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-white/20"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm opacity-60">
                        <Zap className="w-4 h-4" />
                        <span>Düşük gecikmeli iletişim</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm opacity-60">
                        <Shield className="w-4 h-4" />
                        <span>Özel yönetici rolleri</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm opacity-60">
                        <Terminal className="w-4 h-4" />
                        <span>Gelişmiş AI komutları</span>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button 
                        onClick={() => setShowProModal(false)}
                        className="flex-1 glass p-4 rounded-2xl font-bold text-sm"
                      >
                        İptal
                      </button>
                      <button 
                        onClick={activatePro}
                        className="flex-1 pro-gradient p-4 rounded-2xl font-bold text-sm"
                      >
                        Aktive Et
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 glass border-red-500/50 px-6 py-4 rounded-2xl flex items-center gap-3 z-[100]"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ml-4 text-xs opacity-50 hover:opacity-100">Kapat</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
