import { execSync } from "child_process"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
 
// Hash curto do commit do painel, mostrado no rodapé do menu. No Docker não há .git: o hash vem do build-arg PAINEL_COMMIT.
function commitDoPainel(): string {
  const doAmbiente = process.env.PAINEL_COMMIT?.trim()
  if (doAmbiente) return doAmbiente.slice(0, 7)
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "dev"
  } catch {
    return "dev"
  }
}

export default defineConfig({
  define: {
    __PAINEL_COMMIT__: JSON.stringify(commitDoPainel()),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})