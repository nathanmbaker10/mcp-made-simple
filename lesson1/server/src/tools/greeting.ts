// 1. Import dependencies
import { z } from "zod";

// 2. Tool Schema
export const GreetingToolSchema = z.object({
  name: z.string(),
});

// 3. Tool Listing Information Definition
export const greetingToolDefinition = {
  name: "greeting",
  description: "Returns a greeting message to the user",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "The name of the user to greet"
      }
    },
    required: ["name"]
  }

}

// 4. Tool Implementation
export const handleGreeting = (args: unknown) => {
  const { name } = GreetingToolSchema.parse(args);

  return {
    content: [
      {
        type: "text" as const,
        text: `Hello, ${name}! How can I help you today?`,
      },
    ],
  };
}
