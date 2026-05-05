import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChromaClient, Collection, EmbeddingFunction } from 'chromadb';

@Injectable()
export class VectorService implements OnModuleInit {
  private readonly logger = new Logger(VectorService.name);
  private chromaClient: ChromaClient;
  private collection: Collection;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractor: any;

  async onModuleInit() {
    try {
      this.chromaClient = new ChromaClient({ host: 'localhost', port: 8000 });

      const mockEmbeddingFunction: EmbeddingFunction = {
        generate: (): Promise<number[][]> => Promise.resolve([]),
      };

      this.collection = await this.chromaClient.getOrCreateCollection({
        name: 'obsidian_vault',
        embeddingFunction: mockEmbeddingFunction,
      });

      this.logger.log('🤖 Carregando modelo local de Embeddings (Xenova)...');

      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
      const transformers = await eval('import("@xenova/transformers")');
      const pipeline = transformers.pipeline;

      this.extractor = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

      this.logger.log('Banco Vetorial ChromaDB conectado e modelo carregado!');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao inicializar o ChromaDB: ${errorMessage}`);
    }
  }

  // Converte o texto para uma matriz de números (Vetor)
  private async getEmbedding(text: string): Promise<number[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return Array.from(output.data);
  }

  async saveDocument(fileName: string, content: string) {
    try {
      const embedding = await this.getEmbedding(content);

      await this.collection.upsert({
        ids: [fileName],
        embeddings: [embedding],
        metadatas: [{ source: 'obsidian' }],
        documents: [content],
      });

      this.logger.log(`Memória Vetorial atualizada: [${fileName}]`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao salvar vetor de ${fileName}: ${errorMessage}`);
    }
  }

  async searchContext(query: string, limit: number = 2): Promise<string> {
    try {
      const queryEmbedding = await this.getEmbedding(query);

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
      });

      // Retorna os documentos encontrados juntos em uma string
      if (results.documents && results.documents[0].length > 0) {
        return results.documents[0].join('\n\n---\n\n');
      }
      return '';
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao buscar contexto vetorial: ${errorMessage}`);
      return '';
    }
  }
}
