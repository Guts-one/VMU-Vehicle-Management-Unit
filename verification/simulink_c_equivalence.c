/* Replays the full Simulink Coverage stimulus through the fixed-point C
 * implementation and compares the observable outputs row by row against
 * the outputs recorded from the Stateflow chart.
 *
 * Usage: simulink_c_equivalence <stimulus_and_outputs.csv> <c_outputs.csv>
 *
 * The stimulus CSV is produced by .codex/run_stateflow_native_mcdc.m:
 *   step,scenario,speed_kph,p_dem_kw,soc,weng_rpm,Mot_Enable,Gen_Enable,ICE_Enable
 *
 * Rows are applied in file order: the stimulus drives one sequential state
 * machine, so ordering (including the reset sub-sequences) is significant.
 * Physical values are converted to the fixed-point API scales with the same
 * round-half-away-from-zero rule used by the Unity test helpers.
 */

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include "../inc/mode_logic_team.h"

#define MAX_LINE 512U
#define MAX_FIELDS 9

#define U16_MAX_D 65535.0
#define S16_MAX_D 32767.0
#define S16_MIN_D (-32768.0)

/* Physical->fixed-point conversion. Round half away from zero, matching the
 * Unity test helpers. Saturating: a negative or out-of-range physical value
 * would otherwise make the cast to uint16_t/int16_t undefined (C11 6.3.1.4);
 * callers validate range first (see main), so saturation here is defensive.
 *
 * Equivalence caveat: this conversion quantizes the continuous Simulink input
 * onto the integer API. round-half-away maps a physical value in the top half
 * LSB just below a threshold UP to the threshold integer (e.g. SOC 0.36997 ->
 * 3700, speed 35.04 km/h -> 350 dkph), so the integer C and the physical
 * Stateflow chart disagree inside that half-LSB band. The recorded MC/DC
 * stimulus uses LSB-aligned values, so the row-by-row match proves equivalence
 * of the quantized stimulus, not of the continuous neighbourhood of a threshold. */
static uint16_t to_u16(double physical, double scale)
{
    double scaled = (physical * scale) + 0.5;
    if (scaled <= 0.0) {
        return 0U;
    }
    if (scaled >= U16_MAX_D) {
        return (uint16_t)U16_MAX_D;
    }
    return (uint16_t)scaled;
}

static int16_t to_s16(double physical, double scale)
{
    double scaled = physical * scale;
    scaled = (scaled >= 0.0) ? (scaled + 0.5) : (scaled - 0.5);
    if (scaled >= S16_MAX_D) {
        return (int16_t)S16_MAX_D;
    }
    if (scaled <= S16_MIN_D) {
        return (int16_t)S16_MIN_D;
    }
    return (int16_t)scaled;
}

/* Strict numeric parsing: reject empty/garbage/overflowing fields instead of
 * silently yielding 0 (atof/atoi) or INFINITY (which would make the conversion
 * cast undefined). Returns 1 on success, 0 on failure. */
static int parse_double(const char *s, double *out)
{
    char *end = NULL;
    double v;

    errno = 0;
    v = strtod(s, &end);
    if ((end == s) || (*end != '\0') || (errno != 0)) {
        return 0;
    }
    *out = v;
    return 1;
}

static int parse_long(const char *s, long *out)
{
    char *end = NULL;
    long v;

    errno = 0;
    v = strtol(s, &end, 10);
    if ((end == s) || (*end != '\0') || (errno != 0)) {
        return 0;
    }
    *out = v;
    return 1;
}

static int split_csv(char *line, char *fields[], int max_fields)
{
    int count = 0;
    char *p = line;

    while ((count < max_fields) && (p != NULL)) {
        char *comma = strchr(p, ',');
        fields[count] = p;
        count++;
        if (comma != NULL) {
            *comma = '\0';
            p = comma + 1;
        } else {
            p = NULL;
        }
    }
    return count;
}

int main(int argc, char **argv)
{
    FILE *in_csv;
    FILE *out_csv;
    char line[MAX_LINE];
    State_t state;
    unsigned long row = 0UL;
    unsigned long mismatches = 0UL;

    if (argc != 3) {
        fprintf(stderr, "usage: %s <stimulus_and_outputs.csv> <c_outputs.csv>\n",
                argv[0]);
        return EXIT_FAILURE;
    }

    in_csv = fopen(argv[1], "r");
    if (in_csv == NULL) {
        fprintf(stderr, "cannot open %s\n", argv[1]);
        return EXIT_FAILURE;
    }
    out_csv = fopen(argv[2], "w");
    if (out_csv == NULL) {
        fprintf(stderr, "cannot open %s\n", argv[2]);
        fclose(in_csv);
        return EXIT_FAILURE;
    }

    fprintf(out_csv,
            "row,scenario,speed_dkph,p_dem_dkw,soc_q10000,weng_rpm,"
            "c_mode,c_Mot,c_Gen,c_ICE,sl_Mot,sl_Gen,sl_ICE,match\n");

    ModeLogic_Init(&state);

    /* Skip header line. */
    if (fgets(line, (int)sizeof(line), in_csv) == NULL) {
        fprintf(stderr, "empty stimulus file\n");
        fclose(in_csv);
        fclose(out_csv);
        return EXIT_FAILURE;
    }

    while (fgets(line, (int)sizeof(line), in_csv) != NULL) {
        char *fields[MAX_FIELDS];
        Inputs_t in;
        Outputs_t out;
        int sl_mot;
        int sl_gen;
        int sl_ice;
        int match;

        if ((strchr(line, '\n') == NULL) && (feof(in_csv) == 0)) {
            fprintf(stderr, "row %lu: line exceeds %u bytes (truncated)\n",
                    row, (unsigned int)MAX_LINE);
            fclose(in_csv);
            fclose(out_csv);
            return EXIT_FAILURE;
        }
        line[strcspn(line, "\r\n")] = '\0';
        if (line[0] == '\0') {
            continue;
        }
        if (split_csv(line, fields, MAX_FIELDS) != MAX_FIELDS) {
            fprintf(stderr, "row %lu: malformed line\n", row);
            fclose(in_csv);
            fclose(out_csv);
            return EXIT_FAILURE;
        }

        {
            double f_speed;
            double f_pdem;
            double f_soc;
            double f_weng;
            long l_mot;
            long l_gen;
            long l_ice;

            if ((parse_double(fields[2], &f_speed) == 0) ||
                (parse_double(fields[3], &f_pdem) == 0) ||
                (parse_double(fields[4], &f_soc) == 0) ||
                (parse_double(fields[5], &f_weng) == 0) ||
                (parse_long(fields[6], &l_mot) == 0) ||
                (parse_long(fields[7], &l_gen) == 0) ||
                (parse_long(fields[8], &l_ice) == 0)) {
                fprintf(stderr, "row %lu: non-numeric field\n", row);
                fclose(in_csv);
                fclose(out_csv);
                return EXIT_FAILURE;
            }

            if ((f_speed < 0.0) || ((f_speed * 10.0) > U16_MAX_D) ||
                (f_soc < 0.0) || ((f_soc * 10000.0) > U16_MAX_D) ||
                (f_weng < 0.0) || (f_weng > U16_MAX_D) ||
                ((f_pdem * 10.0) > S16_MAX_D) ||
                ((f_pdem * 10.0) < S16_MIN_D)) {
                fprintf(stderr, "row %lu: value out of fixed-point range\n", row);
                fclose(in_csv);
                fclose(out_csv);
                return EXIT_FAILURE;
            }

            in.speed_dkph = to_u16(f_speed, 10.0);
            in.p_dem_dkw = to_s16(f_pdem, 10.0);
            in.soc_q10000 = to_u16(f_soc, 10000.0);
            in.weng_rpm = to_u16(f_weng, 1.0);
            sl_mot = (int)l_mot;
            sl_gen = (int)l_gen;
            sl_ice = (int)l_ice;
        }

        ModeLogic_Step(&state, &in, &out);

        match = ((int)out.Mot_Enable == sl_mot) &&
                ((int)out.Gen_Enable == sl_gen) &&
                ((int)out.ICE_Enable == sl_ice);
        if (!match) {
            mismatches++;
            fprintf(stderr,
                    "MISMATCH row %lu (%s): C=[%u %u %u] Simulink=[%d %d %d]\n",
                    row, fields[1],
                    (unsigned int)out.Mot_Enable,
                    (unsigned int)out.Gen_Enable,
                    (unsigned int)out.ICE_Enable,
                    sl_mot, sl_gen, sl_ice);
        }

        fprintf(out_csv, "%lu,%s,%u,%d,%u,%u,%d,%u,%u,%u,%d,%d,%d,%d\n",
                row, fields[1],
                (unsigned int)in.speed_dkph, (int)in.p_dem_dkw,
                (unsigned int)in.soc_q10000, (unsigned int)in.weng_rpm,
                (int)state.current_mode,
                (unsigned int)out.Mot_Enable, (unsigned int)out.Gen_Enable,
                (unsigned int)out.ICE_Enable,
                sl_mot, sl_gen, sl_ice, match);
        row++;
    }

    fclose(in_csv);
    fclose(out_csv);

    printf("SIMULINK_C_EQUIVALENCE rows=%lu mismatches=%lu result=%s\n",
           row, mismatches, (mismatches == 0UL) ? "MATCH" : "MISMATCH");

    return (mismatches == 0UL) ? EXIT_SUCCESS : EXIT_FAILURE;
}
