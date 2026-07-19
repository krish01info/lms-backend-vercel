const dotenv = require("dotenv");
dotenv.config();

const { ChatGroq } = require("@langchain/groq");
const { Embeddings } = require("@langchain/core/embeddings");

const config = {
  groqApiKey: process.env.GROQ_API_KEY,
  jinaApiKey: process.env.JINA_API_KEY,
  chatModel: process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile",
  embeddingModel: process.env.JINA_EMBEDDING_MODEL || "jina-embeddings-v3",
};

class JinaEmbeddings extends Embeddings {
  constructor(fields) {
    super(fields ?? {});
    this.apiKey = fields?.apiKey;
    this.modelName = fields?.modelName;
  }

  async embedDocuments(documents) {
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
      throw new Error(`Jina API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data.data.map((item) => item.embedding);
  }

  async embedQuery(document) {
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
      throw new Error(`Jina API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}

async function runTest() {
  console.log("=== AI Integration Test ===");
  console.log("Using Models:");
  console.log(`- Chat Model: ${config.chatModel}`);
  console.log(`- Embedding Model: ${config.embeddingModel}`);
  console.log("===========================\n");

  if (!config.groqApiKey) {
    console.error("❌ Error: GROQ_API_KEY is not defined in your environment or .env file.");
    process.exit(1);
  }

  if (!config.jinaApiKey) {
    console.error("❌ Error: JINA_API_KEY is not defined in your environment or .env file.");
    process.exit(1);
  }

  // 1. Test Jina AI Embeddings
  try {
    console.log("1. Testing Jina AI Embeddings...");
    const embeddings = new JinaEmbeddings({
      apiKey: config.jinaApiKey,
      modelName: config.embeddingModel,
    });
    const testText = "LearnFlow LMS AI Tutor test query.";
    const vector = await embeddings.embedQuery(testText);
    console.log("   ✅ Success! Embeddings generated.");
    console.log(`   Vector Dimensions: ${vector.length}`);
    console.log(`   Sample Vector (first 5 elements): [${vector.slice(0, 5).join(", ")}...]`);
  } catch (error) {
    console.error("   ❌ Jina Embeddings test failed:", error.message);
  }

  console.log("\n-----------------------------------\n");

  // 2. Test Groq AI Chat Completion
  try {
    console.log("2. Testing Groq AI Chat Completion...");
    const model = new ChatGroq({
      apiKey: config.groqApiKey,
      model: config.chatModel,
      temperature: 0.2,
    });

    const response = await model.invoke([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Say 'LMS AI Tutor Integration with Groq is working!'" }
    ]);
    console.log("   ✅ Success! Groq response received.");
    console.log(`   Response: "${response.content.trim()}"`);
  } catch (error) {
    console.error("   ❌ Groq Chat Completion test failed:", error.message);
  }
}

runTest();
