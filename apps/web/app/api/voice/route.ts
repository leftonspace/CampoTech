import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod'; // Assuming zod is used for validation
import { prisma } from '@/lib/prisma'; // Assuming prisma client location
import { dispatch } from '@/lib/queue'; // Use the new dispatcher

// Schema for Voice Upload
const voiceUploadSchema = z.object({
    audio: z.any(), // File validation would be more specific in a real implementation
    technicianId: z.string(),
    context: z.enum(['JOB_CREATION', 'JOB_NOTE', 'CUSTOMER_REPLY']).optional().default('JOB_CREATION'),
    referenceId: z.string().optional(), // e.g. Job ID if adding a note
});

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;
        const technicianId = formData.get('technicianId') as string;
        const context = formData.get('context') as string || 'JOB_CREATION';
        const referenceId = formData.get('referenceId') as string | undefined;

        if (!audioFile) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        // 1. Upload to Storage (e.g., Supabase/S3)
        // const uploadPath = `voice/${technicianId}/${Date.now()}_${audioFile.name}`;
        // const { path, error: uploadError } = await supabase.storage.from('voice-messages').upload(uploadPath, audioFile);

        // MOCK: Generate a fake URL
        const storageUrl = `https://storage.campotech.com/voice/${technicianId}/${Date.now()}.ogg`;

        // 2. Create Database Record
        const voiceRecord = await prisma.voiceMessage.create({
            data: {
                url: storageUrl,
                technicianId,
                context,
                referenceId,
                status: 'PROCESSING', // Initial status
                metadata: {
                    originalName: audioFile.name,
                    size: audioFile.size,
                    mimeType: audioFile.type,
                }
            },
        });

        // 3. Enqueue for Processing (Voice AI Worker)
        await dispatch('voice.transcribe', {
            audioUrl: storageUrl,
            organizationId: voiceRecord.organizationId,
            messageId: voiceRecord.id, // Fixed mapping
        }, {
            priority: 1, // High priority for user interaction
            maxRetries: 3,
        });

        return NextResponse.json({
            success: true,
            data: {
                id: voiceRecord.id,
                status: 'PROCESSING',
                message: 'Audio received and queued for transcription.',
            },
        });

    } catch (error) {
        console.error('Voice API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
