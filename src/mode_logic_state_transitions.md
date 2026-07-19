# Transicoes de estados - `HEV_powersplit_adapted`

Este documento resume o chart Stateflow `Control/Mode Logic` e o contrato
equivalente em `src/mode_logic_team.c`.

## Mapeamento de nomes entre modelo e C

| Modelo | Codigo C |
|---|---|
| `StandStill` | `MODE_STANDSTILL` |
| `EV_mode` | `MODE_EV` |
| `RegenB_mode` | `MODE_REGENB` |
| `Motion_mode_ICE/Start_mode` | `MODE_START` |
| `Motion_mode_ICE/ICE_mode` | `MODE_ICE` |
| `Motion_mode_ICE/Hybrid_mode` | `MODE_HYBRID` |
| `speed` | `speed_dkph` (0.1 km/h) |
| `P_dem` | `p_dem_dkw` (0.1 kW) |
| `charge` | `soc_q10000` (0..10000) |
| `engine_speed` | `weng_rpm` (rpm) |

O modelo Simulink continua usando valores fisicos. A API C de producao usa
inteiros escalados para evitar `float` em software embarcado.

## Limiares

| Macro C | Valor inteiro | Valor fisico | Papel |
|---|---:|---:|---|
| `ENG_ON_RPM` | 800 | 800 rpm | motor ligado |
| `ENG_OFF_RPM` | 790 | 790 rpm | reset por motor abaixo do limiar |
| `SPEED_STOP_DKPH` | 5 | 0.5 km/h | parada / `StandStill` |
| `SPEED_REGEN_DKPH` | 50 | 5.0 km/h | entrada em `RegenB_mode` |
| `SPEED_EV_MAX_DKPH` | 350 | 35.0 km/h | limite superior da faixa EV |
| `PDEM_REGEN_DKW` | -50 | -5.0 kW | frenagem regenerativa |
| `PDEM_STOP_LOW_DKW` | -10 | -1.0 kW | faixa neutra inferior |
| `PDEM_STOP_HIGH_DKW` | 10 | 1.0 kW | faixa neutra superior |
| `PDEM_HYB_IN_DKW` | 500 | 50.0 kW | EV/RegenB para `Motion_mode_ICE` |
| `PDEM_HYB_OUT_DKW` | 400 | 40.0 kW | `Motion_mode_ICE` para EV |
| `PDEM_HYB_MID_DKW` | 150 | 15.0 kW | `Start`/`ICE` para `Hybrid` |
| `PDEM_HYB_LOW_DKW` | 100 | 10.0 kW | `Hybrid` para `ICE` |
| `SOC_EV_IN_Q10000` | 3700 | 0.37 | entrada/manutencao em EV |
| `SOC_EV_OUT_Q10000` | 3500 | 0.35 | saida de EV |
| `SOC_MID_Q10000` | 3000 | 0.30 | divisao `Hybrid` x `ICE` |
| `SOC_LOW_Q10000` | 2500 | 0.25 | queda de `Hybrid` para `ICE` |

## Estado inicial

- Entrada do chart principal: `StandStill`
- Entrada de `Motion_mode_ICE`: `Start_mode`

## Saidas por estado

| Estado no modelo | Estado no C | `Mot_Enable` | `Gen_Enable` | `ICE_Enable` |
|---|---|---:|---:|---:|
| `StandStill` | `MODE_STANDSTILL` | 0 | 0 | 0 |
| `EV_mode` | `MODE_EV` | 1 | 0 | 0 |
| `RegenB_mode` | `MODE_REGENB` | 1 | 0 | 0 |
| `Start_mode` | `MODE_START` | 1 | 1 | 0 |
| `ICE_mode` | `MODE_ICE` | 0 | 1 | 1 |
| `Hybrid_mode` | `MODE_HYBRID` | 1 | 1 | 1 |

## Transicoes de nivel principal

### Saidas de `StandStill`

Prioridade:

1. `StandStill -> EV_mode`
   - Modelo: `[speed>0.5 && speed<=35 && charge>=0.37]`
   - C: `guard_standstill_to_ev()`

2. `StandStill -> Motion_mode_ICE`
   - Modelo: `[speed>0.5]`
   - C: `guard_standstill_to_start()`
   - Observacao: equivalente porque `StandStill -> EV_mode` e avaliada antes.
     Se `speed>0.5` e a guarda EV falhou, entao `speed>35` ou
     `charge<0.37` ja e verdadeiro.

### Saidas de `EV_mode`

Prioridade:

1. `EV_mode -> RegenB_mode`
   - Modelo: `[speed>5 && P_dem<=-5]`
   - C: `guard_to_regenb()`

2. `EV_mode -> Motion_mode_ICE`
   - Modelo: `[speed>35 || P_dem>=50 || charge<0.35]`
   - C: `guard_ev_to_start()`

3. `EV_mode -> StandStill`
   - Modelo: `[speed<=0.5 && P_dem<=1 && P_dem>=-1]`
   - C: `guard_to_standstill()`

### Saidas de `RegenB_mode`

Prioridade:

1. `RegenB_mode -> Motion_mode_ICE`
   - Modelo: `[((speed>35) & (P_dem>=-1)) | (charge<0.35)]`
   - C: `guard_regenb_to_start()`

2. `RegenB_mode -> StandStill`
   - Modelo: `[speed<=0.5 && P_dem<=1 && P_dem>=-1]`
   - C: `guard_to_standstill()`

3. `RegenB_mode -> EV_mode`
   - Modelo: `[P_dem>=-1 && speed>0.5]`
   - C: `guard_regenb_to_ev()`
   - Observacao: equivalente porque `RegenB_mode -> Motion_mode_ICE` e
     `RegenB_mode -> StandStill` sao avaliadas antes. Quando ambas falham,
     `speed<=35` e `charge>=0.35` ja estao garantidos para esta transicao.

## Transicoes de `Motion_mode_ICE` para estados externos

Prioridade:

1. `Motion_mode_ICE -> RegenB_mode`
   - Modelo: `[engine_speed>EngOnRPM && speed>5 && P_dem<=-5]`
   - C: `flag_weng_gt_on() & guard_to_regenb()`

2. `Motion_mode_ICE -> EV_mode`
   - Modelo: `[engine_speed>EngOnRPM && P_dem<=40 && P_dem>=-1 && speed>0.5 && speed<=35 && charge>=0.37]`
   - C: `guard_motion_to_ev()`

3. `Motion_mode_ICE -> StandStill`
   - Modelo: `[speed<=0.5 && P_dem<=1 && P_dem>=-1]`
   - C: `guard_to_standstill()`

## Transicoes internas de `Motion_mode_ICE`

### Saidas de `Start_mode`

Prioridade:

1. `Start_mode -> Hybrid_mode`
   - Modelo: `[engine_speed>EngOnRPM && charge>=0.30 && (speed>35 || P_dem>=15)]`
   - C: `guard_start_to_hybrid()`

2. `Start_mode -> ICE_mode`
   - Modelo: `[engine_speed>EngOnRPM]`
   - C: `guard_start_to_ice()`
   - Observacao: equivalente porque `Start_mode -> Hybrid_mode` e avaliada
     antes. Com `engine_speed>EngOnRPM`, a falha da guarda Hybrid implica a
     condicao complementar que leva a `ICE_mode`.

### Saidas de `ICE_mode`

Prioridade:

1. `ICE_mode -> Start_mode`
   - Modelo: `[engine_speed<=EngOffRPM]`
   - C: `flag_weng_le_off()`

2. `ICE_mode -> Hybrid_mode`
   - Modelo: `[P_dem>=15 && charge>=0.30]`
   - C: `guard_ice_to_hybrid()`

### Saidas de `Hybrid_mode`

Prioridade:

1. `Hybrid_mode -> Start_mode`
   - Modelo: `[engine_speed<=EngOffRPM]`
   - C: `flag_weng_le_off()`

2. `Hybrid_mode -> ICE_mode`
   - Modelo: `[P_dem<=10 || charge<0.25]`
   - C: `guard_hybrid_to_ice()`

## Validacao cruzada

A validacao MATLAB R2026a cobre dois fluxos:

- Simulink Coverage nativo do chart `Control/Mode Logic`: 44/44 decisoes,
  78/78 resultados de condicao e 39/39 MC/DC, sem filtros ou justificativas.
- Regressao focada em 16 casos de fronteira/prioridade/histerese: as tres
  saidas publicas bateram com a referencia C fixed-point para a mesma sequencia
  de entradas fisicas convertidas para escala inteira.

O check de estabilidade usa seis cenarios de hold (`StandStill`, `EV`,
`RegenB`, `Start`, `ICE`, `Hybrid`) e nao encontrou toggles de saida apos o
assentamento.
