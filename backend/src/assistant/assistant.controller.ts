import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AssistantService, type ChatMessage } from './assistant.service';

@Controller('api/assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  @HttpCode(200)
  async chat(
    @Body()
    body: {
      messages?: ChatMessage[];
      /** Contexto del cliente CRM: producto, tarimas, requerimientos. El asistente lo usa para recomendar con argumentos. */
      clientContext?: string;
    },
  ) {
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const sanitized: ChatMessage[] = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 8000),
      }))
      .slice(-20);

    const clientContext =
      typeof body?.clientContext === 'string' ? body.clientContext.trim().slice(0, 2000) : undefined;

    const reply = await this.assistant.completeChat(sanitized, clientContext);
    return { reply };
  }
}
