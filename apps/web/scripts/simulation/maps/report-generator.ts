/**
 * Report Generator
 * ================
 *
 * Generates a detailed Markdown report from simulation results.
 * Output: scripts/simulation/maps/reports/simulation-report-YYYY-MM-DD.md
 */

import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES (imported inline to avoid circular dependencies)
// ═══════════════════════════════════════════════════════════════════════════════

interface MarketplaceResult {
    scenario: string;
    category: string | undefined;
    searchLocation: { lat: number; lng: number };
    totalCandidates: number;
    topResults: Array<{
        rank: number;
        orgName: string;
        etaMinutes: number;
        distanceKm: number;
        isRealEta: boolean;
        haversineKm: number;
        rating: number;
        reviewCount: number;
    }>;
    traffic: {
        isRushHour: boolean;
        modeRecommendation: string | null;
    };
    expectation: string;
    passed: boolean | null;
    responseTimeMs: number;
    error?: string;
}

interface DispatchResult {
    orgName: string;
    jobLabel: string;
    jobLocation: { lat: number; lng: number };
    recommendations: Array<{
        rank: number;
        techName: string;
        etaMinutes: number;
        distanceKm: number;
        score: number;
        isRealEta: boolean;
        confidence: string;
        reasons: string[];
        warnings: string[];
    }>;
    traffic: {
        isRushHour: boolean;
    };
    responseTimeMs: number;
    error?: string;
}

interface ItineraryResult {
    techName: string;
    orgName: string;
    startLocation: { lat: number; lng: number };
    jobs: Array<{
        visitOrder: number;
        label: string;
        location: { lat: number; lng: number };
        etaFromPrevious: number;
        cumulativeEta: number;
    }>;
    totalTravelMinutes: number;
    naiveTotalMinutes: number;
    optimizationGainPercent: number;
    error?: string;
}

interface SimulationResults {
    timestamp: string;
    config: Record<string, unknown>;
    marketplace: MarketplaceResult[];
    dispatch: DispatchResult[];
    itinerary: ItineraryResult[];
    summary: {
        totalApiCalls: number;
        totalTimeMs: number;
        marketplacePassRate: string;
        avgMarketplaceResponseMs: number;
        avgDispatchResponseMs: number;
        itineraryOptimizationAvg: string;
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateReport(results: SimulationResults): Promise<string> {
    const date = new Date().toISOString().split('T')[0];
    const reportDir = path.resolve(process.cwd(), 'scripts/simulation/maps/reports');
    const reportFileName = `simulation-report-${date}.md`;
    const reportPath = path.join(reportDir, reportFileName);

    // Ensure reports directory exists
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const lines: string[] = [];

    // ─── Header ────────────────────────────────────────────────────────────
    lines.push(`# 🗺️ Maps Simulation Report`);
    lines.push(`**Fecha:** ${new Date(results.timestamp).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`);
    lines.push('');

    // ─── Summary Dashboard ─────────────────────────────────────────────────
    lines.push('## 📊 Resumen General');
    lines.push('');
    lines.push('| Métrica | Valor |');
    lines.push('|:--------|------:|');
    lines.push(`| Búsquedas marketplace | ${results.marketplace.length} |`);
    lines.push(`| Tests dispatch | ${results.dispatch.length} |`);
    lines.push(`| Tests itinerario | ${results.itinerary.length} |`);
    lines.push(`| Calls API totales | ${results.summary.totalApiCalls} |`);
    lines.push(`| Tiempo total | ${(results.summary.totalTimeMs / 1000).toFixed(1)}s |`);
    lines.push(`| Marketplace éxito | ${results.summary.marketplacePassRate} |`);
    lines.push(`| Avg response marketplace | ${results.summary.avgMarketplaceResponseMs}ms |`);
    lines.push(`| Avg response dispatch | ${results.summary.avgDispatchResponseMs}ms |`);
    lines.push(`| Itinerary optimization avg | ${results.summary.itineraryOptimizationAvg} |`);
    lines.push('');

    // ─── Section 1: Marketplace ────────────────────────────────────────────
    lines.push('---');
    lines.push('');
    lines.push('## 🏪 1. Marketplace Nearest Search');
    lines.push('');
    lines.push('> Búsquedas simuladas desde distintos puntos de Buenos Aires.');
    lines.push('> El sistema debería ordenar por ETA real (tráfico) y no por distancia lineal.');
    lines.push('');

    for (const result of results.marketplace) {
        lines.push(`### 📍 ${result.scenario}`);
        if (result.category) {
            lines.push(`**Categoría:** ${result.category}`);
        }
        lines.push(`**Ubicación:** (${result.searchLocation.lat}, ${result.searchLocation.lng})`);
        lines.push(`**Candidatos encontrados:** ${result.totalCandidates}`);
        lines.push(`**Tiempo de respuesta:** ${result.responseTimeMs}ms`);
        lines.push('');

        if (result.error) {
            lines.push(`> ❌ **Error:** ${result.error}`);
            lines.push('');
            continue;
        }

        // Results table
        if (result.topResults.length > 0) {
            lines.push('| # | Organización | ETA | Dist. real | Haversine | Real? | ⭐ | Reviews |');
            lines.push('|:-:|:-------------|----:|----------:|----------:|:-----:|---:|--------:|');
            for (const r of result.topResults) {
                const eta = r.isRealEta ? `**${r.etaMinutes} min**` : `~${r.etaMinutes} min`;
                lines.push(
                    `| ${r.rank} | ${r.orgName} | ${eta} | ${r.distanceKm} km | ${r.haversineKm} km | ${r.isRealEta ? '✅' : '📐'} | ${r.rating.toFixed(1)} | ${r.reviewCount} |`
                );
            }
            lines.push('');
        }

        // Optimization analysis
        if (result.topResults.length >= 2) {
            const first = result.topResults[0];
            const second = result.topResults[1];
            const haversineWouldSwap = first.haversineKm > second.haversineKm &&
                first.etaMinutes <= second.etaMinutes;

            if (haversineWouldSwap) {
                lines.push(`> 🎯 **Optimización detectada:** ${first.orgName} tiene mayor distancia lineal (${first.haversineKm}km vs ${second.haversineKm}km) pero **menor ETA real** (${first.etaMinutes}min vs ${second.etaMinutes}min). El sistema priorizó correctamente por tráfico.`);
            }

            // Check haversine vs real distance discrepancy
            const discrepancy = first.distanceKm > 0 && first.haversineKm > 0
                ? Math.round(((first.distanceKm - first.haversineKm) / first.haversineKm) * 100)
                : 0;
            if (discrepancy > 20) {
                lines.push(`> 📊 **Discrepancia carretera vs línea recta:** ${discrepancy}% para ${first.orgName} — la distancia real por ruta es significativamente mayor que la distancia Haversine.`);
            }
            lines.push('');
        }

        // Traffic context
        if (result.traffic.isRushHour) {
            lines.push(`> 🚗 **Hora pico detectada** — los ETAs reflejan congestión.`);
            if (result.traffic.modeRecommendation) {
                lines.push(`> 🏍️ **Recomendación:** ${result.traffic.modeRecommendation}`);
            }
            lines.push('');
        }

        // Expectation
        lines.push(`> 💡 **Expectativa:** ${result.expectation}`);
        lines.push('');
    }

    // ─── Section 2: Dispatch ───────────────────────────────────────────────
    lines.push('---');
    lines.push('');
    lines.push('## ⚡ 2. Dispatch Recommendations (Within-Org)');
    lines.push('');
    lines.push('> Para cada organización con 2+ técnicos, se simularon despachos');
    lines.push('> a distintas ubicaciones y se evaluó el scoring de recomendación.');
    lines.push('');

    // Group by org
    const dispatchByOrg = new Map<string, DispatchResult[]>();
    for (const d of results.dispatch) {
        if (!dispatchByOrg.has(d.orgName)) {
            dispatchByOrg.set(d.orgName, []);
        }
        dispatchByOrg.get(d.orgName)!.push(d);
    }

    for (const [orgName, dispatches] of dispatchByOrg) {
        lines.push(`### 🏢 ${orgName}`);
        lines.push('');

        for (const d of dispatches) {
            lines.push(`#### 📍 ${d.jobLabel}`);
            lines.push(`**Ubicación:** (${d.jobLocation.lat}, ${d.jobLocation.lng})`);
            lines.push('');

            if (d.error) {
                lines.push(`> ❌ **Error:** ${d.error}`);
                lines.push('');
                continue;
            }

            if (d.recommendations.length > 0) {
                lines.push('| # | Técnico | Dist. | ETA | Score | Confianza | Razones |');
                lines.push('|:-:|:--------|------:|----:|------:|:---------:|:--------|');
                for (const r of d.recommendations) {
                    lines.push(
                        `| ${r.rank} | ${r.techName} | ${r.distanceKm} km | ~${r.etaMinutes} min | ${r.score} | ${r.confidence} | ${r.reasons.join('; ')} |`
                    );
                }
                lines.push('');

                // Analysis: did closest-by-distance also rank highest?
                const closestByDist = [...d.recommendations].sort((a, b) => a.distanceKm - b.distanceKm);
                if (closestByDist[0]?.techName !== d.recommendations[0]?.techName) {
                    lines.push(`> 🔄 **Nota:** El más cercano por distancia (${closestByDist[0].techName}, ${closestByDist[0].distanceKm}km) NO es el recomendado #1 (${d.recommendations[0].techName}, score: ${d.recommendations[0].score}). El scoring multifactor priorizó otros factores.`);
                    lines.push('');
                }
            }
        }
    }

    // ─── Section 3: Itinerary ─────────────────────────────────────────────
    lines.push('---');
    lines.push('');
    lines.push('## 🗺️ 3. Itinerary Optimization');
    lines.push('');
    lines.push('> Comparación entre el orden naïve (como llegan los trabajos) vs.');
    lines.push('> el orden optimizado (nearest-neighbor greedy algorithm).');
    lines.push('');

    if (results.itinerary.length > 0) {
        // Summary table
        lines.push('### Resumen');
        lines.push('');
        lines.push('| Técnico | Organización | Naïve | Optimizado | Mejora |');
        lines.push('|:--------|:-------------|------:|-----------:|-------:|');
        for (const it of results.itinerary) {
            const emoji = it.optimizationGainPercent >= 20 ? '🟢' :
                it.optimizationGainPercent >= 10 ? '🟡' : '🔴';
            lines.push(
                `| ${it.techName} | ${it.orgName} | ${it.naiveTotalMinutes} min | ${it.totalTravelMinutes} min | ${emoji} ${it.optimizationGainPercent}% |`
            );
        }
        lines.push('');

        // Detailed routes
        for (const it of results.itinerary) {
            lines.push(`### 🧑‍🔧 ${it.techName} (${it.orgName})`);
            lines.push(`**Inicio:** (${it.startLocation.lat.toFixed(4)}, ${it.startLocation.lng.toFixed(4)})`);
            lines.push('');
            lines.push('**Ruta optimizada:**');
            lines.push('');
            lines.push('| Orden | Destino | +ETA | Acumulado |');
            lines.push('|:-----:|:--------|-----:|----------:|');
            for (const j of it.jobs) {
                lines.push(`| ${j.visitOrder} | ${j.label} | +${j.etaFromPrevious} min | ${j.cumulativeEta} min |`);
            }
            lines.push('');
            lines.push(`> **Total naïve:** ${it.naiveTotalMinutes} min → **Total optimizado:** ${it.totalTravelMinutes} min = **${it.optimizationGainPercent}% mejora**`);
            lines.push('');
        }
    }

    // ─── Section 4: Conclusions & Next Steps ──────────────────────────────
    lines.push('---');
    lines.push('');
    lines.push('## 🔬 4. Conclusiones y Próximos Pasos');
    lines.push('');
    lines.push('### ¿Está optimizando el sistema?');
    lines.push('');

    // Auto-generate insights
    const marketplaceSuccess = results.marketplace.filter((r) => !r.error).length;
    const marketplaceTotal = results.marketplace.length;
    const hasRealEta = results.marketplace.some((r) =>
        r.topResults.some((t) => t.isRealEta)
    );

    if (marketplaceSuccess === marketplaceTotal) {
        lines.push('- ✅ **Marketplace:** Todas las búsquedas retornaron resultados exitosamente.');
    } else {
        lines.push(`- ⚠️ **Marketplace:** ${marketplaceSuccess}/${marketplaceTotal} búsquedas exitosas.`);
    }

    if (hasRealEta) {
        lines.push('- ✅ **ETAs reales:** El Distance Matrix API está activo — los ETAs incluyen tráfico en vivo.');
    } else {
        lines.push('- 📐 **ETAs estimados:** Usando fallback Haversine — el Distance Matrix API no retornó datos de tráfico. Verificar `GOOGLE_MAPS_API_KEY`.');
    }

    const avgGain = results.itinerary.length > 0
        ? results.itinerary.reduce((s, r) => s + r.optimizationGainPercent, 0) / results.itinerary.length
        : 0;

    if (avgGain >= 15) {
        lines.push(`- ✅ **Itinerarios:** La optimización greedy mejora un ${Math.round(avgGain)}% en promedio sobre el orden naïve.`);
    } else if (avgGain > 0) {
        lines.push(`- 🟡 **Itinerarios:** Mejora de ${Math.round(avgGain)}% — marginal. Considerar algoritmo 2-opt o branch & bound para mejores resultados.`);
    } else {
        lines.push('- 🔴 **Itinerarios:** Sin mejora detectada — posiblemente los puntos ya estaban en buen orden.');
    }

    lines.push('');
    lines.push('### Próximos pasos para escalar');
    lines.push('');
    lines.push('1. **Aumentar orgs a 50-100** para real-world load testing');
    lines.push('2. **Activar Distance Matrix API** para ETAs con tráfico real');
    lines.push('3. **Simular hora pico** (8:00-9:30 AM) para verificar rush hour logic');
    lines.push('4. **Agregar tests de regresión** — si un cambio de código degrada los ETAs, flag it');
    lines.push('5. **Implementar 2-opt** para itinerarios con 10+ paradas');
    lines.push('');

    // ─── Configuration snapshot ────────────────────────────────────────────
    lines.push('---');
    lines.push('');
    lines.push('## ⚙️ Configuración Usada');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(results.config, null, 2));
    lines.push('```');
    lines.push('');

    // ─── Write report ─────────────────────────────────────────────────────
    const content = lines.join('\n');
    fs.writeFileSync(reportPath, content, 'utf-8');

    console.log(`\n📄 Report generated: ${reportPath}`);
    return reportFileName;
}
