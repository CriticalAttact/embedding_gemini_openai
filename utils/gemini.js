const { TaskType, GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "models/text-embedding-004" });

const embeddingDocs = async (docTexts) => {
    const result = await model.batchEmbedContents({
        requests: docTexts.map((t) => ({
          content: { parts: [{ text: t }] },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
        })),
    });
    const embeddings = result.embeddings;
    return embeddings.map(item => item.values);
};

const embeddingQuery = async (queryText) => {
    const result = await model.embedContent({
        content: { parts: [{ text: queryText }] },
        taskType: TaskType.RETRIEVAL_QUERY,
    });
    const embedding = result.embedding;
    return embedding['values'];
};

const embedding = (texts) => {
    return new Promise(async (resolve, reject) => {
        const step = 16;
        const part_embeddings = [];
        for (let i = 0; i < texts.length; i += step) {
            const part_texts = texts.slice(i, Math.min(i + step, texts.length));

            try {
                const result = await model.batchEmbedContents({
                    requests: part_texts.map((t) => ({
                        content: { parts: [{ text: t }] },
                        taskType: TaskType.SEMANTIC_SIMILARITY,
                    }))
                })
                const embeddings = result.embeddings;

                part_embeddings.push(...embeddings.map(item => item.values));

                if (part_embeddings.length === texts.length) {
                    resolve(part_embeddings);
                    return;
                }
            } catch (err) {
                reject(err);
                return;
            }
        }
    });
};

module.exports = {
    embedding,
    embeddingDocs,
    embeddingQuery
};