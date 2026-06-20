-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "phone_otp_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_otp_challenges_user_id_phone_idx" ON "phone_otp_challenges"("user_id", "phone");

-- AddForeignKey
ALTER TABLE "phone_otp_challenges" ADD CONSTRAINT "phone_otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mark existing users with a phone as verified so they are not locked out
UPDATE "users" SET "phone_verified_at" = NOW() WHERE "phone" IS NOT NULL AND "phone_verified_at" IS NULL;
