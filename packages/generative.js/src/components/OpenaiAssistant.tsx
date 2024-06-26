"use client";
import {
  AssistantMessage,
  type GenerativeMessage,
  MessageDelta,
} from "../message.js";
import { ClientOptions, OpenAI } from "openai";
import { object } from "../util/object.js";
import "../util/readable-stream-polyfill.js";
import { ReactNode, useCallback, useMemo } from "react";
import { ActionType } from "../action.js";
import { Message, MessageRenderFunc } from "./Message.js";
import { ChatCompletionCreateParamsStreaming } from "openai/resources/index";
import { Tool } from "../index.js";
import { zodToJsonSchema } from "zod-to-json-schema";

export type OpenaiAssistantProps = {
  content?: string; // set content to use Assistant as literal, no completion will be requested
  model?: ChatCompletionCreateParamsStreaming["model"];
  toolChoice?: "auto" | "none" | Tool<any>;
  tools?: Tool<any>[];
  requestOptions?: Partial<ChatCompletionCreateParamsStreaming>;
  clientOptions?: ClientOptions;
  children?: ReactNode | MessageRenderFunc<AssistantMessage>;
  onMessage?: (message: AssistantMessage) => void;
  loading?: ReactNode;
  key?: string;
};

export function OpenaiAssistant({
  content,
  model = "gpt-3.5-turbo",
  toolChoice = "auto",
  tools = [],
  requestOptions = {},
  clientOptions = {},
  children,
  onMessage,
  loading,
  key,
}: OpenaiAssistantProps) {
  const action = useCallback<ActionType>(
    async ({ messages, signal }) =>
      fetchCompletion({
        model,
        toolChoice,
        tools,
        messages,
        signal,
        requestOptions,
        clientOptions,
      }),
    [model, requestOptions, clientOptions, tools, toolChoice],
  );
  const deps = useMemo(() => [content], [content]);
  return (
    <Message<AssistantMessage>
      key={key}
      deps={deps}
      type={content ? { role: "assistant", content } : action}
      typeName="Assistant"
      onMessage={onMessage}
      loading={loading}
    >
      {children}
    </Message>
  );
}

async function fetchCompletion({
  model = "gpt-3.5-turbo",
  toolChoice = "auto",
  tools = [],
  messages,
  signal,
  requestOptions,
  clientOptions = {},
}: {
  model?: string;
  toolChoice?: "auto" | "none" | Tool<any>;
  tools?: Tool<any>[];
  messages: GenerativeMessage[];
  signal: AbortSignal;
  requestOptions?: Partial<ChatCompletionCreateParamsStreaming>;
  clientOptions?: ClientOptions;
}) {
  if (tools.length) {
    requestOptions = {
      ...requestOptions,
      tool_choice:
        typeof toolChoice === "string"
          ? toolChoice
          : { type: "function", function: { name: toolChoice.name } },
      tools: tools.map((tool) => {
        return {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: zodToJsonSchema(tool.schema),
          },
        };
      }),
    };
  }
  const openai = new OpenAI({
    dangerouslyAllowBrowser: true,
    ...clientOptions,
  });
  const stream = await openai.chat.completions.create(
    {
      model,
      messages,
      stream: true,
      ...requestOptions,
    },
    { signal },
  );
  return new ReadableStream<MessageDelta>({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!object(delta)) {
          controller.enqueue(delta);
        }
      }
      controller.close();
    },
  });
}
