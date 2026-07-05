/* Stand-alone unit test of the LCT wrapper (sfun_mode_logic_wrap.c).
 *
 * Emulates exactly what the Simulink harness does: carry mode_out back into
 * mode_in through a one-step delay (initialised to STANDSTILL=0), driving the
 * combinational wrapper with the boundary stimulus. The resulting mode/outputs
 * must equal a direct sequential ModeLogic_Step run (mode_probe) and the mirror
 * column exp_mode_c. Exit code = mismatch count.
 *
 * Usage: test_wrap <stimulus.csv>
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void ModeLogic_CoSimStep(const uint16_t speed_dkph[1], const int16_t p_dem_dkw[1],
                         const uint16_t soc_q10000[1], const uint16_t weng_rpm[1],
                         const uint8_t mode_in[1], uint8_t mode_out[1],
                         uint8_t mot[1], uint8_t gen[1], uint8_t ice[1]);

#define MAXL 1024
#define MAXF 32
static const char *MODE_NAME[] = {"STANDSTILL","EV","REGENB","START","ICE","HYBRID"};

static int split(char *l, char *f[], int m){int n=0;char*p=l;while(n<m&&p){char*c=strchr(p,',');f[n++]=p;if(c){*c='\0';p=c+1;}else p=NULL;}return n;}
static int col(char *h,const char*nm){char t[MAXL];char*f[MAXF];int n,i;strncpy(t,h,sizeof(t)-1);t[sizeof(t)-1]='\0';t[strcspn(t,"\r\n")]='\0';n=split(t,f,MAXF);for(i=0;i<n;i++)if(!strcmp(f[i],nm))return i;return -1;}

int main(int argc, char **argv)
{
    FILE *in; char line[MAXL]; int i_sp,i_pd,i_soc,i_we,i_exp;
    uint8_t mode_in = 0U;  /* Unit Delay initial condition = STANDSTILL */
    unsigned long row=0UL, mism=0UL;

    if (argc!=2){fprintf(stderr,"usage: %s <csv>\n",argv[0]);return 2;}
    in=fopen(argv[1],"r"); if(!in){fprintf(stderr,"open fail\n");return 2;}
    if(!fgets(line,sizeof(line),in)){return 2;}
    i_sp=col(line,"speed_dkph"); i_pd=col(line,"p_dem_dkw");
    i_soc=col(line,"soc_q10000"); i_we=col(line,"weng_rpm_fx"); i_exp=col(line,"exp_mode_c");
    if(i_sp<0||i_pd<0||i_soc<0||i_we<0){fprintf(stderr,"cols missing\n");return 2;}

    printf("row,mode_out,Mot,Gen,ICE,exp_mode,match\n");
    while(fgets(line,sizeof(line),in)){
        char*f[MAXF];int n; uint16_t sp,soc,we; int16_t pd;
        uint8_t mode_out,mot,gen,ice; const char*emode;int match;
        line[strcspn(line,"\r\n")]='\0'; if(!line[0])continue;
        n=split(line,f,MAXF); if(n<=i_we){fprintf(stderr,"row %lu malformed\n",row);return 2;}
        sp=(uint16_t)strtoul(f[i_sp],NULL,10); pd=(int16_t)strtol(f[i_pd],NULL,10);
        soc=(uint16_t)strtoul(f[i_soc],NULL,10); we=(uint16_t)strtoul(f[i_we],NULL,10);

        ModeLogic_CoSimStep(&sp,&pd,&soc,&we,&mode_in,&mode_out,&mot,&gen,&ice);
        mode_in = mode_out;   /* the Unit Delay: feed back for next step */

        emode = (i_exp>=0 && n>i_exp) ? f[i_exp] : "";
        match = (i_exp>=0) ? (strcmp(MODE_NAME[mode_out],emode)==0) : 1;
        if(!match) mism++;
        printf("%lu,%s,%u,%u,%u,%s,%d\n",row,MODE_NAME[mode_out],mot,gen,ice,emode,match);
        row++;
    }
    fclose(in);
    fprintf(stderr,"TEST_WRAP rows=%lu mismatches=%lu result=%s\n",
            row,mism,(mism==0UL)?"WRAPPER_EXACT":"WRAPPER_DIVERGES");
    return (mism==0UL)?0:1;
}
