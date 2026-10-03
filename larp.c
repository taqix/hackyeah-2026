/*
 * LARP // Localized Anisotropic Resonance Processor
 * Build: cc -std=c11 -O2 -Wall -Wextra -pedantic larp.c -lm -o larp
 * Run:   ./larp             (Ctrl-C to collapse the wavefunction)
 *        ./larp --once      (one frame, useful for smoke tests)
 *
 * This is an actual particle / spectral-field simulation dressed up as a
 * wildly overengineered operations console. All telemetry is local fiction.
 */
#define _POSIX_C_SOURCE 200809L
#include <complex.h>
#include <math.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

enum { NX = 64, NY = 24, MODES = 64, PARTICLES = 192, HISTORY = 48 };
static const double TAU = 6.283185307179586476925286766559;
static volatile sig_atomic_t running = 1;

typedef struct { double x, y; } Vec2;
typedef struct { Vec2 q, p; double charge, phase; } Quasiparticle;
typedef struct {
    double complex amplitude[MODES];
    double potential[NY][NX];
    double density[NY][NX];
    Quasiparticle particles[PARTICLES];
    double energy[HISTORY];
    double entropy, residual, coherence;
    uint64_t tick, rng;
} Resonator;

static double clamp(double x, double lo, double hi) {
    return x < lo ? lo : x > hi ? hi : x;
}

static uint64_t next_u64(Resonator *r) {
    uint64_t z = (r->rng += UINT64_C(0x9e3779b97f4a7c15));
    z = (z ^ (z >> 30)) * UINT64_C(0xbf58476d1ce4e5b9);
    z = (z ^ (z >> 27)) * UINT64_C(0x94d049bb133111eb);
    return z ^ (z >> 31);
}

static double uniform(Resonator *r) {
    return (double)(next_u64(r) >> 11) * 0x1.0p-53;
}

/* In-place radix-2 butterfly network; inverse normalization is explicit. */
static void spectral_transform(double complex *a, size_t n, bool inverse) {
    for (size_t i = 1, j = 0; i < n; ++i) {
        size_t bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            double complex tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
    }
    for (size_t span = 2; span <= n; span <<= 1) {
        double complex rotor = cexp(I * (inverse ? TAU : -TAU) / span);
        for (size_t base = 0; base < n; base += span) {
            double complex w = 1.0;
            for (size_t k = 0; k < span / 2; ++k, w *= rotor) {
                double complex u = a[base + k];
                double complex v = w * a[base + k + span / 2];
                a[base + k] = u + v;
                a[base + k + span / 2] = u - v;
            }
        }
    }
    if (inverse) for (size_t i = 0; i < n; ++i) a[i] /= n;
}

static double wrap(double x, double period) {
    return x - floor(x / period) * period;
}

static Vec2 field_gradient(const Resonator *r, Vec2 q) {
    int x = (int)q.x, y = (int)q.y;
    return (Vec2){
        0.5 * (r->potential[y][(x + 1) % NX] -
               r->potential[y][(x + NX - 1) % NX]),
        0.5 * (r->potential[(y + 1) % NY][x] -
               r->potential[(y + NY - 1) % NY][x])
    };
}

/* Red-black successive over-relaxation on a periodic Poisson lattice. */
static void relax_potential(Resonator *r) {
    r->residual = 0;
    for (int sweep = 0; sweep < 12; ++sweep) {
        for (int parity = 0; parity < 2; ++parity) {
            for (int y = 0; y < NY; ++y) {
                for (int x = (y + parity) & 1; x < NX; x += 2) {
                    double neighbors = r->potential[y][(x + 1) % NX]
                        + r->potential[y][(x + NX - 1) % NX]
                        + r->potential[(y + 1) % NY][x]
                        + r->potential[(y + NY - 1) % NY][x];
                    double defect = 0.25 * (neighbors + r->density[y][x])
                                  - r->potential[y][x];
                    r->potential[y][x] += 1.62 * defect;
                    if (sweep == 11) r->residual += defect * defect;
                }
            }
        }
    }
    double mean = 0;
    for (int y = 0; y < NY; ++y)
        for (int x = 0; x < NX; ++x) mean += r->potential[y][x];
    mean /= NX * NY;
    for (int y = 0; y < NY; ++y)
        for (int x = 0; x < NX; ++x) r->potential[y][x] -= mean;
    r->residual = sqrt(r->residual / (NX * NY));
}

static void advance(Resonator *r) {
    memset(r->density, 0, sizeof r->density);
    for (int i = 0; i < PARTICLES; ++i) {
        Quasiparticle *p = &r->particles[i];
        r->density[(int)p->q.y][(int)p->q.x] += p->charge;
    }
    relax_potential(r);
    double kinetic = 0;
    for (int i = 0; i < PARTICLES; ++i) {
        Quasiparticle *p = &r->particles[i];
        Vec2 g = field_gradient(r, p->q);
        p->phase += 0.017 + 0.003 * p->charge;
        p->p.x = 0.996 * p->p.x - 0.025 * p->charge * g.x
               + 0.004 * cos(p->phase);
        p->p.y = 0.996 * p->p.y - 0.025 * p->charge * g.y
               + 0.004 * sin(p->phase);
        p->q.x = wrap(p->q.x + p->p.x, NX);
        p->q.y = wrap(p->q.y + p->p.y, NY);
        kinetic += p->p.x * p->p.x + p->p.y * p->p.y;
    }
    spectral_transform(r->amplitude, MODES, false);
    double total = 0, peak = 0;
    for (int k = 0; k < MODES; ++k) {
        double wave = k <= MODES / 2 ? k : k - MODES;
        r->amplitude[k] *= cexp(-I * 0.0009 * wave * wave);
        double power = pow(cabs(r->amplitude[k]), 2);
        total += power;
        if (power > peak) peak = power;
    }
    r->coherence = peak / (total + 1e-15);
    r->entropy = 0;
    for (int k = 0; k < MODES; ++k) {
        double probability = pow(cabs(r->amplitude[k]), 2) / (total + 1e-15);
        if (probability > 0) r->entropy -= probability * log(probability);
    }
    spectral_transform(r->amplitude, MODES, true);
    for (int k = 0; k < MODES; ++k) {
        double magnitude = cabs(r->amplitude[k]);
        r->amplitude[k] *= cexp(I * 0.045 * magnitude * magnitude);
    }
    r->energy[r->tick % HISTORY] = kinetic / PARTICLES;
    ++r->tick;
}

static void meter(double value) {
    int filled = (int)clamp(value * 28, 0, 28);
    putchar('[');
    for (int i = 0; i < 28; ++i) putchar(i < filled ? '=' : '.');
    putchar(']');
}

static void render(const Resonator *r, bool terminal) {
    static const char ramp[] = " .,:;irsXA253hMHGS#9B&@";
    if (terminal) fputs("\033[H\033[36m", stdout);
    puts("  L A R P  /  ANISOTROPIC RESONANCE CONTROL                 [LOCAL SIM]");
    printf("  epoch %010llu | lattice %dx%d | agents %d | FFT %d\n",
           (unsigned long long)r->tick, NX, NY, PARTICLES, MODES);
    puts("  +----------------------------------------------------------------+");
    for (int y = 0; y < NY; ++y) {
        fputs("  |", stdout);
        for (int x = 0; x < NX; ++x) {
            double carrier = creal(r->amplitude[x]) *
                sin(0.19 * y + 0.021 * r->tick);
            double v = 0.5 + 0.5 * tanh(0.85 * r->potential[y][x] + carrier);
            size_t index = (size_t)(v * (sizeof ramp - 2));
            if (terminal) printf("\033[%dm", v > 0.72 ? 97 : v > 0.46 ? 36 : 34);
            putchar(ramp[index]);
        }
        if (terminal) fputs("\033[36m", stdout);
        puts("|");
    }
    puts("  +----------------------------------------------------------------+");
    printf("  coherence "); meter(r->coherence); printf("  %.6f\n", r->coherence);
    printf("  entropy   "); meter(r->entropy / log(MODES)); printf("  %.6f\n", r->entropy);
    printf("  residual  %.8e     kinetic %.8e\n", r->residual,
           r->energy[(r->tick - 1) % HISTORY]);
    fputs("  history   ", stdout);
    for (int i = 0; i < HISTORY; ++i) {
        double e = r->energy[(r->tick + i) % HISTORY];
        putchar("._-=+*#@"[(int)clamp(e * 12, 0, 7)]);
    }
    printf("\n  solver: RB-SOR / spectral split-step / periodic topology\n");
    printf("  [%c] SIMULATION ACTIVE                         Ctrl-C to exit\n",
           "|/-\\"[(r->tick / 3) % 4]);
    if (terminal) fputs("\033[0m\033[J", stdout);
    fflush(stdout);
}

static void stop(int signal_number) { (void)signal_number; running = 0; }

int main(int argc, char **argv) {
    bool once = argc == 2 && strcmp(argv[1], "--once") == 0;
    if (argc > 1 && !once) {
        fprintf(stderr, "Usage: %s [--once]\n", argv[0]);
        return EXIT_FAILURE;
    }
    bool terminal = isatty(STDOUT_FILENO) != 0;
    Resonator r = { .rng = UINT64_C(0xd1b54a32d192ed03) };
    for (int i = 0; i < PARTICLES; ++i) {
        r.particles[i] = (Quasiparticle){
            .q = { uniform(&r) * NX, uniform(&r) * NY },
            .p = { (uniform(&r) - 0.5) * 0.7, (uniform(&r) - 0.5) * 0.7 },
            .charge = (i & 1) ? 1.0 : -1.0,
            .phase = uniform(&r) * TAU
        };
    }
    for (int i = 0; i < MODES; ++i)
        r.amplitude[i] = (0.5 + 0.3 * cos(TAU * i / MODES)) *
                         cexp(I * (TAU * 3 * i / MODES + 0.2 * uniform(&r)));
    signal(SIGINT, stop);
    signal(SIGTERM, stop);
    if (terminal) fputs("\033[?1049h\033[?25l\033[2J", stdout);
    do {
        advance(&r);
        render(&r, terminal);
        if (once || !terminal) break;
        struct timespec delay = { .tv_sec = 0, .tv_nsec = 45000000 };
        nanosleep(&delay, NULL);
    } while (running);
    if (terminal) fputs("\033[0m\033[?25h\033[?1049l", stdout);
    return EXIT_SUCCESS;
}
