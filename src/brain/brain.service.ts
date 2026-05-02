import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';

@Injectable()
export class BrainService {
  private readonly logger = new Logger(BrainService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY');

    this.openai = new OpenAI({
      apiKey: groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async transcribe(filePath: string): Promise<string> {
    this.logger.log('Processando áudio na nuvem (via Groq)...');

    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-large-v3',
        language: 'pt',
      });

      this.logger.log(`Transcrição: ${transcription.text}`);
      return transcription.text;
    } catch (error) {
      this.logger.error('Erro na transcrição', error);
      return '';
    }
  }

  async analyzeAndFormat(
    rawText: string,
    currentMemory: string,
  ): Promise<string | null> {
    this.logger.log('🧠 Consolidando informação no arquivo...');

    try {
      const response = await this.openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Você é o organizador de anotações do Warement Brain.
            
            Conteúdo Atual do Arquivo:
            """
            ${currentMemory ? currentMemory : 'Arquivo vazio. Crie a estrutura inicial.'}
            """
            
            Sua tarefa é adicionar a NOVA INFORMAÇÃO de forma coesa dentro do Conteúdo Atual.
            - Se o assunto já existir, adicione os novos detalhes sem repetir o que já está escrito.
            - Se for um tópico diferente dentro do mesmo projeto, crie um novo subtítulo.
            - Mantenha ou crie Tags úteis (ex: #backend, #malta).
            - RETORNE APENAS O TEXTO MARKDOWN COMPLETO E ATUALIZADO. Sem blocos (\`\`\`) e sem explicações.`,
          },
          { role: 'user', content: `NOVA INFORMAÇÃO: "${rawText}"` },
        ],
        temperature: 0.2,
      });

      return response.choices[0].message.content?.trim() ?? null;
    } catch (error) {
      this.logger.error('Erro ao formatar:', error);
      return null;
    }
  }

  async routeToTopic(
    rawText: string,
    existingFiles: string[],
  ): Promise<string | null> {
    this.logger.log('Roteando assunto...');

    try {
      const response = await this.openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Você é um roteador inteligente de arquivos para um Segundo Cérebro (Zettelkasten).
            Sua função é decidir a gaveta (arquivo) exata para salvar a nova anotação.
            
            Arquivos existentes: [${existingFiles.length > 0 ? existingFiles.join(', ') : 'Nenhum'}]
            
            Regras Rigorosas:
            1. LIXO: Se o texto for ruído, música ou conversa inútil, retorne APENAS: DESCARTAR.
            2. ARQUIVO EXISTENTE: SÓ retorne o nome de um arquivo existente se o DOMÍNIO ESPECÍFICO for idêntico. Se a tecnologia for a mesma (ex: Backend), mas o contexto do negócio for diferente (ex: Pagamentos vs Produtos), você DEVE criar um arquivo novo.
            3. NOVO ARQUIVO: Para domínios diferentes, crie um novo nome de arquivo em PascalCase terminando em .md.
            4. NOMENCLATURA: NUNCA crie nomes genéricos (como "Backend.md", "Projeto.md" ou "Gerenciamento.md"). Seja ultradescritivo com o domínio de negócio (Ex: "BackendPagamentos.md", "GerenciamentoProdutos.md").
            5. Retorne APENAS o nome do arquivo. Sem aspas, sem explicações.`,
          },
          { role: 'user', content: rawText },
        ],
        temperature: 0.1,
      });

      const decision =
        response?.choices[0]?.message.content?.trim() ?? 'DESCARTAR';

      if (decision.includes('DESCARTAR')) return null;

      return decision.endsWith('.md')
        ? decision
        : `${decision.replace(/[^a-zA-Z0-9_-]/g, '')}.md`;
    } catch (error) {
      this.logger.error('Erro no roteamento:', error);
      return null;
    }
  }
}
