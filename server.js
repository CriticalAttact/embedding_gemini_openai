import fs from "fs/promises";  // Use only fs/promises
import { Matcher } from "./matcher.js";
import { logger } from "./logger.js";

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

const engine = async (file_index) => {
    const startTime = new Date().getTime();
    const data = await readfile(file_index);
    const texts = data['texts'];
    const true_q_indices = data["q_indices"];
    const true_a_indices = data["a_indices"];
    const matcher = new Matcher();
    const result = await matcher.solve({
        texts,
        dimensions: 128
    });
    let fail_cnt = 0;
    true_q_indices.forEach((q_idx, index) => {
        if(result[q_idx] != true_a_indices[index]){
            fail_cnt++;
        }
    });

    const endTime = new Date().getTime(); 
    logger.error(`file_${file_index}: time: ${(endTime - startTime)/1000}s  ,  failed_count: ${fail_cnt}`)
    return fail_cnt;
}

const main = async () => {
    
    let truefile_cnt = 0;
    for(let i = 16; i < 21; i++) {
        let fail_cnt = await engine(i);
        if(fail_cnt == 0) truefile_cnt++;
    }

    console.log(`Success! ${truefile_cnt}`);

}

// Invoke main function
main().catch(err => console.error(err));