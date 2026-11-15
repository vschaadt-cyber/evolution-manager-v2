// Roda todos os testes unitários (src/**/*.test.ts): empacota cada um com o esbuild e executa com o node --test.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const saida = "node_modules/.cache/testes";
mkdirSync(saida, { recursive: true });

function achar(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return achar(caminho);
    return nome.endsWith(".test.ts") ? [caminho] : [];
  });
}

const arquivos = achar("src");
const gerados = [];
for (const arquivo of arquivos) {
  const destino = join(saida, `${basename(arquivo, ".ts").replace(/\./g, "-")}-${gerados.length}.mjs`);
  await build({ entryPoints: [arquivo], bundle: true, platform: "node", format: "esm", outfile: destino, logLevel: "warning", alias: { "@": "./src" } });
  gerados.push(destino);
}

let falhou = false;
for (const arquivo of gerados) {
  const resultado = spawnSync(process.execPath, [arquivo], { stdio: "inherit" });
  if (resultado.status !== 0) falhou = true;
}
process.exit(falhou ? 1 : 0);
