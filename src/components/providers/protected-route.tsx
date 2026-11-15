import React from "react";
import { Navigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useAuth } from "@/contexts/AuthContext";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

/** Todas as rotas do painel passam por aqui: sem sessão do Supabase (ou sem a chave em memória), vai para o login. */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { estado, sair, tentarDeNovo } = useAuth();

  if (estado === "carregando") {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Carregando">
        <LoadingSpinner />
      </div>
    );
  }

  if (estado === "sem-sessao") return <Navigate to="/manager/login" replace />;

  if (estado === "erro") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-base font-semibold">Não foi possível carregar o painel</p>
        <p className="max-w-sm text-sm text-muted-foreground">O login está válido, mas o acesso à Evolution não respondeu. Confira a internet e tente de novo.</p>
        <div className="flex gap-2">
          <Button onClick={tentarDeNovo}>Tentar de novo</Button>
          <Button variant="outline" onClick={sair}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
