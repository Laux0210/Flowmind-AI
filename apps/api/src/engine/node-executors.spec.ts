import { BadRequestException } from '@nestjs/common';
import { NodeExecutors } from './node-executors';
import type { ExecutionContext } from './node-executors';

describe('NodeExecutors (T11 — Condição, Registro Interno, E-mail e HTTP)', () => {
  const simContext: ExecutionContext = {
    mode: 'SIMULATION',
    orgId: 'org_test_123',
  };

  describe('5. Condição Lógica (executeCondition)', () => {
    it('deve avaliar igualdade com strings e números', () => {
      const res1 = NodeExecutors.executeCondition({}, {
        leftOperand: 'alto',
        operator: 'equals',
        rightOperand: 'alto',
      });
      expect(res1.result).toBe(true);

      const res2 = NodeExecutors.executeCondition({}, {
        leftOperand: 100,
        operator: '==',
        rightOperand: 100,
      });
      expect(res2.result).toBe(true);

      const res3 = NodeExecutors.executeCondition({}, {
        leftOperand: 'alto',
        operator: 'equals',
        rightOperand: 'baixo',
      });
      expect(res3.result).toBe(false);
    });

    it('deve avaliar pertinência (contains, in)', () => {
      const resContains = NodeExecutors.executeCondition({}, {
        leftOperand: 'Solicitação de Proposta Comercial Urgente',
        operator: 'contains',
        rightOperand: 'proposta',
      });
      expect(resContains.result).toBe(true);

      const resIn = NodeExecutors.executeCondition({}, {
        leftOperand: 'alto',
        operator: 'in',
        rightOperand: 'alto, urgência, prioritário',
      });
      expect(resIn.result).toBe(true);

      const resNotIn = NodeExecutors.executeCondition({}, {
        leftOperand: 'baixo',
        operator: 'in',
        rightOperand: 'alto, urgência',
      });
      expect(resNotIn.result).toBe(false);
    });

    it('deve avaliar operadores de comparação numérica (greater_than, less_than)', () => {
      const resGt = NodeExecutors.executeCondition({}, {
        leftOperand: '95',
        operator: 'greater_than',
        rightOperand: '80',
      });
      expect(resGt.result).toBe(true);

      const resLt = NodeExecutors.executeCondition({}, {
        leftOperand: '50',
        operator: '<',
        rightOperand: '80',
      });
      expect(resLt.result).toBe(true);
    });

    it('deve avaliar operadores de prefixo, sufixo e vacuidade (starts_with, ends_with, is_empty, is_not_empty)', () => {
      const resStartsWith = NodeExecutors.executeCondition({}, {
        leftOperand: 'FlowMind AI Plataforma',
        operator: 'starts_with',
        rightOperand: 'flowmind',
      });
      expect(resStartsWith.result).toBe(true);

      const resEndsWith = NodeExecutors.executeCondition({}, {
        leftOperand: 'relatorio_executivo.pdf',
        operator: 'ends_with',
        rightOperand: '.PDF',
      });
      expect(resEndsWith.result).toBe(true);

      expect(NodeExecutors.executeCondition({}, { leftOperand: '', operator: 'is_empty', rightOperand: '' }).result).toBe(true);
      expect(NodeExecutors.executeCondition({}, { leftOperand: '   ', operator: 'is_empty', rightOperand: '' }).result).toBe(true);
      expect(NodeExecutors.executeCondition({}, { leftOperand: [], operator: 'is_empty', rightOperand: '' }).result).toBe(true);
      expect(NodeExecutors.executeCondition({}, { leftOperand: 'preenchido', operator: 'is_empty', rightOperand: '' }).result).toBe(false);

      expect(NodeExecutors.executeCondition({}, { leftOperand: 'preenchido', operator: 'is_not_empty', rightOperand: '' }).result).toBe(true);
      expect(NodeExecutors.executeCondition({}, { leftOperand: '', operator: 'is_not_empty', rightOperand: '' }).result).toBe(false);
      expect(NodeExecutors.executeCondition({}, { leftOperand: '   ', operator: 'is_not_empty', rightOperand: '' }).result).toBe(false);
    });

    it('deve lançar erro em caso de operador inválido', () => {
      expect(() => {
        NodeExecutors.executeCondition({}, {
          leftOperand: 'a',
          operator: 'operador_inexistente',
          rightOperand: 'b',
        });
      }).toThrow(BadRequestException);
    });
  });

  describe('3. Registro Interno de Lead (executeInternalRecord)', () => {
    it('deve processar registro com mapeamento de campos com sucesso', () => {
      const res = NodeExecutors.executeInternalRecord(
        {},
        {
          name: 'Cliente Teste',
          email: 'cliente@example.test',
          raw_message: 'Mensagem de teste',
          interest_level: 'alto',
        },
        simContext,
      );

      expect(res.status).toBe('simulated');
      if (res.status === 'simulated') {
        expect(res.record_id).toMatch(/^sim_record_/);
        expect(res.name).toBe('Cliente Teste');
        expect(res.email).toBe('cliente@example.test');
        expect(res.raw_message).toBe('Mensagem de teste');
        expect(res.simulated_at).toBeDefined();
      }
    });

    it('deve mapear saídas de IA em internal_record quando fornecidas', () => {
      const res = NodeExecutors.executeInternalRecord(
        {},
        {
          fieldMappings: {
            name: 'Ana Silva',
            email: 'ana@example.test',
            raw_message: 'Preciso de automação',
            ai_summary: 'Solicitação de automação',
            ai_intent: 'Aquisição de software',
            ambiguities: ['Volume de usuários não informado'],
          },
        },
        simContext,
      );

      expect(res.name).toBe('Ana Silva');
      expect(res.email).toBe('ana@example.test');
      expect(res.raw_message).toBe('Preciso de automação');
      expect(res.ai_summary).toBe('Solicitação de automação');
      expect(res.ai_intent).toBe('Aquisição de software');
      expect(res.ambiguities).toEqual(['Volume de usuários não informado']);
    });

    it('deve rejeitar registro se nem nome nem e-mail forem informados', () => {
      expect(() => {
        NodeExecutors.executeInternalRecord({}, {}, simContext);
      }).toThrow(BadRequestException);
    });
  });

  describe('4. Envio de E-mail (executeSendEmail)', () => {
    it('deve simular envio com sucesso em modo SIMULATION e retornar subject', () => {
      const res = NodeExecutors.executeSendEmail(
        {},
        {
          to: 'lead@example.test',
          subject: 'Confirmação de recebimento',
          bodyTemplate: 'Olá, sua mensagem foi recebida.',
          replyTo: 'atendimento@flowmind.ai',
        },
        simContext,
      );

      expect(res.delivery_status).toBe('simulated');
      expect(res.recipient).toBe('lead@example.test');
      expect(res.subject).toBe('Confirmação de recebimento');
      expect(res.message_id).toBeDefined();
    });

    it('deve rejeitar e-mail com formato inválido', () => {
      expect(() => {
        NodeExecutors.executeSendEmail(
          {},
          { to: 'email_invalido_sem_arroba' },
          simContext,
        );
      }).toThrow(BadRequestException);
    });

    it('deve rejeitar replyTo com formato inválido ou CRLF injection', () => {
      expect(() => {
        NodeExecutors.executeSendEmail(
          {},
          {
            to: 'lead@example.test',
            replyTo: 'replyTo_invalido',
          },
          simContext,
        );
      }).toThrow(BadRequestException);

      expect(() => {
        NodeExecutors.executeSendEmail(
          {},
          {
            to: 'lead@example.test',
            replyTo: 'atendimento@flowmind.ai\r\nBcc: evil@example.test',
          },
          simContext,
        );
      }).toThrow(BadRequestException);
    });

    it('deve bloquear tentativa de CRLF Header Injection', () => {
      expect(() => {
        NodeExecutors.executeSendEmail(
          {},
          {
            to: 'lead@example.test\r\nBcc: hacker@example.test',
            subject: 'Assunto',
          },
          simContext,
        );
      }).toThrow(BadRequestException);

      expect(() => {
        NodeExecutors.executeSendEmail(
          {},
          {
            to: 'lead@example.test',
            subject: 'Assunto\r\nInjected-Header: evil',
          },
          simContext,
        );
      }).toThrow(BadRequestException);
    });
  });

  describe('6. Requisição HTTP e Proteção SSRF (executeHttpRequest)', () => {
    it('deve processar requisição pública segura em modo simulação', () => {
      const res = NodeExecutors.executeHttpRequest(
        {},
        {
          url: 'https://api.exemplo.com/webhooks/leads',
          method: 'POST',
        },
        simContext,
      );

      expect(res.status_code).toBe(200);
      expect(res.response_body).toMatchObject({
        simulated: true,
        method: 'POST',
        target_url: 'https://api.exemplo.com/webhooks/leads',
      });
    });

    it('deve bloquear SSRF para localhost e loopback', () => {
      const blockedHosts = [
        'http://localhost:3000/api',
        'http://127.0.0.1:8080/admin',
        'http://0.0.0.0:8000',
        'http://[::1]:8080',
      ];

      for (const url of blockedHosts) {
        expect(() => {
          NodeExecutors.validateUrlAgainstSsrf(url);
        }).toThrow(BadRequestException);
      }
    });

    it('deve bloquear SSRF para metadados de nuvem (AWS/GCP)', () => {
      const metadataUrls = [
        'http://169.254.169.254/latest/meta-data/',
        'http://metadata.google.internal/computeMetadata/v1/',
      ];

      for (const url of metadataUrls) {
        expect(() => {
          NodeExecutors.validateUrlAgainstSsrf(url);
        }).toThrow(BadRequestException);
      }
    });

    it('deve bloquear SSRF para redes privadas RFC 1918', () => {
      const privateIps = [
        'http://10.0.0.5/internal-api',
        'http://172.16.0.10:9000',
        'http://172.31.255.255',
        'http://192.168.1.1/router',
      ];

      for (const url of privateIps) {
        expect(() => {
          NodeExecutors.validateUrlAgainstSsrf(url);
        }).toThrow(BadRequestException);
      }
    });

    it('deve bloquear tentativa de CRLF Injection em cabeçalhos HTTP', () => {
      expect(() => {
        NodeExecutors.executeHttpRequest(
          {},
          {
            url: 'https://api.exemplo.com/webhooks/leads',
            method: 'POST',
            headers: {
              'X-Header\r\nEvil': 'injection',
            },
          },
          simContext,
        );
      }).toThrow(BadRequestException);

      expect(() => {
        NodeExecutors.executeHttpRequest(
          {},
          {
            url: 'https://api.exemplo.com/webhooks/leads',
            method: 'POST',
            headers: {
              'X-Header': 'valid\r\nInjected: malicious',
            },
          },
          simContext,
        );
      }).toThrow(BadRequestException);
    });

    it('deve bloquear SSRF para redes privadas IPv6 (ULA fc00::/7 e Link-Local fe80::/10)', () => {
      const privateIpv6Urls = [
        'http://[::1]/status',
        'http://[fc00::1]/admin',
        'http://[fd12:3456:789a::1]:8080/metrics',
        'http://[fe80::1]/link-local',
      ];

      for (const url of privateIpv6Urls) {
        expect(() => {
          NodeExecutors.validateUrlAgainstSsrf(url);
        }).toThrow(BadRequestException);
      }
    });

    it('deve bloquear esquemas perigosos (file, ftp, gopher)', () => {
      const badProtocols = [
        'file:///etc/passwd',
        'ftp://internal.server/file',
        'gopher://evil.host',
      ];

      for (const url of badProtocols) {
        expect(() => {
          NodeExecutors.validateUrlAgainstSsrf(url);
        }).toThrow(BadRequestException);
      }
    });
  });
});
