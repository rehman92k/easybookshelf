# Super Admin setup

## Bootstrap script (recommended)

Creates or updates the Firebase user, grants **only** `super_admin` in Postgres, and clears OTP verification so the next admin sign-in requires a code.

```bash
# Requires --phone or SUPER_ADMIN_PHONE in apps/api/.env (needed for SMS OTP option)
pnpm dev:create-super-admin -- --phone=9876543210

# Custom credentials
pnpm dev:create-super-admin -- --email=you@example.com --password=YourPassword --phone=9876543210
```

Requires `apps/api/.env` with Firebase Admin credentials and `DATABASE_URL`. With `PHONE_OTP_DEV_MODE=true`, use the code from the API console (default `123456`).

Sign in at http://localhost:3002/login — password first, then OTP (email or mobile).

## Manual SQL (alternative)

```sql
SELECT id, email, display_name FROM users;

INSERT INTO user_roles (id, user_id, role, scope_type, permissions, created_at)
VALUES (
  gen_random_uuid(),
  'USER_ID_HERE',
  'super_admin',
  'global',
  '{}',
  NOW()
)
ON CONFLICT DO NOTHING;
```

Admin portal: http://localhost:3002/users
