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
    text: string,
    currentContent: string,
  ): Promise<string> {
    const dataAtual = new Date().toLocaleString('pt-BR');

    const prompt = `Você é o Arquiteto do "Second Brain" (Zettelkasten) do usuário.
    Sua tarefa é atualizar a documentação com a nova anotação de voz.

    PASSO 1: CLASSIFICAÇÃO
    Analise o contexto do arquivo e da anotação. É um projeto técnico/software, ou é algo pessoal/geral (viagens, ideias, rotina, estudos)?

    PASSO 2: FORMATAÇÃO OBRIGATÓRIA (Escolha o layout adequado)
    
    SE FOR TÉCNICO (Projetos, Código, Arquitetura):
    Use EXATAMENTE as seções:
    "📌 Estado Atual" (A verdade de hoje).
    "🏛️ Arquitetura e Decisões" (Detalhes técnicos).
    "⏳ Histórico de Evolução" (Log imutável com data/hora).
    "🏷️ Tags"

    SE FOR PESSOAL (Viagens, Vida, Ideias, Rotina):
    Use EXATAMENTE as seções:
    "📝 Resumo Geral" (O status atual do plano ou ideia).
    "🎯 Detalhes e Planejamento" (Informações cruciais, custos, roteiros, etc).
    "⏳ Diário de Bordo" (Log imutável dos pensamentos com data/hora).
    "🏷️ Tags"

    DIRETRIZES GERAIS PARA AMBOS:
    1. O "Histórico" (ou Diário) NUNCA deve ter itens apagados. Adicione a nova anotação no final usando a data e hora: ${dataAtual}.
    2. Reescreva a parte superior (Estado Atual/Resumo) para refletir a última anotação, caso as coisas mudem de direção.
    3. Retorne APENAS o código Markdown atualizado. Comece direto com o título #. Sem blocos \`\`\` em volta.

    CONTEÚDO ATUAL:
    """
    ${currentContent || 'Arquivo vazio ou recém-criado.'}
    """

    NOVA ANOTAÇÃO DE VOZ:
    "${text}"`;

    try {
      const response = await this.openai.chat.completions.create({
        messages: [{ role: 'system', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      this.logger.error('Erro ao formatar o conteúdo:', error);
      return '';
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
            content: `Você é o cérebro de roteamento de um assistente de voz.
            
            Arquivos existentes: [${existingFiles.length > 0 ? existingFiles.join(', ') : 'Nenhum'}]
            
            Regras Rigorosas:
            1. LIXO: Se for ruído, música ou conversa inútil, retorne: DESCARTAR.
            2. ARQUIVO EXISTENTE: Se for uma nova anotação sobre um domínio já existente, retorne o nome do arquivo.
            3. NOVO ARQUIVO: Para novos domínios, crie um nome em PascalCase terminando em .md.
            4. NOMENCLATURA: Nunca use nomes genéricos (ex: Projeto.md). Seja específico (ex: BackendPagamentos.md).
            5. PERGUNTA: Se o usuário estiver FAZENDO UMA PERGUNTA, pedindo para lembrar de algo, ou buscando uma informação, retorne APENAS a palavra: PERGUNTA.
            6. Retorne APENAS o nome do arquivo, DESCARTAR ou PERGUNTA. Sem aspas ou explicações.`,
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

  async answerQuestion(question: string, context: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Você é um assistente pessoal inteligente. O usuário te fez uma pergunta por voz.
          Você deve responder baseando-se ÚNICA E EXCLUSIVAMENTE no contexto de memória fornecido abaixo.
          Se a resposta não estiver no contexto, diga que não se lembra ou não encontrou a informação nas anotações.
          Seja direto, natural e fale como se estivesse conversando em voz alta com o usuário.
          
          CONTEXTO RECUPERADO DA MEMÓRIA:
          ${context || 'Nenhuma memória encontrada sobre este assunto.'}`,
        },
        { role: 'user', content: question },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
    });

    return (
      response.choices[0]?.message?.content?.trim() ||
      'Desculpe, me perdi no pensamento.'
    );
  }
}
