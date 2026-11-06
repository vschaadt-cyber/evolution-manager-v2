import { createBrowserRouter } from "react-router-dom";

import ProtectedRoute from "@/components/providers/protected-route";
import PublicRoute from "@/components/providers/public-route";

import { InstanceLayout } from "@/layout/InstanceLayout";
import { MainLayout } from "@/layout/MainLayout";

import Dashboard from "@/pages/Dashboard";
import { DashboardInstance } from "@/pages/instance/DashboardInstance";
import { N8n } from "@/pages/instance/N8n";
import { Proxy } from "@/pages/instance/Proxy";
import { Settings } from "@/pages/instance/Settings";
import { Webhook } from "@/pages/instance/Webhook";
import Login from "@/pages/Login";

const router = createBrowserRouter([
  {
    path: "/manager/login",
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: "/manager/",
    element: (
      <ProtectedRoute>
        <MainLayout>
          <Dashboard />
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/manager/instance/:instanceId/dashboard",
    element: (
      <ProtectedRoute>
        <InstanceLayout>
          <DashboardInstance />
        </InstanceLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/manager/instance/:instanceId/settings",
    element: (
      <ProtectedRoute>
        <InstanceLayout>
          <Settings />
        </InstanceLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/manager/instance/:instanceId/proxy",
    element: (
      <ProtectedRoute>
        <InstanceLayout>
          <Proxy />
        </InstanceLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/manager/instance/:instanceId/webhook",
    element: (
      <ProtectedRoute>
        <InstanceLayout>
          <Webhook />
        </InstanceLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/manager/instance/:instanceId/n8n",
    element: (
      <ProtectedRoute>
        <InstanceLayout>
          <N8n />
        </InstanceLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/manager/instance/:instanceId/n8n/:n8nId",
    element: (
      <ProtectedRoute>
        <InstanceLayout>
          <N8n />
        </InstanceLayout>
      </ProtectedRoute>
    ),
  },
]);

export default router;
