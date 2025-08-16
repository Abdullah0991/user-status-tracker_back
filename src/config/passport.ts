// src/config/passport.ts
import { ExtractJwt, Strategy as JwtStrategy, StrategyOptions } from 'passport-jwt';
import { PassportStatic } from 'passport';
import { PrismaClient } from '@prisma/client';
import { UserResponse } from '../types';

const prisma = new PrismaClient();

const options: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'fallback_secret'
};

const configurePassport = (passport: PassportStatic): void => {
    passport.use(
        new JwtStrategy(options, async (payload: any, done) => {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: payload.id },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        status: true
                    }
                });

                if (user) {
                    return done(null, user as UserResponse);
                }
                return done(null, false);
            } catch (error) {
                return done(error, false);
            }
        })
    );
};

export default configurePassport;