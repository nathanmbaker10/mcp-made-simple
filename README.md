# MCP Made Simple - Tutorial Series

Welcome to the Model Context Protocol (MCP) Hello World tutorial series! This repository contains step-by-step lessons to help you understand and implement MCP servers for AI-powered IDE extensions.

## What is MCP?

The Model Context Protocol (MCP) is a standardized protocol that allows AI assistants to interact with external tools and services in modern IDEs. It enables AI models to:

- Discover available tools
- Call tools with structured inputs
- Receive structured outputs

## Lessons

| Lesson                 | Title                                     | Description                                   | Key Concepts                                                                          | Video                                                         |
| ---------------------- | ----------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [Lesson 1](./lesson1/) | Creating Your First MCP Server            | Build a basic MCP server with a greeting tool | - MCP Server Setup<br>- Tool Implementation<br>- IDE Integration<br>- stdio Transport | [Watch Tutorial](https://www.youtube.com/watch?v=rcjdfhhb6ZU) |
| [Lesson 2](./lesson2/) | Debugging with Chrome DevTools and Cursor | Debugging your apps with Browser Tools MCP    | - Capture Console Logs <br>- Take Screenshots<br>-Integration with Cursor             | [Watch Tutorial](https://www.youtube.com/watch?v=g08kmknV5Sg) |
| [Lesson 3](./lesson3/) | Game Inventory with Supabase              | Build a game inventory system using Supabase  | - Database Operations<br>- Supabase Integration<br>- React UI<br>- Real-time Updates  | [Watch Tutorial](https://www.youtube.com/watch?v=lKaCxJ_Ez3M) |
| [Lesson 4](./lesson4/) | Share the Greeting Server                 | Deploy the Lesson 1 server and call it from Gemini CLI | - Streamable HTTP<br>- Bearer token<br>- Health check<br>- Render |  |

## Playlist

[Watch the full playlist](https://www.youtube.com/playlist?list=PLWUH7ke1DYK_Tnvi9PPy67LCkoeKSKGbe)

## Prerequisites

- Node.js and npm installed
- Basic TypeScript knowledge
- IDE with MCP support (Cursor, Windsurf, or VS Code)
- Chrome browser (for Lesson 2)
- Supabase account (for Lesson 3)
- A [Render](https://render.com) account (for Lesson 4)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) on the computer that will call the remote greeting tool (for Lesson 4)

## Getting Started

1. Clone this repository
2. Navigate to the lesson you want to try
3. Follow the lesson's README.md instructions

## Resources

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [GitHub Tutorial Series](https://github.com/modelcontextprotocol/tutorial)
- [MCP Documentation](https://modelcontextprotocol.ai/)

## License

The MCP Hello World repository is licensed under the MIT License.
