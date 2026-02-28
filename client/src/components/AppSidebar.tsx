import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BookOpen,
  FileQuestion,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  LogOut,
  GraduationCap,
  Brain,
  FolderOpen,
  Shield,
  BookMarked,
  UserCircle,
} from "lucide-react";

const instructorMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Courses", url: "/courses", icon: BookOpen },
  { title: "Quizzes", url: "/quizzes", icon: FileQuestion },
  { title: "Assignments", url: "/assignments", icon: ClipboardList },
  { title: "Question Bank", url: "/questions", icon: Brain },
  { title: "Lectures", url: "/lectures", icon: FolderOpen },
  { title: "Gradebook", url: "/gradebook", icon: BookMarked },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Students", url: "/users", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

const studentMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Courses", url: "/courses", icon: BookOpen },
  { title: "Quizzes", url: "/quizzes", icon: FileQuestion },
  { title: "Assignments", url: "/assignments", icon: ClipboardList },
  { title: "My Profile", url: "/my-profile", icon: UserCircle },
];

const adminMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Users", url: "/users", icon: Users },
  { title: "Courses", url: "/courses", icon: BookOpen },
  { title: "Gradebook", url: "/gradebook", icon: BookMarked },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Proctoring Logs", url: "/proctoring", icon: Shield },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const menuItems = 
    user?.role === "admin" ? adminMenuItems :
    user?.role === "instructor" ? instructorMenuItems :
    studentMenuItems;

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">EduAssess AI</h1>
            <p className="text-xs text-muted-foreground">Powered by Gemini</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <a href={item.url} onClick={(e) => { e.preventDefault(); setLocation(item.url); }}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-9 h-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {user?.name?.slice(0, 2).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user?.name || "User"}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role || "Guest"}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
