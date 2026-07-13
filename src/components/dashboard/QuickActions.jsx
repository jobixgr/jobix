
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, FileText, FolderKanban, Users, Zap } from "lucide-react";

export default function QuickActions() {
  const actions = [
    {
      title: "Νέα Προσφορά",
      description: "Δημιούργησε προσφορά για πελάτη",
      icon: FileText,
      url: createPageUrl("Proposals", "new"),
      color: "from-blue-500 to-indigo-600", // Changed from purple
      bgColor: "bg-blue-50",             // Changed from purple
      textColor: "text-blue-600"          // Changed from purple
    },
    {
      title: "Νέο Έργο", 
      description: "Ξεκίνα νέο έργο από την αρχή",
      icon: FolderKanban,
      url: createPageUrl("Projects", "new"),
      color: "from-sky-500 to-blue-600",
      bgColor: "bg-sky-50",
      textColor: "text-sky-600"
    },
    {
      title: "Νέος Πελάτης",
      description: "Πρόσθεσε νέο πελάτη",
      icon: Users,
      url: createPageUrl("Clients", "new"),
      color: "from-emerald-500 to-green-600", 
      bgColor: "bg-emerald-50",
      textColor: "text-emerald-600"
    }
  ];

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg mb-8">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 md:w-5 h-4 md:h-5 text-blue-500" /> {/* Changed from orange */}
          <CardTitle className="text-lg md:text-xl font-bold text-slate-900">Γρήγορες Ενέργειες</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {actions.map((action) => (
            <Link key={action.title} to={action.url}>
              <div className={`${action.bgColor} rounded-xl p-4 md:p-6 hover:shadow-lg transition-all duration-200 group border border-slate-100`}>
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <div className={`w-10 md:w-12 h-10 md:h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                    <action.icon className="w-5 md:w-6 h-5 md:h-6 text-white" />
                  </div>
                  <Plus className="w-4 md:w-5 h-4 md:h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
                <h3 className={`font-semibold text-sm md:text-base ${action.textColor} mb-1`}>{action.title}</h3>
                <p className="text-xs md:text-sm text-slate-600">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
