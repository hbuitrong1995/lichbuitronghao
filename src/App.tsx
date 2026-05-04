import React, { useState, useMemo } from 'react';
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
import { ChevronLeft, ChevronRight, Plus, Calendar, List, LayoutGrid, Trash2, Edit2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Task = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  color?: string;
};

type ViewMode = '1' | '6' | '12';

// --- Constants ---
const COLOR_MAP: Record<string, { bg: string, text: string, hover: string, border: string }> = {
  red: { bg: 'bg-red-700', text: 'text-white', hover: 'hover:bg-red-800', border: 'border-red-800' },
  blue: { bg: 'bg-blue-700', text: 'text-white', hover: 'hover:bg-blue-800', border: 'border-blue-800' },
  green: { bg: 'bg-green-700', text: 'text-white', hover: 'hover:bg-green-800', border: 'border-green-800' },
  purple: { bg: 'bg-purple-700', text: 'text-white', hover: 'hover:bg-purple-800', border: 'border-purple-800' },
  orange: { bg: 'bg-orange-700', text: 'text-white', hover: 'hover:bg-orange-800', border: 'border-orange-800' },
};

// --- Mock Data / Initial State ---
const INITIAL_TASKS: Task[] = [
  { id: '1', date: '2026-05-15', title: 'Họp team thiết kế', description: 'Bàn về UI/UX cho app mới', color: 'blue' },
  { id: '2', date: '2026-05-20', title: 'Hoàn thành báo cáo', description: 'Gửi cho giám đốc', color: 'red' },
  { id: '3', date: '2026-08-10', title: 'Company Trip', description: 'Đi du lịch công ty ở Đà Nẵng', color: 'green' },
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
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 1)); // May 2026
  const [viewMode, setViewMode] = useState<ViewMode>('12');
  
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTaskDate, setNewTaskDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskColor, setNewTaskColor] = useState('red');

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
        title: newTaskTitle,
        description: newTaskDesc,
        color: newTaskColor
      } : t).sort((a, b) => a.date.localeCompare(b.date)));
    } else {
      const newTask: Task = {
        id: Date.now().toString(),
        date: newTaskDate,
        title: newTaskTitle,
        description: newTaskDesc,
        color: newTaskColor
      };
      
      setTasks([...tasks, newTask].sort((a, b) => a.date.localeCompare(b.date)));
    }
    
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskColor('red');
    setIsAddingTask(false);
    setEditingTaskId(null);
  };

  const handleEditTask = (task: Task) => {
    setNewTaskDate(task.date);
    setNewTaskTitle(task.title);
    setNewTaskDesc(task.description || '');
    setNewTaskColor(task.color || 'red');
    setEditingTaskId(task.id);
    setIsAddingTask(true);
  };

  const handleDeleteTask = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const handleCancelAdd = () => {
    setIsAddingTask(false);
    setEditingTaskId(null);
    setNewTaskDate(format(new Date(), 'yyyy-MM-dd'));
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

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10 flex-shrink-0">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Năm {currentYear}</h1>
          <p className="text-sm text-gray-500 mt-1">Lịch của Bùi Trọng Hào</p>
        </div>

        <div className="p-4 border-b border-gray-100">
          {!isAddingTask ? (
            <button 
              onClick={() => {
                setNewTaskDate(format(new Date(), 'yyyy-MM-dd'));
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
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Ngày diễn ra</label>
                  <input 
                    type="date" 
                    required
                    value={newTaskDate}
                    onChange={e => setNewTaskDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
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
                  <div className="flex gap-2">
                    {Object.entries({
                      red: 'bg-red-700',
                      blue: 'bg-blue-700',
                      green: 'bg-green-700',
                      purple: 'bg-purple-700',
                      orange: 'bg-orange-700'
                    }).map(([key, bgClass]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewTaskColor(key)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 focus:outline-none transition-all",
                          bgClass,
                          newTaskColor === key ? "border-gray-900 scale-110 shadow-sm" : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
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
          <div className="space-y-3">
            {sortedTasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Chưa có công việc nào</p>
            ) : (
              sortedTasks.map(task => {
                const taskColor = task.color || 'red';
                return (
                <div key={task.id} className="group flex flex-col p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn("w-2 h-2 rounded-full", COLOR_MAP[taskColor].bg)} />
                    <span className="text-xs font-medium text-gray-500">
                      {format(parseISO(task.date), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 group-hover:text-red-700">{task.title}</h4>
                  {task.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                  )}
                  <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <button 
                      onClick={() => handleEditTask(task)} 
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Sửa công việc"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteTask(task.id)} 
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Xóa công việc"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-gray-50/50">
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
          
          <div className="flex items-center gap-4">
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
          <div className={cn(
            "grid gap-8 mx-auto w-full",
            viewMode === '12' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
            viewMode === '6' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
            viewMode === '1' && "grid-cols-1 max-w-4xl"
          )}>
            {monthsToDisplay.map((month) => (
              <MonthView 
                key={month.toString()} 
                month={month} 
                tasks={tasks} 
                viewMode={viewMode}
              />
            ))}
          </div>
        </div>
      </main>

    </div>
  );
}

// --- Month Component ---
function MonthView({ month, tasks, viewMode }: { month: Date; tasks: Task[]; viewMode: ViewMode }) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(monthStart);
  const startDate = getDay(monthStart); // 0 = Sunday
  const daysInMonth = getDaysInMonth(monthStart);
  
  // Adjust so Monday is first day of week (0 = Monday, 6 = Sunday)
  const startOffset = startDate === 0 ? 6 : startDate - 1;

  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getTasksForDay = (date: Date) => {
    return tasks.filter(t => isSameDay(parseISO(t.date), date));
  };

  const isLarge = viewMode === '1';

  return (
    <div className={cn(
      "bg-white rounded-2xl p-5 border border-gray-200 shadow-sm transition-all hover:shadow-md",
      isLarge && "p-8"
    )}>
      <h3 className={cn(
        "font-bold text-gray-800 mb-4 text-center",
        isLarge ? "text-2xl mb-8" : "text-lg"
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
              key={day.toString()} 
              className="relative group aspect-square"
            >
              <div 
                className={cn(
                  "w-full h-full flex flex-col items-center justify-center rounded-lg text-sm transition-all cursor-default",
                  isLarge && "text-lg font-medium",
                  hasTasks ? cn(COLOR_MAP[taskColorKey].bg, COLOR_MAP[taskColorKey].text, "font-bold border shadow-sm", COLOR_MAP[taskColorKey].border, COLOR_MAP[taskColorKey].hover) : "text-gray-700 hover:bg-gray-100",
                  isCurrentToday && !hasTasks && "bg-blue-700 text-white font-bold border border-blue-800 shadow-sm hover:bg-blue-800",
                  holidayInfo && !hasTasks && !isCurrentToday && "text-red-700 font-bold bg-red-50/50 hover:bg-red-100"
                )}
              >
                <span>{format(day, 'd')}</span>
                {hasTasks && !isLarge && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white opacity-90 relative -bottom-1 shadow-sm" />
                )}
                {hasTasks && isLarge && (
                   <div className="flex gap-1 mt-1">
                      {dayTasks.map((_, i) => i < 3 && <div key={i} className="w-1.5 h-1.5 rounded-full bg-white opacity-90 shadow-sm" />)}
                      {dayTasks.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-white opacity-60 shadow-sm" />}
                   </div>
                )}
              </div>

              {/* Tooltip for tasks */}
              {hasTooltip && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                  <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl backdrop-blur-sm bg-opacity-95">
                    <div className="font-bold border-b border-gray-700 pb-1 mb-2">
                       {format(day, 'dd/MM/yyyy')}
                    </div>
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

