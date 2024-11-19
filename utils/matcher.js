import OpenAI from 'openai';
import nlp from "compromise"
import translate from "google-translate-api-x";
import { KMMatcher } from "./KM_new.js"
import { embedding } from "./gemini.js"
import { logger } from "./logger.js";
import { message } from "./openai_msg.js"
import fs from "fs/promises";

const TEXT_ARRAY_LENGTH = 128;

const writefile = async (data, text_name) => {
    try {
        await fs.writeFile(`./example/${text_name}.txt`, data);
        console.log('File written successfully');
    } catch (error) {
        console.error('Error:', error);
    }
}

async function translateText(text, targetLang) {
    try {
        const res = await translate(text, { to: targetLang });
        return res.text;
    } catch (error) {
        console.error('Error:', error);
    }
}


function splitTextIntoSentences(text) {
    let adjustedText = text.replace(/-\s+/g, ". ");
    adjustedText = adjustedText.replace(/\b(vs)\.\s+/g, "$1 ");
    adjustedText = adjustedText.replace(/\b(sp|Op|No|Drs|Mr|Dr|Mrs)\.\s+/g, "$1_TEMP ");
    let doc = nlp(adjustedText);
    let sentences = doc.sentences().out('array');
    return sentences.map(sentence => sentence.trim()); // Trim whitespace from each sentence
}

const is_question = async (text) => {
    try {
        const firstWord = text.trim().split(' ')[0];

        const questionWords = [
            "what",
            "how",
            "why",
            "who",
            "where",
            "when",
            "which",
            "is",
            "are",
            "do",
            "does",
            "did",
            "will",
            "would",
            "can",
            "could",
            "may",
            "might",
            "shall",
            "should",
            "must",
            "was",
            "were"
        ];

        const sentences = splitTextIntoSentences(text);

        if (sentences.length < 2 && questionWords.includes(firstWord.toLowerCase())) {

            return true
        }

        if (sentences.length > 2) {
            return false
        }


        const isQuestion = await is_question_openai(text);
        return isQuestion

    } catch (error) {
        console.log(error);
        console.log(text)
    }

}


const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY1, // This is the default and can be omitted
});

const is_question_openai = async (text) => {
    try {
        const chatCompletion = await client.chat.completions.create({
            messages: [
                ...message,
                { role: 'user', content: text },
                // {role: 'user', content:`${text}\n\n\n\n\n\nIs this a question? Provide me only "Yes" or "No"`}
            ],
            model: 'gpt-3.5-turbo',
            // model: 'gpt-4o',
        });

        return chatCompletion.choices[0].message.content.indexOf("question") != -1;
    } catch (error) {
        console.log(error);
        return false
    }

}



class Matcher {
    constructor() {

    }

    async checkQuestions(texts) {
        let isQuestion = Array(TEXT_ARRAY_LENGTH).fill(false);
        const promises = texts.map(async (text, index) => {
            const is_q = await is_question(text);
            return { index, is_q };
        });
        const results = await Promise.all(promises);
        results.forEach(result => {
            isQuestion[result.index] = result.is_q;
        });
        return isQuestion;
    }


    async solve(query) {
        const texts = query.texts;
        const dimensions = query.dimensions;

        logger.info(`Text Length: ${texts.length}`);

        let isQuestion = Array(TEXT_ARRAY_LENGTH).fill(false);

        isQuestion = await this.checkQuestions(texts);

        if (!Array.isArray(texts)) {
            logger.error("Parameter should be an array.");
            return null;
        }

        if (texts.length !== TEXT_ARRAY_LENGTH) {
            logger.error("Array length does not match.");
            return null;
        }


        logger.info(`Embedding...`);

        let startTime = Date.now();

        const embeddings = await embedding(texts);

        logger.info(`Embedding done in ${Date.now() - startTime}ms`);

        const cosineSimilarity = (vecA, vecB) => {
            const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
            const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
            const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
            return dotProduct / (magnitudeA * magnitudeB);
        };

        const weights = [];
        const n = TEXT_ARRAY_LENGTH;

        for (let i = 0; i < n; i++) {
            weights[i] = Array(dimensions).fill(0);
        }

        for (let i = 0; i < embeddings.length; i++) {
            for (let j = i + 1; j < embeddings.length; j++) {
                const similarities = cosineSimilarity(embeddings[i], embeddings[j]);
                weights[i][j] = similarities;
                weights[j][i] = similarities;
            }
        }

        let min_weight = Infinity;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                min_weight = Math.min(min_weight, weights[i][j]);
            }
        }

        let questionCnt = 0;

        for (let i = 0; i < n; i++)
            isQuestion[i] == true && questionCnt++;

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                weights[i][j] -= min_weight;
            }

            weights[i][i] = 0;

            const T = 0.5;

            for (let j = 0; j < n; j++) {
                if (isQuestion[i] === isQuestion[j]) {
                    weights[i][j] *= T;
                }
                if (!isQuestion[i] === !isQuestion[j]) {
                    weights[i][j] *= T;
                }
            }
        }

        const m_KM = new KMMatcher(weights);

        logger.info(`Running KM Algorithm..., QuestionCnt:${questionCnt}`);

        startTime = Date.now();

        const best = m_KM.solve();

        logger.info(`KM Algorithm took ${Date.now() - startTime}ms`);

        return m_KM.xy

    }

    async solve_test(query) {
        const texts = query.texts;
        const dimensions = query.dimensions;
        const true_a_indices = query.true_a_indices;
        const true_q_indices = query.true_q_indices
        const text_name = query.text_name;

        logger.info(`Text Length: ${texts.length}`);

        let isQuestion = Array(TEXT_ARRAY_LENGTH).fill(false);

        isQuestion = await this.checkQuestions(texts);

        if (!Array.isArray(texts)) {
            logger.error("Parameter should be an array.");
            return null;
        }

        if (texts.length !== TEXT_ARRAY_LENGTH) {
            logger.error("Array length does not match.");
            return null;
        }


        logger.info(`Embedding...`);

        let startTime = Date.now();

        const embeddings = await embedding(texts);

        logger.info(`Embedding done in ${Date.now() - startTime}ms`);

        const cosineSimilarity = (vecA, vecB) => {
            const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
            const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
            const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
            return dotProduct / (magnitudeA * magnitudeB);
        };

        const weights = [];
        const n = TEXT_ARRAY_LENGTH;

        for (let i = 0; i < n; i++) {
            weights[i] = Array(dimensions).fill(0);
        }

        for (let i = 0; i < embeddings.length; i++) {
            for (let j = i + 1; j < embeddings.length; j++) {
                const similarities = cosineSimilarity(embeddings[i], embeddings[j]);
                weights[i][j] = similarities;
                weights[j][i] = similarities;
            }
        }

        let min_weight = Infinity;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                min_weight = Math.min(min_weight, weights[i][j]);
            }
        }

        let questionCnt = 0;

        for (let i = 0; i < n; i++)
            isQuestion[i] == true && questionCnt++;

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                weights[i][j] -= min_weight;
            }

            weights[i][i] = 0;

            const T = 0.5;

            for (let j = 0; j < n; j++) {
                if (isQuestion[i] === isQuestion[j]) {
                    weights[i][j] *= T;
                }
                if (!isQuestion[i] === !isQuestion[j]) {
                    weights[i][j] *= T;
                }
            }
        }



        const m_KM = new KMMatcher(weights);

        logger.info(`Running KM Algorithm..., QuestionCnt:${questionCnt}`);

        startTime = Date.now();

        const best = m_KM.solve();

        logger.info(`KM Algorithm took ${Date.now() - startTime}ms`);


        let will_write = "";

        weights.map((weight, i) => {
            let tmp = weight.map((item, j) => {
                return {
                    score: item,
                    from: i,
                    to: j
                }
            });

            let is_true = false;
            true_q_indices.forEach((q_idx, index) => {
                if (q_idx == i) {
                    if (true_a_indices[index] == m_KM.xy[i]) {
                        is_true = true;
                    } else {
                        will_write += "###########################################\n";
                        will_write += "------------question-----------------------\n";
                        will_write += texts[i] + "\n";
                        will_write += "------------correct----------------------\n";
                        will_write += texts[true_a_indices[index]] + "\n"
                        will_write += "------------expect----------------------\n";
                        will_write += texts[m_KM.xy[i]] + "\n"
                        will_write += "----------------------------------\n";
                        console.log({ from: i, to: m_KM.xy[i], correct: true_a_indices[index] });
                    }
                    will_write += `Question: ${i}, true_answer: ${true_a_indices[index]}, expect: ${m_KM.xy[i]}\n`

                }
            });
            true_a_indices.forEach((a_idx, index) => {
                if (a_idx == i) {
                    if (true_q_indices[index] == m_KM.xy[i]) {
                        is_true = true;
                    } else {
                        will_write += "###########################################\n";
                        will_write += "------------question-----------------------\n";
                        will_write += texts[i] + "\n";
                        will_write += "------------correct----------------------\n";
                        will_write += texts[true_q_indices[index]] + "\n"
                        will_write += "------------expect----------------------\n";
                        will_write += texts[m_KM.xy[i]] + "\n"
                        will_write += "----------------------------------\n";
                    }
                    will_write += `Answer: ${i}, true_quetion: ${true_q_indices[index]}, expect: ${m_KM.xy[i]}\n`
                }
            });
            tmp.sort((a, b) => b.score - a.score);
            tmp.map(item => {
                will_write += `${item.from.toString().padStart(3, 0)}: ${item.to.toString().padStart(3, 0)}: ${item.score.toFixed(4)}\t`
            });
            if (!is_true) will_write += "\n###########################################"
            will_write += '\n\n'

        })

        will_write += "--------------------------------------\n";
        true_q_indices.forEach((q_idx, index) => {

        });

        await writefile(will_write, text_name)
        //write info

        return m_KM.xy

    }
};


export {
    Matcher
}