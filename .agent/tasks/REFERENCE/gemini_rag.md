The Gemini API enables Retrieval Augmented Generation ("RAG") through the File Search tool. File Search imports, chunks, and indexes your data to enable fast retrieval of relevant information based on a user's prompt. This information is then provided as context to the model, allowing the model to provide more accurate and relevant answers.

You can use the uploadToFileSearchStore API to directly upload an existing file to your File Search store, or separately upload and then importFile if you want to create the file at the same time.

Directly upload to File Search store
This examples shows how to directly upload a file to a file store:

Python
JavaScript

const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({});

async function run() {
  // Create the File Search store with an optional display name
  const fileSearchStore = await ai.fileSearchStores.create({
    config: { displayName: 'your-fileSearchStore-name' }
  });

  // Upload and import a file into the File Search store, supply a file name which will be visible in citations
  let operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file: 'file.txt',
    fileSearchStoreName: fileSearchStore.name,
    config: {
      displayName: 'file-name',
    }
  });

  // Wait until import is complete
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.get({ operation });
  }

  // Ask a question about the file
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Can you tell me about Robert Graves",
    config: {
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: [fileSearchStore.name]
          }
        }
      ]
    }
  });

  console.log(response.text);
}

run();
Check the API reference for uploadToFileSearchStore for more information.

Importing files
Alternatively, you can upload an existing file and import it to your file store:

Python
JavaScript

const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({});

async function run() {
  // Upload the file using the Files API, supply a file name which will be visible in citations
  const sampleFile = await ai.files.upload({
    file: 'sample.txt',
    config: { name: 'file-name' }
  });

  // Create the File Search store with an optional display name
  const fileSearchStore = await ai.fileSearchStores.create({
    config: { displayName: 'your-fileSearchStore-name' }
  });

  // Import the file into the File Search store
  let operation = await ai.fileSearchStores.importFile({
    fileSearchStoreName: fileSearchStore.name,
    fileName: sampleFile.name
  });

  // Wait until import is complete
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.get({ operation: operation });
  }

  // Ask a question about the file
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Can you tell me about Robert Graves",
    config: {
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: [fileSearchStore.name]
          }
        }
      ]
    }
  });

  console.log(response.text);
}

run();
Check the API reference for importFile for more information.

Chunking configuration
When you import a file into a File Search store, it's automatically broken down into chunks, embedded, indexed, and uploaded to your File Search store. If you need more control over the chunking strategy, you can specify a chunking_config setting to set a maximum number of tokens per chunk and maximum number of overlapping tokens.

Python
JavaScript

// Upload and import and upload the file into the File Search store with a custom chunking configuration
let operation = await ai.fileSearchStores.uploadToFileSearchStore({
  file: 'file.txt',
  fileSearchStoreName: fileSearchStore.name,
  config: {
    displayName: 'file-name',
    chunkingConfig: {
      whiteSpaceConfig: {
        maxTokensPerChunk: 200,
        maxOverlapTokens: 20
      }
    }
  }
});
To use your File Search store, pass it as a tool to the generateContent method, as shown in the Upload and Import examples.

How it works
File Search uses a technique called semantic search to find information relevant to the user prompt. Unlike traditional keyword-based search, semantic search understands the meaning and context of your query.

When you import a file, it's converted into numerical representations called embeddings, which capture the semantic meaning of the text. These embeddings are stored in a specialized File Search database. When you make a query, it's also converted into an embedding. Then the system performs a File Search to find the most similar and relevant document chunks from the File Search store.

Here's a breakdown of the process for using the File Search uploadToFileSearchStore API:

Create a File Search store: A File Search store contains the processed data from your files. It's the persistent container for the embeddings that the semantic search will operate on.

Upload a file and import into a File Search store: Simultaneously upload a file and import the results into your File Search store. This creates a temporary File object, which is a reference to your raw document. That data is then chunked, converted into File Search embeddings, and indexed. The File object gets deleted after 48 hours, while the data imported into the File Search store will be stored indefinitely until you choose to delete it.

Query with File Search: Finally, you use the FileSearch tool in a generateContent call. In the tool configuration, you specify a FileSearchRetrievalResource, which points to the FileSearchStore you want to search. This tells the model to perform a semantic search on that specific File Search store to find relevant information to ground its response.

The indexing and querying process of File Search
The indexing and querying process of File Search
In this diagram, the dotted line from from Documents to Embedding model (using gemini-embedding-001) represents the uploadToFileSearchStore API (bypassing File storage). Otherwise, using the Files API to separately create and then import files moves the indexing process from Documents to File storage and then to Embedding model.

File Search stores
A File Search store is a container for your document embeddings. While raw files uploaded through the File API are deleted after 48 hours, the data imported into a File Search store is stored indefinitely until you manually delete it. You can create multiple File Search stores to organize your documents. The FileSearchStore API lets you create, list, get, and delete to manage your file search stores. File Search store names are globally scoped.

Here are some examples of how to manage your File Search stores:

Python
JavaScript

// Create a File Search store (including optional display_name for easier reference)
const fileSearchStore = await ai.fileSearchStores.create({
  config: { displayName: 'my-file_search-store-123' }
});

// List all your File Search stores
const fileSearchStores = await ai.fileSearchStores.list();
for await (const store of fileSearchStores) {
  console.log(store);
}

// Get a specific File Search store by name
const myFileSearchStore = await ai.fileSearchStores.get({
  name: 'fileSearchStores/my-file_search-store-123'
});

// Delete a File Search store
await ai.fileSearchStores.delete({
  name: 'fileSearchStores/my-file_search-store-123',
  config: { force: true }
});
The File Search Documents API reference for methods and fields related to managing documents in your file stores.

File metadata
You can add custom metadata to your files to help filter them or provide additional context. Metadata is a set of key-value pairs.

Python
JavaScript

// Import the file into the File Search store with custom metadata
let operation = await ai.fileSearchStores.importFile({
  fileSearchStoreName: fileSearchStore.name,
  fileName: sampleFile.name,
  config: {
    customMetadata: [
      { key: "author", stringValue: "Robert Graves" },
      { key: "year", numericValue: 1934 }
    ]
  }
});
This is useful when you have multiple documents in a File Search store and want to search only a subset of them.

Python
JavaScript

// Use the metadata filter to search within a subset of documents
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Tell me about the book 'I, Claudius'",
  config: {
    tools: [
      {
        fileSearch: {
          fileSearchStoreNames: [fileSearchStore.name],
          metadataFilter: 'author="Robert Graves"',
        }
      }
    ]
  }
});

console.log(response.text);
Guidance on implementing list filter syntax for metadata_filter can be found at google.aip.dev/160

Citations
When you use File Search, the model's response may include citations that specify which parts of your uploaded documents were used to generate the answer. This helps with fact-checking and verification.

You can access citation information through the grounding_metadata attribute of the response.

Python
JavaScript

console.log(JSON.stringify(response.candidates?.[0]?.groundingMetadata, null, 2));
Supported models
The following models support File Search:

gemini-2.5-pro
gemini-2.5-flash
Supported file types
File Search supports a wide range of file formats, listed in the following sections.

Application file types
Text file types
Rate limits
The File Search API has the following limits to enforce service stability:

Maximum file size / per document limit: 100 MB
Total size of project File Search stores (based on user tier):
Free: 1 GB
Tier 1: 10 GB
Tier 2: 100 GB
Tier 3: 1 TB
Recommendation: Limit the size of each File Search store to under 20 GB to ensure optimal retrieval latencies.
Note: The limit on File Search store size is computed on the backend, based on the size of your input plus the embeddings generated and stored with it. This is typically approximately 3 times the size of your input data.
Pricing
Developers are charged for embeddings at indexing time based on existing embeddings pricing ($0.15 per 1M tokens).
Storage is free of charge.
Query time embeddings are free of charge.
Retrieved document tokens are charged as regular context tokens.