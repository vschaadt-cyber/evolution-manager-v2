import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Footer } from "@/components/footer";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormInput } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { useAuth } from "@/contexts/AuthContext";

const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});
type LoginSchema = z.infer<typeof loginSchema>;

/** Login do painel: e-mail e senha do Gestão (Supabase Auth). Só master_admin entra. */
function Login() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { entrar } = useAuth();
  const [erro, setErro] = useState<string | null>(null);

  const loginForm = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", senha: "" },
  });
  const enviando = loginForm.formState.isSubmitting;

  const handleLogin: SubmitHandler<LoginSchema> = async (data) => {
    setErro(null);
    const mensagem = await entrar(data.email, data.senha);
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    navigate("/manager/", { replace: true });
  };

  const escuro = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="w-[380px] max-w-full">
          <CardHeader className="items-center gap-3">
            <img className="h-10" src={escuro ? "/assets/images/gestao-logo-dark.png" : "/assets/images/gestao-logo.png"} alt="Gestão" />
            <CardTitle className="text-center text-lg">Painel do WhatsApp</CardTitle>
            <CardDescription className="text-center">Entre com o e-mail e a senha do Gestão</CardDescription>
          </CardHeader>
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(handleLogin)} noValidate>
              <CardContent>
                {erro && (
                  <p role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {erro}
                  </p>
                )}
                <div className="grid w-full items-center gap-4">
                  <FormInput required name="email" label="E-mail">
                    <Input type="email" autoComplete="username" autoFocus />
                  </FormInput>
                  <FormInput required name="senha" label="Senha">
                    <Input type="password" autoComplete="current-password" />
                  </FormInput>
                </div>
              </CardContent>
              <CardFooter className="flex justify-center">
                <Button className="w-full" type="submit" disabled={enviando}>
                  {enviando ? "Entrando…" : "Entrar"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

export default Login;
