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
import { ChevronLeft, ChevronRight, Plus, Calendar, List, LayoutGrid, Trash2, Edit2, FileSpreadsheet, X, Download, CheckCircle, Menu, Image as ImageIcon, PlusCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

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
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('calendar_tasks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return INITIAL_TASKS;
  });

  useEffect(() => {
    localStorage.setItem('calendar_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const [images, setImages] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('calendar_images');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('calendar_images', JSON.stringify(images));
  }, [images]);

  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 1)); // May 2026
  const [viewMode, setViewMode] = useState<ViewMode>('12');
  const [showStats, setShowStats] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
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

  const handleContextMenu = (e: React.MouseEvent, date: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, date });
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
    if (!contextMenu || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        const base64 = event.target.result;
        setImages(prev => {
          const dateImages = prev[contextMenu.date] || [];
          return {
            ...prev,
            [contextMenu.date]: [...dateImages, base64]
          };
        });
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
    return () => window.removeEventListener('click', handleClick);
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

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskDate) return;
    
    if (editingTaskId) {
      setTasks(tasks.map(t => t.id === editingTaskId ? {
        ...t,
        date: newTaskDate,
        endDate: newTaskEndDate || undefined,
        title: newTaskTitle,
        description: newTaskDesc,
        color: newTaskColor
      } : t).sort((a, b) => a.date.localeCompare(b.date)));
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        date: newTaskDate,
        endDate: newTaskEndDate || undefined,
        title: newTaskTitle,
        description: newTaskDesc,
        color: newTaskColor
      };
      
      setTasks([...tasks, newTask].sort((a, b) => a.date.localeCompare(b.date)));
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

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleToggleComplete = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
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

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div className={cn(
        "transition-[width,margin] duration-300 ease-in-out h-full overflow-hidden flex-shrink-0 bg-white border-gray-200 z-10",
        isSidebarOpen ? "w-80 border-r" : "w-0 border-r-0"
      )}>
        <aside className="w-80 flex flex-col h-full shadow-sm">
          <div className="p-6 border-b border-gray-100 flex-shrink-0">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Năm {currentYear}</h1>
          <p className="text-sm text-gray-500 mt-1">Lịch của Bùi Trọng Hào</p>
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
            <form onSubmit={handleAddTask} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h3 className="font-semibold text-sm mb-3">
                {editingTaskId ? 'Sửa công việc' : 'Thêm công việc'}
              </h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-700 block mb-1">Từ ngày</label>
                    <input 
                      type="date" 
                      required
                      value={newTaskDate}
                      onChange={e => setNewTaskDate(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-700 block mb-1">Đến hết ngày (Tùy chọn)</label>
                    <input 
                      type="date" 
                      value={newTaskEndDate}
                      onChange={e => setNewTaskEndDate(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Tiêu đề</label>
                  <input 
                    type="text" 
                    required
                    placeholder="VD: Họp dự án..."
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Ghi chú (Tùy chọn)</label>
                  <textarea 
                    rows={2}
                    placeholder="Chi tiết công việc..."
                    value={newTaskDesc}
                    onChange={e => setNewTaskDesc(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Màu sắc</label>
                  <div className="flex gap-3">
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
                          newTaskColor === key ? "border-gray-900 scale-110 shadow-md ring-2 ring-gray-100 ring-offset-1" : "border-transparent opacity-80 hover:opacity-100 hover:scale-110 hover:shadow-sm"
                        )}
                        title={`Chọn màu ${key}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                   <button 
                    type="button"
                    onClick={handleCancelAdd}
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Lưu
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
                  className="text-sm text-gray-500 text-center py-8"
                >
                  Chưa có công việc nào
                </motion.p>
              ) : (
                sortedTasks.map(task => {
                  const taskColor = task.color || 'red';
                  return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, height: 0 }}
                    transition={{ duration: 0.2 }}
                    key={task.id} 
                    className={cn(
                      "group flex flex-col p-4 rounded-xl border transition-all duration-300 relative overflow-hidden",
                      task.completed 
                        ? "bg-emerald-50/50 border-emerald-100" 
                        : "bg-white border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200"
                    )}
                  >
                    {task.completed && (
                       <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-emerald-100/50 rounded-bl-xl backdrop-blur-sm">
                         <CheckCircle size={14} className="text-emerald-600" />
                       </div>
                    )}
                    <div className="flex items-center gap-2 mb-1.5 pr-6">
                      <div className={cn("w-2 h-2 rounded-full", COLOR_MAP[taskColor].bg)} />
                      <span className={cn(
                        "text-xs font-semibold tracking-wide uppercase",
                        task.completed ? "text-emerald-700/70" : "text-gray-500"
                      )}>
                        {format(parseISO(task.date), 'dd/MM/yyyy')}
                        {task.endDate && ` - ${format(parseISO(task.endDate), 'dd/MM/yyyy')}`}
                      </span>
                    </div>
                    <h4 className={cn(
                      "text-sm font-semibold pr-6 transition-colors",
                      task.completed ? "text-emerald-800 line-through opacity-60" : "text-gray-900 group-hover:text-rose-600"
                    )}>{task.title}</h4>
                    {task.description && (
                      <p className={cn(
                        "text-xs mt-1.5 line-clamp-2 leading-relaxed tracking-wide",
                        task.completed ? "text-emerald-600/60" : "text-gray-500"
                      )}>{task.description}</p>
                    )}
                    <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-all duration-300 justify-end translate-y-2 group-hover:translate-y-0">
                      <button 
                        onClick={() => handleToggleComplete(task.id)} 
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          task.completed ? "text-emerald-600 hover:bg-emerald-100" : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                        )}
                        title={task.completed ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button 
                        onClick={() => handleEditTask(task)} 
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Sửa công việc"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTask(task.id)} 
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Xóa công việc"
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
      <main className="flex-1 flex flex-col h-full bg-gray-50/50 w-0 overflow-hidden">
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              title="Đóng/mở thanh bên"
            >
              <Menu size={20} />
            </button>
            <button onClick={prevPeriod} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xl font-semibold w-48 text-center">
              {viewMode === '12' ? `Năm ${currentYear}` : 
               viewMode === '6' ? `6 Tháng ${baseMonth < 6 ? 'Đầu' : 'Cuối'} Năm ${currentYear}` : 
               `Tháng ${baseMonth + 1}, ${currentYear}`}
            </h2>
            <button onClick={nextPeriod} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setShowStats(true)}
              className="px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all text-gray-500 hover:text-gray-700 bg-white shadow-sm border border-gray-200 mr-2"
            >
              <FileSpreadsheet size={16} /> Thống kê
            </button>
            <button 
              onClick={() => setViewMode('1')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all",
                viewMode === '1' ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Calendar size={16} /> 1 Tháng
            </button>
            <button 
               onClick={() => setViewMode('6')}
               className={cn(
                 "px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all",
                 viewMode === '6' ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
               )}
            >
              <LayoutGrid size={16} /> 6 Tháng
            </button>
            <button 
               onClick={() => setViewMode('12')}
               className={cn(
                 "px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all",
                 viewMode === '12' ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
               )}
            >
              <List size={16} /> 12 Tháng
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <motion.div 
            layout
            className={cn(
              "grid gap-8 mx-auto w-full",
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 md:p-8"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="bg-white rounded-3xl w-full max-w-5xl max-h-full flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="text-blue-600" size={24} />
                Thống kê công việc ({sortedTasks.length})
              </h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={downloadCSV}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Download size={16} /> Tải Excel
                </button>
                <button 
                  onClick={() => setShowStats(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
              <div className="bg-white border text-sm border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full min-w-[800px] text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 font-semibold w-12 text-center text-xs">STT</th>
                      <th className="px-4 py-3 font-semibold text-xs">Phân loại</th>
                      <th className="px-4 py-3 font-semibold text-xs">Trạng thái</th>
                      <th className="px-4 py-3 font-semibold text-xs">Ngày bắt đầu</th>
                      <th className="px-4 py-3 font-semibold text-xs">Ngày kết thúc</th>
                      <th className="px-4 py-3 font-semibold text-xs">Tiêu đề</th>
                      <th className="px-4 py-3 font-semibold text-xs">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedTasks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Chưa có công việc nào</td>
                      </tr>
                    ) : (
                      sortedTasks.map((t, idx) => {
                        const tColor = t.color || 'red';
                        return (
                          <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3 text-center text-gray-500">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-start">
                                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold self-start", COLOR_MAP[tColor].bg, COLOR_MAP[tColor].text)}>Màu {tColor}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {t.completed ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle size={12} /> Đã xong</span>
                              ) : (
                                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Chưa xong</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-900 font-medium">{format(parseISO(t.date), 'dd/MM/yyyy')}</td>
                            <td className="px-4 py-3 text-gray-600">{t.endDate ? format(parseISO(t.endDate), 'dd/MM/yyyy') : '-'}</td>
                            <td className="px-4 py-3 text-gray-900 font-medium max-w-[200px] truncate" title={t.title}>{t.title}</td>
                            <td className="px-4 py-3 text-gray-500 max-w-[300px] truncate" title={t.description}>{t.description || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
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
          className="fixed z-[100] bg-white/90 backdrop-blur-md border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl py-2 w-52 text-sm overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={handleAddContextMenuTask}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 text-gray-700 font-medium transition-colors"
          >
            <PlusCircle size={16} className="text-blue-500" />
            Thêm công việc
          </button>
          <div className="h-px bg-gray-100 my-1 mx-4" />
          <button 
            onClick={handleUploadImageFromContextMenu}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 text-gray-700 font-medium transition-colors"
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
  onContextMenu: (e: React.MouseEvent, date: string) => void;
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

  return (
    <div className={cn(
      "bg-white rounded-[2rem] p-6 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-500",
      isLarge && "p-10 text-xl"
    )}>
      <h3 className={cn(
        "font-bold text-gray-900 mb-6 text-center tracking-tight",
        isLarge ? "text-3xl mb-10" : "text-xl"
      )}>
        Tháng {month.getMonth() + 1}
      </h3>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekDays.map(day => (
          <div key={day} className={cn(
            "text-xs font-semibold text-gray-400",
            (day === 'T7' || day === 'CN') && "text-red-400"
          )}>
            {day}
          </div>
        ))}
      </div>

      <div className={cn("grid grid-cols-7 gap-1", isLarge && "gap-3")}>
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="p-2" />
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
              className="relative group aspect-square"
              onContextMenu={(e) => onContextMenu(e, format(day, 'yyyy-MM-dd'))}
            >
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "w-full h-full flex flex-col items-center justify-center rounded-2xl text-sm transition-all duration-300 ease-out cursor-default relative overflow-hidden",
                  isLarge && "text-lg font-medium",
                  hasTasks ? cn(COLOR_MAP[taskColorKey].bg, COLOR_MAP[taskColorKey].text, "font-semibold shadow-md", COLOR_MAP[taskColorKey].hover) : "text-gray-700 bg-white border border-gray-100 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm",
                  isCurrentToday && !hasTasks && "bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/30 border-none hover:bg-blue-700",
                  holidayInfo && !hasTasks && !isCurrentToday && "text-rose-600 font-bold bg-rose-50 border-rose-100 hover:bg-rose-100"
                )}
              >
                {images[format(day, 'yyyy-MM-dd')] && images[format(day, 'yyyy-MM-dd')].length > 0 && (
                  <div className="absolute inset-0 opacity-25 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${images[format(day, 'yyyy-MM-dd')][0]})` }} />
                )}
                <span className="relative z-10 drop-shadow-sm">{format(day, 'd')}</span>
                {images[format(day, 'yyyy-MM-dd')] && images[format(day, 'yyyy-MM-dd')].length > 0 && (
                  <div className="absolute top-1.5 right-1.5 z-10 text-gray-500 opacity-60 backdrop-blur-sm bg-white/30 rounded-full p-0.5">
                    <ImageIcon size={10} />
                  </div>
                )}
              </motion.div>

              {/* Tooltip for tasks */}
              {(hasTooltip || (images[format(day, 'yyyy-MM-dd')] && images[format(day, 'yyyy-MM-dd')].length > 0)) && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl backdrop-blur-sm bg-opacity-95">
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
                        // Use basic colors for tooltip indicator
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
      </div>
    </div>
  );
}

