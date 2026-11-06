import { ArrowLeft, Cog, Globe, LayoutDashboard, Webhook, Workflow, type LucideIcon } from "lucide-react";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import type { NavSection } from "@/components/app-sidebar";
import { InstancePhone } from "@/components/instance-phone";
import { InstanceStatus } from "@/components/instance-status";

import { InstanceProvider, useInstance } from "@/contexts/InstanceContext";

import { MainLayout } from "./MainLayout";

interface LayoutProps {
  children: React.ReactNode;
}

function InstanceShell({ children }: LayoutProps) {
  const { t } = useTranslation();
  const { instanceId } = useParams<{ instanceId: string }>();
  const { instance } = useInstance();

  const sections = useMemo<NavSection[]>(() => {
    const base = `/manager/instance/${instanceId}`;
    const item = (id: string, label: string, icon: LucideIcon) => ({ id, label, icon, to: `${base}/${id}` });

    return [
      {
        id: "back",
        label: t("instance.nav.back"),
        items: [{ id: "back", label: t("instance.nav.allInstances"), icon: ArrowLeft, to: "/manager", end: true }],
      },
      {
        id: "connection",
        label: t("instance.nav.connection"),
        items: [item("dashboard", t("sidebar.dashboard"), LayoutDashboard), item("settings", t("sidebar.settings"), Cog), item("proxy", t("sidebar.proxy"), Globe)],
      },
      {
        id: "events",
        label: t("sidebar.events"),
        items: [item("webhook", t("sidebar.webhook"), Webhook)],
      },
      {
        id: "integrations",
        label: t("sidebar.integrations"),
        items: [item("n8n", t("sidebar.n8n"), Workflow)],
      },
    ];
  }, [instanceId, t]);

  return (
    <MainLayout
      sections={sections}
      title={
        <>
          <span className="truncate">{instance?.name ?? "…"}</span>
          {instance && <InstanceStatus status={instance.connectionStatus} />}
        </>
      }
      subtitle={
        instance ? (
          <span className="inline-flex min-w-0 items-center gap-2">
            {instance.profileName && <span className="truncate">{instance.profileName} ·</span>}
            <InstancePhone instance={instance} compact />
          </span>
        ) : (
          t("instance.nav.subtitle")
        )
      }>
      {children}
    </MainLayout>
  );
}

function InstanceLayout({ children }: LayoutProps) {
  return (
    <InstanceProvider>
      <InstanceShell>{children}</InstanceShell>
    </InstanceProvider>
  );
}

export { InstanceLayout };
