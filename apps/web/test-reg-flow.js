
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const phone = '+18199885685';
        const cuit = '20123456780';

        console.log('--- TEST: Mock Registration Flow ---');

        // 1. Check existing org
        const existingOrg = await prisma.organization.findFirst({
            where: { settings: { path: ['cuit'], equals: cuit } }
        });
        console.log('1. Existing org check:', !!existingOrg);

        // 2. Check existing user
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { phone: phone },
                    { phone: { contains: phone.slice(-10) } }
                ]
            }
        });
        console.log('2. Existing user check:', !!existingUser);

        // 3. Upsert pending registration
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        const pending = await prisma.pendingRegistration.upsert({
            where: { phone: phone },
            update: { cuit, businessName: 'Test Biz', adminName: 'Test Admin', expiresAt },
            create: { phone, cuit, businessName: 'Test Biz', adminName: 'Test Admin', expiresAt }
        });
        console.log('3. Upsert pending SUCCESS:', pending.id);

        // 4. Create OTP
        const otp = await prisma.otpCode.create({
            data: {
                phone: phone,
                codeHash: 'somehash',
                expiresAt,
                attempts: 0,
                verified: false
            }
        });
        console.log('4. Create OTP SUCCESS:', otp.id);

        process.exit(0);
    } catch (error) {
        console.error('REGISTRATION MOCK ERROR:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
