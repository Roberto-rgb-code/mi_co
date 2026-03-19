import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AssistantService, type ChatMessage } from './assistant.service';

@Controller('api/assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() body: { messages?: ChatMessage[] }) {
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const sanitized: ChatMessage[] = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 8000),
      }))
      .slice(-20);

    const reply = await this.assistant.completeChat(sanitized);
    return { reply };
  }
}
