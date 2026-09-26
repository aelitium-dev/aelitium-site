# AELITIUM v0.4.0 — Feedback/Contact por e-mail direto

Implementado em EN/FR na branch `site/v0.4.0-homepage-prototype`.
Design, ordem 01–09 e Ubuntu Sans aprovados mantidos.

## Comportamento atual

| Ação | Destino | Assunto preparado |
|---|---|---|
| Share your use case / Présenter votre cas d’usage | `hello@aelitium.com` | `[AELITIUM Feedback]` |
| Contact, incluindo o rodapé | `hello@aelitium.com` | `[AELITIUM Contact]` |
| Report an issue / Signaler un problème | GitHub Issues existente | Sem alteração |

As ligações nativas `mailto:` abrem o cliente de correio configurado pelo visitante,
com os assuntos codificados no URL. A página explica isso em EN/FR. O visitante
revê e envia a mensagem no seu cliente; o site não envia nem confirma entrega.
A existência/configuração desse cliente pertence ao ambiente do visitante.

`hello@aelitium.com` está visível, selecionável e tem botão de cópia. O botão usa
os mesmos estilos e o mesmo mecanismo de cópia já existentes. O endereço tem 16 px
no tamanho de texto normal. A mensagem «Copied / Copié» refere-se exclusivamente
à cópia. Se a API de clipboard for recusada, o valor é selecionado e surge a
alternativa manual. As ligações e o endereço continuam disponíveis sem JavaScript.

Retirados os campos, as etapas, o opt-in, a limpeza/reload do percurso local, o
JavaScript que o controlava e os avisos de envio desligado. Não foi integrado
qualquer serviço de formulários, SMTP, Proton Bridge ou backend.

## Testes desta tarefa

- **Guardrail PowerShell PASS**, execução real do script existente, sem alterações.
- **8/8 Python PASS**: rotas/estrutura, `mailto:` restrito ao destinatário e aos dois
  assuntos autorizados, ausência de formulário, fixtures, outputs e ficheiros protegidos.
- **29 grupos Chromium PASS**, versão 151.0.7922.34. Regressão das demos existentes,
  EN/FR e cinco larguras: 320, 390, 768, 1024 e 1440 px.
- Novo teste de e-mail em EN/FR a **320, 390 e 1440 px**: os três links por página
  (Feedback, Contact e Contact no rodapé), assuntos/destino exatos, foco/Enter,
  alvos de toque ≥44 px, endereço selecionável, cópia real com leitura de retorno,
  rejeição da cópia e seleção alternativa. Nenhum pedido de aplicação causado
  pelos controlos, armazenamento ou confirmação de envio.
- **12 grupos Firefox Windows PASS**, versão 140.16.0, suite específica BiDi.
  Inclui os links de e-mail por teclado, sucesso da escrita do endereço no clipboard,
  ausência dos campos, navegação EN/FR e regressões das demos/layout/texto ampliado.
  A leitura de retorno do clipboard e a recusa forçada foram verificadas em Chromium.
- **Contraste/foco/ampliação PASS**, suite complementar Chromium: EN/FR com
  texto-base a 200% a 320/390/1440 px, incluindo o bloco de e-mail e detalhes abertos,
  sem overflow ou corte nos blocos medidos. Cópia do endereço por teclado exercitada
  juntamente com os três comandos existentes. Não equivale a zoom nativo.
- Os cliques `mailto:` foram intercetados **apenas nos testes**, depois de verificar
  a ativação por teclado. Não foi aberto um cliente externo nem preparada/enviada
  uma mensagem real. A implementação publicada no checkout tem links nativos,
  sem essa interceção.
- Capturas reais do bloco Feedback/Contact em EN/FR, 390/1440 px, inspecionadas.
  Sem novas imagens conceptuais ou alterações à identidade.
- Chrome/Edge não foram repetidos nesta tarefa; a validação anterior mantém-se
  registada em `artifacts/final/`. Safari, dispositivos móveis reais e leitores
  de ecrã continuam fora da cobertura executada.

Registos: [resumo](artifacts/email-contact/VALIDATION_RESULTS.json),
[Python](artifacts/email-contact/portable-tests.txt),
[Chromium](artifacts/email-contact/chromium/browser-results.json),
[Firefox](artifacts/email-contact/firefox-windows/firefox-results.json),
[acessibilidade complementar](artifacts/email-contact/accessibility/accessibility-results.json).

Capturas do bloco, após cópia e com o foco de teclado visível:

| Viewport | EN | FR |
|---|---|---|
| 390 px | [PNG](artifacts/email-contact/chromium/screenshots/en-390-email-contact.png) | [PNG](artifacts/email-contact/chromium/screenshots/fr-390-email-contact.png) |
| 1440 px | [PNG](artifacts/email-contact/chromium/screenshots/en-1440-email-contact.png) | [PNG](artifacts/email-contact/chromium/screenshots/fr-1440-email-contact.png) |

## Preservação e acesso local

As secções 01–08 de ambas as páginas e o código JavaScript das demos foram
comparados com o início desta tarefa e são idênticos. Fixtures e ficheiros de
fontes também estão idênticos byte a byte. O CSS existente não mudou; foi
acrescentada apenas uma regra para o tamanho legível do endereço de contacto.

Atualizados os testes afetados e `MESSAGING_SPEC.md`. O [relatório anterior](artifacts/final/PREVIOUS_REPORT.md)
é histórico; o comportamento atual de Feedback/Contact é o descrito acima.

- EN: <http://127.0.0.1:8000/>
- FR: <http://127.0.0.1:8000/fr/>

Se for necessário reiniciar o servidor local, no terminal WSL:

```sh
cd /home/catarina-aelitium/aelitium-site
python3 -m http.server 8000 --bind 127.0.0.1
```

Sem acesso ao projeto `aelitium-mail-ops` nesta tarefa. Phase 2 e configuração de
publicação intactas. HEAD preservado; sem stage, commit, push, PR, merge ou deploy.
