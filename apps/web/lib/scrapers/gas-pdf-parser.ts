/**
 * Gasnor/GasNEA PDF Parser
 * =========================
 * 
 * Phase 4.4: Growth Engine
 * 
 * Parses PDF files from gas distributor lists (Gasnor/GasNEA) to extract
 * gasista (gas technician) profiles.
 * 
 * Uses Python pdfplumber for accurate table extraction from PDFs.
 * The Python script handles all PDF parsing logic - this module handles:
 * - Calling the Python script with the PDF file
 * - Parsing the JSON output from Python
 * - Importing records into the database
 */

import { prisma } from '@/lib/prisma';

interface ParsedRecord {
    name: string;
    email: string | null;
    matricula: string;
    locality: string | null;
    province: string | null;
    phone: string | null;
    phones: string[];
    cuit: string | null;
    address: string | null;
    postalCode: string | null;
    type: string | null;
    typeDescription: string | null;
    validUntil: string | null;
    licenseExpiry: Date | null;
}

interface ImportResult {
    imported: number;
    updated: number;
    errors: number;
    total: number;
}

/**
 * Infer province from locality for GasNEA records
 */
function inferProvince(locality: string | null): string {
    if (!locality) return 'Corrientes';

    const loc = locality.toLowerCase();

    if (['villaguay', 'villa elisa', 'basavilbaso', 'concordia', 'colon',
        'federacion', 'federal', 'gualeguaychu', 'parana', 'diamante',
        'concepcion del uruguay', 'chajari', 'victoria', 'nogoya'].some(l => loc.includes(l))) {
        return 'Entre Ríos';
    }

    if (['resistencia', 'barranqueras', 'barraqueras', 'fontana', 'charata',
        'presidencia roque saenz peña', 'quitilipi', 'puerto tirol'].some(l => loc.includes(l))) {
        return 'Chaco';
    }

    if (['corrientes', 'goya', 'bella vista', 'esquina', 'paso de los libres',
        'monte caseros', 'san roque', 'empedrado', 'saladas', 'mburucuya'].some(l => loc.includes(l))) {
        return 'Corrientes';
    }

    if (['formosa', 'clorinda', 'pirane', 'el colorado', 'laguna blanca'].some(l => loc.includes(l))) {
        return 'Formosa';
    }

    if (['posadas', 'obera', 'eldorado', 'puerto iguazu', 'apostoles'].some(l => loc.includes(l))) {
        return 'Misiones';
    }

    return 'Corrientes';
}

/**
 * Import parsed records into the database
 */
export async function importGasRecords(
    records: ParsedRecord[],
    source: 'GASNOR' | 'GASNEA',
    sourceUrl?: string
): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const record of records) {
        try {
            if (!record.name || record.name.length < 3) {
                errors++;
                continue;
            }

            const province = record.province || inferProvince(record.locality);

            const existing = await prisma.unclaimedProfile.findFirst({
                where: {
                    source: source as never,
                    matricula: record.matricula,
                },
            });

            if (existing) {
                await prisma.unclaimedProfile.update({
                    where: { id: existing.id },
                    data: {
                        fullName: record.name,
                        phone: record.phone || existing.phone,
                        phones: record.phones.length > 0 ? record.phones : existing.phones,
                        email: record.email || existing.email,
                        cuit: record.cuit || existing.cuit,
                        city: record.locality || existing.city,
                        province,
                        address: record.address || existing.address,
                        postalCode: record.postalCode || existing.postalCode,
                        category: record.type || existing.category,
                        categoryDesc: record.typeDescription || existing.categoryDesc,
                        licenseExpiry: record.licenseExpiry || existing.licenseExpiry,
                        scrapedAt: new Date(),
                    },
                });
                updated++;
            } else {
                await prisma.unclaimedProfile.create({
                    data: {
                        source: source as never,
                        sourceUrl: sourceUrl || `pdf_import_${source}`,
                        fullName: record.name,
                        matricula: record.matricula,
                        phone: record.phone,
                        phones: record.phones,
                        email: record.email,
                        cuit: record.cuit,
                        profession: 'Gasista',
                        city: record.locality,
                        province,
                        address: record.address,
                        postalCode: record.postalCode,
                        category: record.type,
                        categoryDesc: record.typeDescription,
                        licenseExpiry: record.licenseExpiry,
                        scrapedAt: new Date(),
                    },
                });
                imported++;
            }
        } catch (error) {
            console.error(`[GasPDFParser] Error importing ${record.name}:`, error);
            errors++;
        }
    }

    console.log(`[GasPDFParser] Import complete: ${imported} new, ${updated} updated, ${errors} errors`);

    return { imported, updated, errors, total: records.length };
}

/**
 * Main PDF parser class
 */
export class GasPDFParser {
    async parseFromBase64(
        base64Content: string,
        source: 'GASNOR' | 'GASNEA',
        sourceUrl?: string
    ): Promise<ImportResult> {
        const { spawn } = await import('child_process');
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');

        // Save PDF to temp file
        const buffer = Buffer.from(base64Content, 'base64');
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `gas_pdf_${Date.now()}.pdf`);

        await fs.writeFile(tempFile, buffer);
        console.log(`[GasPDFParser] Saved PDF to temp file: ${tempFile} (${buffer.length} bytes)`);

        // Try multiple paths to find the Python script
        const possiblePaths = [
            // Path 1: From cwd which is apps/web in Next.js dev mode
            path.join(process.cwd(), 'scripts', 'parse-gas-pdf.py'),
            // Path 2: From monorepo root (if cwd is the monorepo root)
            path.join(process.cwd(), 'apps', 'web', 'scripts', 'parse-gas-pdf.py'),
            // Path 3: Relative to this file's compiled location
            path.join(__dirname, '..', '..', 'scripts', 'parse-gas-pdf.py'),
        ];

        let actualScriptPath: string | null = null;
        for (const testPath of possiblePaths) {
            try {
                await fs.access(testPath);
                actualScriptPath = testPath;
                console.log(`[GasPDFParser] Found script at: ${testPath}`);
                break;
            } catch {
                console.log(`[GasPDFParser] Script not at: ${testPath}`);
            }
        }

        if (!actualScriptPath) {
            await fs.unlink(tempFile).catch(() => { });
            throw new Error(`Python script not found. Tried paths:\n${possiblePaths.join('\n')}`);
        }

        const formatHint = source === 'GASNOR' ? 'gasnor' : source === 'GASNEA' ? 'gasnea' : 'auto';
        console.log(`[GasPDFParser] Calling Python script: ${actualScriptPath} with format: ${formatHint}`);

        try {
            const result = await new Promise<string>((resolve, reject) => {
                const pythonProcess = spawn('python', [actualScriptPath!, tempFile, '--format', formatHint]);

                let stdout = '';
                let stderr = '';

                pythonProcess.stdout.on('data', (data: Buffer) => {
                    stdout += data.toString();
                });

                pythonProcess.stderr.on('data', (data: Buffer) => {
                    stderr += data.toString();
                    console.log(`[GasPDFParser] Python: ${data.toString().trim()}`);
                });

                pythonProcess.on('close', (code: number | null) => {
                    fs.unlink(tempFile).catch(() => { });

                    if (code !== 0) {
                        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
                    } else {
                        resolve(stdout);
                    }
                });

                pythonProcess.on('error', (err: Error) => {
                    fs.unlink(tempFile).catch(() => { });
                    reject(new Error(`Failed to start Python: ${err.message}. Make sure Python and pdfplumber are installed.`));
                });
            });

            // Parse JSON output from Python
            let pythonRecords: Array<{
                matricula: string;
                fullName: string;
                category: string | null;
                categoryDesc: string | null;
                address: string | null;
                postalCode?: string | null;
                city: string | null;
                province: string | null;
                phone: string | null;
                phones: string[];
                email: string | null;
                cuit: string | null;
                licenseExpiry?: string | null;
                source: string;
            }>;

            try {
                pythonRecords = JSON.parse(result);
            } catch {
                console.error('[GasPDFParser] Failed to parse Python output:', result.substring(0, 500));
                throw new Error('Failed to parse Python script output');
            }

            if ('error' in pythonRecords) {
                throw new Error((pythonRecords as unknown as { error: string }).error);
            }

            console.log(`[GasPDFParser] Python parsed ${pythonRecords.length} records`);

            // Convert to ParsedRecord format
            const records: ParsedRecord[] = pythonRecords.map(r => ({
                name: r.fullName,
                email: r.email,
                matricula: r.matricula,
                locality: r.city,
                province: r.province,
                phone: r.phone,
                phones: r.phones || [],
                cuit: r.cuit,
                address: r.address,
                postalCode: r.postalCode || null,
                type: r.category,
                typeDescription: r.categoryDesc,
                validUntil: r.licenseExpiry || null,
                licenseExpiry: r.licenseExpiry ? new Date(r.licenseExpiry) : null,
            }));

            console.log(`[GasPDFParser] Converted ${records.length} records for import`);

            if (records.length > 0) {
                console.log('[GasPDFParser] Sample records:', JSON.stringify(records.slice(0, 3), null, 2));
            }

            return importGasRecords(records, source, sourceUrl);
        } catch (error) {
            console.error('[GasPDFParser] Error parsing PDF:', error);
            throw error;
        }
    }

    async parseFromFile(
        filePath: string,
        source: 'GASNOR' | 'GASNEA'
    ): Promise<ImportResult> {
        const fs = await import('fs/promises');
        const buffer = await fs.readFile(filePath);
        const base64 = buffer.toString('base64');
        return this.parseFromBase64(base64, source, filePath);
    }

    async importManual(
        records: ParsedRecord[],
        source: 'GASNOR' | 'GASNEA'
    ): Promise<ImportResult> {
        return importGasRecords(records, source, 'manual_import');
    }
}

// Singleton instance
let parserInstance: GasPDFParser | null = null;

export function getGasPDFParser(): GasPDFParser {
    if (!parserInstance) {
        parserInstance = new GasPDFParser();
    }
    return parserInstance;
}

export default GasPDFParser;
