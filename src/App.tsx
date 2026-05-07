import React, { useState, useMemo, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  addMonths,
  parseISO,
  isToday,
  getDaysInMonth
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar, List, LayoutGrid, Trash2, Edit2, FileSpreadsheet, X, Download, CheckCircle, Menu, Image as ImageIcon, PlusCircle, Moon, Sun } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, loginWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, getDocs } from 'firebase/firestore';

// --- Utils ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Task = {
  id: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  title: string;
  description?: string;
  color?: string;
  completed?: boolean;
};

type ViewMode = '1' | '6' | '12';

// --- Constants ---
const COLOR_MAP: Record<string, { bg: string, text: string, hover: string, border: string }> = {
  red: { bg: 'bg-rose-500', text: 'text-white', hover: 'hover:bg-rose-600', border: 'border-rose-600' },
  blue: { bg: 'bg-blue-500', text: 'text-white', hover: 'hover:bg-blue-600', border: 'border-blue-600' },
  green: { bg: 'bg-emerald-500', text: 'text-white', hover: 'hover:bg-emerald-600', border: 'border-emerald-600' },
  purple: { bg: 'bg-violet-500', text: 'text-white', hover: 'hover:bg-violet-600', border: 'border-violet-600' },
  orange: { bg: 'bg-amber-500', text: 'text-white', hover: 'hover:bg-amber-600', border: 'border-amber-600' },
};

// --- Mock Data / Initial State ---
const INITIAL_TASKS: Task[] = [
  { id: '1', date: '2026-05-15', endDate: '2026-05-17', title: 'Họp team thiết kế', description: 'Bàn về UI/UX cho app mới', color: 'blue' },
  { id: '2', date: '2026-05-20', title: 'Hoàn thành báo cáo', description: 'Gửi cho giám đốc', color: 'red' },
  { id: '3', date: '2026-08-10', endDate: '2026-08-12', title: 'Company Trip', description: 'Đi du lịch công ty ở Đà Nẵng', color: 'green' },
  { id: '4', date: '2026-12-25', title: 'Party cuối năm', description: 'Cùng cả phòng', color: 'purple' },
];

const HOLIDAYS: Record<string, string> = {
  '01-01': 'Tết Dương lịch',
  '02-14': 'Lễ Tình nhân',
  '03-08': 'Quốc tế Phụ nữ',
  '04-30': 'Giải phóng miền Nam',
  '05-01': 'Quốc tế Lao động',
  '06-01': 'Quốc tế Thiếu nhi',
  '09-02': 'Quốc khánh',
  '10-20': 'Ngày Phụ nữ Việt Nam',
  '11-20': 'Ngày Nhà giáo Việt Nam',
  '12-22': 'Ngày thành lập Quân đội nhân dân VN',
  '12-24': 'Đêm Giáng sinh',
  '12-25': 'Lễ Giáng sinh',
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [images, setImages] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setImages({});
      return;
    }

    const tasksRef = collection(db, `users/${user.uid}/tasks`);
    const qTasks = query(tasksRef);
    
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const dbTasks: Task[] = [];
      snapshot.forEach((doc) => {
        dbTasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(dbTasks.sort((a, b) => a.date.localeCompare(b.date)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/tasks`);
    });

    const imagesRef = collection(db, `users/${user.uid}/dayImages`);
    const qImages = query(imagesRef);

    const unsubscribeImages = onSnapshot(qImages, (snapshot) => {
      const dbImages: Record<string, string[]> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date && data.images) {
          dbImages[data.date] = data.images;
        }
      });
      setImages(dbImages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/dayImages`);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeImages();
    };
  }, [user]);

  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 1)); // May 2026
  const [viewMode, setViewMode] = useState<ViewMode>('12');
  const [showStats, setShowStats] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  // React to window resize for sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTaskDate, setNewTaskDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newTaskEndDate, setNewTaskEndDate] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskColor, setNewTaskColor] = useState('red');

  const [contextMenu, setContextMenu] = useState<{x: number, y: number, date: string} | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const handleContextMenu = (e: React.MouseEvent | null, date: string, touchX?: number, touchY?: number) => {
    if (e && e.cancelable) e.preventDefault();
    let x = touchX ?? (e ? (e as React.MouseEvent).clientX : window.innerWidth / 2);
    let y = touchY ?? (e ? (e as React.MouseEvent).clientY : window.innerHeight / 2);
    
    const menuWidth = 210;
    const menuHeight = 100;
    
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 16;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 16;
    
    setContextMenu({ x, y, date });
  };

  const handleAddContextMenuTask = () => {
    if (contextMenu) {
      setNewTaskDate(contextMenu.date);
      setNewTaskEndDate('');
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskColor('red');
      setEditingTaskId(null);
      setIsAddingTask(true);
    }
    setContextMenu(null);
  };

  const handleUploadImageFromContextMenu = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!contextMenu || !e.target.files || e.target.files.length === 0 || !user) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target && typeof event.target.result === 'string') {
        const base64 = event.target.result;
        const targetDate = contextMenu.date;
        const existingImages = images[targetDate] || [];
        const newImages = [...existingImages, base64];
        
        try {
          await setDoc(doc(db, `users/${user.uid}/dayImages`, targetDate), {
            userId: user.uid,
            date: targetDate,
            images: newImages,
            updatedAt: Date.now()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/dayImages/${targetDate}`);
        }
      }
    };
    reader.readAsDataURL(file);
    setContextMenu(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Close context menu on click anywhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchstart', handleClick);
    }
  }, []);

  const currentYear = currentDate.getFullYear();
  const baseMonth = currentDate.getMonth();

  // Navigation
  const prevPeriod = () => {
    if (viewMode === '1') setCurrentDate(d => addMonths(d, -1));
    else if (viewMode === '6') setCurrentDate(d => addMonths(d, -6));
    else setCurrentDate(d => addMonths(d, -12));
  };

  const nextPeriod = () => {
    if (viewMode === '1') setCurrentDate(d => addMonths(d, 1));
    else if (viewMode === '6') setCurrentDate(d => addMonths(d, 6));
    else setCurrentDate(d => addMonths(d, 12));
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskDate || !user) return;
    
    try {
      if (editingTaskId) {
        const t = tasks.find(x => x.id === editingTaskId);
        if (t) {
          await setDoc(doc(db, `users/${user.uid}/tasks`, editingTaskId), {
            ...t,
            date: newTaskDate,
            endDate: newTaskEndDate || undefined,
            title: newTaskTitle,
            description: newTaskDesc,
            color: newTaskColor,
            updatedAt: Date.now()
          });
        }
      } else {
        const newId = crypto.randomUUID();
        await setDoc(doc(db, `users/${user.uid}/tasks`, newId), {
          userId: user.uid,
          date: newTaskDate,
          endDate: newTaskEndDate || undefined,
          title: newTaskTitle,
          description: newTaskDesc,
          color: newTaskColor,
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/tasks`);
    }
    
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskEndDate('');
    setNewTaskColor('red');
    setIsAddingTask(false);
    setEditingTaskId(null);
  };

  const handleEditTask = (task: Task) => {
    setNewTaskDate(task.date);
    setNewTaskEndDate(task.endDate || '');
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description || '');
    setNewTaskColor(task.color || 'red');
    setEditingTaskId(task.id);
    setIsAddingTask(true);
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/tasks`, id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/tasks/${id}`);
    }
  };

  const handleToggleComplete = async (id: string) => {
    if (!user) return;
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/tasks`, id), {
        ...t,
        completed: !t.completed,
        updatedAt: Date.now()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/tasks/${id}`);
    }
  };

  const handleCancelAdd = () => {
    setIsAddingTask(false);
    setEditingTaskId(null);
    setNewTaskDate(format(new Date(), 'yyyy-MM-dd'));
    setNewTaskEndDate('');
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskColor('red');
  };

  // Compute months to display
  const monthsToDisplay = useMemo(() => {
    const months = [];
    const count = parseInt(viewMode);
    
    let startM = 0;
    if (viewMode === '12') startM = 0;
    else if (viewMode === '6') startM = baseMonth < 6 ? 0 : 6;
    else startM = baseMonth;

    for (let i = 0; i < count; i++) {
        months.push(new Date(currentYear, startM + i, 1));
    }
    return months;
  }, [currentYear, baseMonth, viewMode]);

  // Sorted tasks for summary
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [tasks]);

  const downloadCSV = () => {
    const headers = ['Tiêu đề', 'Từ ngày', 'Đến ngày', 'Trạng thái', 'Ghi chú', 'Màu sắc'];
    const rows = sortedTasks.map(t => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      format(parseISO(t.date), 'dd/MM/yyyy'),
      t.endDate ? format(parseISO(t.endDate), 'dd/MM/yyyy') : '',
      `"${t.completed ? 'Đã hoàn thành' : 'Chưa hoàn thành'}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.color || 'red'
    ]);
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `thong_ke_cong_viec_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center p-6 text-gray-900 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 max-w-sm w-full text-center"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calendar className="text-blue-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-3 tracking-tight">Lịch Công Việc</h1>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">Đăng nhập tài khoản Google để lưu trữ tự động và an toàn mọi lúc, mọi nơi.</p>
          <button 
            onClick={loginWithGoogle}
            className="w-full bg-blue-600 text-white font-medium py-3.5 px-4 rounded-xl hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            Đăng nhập với Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex h-screen overflow-hidden font-sans relative transition-colors duration-300",
      theme === 'dark' ? "bg-gray-950 text-gray-100" : "bg-[#f8fafc] text-gray-900"
    )}>
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={cn(
        "absolute lg:relative transition-[transform,width,margin] duration-500 ease-in-out h-full overflow-hidden flex-shrink-0 z-50",
        theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200",
        isSidebarOpen ? "w-80 border-r translate-x-0" : "w-80 lg:w-0 border-r-0 -translate-x-full lg:translate-x-0"
      )}>
        <aside className="w-80 flex flex-col h-full shadow-2xl">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 flex items-center justify-between group">
            <div>
              <h1 className={cn("text-2xl font-black tracking-tighter uppercase", theme === 'dark' ? "text-blue-400" : "text-blue-600")}>PLANNER</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Quản lý hiệu quả</p>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                title={theme === 'light' ? "Chế độ tối" : "Chế độ sáng"}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <button 
                onClick={logout}
                title="Đăng xuất"
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </button>
            </div>
          </div>

        <div className="p-4 border-b border-gray-100">
          {!isAddingTask ? (
            <button 
              onClick={() => {
                setNewTaskDate(format(new Date(), 'yyyy-MM-dd'));
                setNewTaskEndDate('');
                setNewTaskTitle('');
                setNewTaskDesc('');
                setNewTaskColor('red');
                setEditingTaskId(null);
                setIsAddingTask(true);
              }}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors"
            >
              <Plus size={18} />
              Thêm công việc mới
            </button>
          ) : (
            <form onSubmit={handleAddTask} className={cn(
              "p-4 rounded-xl border transition-colors",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
            )}>
              <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-4 pl-1">
                {editingTaskId ? 'Sửa công việc' : 'Thêm công việc'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1.5 pl-1">Từ ngày</label>
                  <input 
                    type="date" 
                    required
                    value={newTaskDate}
                    onChange={e => setNewTaskDate(e.target.value)}
                    className={cn(
                      "w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm",
                      theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900"
                    )}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 pl-1">Đến hết ngày (Tùy chọn)</label>
                  <input 
                    type="date" 
                    value={newTaskEndDate}
                    onChange={e => setNewTaskEndDate(e.target.value)}
                    className={cn(
                      "w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm",
                      theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900"
                    )}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1.5 pl-1">Tiêu đề</label>
                  <input 
                    type="text" 
                    required
                    placeholder="VD: Họp dự án..."
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    className={cn(
                      "w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm",
                      theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900"
                    )}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1.5 pl-1">Ghi chú (Tùy chọn)</label>
                  <textarea 
                    rows={2}
                    placeholder="Chi tiết công việc..."
                    value={newTaskDesc}
                    onChange={e => setNewTaskDesc(e.target.value)}
                    className={cn(
                      "w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm resize-none",
                      theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900"
                    )}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1.5 pl-1">Màu sắc</label>
                  <div className={cn(
                    "flex flex-wrap gap-2.5 p-2.5 rounded-xl border shadow-inner",
                    theme === 'dark' ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100"
                  )}>
                    {Object.entries({
                      red: 'bg-rose-500',
                      blue: 'bg-blue-500',
                      green: 'bg-emerald-500',
                      purple: 'bg-violet-500',
                      orange: 'bg-amber-500'
                    }).map(([key, bgClass]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewTaskColor(key)}
                        className={cn(
                          "w-7 h-7 rounded-full border-2 focus:outline-none transition-all duration-300 ease-out",
                          bgClass,
                          newTaskColor === key 
                            ? (theme === 'dark' ? "border-white scale-110 shadow-lg ring-2 ring-gray-700 ring-offset-1" : "border-gray-900 scale-110 shadow-md ring-2 ring-gray-100 ring-offset-1") 
                            : "border-transparent opacity-80 hover:opacity-100 hover:scale-110 hover:shadow-sm"
                        )}
                        title={`Chọn màu ${key}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-md shadow-blue-500/20 transition-all active:scale-95"
                  >
                    {editingTaskId ? 'Cập nhật' : 'Xác nhận'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleCancelAdd}
                    className={cn(
                      "flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95",
                      theme === 'dark' ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Danh sách công việc</h2>
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {sortedTasks.length === 0 ? (
                <motion.p 
                  key="empty-tasks"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-sm text-gray-500 dark:text-gray-400 text-center py-8"
                >
                  Chưa có công việc nào
                </motion.p>
              ) : (
                sortedTasks.map(task => {
                  const taskColorKey = task.color || 'red';
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, height: 0 }}
                      transition={{ duration: 0.2 }}
                      key={task.id} 
                      className={cn(
                        "group flex flex-col p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden",
                        task.completed 
                          ? (theme === 'dark' ? "bg-emerald-950/20 border-emerald-900/50" : "bg-emerald-50/50 border-emerald-100") 
                          : (theme === 'dark' ? "bg-gray-800/50 border-gray-700 shadow-sm hover:border-gray-600" : "bg-white border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200")
                      )}
                    >
                      {task.completed && (
                         <div className={cn(
                           "absolute top-0 right-0 w-8 h-8 flex items-center justify-center rounded-bl-xl backdrop-blur-sm",
                           theme === 'dark' ? "bg-emerald-900/50" : "bg-emerald-100/50"
                         )}>
                           <CheckCircle size={14} className={theme === 'dark' ? "text-emerald-400" : "text-emerald-600"} />
                         </div>
                      )}
                      <div className="flex items-center gap-2 mb-1.5 pr-6">
                        <div className={cn("w-2.5 h-2.5 rounded-full ring-2 ring-offset-2", COLOR_MAP[taskColorKey].bg, theme === 'dark' ? "ring-offset-gray-900" : "ring-offset-white")} />
                        <span className={cn(
                          "text-[10px] font-black tracking-[0.15em] uppercase",
                          task.completed ? "text-emerald-500/70" : "text-gray-400 dark:text-gray-500"
                        )}>
                          {format(parseISO(task.date), 'dd/MM/yyyy')}
                          {task.endDate && ` - ${format(parseISO(task.endDate), 'dd/MM/yyyy')}`}
                        </span>
                      </div>
                      <h4 className={cn(
                        "text-sm font-bold pr-6 transition-colors tracking-tight",
                        task.completed ? "text-emerald-500/50 line-through" : "text-gray-900 dark:text-gray-100 group-hover:text-blue-500 dark:group-hover:text-blue-400"
                      )}>{task.title}</h4>
                      {task.description && (
                        <p className={cn(
                          "text-xs mt-1.5 line-clamp-2 leading-relaxed tracking-wide font-medium",
                          task.completed ? "text-emerald-600/30" : "text-gray-500 dark:text-gray-400"
                        )}>{task.description}</p>
                      )}
                      <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-all duration-300 justify-end translate-y-2 group-hover:translate-y-0">
                        <button 
                          onClick={() => handleToggleComplete(task.id)} 
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            task.completed ? "text-emerald-500 hover:bg-emerald-500/10" : "text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                          )}
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button 
                          onClick={() => handleEditTask(task)} 
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTask(task.id)} 
                          className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
        </aside>
      </div>

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col h-full w-0 overflow-hidden transition-all duration-300",
        theme === 'dark' ? "bg-gray-950" : "bg-[#f8fafc]"
      )}>
        <header className={cn(
          "py-3 lg:h-16 border-b flex flex-col md:flex-row items-start md:items-center justify-between px-4 lg:px-8 flex-shrink-0 gap-3 md:gap-0 sticky top-0 z-30 transition-colors",
          theme === 'dark' ? "bg-gray-900/50 border-gray-800 backdrop-blur-xl" : "bg-white/80 border-gray-200 backdrop-blur-xl shadow-sm"
        )}>
          
          <div className="flex items-center gap-1 sm:gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className={cn(
                  "p-3 -ml-2 rounded-xl transition-all border md:border-0",
                  theme === 'dark' 
                    ? "bg-gray-800 text-gray-300 border-gray-700 active:bg-gray-700" 
                    : "bg-gray-50 text-gray-600 border-gray-100 active:bg-gray-200"
                )}
                title="Đóng/mở thanh bên"
              >
                <Menu size={22} />
              </button>
            </div>
            
            <div className="flex items-center">
              <button onClick={prevPeriod} className="p-2 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors">
                <ChevronLeft size={20} />
              </button>
              <h2 className={cn(
                "text-base sm:text-lg lg:text-xl font-black min-w-[120px] sm:min-w-[160px] text-center px-1 uppercase tracking-tighter",
                theme === 'dark' ? "text-gray-100" : "text-gray-900"
              )}>
                {viewMode === '12' ? `Năm ${currentYear}` : 
                 viewMode === '6' ? `6 Tháng ${baseMonth < 6 ? 'Đầu' : 'Cuối'} Năm ${currentYear}` : 
                 `Tháng ${baseMonth + 1}, ${currentYear}`}
              </h2>
              <button onClick={nextPeriod} className="p-2 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="w-8 md:hidden" /> {/* Spacer for centering on mobile */}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 hide-scrollbar scroll-smooth">
            <button 
              onClick={() => setShowStats(true)}
              className={cn(
                "flex-shrink-0 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm border",
                theme === 'dark'
                  ? "bg-indigo-900/30 text-indigo-400 border-indigo-800/50 hover:bg-indigo-900/50"
                  : "bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50"
              )}
            >
              <FileSpreadsheet size={18} /> <span className="hidden sm:inline">Thống kê nâng cao</span>
            </button>
            <div className={cn("flex-shrink-0 flex items-center p-1 rounded-xl", theme === 'dark' ? "bg-gray-800" : "bg-gray-100")}>
              {[
                { id: '1', name: '1 Tháng', icon: Calendar },
                { id: '6', name: '6 Tháng', icon: LayoutGrid },
                { id: '12', name: '12 Tháng', icon: List }
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button 
                    key={m.id}
                    onClick={() => setViewMode(m.id as ViewMode)}
                    className={cn(
                      "px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center gap-2 transition-all",
                      viewMode === m.id 
                        ? (theme === 'dark' ? "bg-gray-700 text-white shadow-lg" : "bg-white shadow-sm text-gray-900") 
                        : (theme === 'dark' ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700")
                    )}
                  >
                    <Icon size={16} />
                    <span className="whitespace-nowrap">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <motion.div 
            layout
            className={cn(
              "grid gap-8 mx-auto w-full items-stretch",
              viewMode === '12' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
              viewMode === '6' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
              viewMode === '1' && "grid-cols-1 max-w-4xl"
            )}>
            <AnimatePresence mode="popLayout">
              {monthsToDisplay.map((month) => (
                <motion.div
                  key={format(month, 'yyyy-MM')}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                  className="h-full"
                >
                  <MonthView 
                    month={month} 
                    tasks={sortedTasks} 
                    viewMode={viewMode}
                    images={images}
                    onContextMenu={handleContextMenu}
                    onImageClick={setFullscreenImage}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>

      <AnimatePresence>
      {/* Stats Modal */}
      {showStats && (
        <motion.div 
          key="stats-modal"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-md sm:p-4 md:p-8"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 100 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
            className="bg-white sm:rounded-3xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-5xl flex flex-col shadow-2xl overflow-hidden"
          >
            <div className={cn(
              "flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b sticky top-0 z-10 backdrop-blur-xl",
              theme === 'dark' ? "bg-gray-900/80 border-gray-800" : "bg-white/80 border-gray-100"
            )}>
              <h2 className={cn(
                "text-lg sm:text-xl font-black uppercase tracking-tighter flex items-center gap-2",
                theme === 'dark' ? "text-gray-100" : "text-gray-900"
              )}>
                <FileSpreadsheet className="text-blue-500" size={24} />
                <span>Thống kê {currentYear}</span> <span className="text-blue-500 opacity-60">({sortedTasks.length})</span>
              </h2>
              <div className="flex items-center gap-2 sm:gap-3">
                <button 
                  onClick={downloadCSV}
                  className="flex items-center gap-1 sm:gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <Download size={14} /> <span>Xuất CSV</span>
                </button>
                <button 
                  onClick={() => setShowStats(false)}
                  className={cn(
                    "p-2 sm:p-2.5 rounded-full transition-colors",
                    theme === 'dark' ? "text-gray-400 hover:text-gray-100 hover:bg-gray-800" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className={cn(
              "flex-1 overflow-auto p-4 sm:p-8",
              theme === 'dark' ? "bg-gray-950" : "bg-gray-50/30"
            )}>
              {/* Stats Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {[
                  { label: 'Tổng công việc', value: tasks.length, color: 'blue', icon: Calendar },
                  { label: 'Hoàn thành', value: tasks.filter(t => t.completed).length, color: 'emerald', icon: CheckCircle },
                  { label: 'Chưa xong', value: tasks.filter(t => !t.completed).length, color: 'rose', icon: LayoutGrid },
                  { label: 'Tỷ lệ', value: `${tasks.length ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0}%`, color: 'amber', icon: FileSpreadsheet },
                ].map((stat) => (
                  <div key={stat.label} className={cn(
                    "p-6 rounded-[2rem] border transition-all duration-300 flex flex-col items-center text-center",
                    theme === 'dark' ? "bg-gray-900/50 border-gray-800 hover:border-gray-700" : "bg-white border-gray-100 shadow-sm hover:shadow-md"
                  )}>
                    <div className={cn("p-3 rounded-2xl mb-4", theme === 'dark' ? "bg-gray-800" : "bg-gray-50")}>
                      <stat.icon size={24} className={theme === 'dark' ? `text-${stat.color}-400` : `text-${stat.color}-600`} />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className={cn("text-3xl font-black tracking-tighter", theme === 'dark' ? "text-white" : "text-gray-900")}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className={cn(
                "hidden md:block border text-sm rounded-[2rem] overflow-hidden transition-all",
                theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100 shadow-sm"
              )}>
                <div className="overflow-x-auto hide-scrollbar">
                  <table className="w-full min-w-[800px] text-left">
                    <thead>
                      <tr className={cn(
                        "border-b text-[10px] font-black uppercase tracking-[0.2em]",
                        theme === 'dark' ? "bg-gray-800/50 border-gray-800 text-gray-500" : "bg-gray-50 border-gray-100 text-gray-400"
                      )}>
                        <th className="px-6 py-4 w-12 text-center">STT</th>
                        <th className="px-6 py-4 text-center">Phân loại</th>
                        <th className="px-6 py-4 text-center">Trạng thái</th>
                        <th className="px-6 py-4">Ngày bắt đầu</th>
                        <th className="px-6 py-4">Hạn chót</th>
                        <th className="px-6 py-4">Tiêu đề</th>
                        <th className="px-6 py-4">Mô tả</th>
                      </tr>
                    </thead>
                    <tbody className={cn("divide-y", theme === 'dark' ? "divide-gray-800" : "divide-gray-100")}>
                      {sortedTasks.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-20 text-center">
                            <PlusCircle size={48} className="mx-auto mb-4 opacity-5" />
                            <p className="text-lg font-black tracking-tight text-gray-400">Danh sách trống</p>
                          </td>
                        </tr>
                      ) : (
                        sortedTasks.map((t, idx) => {
                          const tColor = t.color || 'red';
                          return (
                            <tr key={t.id} className={cn(
                              "transition-colors group",
                              theme === 'dark' ? "hover:bg-gray-800/40" : "hover:bg-gray-50"
                            )}>
                              <td className="px-6 py-4 text-center text-gray-400 dark:text-gray-600 font-mono text-[10px]">{idx + 1}</td>
                              <td className="px-6 py-4">
                                <div className="flex justify-center">
                                  <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm", COLOR_MAP[tColor].bg, COLOR_MAP[tColor].text)}>
                                    {tColor}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex justify-center">
                                  {t.completed ? (
                                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                                      <CheckCircle size={10} /> XONG
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                                      <Calendar size={10} /> CHỜ
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className={cn("px-6 py-4 font-bold whitespace-nowrap", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                                {format(parseISO(t.date), 'dd/MM/yyyy')}
                              </td>
                              <td className={cn("px-6 py-4 font-medium whitespace-nowrap", theme === 'dark' ? "text-gray-500" : "text-gray-400")}>
                                {t.endDate ? format(parseISO(t.endDate), 'dd/MM/yyyy') : '—'}
                              </td>
                              <td className={cn("px-6 py-4 font-black tracking-tight", theme === 'dark' ? "text-gray-100" : "text-gray-900")}>
                                {t.title}
                              </td>
                              <td className={cn("px-6 py-4 text-xs font-medium max-w-[200px] truncate opacity-60", theme === 'dark' ? "text-gray-400" : "text-gray-500")} title={t.description}>
                                {t.description || '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden space-y-4 pb-20">
                {sortedTasks.length === 0 ? (
                  <div className={cn(
                    "border border-dashed rounded-2xl p-12 text-center",
                    theme === 'dark' ? "border-gray-800 bg-gray-900/50" : "border-gray-200 bg-white"
                  )}>
                    <PlusCircle size={40} className="mx-auto mb-3 text-gray-200 opacity-20" />
                    <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Danh sách trống</p>
                  </div>
                ) : (
                  sortedTasks.map((t, idx) => (
                    <div key={t.id} className={cn(
                      "rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden",
                      theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100 shadow-sm"
                    )}>
                      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", COLOR_MAP[t.color || 'red'].bg)} />
                      <div className="flex justify-between items-start mb-4 pl-2">
                        <div>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-1">CÔNG VIỆC #{idx + 1}</span>
                          <h3 className={cn("text-lg font-black tracking-tight leading-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>{t.title}</h3>
                        </div>
                        {t.completed ? (
                          <div className="bg-emerald-500/10 text-emerald-500 p-1.5 rounded-xl border border-emerald-500/20">
                            <CheckCircle size={20} />
                          </div>
                        ) : (
                          <div className="bg-amber-500/10 text-amber-500 p-1.5 rounded-xl border border-amber-500/20">
                            <Calendar size={20} />
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-5 pl-2">
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Bắt Đầu</p>
                          <p className={cn("text-xs font-bold", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>{format(parseISO(t.date), 'dd/MM/yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Kết Thúc</p>
                          <p className={cn("text-xs font-bold", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>{t.endDate ? format(parseISO(t.endDate), 'dd/MM/yyyy') : '—'}</p>
                        </div>
                      </div>

                      {t.description && (
                        <div className={cn("mt-4 pt-4 border-t pl-2", theme === 'dark' ? "border-gray-800" : "border-gray-50")}>
                           <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Mô tả</p>
                           <p className={cn("text-xs font-medium leading-relaxed opacity-70", theme === 'dark' ? "text-gray-400" : "text-gray-500")}>{t.description}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileChange} 
      />

      {/* Context Menu */}
      <AnimatePresence>
      {contextMenu && (
        <motion.div 
          key="context-menu"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            "fixed z-[100] backdrop-blur-xl border shadow-2xl rounded-2xl py-2 w-56 text-sm overflow-hidden transition-colors",
            theme === 'dark' ? "bg-gray-900/90 border-gray-800" : "bg-white/90 border-gray-100"
          )}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button 
            onClick={handleAddContextMenuTask}
            className={cn(
              "w-full text-left px-5 py-2.5 flex items-center gap-3 font-black uppercase tracking-widest text-[10px] transition-colors",
              theme === 'dark' ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <PlusCircle size={16} className="text-blue-500" />
            Thêm công việc
          </button>
          <div className={cn("h-px my-1 mx-4", theme === 'dark' ? "bg-gray-800" : "bg-gray-100")} />
          <button 
            onClick={handleUploadImageFromContextMenu}
            className={cn(
              "w-full text-left px-5 py-2.5 flex items-center gap-3 font-black uppercase tracking-widest text-[10px] transition-colors",
              theme === 'dark' ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <ImageIcon size={16} className="text-purple-500" />
            Tải ảnh lên
          </button>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Fullscreen Image Modal */}
      <AnimatePresence>
      {fullscreenImage && (
        <motion.div 
          key="fullscreen-image"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-gray-900/95 flex flex-col items-center justify-center p-4 md:p-12 backdrop-blur-lg cursor-zoom-out"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            onClick={() => setFullscreenImage(null)}
            className="absolute top-6 right-6 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 hover:scale-110 active:scale-95 rounded-full transition-all"
          >
            <X size={24} />
          </button>
          <motion.img 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
            src={fullscreenImage} 
            alt="Fullscreen" 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

// --- Month Component ---
function MonthView({ 
  month, 
  tasks, 
  viewMode,
  images,
  onContextMenu,
  onImageClick
}: { 
  month: Date; 
  tasks: Task[]; 
  viewMode: ViewMode;
  images: Record<string, string[]>;
  onContextMenu: (e: React.MouseEvent | null, date: string, touchX?: number, touchY?: number) => void;
  onImageClick: (img: string) => void;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(monthStart);
  const startDate = getDay(monthStart); // 0 = Sunday
  const daysInMonth = getDaysInMonth(monthStart);
  
  // Adjust so Monday is first day of week (0 = Monday, 6 = Sunday)
  const startOffset = startDate === 0 ? 6 : startDate - 1;

  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getTasksForDay = (date: Date) => {
    const dayStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(t => {
      if (t.endDate) {
        return dayStr >= t.date && dayStr <= t.endDate;
      }
      return dayStr === t.date;
    });
  };

  const isLarge = viewMode === '1';
  const isOdd = month.getMonth() % 2 !== 0;

  const totalCells = 42; // 6 rows * 7 columns
  const endOffset = totalCells - (startOffset + daysInMonth);

  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (e: React.TouchEvent, dateStr: string) => {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    
    longPressTimer.current = setTimeout(() => {
      onContextMenu(null, dateStr, x, y);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className={cn(
      "rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 border transition-all duration-500 h-full flex flex-col group/month",
      isLarge && "sm:p-10 text-xl",
      isOdd 
        ? "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)]" 
        : "bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800 shadow-none hover:shadow-[0_20px_40px_rgb(0,0,0,0.04)]"
    )}>
      <h3 className={cn(
        "font-black text-gray-900 dark:text-gray-100 mb-4 sm:mb-6 text-center tracking-tighter uppercase",
        isLarge ? "text-2xl sm:text-4xl mb-6 sm:mb-10" : "text-lg sm:text-xl",
        isOdd ? "opacity-100" : "opacity-80"
      )}>
        Tháng {month.getMonth() + 1}
      </h3>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2 sm:mb-4 text-[10px] sm:text-xs">
        {weekDays.map(day => (
          <div key={day} className={cn(
            "font-black tracking-widest",
            (day === 'T7' || day === 'CN') ? "text-rose-500/80" : "text-gray-400 dark:text-gray-500"
          )}>
            {day}
          </div>
        ))}
      </div>

      <div className={cn("grid grid-cols-7 gap-1.5 flex-1", isLarge && "sm:gap-4")}>
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-start-${i}`} className="p-1 sm:p-2" />
        ))}
        
        {days.map((day) => {
          const dayTasks = getTasksForDay(day);
          const hasTasks = dayTasks.length > 0;
          const isCurrentToday = isToday(day);
          const monthDay = format(day, 'MM-dd');
          const holidayInfo = HOLIDAYS[monthDay];
          const hasTooltip = hasTasks || !!holidayInfo;
          
          const taskColorKey = hasTasks ? (dayTasks[0].color || 'red') : 'red';

          return (
            <div 
              key={format(day, 'yyyy-MM-dd')} 
              className="relative group aspect-square select-none"
              onContextMenu={(e) => onContextMenu(e, format(day, 'yyyy-MM-dd'))}
              onTouchStart={(e) => handleTouchStart(e, format(day, 'yyyy-MM-dd'))}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              onTouchCancel={cancelLongPress}
            >
              <motion.div 
                whileHover={{ scale: 1.1, zIndex: 10 }}
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "w-full h-full flex flex-col items-center justify-center rounded-xl sm:rounded-2xl text-[10px] sm:text-sm transition-all duration-500 ease-out cursor-default relative overflow-hidden border",
                  isLarge && "sm:text-xl font-black",
                  hasTasks 
                    ? cn(COLOR_MAP[taskColorKey].bg, COLOR_MAP[taskColorKey].text, "font-bold shadow-lg border-transparent", COLOR_MAP[taskColorKey].hover) 
                    : cn(
                        "hover:scale-110 hover:shadow-xl hover:z-10",
                        isCurrentToday 
                          ? "bg-blue-600 text-white font-black shadow-xl shadow-blue-500/40 border-none ring-4 ring-blue-500/20" 
                          : holidayInfo 
                            ? "text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30" 
                            : "text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-700"
                      )
                )}
              >
                {images[format(day, 'yyyy-MM-dd')] && images[format(day, 'yyyy-MM-dd')].length > 0 && (
                  <div className="absolute inset-0 opacity-40 mix-blend-overlay group-hover:opacity-60 transition-opacity bg-cover bg-center" style={{ backgroundImage: `url(${images[format(day, 'yyyy-MM-dd')][0]})` }} />
                )}
                <span className="relative z-10">{format(day, 'd')}</span>
              </motion.div>

              {/* Tooltip for tasks */}
              {(hasTooltip || (images[format(day, 'yyyy-MM-dd')] && images[format(day, 'yyyy-MM-dd')].length > 0)) && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl backdrop-blur-sm bg-opacity-95 text-left">
                    <div className="font-bold border-b border-gray-700 pb-1 mb-2">
                       {format(day, 'dd/MM/yyyy')}
                    </div>
                    {images[format(day, 'yyyy-MM-dd')] && images[format(day, 'yyyy-MM-dd')].length > 0 && (
                      <div className="mb-2 w-full h-24 rounded overflow-hidden relative pointer-events-auto cursor-pointer" onClick={() => onImageClick(images[format(day, 'yyyy-MM-dd')][0])}>
                        <img src={images[format(day, 'yyyy-MM-dd')][0]} alt="Attached" className="object-cover w-full h-full" />
                      </div>
                    )}
                    <ul className="space-y-2">
                      {holidayInfo && (
                        <li className="flex flex-col">
                          <span className="font-semibold text-yellow-300">🎉 {holidayInfo}</span>
                        </li>
                      )}
                      {dayTasks.map(t => {
                        const tColor = t.color || 'red';
                        const dotColor = tColor === 'blue' ? 'text-blue-300' :
                                         tColor === 'green' ? 'text-green-300' :
                                         tColor === 'purple' ? 'text-purple-300' :
                                         tColor === 'orange' ? 'text-orange-300' : 'text-red-300';
                        return (
                        <li key={t.id} className="flex flex-col">
                          <span className={cn("font-semibold", dotColor)}>• <span className="text-white">{t.title}</span></span>
                          {t.description && <span className="text-gray-300 ml-3 opacity-80">{t.description}</span>}
                        </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900 absolute left-1/2 -translate-x-1/2" />
                </div>
              )}
            </div>
          );
        })}

        {endOffset > 0 && Array.from({ length: endOffset }).map((_, i) => (
          <div key={`empty-end-${i}`} className="p-1 sm:p-2" />
        ))}
      </div>
    </div>
  );
}

