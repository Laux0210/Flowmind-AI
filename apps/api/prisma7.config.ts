import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Gerar/validar o cliente dispensa banco. Operações de dados exigem a URL real.
  datasource: { url: process.env.DATABASE_URL },
});
