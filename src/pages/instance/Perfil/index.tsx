import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Textarea } from "@/components/ui/textarea";

import { useInstance } from "@/contexts/InstanceContext";

import { arquivoParaBase64, atualizarFotoPerfil, atualizarNomePerfil, atualizarRecadoPerfil, buscarPerfil } from "@/lib/queries/chat/perfil";

const LIMITE_FOTO_BYTES = 5 * 1024 * 1024;

function mensagemDeErro(erro: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resposta = (erro as any)?.response?.data?.response?.message;
  const texto = Array.isArray(resposta) ? resposta.join(", ") : resposta;
  return typeof texto === "string" && texto ? texto : "Não foi possível salvar. O número precisa estar conectado.";
}

function Perfil() {
  const { instance, reloadInstance } = useInstance();
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [recado, setRecado] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState<"nome" | "recado" | "foto" | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const conectado = instance?.connectionStatus === "open";

  useEffect(() => {
    if (!instance || !conectado) {
      setCarregando(false);
      return;
    }
    let ativo = true;
    buscarPerfil(instance.name, instance.token, instance.ownerJid)
      .then((perfil) => {
        if (!ativo) return;
        setNome(perfil.name ?? instance.profileName ?? "");
        setRecado(perfil.status ?? "");
        setFoto(perfil.picture ?? instance.profilePicUrl ?? null);
      })
      .catch(() => {
        if (!ativo) return;
        setNome(instance.profileName ?? "");
        setFoto(instance.profilePicUrl ?? null);
        toast.error("Não foi possível ler o perfil agora. Os campos mostram o que o painel já tinha.");
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [instance?.name, conectado]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!instance) return <LoadingSpinner />;

  const salvar = async (campo: "nome" | "recado" | "foto") => {
    setSalvando(campo);
    try {
      if (campo === "nome") await atualizarNomePerfil(instance.name, instance.token, nome.trim());
      if (campo === "recado") await atualizarRecadoPerfil(instance.name, instance.token, recado.trim());
      if (campo === "foto" && arquivo) {
        await atualizarFotoPerfil(instance.name, instance.token, await arquivoParaBase64(arquivo));
        setFoto(URL.createObjectURL(arquivo));
        setArquivo(null);
        if (inputFoto.current) inputFoto.current.value = "";
      }
      toast.success("Perfil atualizado no WhatsApp.");
      reloadInstance();
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(null);
    }
  };

  const escolherFoto = (lista: FileList | null) => {
    const escolhida = lista?.[0] ?? null;
    if (escolhida && escolhida.size > LIMITE_FOTO_BYTES) {
      toast.error("A imagem passa de 5 MB. Escolha uma menor.");
      if (inputFoto.current) inputFoto.current.value = "";
      return;
    }
    setArquivo(escolhida);
    if (escolhida) setFoto(URL.createObjectURL(escolhida));
  };

  if (!conectado) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil do número</CardTitle>
          <CardDescription>O número precisa estar conectado para ler e mudar o perfil. Conecte pela aba Visão Geral.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Foto</CardTitle>
          <CardDescription>Aparece para os clientes na conversa. Use JPG ou PNG quadrado, até 5 MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={foto ?? undefined} alt="" />
            <AvatarFallback className="bg-accent text-lg font-semibold text-accent-foreground">{instance.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <input ref={inputFoto} type="file" accept="image/jpeg,image/png" className="text-sm" onChange={(e) => escolherFoto(e.target.files)} />
          <Button disabled={!arquivo || salvando !== null} onClick={() => salvar("foto")}>
            {salvando === "foto" ? "Enviando..." : "Trocar foto"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nome</CardTitle>
          <CardDescription>O nome que o WhatsApp mostra para quem recebe as mensagens.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input value={nome} maxLength={25} onChange={(e) => setNome(e.target.value)} />
          <Button disabled={!nome.trim() || salvando !== null} onClick={() => salvar("nome")}>
            {salvando === "nome" ? "Salvando..." : "Salvar nome"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recado</CardTitle>
          <CardDescription>O texto “Info” do perfil (ex.: horário de atendimento).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={recado} maxLength={139} onChange={(e) => setRecado(e.target.value)} />
          <Button disabled={!recado.trim() || salvando !== null} onClick={() => salvar("recado")}>
            {salvando === "recado" ? "Salvando..." : "Salvar recado"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export { Perfil };
