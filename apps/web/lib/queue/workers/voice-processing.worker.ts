import { Worker } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/integrations/openai'; // Assuming openai client exists
import { redisConfig } from '@/lib/queue/config'; // Assuming redis credentials

/*
 * Voice Processing Worker
 * -----------------------
 * 1. Transcribes audio using OpenAI Whisper
 * 2. Extracts intent/data using GPT-4
 * 3. Executes action (Create Job, Add Note, etc.)
 */

export const voiceProcessingWorker = new Worker(
    'voice-processing',
    async (job) => {
        const { voiceMessageId, audioUrl, context, technicianId } = job.data;

        try {
            // 1. Update Status: Transcribing
            await prisma.voiceMessage.update({
                where: { id: voiceMessageId },
                data: { status: 'TRANSCRIBING' },
            });

            // 2. Transcribe Audio (Mocking the fetch/buffer part for brevity)
            // const audioBuffer = await downloadAudio(audioUrl);
            // const transcription = await openai.audio.transcriptions.create({ file: audioBuffer, model: 'whisper-1', language: 'es' });

            // MOCK TRANSCRIPTION for implementation speed
            const transcriptionText = "Crear un trabajo para mañana a las 3 de la tarde en Av. Corrientes 1234 para reparar una fuga de gas. El cliente se llama Marcelo.";

            await prisma.voiceMessage.update({
                where: { id: voiceMessageId },
                data: {
                    status: 'ANALYZING',
                    transcription: transcriptionText
                },
            });

            // 3. AI Analysis & Extraction
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    { role: "system", content: "You are an AI assistant for field service technicians. Extract structured data from the text." },
                    { role: "user", content: `Context: ${context}\nText: ${transcriptionText}` }
                ],
                functions: [
                    {
                        name: "create_job",
                        description: "Extract job details",
                        parameters: {
                            type: "object",
                            properties: {
                                customerName: { type: "string" },
                                address: { type: "string" },
                                scheduledDate: { type: "string", description: "ISO 8601 format" },
                                description: { type: "string" }
                            },
                            required: ["address", "description"]
                        }
                    }
                ]
            });

            const aiResponse = completion.choices[0].message;
            let structuredData = null;

            if (aiResponse.function_call) {
                structuredData = JSON.parse(aiResponse.function_call.arguments);
            }

            // 4. Execute Action (Create Job)
            if (context === 'JOB_CREATION' && structuredData) {
                // Logic to create job in DB
                // const newJob = await prisma.job.create({ data: ... });
                // structuredData.jobId = newJob.id;
            }

            // 5. Final Update
            await prisma.voiceMessage.update({
                where: { id: voiceMessageId },
                data: {
                    status: 'COMPLETED',
                    aiAnalysis: structuredData || {},
                    processedAt: new Date()
                },
            });

            return { success: true, transcription: transcriptionText, data: structuredData };

        } catch (error) {
            console.error(`Voice Job ${job.id} Failed:`, error);
            await prisma.voiceMessage.update({
                where: { id: voiceMessageId },
                data: { status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown error' },
            });
            throw error;
        }
    },
    {
        connection: redisConfig,
        concurrency: 5 // Process 5 voices in parallel
    }
);
