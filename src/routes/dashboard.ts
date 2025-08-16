// src/routes/dashboard.ts
import express, { Response } from 'express';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, DashboardStats } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/stats',
    passport.authenticate('jwt', { session: false }),
    async (req: AuthenticatedRequest, res: Response<DashboardStats | { message: string }>) => {
        try {
            const totalUsers = await prisma.user.count();

            const statusCounts = await prisma.user.groupBy({
                by: ['status'],
                _count: {
                    status: true
                }
            });

            const stats = statusCounts.reduce((acc, item) => {
                acc[item.status] = {
                    count: item._count.status,
                    percentage: ((item._count.status / totalUsers) * 100).toFixed(1)
                };
                return acc;
            }, {} as DashboardStats['stats']);

            res.json({ totalUsers, stats });
        } catch (error) {
            console.error('Dashboard stats error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

export default router;