// src/types/index.ts
import { Role, Status } from '@prisma/client';

export interface UserResponse {
    id: string;
    email: string;
    name: string;
    role: Role;
    status: Status;
}

export interface AuthResponse {
    token: string;
    user: UserResponse;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
    role?: Role;
}

export interface UpdateStatusRequest {
    status: Status;
}

export interface CreateUserRequest {
    email: string;
    password: string;
    name: string;
    role: Role;
}

export interface UpdateUserRequest {
    name?: string;
    email?: string;
    role?: Role;
    status?: Status;
}

export interface DashboardStats {
    totalUsers: number;
    stats: {
        [key in Status]?: {
            count: number;
            percentage: string;
        };
    };
}

export interface AuthenticatedRequest extends Request {
    user: UserResponse;
}