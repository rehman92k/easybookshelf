-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('phone', 'email');

-- RenameTable
ALTER TABLE "phone_otp_challenges" RENAME TO "otp_challenges";

-- AlterTable
ALTER TABLE "otp_challenges" ADD COLUMN "channel" "OtpChannel" NOT NULL DEFAULT 'phone';
ALTER TABLE "otp_challenges" RENAME COLUMN "phone" TO "destination";

-- DropIndex
DROP INDEX IF EXISTS "phone_otp_challenges_user_id_phone_idx";

-- CreateIndex
CREATE INDEX "otp_challenges_user_id_idx" ON "otp_challenges"("user_id");
