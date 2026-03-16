-- Add persistent countdown plans per application
CREATE TABLE "CountdownPlan" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "interviewDate" TIMESTAMP(3) NOT NULL,
  "planData" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CountdownPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CountdownPlan_applicationId_key" ON "CountdownPlan"("applicationId");

ALTER TABLE "CountdownPlan"
  ADD CONSTRAINT "CountdownPlan_applicationId_fkey"
  FOREIGN KEY ("applicationId")
  REFERENCES "Application"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
