# Enap e-Vida — piloto com dados fictícios

O aplicativo completo utiliza React, Express e PostgreSQL. A apresentação no
GitHub Pages é estática. O ambiente de teste compartilhado usa o serviço
Docker do Render e um banco exclusivo no Neon.

## Percursos de aceitação

| Percurso | Como demonstrar |
|---|---|
| Entrar e acompanhar a jornada | Acesse com o perfil de acompanhamento de 30 dias. Consulte as tarefas, avaliações e pedidos de apoio. |
| Criar conta | Em **Novo por aqui?**, preencha os campos com dados fictícios. A conta recebe uma jornada e as avaliações de 30, 60 e 90 dias. |
| Pré-Embarque | Use os convites fictícios GAEG NS e NI listados no README. Valide campos obrigatórios, salve o rascunho, envie e consulte o protocolo. |
| Operação e governança | Compare os perfis de administração técnica, Pré-Embarque e indicadores. O cofre é acessível ao perfil autorizado de Pré-Embarque, com auditoria. |
| Agenda e PQVT | Inscreva dois perfis em uma atividade ou evento com uma vaga. Cancele a inscrição confirmada e confira a promoção da lista de espera. Durante o evento, a pessoa inscrita pode registrar presença. O arquivo ICS inclui um lembrete de 30 minutos. |
| Participação e conteúdo | Registre uma contribuição no Fala, Enap!, responda uma enquete, use a busca do repositório, explore o Comitê DEI e confira notificações e perfil. |
| Gestão e melhoria | Consulte os indicadores, exporte o CSV e teste o registro de um plano de melhoria. |

O teste `npm run test:mvp` cobre o build servido por Express, acesso restrito,
cadastro e jornada, MFA demonstrativo, permissões, ambos os convites, rascunho
cifrado, persistência após reinício, protocolo único em envio concorrente,
segregação do cofre, fila de eventos, presença e exportação ICS. Os testes de
domínio são executados por `npm test`.

Na verificação do MVP com PostgreSQL local, o teste HTTP passou. No Chromium,
foram verificados o logo e a fonte Georama, o atalho de teclado na entrada,
login e jornada em desktop, navegação de cadastro e envio GAEG NI em tela
móvel. Uma análise automatizada com axe-core na tela de entrada apontou zero
violações nas regras WCAG A e AA executadas.

## Limites e validações pendentes

- O piloto utiliza dados fictícios, MFA demonstrativo e recuperação de senha
  simulada. Integrações de identidade, e-mail, calendário institucional e
  sistemas de pessoal dependem da fase institucional.
- As visões mensais e semanais agrupam a programação por período. O lembrete é
  disponibilizado pelo calendário pessoal após a importação do ICS.
- A homologação institucional inclui conferência dos formulários de referência,
  validação dos parâmetros GAEG, testes com leitores de tela, restauração de
  backup e análise dos controles de segurança e proteção de dados.

Veja as instruções de publicação e os perfis fictícios no [README](../README.md)
e a matriz de acesso no [documento de arquitetura](ARQUITETURA_E_GOVERNANCA.md).
