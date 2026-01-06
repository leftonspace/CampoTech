-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "afip_certificate_encrypted" TEXT,
ADD COLUMN     "afip_connected_at" TIMESTAMP(3),
ADD COLUMN     "afip_cuit" TEXT,
ADD COLUMN     "afip_environment" TEXT,
ADD COLUMN     "afip_private_key_encrypted" TEXT,
ADD COLUMN     "afip_punto_venta" TEXT;
