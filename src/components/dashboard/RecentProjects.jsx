
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FolderKanban, ArrowRight, Calendar, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { el } from "date-fns/locale";

const statusColors = {
  planned: "bg-slate-100 text-slate-700",
  active: "bg-blue-100 text-blue-700",
  on_hold: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700"
};

const statusLabels = {
  planned: "Σχεδιασμός",
  active: "Ενεργό",
  on_hold: "Σε Αναμονή", 
  completed: "Ολοκληρωμένο"
};

export default function RecentProjects({ projects, isLoading }) {
  const navigate = useNavigate();
  if (isLoading) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5" />
            Πρόσφατα Έργα
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl">
                <div className="flex-1">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <FolderKanban className="w-5 h-5 text-purple-500" />
            Πρόσφατα Έργα
          </CardTitle>
          <Link to={createPageUrl("Projects")}>
            <Button variant="outline" size="sm" className="text-slate-600">
              Όλα τα Έργα
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {projects.length === 0 ? (
            <div className="text-center py-8">
              <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 mb-2">Δεν υπάρχουν έργα ακόμα</p>
              <Link to={createPageUrl("Projects", "new")}>
                <Button size="sm" className="gradient-bg text-white">
                  Δημιούργησε το πρώτο σου έργο
                </Button>
              </Link>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer"
                onClick={() => navigate(createPageUrl("ProjectView", project.id))}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-purple-600 transition-colors">
                    {project.title}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    {project.start_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(project.start_date), 'dd MMM', { locale: el })}
                      </div>
                    )}
                    {project.budget_total && (
                      <span className="font-medium">€{project.budget_total.toLocaleString('el-GR')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[project.status]}>
                    {statusLabels[project.status]}
                  </Badge>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
