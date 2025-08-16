-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('AVAILABLE_NO_TASK', 'AVAILABLE_ROUTINE_WORK', 'AVAILABLE_URGENT_WORK', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "public"."users"
(
    "id"        TEXT              NOT NULL,
    "email"     TEXT              NOT NULL,
    "password"  TEXT              NOT NULL,
    "name"      TEXT              NOT NULL,
    "role"      "public"."Role"   NOT NULL DEFAULT 'USER',
    "status"    "public"."Status" NOT NULL DEFAULT 'AVAILABLE_NO_TASK',
    "createdAt" TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users" ("email");
