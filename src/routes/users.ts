// src/routes/users.ts
import express, { Request, Response } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role, Status } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to check if user is admin
const requireAdmin = (req: Request, res: Response, next: Function) => {
    const authenticatedReq = req as AuthenticatedRequest;
    if (authenticatedReq.user?.role !== Role.ADMIN) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Middleware to check if user can update status (only regular users)
const canUpdateStatus = (req: Request, res: Response, next: Function) => {
    const authenticatedReq = req as AuthenticatedRequest;
    if (authenticatedReq.user?.role !== Role.USER) {
        return res.status(403).json({ message: 'Only regular users can update status' });
    }
    next();
};

// Get all users (Admin only)
router.get('/',
    passport.authenticate('jwt', { session: false }),
    requireAdmin,
    async (req: Request, res: Response) => {
        try {
            const {
                search,
                role,
                status,
                page = '1',
                limit = '50',
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            // Build where clause
            const where: any = {};

            // Search filter
            if (search && typeof search === 'string' && search.trim()) {
                where.OR = [
                    {
                        name: {
                            contains: search.trim(),
                            mode: 'insensitive'
                        }
                    },
                    {
                        email: {
                            contains: search.trim(),
                            mode: 'insensitive'
                        }
                    }
                ];
            }

            // Role filter
            if (role && role !== 'ALL' && Object.values(Role).includes(role as Role)) {
                where.role = role as Role;
            }

            // Status filter
            if (status && status !== 'ALL') {
                if (status === 'NO_STATUS') {
                    where.status = null;
                } else if (Object.values(Status).includes(status as Status)) {
                    where.status = status as Status;
                }
            }

            // Pagination
            const pageNum = Math.max(1, parseInt(page as string) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
            const skip = (pageNum - 1) * limitNum;

            // Sort validation
            const validSortFields = ['name', 'email', 'role', 'status', 'createdAt', 'updatedAt'];
            const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'createdAt';
            const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc';

            // Execute queries
            const [users, totalCount] = await Promise.all([
                prisma.user.findMany({
                    where,
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true
                    },
                    orderBy: {
                        [sortField]: sortDirection
                    },
                    skip,
                    take: limitNum
                }),
                prisma.user.count({ where })
            ]);

            // Calculate pagination info
            const totalPages = Math.ceil(totalCount / limitNum);
            const hasNextPage = pageNum < totalPages;
            const hasPrevPage = pageNum > 1;

            res.json({
                users,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalCount,
                    hasNextPage,
                    hasPrevPage,
                    limit: limitNum
                },
                filters: {
                    search: search || '',
                    role: role || 'ALL',
                    status: status || 'ALL'
                }
            });
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
    async (req: Request, res: Response) => {
        const authenticatedReq = req as AuthenticatedRequest;

        try {
            const { status } = req.body;

            if (!status || !Object.values(Status).includes(status)) {
                return res.status(400).json({ message: 'Valid status is required' });
            }

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

            res.json(user);
        } catch (error) {
            console.error('Update status error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get user by ID
router.get('/:id',
    passport.authenticate('jwt', { session: false }),
    requireAdmin,
    async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ message: 'User ID is required' });
            }

            const user = await prisma.user.findUnique({
                where: { id },
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

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json(user);
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Create user (Admin only)
router.post('/',
    passport.authenticate('jwt', { session: false }),
    requireAdmin,
    async (req: Request, res: Response) => {
        try {
            const { email, password, name, role, status } = req.body;

            // Validation
            if (!email || !password || !name || !role) {
                return res.status(400).json({ message: 'Email, password, name, and role are required' });
            }

            if (!Object.values(Role).includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }

            if (status && !Object.values(Status).includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email }
            });

            if (existingUser) {
                return res.status(400).json({ message: 'User with this email already exists' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);

            // Create user
            const userData: any = {
                email,
                password: hashedPassword,
                name,
                role
            };

            // Only set status for regular users
            if (role === Role.USER && status) {
                userData.status = status;
            }

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

            res.status(201).json(user);
        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Update user
router.put('/:id',
    passport.authenticate('jwt', { session: false }),
    requireAdmin,
    async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { email, name, role, status, password } = req.body;

            if (!id) {
                return res.status(400).json({ message: 'User ID is required' });
            }

            // Check if user exists
            const existingUser = await prisma.user.findUnique({
                where: { id }
            });

            if (!existingUser) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Validation
            if (role && !Object.values(Role).includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }

            if (status && !Object.values(Status).includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }

            // Check email uniqueness if email is being updated
            if (email && email !== existingUser.email) {
                const emailExists = await prisma.user.findUnique({
                    where: { email }
                });

                if (emailExists) {
                    return res.status(400).json({ message: 'User with this email already exists' });
                }
            }

            // Build update data
            const updateData: any = {};
            if (email) updateData.email = email;
            if (name) updateData.name = name;
            if (role) updateData.role = role;

            // Handle password update
            if (password) {
                updateData.password = await bcrypt.hash(password, 12);
            }

            // Handle status based on role
            if (role === Role.ADMIN) {
                updateData.status = null; // Admins don't have status
            } else if (role === Role.USER && status) {
                updateData.status = status;
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

            res.json(user);
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Delete user
router.delete('/:id',
    passport.authenticate('jwt', { session: false }),
    requireAdmin,
    async (req: Request, res: Response) => {
        try {
            const authenticatedReq = req as AuthenticatedRequest;
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ message: 'User ID is required' });
            }

            // Prevent self-deletion
            if (id === authenticatedReq.user.id) {
                return res.status(400).json({ message: 'Cannot delete your own account' });
            }

            // Check if user exists
            const existingUser = await prisma.user.findUnique({
                where: { id }
            });

            if (!existingUser) {
                return res.status(404).json({ message: 'User not found' });
            }

            await prisma.user.delete({
                where: { id }
            });

            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

export default router;