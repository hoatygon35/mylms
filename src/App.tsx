/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from "react";
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  BookOpen, 
  Settings, 
  Users, 
  Plus, 
  ShoppingCart, 
  Award,
  ChevronRight,
  Zap,
  Star,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  LogIn,
  LogOut,
  FolderTree,
  Download,
  Upload,
  FileText,
  ShieldCheck,
  Gamepad2,
  Flag,
  Car,
  Ship,
  Rabbit,
  Mountain,
  Maximize2,
  AlertTriangle,
  Menu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";
import Papa from "papaparse";

// Firebase Imports
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from "firebase/auth";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocFromServer
} from "firebase/firestore";
import { auth, db } from "./firebase";

// Types
interface UserProfile {
  id: string;
  displayName: string;
  role: "admin" | "staff" | "teacher" | "student";
  xp: number;
  level: number;
  badges: string[];
  email: string;
}

interface Question {
  id: string;
  subject: string;
  topic: string;
  difficulty: "NB" | "TH" | "VD" | "VDC";
  type: "single_choice" | "multiple_choice" | "true_false" | "fill_blank" | "matching" | "drag_drop" | "essay";
  content: string;
  options?: string[];
  correctAnswer?: string;
  matchingPairs?: Record<string, string>;
}

interface ExamSection {
  title: string;
  type: "objective" | "essay";
  questionIds: string[];
}

interface Exam {
  id: string;
  title: string;
  sections: ExamSection[];
  duration: number;
  passScore: number;
  shuffle: boolean;
  createdAt: string;
}

interface Mission {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  completed: boolean;
}

// Error Handling
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
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
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Auth Context
interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create profile
        const userDoc = doc(db, "users", firebaseUser.uid);
        try {
          const docSnap = await getDoc(userDoc);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Create default profile for new user
            const isAdminEmail = firebaseUser.email === "vandungldc@gmail.com";
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              displayName: firebaseUser.displayName || "User",
              email: firebaseUser.email || "",
              role: isAdminEmail ? "admin" : "student",
              xp: 0,
              level: 1,
              badges: []
            };
            await setDoc(userDoc, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Mock Data (Fallback)
const MOCK_MISSIONS: Mission[] = [
  { id: "m1", title: "Làm 10 câu trắc nghiệm", description: "Hoàn thành 10 câu hỏi bất kỳ trong ngày", xpReward: 100, completed: false },
  { id: "m2", title: "Điểm 10 môn Toán", description: "Đạt điểm tuyệt đối trong bài kiểm tra Toán", xpReward: 500, completed: true },
  { id: "m3", title: "Xem video bài giảng", description: "Xem hết 1 video bài giảng mới", xpReward: 50, completed: false }
];

const MOCK_LEADERBOARD = [
  { name: "Trần Thị B", xp: 2500, level: 20 },
  { name: "Lê Văn C", xp: 2100, level: 18 },
  { name: "Phạm Minh D", xp: 1950, level: 16 },
  { name: "Nguyễn Văn A", xp: 1250, level: 12 },
  { name: "Hoàng Anh E", xp: 1100, level: 10 }
];

const MOCK_QUESTIONS: Question[] = [
  { 
    id: "q1", 
    subject: "Toán học", 
    topic: "Đạo hàm", 
    difficulty: "TH", 
    type: "single_choice", 
    content: "Tính đạo hàm của hàm số \\( f(x) = \\sin(x) + \\cos(x) \\)",
    options: ["\\( \\cos(x) - \\sin(x) \\)", "\\( \\sin(x) - \\cos(x) \\)", "\\( \\cos(x) + \\sin(x) \\)", "0"],
    correctAnswer: "0"
  },
  { 
    id: "q2", 
    subject: "Vật lý", 
    topic: "Cơ học", 
    difficulty: "NB", 
    type: "true_false", 
    content: "Một vật rơi tự do từ độ cao \\( h \\). Tính vận tốc khi chạm đất: \\( v = \\sqrt{2gh} \\)",
    options: ["Đúng", "Sai"],
    correctAnswer: "0"
  },
  {
    id: "q3",
    subject: "Hóa học",
    topic: "Nguyên tử",
    difficulty: "VD",
    type: "multiple_choice",
    content: "Những hạt nào sau đây có trong hạt nhân nguyên tử?",
    options: ["Proton", "Neutron", "Electron", "Positron"],
    correctAnswer: "0,1"
  }
];

// Components
const Badge = ({ name }: { name: string }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium border border-amber-200">
    <Award className="w-3.5 h-3.5" />
    {name}
  </div>
);

const XPBar = ({ xp, level }: { xp: number, level: number }) => {
  const nextLevelXP = (level + 1) * 200;
  const progress = (xp % 200) / 200 * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-indigo-600">Lv.{level}</span>
          <span className="text-sm text-slate-500 font-medium">{xp} XP</span>
        </div>
        <span className="text-xs text-slate-400 font-medium">Next: {nextLevelXP} XP</span>
      </div>
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
        />
      </div>
    </div>
  );
};

function MainApp() {
  const { user, profile, loading, signIn, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "questions" | "exams" | "shop" | "members" | "categories" | "games">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExamMode, setIsExamMode] = useState(false);
  const [violations, setViolations] = useState(0);
  const [showViolationAlert, setShowViolationAlert] = useState(false);

  // Fullscreen & Tab Switch Detection
  useEffect(() => {
    if (!isExamMode) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation();
      }
    };

    const handleViolation = () => {
      setViolations(prev => {
        const next = prev + 1;
        if (next >= 3) {
          alert("Bạn đã vi phạm 3 lần. Bài thi sẽ tự động nộp.");
          setIsExamMode(false);
          document.exitFullscreen().catch(() => {});
          return 0;
        }
        setShowViolationAlert(true);
        return next;
      });
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isExamMode]);

  const startExam = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsExamMode(true);
      setViolations(0);
    } catch (err) {
      alert("Vui lòng cho phép chế độ toàn màn hình để bắt đầu bài thi.");
    }
  };

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Digital Knowledge Foundation</h1>
          <p className="text-slate-500">Vui lòng đăng nhập để bắt đầu hành trình học tập của bạn.</p>
          <button 
            onClick={signIn}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <LogIn className="w-5 h-5" />
            Đăng nhập với Google
          </button>
        </div>
      </div>
    );
  }

  const currentUser = profile || {
    displayName: user.displayName || "User",
    role: "student",
    xp: 0,
    level: 1,
    badges: []
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 relative">
      {/* Mobile Menu Button */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-xl shadow-lg border border-slate-200"
      >
        {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-lg leading-tight">DKF<br/><span className="text-indigo-600 text-xs uppercase tracking-widest">Foundation</span></h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: "dashboard", icon: LayoutDashboard, label: "Bảng điều khiển" },
            { id: "members", icon: Users, label: "Thành viên", roles: ["admin", "staff"] },
            { id: "categories", icon: FolderTree, label: "Danh mục", roles: ["admin", "staff"] },
            { id: "questions", icon: BookOpen, label: "Ngân hàng câu hỏi" },
            { id: "exams", icon: Target, label: "Quản lý đề thi" },
            { id: "games", icon: Gamepad2, label: "Trò chơi học tập" },
            { id: "shop", icon: ShoppingCart, label: "Cửa hàng XP" }
          ].filter(item => !item.roles || (currentUser.role && item.roles.includes(currentUser.role))).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? "bg-indigo-50 text-indigo-700 font-semibold shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? "text-indigo-600" : "text-slate-400"}`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              {currentUser.displayName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{currentUser.displayName}</p>
              <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
            </div>
            <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 pt-16 lg:pt-8">
        <AnimatePresence mode="wait">
          {/* Violation Overlay */}
          {showViolationAlert && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="bg-white p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Cảnh báo vi phạm!</h3>
                <p className="text-slate-600">
                  Bạn đã vi phạm <span className="text-red-600 font-black text-xl">{violations}</span> lần. 
                  Nếu vi phạm <span className="font-bold">3</span> lần, bài thi sẽ tự động nộp.
                </p>
                <button 
                  onClick={() => {
                    setShowViolationAlert(false);
                    document.documentElement.requestFullscreen().catch(() => {});
                  }}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all"
                >
                  Tôi đã hiểu, quay lại làm bài
                </button>
              </div>
            </motion.div>
          )}
          {activeTab === "dashboard" && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <header className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">Chào buổi sáng, {currentUser.displayName.split(' ').pop()}! 👋</h2>
                  <p className="text-slate-500 mt-1">Hôm nay bạn có 3 nhiệm vụ mới cần hoàn thành.</p>
                </div>
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    Thống kê
                  </button>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                    Làm bài ngay
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats & Missions */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Stats Card */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-12">
                    <div className="flex-1">
                      <XPBar xp={currentUser.xp} level={currentUser.level} />
                      <div className="flex gap-2 mt-6">
                        {currentUser.badges.map(b => <Badge key={b} name={b} />)}
                      </div>
                    </div>
                    <div className="w-px h-24 bg-slate-100 hidden md:block" />
                    <div className="hidden md:flex flex-col items-center gap-1">
                      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-2">
                        <Zap className="w-8 h-8 fill-indigo-600" />
                      </div>
                      <span className="text-2xl font-bold">15</span>
                      <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Ngày liên tiếp</span>
                    </div>
                  </div>

                  {/* Missions */}
                  <section>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-600" />
                        Nhiệm vụ hàng ngày
                      </h3>
                      <button className="text-indigo-600 text-sm font-semibold hover:underline">Xem tất cả</button>
                    </div>
                    <div className="space-y-3">
                      {MOCK_MISSIONS.map((mission) => (
                        <div 
                          key={mission.id}
                          className={`p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                            mission.completed 
                              ? "bg-slate-50 border-slate-100 opacity-60" 
                              : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            mission.completed ? "bg-green-100 text-green-600" : "bg-indigo-50 text-indigo-600"
                          }`}>
                            {mission.completed ? <CheckCircle2 className="w-6 h-6" /> : <Star className="w-6 h-6" />}
                          </div>
                          <div className="flex-1">
                            <h4 className={`font-bold ${mission.completed ? "line-through text-slate-400" : ""}`}>{mission.title}</h4>
                            <p className="text-xs text-slate-500">{mission.description}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-indigo-600 font-bold">+{mission.xpReward} XP</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Right Column: Leaderboard & Shop */}
                <div className="space-y-8">
                  {/* Leaderboard */}
                  <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      Bảng xếp hạng
                    </h3>
                    <div className="space-y-4">
                      {MOCK_LEADERBOARD.map((item, index) => (
                        <div key={item.name} className="flex items-center gap-3">
                          <span className={`w-6 text-sm font-bold ${index < 3 ? "text-amber-500" : "text-slate-400"}`}>
                            {index + 1}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">
                            {item.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Lv.{item.level}</p>
                          </div>
                          <span className="text-sm font-bold text-slate-700">{item.xp}</span>
                        </div>
                      ))}
                    </div>
                    <button className="w-full mt-6 py-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                      Xem chi tiết
                    </button>
                  </section>

                  {/* Shop Preview */}
                  <section className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl text-white shadow-xl shadow-indigo-200">
                    <div className="flex justify-between items-start mb-4">
                      <ShoppingCart className="w-8 h-8 opacity-50" />
                      <span className="bg-white/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">Cửa hàng</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Đổi quà hấp dẫn</h3>
                    <p className="text-indigo-100 text-sm mb-6">Sử dụng XP của bạn để đổi lấy các vật phẩm đặc biệt.</p>
                    <button className="w-full py-3 bg-white text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors">
                      Ghé thăm Shop
                    </button>
                  </section>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "questions" && (
            <motion.div 
              key="questions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">Ngân hàng câu hỏi</h2>
                  <p className="text-slate-500 mt-1">Quản lý và biên soạn nội dung học thuật với LaTeX.</p>
                </div>
                <div className="flex gap-3">
                  <label className="px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
                    <Upload className="w-5 h-5 text-slate-400" />
                    Import JSON
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            try {
                              const data = JSON.parse(event.target?.result as string);
                              if (Array.isArray(data)) {
                                alert(`Đã import thành công ${data.length} câu hỏi! (Dữ liệu đã được log ra console)`);
                                console.log("Imported Questions:", data);
                              } else {
                                alert("File JSON không đúng định dạng (phải là một mảng câu hỏi).");
                              }
                            } catch (err) {
                              alert("Lỗi khi đọc file JSON.");
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                  <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                    <Plus className="w-5 h-5" />
                    Thêm câu hỏi mới
                  </button>
                </div>
              </header>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-4">
                  <select className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium">
                    <option>Tất cả môn học</option>
                    <option>Toán học</option>
                    <option>Vật lý</option>
                  </select>
                  <select className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium">
                    <option>Mọi độ khó</option>
                    <option>NB (Nhận biết)</option>
                    <option>TH (Thông hiểu)</option>
                    <option>VD (Vận dụng)</option>
                    <option>VDC (Vận dụng cao)</option>
                  </select>
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm nội dung..." 
                      className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm"
                    />
                    <BookOpen className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {MOCK_QUESTIONS.map((q) => (
                    <div key={q.id} className="p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-2">
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">{q.subject}</span>
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">{q.topic}</span>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            q.difficulty === "NB" ? "bg-green-50 text-green-600" :
                            q.difficulty === "TH" ? "bg-blue-50 text-blue-600" :
                            q.difficulty === "VD" ? "bg-amber-50 text-amber-600" :
                            "bg-red-50 text-red-600"
                          }`}>
                            {q.difficulty}
                          </span>
                          <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded text-[10px] font-bold uppercase">{q.type}</span>
                        </div>
                        <button className="text-slate-400 hover:text-indigo-600">
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-lg text-slate-800 mb-6">
                        <InlineMath math={q.content.replace(/\\\(|\\\)/g, '')} />
                      </div>
                      {q.options && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options.map((opt, i) => (
                            <div key={i} className="p-3 bg-white border border-slate-100 rounded-xl text-sm flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                {String.fromCharCode(65 + i)}
                              </span>
                              <InlineMath math={opt.replace(/\\\(|\\\)/g, '')} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "members" && (
            <motion.div 
              key="members"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">Quản lý thành viên</h2>
                  <p className="text-slate-500 mt-1">Danh sách người dùng, đăng ký và import hàng loạt.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      const csvContent = "email,displayName,role,centerId\ntest@example.com,Nguyễn Văn A,student,center1\nteacher@example.com,Trần Thị B,teacher,center1";
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement("a");
                      const url = URL.createObjectURL(blob);
                      link.setAttribute("href", url);
                      link.setAttribute("download", "template_members.csv");
                      link.style.visibility = 'hidden';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <Download className="w-5 h-5 text-slate-400" />
                    Tải file mẫu
                  </button>
                  <label className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 cursor-pointer">
                    <Upload className="w-5 h-5" />
                    Import CSV
                    <input 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          Papa.parse(file, {
                            header: true,
                            complete: async (results) => {
                              const data = results.data as any[];
                              let count = 0;
                              for (const row of data) {
                                if (row.email) {
                                  // In a real app, we'd use a unique ID or email as key
                                  // For demo, we'll just log and show success
                                  console.log("Importing:", row);
                                  count++;
                                }
                              }
                              alert(`Đã import thành công ${count} thành viên! (Dữ liệu đã được log ra console)`);
                            }
                          });
                        }
                      }}
                    />
                  </label>
                </div>
              </header>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Họ tên</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vai trò</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cấp độ</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { name: "Nguyễn Văn A", email: "a@example.com", role: "student", level: 12 },
                      { name: "Trần Thị B", email: "b@example.com", role: "teacher", level: 25 },
                      { name: "Lê Văn C", email: "c@example.com", role: "admin", level: 40 }
                    ].map((m, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                              {m.name.charAt(0)}
                            </div>
                            <span className="font-semibold text-sm">{m.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-500">{m.email}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            m.role === 'admin' ? "bg-red-50 text-red-600" :
                            m.role === 'teacher' ? "bg-amber-50 text-amber-600" :
                            "bg-blue-50 text-blue-600"
                          }`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-bold text-slate-700">Lv.{m.level}</td>
                        <td className="p-4">
                          <button className="text-slate-400 hover:text-indigo-600">
                            <Settings className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "categories" && (
            <motion.div 
              key="categories"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">Quản lý danh mục</h2>
                  <p className="text-slate-500 mt-1">Quản lý lớp học, môn học và các danh mục con.</p>
                </div>
                <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                  <Plus className="w-5 h-5" />
                  Thêm danh mục
                </button>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Classes */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    Khối lớp
                  </h3>
                  <div className="space-y-3">
                    {["Khối 10", "Khối 11", "Khối 12"].map((c, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group">
                        <span className="font-semibold text-slate-700">{c}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subjects */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    Môn học
                  </h3>
                  <div className="space-y-3">
                    {["Toán học", "Vật lý", "Hóa học", "Tiếng Anh"].map((s, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group">
                        <span className="font-semibold text-slate-700">{s}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                          <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "exams" && (
            <motion.div 
              key="exams"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">Trình tạo đề thi thông minh</h2>
                  <p className="text-slate-500 mt-1">Tạo đề thi tự động với cấu trúc nhiều phần.</p>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                  {["1", "5", "all"].map(num => (
                    <button 
                      key={num}
                      className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:bg-indigo-50 text-slate-500 hover:text-indigo-600"
                    >
                      {num === "all" ? "Tất cả" : num} câu
                    </button>
                  ))}
                </div>
              </header>

              <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Tên đề thi</label>
                    <input type="text" placeholder="Ví dụ: Kiểm tra giữa kỳ Toán 10" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Môn học</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                      <option>Toán học</option>
                      <option>Vật lý</option>
                      <option>Hóa học</option>
                    </select>
                  </div>
                </div>

                {/* Sections */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Cấu trúc đề thi (Các phần)
                    </h4>
                    <button className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:underline">
                      <Plus className="w-4 h-4" /> Thêm phần mới
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { title: "Phần 1: Trắc nghiệm", type: "objective", count: 10 },
                      { title: "Phần 2: Tự luận", type: "essay", count: 2 }
                    ].map((section, idx) => (
                      <div key={idx} className="p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center">
                          <input 
                            type="text" 
                            defaultValue={section.title} 
                            className="bg-transparent font-bold text-slate-800 focus:outline-none border-b border-transparent focus:border-indigo-300"
                          />
                          <select className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold">
                            <option value="objective">Trắc nghiệm</option>
                            <option value="essay">Tự luận</option>
                          </select>
                        </div>
                        
                        {section.type === "objective" && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {["NB", "TH", "VD", "VDC"].map(level => (
                              <div key={level} className="bg-white p-3 rounded-xl border border-slate-200">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">{level}</label>
                                <input type="number" defaultValue={2} className="w-full bg-transparent font-bold text-slate-700 focus:outline-none" />
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-xs text-slate-500 font-medium">Tổng số câu: {section.count}</span>
                          <button className="text-red-500 text-xs font-bold hover:underline">Xóa phần</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Thiết lập cao cấp & Bảo mật
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Thời gian (phút)</label>
                      <input type="number" defaultValue={45} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Điểm đạt (%)</label>
                      <input type="number" defaultValue={50} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div className="flex flex-col gap-3 pt-2">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="shuffle" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <label htmlFor="shuffle" className="text-sm font-medium text-slate-700">Trộn câu hỏi</label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="fullscreen" defaultChecked className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <label htmlFor="fullscreen" className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          Bắt buộc Toàn màn hình <ShieldCheck className="w-3 h-3 text-red-500" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={startExam}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold hover:shadow-xl hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <Maximize2 className="w-5 h-5" />
                  Bắt đầu làm bài (Toàn màn hình)
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "games" && (
            <motion.div 
              key="games"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <header>
                <h2 className="text-3xl font-bold text-slate-900">Trò chơi học tập</h2>
                <p className="text-slate-500 mt-1">Biến các bài kiểm tra khô khan thành những cuộc đua kỳ thú!</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { id: "car", title: "Đua Tốp (Đua Xe)", icon: Car, color: "from-red-500 to-orange-500", desc: "Tốc độ và kiến thức!" },
                  { id: "yacht", title: "Đua Du Thuyền", icon: Ship, color: "from-blue-500 to-cyan-500", desc: "Vượt sóng tri thức." },
                  { id: "rabbit", title: "Đưa Thỏ Về Đích", icon: Rabbit, color: "from-green-500 to-emerald-500", desc: "Thông minh và nhanh nhẹn." },
                  { id: "obstacle", title: "Vượt Chướng Ngại Vật", icon: Mountain, color: "from-purple-500 to-pink-500", desc: "Chinh phục mọi thử thách." }
                ].map((game) => (
                  <div key={game.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group hover:border-indigo-300 transition-all cursor-pointer">
                    <div className={`h-32 bg-gradient-to-br ${game.color} flex items-center justify-center text-white`}>
                      <game.icon className="w-16 h-16 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="p-6 space-y-2">
                      <h4 className="font-bold text-slate-900">{game.title}</h4>
                      <p className="text-xs text-slate-500">{game.desc}</p>
                      <button className="w-full mt-4 py-2 bg-slate-50 rounded-xl text-xs font-bold text-slate-600 hover:bg-indigo-600 hover:text-white transition-all">
                        Tạo phòng game
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Flag className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Phòng game đang diễn ra</h3>
                    <p className="text-sm text-slate-500">Tham gia cùng các bạn khác để cùng leo rank!</p>
                  </div>
                </div>
                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                  Chưa có phòng game nào đang mở. Hãy tạo phòng đầu tiên!
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === "shop" && (
            <motion.div 
              key="shop"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <header className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">Cửa hàng XP</h2>
                  <p className="text-slate-500 mt-1">Dùng điểm kinh nghiệm để đổi lấy những phần quà giá trị.</p>
                </div>
                <div className="px-6 py-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 shadow-sm">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Số dư của bạn</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-indigo-600">{currentUser.xp}</span>
                    <span className="text-xs font-bold text-indigo-400">XP</span>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { name: "Avatar Rồng Lửa", cost: 500, type: "virtual", img: "https://picsum.photos/seed/dragon/400/300" },
                  { name: "Sổ tay DKF Limited", cost: 2000, type: "physical", img: "https://picsum.photos/seed/notebook/400/300" },
                  { name: "Thẻ nhân đôi XP (1h)", cost: 300, type: "virtual", img: "https://picsum.photos/seed/boost/400/300" },
                  { name: "Bút bi cao cấp", cost: 1000, type: "physical", img: "https://picsum.photos/seed/pen/400/300" },
                  { name: "Khung viền Vàng", cost: 800, type: "virtual", img: "https://picsum.photos/seed/frame/400/300" },
                  { name: "Áo thun DKF", cost: 5000, type: "physical", img: "https://picsum.photos/seed/shirt/400/300" }
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group hover:border-indigo-300 transition-all">
                    <div className="h-48 overflow-hidden relative">
                      <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[10px] font-bold uppercase text-slate-600">
                        {item.type === "virtual" ? "Vật phẩm ảo" : "Quà vật lý"}
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <h4 className="text-lg font-bold text-slate-900">{item.name}</h4>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                          <span className="text-xl font-black text-slate-800">{item.cost}</span>
                        </div>
                        <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors">
                          Đổi ngay
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
