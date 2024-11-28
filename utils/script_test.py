from sentence_transformers import SentenceTransformer
import json
from concurrent.futures import ThreadPoolExecutor
import numpy as np

# Load models
# model1 = SentenceTransformer("sentence-transformers/msmarco-distilbert-dot-v5")
# model2 = SentenceTransformer("sentence-transformers/msmarco-distilbert-base-v4")
# model3 = SentenceTransformer("sentence-transformers/msmarco-bert-base-dot-v5")
# bge-en-icl dunzhang/stella_en_1.5B_v5


model1 = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")
model2 = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
model3 = SentenceTransformer("sentence-transformers/all-MiniLM-L12-v2")
model4 = SentenceTransformer("sentence-transformers/multi-qa-MiniLM-L6-cos-v1")
model5 = SentenceTransformer("sentence-transformers/all-distilroberta-v1")
model6 = SentenceTransformer("sentence-transformers/multi-qa-mpnet-base-dot-v1")

def get_embeddings(model, sentences):
    return model.encode(sentences)

if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    sentences = args

    # Run both embeddings concurrently
    with ThreadPoolExecutor() as executor:
        future1 = executor.submit(get_embeddings, model1, sentences)
        future2 = executor.submit(get_embeddings, model2, sentences)
        future3 = executor.submit(get_embeddings, model3, sentences)
        future4 = executor.submit(get_embeddings, model4, sentences)
        # future5 = executor.submit(get_embeddings, model5, sentences)
        # future6 = executor.submit(get_embeddings, model6, sentences)
        
        embeddings1 = future1.result()
        embeddings2 = future2.result()
        embeddings3 = future3.result()
        embeddings4 = future4.result()
        # embeddings5 = future5.result()
        # embeddings6 = future6.result()
        

    # Combine the embeddings and convert to Python-native floats
    a = 1
    b = 1 #1.8
    c = 1 #2
    d = 0
    # e = 1
    # f = 1
    combined_embeddings = []
    # for emb1, emb2, emb3, emb4, emb5, emb6 in zip(embeddings1, embeddings2, embeddings3, embeddings4, embeddings5, embeddings6):
    for emb1, emb2, emb3, emb4 in zip(embeddings1, embeddings2, embeddings3, embeddings4):
        combined_embeddings.append([float(x * a + y * b + z * c + xx * d  )/ (a + b + c + d  ) for x, y, z, xx in zip(emb1, emb2, emb3, emb4)])
        # combined_embeddings.append([float(x * a + y * b + z * c + xx * d + yy * e + zz * f)/ (a + b + c + d + e + f ) for x, y, z, xx, yy, zz in zip(emb1, emb2, emb3, emb4, emb5, emb6)])

    # Convert to JSON and print
    json_str = json.dumps(combined_embeddings)
    print(json_str)





# from sentence_transformers import SentenceTransformer
# import sys
# import json

# args = sys.argv[1:]

# sentences = args

# model = SentenceTransformer("sentence-transformers/msmarco-distilbert-dot-v5")
# embeddings = model.encode(sentences)

# model2 = SentenceTransformer("sentence-transformers/msmarco-bert-base-dot-v5")
# embeddings2 = model2.encode(sentences)

# for i in range(0, len(embeddings[0])):
#     embeddings[0][i] += embeddings2[0][i]

# json_str = json.dumps(embeddings.tolist())
# print(str(json_str))