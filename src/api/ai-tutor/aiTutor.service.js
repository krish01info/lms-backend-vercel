const { ChatGroq } = require("@langchain/groq");
const { Embeddings } = require("@langchain/core/embeddings");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { PDFParse } = require("pdf-parse");
const config = require("../../config");
const { prisma } = require("../../config/database");
const ROLES = require("../../constants/roles");
const ApiError = require("../../utils/ApiError");

class JinaEmbeddings extends Embeddings {
  constructor(fields) {
    super(fields ?? {});
    this.apiKey = fields?.apiKey || config.ai.jinaApiKey;
    this.modelName = fields?.modelName || config.ai.embeddingModel || "jina-embeddings-v3";
  }

  async embedDocuments(documents) {
    if (!this.apiKey) {
      throw new ApiError(500, "JINA_API_KEY is not configured on the backend.");
    }
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: this.modelName,
        input: documents,
        task: "retrieval.passage",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new ApiError(500, `Jina API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) {
      throw new ApiError(500, "Invalid response from Jina Embeddings API.");
    }
    return data.data.map((item) => item.embedding);
  }

  async embedQuery(document) {
    if (!this.apiKey) {
      throw new ApiError(500, "JINA_API_KEY is not configured on the backend.");
    }
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: this.modelName,
        input: [document],
        task: "retrieval.query",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new ApiError(500, `Jina API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data) || !data.data[0]) {
      throw new ApiError(500, "Invalid response from Jina Embeddings API.");
    }
    return data.data[0].embedding;
  }
}

const DEFAULT_TOP_K = 5;

const documentSelect = {
  id: true,
  title: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  storageUrl: true,
  status: true,
  errorMessage: true,
  uploadedById: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { chunks: true } },
};

const ensureAiConfigured = () => {
  if (!config.ai.groqApiKey) {
    throw new ApiError(500, "GROQ_API_KEY is not configured on the backend.");
  }
  if (!config.ai.jinaApiKey) {
    throw new ApiError(500, "JINA_API_KEY is not configured on the backend.");
  }
};

const getEmbeddings = () => {
  ensureAiConfigured();
  return new JinaEmbeddings({
    apiKey: config.ai.jinaApiKey,
    modelName: config.ai.embeddingModel,
  });
};

const getChatModel = () => {
  ensureAiConfigured();
  return new ChatGroq({
    apiKey: config.ai.groqApiKey,
    model: config.ai.chatModel,
    temperature: 0.2,
  });
};

const formatDocument = (document) => ({
  ...document,
  chunkCount: document._count?.chunks || 0,
  _count: undefined,
});

const getTitleFromFilename = (filename) => {
  return filename.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim() || filename;
};

const extractPdfPages = async (buffer) => {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return {
      text: result.text || "",
      pages: result.pages || [],
      totalPages: result.total || result.pages?.length || null,
    };
  } finally {
    await parser.destroy();
  }
};

const splitPdfText = async (pages, fallbackText) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 180,
  });

  const pageChunks = [];

  for (const page of pages) {
    const pageText = (page.text || "").trim();
    if (!pageText) continue;

    const chunks = await splitter.splitText(pageText);
    chunks.forEach((content) => {
      if (content.trim()) {
        pageChunks.push({ content: content.trim(), page: page.num || null });
      }
    });
  }

  if (pageChunks.length > 0) return pageChunks;

  const chunks = await splitter.splitText((fallbackText || "").trim());
  return chunks
    .filter((content) => content.trim())
    .map((content) => ({ content: content.trim(), page: null }));
};

const cosineSimilarity = (left, right) => {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = Number(left[index]) || 0;
    const rightValue = Number(right[index]) || 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
};

const canManageDocument = (user, document) => {
  return (
    document.uploadedById === user.id ||
    [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(user.role)
  );
};

const uploadAndIndexPdf = async ({ file, userId, title }) => {
  if (!file) {
    throw new ApiError(400, "No PDF received. Attach a file with field name 'pdf'.");
  }

  const document = await prisma.aiDocument.create({
    data: {
      title: title || getTitleFromFilename(file.originalname),
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedById: userId,
      status: "PROCESSING",
    },
    select: documentSelect,
  });

  try {
    const extracted = await extractPdfPages(file.buffer);
    if (!extracted.text.trim()) {
      throw new ApiError(400, "No readable text was found in this PDF.");
    }

    const chunks = await splitPdfText(extracted.pages, extracted.text);
    if (chunks.length === 0) {
      throw new ApiError(400, "No indexable text chunks were found in this PDF.");
    }

    const embeddings = await getEmbeddings().embedDocuments(
      chunks.map((chunk) => chunk.content)
    );

    await prisma.aiDocumentChunk.createMany({
      data: chunks.map((chunk, index) => ({
        documentId: document.id,
        content: chunk.content,
        page: chunk.page,
        chunkIndex: index,
        embedding: embeddings[index],
        metadata: {
          source: file.originalname,
          totalPages: extracted.totalPages,
        },
      })),
    });

    const readyDocument = await prisma.aiDocument.update({
      where: { id: document.id },
      data: { status: "READY", errorMessage: null },
      select: documentSelect,
    });

    return formatDocument(readyDocument);
  } catch (error) {
    await prisma.aiDocument.update({
      where: { id: document.id },
      data: {
        status: "FAILED",
        errorMessage: error.message || "Failed to index PDF.",
      },
    });
    throw error;
  }
};

const listDocuments = async (user) => {
  const documents = await prisma.aiDocument.findMany({
    where: { uploadedById: user.id },
    select: documentSelect,
    orderBy: { createdAt: "desc" },
  });

  return documents.map(formatDocument);
};

const deleteDocument = async ({ documentId, user }) => {
  const document = await prisma.aiDocument.findUnique({
    where: { id: documentId },
    select: { id: true, uploadedById: true },
  });

  if (!document) throw new ApiError(404, "AI Tutor document not found.");
  if (!canManageDocument(user, document)) {
    throw new ApiError(403, "You do not have permission to delete this document.");
  }

  await prisma.aiDocument.delete({ where: { id: documentId } });
  return { id: documentId };
};

const buildDocumentFilter = async ({ userId, documentIds }) => {
  const where = {
    uploadedById: userId,
    status: "READY",
    ...(documentIds?.length && { id: { in: documentIds } }),
  };

  const documents = await prisma.aiDocument.findMany({
    where,
    select: { id: true },
  });

  if (documentIds?.length && documents.length !== documentIds.length) {
    throw new ApiError(404, "One or more requested AI Tutor documents were not found.");
  }

  return documents.map((document) => document.id);
};

const retrieveRelevantChunks = async ({ question, userId, documentIds, topK }) => {
  const accessibleDocumentIds = await buildDocumentFilter({ userId, documentIds });
  if (accessibleDocumentIds.length === 0) {
    throw new ApiError(400, "Upload and index at least one PDF before asking questions.");
  }

  const chunks = await prisma.aiDocumentChunk.findMany({
    where: { documentId: { in: accessibleDocumentIds } },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          originalName: true,
        },
      },
    },
  });

  if (chunks.length === 0) {
    throw new ApiError(400, "No indexed chunks are available for your PDFs yet.");
  }

  const queryEmbedding = await getEmbeddings().embedQuery(question);

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
};

const buildContext = (chunks) => {
  return chunks
    .map((chunk, index) => {
      const pageLabel = chunk.page ? `, page ${chunk.page}` : "";
      return `Source ${index + 1}: ${chunk.document.title}${pageLabel}\n${chunk.content}`;
    })
    .join("\n\n");
};

const askQuestion = async ({ question, userId, documentIds, topK = DEFAULT_TOP_K }) => {
  if (!question || !question.trim()) {
    throw new ApiError(400, "question is required.");
  }
  if (documentIds !== undefined && !Array.isArray(documentIds)) {
    throw new ApiError(400, "documentIds must be an array of document ids.");
  }

  const safeTopK = Math.min(Math.max(Number(topK) || DEFAULT_TOP_K, 1), 10);
  const chunks = await retrieveRelevantChunks({
    question: question.trim(),
    userId,
    documentIds,
    topK: safeTopK,
  });

  const context = buildContext(chunks);
  const model = getChatModel();

  const response = await model.invoke([
    {
      role: "system",
      content:
        "You are the LearnLMS AI Tutor. Answer using only the provided PDF context. If the context is insufficient, say you do not know from the uploaded PDFs. Keep answers clear and helpful.",
    },
    {
      role: "user",
      content: `Context:\n${context}\n\nQuestion:\n${question.trim()}`,
    },
  ]);

  return {
    answer: typeof response.content === "string" ? response.content : JSON.stringify(response.content),
    sources: chunks.map((chunk) => ({
      chunkId: chunk.id,
      documentId: chunk.document.id,
      title: chunk.document.title,
      originalName: chunk.document.originalName,
      page: chunk.page,
      score: Number(chunk.score.toFixed(4)),
      snippet: chunk.content.slice(0, 280),
    })),
  };
};

module.exports = {
  uploadAndIndexPdf,
  listDocuments,
  deleteDocument,
  askQuestion,
};
