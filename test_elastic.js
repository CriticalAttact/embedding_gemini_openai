import { Client } from "@elastic/elasticsearch";
import fs from "fs/promises";  // Use only fs/promises

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

const client = new Client({
    node: 'http://localhost:9200',
})

const addText = async (data) => {
    try {
        const response = await client.index({
            index: 'my_index',
            document: {
                content: data.text,
            },
            id: data.id
        });
    } catch (error) {
        console.error('Error indexing document:', error);
    }
}

const searchText = async(question) => {
    try {
        const response = await client.search({
            index: 'my_index',
            query: {
                match: { content: question },
            },
            size: 1000,
        });
        return response.hits.hits;
      } catch (error) {
        console.error('Error updating document:', error);
      }
}

const deleteTexts = async () => {
    try {
        await client.indices.delete({
            index: "my_index",
        });
    } catch (error) {
        console.log(error);
    }
}

const addAllTexts = async (datas) => {
    await deleteTexts();
    const promises = datas.map(async(data)=>{
        await addText(data);
    });
    await Promise.all(promises);
}

const engine = async () => {
    await deleteTexts();
    const data = await readfile(0);
    const texts = data['texts'];
    const true_q_indices = data["q_indices"];
    const true_a_indices = data["a_indices"];
    const promises = true_a_indices.map(i => 
        addText({
            text: texts[i],
            id: i,
        })
    );

    await Promise.all(promises);
    await sleep(1000)
    const results = await searchText(texts[97]);
    results.map(result => {
        console.log({
            from: 34,
            to: result['_id'],
            score: result["_score"]
        })
    })
}

engine().catch(err => console.error(err));
