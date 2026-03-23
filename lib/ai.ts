import Anthropic from "@anthropic-ai/sdk";

// Returns a singleton Anthropic client
// Call this inside API routes (server-side only — key is never exposed to client)
export function getAIClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Convenience: send a single prompt and get a text response
export async function ask(prompt: string, systemPrompt?: string): Promise<string> {
  const client = getAIClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    ...(systemPrompt && { system: systemPrompt }),
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
