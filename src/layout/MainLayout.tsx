import { BookOpen, LayoutDashboard, LogOut, Menu, Webhook } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { AppSidebar, NavSection } from "@/components/app-sidebar";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

import { logout } from "@/lib/queries/token";

interface LayoutProps {
  children: React.ReactNode;
  sections?: NavSection[];
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerExtra?: React.ReactNode;
}

const COLLAPSED_KEY = "gestao-sidebar-collapsed";

function MainLayout({ children, sections, title, subtitle, headerExtra }: LayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutConfirmation, setLogoutConfirmation] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((old) => {
      localStorage.setItem(COLLAPSED_KEY, old ? "0" : "1");
      return !old;
    });
  };

  const defaultSections = useMemo<NavSection[]>(
    () => [
      {
        id: "main",
        label: t("nav.main"),
        items: [{ id: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard, to: "/manager", end: true }],
      },
      {
        id: "help",
        label: t("nav.help"),
        items: [
          { id: "docs", label: t("nav.docs"), icon: BookOpen, href: "https://doc.evolution-api.com" },
          { id: "postman", label: t("nav.postman"), icon: Webhook, href: "https://evolution-api.com/postman" },
        ],
      },
    ],
    [t],
  );

  const handleLogout = () => {
    logout();
    navigate("/manager/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar sections={sections ?? defaultSections} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-card px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu size={20} />
            </Button>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 truncate text-base font-semibold leading-tight">{title ?? t("dashboard.title")}</h1>
              <p className="truncate text-xs text-muted-foreground">{subtitle ?? t("dashboard.subtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {headerExtra}
            <LanguageToggle />
            <ModeToggle />
            <Button variant="outline" size="icon" onClick={() => setLogoutConfirmation(true)} aria-label={t("header.logout.title")}>
              <LogOut size={18} />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">{children}</div>
        </main>
      </div>

      {logoutConfirmation && (
        <Dialog onOpenChange={setLogoutConfirmation} open>
          <DialogContent>
            <DialogClose />
            <DialogHeader>{t("header.logout.title")}</DialogHeader>
            <p>{t("header.logout.message")}</p>
            <DialogFooter>
              <div className="flex items-center gap-4">
                <Button onClick={() => setLogoutConfirmation(false)} size="sm" variant="outline">
                  {t("button.cancel")}
                </Button>
                <Button onClick={handleLogout} variant="destructive">
                  {t("header.logout.title")}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export { MainLayout };
