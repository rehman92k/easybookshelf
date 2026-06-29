-- Table was renamed in 20250618190000_otp_channel; PostgreSQL keeps old constraint names.
ALTER TABLE "otp_challenges" RENAME CONSTRAINT "phone_otp_challenges_pkey" TO "otp_challenges_pkey";
ALTER TABLE "otp_challenges" RENAME CONSTRAINT "phone_otp_challenges_user_id_fkey" TO "otp_challenges_user_id_fkey";
ALTER TABLE "otp_challenges" ALTER COLUMN "channel" DROP DEFAULT;
