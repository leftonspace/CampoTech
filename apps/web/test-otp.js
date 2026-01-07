
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const otpCount = await prisma.otpCode.count();
        console.log('OTP count:', otpCount);

        process.exit(0);
    } catch (error) {
        console.error('OTP table ERROR:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
