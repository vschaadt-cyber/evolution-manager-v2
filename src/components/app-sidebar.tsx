import { PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useVerifyServer } from "@/lib/queries/auth/verifyServer";
import { getToken, TOKEN_ID } from "@/lib/queries/token";

import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  to?: string;
  href?: string;
  end?: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

type Props = {
  sections: NavSection[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

function SidebarLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  const base = "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

  const content = (
    <>
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </>
  );

  if (item.href) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" title={item.label} className={cn(base, "text-muted-foreground hover:bg-muted hover:text-foreground", collapsed && "justify-center px-2")}>
        {content}
      </a>
    );
  }

  return (
    <NavLink
      to={item.to!}
      end={item.end}
      title={item.label}
      onClick={onNavigate}
      className={({ isActive }) => cn(base, isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground", collapsed && "justify-center px-2")}>
      {content}
    </NavLink>
  );
}

export function AppSidebar({ sections, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const url = getToken(TOKEN_ID.API_URL);
  const { data: serverInfo } = useVerifyServer({ url });
  const version = useMemo(() => serverInfo?.version as string | undefined, [serverInfo]);

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const logo = isDark ? "/assets/images/gestao-logo-dark.png" : "/assets/images/gestao-logo.png";

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onCloseMobile} aria-hidden />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card transition-all md:static md:z-auto",
          collapsed ? "md:w-[68px]" : "md:w-60",
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}>
        <div className={cn("flex h-16 items-center border-b px-4", collapsed ? "justify-center px-2" : "justify-between")}>
          {collapsed ? (
            <img src="/assets/images/gestao-favicon.png" alt="Gestão" className="h-8 w-8 object-contain" />
          ) : (
            <img src={logo} alt="Gestão" className="h-9 w-auto object-contain" />
          )}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onCloseMobile} aria-label="Fechar menu">
            <X size={18} />
          </Button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.id} className="space-y-1">
              {!collapsed && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</p>}
              {section.items.map((item) => (
                <SidebarLink key={item.id} item={item} collapsed={collapsed} onNavigate={onCloseMobile} />
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t p-3">
          {!collapsed && version && <p className="mb-2 px-3 text-xs text-muted-foreground">Evolution API v{version}</p>}
          <Button variant="ghost" size="sm" className={cn("hidden w-full md:inline-flex", collapsed ? "justify-center px-2" : "justify-start gap-3 px-3")} onClick={onToggleCollapsed} title={collapsed ? t("nav.expand") : t("nav.collapse")}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>{t("nav.collapse")}</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
