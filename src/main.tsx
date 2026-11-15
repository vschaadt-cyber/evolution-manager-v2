import "./index.css";
import "react-toastify/dist/ReactToastify.css";

import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import { TemaDoGestao } from "./components/tema-gestao.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { queryClient } from "./lib/queries/react-query.ts";
import i18n from "./translate/i18n";

import router from "./routes/index.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <TemaDoGestao />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </I18nextProvider>
    <ToastContainer theme="colored" />
  </React.StrictMode>,
);
