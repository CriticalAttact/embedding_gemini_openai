import fs from "fs/promises";  // Use only fs/promises
import OpenAI from 'openai';
import nlp from "compromise";
import dotnev from "dotenv"
import { message } from "./utils/openai_msg.js"
import { logger } from "./utils/logger.js";

dotnev.config()

// Asynchronous reading of a JSON file
const readfile = async (file_index) => {
    let json_data = {};
    try {
        // Read the file with the correct encoding
        const data = await fs.readFile(`./data/database${file_index}.txt`, 'utf8');

        // Parse the JSON data
        json_data = JSON.parse(data);
    } catch (error) {
        console.error('Error:', error);
    }
    return json_data;
}


function splitTextIntoSentences(text) {
    let adjustedText = text.replace(/-\s+/g, ". ");
    adjustedText = adjustedText.replace(/\b(vs)\.\s+/g, "$1 ");
    adjustedText = adjustedText.replace(/\b(sp|Op|No|Drs|Mr|Dr|Mrs)\.\s+/g, "$1_TEMP ");
    let doc = nlp(adjustedText);
    let sentences = doc.sentences().out('array');
    return sentences.map(sentence => sentence.trim()); // Trim whitespace from each sentence
}

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY1, // This is the default and can be omitted
});

const is_question_openai = async (sentence) => {

    try {
        const chatCompletion = await client.chat.completions.create({
            messages: [
                ...message,
                { role: 'user', content: sentence },
            ],
            model: 'gpt-3.5-turbo',
        });
        // console.log(chatCompletion.choices[0].message.content.toLowerCase())
        return chatCompletion.choices[0].message.content.toLowerCase().indexOf("question") != -1;
    } catch (error) {
        console.log(error);
        return false
    }

}

const is_question = async (text) => {
    try {

        const firstWord = text.trim().split(' ')[0];

        const questionWords = [
            "what",    // Example: "What is your name?"
            "how",     // Example: "How are you?"
            "why",     // Example: "Why did you do that?"
            "who",     // Example: "Who are you?"
            "where",   // Example: "Where is the nearest store?"
            "when",    // Example: "When will it happen?"
            "which",   // Example: "Which color do you prefer?"
            "is",      // Example: "Is it raining?"
            "are",     // Example: "Are you coming?"
            "do",      // Example: "Do you understand?"
            "does",    // Example: "Does she know?"
            "did",     // Example: "Did you see that?"
            "will",    // Example: "Will you go?"
            "would",   // Example: "Would you help me?"
            "can",     // Example: "Can you hear me?"
            "could",   // Example: "Could you explain?"
            "may",     // Example: "May I ask a question?"
            "might",   // Example: "Might you come with us?"
            "shall",   // Example: "Shall we begin?"
            "should",  // Example: "Should I go now?"
            "must",     // Example: "Must we leave?"
            "was",
            "were"
        ];
        const sentences = splitTextIntoSentences(text);

        if (sentences.length < 2 && questionWords.includes(firstWord.toLowerCase())) {
            return {
                isQuestion: true,
                last_sentence:sentences
            }
        }

        if (sentences.length > 2 ) {
            return {
                isQuestion: false,
                last_sentence:sentences
            }
        }


        const isQuestion = await is_question_openai(text);
        return {
            isQuestion: isQuestion,
            last_sentence: sentences
        }

    } catch (error) {
        console.log(error);
        console.log(text)
    }

}

const engine = async (file_index) => {
    const startTime = new Date().getTime();
    const data = await readfile(file_index);
    const texts = data['texts'];
    const true_q_indices = data["q_indices"];
    const true_a_indices = data["a_indices"];
    let cnt = 0;
    console.log(`--------------${file_index}----------------------`)
    for (let i = 0; i < true_q_indices.length; i++) {
        let q_idx = true_q_indices[i];
        let tmp1 = await is_question(texts[q_idx]);
        if (!tmp1.isQuestion) {
            cnt++;
            console.log("Q@@@@@@@@");
            console.log(texts[q_idx]);
            console.log("--------------");
            console.log(tmp1.last_sentence);
        }
    }
    for (let i = 0; i < true_a_indices.length; i++) {
        let a_idx = true_a_indices[i];
        let tmp1 = await is_question(texts[a_idx]);
        if (tmp1.isQuestion) {
            cnt++;
            console.log("A@@@@@@@@");
            console.log(texts[a_idx]);
            console.log("--------------");
            console.log(tmp1.last_sentence);
        }
    }
    logger.info(`file_${file_index}: ${cnt}`);

}

const main = async () => {


    for (let i = 0; i < 100; i++) {
        await engine(i);

    }
}

// Invoke main function
main().catch(err => console.error(err));