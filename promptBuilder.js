// Handles building prompts from Qdrant documents
function buildLLMPrompt(queryText, documents) {
    const context = documents.join("\n\n");
    return `
You are a C# code assistant. Using the following code context from the repository, 
generate a new model class according to the user's request.

User request: "${queryText}"

Code context:
${context}

Please provide the complete C# class:
`;
}

module.exports = { buildLLMPrompt };
