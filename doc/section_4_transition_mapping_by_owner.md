# Mapeamento de requisitos da secao 4 por responsavel

Este arquivo usa como fonte os requisitos das Secoes 4 e 5 do documento de requisitos e os aloca por responsavel com base na divisao de tarefas declarada em `mode_logic_team.c`. Requisitos que nao pertencem a um responsavel individual sao tratados em secoes dedicadas ao final (responsabilidade coletiva, requisitos de sistema derivados e requisitos nao-funcionais).

Observacoes:
- Os requisitos `SwHLR08` e `SwHLR09` aparecem como compartilhados entre `Pessoa D` e `Pessoa E`, porque essas familias foram divididas entre o reset para `Start` e as trocas internas `ICE <-> HYBRID`.
- Os requisitos transversais `SwHLR01`, `SwHLR02` e `SwHLR10` sao de **responsabilidade coletiva** de todas as pessoas (A-E) - ver secao "Responsabilidade coletiva - requisitos transversais" ao final.
- Os requisitos de sistema `SysHLR01`, `SysHLR02` e `SysHLR03` sao cobertos por derivacao: a sua conformidade emerge do conjunto das familias `SwHLR03`-`SwHLR09`. Ver secao "Requisitos de sistema (derivados)" ao final.
- Os requisitos nao-funcionais `NfHLR01`-`NfHLR04` (secao 5 do PDF) estao listados na secao "Requisitos nao-funcionais (secao 5)" ao final, com a indicacao de quais sao testaveis unitariamente e quais pertencem a outro gate (integracao ou MISRA).

## Danilo - Person A

### Requisitos da secao 4.2

| ID | Vinculo | Requirement statement |
| --- | --- | --- |
| `SwHLR03` | principal | While the active software mode is the standstill mode, the software shall evaluate exits to EV mode and Start mode in the priority order defined by the model. |

### Requisitos da secao 4.3

| ID | Requirement statement |
| --- | --- |
| `SwLLR01` | When the active software mode is the standstill mode and speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode. |
| `SwLLR02` | When the active software mode is the standstill mode and speed > SPEED_STOP && (speed > SPEED_EV_MAX || SOC < SOC_EV_IN), the software shall transition to Start mode. |

## Marinel - Person B

### Requisitos da secao 4.2

| ID | Vinculo | Requirement statement |
| --- | --- | --- |
| `SwHLR04` | principal | While the active software mode is EV mode, the software shall evaluate exits to regenerative-braking mode, Start mode, and standstill mode in the priority order defined by the model. |

### Requisitos da secao 4.3

| ID | Requirement statement |
| --- | --- |
| `SwLLR03` | When the active software mode is EV mode and speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode. |
| `SwLLR04` | When the active software mode is EV mode and (speed > SPEED_EV_MAX || P_dem >= PDEM_HYB_IN || SOC < SOC_EV_OUT), the software shall transition to Start mode. |
| `SwLLR05` | When the active software mode is EV mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode. |

## Bruna - Person C

### Requisitos da secao 4.2

| ID | Vinculo | Requirement statement |
| --- | --- | --- |
| `SwHLR05` | principal | While the active software mode is the regenerative-braking mode, the software shall evaluate exits to Start mode, standstill mode, and EV mode in the priority order defined by the model. |

### Requisitos da secao 4.3

| ID | Requirement statement |
| --- | --- |
| `SwLLR06` | When the active software mode is the regenerative-braking mode and (((speed > SPEED_EV_MAX) && (P_dem >= PDEM_STOP_LOW)) || SOC < SOC_EV_OUT), the software shall transition to Start mode. |
| `SwLLR07` | When the active software mode is the regenerative-braking mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode. |
| `SwLLR08` | When the active software mode is the regenerative-braking mode and P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_OUT, the software shall transition to EV mode. |

## Hugo - Person D

### Requisitos da secao 4.2

| ID | Vinculo | Requirement statement |
| --- | --- | --- |
| `SwHLR07` | principal | While the active software mode is Start and no higher-priority engine-supported external exit is active, the software shall evaluate internal transitions to Hybrid mode and ICE mode in the priority order defined by the model. |
| `SwHLR08` | compartilhado | While the active software mode is ICE and no higher-priority engine-supported external exit is active, the software shall evaluate internal transitions to Start mode and Hybrid mode in the priority order defined by the model. |
| `SwHLR09` | compartilhado | While the active software mode is Hybrid and no higher-priority engine-supported external exit is active, the software shall evaluate internal transitions to Start mode and ICE mode in the priority order defined by the model. |

### Requisitos da secao 4.3

| ID | Requirement statement |
| --- | --- |
| `SwLLR18` | When the active software mode is Start mode and wEng > ENG_ON && SOC >= SOC_MID && (speed > SPEED_EV_MAX || P_dem >= PDEM_HYB_MID), the software shall transition to Hybrid mode. |
| `SwLLR19` | When the active software mode is Start mode and wEng > ENG_ON && (SOC < SOC_MID || (speed <= SPEED_EV_MAX && P_dem < PDEM_HYB_MID)), the software shall transition to ICE mode. |
| `SwLLR20` | When the active software mode is ICE mode and wEng <= ENG_OFF, the software shall transition to Start mode. |
| `SwLLR22` | When the active software mode is Hybrid mode and wEng <= ENG_OFF, the software shall transition to Start mode. |

## Gustavo - Person E

### Requisitos da secao 4.2

| ID | Vinculo | Requirement statement |
| --- | --- | --- |
| `SwHLR06` | principal | While the active software mode is Start, ICE, or Hybrid, the software shall evaluate exits to regenerative-braking mode, EV mode, and standstill mode before any internal transition within the engine-supported mode representation. |
| `SwHLR08` | compartilhado | While the active software mode is ICE and no higher-priority engine-supported external exit is active, the software shall evaluate internal transitions to Start mode and Hybrid mode in the priority order defined by the model. |
| `SwHLR09` | compartilhado | While the active software mode is Hybrid and no higher-priority engine-supported external exit is active, the software shall evaluate internal transitions to Start mode and ICE mode in the priority order defined by the model. |

### Requisitos da secao 4.3

| ID | Requirement statement |
| --- | --- |
| `SwLLR09` | When the active software mode is Start mode and wEng > ENG_ON && speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode. |
| `SwLLR10` | When the active software mode is ICE mode and wEng > ENG_ON && speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode. |
| `SwLLR11` | When the active software mode is Hybrid mode and wEng > ENG_ON && speed > SPEED_REGEN && P_dem <= PDEM_REGEN, the software shall transition to the regenerative-braking mode. |
| `SwLLR12` | When the active software mode is Start mode and wEng > ENG_ON && P_dem <= PDEM_HYB_OUT && P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode. |
| `SwLLR13` | When the active software mode is ICE mode and wEng > ENG_ON && P_dem <= PDEM_HYB_OUT && P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode. |
| `SwLLR14` | When the active software mode is Hybrid mode and wEng > ENG_ON && P_dem <= PDEM_HYB_OUT && P_dem >= PDEM_STOP_LOW && speed > SPEED_STOP && speed <= SPEED_EV_MAX && SOC >= SOC_EV_IN, the software shall transition to EV mode. |
| `SwLLR15` | When the active software mode is Start mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode. |
| `SwLLR16` | When the active software mode is ICE mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode. |
| `SwLLR17` | When the active software mode is Hybrid mode and speed <= SPEED_STOP && P_dem <= PDEM_STOP_HIGH && P_dem >= PDEM_STOP_LOW, the software shall transition to the standstill mode. |
| `SwLLR21` | When the active software mode is ICE mode and P_dem >= PDEM_HYB_MID && SOC >= SOC_MID, the software shall transition to Hybrid mode. |
| `SwLLR23` | When the active software mode is Hybrid mode and (P_dem <= PDEM_HYB_LOW || SOC < SOC_LOW), the software shall transition to ICE mode. |

## Responsabilidade coletiva - requisitos transversais

Os requisitos abaixo nao pertencem a uma familia de transicao especifica: sao realizados por codigo que atende a todos os modos (`ModeLogic_Init`, `write_outputs`, clausula `default` do dispatcher em `ModeLogic_Step`). Sao responsabilidade **coletiva** de todas as pessoas (A-E); cada uma deve manter os testes minimos associados na sua suite.

### Requisitos da secao 4.2

| ID | Requirement statement | Codigo que realiza | Cobertura em testes unitarios |
|---|---|---|---|
| `SwHLR01` | The software shall initialize the active software mode to the standstill mode before the first normal mode-evaluation cycle. | `ModeLogic_Init` (linhas 247-253 em `src/mode_logic_team.c`). | Cada pessoa deve ter um teste que chame `ModeLogic_Init` e verifique que `active_mode == MODE_STANDSTILL` antes do primeiro `ModeLogic_Step`. Na Pessoa E isto esta em `test_init_sets_standstill_mode`. |
| `SwHLR02` | The software shall command the enable outputs associated with the resolved active software mode according to the mode-to-output mapping of the source model. | `write_outputs` (linhas 200-245). | Cada pessoa testa o mapeamento `{Mot, Gen, ICE}` dos modos que toca. Na Pessoa E estao os 5 testes `test_outputs_after_transition_to_*` cobrindo RegenB, EV, StandStill, Hybrid e ICE. |
| `SwHLR10` | The software shall treat initialization to the standstill mode and recovery from an invalid active-mode value as software-defined behaviors outside the 23 modeled transitions. | NULL-check em `ModeLogic_Init`/`ModeLogic_Step` + clausula `default` do switch em `ModeLogic_Step` (linhas 289-291). | Testes de robustez a `NULL` e cobertura da clausula `default` do switch. Na Pessoa E isto esta em `test_step_null_inputs`, `test_step_null_outputs`, e a `default` e explicitamente marcada como fallback MISRA nao-alcancavel em `scope_coverage.py`. |

Convencao pratica: quando uma pessoa descobrir um comportamento transversal violado (por exemplo, a `default` do switch sendo alcancada, ou `Init` nao zerando as saidas), isso deve ser aberto como issue coletivo e nao atribuido ao dono da transicao que acionou o problema.

---

## Requisitos de sistema (derivados)

Os requisitos da secao 4.1 descrevem propriedades arquiteturais do conjunto e nao sao testaveis individualmente: a sua conformidade emerge da soma das familias `SwHLR03`-`SwHLR09`. A rastreabilidade reversa e:

| Requisito de sistema | Como e satisfeito |
|---|---|
| `SysHLR01` Power-Split Supervisory Mode Selection (exatamente um modo por ciclo). | Garantida estruturalmente pelo switch de despacho em `ModeLogic_Step` (apenas um `case` executa) e pelas familias `SwHLR03` (A), `SwHLR04` (B), `SwHLR05` (C), `SwHLR06` (E), `SwHLR07` (D), `SwHLR08` (D+E) e `SwHLR09` (D+E), que esgotam as saidas de cada modo em ordem de prioridade deterministica. |
| `SysHLR02` Deterministic Powertrain Enable Coordination (padrao `{Mot, Gen, ICE}` por modo). | Implementado em `write_outputs` e coberto pela responsabilidade coletiva de `SwHLR02`. A tabela de valores por modo segue exatamente o padrao do PDF (standstill `{0,0,0}`, EV `{1,0,0}`, RegenB `{1,0,0}`, Start `{1,1,0}`, ICE `{0,1,1}`, Hybrid `{1,1,1}`). |
| `SysHLR03` Calibratable and Hysteretic Transition Strategy (usar as calibracoes nomeadas e preservar histerese). | Todos os `SwLLR*` usam somente os simbolos definidos em `inc/mode_logic_team.h` (`ENG_ON`, `ENG_OFF`, `SPEED_STOP`, `SPEED_REGEN`, `SPEED_EV_MAX`, `PDEM_REGEN`, `PDEM_STOP_LOW`, `PDEM_STOP_HIGH`, `PDEM_HYB_IN`, `PDEM_HYB_OUT`, `PDEM_HYB_MID`, `PDEM_HYB_LOW`, `SOC_EV_IN`, `SOC_EV_OUT`, `SOC_MID`, `SOC_LOW`). A parte de histerese e refinada por `NfHLR02`. |

A cobertura ja existente dos testes unitarios atende a estes requisitos por construcao; nao sao necessarios testes adicionais dedicados.

---

## Requisitos nao-funcionais (secao 5)

| ID | Requirement statement | Escopo de verificacao | Onde e como e verificado |
|---|---|---|---|
| `NfHLR01` Periodic Execution and Sample Time | Executar a 0,1 s e resolver o proximo modo no mesmo ciclo. | **Integracao / plataforma** - nao testavel em teste unitario puro (depende do scheduler/RTOS). | Verificar no ambiente de integracao (SIL/HIL). Fora do escopo dos testes unitarios desta entrega. |
| `NfHLR02` Transition Stability and Hysteresis Preservation | Preservar histerese em `SOC_EV_IN/OUT` e `ENG_ON/OFF`, em ordem determinista. | **Parcialmente unitario**: testes de boundary de cada suite cruzam individualmente cada limiar; um teste especifico de ciclo de histerese (entrar e sair atravessando o par de limiares) ainda nao esta implementado. | Compartilhado: A (par `SOC_EV_IN/OUT` em Standstill<->EV), B (par `SOC_EV_IN/OUT` em EV<->Start), C (`SOC_EV_OUT` em RegenB), D (par `ENG_ON/OFF` em Start<->ICE/Hybrid) e E (`ENG_ON` nas guardas externas). Recomenda-se adicionar um teste de ciclo por par de limiares. |
| `NfHLR03` Static Allocation and Bounded State Storage | Sem `malloc`/`free`, sem recursao, sem VLA. | **Revisao de codigo + analise estatica** - atendida pelo gate MISRA C de outra entrega. | Fora do escopo dos testes unitarios. Verificar no gate MISRA (entrega 3). |
| `NfHLR04` Deterministic Outputs and Reproducibility | Mesma entrada -> mesma saida em execucoes repetidas. | **Implicito em toda a suite**: nao ha RNG, tempo real ou I/O no codigo sob teste. Qualquer teste que falhar de forma intermitente ja evidencia violacao. | Coletivo. Cada suite ja chama `ModeLogic_Init` em `setUp` antes de cada teste, garantindo reprodutibilidade entre execucoes. |
