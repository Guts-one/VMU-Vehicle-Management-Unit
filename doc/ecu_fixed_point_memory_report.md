# Using Fixed-Point Arithmetic in ECUs to Reduce Dependence on `float`

**Project:** VMU - Vehicle Management Unit\
**Artifact:** Technical report\
**Date:** 2026-06-08\
**Scope:** general best practices for ECUs/embedded C and their application to the VMU project.

## Executive Summary

In automotive ECUs and real-time embedded systems, the use of `float` should not be treated merely as a syntax choice. It affects timing predictability, numerical portability, verification cost, FPU dependency, support libraries, and, in many cases, Flash/RAM consumption. The practical recommendation is not to claim that `float` is always prohibited, but to restrict its use in production software when the function can be represented with scaled integers or fixed-point arithmetic with known range and precision.

The most common pattern in critical embedded software is:

1. Keep physical quantities in clear units in the model and documentation.
2. Define an integer representation for the C interface, such as tenths of km/h, tenths of kW, or a fraction on a 10,000-point scale.
3. Document the scale, range, resolution, saturation, and rounding.
4. Avoid `float` literals and implicit conversions in headers and production logic.
5. Validate numerical equivalence against the reference model and test boundaries, overflow, and hysteresis.

In the VMU project, the current API already follows this direction: `speed_dkph`, `p_dem_dkw`, `soc_q10000`, and `weng_rpm` use integer types with explicit scaling, and the decision thresholds are also expressed as integer macros. This reduces the mode logic's dependence on floating point and makes its behavior better suited to MISRA C and execution on ECUs without a dedicated FPU.

## Why ECUs Restrict `float`

### An FPU May Be Absent, Optional, or Limited

Not every microcontroller used in an ECU has an FPU. Even in modern automotive families, the FPU may be optional or vary across hardware variants. Infineon's documentation for AURIX TriCore describes the FPU as an optional architectural feature, while an application note for an ARM Cortex-M0-based controller explicitly states that the core has no FPU and supports fixed-point arithmetic. This means that the same C code using `float` can have very different costs depending on the target.

When no FPU is available, floating-point operations are implemented in software by helper routines. Typical effects include:

- increased Flash usage from support-library calls;
- higher latency per operation;
- greater timing variation in multiplication, division, and mathematical functions;
- greater difficulty estimating WCET;
- risk of unwanted dependencies on `libm` or the compiler runtime.

### Memory Savings Are Not Just About Variable Size

A 32-bit `float` may have the same raw size as a `uint32_t`, but that isolated comparison is incomplete. In embedded code, memory savings come from three areas:

- using smaller types when the range allows it, such as `uint8_t`, `uint16_t`, or `int16_t`;
- avoiding floating-point libraries and helper mathematical functions;
- reducing alignment overhead, intermediate temporaries, and buffers larger than necessary.

Example: a speed with 0.1 km/h resolution up to 6553.5 km/h fits in a `uint16_t`. For a vehicle ECU, that range is far greater than necessary. In this case, `float` adds no functional capability to the state logic, but increases the conversion and verification surface.

### Timing Predictability and WCET

ECU software normally runs in periodic tasks with a fixed time budget. The logic must finish within the task period in all relevant cases, not only in the average case. Fixed-point arithmetic and scaled integers make the cost of comparisons, additions, and subtractions more predictable. They also facilitate manual review and static analysis because the numerical range can be expressed directly in the type and calibration macros.

For supervisory control, such as VMU mode selection, most of the logic consists of threshold comparisons. In this type of decision, `float` is generally unnecessary when the chosen resolution covers the physical requirements.

### Numerical Portability and Reproducibility

Modern floating-point arithmetic can be deterministic for a well-defined target, controlled compiler, and known FPU configuration. The practical issue in automotive projects is that the toolchain may involve host simulation, SIL/PIL, different compiler options, different MCUs, and automatic code generation. Small differences in rounding, promotion to `double`, handling of denormal values, or optimization can make bit-for-bit comparisons more difficult.

Fixed-point arithmetic also requires care, especially with overflow and rounding. The advantage is that these rules can be defined explicitly: scale, saturation, accumulator width, and rounding mode become part of the specification.

## Recommended Approach: Scaled Integers and Fixed-Point Arithmetic

### Scaled Integers

A scaled integer is the simplest form of fixed-point representation. A physical quantity is represented by an integer obtained by multiplying the physical value by a fixed scale:

| Physical quantity | Representation | Example |
| --- | --- | --- |
| Speed in km/h | `speed_dkph = km/h * 10` | 35.0 km/h -> `350` |
| Power in kW | `p_dem_dkw = kW * 10` | -5.0 kW -> `-50` |
| SOC in % | `soc_q10000 = fraction * 10000` | 37% -> `3700` |
| Engine speed in rpm | `weng_rpm = rpm` | 800 rpm -> `800` |

This pattern is appropriate for thresholds, hysteresis, state machines, simple diagnostics, and control interfaces where the required resolution is known.

### Q Format

Q format is a fixed-point representation in which some of the bits represent the fractional part. Formats such as Q15, Q31, or Q7 appear in DSP libraries, including Arm CMSIS-DSP. The important point is that multiplication and accumulation require clear rules:

- the full-precision product of two fixed-point values requires a wider intermediate type;
- the result must be shifted to return to the original scale;
- overflow must be prevented by design or handled with saturation;
- comparisons are safe only when the scales are compatible.

For the VMU, the current logic does not require a complex Q format because its decisions primarily consist of threshold comparisons. Scaled integers are simpler and sufficient.

### Saturation, Overflow, and Rounding

The most common mistake when replacing `float` with an integer is ignoring intermediate overflow. The design rules should be:

- define the maximum and minimum physical range of each input;
- choose a type with sufficient margin;
- use a wider accumulator for multiplication or accumulated sums;
- apply saturation when failure caused by wraparound is unacceptable;
- document rounding for conversions from physical units to the integer scale.

For mode logic, thresholds should already be expressed in the scaled unit. This avoids runtime conversions and reduces the risk of error:

```c
#define SPEED_STOP_DKPH   (5U)     /* 0.5 km/h */
#define PDEM_REGEN_DKW    (-50)    /* -5.0 kW */
#define SOC_EV_IN_Q10000  (3700U)  /* 37.00% */
```

## Relationship to MISRA C and AUTOSAR

MISRA C should not be interpreted as an absolute prohibition of `float`. Its rules focus on reducing undefined behavior, unsafe conversions, loss of precision, implementation dependence, and type ambiguities. The MISRA C:2012 Rule 10.x family uses the concept of the "essential type model" to control assignments, conversions, and operations across type categories.

Practical measures for code that is better aligned with MISRA C include:

- avoiding implicit conversions between `float` and integer types;
- avoiding assignment of an expression to a narrower type without justification;
- avoiding signed and unsigned types in the same expression;
- using fixed-width types from `<stdint.h>`;
- keeping thresholds and scales in macros or typed constants;
- avoiding `float` literals in production headers when the API uses integers;
- performing static validation with tools such as cppcheck/MISRA, Polyspace, or equivalents.

AUTOSAR C++14 also restricts implicit conversions between floating-point and integer types, reinforcing the same design direction: when a conversion is necessary, it should be explicit, localized, reviewed, and tested.

## Model-Based Workflow: Simulink in Physical Units, C with Scaled Integers

In model-based development, it is common to keep Simulink/Stateflow in physical units because this facilitates validation by system engineers, calibration, and requirements review. Conversion for embedded C should occur at a well-defined boundary:

1. The model uses km/h, kW, SOC, and rpm in engineering units.
2. The test wrapper converts these quantities to the C scale.
3. The C API receives only scaled integers.
4. The equivalence comparison converts the outputs to the same domain without changing their semantics.

Tools such as Fixed-Point Designer and Embedded Coder support fixed-point code generation from models, including code that uses integer types and shifts to represent fixed-point values. MathWorks documentation also highlights numerical testing, overflow detection, SIL/PIL, traceability, and coverage as parts of the verification workflow.

For the VMU, the recommended approach is to retain Stateflow as the physical reference and preserve the fixed-point C API. Equivalence should be tested at threshold and hysteresis boundaries such as `SOC_EV_IN`, `SOC_EV_OUT`, `ENG_ON`, `ENG_OFF`, `SPEED_STOP`, `SPEED_EV_MAX`, `PDEM_HYB_MID`, and `PDEM_HYB_LOW`.

## Case Study: VMU

The `inc/mode_logic_team.h` header already defines an embedded interface with integer scales:

| Field | Type | Scale | Use |
| --- | --- | --- | --- |
| `speed_dkph` | `uint16_t` | 0.1 km/h | vehicle speed |
| `p_dem_dkw` | `int16_t` | 0.1 kW | demanded power, including negative values during regenerative braking |
| `soc_q10000` | `uint16_t` | 0..10000 | battery state of charge |
| `weng_rpm` | `uint16_t` | integer rpm | combustion-engine speed |

The control thresholds are also expressed as integers:

| Macro | Value | Physical meaning |
| --- | ---: | --- |
| `SPEED_STOP_DKPH` | `5U` | 0.5 km/h |
| `SPEED_REGEN_DKPH` | `50U` | 5.0 km/h |
| `SPEED_EV_MAX_DKPH` | `350U` | 35.0 km/h |
| `PDEM_REGEN_DKW` | `-50` | -5.0 kW |
| `PDEM_HYB_IN_DKW` | `500` | 50.0 kW |
| `PDEM_HYB_OUT_DKW` | `400` | 40.0 kW |
| `SOC_EV_IN_Q10000` | `3700U` | 37.00% |
| `SOC_EV_OUT_Q10000` | `3500U` | 35.00% |
| `ENG_ON_RPM` | `800U` | 800 rpm |
| `ENG_OFF_RPM` | `790U` | 790 rpm |

This representation is appropriate for the VMU logic:

- transitions are based on comparisons and hysteresis;
- resolutions of 0.1 km/h and 0.1 kW are sufficient for supervisory thresholds;
- SOC on a 10,000-point scale can express percentages to two decimal places;
- integer rpm is natural for the engine-speed signal;
- `Outputs_t` uses `uint8_t` for binary outputs, reducing size compared with `int`.

The main consideration is to keep the physical-to-integer conversion outside the core logic, with saturation or range validation before calling `ModeLogic_Step`. This ensures that the state machine does not need to handle `float`, `double`, or implicit conversions.

## Checklist for New ECU Modules

1. Define the physical unit of each signal.
2. Define the minimum resolution specified by the requirement.
3. Choose an integer scale that covers the range and resolution with sufficient margin.
4. Choose a fixed-width type (`uint8_t`, `int16_t`, `uint16_t`, `int32_t`).
5. Document the physical value, scale, minimum, maximum, and out-of-range behavior.
6. Define saturation, truncation, or rounding for each conversion.
7. Avoid `float` and `double` literals in production headers.
8. Avoid implicit conversions among integer, signed/unsigned, and floating-point types.
9. Use wider accumulators for multiplication and accumulated sums.
10. Test boundaries: minimum, maximum, threshold - 1 LSB, threshold, and threshold + 1 LSB.
11. Validate equivalence with the model in physical units.
12. Run MISRA static analysis and review all deviations.

## Recommendations for the VMU

- Keep the public API in an integer-based fixed-point format.
- Keep thresholds in integer macros with comments stating the physical values.
- Concentrate physical conversions in test wrappers, integration adapters, or the signal-acquisition layer.
- Do not reintroduce `float` into `inc/mode_logic_team.h` or into guards in `src/mode_logic_team.c`.
- When the Simulink model uses physical units, document the conversion applied in the equivalence tests.
- For every new guard, write tests at the three relevant points: below the threshold, at the threshold, and above the threshold.

## References

1. MathWorks, [Fixed-Point Code Generation in Simulink](https://www.mathworks.com/help/fixedpoint/fixed-point-code-generation-in-simulink.html).
2. MathWorks, [Code Generation by Using Embedded Coder](https://www.mathworks.com/help/ecoder/gs/code-generation-workflows-with-embedded-coder.html).
3. MathWorks, [Automated Fixed-Point Conversion](https://www.mathworks.com/help/coder/ug/fixed-point-conversion.html).
4. MathWorks, [Embedded Code Generation - Production Code in Automotive ECUs](https://www.mathworks.com/solutions/embedded-code-generation/production-code-automotive-ecu.html).
5. Arm, [CMSIS-DSP Fixed Point Datatypes](https://arm-software.github.io/CMSIS-DSP/latest/group__FIXED.html).
6. MathWorks/Polyspace, [MISRA C:2012 Rule 10.3](https://www.mathworks.com/help/bugfinder/ref/misrac2012rule10.3.html).
7. MathWorks/Polyspace, [Essential Type Model Used in MISRA C Rule Checking](https://www.mathworks.com/help/bugfinder/ug/essential-types-in-misra-c-2012-rules.html).
8. MathWorks/Polyspace, [AUTOSAR C++14 Rule M5-0-5](https://it.mathworks.com/help/bugfinder/ref/autosarc14rulem505.html).
9. Infineon, [32-bit AURIX TriCore Microcontroller](https://www.infineon.com/products/microcontroller/32-bit-tricore).
10. Infineon, [XDPP1100 Getting Started Firmware Development Application Note](https://www.infineon.com/dgdl/Infineon-Digital_power_controller_XDP_XDPP1100_getting_started_firmware_development-ApplicationNotes-v01_00-EN.pdf?fileId=5546d46272e49d2a01730f1cba482a01).
