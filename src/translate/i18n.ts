import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ptBR from "./languages/pt-BR.json";

// O painel é só em português do Brasil: sem seletor de idioma e sem outras traduções.
i18n.use(initReactI18next).init({
  resources: {
    "pt-BR": {
      translation: ptBR,
    },
  },
  lng: "pt-BR",
  fallbackLng: "pt-BR",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
