import Link from "next/link";
import {
  BookOpen,
  Users,
  Award,
  Shield,
  ChevronRight,
} from "lucide-react";

interface PortalOption {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  url: string;
  color: string;
}

const portals: PortalOption[] = [
  {
    id: "student",
    name: "Student",
    icon: BookOpen,
    url: "/student/login",
    color: "text-blue-500",
  },
  {
    id: "parent",
    name: "Parent",
    icon: Users,
    url: "/parent/login",
    color: "text-green-500",
  },
  {
    id: "teacher",
    name: "Teacher",
    icon: Award,
    url: "/teacher/login",
    color: "text-purple-500",
  },
  {
    id: "admin",
    name: "Admin",
    icon: Shield,
    url: "/admin/login",
    color: "text-red-500",
  },
];

export interface PortalSwitcherProps {
  currentPortal?: string;
}

export function PortalSwitcher({ currentPortal }: PortalSwitcherProps) {
  const otherPortals = portals.filter((p) => p.id !== currentPortal);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Or try another portal
      </p>
      <div className="grid grid-cols-3 gap-2">
        {otherPortals.map((portal) => {
          const Icon = portal.icon;
          return (
            <Link
              key={portal.id}
              href={portal.url}
              className="
group relative p-4 rounded-xl 
bg-white
border border-slate-300
shadow-sm
hover:shadow-md
hover:-translate-y-1
transition-all duration-200
flex flex-col items-center gap-2
cursor-pointer
"       >
              <Icon className={`w-5 h-5 ${portal.color} transition-transform group-hover:scale-110`} />
              <span className="text-xs font-medium text-slate-700 text-center">
                {portal.name}
              </span>
              <ChevronRight className="absolute top-2 right-2 w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
