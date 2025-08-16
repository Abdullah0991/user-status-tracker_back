// src/routes/users.ts
import express, { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import {
    AuthenticatedRequest,
    CreateUserRequest,
    UpdateStatusRequest,
    UpdateUserRequest,
    UserResponse
} from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to check if user is admin
const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if ((req as AuthenticatedRequest).user.role !== 'ADMIN') {
        res.status(403).json({ message: 'Access denied' });
        return;
    }
    next();
};

// Middleware to check if user can update status (only regular users)
const canUpdateStatus = (req: Request, res: Response, next: NextFunction): void => {
    if ((req as AuthenticatedRequest).user.role === 'ADMIN') {
        res.status(403).json({ message: 'Admin users cannot set status' });
        return;
    }
    next();
};

// Get all users (Admin only)
router.get('/',
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    async (req: Request, res: Response<UserResponse[] | { message: string }>) => {
        try {
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            res.json(users as unknown as UserResponse[]);
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Update user status (Only for regular users)
router.put('/status',
    passport.authenticate('jwt', { session: false }),
    canUpdateStatus,
    async (req: Request<{}, UserResponse, UpdateStatusRequest>, res: Response<UserResponse | { message: string }>) => {
        const authenticatedReq = req as AuthenticatedRequest;
        try {
            const { status } = req.body;

            const user = await prisma.user.update({
                where: { id: authenticatedReq.user.id },
                data: { status },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    status: true
                }
            });

            res.json(user as UserResponse);
        } catch (error) {
            console.error('Update status error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Create user (Admin only)
router.post('/',
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    async (req: Request<{}, UserResponse, CreateUserRequest>, res: Response<UserResponse | { message: string }>) => {
        try {
            const { email, password, name, role } = req.body;

            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res.status(400).json({ message: 'User with this email already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            // Set initial status only for regular users
            const userData: any = {
                email,
                password: hashedPassword,
                name,
                role
            };

            if (role === 'USER') {
                userData.status = 'AVAILABLE_NO_TASK';
            }
            // For ADMIN users, status remains null

            const user = await prisma.user.create({
                data: userData,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            res.status(201).json(user as unknown as UserResponse);
        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Update user (Admin only)
router.put('/:id',
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    async (req: Request<{ id: string }, UserResponse, UpdateUserRequest & {
        password?: string
    }>, res: Response<UserResponse | { message: string }>) => {
        try {
            const { id } = req.params;
            const { name, email, role, status, password } = req.body;

            const updateData: any = { name, email, role };

            // Only set status for regular users
            if (role === 'USER') {
                updateData.status = status || 'AVAILABLE_NO_TASK';
            } else if (role === 'ADMIN') {
                updateData.status = null; // Clear status for admin users
            }

            // Only update password if provided
            if (password && password.trim()) {
                updateData.password = await bcrypt.hash(password, 10);
            }

            const user = await prisma.user.update({
                where: { id },
                data: updateData,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            res.json(user as unknown as UserResponse);
        } catch (error) {
            console.error('Update user error:', error);
            if (error instanceof Error && error.message.includes('Record to update not found')) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Delete user (Admin only)
router.delete('/:id',
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    async (req: Request<{ id: string }>, res: Response<{ message: string }>) => {
        try {
            const { id } = req.params;

            await prisma.user.delete({ where: { id } });
            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error('Delete user error:', error);
            if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.status(500).json({ message: 'Server error' });
        }
    }
);

export default router;