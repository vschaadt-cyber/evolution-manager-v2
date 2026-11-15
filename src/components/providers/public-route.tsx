import React from "react";
import { Navigate } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useAuth } from "@/contexts/AuthContext";

type PublicRouteProps = {
  children: React.ReactNode;
};

/** Tela de login: quem já está logado (sessão salva) entra direto no painel. */
const PublicRoute = ({ children }: PublicRouteProps) => {
  const { estado } = useAuth();

  if (estado === "carregando") {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Carregando">
        <LoadingSpinner />
      </div>
    );
  }

  if (estado === "pronto" || estado === "erro") return <Navigate to="/manager/" replace />;

  return children;
};

export default PublicRoute;
