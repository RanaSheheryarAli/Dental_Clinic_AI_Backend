CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "Clinic" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "about" TEXT NOT NULL,
  "mission" TEXT,
  "address" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "whatsapp" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "mapUrl" TEXT,
  "hours" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Service" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "durationMin" INTEGER NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "calEventTypeId" INTEGER,
  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Dentist" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "bio" TEXT,
  "photoUrl" TEXT,
  "calUserId" INTEGER,
  CONSTRAINT "Dentist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeDoc" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeDoc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
  "id" TEXT NOT NULL,
  "docId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector(1536) NOT NULL,
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "KnowledgeChunk"
ADD CONSTRAINT "KnowledgeChunk_docId_fkey"
FOREIGN KEY ("docId") REFERENCES "KnowledgeDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
ADD CONSTRAINT "Message_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "KnowledgeChunk_embedding_idx" ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);
