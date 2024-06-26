/* @vitest-environment jsdom */
import { expect, test } from "vitest";
import {
  GenerativeMessage,
  GenerativeProvider,
  Message,
  readTextContent,
  Repeat,
  System,
  User,
} from "../../src/index.js";
import { sleep } from "../../src/util/sleep.js";
import { render } from "@testing-library/react";
import { getGenerative, UseGenerative } from "../util/UseGenerative.js";
import { ShowMessage } from "../util/show-message.js";

function Async({ children }: any) {
  return (
    <Message
      type={async () => {
        await sleep(1);
      }}
    >
      {children}
    </Message>
  );
}

test("should support nested repeat", async () => {
  const app = (
    <GenerativeProvider>
      <UseGenerative />
      <System content="-1">{readTextContent}</System>
      <Repeat limit={2}>
        <System content="0">{readTextContent}</System>
        <Repeat limit={3}>
          <Async>
            <User content="1">{readTextContent}</User>
            <Repeat limit={4}>
              <Async>
                <User content="2">{readTextContent}</User>
              </Async>
            </Repeat>
          </Async>
        </Repeat>
        <System content="3">{readTextContent}</System>
      </Repeat>
      <System content="4">{readTextContent}</System>
    </GenerativeProvider>
  );
  const {} = render(app);
  const generative = getGenerative()!;
  await generative.waitUntilSettled();

  const messages = generative.getAllMessages();
  const countOccurrence = (list: GenerativeMessage[], content: string) =>
    list.filter((m) => m.content === content).length;
  expect(countOccurrence(messages, "-1")).toEqual(1);
  expect(countOccurrence(messages, "0")).toEqual(2);
  expect(countOccurrence(messages, "1")).toEqual(2 * 3);
  expect(countOccurrence(messages, "2")).toEqual(2 * 3 * 4);
  expect(countOccurrence(messages, "3")).toEqual(2);
  expect(countOccurrence(messages, "4")).toEqual(1);
}, 10_000);

test("should render all iterations before next message", async () => {
  const app = (
    <GenerativeProvider options={{ logLevel: "info" }}>
      <UseGenerative />
      <Repeat limit={2}>
        <System content="A">
          <ShowMessage />
        </System>
      </Repeat>
      <System content="B">
        <ShowMessage />
      </System>
    </GenerativeProvider>
  );

  const { findByText, queryAllByText } = render(app);
  const generative = getGenerative()!;
  await generative.waitUntilSettled();
  await findByText("B");
  const elements = queryAllByText("A");
  expect(elements).toHaveLength(2);
}, 30_000);

test("should not repeat when stopped", async () => {
  const renderApp = (stopped: boolean) => (
    <GenerativeProvider>
      <System content="0">
        <ShowMessage />
      </System>
      <Repeat stopped={stopped}>
        <System content="2">
          <ShowMessage />
        </System>
      </Repeat>
      <System content="1">
        <ShowMessage />
      </System>
    </GenerativeProvider>
  );
  const { findByText, queryAllByText } = render(renderApp(true));
  await findByText("1");
  const elements = queryAllByText("2");
  expect(elements).toHaveLength(1);
}, 10_000);
