
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/api/entities';
import { useToast } from "@/components/ui/use-toast";
import { Plus, Loader2, Edit, Trash2, MoreVertical, Calendar, MessageSquare, MapPin, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { el } from 'date-fns/locale';


const priorityStyles = {
    low: { bg: 'bg-blue-100', text: 'text-blue-800' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    high: { bg: 'bg-red-100', text: 'text-red-800' }
};

const priorityLabels = {
    low: 'Χαμηλή',
    medium: 'Μέτρια',
    high: 'Υψηλή'
};

function NewTaskDialog({ isOpen, onClose, projectId, columnStatus, onTaskCreated, existingTask }) {
    const [taskData, setTaskData] = useState({
        title: '',
        description: '',
        priority: 'medium',
        date: '',
        time: '',
        location: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (existingTask) {
            const parsedDate = existingTask.due_date ? parseISO(existingTask.due_date) : null;
            setTaskData({
                title: existingTask.title || '',
                description: existingTask.description || '',
                priority: existingTask.priority || 'medium',
                date: parsedDate ? format(parsedDate, 'yyyy-MM-dd') : '',
                time: parsedDate ? format(parsedDate, 'HH:mm') : '',
                location: existingTask.location || ''
            });
        } else {
            setTaskData({
                title: '',
                description: '',
                priority: 'medium',
                date: '',
                time: '',
                location: ''
            });
        }
    }, [existingTask, isOpen]);

    const handleSave = async () => {
        if (!taskData.title) {
            toast({ title: "Σφάλμα", description: "Ο τίτλος είναι υποχρεωτικός.", variant: "destructive" });
            return;
        }
        setIsSaving(true);

        let due_date_iso = null;
        if (taskData.date) {
            const timePart = taskData.time || '00:00';
            // Construct a Date object and then convert to ISO string.
            // It's important to use a full ISO string for consistency.
            due_date_iso = new Date(`${taskData.date}T${timePart}:00`).toISOString(); 
        }

        const payload = {
            project_id: projectId,
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            status: existingTask ? existingTask.status : columnStatus,
            due_date: due_date_iso,
            location: taskData.location,
        };

        try {
            if (existingTask) {
                await Task.update(existingTask.id, payload);
                toast({ title: "Επιτυχία!", description: "Η εργασία ενημερώθηκε." });
            } else {
                await Task.create(payload);
                toast({ title: "Επιτυχία!", description: "Η εργασία δημιουργήθηκε." });
            }
            onTaskCreated();
            onClose();
        } catch (error) {
            console.error("Error saving task:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία αποθήκευσης.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{existingTask ? 'Επεξεργασία Εργασίας' : 'Νέα Εργασία'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Input
                        placeholder="Τίτλος εργασίας"
                        value={taskData.title}
                        onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                        required
                    />
                    <Textarea
                        placeholder="Περιγραφή (προαιρετικά)"
                        value={taskData.description}
                        onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            type="date"
                            value={taskData.date}
                            onChange={(e) => setTaskData({ ...taskData, date: e.target.value })}
                        />
                         <Input
                            type="time"
                            value={taskData.time}
                            onChange={(e) => setTaskData({ ...taskData, time: e.target.value })}
                        />
                    </div>
                     <Input
                        placeholder="Τοποθεσία (προαιρετικά)"
                        value={taskData.location}
                        onChange={(e) => setTaskData({ ...taskData, location: e.target.value })}
                    />
                    <Select value={taskData.priority} onValueChange={(value) => setTaskData({ ...taskData, priority: value })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Προτεραιότητα" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">Χαμηλή</SelectItem>
                            <SelectItem value="medium">Μέτρια</SelectItem>
                            <SelectItem value="high">Υψηλή</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSaving}>Άκυρο</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {existingTask ? 'Αποθήκευση Αλλαγών' : 'Δημιουργία Εργασίας'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function TasksKanban({ tasks, projectId, onTaskStatusChange, onTaskOrderChange, reloadProjectData }) {
    const { toast } = useToast();
    const [columns, setColumns] = useState({ todo: [], in_progress: [], done: [] });
    const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
    const [newTaskStatus, setNewTaskStatus] = useState('todo');
    const [editingTask, setEditingTask] = useState(null);

    useEffect(() => {
        // Ensure tasks are sorted by order_index within each status column
        const todo = tasks.filter(t => t.status === 'todo').sort((a, b) => a.order_index - b.order_index);
        const in_progress = tasks.filter(t => t.status === 'in_progress').sort((a, b) => a.order_index - b.order_index);
        const done = tasks.filter(t => t.status === 'done').sort((a, b) => a.order_index - b.order_index);
        setColumns({ todo, in_progress, done });
    }, [tasks]);

    const onDragEnd = (result) => {
        const { source, destination } = result;
        if (!destination) return;

        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
        }
        
        // Delegate the full drag-and-drop logic (including UI state update and backend calls) to a prop function
        onTaskOrderChange(source, destination);
    };
    
    const handleTaskCreated = () => {
        reloadProjectData();
    };
    
    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την εργασία;")) return;
        try {
            await Task.delete(taskId);
            toast({ title: "Επιτυχία", description: "Η εργασία διαγράφηκε." });
            reloadProjectData();
        } catch (error) {
            console.error("Error deleting task:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής.", variant: "destructive" });
        }
    };

    const columnHeaders = {
        todo: { title: "Προς Εκτέλεση", color: "bg-slate-100" },
        in_progress: { title: "Σε Εξέλιξη", color: "bg-blue-100" },
        done: { title: "Ολοκληρωμένα", color: "bg-emerald-100" }
    };

    return (
        <>
            <NewTaskDialog
                isOpen={showNewTaskDialog || !!editingTask}
                onClose={() => { setShowNewTaskDialog(false); setEditingTask(null); }}
                projectId={projectId}
                columnStatus={newTaskStatus}
                onTaskCreated={handleTaskCreated}
                existingTask={editingTask}
            />
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    {Object.entries(columns).map(([columnId, columnTasks]) => (
                        <Droppable key={columnId} droppableId={columnId}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`p-4 rounded-lg transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100' : 'bg-slate-50/50'}`}
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="font-semibold text-slate-700">{columnHeaders[columnId].title} <Badge variant="secondary">{columnTasks.length}</Badge></h2>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => { setNewTaskStatus(columnId); setShowNewTaskDialog(true); }}
                                        >
                                            <Plus className="w-4 h-4 text-slate-500" />
                                        </Button>
                                    </div>
                                    <div className="space-y-4">
                                        {columnTasks.map((task, index) => (
                                            <Draggable key={task.id} draggableId={task.id} index={index}>
                                                {(providedDraggable, snapshot) => (
                                                    <div
                                                        ref={providedDraggable.innerRef}
                                                        {...providedDraggable.draggableProps}
                                                        {...providedDraggable.dragHandleProps}
                                                        className={`bg-white rounded-lg shadow-md border hover:shadow-lg transition-shadow ${snapshot.isDragging ? 'shadow-xl' : ''}`}
                                                    >
                                                        <CardContent className="p-4 space-y-2">
                                                            <div className="flex justify-between items-start">
                                                                <h3 className={`font-semibold text-slate-800 pr-2 ${task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-800'}`}>{task.title}</h3>
                                                                <MoreVertical className="w-5 h-5 text-slate-400 cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditingTask(task); }} />
                                                            </div>

                                                             {task.due_date && (
                                                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                                                    <div className="flex items-center gap-1">
                                                                        <Calendar className="w-4 h-4" />
                                                                        <span>{format(parseISO(task.due_date), 'dd MMM', { locale: el })}</span>
                                                                    </div>
                                                                     <div className="flex items-center gap-1">
                                                                        <Clock className="w-4 h-4" />
                                                                        <span>{format(parseISO(task.due_date), 'HH:mm')}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            {task.location && (
                                                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                                                    <MapPin className="w-4 h-4" />
                                                                    <span>{task.location}</span>
                                                                </div>
                                                            )}

                                                            <div className="flex justify-between items-center pt-2">
                                                                <Badge className={`${priorityStyles[task.priority].bg} ${priorityStyles[task.priority].text} border-none`}>
                                                                    {priorityLabels[task.priority]}
                                                                </Badge>
                                                                {task.description && <MessageSquare className="w-4 h-4 text-slate-400" />}
                                                            </div>
                                                        </CardContent>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                </div>
                            )}
                        </Droppable>
                    ))}
                </div>
            </DragDropContext>
        </>
    );
}
