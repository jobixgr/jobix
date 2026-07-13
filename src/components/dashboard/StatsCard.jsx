
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const colorClasses = {
  blue: {
    bg: "from-blue-500 to-blue-600",
    icon: "bg-blue-100 text-blue-600",
    accent: "text-blue-500"
  },
  purple: {
    bg: "from-blue-500 to-indigo-600", // Updated to blue theme
    icon: "bg-blue-100 text-blue-600", // Updated to blue theme
    accent: "text-blue-500" // Updated to blue theme
  },
  green: {
    bg: "from-emerald-500 to-emerald-600",
    icon: "bg-emerald-100 text-emerald-600", 
    accent: "text-emerald-500"
  },
  orange: {
    bg: "from-orange-500 to-orange-600",
    icon: "bg-orange-100 text-orange-600",
    accent: "text-orange-500"
  },
  red: {
    bg: "from-red-500 to-red-600",
    icon: "bg-red-100 text-red-600",
    accent: "text-red-500"
  },
  teal: {
    bg: "from-blue-500 to-indigo-600", // Updated to blue theme
    icon: "bg-blue-100 text-blue-600", // Updated to blue theme
    accent: "text-blue-500" // Updated to blue theme
  },
};

export default function StatsCard({ title, value, icon: Icon, color, trend, isLoading }) {
  const colors = colorClasses[color] || colorClasses.blue;

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
        <CardContent className="p-4 md:p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <Skeleton className="h-3 md:h-4 w-20 md:w-24 mb-2" />
              <Skeleton className="h-6 md:h-8 w-12 md:w-16" />
            </div>
            <Skeleton className="w-8 md:w-12 h-8 md:h-12 rounded-xl" />
          </div>
          <div className="mt-3 md:mt-4">
            <Skeleton className="h-3 w-12 md:w-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <div className={`absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br ${colors.bg} opacity-10 rounded-full transform translate-x-6 md:translate-x-8 -translate-y-6 md:-translate-y-8 group-hover:scale-110 transition-transform duration-300`} />
      
      <CardContent className="p-4 md:p-6 relative">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-xs md:text-sm font-medium text-slate-600 mb-2">{title}</p>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 mb-2 md:mb-3">
              {value}
            </div>
          </div>
          <div className={`w-8 md:w-12 h-8 md:h-12 rounded-xl ${colors.icon} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-4 md:w-6 h-4 md:h-6" />
          </div>
        </div>
        
        {trend && (
          <div className="flex items-center gap-1">
            <TrendingUp className={`w-3 md:w-4 h-3 md:h-4 ${colors.accent}`} />
            <span className={`text-xs md:text-sm font-semibold ${colors.accent}`}>{trend}</span>
            <span className="text-xs text-slate-500 ml-1 hidden sm:inline">από τον προηγούμενο μήνα</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
