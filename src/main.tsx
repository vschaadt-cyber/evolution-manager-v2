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
import { tratarAcessoDaUrl } from "./lib/acessoGestao.ts";
import { queryClient } from "./lib/queries/react-query.ts";
import i18n from "./translate/i18n";

async function iniciar() {
  // Antes do roteador: o ?acesso=<token> do Gestão precisa virar sessão antes de qualquer rota ser verificada.
  await tratarAcessoDaUrl();
  const { default: router } = await import("./routes/index.tsx");

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
          <TemaDoGestao />
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ThemeProvider>
      </I18nextProvider>
      <ToastContainer theme="colored" />
    </React.StrictMode>,
  );
}

iniciar();
