# Firebase Authentication Setup (M4)

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project (e.g. `easybookshelf`)
3. Enable **Authentication** → Sign-in methods:
   - **Google**
   - **Email/Password**
   - **Phone** (for OTP)

## 2. Web app (Reader — port 3000)

1. Firebase Console → Project Settings → **Your apps** → Add **Web** app
2. Copy config values to `apps/web-reader/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

3. Authentication → Settings → **Authorized domains** → add `localhost`

## 3. Server (API — port 4000)

1. Firebase Console → Project Settings → **Service accounts**
2. Click **Generate new private key** (downloads JSON)
3. Add to `apps/api/.env`:

```env
JWT_SECRET=your-long-random-secret
JWT_ACCESS_EXPIRES_SECONDS=900
JWT_REFRESH_EXPIRES_DAYS=30

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> Keep the private key in quotes. Use `\n` for line breaks.

## 4. Test the flow

```bash
# Terminal 1 — API
corepack pnpm dev:api

# Terminal 2 — Reader web
corepack pnpm dev:reader
```

1. Open http://localhost:3000/login
2. Sign in with Google or email
3. User is created in PostgreSQL (`users` + `user_roles`)
4. Check in pgAdmin: `SELECT * FROM users;`

## API endpoints

| Method | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/auth/login` | Public — body: `{ "idToken": "..." }` |
| POST | `/api/v1/auth/refresh` | Public — uses refresh cookie |
| POST | `/api/v1/auth/logout` | Bearer token |
| GET | `/api/v1/auth/me` | Bearer token |
| GET | `/api/v1/auth/sessions` | Bearer token |
| DELETE | `/api/v1/auth/sessions/:id` | Bearer token |

## Swagger

Test with docs at http://localhost:4000/docs (use **Authorize** with Bearer token after login).
