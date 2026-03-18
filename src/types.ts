export interface User {
  uid: string;
  displayName: string;
  email: string;
  id4: string;
  role: 'CEO' | 'Leader' | 'User';
  isPro?: boolean;
  photoURL?: string;
}

export interface Message {
  id?: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
}

export interface Friendship {
  id?: string;
  user1: string;
  user2: string;
  status: 'pending' | 'accepted';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
