import { Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useFetchInstances } from "@/lib/queries/instance/fetchInstances";
import { soDigitosDoNumero } from "@/lib/numero";
import { enviarTexto, mensagensRecentes } from "@/lib/queries/chat/mensagens";
import { acharInstanciaPorNumero, aguardar, CHAVE_NUMERO_TESTE, novoIdTeste, recebeuTeste, textoResposta, textoTeste } from "@/lib/testeEnvio";

import { Instance } from "@/types/evolution.types";

type Passo = { texto: string; resultado: "ok" | "erro" | "info" };

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const ESPERA = { tentativas: 10, intervaloMs: 3000, esperar };

function lerNumeroSalvo(): string {
  try {
    return localStorage.getItem(CHAVE_NUMERO_TESTE) ?? "";
  } catch {
    return "";
  }
}

/** Botão "Testar": envia um texto para o número de teste e, se ele for de outra instância, confere o recebimento nos dois lados. */
export function TesteEnvio({ instance }: { instance: Instance }) {
  const [numero, setNumero] = useState(lerNumeroSalvo);
  const [rodando, setRodando] = useState(false);
  const [passos, setPassos] = useState<Passo[]>([]);
  const { data: instancias } = useFetchInstances();

  const conectado = instance.connectionStatus === "open";
  const digitos = soDigitosDoNumero(numero);

  const mudarNumero = (valor: string) => {
    setNumero(valor);
    try {
      localStorage.setItem(CHAVE_NUMERO_TESTE, valor);
    } catch {
      // sem localStorage: o número vale só nesta tela.
    }
  };

  const testar = async () => {
    const lista: Passo[] = [];
    const registrar = (passo: Passo) => {
      lista.push(passo);
      setPassos([...lista]);
    };
    setPassos([]);
    setRodando(true);
    const id = novoIdTeste();
    try {
      try {
        await enviarTexto(instance.name, instance.token, digitos, textoTeste(id));
        registrar({ texto: `Enviou: ${instance.name} mandou o texto para ${digitos}.`, resultado: "ok" });
      } catch (erro) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const motivo = (erro as any)?.response?.data?.response?.message;
        registrar({ texto: `Não enviou${motivo ? `: ${Array.isArray(motivo) ? motivo.join(", ") : motivo}` : ". Confira se o número está conectado e o número de teste existe no WhatsApp."}`, resultado: "erro" });
        return;
      }

      const outra = acharInstanciaPorNumero(Array.isArray(instancias) ? instancias : [], digitos, instance.name);
      if (!outra) {
        registrar({ texto: "O número de teste não é de outra instância deste painel, então o recebimento não foi conferido. Olhe o celular de teste.", resultado: "info" });
        return;
      }

      registrar({ texto: `Esperando a mensagem chegar em ${outra.name} (até 30 s)…`, resultado: "info" });
      const chegou = await aguardar(async () => recebeuTeste(await mensagensRecentes(outra.name, outra.token), id), ESPERA);
      if (!chegou) {
        registrar({ texto: `${outra.name} NÃO recebeu a mensagem em 30 s. Ela pode ter parado de escutar.`, resultado: "erro" });
        return;
      }
      registrar({ texto: `${outra.name} recebeu a mensagem.`, resultado: "ok" });

      const dePara = soDigitosDoNumero(instance.ownerJid || instance.number);
      if (!dePara) {
        registrar({ texto: "Sem o número desta instância para a resposta voltar. Teste de resposta pulado.", resultado: "info" });
        return;
      }
      await enviarTexto(outra.name, outra.token, dePara, textoResposta(id));
      registrar({ texto: `${outra.name} respondeu. Esperando a resposta chegar em ${instance.name} (até 30 s)…`, resultado: "info" });
      const voltou = await aguardar(async () => recebeuTeste(await mensagensRecentes(instance.name, instance.token), id), ESPERA);
      registrar(
        voltou
          ? { texto: `${instance.name} recebeu a resposta. Envio e recebimento funcionando.`, resultado: "ok" }
          : { texto: `${instance.name} envia, mas NÃO recebeu a resposta em 30 s. Reinicie a instância e teste de novo.`, resultado: "erro" },
      );
    } catch {
      registrar({ texto: "O teste parou por um erro de comunicação com a Evolution.", resultado: "erro" });
    } finally {
      setRodando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Testar envio e recebimento</CardTitle>
        <CardDescription>Manda uma mensagem de teste para o número abaixo. Se ele for de outra instância deste painel, ela responde e o teste confirma que o recebimento chegou.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Número de teste com DDI (ex.: 5547999999999)" value={numero} onChange={(e) => mudarNumero(e.target.value)} />
          <Button className="gap-2" onClick={testar} disabled={rodando || !conectado || digitos.length < 10}>
            <Send size={16} /> {rodando ? "Testando…" : "Testar"}
          </Button>
        </div>
        {!conectado && <p className="text-sm text-muted-foreground">O número precisa estar conectado para testar.</p>}
        {passos.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {passos.map((passo, indice) => (
              <li key={indice} className={passo.resultado === "ok" ? "text-emerald-600 dark:text-emerald-400" : passo.resultado === "erro" ? "text-destructive" : "text-muted-foreground"}>
                {passo.resultado === "ok" ? "✔ " : passo.resultado === "erro" ? "✘ " : "• "}
                {passo.texto}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
