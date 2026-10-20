import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { mockClassify, PRIORITY_POLICY, TAXONOMY } from "./data.js";

const API_KEY = process.env.OPENROUTER_API_KEY;

const categories = Object.fromEntries(
  TAXONOMY.map((item) => [item.key, item.label]),
);
const priorities = Object.fromEntries(
  Object.entries(PRIORITY_POLICY).map(([key, item]) => [key, item.description]),
);

async function classifyWithJev(text) {
  const client = new TypeSafeClient({
    apiKey: API_KEY,
    baseURL: "https://openrouter.ai/api",
    defaultModel: "jev-1.14",
    timeout: 20000,
    retry: { maxRetries: 1 },
  });
  const response = await client.systemOne({
    state: { complaint: text },
    questions: {
      category: choice(
        "Choose the single best Oern delivery complaint category. Use other_general when unclear.",
        categories,
      ),
      priority: choice(
        "Choose urgency using only facts stated in the complaint.",
        priorities,
      ),
    },
  });
  const category = response.answers.category;
  const priority = response.answers.priority;
  return {
    category: category.choice,
    categoryConfidence: category.confidence,
    priority: priority.choice,
    priorityConfidence: priority.confidence,
    mode: "jev",
  };
}

async function main() {
  const rl = createInterface({ input, output });
  console.log("Oern complaint classifier");
  console.log("Type a complaint, or type exit to quit.");
  console.log(
    API_KEY
      ? "Mode: JEV via OpenRouter\n"
      : "Mode: MOCK — OPENROUTER_API_KEY is not configured\n",
  );

  try {
    while (true) {
      const text = (await rl.question("\nComplaint > ")).trim();
      if (["exit", "quit"].includes(text.toLowerCase())) break;
      if (text.length < 5) {
        console.log("Please enter at least 5 characters.");
        continue;
      }

      try {
        const result = API_KEY
          ? await classifyWithJev(text.slice(0, 2000))
          : { ...mockClassify(text), mode: "mock" };
        console.log("\nResult");
        console.log("Mode:", result.mode.toUpperCase());
        console.log("Category:", result.category);
        console.log("Label:", categories[result.category] ?? "Unknown");
        console.log("Priority:", result.priority);
        if (result.categoryConfidence != null)
          console.log("Category confidence:", result.categoryConfidence);
        if (result.priorityConfidence != null)
          console.log("Priority confidence:", result.priorityConfidence);
      } catch (error) {
        console.error("Classification failed:", error.message);
      }
    }
  } finally {
    rl.close();
  }
}
main();
