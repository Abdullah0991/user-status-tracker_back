// src/types/index.ts
import { Request } from 'express';
import { Role, Status } from '@prisma/client';

export interface UserResponse {
    id: string;
    email: string;
    name: string;
    role: Role;
    status: Status | null; // Make status nullable
    createdAt?: string;
    updatedAt?: string;
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
    status?: Status | null; // Allow null for admin users
}

export interface ChartDataPoint {
    status: string;
    count: number;
    percentage: number;
    color: string;
}

export interface AvailabilityDataPoint {
    name: string;
    value: number;
    percentage: number;
    color: string;
}

export interface DashboardStats {
    totalUsers: number;
    totalRegularUsers: number; // Only count users with status
    stats: {
        [key in Status]?: {
            count: number;
            percentage: string;
        };
    };
    statusDistributionBar: ChartDataPoint[];
    availabilityDistribution: AvailabilityDataPoint[];
}

export interface AuthenticatedRequest extends Request {
    user: UserResponse;
}