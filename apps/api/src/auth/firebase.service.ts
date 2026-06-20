import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    try {
      if (getApps().length) {
        this.initialized = true;
        return;
      }

      const serviceAccountPath = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
      if (serviceAccountPath) {
        const absolutePath = resolve(process.cwd(), serviceAccountPath);
        const serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf8')) as {
          project_id: string;
          client_email: string;
          private_key: string;
        };

        initializeApp({
          credential: cert({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: serviceAccount.private_key,
          }),
        });

        this.initialized = true;
        this.logger.log(`Firebase Admin initialized from ${serviceAccountPath}`);
        return;
      }

      const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn(
          'Firebase not configured — set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_* env vars in apps/api/.env',
        );
        return;
      }

      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });

      this.initialized = true;
      this.logger.log('Firebase Admin initialized');
    } catch (error) {
      this.logger.error(
        `Firebase init failed: ${error instanceof Error ? error.message : 'unknown error'}. ` +
          'Tip: use FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json instead of FIREBASE_PRIVATE_KEY.',
      );
    }
  }

  isConfigured(): boolean {
    return this.initialized;
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.initialized) {
      throw new Error('Firebase is not configured on the server');
    }
    return getAuth().verifyIdToken(idToken);
  }
}
