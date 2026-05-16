/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  FileText, 
  Bell, 
  Menu,
  Download,
  Activity,
  Search,
  ChevronRight,
  MoreVertical,
  MapPin,
  Clock,
  Wrench,
  Send,
  Plus,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Users,
  ArrowLeft,
  ShieldCheck,
  Eye,
  RefreshCw,
  LogOut,
  Briefcase,
  Check,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type Role = 'teknisi' | 'supervisor' | 'atasan';

interface UserData {
  username: string;
  name: string;
  role: Role;
  avatar: string;
}

interface Task {
  id: number;
  title: string;
  location: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'Pending' | 'Proses' | 'Selesai';
  stage: 'Atasan-to-SPV' | 'SPV-to-Tech' | 'Tech-Working';
  progress: number;
  assignedTo?: string;
  supervisor?: string;
  fromAtasan?: string;
}

// --- Constants & Mock Data ---
const DEMO_USERS: Record<string, UserData> = {
  teknisi: { username: 'teknisi', name: 'Budi Teknisi', role: 'teknisi', avatar: 'BT' },
  supervisor: { username: 'supervisor', name: 'Rina Supervisor', role: 'supervisor', avatar: 'RS' },
  atasan: { username: 'atasan', name: 'Adi Atasan', role: 'atasan', avatar: 'AA' },
};

const INITIAL_TASKS: Task[] = [
  { id: 101, title: 'Instalasi Router Baru', location: 'Gedung Cyber Lt. 3', priority: 'HIGH', status: 'Proses', stage: 'Tech-Working', progress: 60, assignedTo: 'Budi Teknisi', supervisor: 'Rina Supervisor', fromAtasan: 'Adi Atasan' },
  { id: 102, title: 'Maintenance CCTV', location: 'Area Parkir Timur', priority: 'MEDIUM', status: 'Pending', stage: 'Tech-Working', progress: 20, assignedTo: 'Budi Teknisi', supervisor: 'Rina Supervisor', fromAtasan: 'Adi Atasan' },
  { id: 103, title: 'Check Server Rack B2', location: 'Data Center', priority: 'HIGH', status: 'Pending', stage: 'Atasan-to-SPV', progress: 0, fromAtasan: 'Adi Atasan' }
];

// --- Shared UI Components ---

const Badge = ({ children, variant = 'PRIMARY' }: { children: React.ReactNode, variant?: string }) => {
  const styles: Record<string, string> = {
    HIGH: 'bg-error-container text-error',
    MEDIUM: 'bg-secondary-container/20 text-secondary',
    LOW: 'bg-primary-container/10 text-primary',
    TEKNISI: 'bg-blue-100 text-blue-600',
    SUPERVISOR: 'bg-purple-100 text-purple-600',
    ATASAN: 'bg-emerald-100 text-emerald-600',
    SUCCESS: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[variant] || 'bg-slate-100 text-slate-600'}`}>
      {children}
    </span>
  );
};

// --- View Components ---

const LoginView = ({ onLogin }: { onLogin: (user: UserData) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      const user = DEMO_USERS[username.toLowerCase()];
      if (user && password === '123456') {
        onLogin(user);
      } else {
        alert('Login gagal. Gunakan teknisi/123456, supervisor/123456, atau atasan/123456');
      }
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-primary/30">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">TechOps LOGIN</h1>
          <p className="text-slate-400 text-sm mt-1">Sistem Manajemen Operasional Terpadu</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="teknisi / supervisor / atasan"
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary text-white font-bold py-5 rounded-full shadow-2xl shadow-primary/30 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
          >
            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : 'Masuk ke Dashboard'}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-50">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest text-center mb-4">Akun Demo</p>
          <div className="flex justify-between gap-2">
            {Object.keys(DEMO_USERS).map(u => (
              <button 
                key={u}
                onClick={() => { setUsername(u); setPassword('123456'); }}
                className="flex-1 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[9px] font-black text-slate-400 hover:text-primary hover:border-primary transition-all uppercase"
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App Logic ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [activeScreen, setActiveScreen] = useState('home');
  const [showNotification, setShowNotification] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const handleCreateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newTask: Task = {
      id: Math.floor(Math.random() * 9000) + 1000,
      title: formData.get('title') as string,
      location: formData.get('location') as string,
      priority: formData.get('priority') as any,
      status: 'Pending',
      stage: 'Atasan-to-SPV',
      progress: 0,
      fromAtasan: currentUser?.name
    };
    setTasks([newTask, ...tasks]);
    setShowTaskForm(false);
  };

  const handleAssignToTech = (taskId: number) => {
    setTasks(tasks.map(t => t.id === taskId ? { 
      ...t, 
      stage: 'Tech-Working', 
      assignedTo: 'Budi Teknisi', 
      supervisor: currentUser?.name 
    } : t));
  };

  // Filter Tasks based on role
  const getVisibleTasks = () => {
    if (!currentUser) return [];
    if (currentUser.role === 'atasan') return tasks; // Atasan sees everything
    if (currentUser.role === 'supervisor') return tasks.filter(t => t.stage === 'Atasan-to-SPV' || t.supervisor === currentUser.name);
    return tasks.filter(t => t.assignedTo === currentUser.name && t.stage === 'Tech-Working');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveScreen('home');
  };

  if (!currentUser) return <LoginView onLogin={setCurrentUser} />;

  const visibleTasks = getVisibleTasks();

  return (
    <div className="min-h-screen bg-slate-50 pb-32 pt-safe pb-safe">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm pt-safe">
        <div className="flex items-center gap-3">
          <button className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"><Menu size={22} className="text-primary" /></button>
          <span className="font-mono text-xl font-black tracking-tighter text-primary">TechOps</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-900 leading-none">{currentUser.name}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{currentUser.role}</span>
          </div>
          <div className="relative group cursor-pointer" onClick={() => setShowNotification(!showNotification)}>
            <Bell size={20} className="text-slate-400" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full border-2 border-white" />
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-error/5 text-error hover:bg-error/10 transition-all font-bold text-[10px]">
             <LogOut size={14} />
             <span className="hidden xs:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-24 px-5 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeScreen + currentUser.role}
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            className="space-y-6"
          >
            {/* Dashboard Header */}
            <section className="relative overflow-hidden bg-primary-container rounded-3xl p-8 shadow-2xl shadow-primary/20 text-white">
              <div className="relative z-10">
                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mb-1">Status Operasional</p>
                <h1 className="text-3xl font-black tracking-tighter mb-4">Selamat {new Date().getHours() < 12 ? 'Pagi' : 'Siang'}, {currentUser.name.split(' ')[0]}!</h1>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
                     <Users size={14} />
                     <span className="text-[10px] font-bold uppercase">{currentUser.role} Level</span>
                  </div>
                </div>
              </div>
              <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
            </section>

            {/* Role Specific Navigation Content */}
            {activeScreen === 'home' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Tugas</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-primary tracking-tighter">{visibleTasks.length}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Aktif</span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Selesai</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-emerald-500 tracking-tighter">{visibleTasks.filter(t => t.status === 'Selesai').length}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Item</span>
                    </div>
                  </div>
                </div>

                {/* Atasan specific: Create Task to Supervisor */}
                {currentUser.role === 'atasan' && !showTaskForm && (
                  <button onClick={() => setShowTaskForm(true)} className="w-full bg-white border-2 border-dashed border-primary/20 p-8 rounded-3xl flex flex-col items-center justify-center text-primary hover:bg-primary/5 hover:border-primary transition-all group">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Plus size={24} />
                    </div>
                    <span className="font-black text-sm uppercase tracking-tighter">Buat Penugasan Baru</span>
                    <p className="text-[10px] text-slate-400 mt-1">Kirim instruksi kerja ke Supervisor</p>
                  </button>
                )}

                {showTaskForm && (
                  <form onSubmit={handleCreateTask} className="bg-white p-6 rounded-3xl shadow-soft border border-primary/20 space-y-4">
                    <h3 className="font-black text-slate-900 text-sm uppercase">Form Penugasan Baru</h3>
                    <input name="title" placeholder="Judul Tugas" className="w-full bg-slate-50 p-4 rounded-2xl text-sm outline-none border border-slate-100" required />
                    <input name="location" placeholder="Lokasi" className="w-full bg-slate-50 p-4 rounded-2xl text-sm outline-none border border-slate-100" required />
                    <select name="priority" className="w-full bg-slate-50 p-4 rounded-2xl text-sm outline-none border border-slate-100 uppercase font-bold text-slate-500">
                      <option value="LOW">Low Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="HIGH">High Priority</option>
                    </select>
                    <div className="flex gap-2">
                       <button type="submit" className="flex-1 bg-primary text-white py-4 rounded-2xl font-black text-[10px] uppercase">Kirim Tugas</button>
                       <button type="button" onClick={() => setShowTaskForm(false)} className="px-6 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase">Batal</button>
                    </div>
                  </form>
                )}

                {/* Task List Preview */}
                <div className="space-y-4">
                   <div className="flex justify-between items-center px-1">
                      <h3 className="font-black text-slate-900 uppercase text-xs tracking-tighter">Ringkasan Tugas</h3>
                      <button onClick={() => setActiveScreen('tasks')} className="text-primary text-[10px] font-black uppercase tracking-widest">Lihat Semua &raquo;</button>
                   </div>
                   {visibleTasks.slice(0, 5).map(task => (
                      <div key={task.id} className="bg-white p-5 rounded-3xl shadow-soft border-l-4 border-primary group hover:translate-x-1 transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-slate-900 text-sm leading-tight">{task.title}</h4>
                          <Badge variant={task.priority}>{task.priority}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400 text-[10px] mb-4">
                          <div className="flex items-center gap-1"><MapPin size={12} /> {task.location}</div>
                          <div className="flex items-center gap-1 font-black text-primary uppercase tracking-widest"><Clock size={12} /> {task.stage === 'Atasan-to-SPV' ? 'Tunggu SPV' : task.status}</div>
                        </div>
                        {currentUser.role === 'supervisor' && task.stage === 'Atasan-to-SPV' && (
                           <button 
                             onClick={() => handleAssignToTech(task.id)}
                             className="w-full py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2"
                           >
                             <Briefcase size={14} /> Kirim ke Teknisi
                           </button>
                        )}
                        {currentUser.role === 'teknisi' && (
                          <button className="w-full py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform shadow-lg shadow-primary/20">Mulai Kerja</button>
                        )}
                      </div>
                   ))}
                </div>
              </div>
            )}

            {activeScreen === 'tasks' && (
              <div className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl shadow-soft font-medium focus:outline-none" placeholder="Cari tugas..." />
                </div>
                
                <div className="space-y-4">
                   {visibleTasks.map(task => (
                    <div key={task.id} className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100">
                       <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1">
                             <div className="flex gap-2">
                                <Badge variant={task.priority}>{task.priority}</Badge>
                                <span className="text-[10px] font-bold text-slate-300">#{task.id}</span>
                             </div>
                             <h4 className="font-black text-slate-900 text-base">{task.title}</h4>
                          </div>
                          <button className="p-2 text-slate-300"><MoreVertical size={18}/></button>
                       </div>
                       <p className="text-xs text-slate-500 mb-6 flex items-center gap-1.5"><MapPin size={14} className="text-slate-300" /> {task.location}</p>
                       
                       <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                          <div className="flex -space-x-2">
                             {[1, 2].map(i => (
                               <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black">{i === 1 ? 'SP' : 'TK'}</div>
                             ))}
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase">Progress</span>
                             <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                               <div className="h-full bg-primary" style={{ width: `${task.progress}%` }} />
                             </div>
                             <span className="text-[10px] font-black text-primary">{task.progress}%</span>
                          </div>
                       </div>
                    </div>
                   ))}
                </div>
              </div>
            )}

            {activeScreen === 'analytics' && currentUser.role !== 'teknisi' && (
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Team Performance</p>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Analitik Tim</h2>
                  </div>
                  <div className="bg-white p-2 rounded-xl shadow-soft border border-slate-100 flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase">7 Hari Terakhir</span>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-50">
                   <div className="h-48 flex items-end justify-between gap-3 border-b border-slate-100 pb-2">
                      {[4, 6, 8, 5, 9, 3, 4].map((v, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                           <motion.div 
                             initial={{ height: 0 }}
                             animate={{ height: `${(v / 10) * 100}%` }}
                             className="w-full bg-primary/20 hover:bg-primary rounded-t-xl transition-colors relative group"
                           >
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">{v}h</div>
                           </motion.div>
                           <span className="text-[8px] font-black text-slate-300 uppercase">{['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][i]}</span>
                        </div>
                      ))}
                   </div>
                   <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6">Rata-rata Jam Kerja Aktif Per Hari</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-6 pt-4 pb-4 md:pb-6 bg-white/90 backdrop-blur-2xl border-t border-slate-100 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-safe transition-transform duration-300">
        {[
          { id: 'home', label: 'Home', icon: LayoutDashboard },
          { id: 'tasks', label: 'Tugas', icon: ClipboardList },
          ...(currentUser.role === 'teknisi' 
            ? [{ id: 'reports', label: 'Laporan', icon: FileText }] 
            : [{ id: 'analytics', label: 'Analitik', icon: Activity }, { id: 'export', label: 'Export', icon: Download }]
          )
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveScreen(item.id)}
            className={`flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all active:scale-90
              ${activeScreen === item.id ? 'bg-primary/10 text-primary scale-110 pb-3' : 'text-slate-300'}`}
          >
            <item.icon size={22} className={activeScreen === item.id ? 'stroke-[2.5px]' : ''} />
            <span className={`text-[10px] mt-1 font-black uppercase tracking-tighter ${activeScreen === item.id ? 'opacity-100' : 'opacity-80'}`}>
              {item.label}
            </span>
            {activeScreen === item.id && (
               <motion.div layoutId="nav-dot" className="absolute -bottom-1 w-1.5 h-1.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
