import {
  ArrowLeft,
  Bot,
  Cable,
  Cog,
  Globe,
  LayoutDashboard,
  MessageSquareText,
  Network,
  Rabbit,
  Radio,
  Share2,
  Sparkles,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import type { NavSection } from "@/components/app-sidebar";
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
        items: [item("webhook", t("sidebar.webhook"), Webhook), item("websocket", t("sidebar.websocket"), Cable), item("rabbitmq", t("sidebar.rabbitmq"), Rabbit), item("sqs", t("sidebar.sqs"), Network)],
      },
      {
        id: "integrations",
        label: t("sidebar.integrations"),
        items: [
          item("chatwoot", t("sidebar.chatwoot"), MessageSquareText),
          item("n8n", t("sidebar.n8n"), Workflow),
          item("typebot", t("sidebar.typebot"), Bot),
          item("openai", t("sidebar.openai"), Sparkles),
          item("dify", t("sidebar.dify"), Share2),
          item("flowise", t("sidebar.flowise"), Radio),
          item("evoai", t("sidebar.evoai"), Zap),
          item("evolutionBot", t("sidebar.evolutionBot"), Bot),
        ],
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
      subtitle={instance?.profileName ? `${instance.profileName}${instance.ownerJid ? ` · ${instance.ownerJid.split("@")[0]}` : ""}` : t("instance.nav.subtitle")}>
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
