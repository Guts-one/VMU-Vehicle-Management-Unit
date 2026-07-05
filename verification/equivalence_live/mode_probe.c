/* mode_probe -- run an inputs-only stimulus CSV through the REAL
 * src/mode_logic_team.c and print the resulting mode + outputs per row.
 *
 * Purpose: cross-check the Python mirror in gen_boundary_stimulus.py against
 * the actual compiled C, and (when built with --coverage) measure how much of
 * the decision logic the boundary stimulus exercises.
 *
 * Usage: mode_probe <stimulus.csv>
 * Reads the fixed-point columns (speed_dkph,p_dem_dkw,soc_q10000,weng_rpm_fx)
 * and the exp_mode_c column; inits ONCE and applies every row in file order.
 * Exit code = number of rows where the C mode != exp_mode_c (0 = mirror exact).
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../../inc/mode_logic_team.h"

#define MAXL 1024
#define MAXF 32

static const char *MODE_NAME[] = {
    "STANDSTILL", "EV", "REGENB", "START", "ICE", "HYBRID"
};

static int split(char *line, char *f[], int maxf)
{
    int n = 0; char *p = line;
    while (n < maxf && p) {
        char *c = strchr(p, ',');
        f[n++] = p;
        if (c) { *c = '\0'; p = c + 1; } else { p = NULL; }
    }
    return n;
}

static int col_index(char *header, const char *name)
{
    char tmp[MAXL]; char *f[MAXF]; int n, i;
    strncpy(tmp, header, sizeof(tmp) - 1); tmp[sizeof(tmp) - 1] = '\0';
    tmp[strcspn(tmp, "\r\n")] = '\0';
    n = split(tmp, f, MAXF);
    for (i = 0; i < n; i++) {
        if (strcmp(f[i], name) == 0) return i;
    }
    return -1;
}

int main(int argc, char **argv)
{
    FILE *in;
    char line[MAXL];
    int i_sp, i_pd, i_soc, i_we, i_exp;
    State_t st;
    unsigned long row = 0UL, mism = 0UL;

    if (argc != 2) { fprintf(stderr, "usage: %s <csv>\n", argv[0]); return 2; }
    in = fopen(argv[1], "r");
    if (!in) { fprintf(stderr, "cannot open %s\n", argv[1]); return 2; }

    if (!fgets(line, sizeof(line), in)) { fprintf(stderr, "empty\n"); return 2; }
    i_sp  = col_index(line, "speed_dkph");
    i_pd  = col_index(line, "p_dem_dkw");
    i_soc = col_index(line, "soc_q10000");
    i_we  = col_index(line, "weng_rpm_fx");
    i_exp = col_index(line, "exp_mode_c");
    if (i_sp < 0 || i_pd < 0 || i_soc < 0 || i_we < 0) {
        fprintf(stderr, "missing fixed-point columns\n"); return 2;
    }

    ModeLogic_Init(&st);
    printf("row,scenario,phase,kind,mode,Mot,Gen,ICE,exp_mode,match\n");

    while (fgets(line, sizeof(line), in)) {
        char *f[MAXF]; int n; Inputs_t in_s; Outputs_t out;
        const char *cmode, *emode; int match;
        line[strcspn(line, "\r\n")] = '\0';
        if (line[0] == '\0') continue;
        n = split(line, f, MAXF);
        if (n <= i_we) { fprintf(stderr, "row %lu malformed\n", row); return 2; }

        in_s.speed_dkph = (uint16_t)strtoul(f[i_sp], NULL, 10);
        in_s.p_dem_dkw  = (int16_t)strtol(f[i_pd], NULL, 10);
        in_s.soc_q10000 = (uint16_t)strtoul(f[i_soc], NULL, 10);
        in_s.weng_rpm   = (uint16_t)strtoul(f[i_we], NULL, 10);

        ModeLogic_Step(&st, &in_s, &out);
        cmode = MODE_NAME[(int)st.current_mode];
        emode = (i_exp >= 0 && n > i_exp) ? f[i_exp] : "";
        match = (i_exp >= 0) ? (strcmp(cmode, emode) == 0) : 1;
        if (!match) mism++;

        printf("%lu,%s,%s,%s,%s,%u,%u,%u,%s,%d\n",
               row,
               (n > 1) ? f[1] : "", (n > 2) ? f[2] : "", (n > 3) ? f[3] : "",
               cmode, out.Mot_Enable, out.Gen_Enable, out.ICE_Enable,
               emode, match);
        row++;
    }
    fclose(in);
    fprintf(stderr, "MODE_PROBE rows=%lu mirror_mismatches=%lu result=%s\n",
            row, mism, (mism == 0UL) ? "MIRROR_EXACT" : "MIRROR_DIVERGES");
    return (mism == 0UL) ? 0 : 1;
}
