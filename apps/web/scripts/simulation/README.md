# CampoTech Business Simulation

This folder contains scripts to generate realistic business data for testing and demos.

## 🚀 Quick Start

```bash
# Run the master simulation (creates all data)
npx tsx scripts/simulation/master-seed.ts

# Clean existing data first, then reseed
npx tsx scripts/simulation/master-seed.ts --clean
```

## 📁 Folder Structure

```
simulation/
├── master-seed.ts          # Main orchestrator - run this!
├── data/
│   ├── company-profile.ts  # Company config (org ID, size, etc.)
│   ├── technicians.ts      # Technician templates
│   ├── vehicles.ts         # Vehicle templates
│   ├── customers.ts        # Customer templates
│   └── job-templates.ts    # Service types & pricing
└── README.md               # This file
```

## ⚙️ Configuration

Edit `data/company-profile.ts` to change:

```typescript
export const DEFAULT_CONFIG: CompanyConfig = {
  // Your organization ID
  organizationId: 'cmkzp66wa000bpvvd805x5ewo',
  
  // Company size: 'small' | 'medium' | 'large'
  size: 'medium',
  
  // Other settings...
};
```

### Size Configurations

| Size    | Technicians | Vehicles | Customers | Jobs  |
|---------|-------------|----------|-----------|-------|
| Small   | 5           | 3        | 30        | 165   |
| Medium  | 15          | 8        | 100       | 540   |
| Large   | 40          | 20       | 300       | 1600  |

## 📊 Data Generated

### Phase 1: Team
- **Technicians** with:
  - Full profiles (specialties, certifications)
  - ENARGAS matriculas for gasistas
  - Driver's licenses
  - UOCRA levels
  - Vehicle assignments

- **Vehicles** with:
  - Plates, make, model, year
  - Insurance policies
  - VTV expiry dates
  - Mileage tracking

### Phase 2: Customers
- Mix of residential and commercial
- Buenos Aires addresses with lat/lng
- VIP flags
- Contact info

### Phase 3: Jobs
- Realistic distribution:
  - 60% Completed
  - 15% Invoiced  
  - 10% In Progress
  - 8% Assigned
  - 5% Pending
  - 2% Cancelled
- Proper relationships to customers & technicians
- Service types matching technician skills
- Price variations

## 🔧 Main 5 Technicians

The simulation includes these key team members:
1. **Alex Conta** - Refrigeración & Electricista
2. **Erik Rodríguez** - Electricista & Plomero
3. **Adara Esber** - Refrigeración
4. **Marcelo Gutiérrez** - Gasista & Plomero
5. **Mathieu Dupont** - Multi-trade

## 🧹 Cleaning Data

To reset all simulation data:

```bash
npx tsx scripts/simulation/master-seed.ts --clean
```

This deletes:
- All jobs
- All customers
- All technicians (except owner)
- All vehicles

Then re-seeds everything fresh.

## 📝 Legacy Scripts

The old individual scripts are still available but deprecated:
- `seed-technicians-vehicles.ts`
- `seed-customers.ts`
- `seed-jobs.ts`
- etc.

Use `master-seed.ts` instead for proper relationships.
