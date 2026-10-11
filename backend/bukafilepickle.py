import pickle

file_path = "EncodeFileTamu.p" #nama file .p

with open(file_path, "rb") as f:
    data = pickle.load(f)

print(data)
