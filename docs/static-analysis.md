# Static analysis

The controller uses a MISRA-oriented C style and is checked with cppcheck and its MISRA C:2012 addon. These checks cover [src/](../src/) and [inc/](../inc/). Unity tests and verification adapters are outside that scope.

The repository does not contain a formal MISRA compliance assessment, tool qualification, or ISO 26262 safety case. An empty analyzer report alone would not establish those claims.

## Checks used by CI

[ci.yaml](../.github/workflows/ci.yaml) installs cppcheck and obtains its Python addons from the matching upstream version. The workflow then runs general analysis and a separate MISRA-addon pass over the C dump. Each pass retains its diagnostics as a workflow artifact and fails on reported errors.

General analysis, from the repository root:

```sh
mkdir -p build/static-analysis
cppcheck --enable=warning,style,performance,portability,unusedFunction --inline-suppr \
  --suppress=missingIncludeSystem --suppress=unmatchedSuppression \
  --error-exitcode=1 --output-file=build/static-analysis/cppcheck-report.txt \
  -Iinc src/ inc/
```

For the MISRA pass, generate a dump and run the addon from a complete cppcheck installation whose addon version matches the executable:

```sh
cppcheck --dump --inline-suppr -Iinc src/ inc/
python3 /path/to/cppcheck/addons/misra.py src/mode_logic_team.c.dump
```

The addon needs its companion Python modules. A copied `misra.py` by itself is not a self-contained checker. The dump is ignored build output. CI shows the exact installation and invocation used for automated checks.

## Documented suppressions

`ModeLogic_Init` and `ModeLogic_Step` carry inline suppressions for `unusedFunction` and `misra-c2012-8.7`. They are the public API, called from the tests and external clients excluded from the production-code analysis scope. Their external linkage is intentional.

Internal helpers remain `static`, input data is passed through a `const` pointer, and the interface uses explicit integer types and scales. Compiler warnings are enabled for the C unit suites. These are inspectable implementation choices, not a substitute for reviewing individual analyzer findings.
