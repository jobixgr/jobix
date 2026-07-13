
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox'; // Not used in current logic but kept from original
import { Badge } from '@/components/ui/badge';
import { Task } from '@/api/entities';
import { CheckCircle2, Clock, Plus } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function TasksList({ tasks: initialTasks, projectId }) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleTaskToggle = async (taskId, currentStatus) => {
    setIsUpdating(true);
    try {
      const newStatus = currentStatus === 'done' ? 'in_progress' : 'done';
      
      // Optimistic update
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        )
      );

      await Task.update(taskId, { status: newStatus });
      
      toast({ 
        title: "Επιτυχία!", 
        description: newStatus === 'done' ? "Η εργασία ολοκληρώθηκε!" : "Η εργασία επιστράφηκε στις ενεργές."
      });

    } catch (error) {
      console.error("Failed to update task:", error);
      // Revert optimistic update
      setTasks(initialTasks);
      toast({ 
        title: "Σφάλμα", 
        description: "Αποτυχία ενημέρωσης εργασίας.", 
        variant: "destructive" 
      });
    }
    setIsUpdating(false);
  };

  const handleAddNewTask = async () => {
    if (!newTaskTitle.trim()) {
      toast({ 
        title: "Προσοχή", 
        description: "Ο τίτλος εργασίας δεν μπορεί να είναι κενός.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      const newTask = await Task.create({
        project_id: projectId,
        title: newTaskTitle,
        status: 'todo',
        priority: 'medium'
      });

      setTasks(prev => [...prev, newTask]);
      setNewTaskTitle("");
      setShowNewTaskForm(false);
      toast({ title: "Επιτυχία!", description: "Η εργασία προστέθηκε." });
    } catch (error) {
      console.error("Error adding task:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία προσθήκης εργασίας.", variant: "destructive" });
    }
  };

  const inProgressTasks = tasks.filter(task => task.status === 'in_progress' || task.status === 'todo');
  const doneTasks = tasks.filter(task => task.status === 'done');
  const completionPercentage = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-slate-200 shadow-lg">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Πρόοδος Έργου</h3>
              <p className="text-sm text-slate-600">
                {doneTasks.length} από {tasks.length} εργασίες ολοκληρωμένες
              </p>
              {tasks.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  💡 Κάντε κλικ σε μια εργασία για να αλλάξετε την κατάσταση
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900">{completionPercentage}%</div>
                <div className="text-xs text-slate-500">Ολοκλήρωση</div>
              </div>
              <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  completionPercentage === 100 ? 'bg-green-500' : 'bg-blue-500'
                }`}>
                  <span className="text-white font-bold text-lg">{completionPercentage}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add New Task Button */}
      {!showNewTaskForm ? (
        <div className="flex justify-center">
          <Button 
            onClick={() => setShowNewTaskForm(true)}
            className="gradient-bg text-white" // Assuming 'gradient-bg' is a defined class or replace with actual colors like 'bg-blue-500 hover:bg-blue-600'
          >
            <Plus className="w-4 h-4 mr-2" />
            Προσθήκη Νέας Εργασίας
          </Button>
        </div>
      ) : (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                placeholder="Τίτλος εργασίας..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleAddNewTask()}
              />
              <div className="flex gap-2">
                <Button onClick={handleAddNewTask} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Προσθήκη
                </Button>
                <Button 
                  onClick={() => {
                    setShowNewTaskForm(false);
                    setNewTaskTitle("");
                  }} 
                  variant="outline" 
                  size="sm"
                >
                  Άκυρο
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* In Progress Tasks */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-blue-500" />
              Σε Εξέλιξη
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {inProgressTasks.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inProgressTasks.length > 0 ? (
              inProgressTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-100 hover:shadow-md transition-all cursor-pointer hover:bg-blue-50"
                  onClick={() => handleTaskToggle(task.id, task.status)}
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-6 h-6 border-2 rounded-md flex items-center justify-center transition-all hover:scale-110 ${
                      isUpdating ? 'border-gray-300 bg-gray-100' : 'border-blue-500 hover:bg-blue-50 cursor-pointer'
                    }`}>
                      {/* Empty checkbox */}
                      <div className="w-3 h-3 rounded-sm"></div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm md:text-base font-medium text-slate-900 leading-relaxed mb-1">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs md:text-sm text-slate-500 mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      {task.priority && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            task.priority === 'high' ? 'border-red-200 text-red-700' :
                            task.priority === 'medium' ? 'border-yellow-200 text-yellow-700' :
                            'border-blue-200 text-blue-700'
                          }`}
                        >
                          {task.priority === 'high' ? 'Υψηλή' : task.priority === 'medium' ? 'Μέση' : 'Χαμηλή'}
                        </Badge>
                      )}
                      <span className="text-xs text-slate-400">👆 Κλικ για ολοκλήρωση</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Δεν υπάρχουν ενεργές εργασίες</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Tasks */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Ολοκληρωμένες
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {doneTasks.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {doneTasks.length > 0 ? (
              doneTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-200 hover:shadow-md transition-all cursor-pointer hover:bg-green-100"
                  onClick={() => handleTaskToggle(task.id, task.status)}
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-6 h-6 border-2 border-green-500 bg-green-500 rounded-md flex items-center justify-center transition-all hover:scale-110 cursor-pointer`}>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm md:text-base font-medium text-slate-600 line-through leading-relaxed mb-1">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs md:text-sm text-slate-400 line-through mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
                        ✓ Ολοκληρώθηκε
                      </Badge>
                      <span className="text-xs text-slate-400">👆 Κλικ για επαναφορά</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Καμία εργασία δεν έχει ολοκληρωθεί ακόμα</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      {tasks.length > 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-slate-600">
                {completionPercentage === 100 ? (
                  <span className="text-green-600 font-semibold">🎉 Συγχαρητήρια! Όλες οι εργασίες έχουν ολοκληρωθεί!</span>
                ) : (
                  <span>
                    Απομένουν <strong>{inProgressTasks.length} εργασίες</strong> για την ολοκλήρωση του έργου
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
