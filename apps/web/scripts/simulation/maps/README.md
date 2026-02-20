# 🗺️ Maps & Dispatch Simulation

Simulate the full maps ecosystem: dispatch recommendations (within-org), marketplace nearest search (cross-org), and technician itinerary optimization.

## 🚀 Quick Start

```bash
# 1. Seed 10 fake organizations with technicians across Buenos Aires
pnpm tsx scripts/simulation/maps/seed-map-orgs.ts

# 2. Run the full simulation (dispatches + marketplace + itineraries)
pnpm tsx scripts/simulation/maps/run-simulation.ts

# 3. View the generated report
#    → Output: scripts/simulation/maps/reports/simulation-report-YYYY-MM-DD.md

# Clean up simulation data when done
pnpm tsx scripts/simulation/maps/seed-map-orgs.ts --clean
```

## 📊 What It Tests

### 1. Dispatch Recommendations (Within-Org)
For each org that has 2+ technicians, simulates dispatching jobs to different locations and checks:
- Is the algorithm choosing the closest tech by real ETA?
- Does traffic context (rush hour) change the recommendation?
- Does the scoring formula balance proximity vs. availability vs. skills?

### 2. Marketplace Nearest (Cross-Org)
Simulates a consumer searching for the nearest plomero, electricista, etc. and checks:
- Are organizations ranked by real ETA, not Haversine?
- Does specialty filtering work correctly?
- Are only marketplace-visible orgs returned?

### 3. Technician Itinerary
Given a technician with 3-5 assigned jobs, simulates the optimal visit order and checks:
- Is the suggested route truly the shortest total travel time?
- Does it account for scheduled times vs. flexible ordering?

## 🏢 Organizations Seeded

| # | Name | Zone | Workers | Specialties |
|---|------|------|---------|-------------|
| 1 | García Plomería | Palermo | 1 (solo owner) | PLOMERO |
| 2 | ElectroSur | Avellaneda | 1 (solo owner) | ELECTRICISTA |
| 3 | FríoTech HVAC | Belgrano | 3 (owner + 2 techs) | REFRIGERACION |
| 4 | AquaServ BA | San Telmo | 1 (solo owner) | PLOMERO |
| 5 | Instalaciones Martínez | Caballito | 2 (owner + 1 tech) | GASISTA, PLOMERO |
| 6 | TecnoClima Norte | Vicente López | 1 (solo owner) | REFRIGERACION |
| 7 | Servicios Eléctricos Ramos | Flores | 4 (owner + admin + 2 techs) | ELECTRICISTA |
| 8 | MultiServ del Oeste | Morón | 1 (solo owner) | PLOMERO, ELECTRICISTA |
| 9 | Cañerías Express | Recoleta | 1 (solo owner) | PLOMERO |
| 10 | SurGas Instalaciones | Quilmes | 2 (owner + 1 tech) | GASISTA |

## 📈 Scale Testing

Increase variables in `config.ts`:

```typescript
export const SIM_CONFIG = {
  orgCount: 10,          // Start: 10, Scale: 50, 100
  jobsPerScenario: 3,    // Start: 3, Scale: 10, 25
  marketplaceSearches: 5, // Start: 5, Scale: 20, 50
  includeRushHour: true,
  includeMultiModal: true,
};
```

## 📁 Structure

```
maps/
├── README.md               # This file
├── config.ts               # Simulation parameters
├── seed-map-orgs.ts        # Creates 10 fake orgs with locations
├── run-simulation.ts       # Runs dispatch + marketplace + itinerary
├── report-generator.ts     # Generates markdown comparison report
└── reports/                # Generated reports (gitignored)
```
