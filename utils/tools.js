import OpenAI from 'openai';
import nlp from "compromise";
import { message } from "./openai_msg.js";


function splitTextIntoSentences(text) {
    let adjustedText = text.replace(/-\s+/g, ". ");
    adjustedText = adjustedText.replace(/\b(vs)\.\s+/g, "$1 ");
    adjustedText = adjustedText.replace(/\b(sp|Op|No|Drs|Mr|Dr|Mrs)\.\s+/g, "$1_TEMP ");
    let doc = nlp(adjustedText);
    let sentences = doc.sentences().out('array');
    return sentences.map(sentence => sentence.trim()); // Trim whitespace from each sentence
}

function extractCoreWords1(sentence) {
    const doc = nlp(sentence);
    const ad_times = 1;
    const noun_times = 1;
    const verb_times = 1;
    const ed_times = 1;
    let nouns = [];
    let verbs = [];
    let adjectives = [];
    let wordsWithEd = [];
    nouns = Array(noun_times).fill(doc.nouns().out('array')).flat();
    verbs = Array(verb_times).fill(doc.verbs().out('array')).flat();
    wordsWithEd = Array(ed_times).fill(doc.match('#Verb+ed').out('array')).flat();
    adjectives = Array(ad_times).fill(doc.match('#Adjective').out('array')).flat();

    const coreWords = [...nouns, ...verbs, ...adjectives, ...wordsWithEd];

    return coreWords;
}

function extractCoreWords2(sentence) {
    const stopWords = ['the', 'a', 'an', 'does', 'at', 'in', 'on', 'for', 'to', 'and', 'with', 'of', 'is', 'by', 'this', 'that', 'it', 'be', 'not'];
    const questionWords = ["what", "how", "why", "who", "where", "when", "which", "is", "are", "do", "does", "did", "will", "would", "can", "could", "may", "might", "shall", "should", "must", "was", "were"];
    const words = sentence.split(" ");
    const filteredWords = words.filter(word => ![...stopWords, ...questionWords].includes(word.toLowerCase()));
    return filteredWords;
}

const is_question = async (text) => {
    try {
        const firstWord = text.trim().split(' ')[0];

        const questionWords = ["what", "how", "why", "who", "where", "when", "which", "is", "are", "do", "does", "did", "will", "would", "can", "could", "may", "might", "shall", "should", "must", "was", "were"];

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
            // model: 'gpt-3.5-turbo',
            model: 'gpt-4o',
            // model: 'gpt-4o-mini'
        });

        return chatCompletion.choices[0].message.content.indexOf("question") != -1;
    } catch (error) {
        console.log(error);
        return false
    }

}

const make_questions_openai = async (text) => {
    try {
        const chatCompletion = await client.chat.completions.create({
            messages: [
                { role: 'user', content: `${text}\n\n\n \nprovide me description with this content. by one sentence\n dont need your annotation` },
            ],
            // model: 'gpt-3.5-turbo',
            // model: 'gpt-4o',
            model: 'gpt-4o-mini'
        });

        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.log(error);
        return false
    }
}

const cleanText = (text) => {
    return text.replace(/[^a-zA-Z0-9 .,!?"']/g, '');
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


function extractAllNumbersAsSingleString(str) {
    const regex = /\d+/g;
    const matches = str.match(regex);
    const result = matches? matches.join("") : "";
    if(result){
        return parseInt(result);
    }
    return 0;
  }
  

const get_scores_openai = async (questions, answers, idxs, delta) => {
    // if(idxs[0] == 41) {
    //     console.log(`Question1: ${questions[0]}\n\nQuestion2: ${questions[1]}\n\nAnswer1: ${answers[0]}\n\nAnswer2: ${answers[1]}\n\nI already provided you questions and answers.\nWith these, I need two correct question and answer pairs.\nConsider Answers meaning And provide me high weight of pairs.\nAvailable pairs:\nQuestion1 -> Answer1\nQuestion1 -> Answer2\nQuestion2 -> Answer1\nQuestion2 -> Answer2\n\nprovide me only like this.\nThere is no same answer`);
    // }

    const times = Array(3).fill(0);
    let result = {};
    try {
        idxs.map(idx => {
            result[idx] = 0;
        });
        const promises = times.map(async(i)=>{
            const chatCompletion = await client.chat.completions.create({

                messages:[
                    { role: 'user', content: `Question1: ${questions[0]}\n\nQuestion2: ${questions[1]}\n\nAnswer1: ${answers[0]}\n\nAnswer2: ${answers[1]}\n\nI already provided you questions and answers.\nWith these, I need two correct question and answer pairs.\nConsider Answers meaning And provide me high weight of pairs.\nAvailable pairs:\nQuestion1 -> Answer1\nQuestion1 -> Answer2\nQuestion2 -> Answer1\nQuestion2 -> Answer2\n\nprovide me only like this.\nThere is no same answer`}
                ],
                // model: 'gpt-3.5-turbo',
                // model: 'gpt-4',
                model: 'gpt-4o-mini'
            });

           
            if(chatCompletion.choices[0].message.content.indexOf('Question1 -> Answer1') != -1){
                result[idxs[0]] += 0.02;
            }
            if(chatCompletion.choices[0].message.content.indexOf('Question1 -> Answer2') != -1){
                result[idxs[1]] += 0.02;
            }

        });
        await Promise.all(promises);
    } catch (error) {
        console.log(error)
    }
    return result;
}





const getScoreWithQuestion = async (question, answers) => {
    let result = [0, 0];

    const times = Array(4).fill(0);
    try {
        
        const promises = times.map(async(i)=>{
            const chatCompletion = await client.chat.completions.create({

                messages:[
                    { role: 'user', content: `Question: ${question}\n\nAnswer1: ${answers[0]}\n\nAnswer2: ${answers[1]}\n\nI already provided you question and answers.\nWith these, I need two correct answer.\nConsider Answers meaning And provide me high weight of answer.provide me only "Answer1" or "Answer2" or "Both"`}
                ],
                // model: 'gpt-3.5-turbo',
                // model: 'gpt-4',
                model: 'gpt-4o-mini'
            });

           
            if(chatCompletion.choices[0].message.content.indexOf('Answer1') != -1){
                result[0] += 0.025;
            }
            if(chatCompletion.choices[0].message.content.indexOf('Answer2') != -1){
                result[1] += 0.025;
            }

        });
        await Promise.all(promises);
    } catch (error) {
        console.log(error)
    }
    return result;
}





const keywordMatchScore = (question1, answer1) => {
    const question = cleanText(question1);
    const answer = cleanText(answer1);
    const keywords = new Set(extractCoreWords2(question));
    const wordsInAnswer = extractCoreWords2(answer);
    const matchCount = wordsInAnswer.filter(word => keywords.has(word)).length;
    return matchCount / (keywords.size); // Fraction of keywords matched
}

export {
    is_question,
    make_questions_openai,
    cleanText,
    extractCoreWords1,
    extractCoreWords2,
    keywordMatchScore,
    getRandomInt,
    get_scores_openai,
    getScoreWithQuestion
}