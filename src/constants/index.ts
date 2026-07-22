export const LOCAL_STORAGE_KEYS = {
  MARKETING_SETTINGS: 'masmorra_marketing_settings',
} as const;

export const INACTIVITY_DAYS_OPTIONS = [
  { value: 30, label: '30 dias sem jogar' },
  { value: 45, label: '45 dias sem jogar' },
  { value: 60, label: '60 dias sem jogar' },
  { value: 90, label: '90 dias sem jogar' },
] as const;

export const DEFAULT_CRM_TEMPLATES: Record<string, string> = {
  template1: "Olá, {{nome}}!\n\nSentimos sua falta. Percebemos que faz um tempinho que você não aparece por aqui.\n\nPara te ver novamente nas mesas, preparamos um bônus especial de 10% no seu próximo buy-in.\n\nEsperamos você!\n\n♠ {{nome_do_clube}}",
  template2: "Olá, {{nome}}!\n\nNa sua próxima visita você ganha uma bebida por nossa conta.\n\nEsperamos você!\n\n♠ {{nome_do_clube}}",
  template3: "Olá, {{nome}}!\n\nHoje teremos Cash Game a partir das 20h. Sua cadeira está te esperando!\n\nEsperamos você!\n\n♠ {{nome_do_clube}}",
  template4: "Feliz aniversário, {{nome}}!\n\nComo presente do {{nome_do_clube}}, você ganhou um bônus especial para utilizar na sua próxima visita. Parabéns!\n\nEsperamos você!"
};

export const MARKETING_TEMPLATE_LABELS = [
  { key: 'template1', label: 'Falta' },
  { key: 'template2', label: 'Copa' },
  { key: 'template3', label: 'Aviso Cash' },
  { key: 'template4', label: 'Parabéns' }
] as const;
