// src/routes/dashboard.ts
import express, { Request, Response } from 'express';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, DashboardStats } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/stats',
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response<DashboardStats | { message: string }>) => {
        const user = (req as AuthenticatedRequest).user;
        try {
            const totalUsers = await prisma.user.count();

            // Count only regular users (those with status)
            const totalRegularUsers = await prisma.user.count({
                where: {
                    role: 'USER'
                }
            });

            const statusCounts = await prisma.user.groupBy({
                by: ['status'],
                where: {
                    role: 'USER', // Only count regular users for status statistics
                    status: {
                        not: null
                    }
                },
                _count: {
                    status: true
                }
            });

            const stats = statusCounts.reduce((acc, item) => {
                if (item.status) {
                    acc[item.status] = {
                        count: item._count.status,
                        percentage: totalRegularUsers > 0
                            ? ((item._count.status / totalRegularUsers) * 100).toFixed(1)
                            : '0'
                    };
                }
                return acc;
            }, {} as DashboardStats['stats']);

            res.json({ totalUsers, totalRegularUsers, stats });
        } catch (error) {
            console.error('Dashboard stats error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

export default router;