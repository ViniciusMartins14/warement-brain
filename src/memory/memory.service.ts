import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly vaultPath =
    process.env.OBSIDIAN_VAULT_PATH || './vault_temp';

  constructor() {
    if (!fs.existsSync(this.vaultPath)) {
      fs.mkdirSync(this.vaultPath, { recursive: true });
    }
  }

  getVaultFiles(): string[] {
    try {
      const files = fs.readdirSync(this.vaultPath);

      return files.filter((file) => file.endsWith('.md'));
    } catch (error) {
      this.logger.error('Erro ao ler a pasta do Obsidian', error);
      return [];
    }
  }

  getFileContent(fileName: string): string {
    const filePath = path.join(this.vaultPath, fileName);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return '';
  }

  saveToFile(fileName: string, content: string) {
    const filePath = path.join(this.vaultPath, fileName);
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      this.logger.log(`Memória salva com sucesso em: [${fileName}]`);
    } catch (error) {
      this.logger.error(`Erro ao salvar no arquivo ${fileName}:`, error);
    }
  }
}
