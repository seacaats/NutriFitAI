import { ChatMessage, coachMessages as initialMessages } from "@/data/placeholders";
import { useState } from "react";

export function useAICoach() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: input.trim(),
      time: "Now",
    };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);

    //mock chatbot endpoint call
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: "Got it! Let me look into that for you.",
          time: "Now",
        },
      ]);
    }, 600);
  };

  return {
    messages,
    input,
    setInput,
    sendMessage,
  };
}
