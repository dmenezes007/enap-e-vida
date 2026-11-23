import express from 'express';
import {z} from 'zod';
import {db, logAuditEvent} from './db';
import {
  decryptVaultJson,
  encryptVaultJson,
  generateId,
  generateProtocol,
  hashPassword,
  verifyPassword,
} from './crypto';
import {
  attachSession,
  createSessionForUser,
  hydrateUser,
  rateLimit,
  requireAuth,
  requirePermission,
  SESSION_COOKIE_NAME,
  type AuthenticatedRequest,
} from './auth-middleware';
import {
  maskBankAccount,
  maskCpf,
  preboardingSubmissionSchema,
  registerAccountSchema,
} from '../src/lib/validators';
import {
  buildBrazilianCsv,
  buildEventIcs,
  hasPermission,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from '../src/lib/security';
import {computeStrategicIndicators} from '../src/lib/indicators';
import {DEMO_PASSWORD} from './seed';
import type {RoleCode} from '../src/lib/types';

export const apiRouter = express.Router();
apiRouter.use(attachSession);

// ============================================================================
// 1. AUTENTICAÇÃO, SESSÕES E PERSONAS DE DEMONSTRAÇÃO (§9, §10, §33)
// ============================================================================

apiRouter.get('/health', (_req, res) => {
  res.json({status: 'ok', mode: 'demo_fictitious_data'});
});

apiRouter.get('/auth/demo-personas', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.full_name, u.preferred_name, u.organizational_unit,
              u.position_title, u.journey_stage, u.demo_persona_label, u.mfa_enabled
       FROM users u WHERE u.demo_persona_label IS NOT NULL ORDER BY u.rowid ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  const result = rows.map((r) => {
    const roles = (
      db.prepare('SELECT role_code FROM user_roles WHERE user_id = ?').all(r.id) as Array<{
        role_code: RoleCode;
      }>
    ).map((x) => x.role_code);
    return {
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      preferredName: r.preferred_name,
      unit: r.organizational_unit,
      position: r.position_title,
      journeyStage: r.journey_stage,
      label: r.demo_persona_label,
      mfaEnabled: Boolean(r.mfa_enabled),
      roles,
    };
  });

  res.json({personas: result, demoPasswordHint: DEMO_PASSWORD});
});

apiRouter.get('/auth/me', (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.json({authenticated: false, user: null});
  }
  return res.json({authenticated: true, user: req.user});
});

apiRouter.post('/auth/login', rateLimit(40, 60_000), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      email: z.string().trim().email('Informe um e-mail válido.'),
      password: z.string().min(1, 'Informe sua senha.'),
      mfaCode: z.string().trim().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({error: parsed.error.issues[0]?.message || 'Dados inválidos.'});
  }

  const emailLower = parsed.data.email.toLowerCase();
  const userRow = db
    .prepare('SELECT id, email, password_hash, is_active, mfa_enabled FROM users WHERE lower(email) = ?')
    .get(emailLower) as
    | {id: string; email: string; password_hash: string; is_active: number; mfa_enabled: number}
    | undefined;

  // Mensagem genérica para proteção contra enumeração de contas (§28)
  if (!userRow || !userRow.is_active || !verifyPassword(parsed.data.password, userRow.password_hash)) {
    logAuditEvent({
      actorEmail: emailLower,
      action: 'AUTH_LOGIN_FAILED',
      resourceType: 'session',
      outcome: 'negado',
      metadata: {reason: 'invalid_credentials'},
    });
    return res.status(401).json({error: 'Credenciais inválidas. Verifique e-mail e senha.'});
  }

  // MFA demonstrativo obrigatório para perfis administrativos com mfa_enabled (§10)
  if (userRow.mfa_enabled && parsed.data.mfaCode !== '202600') {
    return res.status(401).json({
      error: 'Informe o código de autenticação multifator demonstrativo 202600.',
      mfaRequired: true,
    });
  }

  const sessionId = createSessionForUser(req, res, userRow.id, true);
  const user = hydrateUser(userRow.id, true);

  logAuditEvent({
    actorUserId: userRow.id,
    actorEmail: userRow.email,
    action: 'AUTH_LOGIN_SUCCESS',
    resourceType: 'session',
    resourceId: sessionId,
    outcome: 'sucesso',
    metadata: {mfaUsed: Boolean(userRow.mfa_enabled)},
  });

  return res.json({authenticated: true, user});
});

apiRouter.post('/auth/logout', (req: AuthenticatedRequest, res) => {
  if (req.sessionId) {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      req.sessionId,
    );
    if (req.user) {
      logAuditEvent({
        actorUserId: req.user.id,
        actorEmail: req.user.email,
        action: 'AUTH_LOGOUT',
        resourceType: 'session',
        resourceId: req.sessionId,
      });
    }
  }
  res.clearCookie(SESSION_COOKIE_NAME, {path: '/'});
  res.json({ok: true});
});

apiRouter.post('/auth/register', rateLimit(20, 60_000), (req: AuthenticatedRequest, res) => {
  const parsed = registerAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Verifique os campos obrigatórios.',
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;
  const emailLower = data.email.toLowerCase();
  const exists = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(emailLower);
  if (exists) {
    return res.status(409).json({
      error: 'Já existe uma conta cadastrada com este e-mail. Utilize a opção de login ou recuperação de senha.',
    });
  }

  const userId = generateId();
  const now = new Date().toISOString();
  const preferredName = (data.socialName || data.fullName).split(' ')[0];

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (
        id, email, alternative_email, password_hash, full_name, preferred_name, social_name,
        employment_type, organizational_unit, position_title, entry_date, journey_stage,
        is_active, email_verified, mfa_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'embarque', 1, 1, 0, ?, ?)
    `).run(
      userId,
      emailLower,
      data.alternativeEmail || null,
      hashPassword(data.password),
      data.fullName,
      preferredName,
      data.socialName || null,
      data.employmentType,
      data.organizationalUnit,
      data.positionTitle,
      data.entryDate,
      now,
      now,
    );

    // Regra §9: nunca permitir autodeclaração de permissões administrativas
    db.prepare(
      'INSERT INTO user_roles (user_id, role_code, scope_unit, granted_at) VALUES (?, ?, ?, ?)',
    ).run(userId, 'usuario_regular', data.organizationalUnit, now);

    // Vinculação opcional a protocolo anterior de pré-ingresso (§9)
    let linkedPreboarding = false;
    if (data.preboardingProtocol) {
      const inv = db
        .prepare('SELECT id FROM invitations WHERE protocol = ? AND lower(email) = ?')
        .get(data.preboardingProtocol.toUpperCase(), emailLower) as {id: string} | undefined;
      if (inv) {
        db.prepare('UPDATE invitations SET linked_user_id = ?, updated_at = ? WHERE id = ?').run(
          userId,
          now,
          inv.id,
        );
        linkedPreboarding = true;
      }
    }

    // Instanciar Jornada de Ambientação padrão para nova conta
    const journeyId = generateId();
    db.prepare(`
      INSERT INTO journeys (
        id, user_id, template_id, cohort_name, expected_entry_date, effective_entry_date,
        operational_stage, current_moment, supervisor_user_id, mentor_name, status, created_at, updated_at
      ) VALUES (?, ?, 'tpl-padrao-90d', 'Turma Atual (Novo Cadastro)', ?, ?, 'embarque', 'acolhimento', 'usr-chefia', 'Patrícia Lemos Ferreira (Fictício)', 'ativa', ?, ?)
    `).run(journeyId, userId, data.entryDate, data.entryDate, now, now);

    const tpl = db
      .prepare('SELECT tasks_json FROM journey_templates WHERE id = ?')
      .get('tpl-padrao-90d') as {tasks_json: string} | undefined;
    if (tpl) {
      const tasks = JSON.parse(tpl.tasks_json) as Array<Record<string, unknown>>;
      const insTask = db.prepare(`
        INSERT INTO journey_tasks (
          id, journey_id, title, description, operational_stage, moment, responsible_actor,
          responsible_unit, is_essential_day1, due_date, depends_on_title, status, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?)
      `);
      tasks.forEach((t, idx) => {
        insTask.run(
          generateId(),
          journeyId,
          String(t.title),
          String(t.description),
          String(t.operationalStage),
          String(t.moment),
          String(t.responsibleActor),
          String(t.responsibleUnit),
          t.isEssentialDay1 ? 1 : 0,
          data.entryDate,
          t.dependsOnTitle ? String(t.dependsOnTitle) : null,
          idx + 1,
        );
      });
    }

    const insAssess = db.prepare(`
      INSERT INTO journey_assessments (id, journey_id, milestone_days, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    [30, 60, 90].forEach((days) => {
      const d = new Date(`${data.entryDate}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      insAssess.run(generateId(), journeyId, days, d.toISOString().slice(0, 10), 'agendada');
    });

    db.prepare(`
      INSERT INTO notifications (id, user_id, category, title, message, link_path, is_operational, is_read, created_at)
      VALUES (?, ?, 'jornada', 'Conta criada no Enap e-Vida', 'Boas-vindas! Explore sua Jornada de Ambientação e as iniciativas da Enap.', '/app/jornada', 1, 0, ?)
    `).run(generateId(), userId, now);

    return {linkedPreboarding};
  });

  const {linkedPreboarding} = tx();
  createSessionForUser(req, res, userId, true);
  const user = hydrateUser(userId, true);

  logAuditEvent({
    actorUserId: userId,
    actorEmail: emailLower,
    action: 'ACCOUNT_REGISTERED',
    resourceType: 'user',
    resourceId: userId,
    metadata: {employmentType: data.employmentType, linkedPreboarding},
  });

  return res.status(201).json({authenticated: true, user, linkedPreboarding});
});

apiRouter.post('/auth/recover-password', rateLimit(15, 60_000), (req, res) => {
  const parsed = z.object({email: z.string().trim().email()}).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({error: 'Informe um endereço de e-mail válido.'});
  }
  logAuditEvent({
    actorEmail: parsed.data.email.toLowerCase(),
    action: 'PASSWORD_RECOVERY_REQUESTED',
    resourceType: 'auth',
    metadata: {mode: 'demonstrativo_sem_envio_externo'},
  });
  // Mensagem neutra contra enumeração de contas (§28)
  return res.json({
    ok: true,
    message:
      'Se o e-mail informado estiver vinculado a uma conta elegível, as instruções de redefinição foram registradas (simulação demonstrativa — nenhum e-mail externo é disparado).',
  });
});

// ============================================================================
// 2. FLUXO "A CAMINHO DA ENAP?" — PRÉ-INGRESSO GAEG NS/NI (§8)
// ============================================================================

apiRouter.get('/preboarding/gaeg-parameters', (_req, res) => {
  const rows = db.prepare('SELECT * FROM gaeg_parameters ORDER BY modality DESC').all() as Array<
    Record<string, unknown>
  >;
  res.json({
    parameters: rows.map((r) => ({
      id: r.id,
      modality: r.modality,
      label: r.label,
      gaegValue: r.gaeg_value,
      maxTotalRemuneration: r.max_total_remuneration,
      declarationText: r.declaration_text,
      legalBasis: r.legal_basis,
      validFrom: r.valid_from,
      validUntil: r.valid_until,
      version: r.version,
      validatedBy: r.validated_by,
      isReferencePrototypeValue: Boolean(r.is_reference_prototype_value),
    })),
  });
});

apiRouter.post('/preboarding/verify-invite', rateLimit(30, 60_000), (req, res) => {
  const parsed = z
    .object({
      code: z.string().trim().min(4, 'Informe o código do convite institucional.'),
      email: z.string().trim().email('Informe o e-mail cadastrado no convite.'),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({error: parsed.error.issues[0]?.message || 'Dados inválidos.'});
  }

  const invite = db
    .prepare(
      `SELECT id, code, email, invitee_name, modality, target_unit, proposed_position,
              status, protocol, draft_json, expires_at
       FROM invitations WHERE upper(code) = ? AND lower(email) = ?`,
    )
    .get(parsed.data.code.toUpperCase(), parsed.data.email.toLowerCase()) as
    | Record<string, unknown>
    | undefined;

  if (!invite) {
    return res.status(404).json({
      error:
        'Convite institucional não localizado para a combinação de código e e-mail informada. Caso precise de apoio, contate a equipe de movimentação da Enap.',
    });
  }

  if (new Date(String(invite.expires_at)).getTime() < Date.now()) {
    return res.status(410).json({error: 'Este convite expirou. Solicite um novo convite institucional.'});
  }

  logAuditEvent({
    actorEmail: String(invite.email),
    action: 'PREBOARDING_INVITE_VERIFIED',
    resourceType: 'invitation',
    resourceId: String(invite.id),
  });

  const storedDraft = String(invite.draft_json || '');
  const draft = storedDraft.startsWith('v1:')
    ? decryptVaultJson(storedDraft)
    : storedDraft ? JSON.parse(storedDraft) : null;

  return res.json({
    invite: {
      id: invite.id,
      code: invite.code,
      email: invite.email,
      inviteeName: invite.invitee_name,
      modality: invite.modality,
      targetUnit: invite.target_unit,
      proposedPosition: invite.proposed_position,
      status: invite.status,
      protocol: invite.protocol,
      draft,
    },
  });
});

apiRouter.post('/preboarding/save-draft', (req, res) => {
  const parsed = z
    .object({
      code: z.string().trim().min(4),
      email: z.string().trim().email(),
      modality: z.enum(['GAEG_NS', 'GAEG_NI']),
      draft: z.record(z.string(), z.unknown()),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({error: 'Dados inválidos para salvar rascunho.'});
  }

  const invite = db
    .prepare('SELECT id, status, expires_at, protocol FROM invitations WHERE upper(code) = ? AND lower(email) = ?')
    .get(parsed.data.code.toUpperCase(), parsed.data.email.toLowerCase()) as
    | {id: string; status: string; expires_at: string; protocol: string | null}
    | undefined;

  if (!invite) {
    return res.status(403).json({error: 'Convite inválido ou não autorizado.'});
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return res.status(410).json({error: 'Este convite expirou. Solicite um novo convite institucional.'});
  }
  if (invite.protocol) {
    return res.status(409).json({error: 'Este convite já possui formulário enviado.', protocol: invite.protocol});
  }

  const now = new Date().toISOString();
  const nextStatus =
    invite.status === 'convite_encaminhado' ? 'preenchimento_iniciado' : invite.status;

  db.prepare(
    'UPDATE invitations SET modality = ?, status = ?, draft_json = ?, updated_at = ? WHERE id = ?',
  ).run(parsed.data.modality, nextStatus, encryptVaultJson(parsed.data.draft), now, invite.id);

  if (invite.status === 'convite_encaminhado') {
    db.prepare(
      `INSERT INTO preboarding_status_history (id, invitation_id, status, note, actor_name, created_at)
       VALUES (?, ?, 'preenchimento_iniciado', 'Preenchimento do formulário preliminar iniciado e rascunho salvo.', ?, ?)`,
    ).run(generateId(), invite.id, parsed.data.email, now);
  }

  return res.json({ok: true, savedAt: now, status: nextStatus});
});

apiRouter.post('/preboarding/submit', rateLimit(15, 60_000), (req, res) => {
  const wrapper = z
    .object({
      code: z.string().trim().min(4),
      email: z.string().trim().email(),
      modality: z.enum(['GAEG_NS', 'GAEG_NI']),
      formData: preboardingSubmissionSchema,
    })
    .safeParse(req.body);

  if (!wrapper.success) {
    return res.status(400).json({
      error: wrapper.error.issues[0]?.message || 'Existem campos obrigatórios ou inválidos no formulário.',
      issues: wrapper.error.issues,
    });
  }

  const {code, email, modality, formData} = wrapper.data;
  const invite = db
    .prepare('SELECT id, protocol, assigned_to_user_id, expires_at FROM invitations WHERE upper(code) = ? AND lower(email) = ?')
    .get(code.toUpperCase(), email.toLowerCase()) as
    | {id: string; protocol: string | null; assigned_to_user_id: string | null; expires_at: string}
    | undefined;

  if (!invite) {
    return res.status(403).json({error: 'Convite institucional inválido.'});
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return res.status(410).json({error: 'Este convite expirou. Solicite um novo convite institucional.'});
  }
  if (invite.protocol) {
    return res.status(409).json({
      error: 'Este convite já possui formulário enviado.',
      protocol: invite.protocol,
    });
  }

  const param = db
    .prepare('SELECT version FROM gaeg_parameters WHERE modality = ?')
    .get(modality) as {version: string} | undefined;
  const paramVersion = param?.version || '1.0-doc-ref';

  const now = new Date().toISOString();
  const protocol = generateProtocol('ENAP-PRE');
  const submissionId = generateId();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO preboarding_submissions (
        id, invitation_id, protocol, modality, form_version, nome, cpf_masked,
        naturalidade_uf, data_nascimento, rg_masked, orgao_expedidor, escolaridade, formacao,
        residences_json, endereco_atual, telefone_particular, orgao_origem, cargo_efetivo,
        matricula_siape, ingresso_servico_publico, estagio_probatorio_concluido, esta_em_pgd,
        modalidade_pgd, proposta_cargo_funcao_enap, orgao_exercicio_atual, selecao_mediante_edital,
        negociacao_previa_cedente, mudanca_domicilio, chefia_nome, chefia_email, chefia_cargo,
        chefia_orgao, remuneration_param_version, remuneration_acknowledged_at,
        privacy_notice_version, privacy_acknowledged_at, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      submissionId,
      invite.id,
      protocol,
      modality,
      '1.0-doc-ref',
      formData.nome,
      maskCpf(formData.cpf),
      formData.naturalidadeUf,
      formData.dataNascimento,
      `****${formData.rg.slice(-3)}`,
      formData.orgaoExpedidor,
      formData.escolaridade,
      formData.formacao,
      JSON.stringify(formData.residenciasUltimos10Anos),
      formData.enderecoAtual,
      formData.telefoneParticular,
      formData.orgaoOrigem,
      formData.cargoEfetivo,
      formData.matriculaSiape,
      formData.ingressoServicoPublico,
      formData.estagioProbatorioConcluido,
      formData.estaEmPgd,
      formData.estaEmPgd === 'SIM' ? formData.modalidadePgd : null,
      formData.propostaCargoFuncaoEnap,
      formData.orgaoExercicioAtual,
      formData.selecaoMedianteEdital,
      formData.negociacaoPreviaCedente,
      formData.mudancaDomicilio,
      formData.chefiaNome,
      formData.chefiaEmail,
      formData.chefiaCargo,
      formData.chefiaOrgao,
      paramVersion,
      now,
      'LGPD-PRE-1.0',
      now,
      now,
    );

    // Compartimento segregado e cifrado AES-256-GCM para dados bancários (§8.3)
    db.prepare(`
      INSERT INTO restricted_bank_details (id, submission_id, account_type, bank_name, account_masked, encrypted_payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      submissionId,
      formData.tipoConta,
      formData.banco,
      maskBankAccount(formData.contaBancaria),
      encryptVaultJson({
        tipoConta: formData.tipoConta,
        banco: formData.banco,
        agenciaComDv: formData.agenciaComDv,
        contaBancaria: formData.contaBancaria,
      }),
      now,
    );

    // Compartimento segregado e cifrado para atributos sensíveis e documentos civis completos
    db.prepare(`
      INSERT INTO restricted_sensitive_attributes (id, submission_id, encrypted_payload, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      generateId(),
      submissionId,
      encryptVaultJson({
        cpf: formData.cpf,
        rg: formData.rg,
        filiacao: formData.filiacao,
        tituloEleitor: formData.tituloEleitor,
        racaCor: formData.racaCor,
        entradaPorCotas: formData.entradaPorCotas,
        pessoaComDeficiencia: formData.pessoaComDeficiencia,
      }),
      now,
    );

    db.prepare(
      `UPDATE invitations SET modality = ?, status = 'formulario_recebido', protocol = ?, draft_json = NULL, updated_at = ? WHERE id = ?`,
    ).run(modality, protocol, now, invite.id);

    db.prepare(
      `INSERT INTO preboarding_status_history (id, invitation_id, status, note, actor_name, created_at)
       VALUES (?, ?, 'formulario_recebido', 'Formulário de dados preliminares recebido com ciência remuneratória registrada.', ?, ?)`,
    ).run(generateId(), invite.id, formData.nome, now);

    // Notificar exclusivamente o perfil administrativo autorizado (sem dados bancários ou sensíveis — §8.4)
    const targetAdmin = invite.assigned_to_user_id || 'usr-pre-resp';
    db.prepare(`
      INSERT INTO notifications (id, user_id, category, title, message, link_path, is_operational, is_read, created_at)
      VALUES (?, ?, 'pre_ingresso', 'Novo formulário de pré-ingresso recebido', ?, '/admin/pre-ingresso', 1, 0, ?)
    `).run(
      generateId(),
      targetAdmin,
      `Protocolo ${protocol} (${modality === 'GAEG_NS' ? 'GAEG Nível Superior' : 'GAEG Nível Intermediário'}) aguardando conferência.`,
      now,
    );
  });

  tx();

  logAuditEvent({
    actorEmail: email.toLowerCase(),
    action: 'PREBOARDING_FORM_SUBMITTED',
    resourceType: 'preboarding_submission',
    resourceId: submissionId,
    metadata: {protocol, modality, remunerationParamVersion: paramVersion},
  });

  // Comprovante resumido sem dados bancários ou sensíveis (§8.4)
  return res.status(201).json({
    protocol,
    submittedAt: now,
    modality,
    formVersion: '1.0-doc-ref',
    remunerationParamVersion: paramVersion,
    receipt: {
      nome: formData.nome,
      cpfMasked: maskCpf(formData.cpf),
      orgaoOrigem: formData.orgaoOrigem,
      propostaCargoFuncaoEnap: formData.propostaCargoFuncaoEnap,
      chefiaNome: formData.chefiaNome,
      bankSegregatedNotice: 'Informações bancárias armazenadas em compartimento segregado e cifrado (ocultas neste comprovante).',
    },
  });
});

apiRouter.post('/preboarding/track', rateLimit(30, 60_000), (req, res) => {
  const parsed = z
    .object({
      protocol: z.string().trim().min(5, 'Informe o número de protocolo.'),
      email: z.string().trim().email('Informe o e-mail vinculado ao processo.'),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({error: parsed.error.issues[0]?.message || 'Dados inválidos.'});
  }

  const inv = db
    .prepare(
      `SELECT id, code, email, invitee_name, modality, target_unit, proposed_position, status, protocol, updated_at
       FROM invitations WHERE upper(protocol) = ? AND lower(email) = ?`,
    )
    .get(parsed.data.protocol.toUpperCase(), parsed.data.email.toLowerCase()) as
    | Record<string, unknown>
    | undefined;

  if (!inv) {
    return res.status(404).json({
      error: 'Nenhum acompanhamento localizado para este protocolo e e-mail.',
    });
  }

  const history = db
    .prepare(
      `SELECT id, status, note, actor_name, created_at
       FROM preboarding_status_history WHERE invitation_id = ? ORDER BY created_at ASC`,
    )
    .all(inv.id);

  return res.json({
    caseInfo: {
      protocol: inv.protocol,
      inviteeName: inv.invitee_name,
      modality: inv.modality,
      targetUnit: inv.target_unit,
      proposedPosition: inv.proposed_position,
      status: inv.status,
      updatedAt: inv.updated_at,
    },
    history,
  });
});

// ============================================================================
// 3. AMBIENTE LOGADO — INÍCIO, BUSCA E JORNADA DE AMBIENTAÇÃO (§11, §13)
// ============================================================================

apiRouter.get('/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;

  const journey = db
    .prepare('SELECT * FROM journeys WHERE user_id = ?')
    .get(user.id) as Record<string, unknown> | undefined;

  let journeySummary = null;
  if (journey) {
    const tasks = db
      .prepare('SELECT * FROM journey_tasks WHERE journey_id = ? ORDER BY sort_order ASC')
      .all(journey.id) as Array<Record<string, unknown>>;
    const completed = tasks.filter((t) => t.status === 'concluida').length;
    const nextTasks = tasks.filter((t) => t.status !== 'concluida').slice(0, 3);
    const openAssessments = db
      .prepare(
        `SELECT id, milestone_days, scheduled_date, status FROM journey_assessments
         WHERE journey_id = ? AND status = 'disponivel'`,
      )
      .all(journey.id);

    // Após 90 dias (gestao_continua), preservar histórico sem manter pendências inaplicáveis (§11)
    const isCompletedCycle = journey.status === 'concluida' || journey.operational_stage === 'gestao_continua';

    journeySummary = {
      id: journey.id,
      cohortName: journey.cohort_name,
      entryDate: journey.effective_entry_date || journey.expected_entry_date,
      operationalStage: journey.operational_stage,
      currentMoment: journey.current_moment,
      mentorName: journey.mentor_name,
      status: journey.status,
      isCompletedCycle,
      totalTasks: tasks.length,
      completedTasks: completed,
      progressPercent: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
      nextTasks: isCompletedCycle ? [] : nextTasks,
      openAssessments: isCompletedCycle ? [] : openAssessments,
    };
  }

  // Tarefas como chefia (para perfil chefia)
  const supervisorTasks = hasPermission(user.roles, 'journey:supervisor_tasks')
    ? db
        .prepare(
          `SELECT jt.id, jt.title, jt.due_date, jt.status, jt.moment, u.full_name as newcomer_name, u.organizational_unit
           FROM journey_tasks jt
           JOIN journeys j ON j.id = jt.journey_id
           JOIN users u ON u.id = j.user_id
           WHERE jt.responsible_actor = 'chefia' AND jt.status != 'concluida'
           ORDER BY jt.due_date ASC LIMIT 5`,
        )
        .all()
    : [];

  const upcomingActivities = db
    .prepare(
      `SELECT a.*, (SELECT COUNT(*) FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.status = 'confirmada') as enrolled_count,
              (SELECT status FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.user_id = ?) as my_status
       FROM activities a WHERE a.status = 'aberta' ORDER BY a.featured DESC, a.next_session_iso ASC LIMIT 3`,
    )
    .all(user.id);

  const upcomingEvents = db
    .prepare(
      `SELECT e.*, (SELECT status FROM event_registrations er WHERE er.event_id = e.id AND er.user_id = ?) as my_status
       FROM events e WHERE e.status = 'publicado' ORDER BY e.start_iso ASC LIMIT 3`,
    )
    .all(user.id);

  const openSurveys = db
    .prepare(
      `SELECT s.id, s.title, s.purpose, s.closes_at, s.anonymity_mode,
              EXISTS(SELECT 1 FROM survey_eligibility se WHERE se.survey_id = s.id AND se.user_id = ?) as already_answered
       FROM surveys s WHERE s.status = 'aberta' ORDER BY s.closes_at ASC`,
    )
    .all(user.id);

  const announcements = db
    .prepare("SELECT * FROM announcements WHERE editorial_status = 'publicado' ORDER BY published_at DESC LIMIT 3")
    .all();

  const unreadNotifications = (
    db
      .prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(user.id) as {c: number}
  ).c;

  res.json({
    journeySummary,
    supervisorTasks,
    upcomingActivities,
    upcomingEvents,
    openSurveys,
    announcements,
    unreadNotifications,
  });
});

apiRouter.get('/search', requireAuth, (req: AuthenticatedRequest, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({results: []});
  const like = `%${q}%`;

  const activities = db
    .prepare('SELECT id, title, category FROM activities WHERE title LIKE ? OR description LIKE ? LIMIT 5')
    .all(like, like)
    .map((a: any) => ({type: 'Atividade PQVT', title: a.title, subtitle: a.category, path: `/app/atividades/${a.id}`}));

  const events = db
    .prepare('SELECT id, title, category FROM events WHERE title LIKE ? OR description LIKE ? LIMIT 5')
    .all(like, like)
    .map((e: any) => ({type: 'Evento', title: e.title, subtitle: e.category, path: `/app/eventos/${e.id}`}));

  const canRestricted = hasPermission(req.user!.roles, 'admin:access');
  const docs = db
    .prepare(
      `SELECT id, title, category FROM documents
       WHERE (title LIKE ? OR description LIKE ? OR keywords LIKE ?)
       AND (? = 1 OR is_restricted = 0) LIMIT 5`,
    )
    .all(like, like, like, canRestricted ? 1 : 0)
    .map((d: any) => ({type: 'Repositório', title: d.title, subtitle: d.category, path: `/app/repositorio?doc=${d.id}`}));

  const surveys = db
    .prepare('SELECT id, title, anonymity_mode FROM surveys WHERE title LIKE ? OR purpose LIKE ? LIMIT 4')
    .all(like, like)
    .map((s: any) => ({type: 'Enquete', title: s.title, subtitle: `Modo: ${s.anonymity_mode}`, path: `/app/enquetes/${s.id}`}));

  res.json({results: [...activities, ...events, ...docs, ...surveys]});
});

// Jornada do usuário logado
apiRouter.get('/journey/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const journey = db.prepare('SELECT * FROM journeys WHERE user_id = ?').get(user.id) as
    | Record<string, unknown>
    | undefined;

  const supervisorTasks = hasPermission(user.roles, 'journey:supervisor_tasks')
    ? db
        .prepare(
          `SELECT jt.*, u.full_name as newcomer_name, u.organizational_unit as newcomer_unit
           FROM journey_tasks jt
           JOIN journeys j ON j.id = jt.journey_id
           JOIN users u ON u.id = j.user_id
           WHERE jt.responsible_actor = 'chefia'
           ORDER BY jt.status ASC, jt.due_date ASC`,
        )
        .all()
    : [];

  if (!journey) {
    return res.json({journey: null, tasks: [], assessments: [], supportRequests: [], supervisorTasks});
  }

  const tasks = db
    .prepare('SELECT * FROM journey_tasks WHERE journey_id = ? ORDER BY sort_order ASC')
    .all(journey.id);
  const assessments = db
    .prepare("SELECT * FROM journey_assessments WHERE journey_id = ? AND id NOT LIKE 'hist-%' ORDER BY milestone_days ASC")
    .all(journey.id);
  const supportRequests = db
    .prepare('SELECT * FROM journey_support_requests WHERE journey_id = ? ORDER BY created_at DESC')
    .all(journey.id);
  const journeyEvents = db
    .prepare("SELECT * FROM events WHERE source_module = 'jornada' ORDER BY start_iso ASC")
    .all();

  res.json({journey, tasks, assessments, supportRequests, journeyEvents, supervisorTasks});
});

apiRouter.patch('/journey/tasks/:taskId', requireAuth, (req: AuthenticatedRequest, res) => {
  const {taskId} = req.params;
  const parsed = z.object({status: z.enum(['pendente', 'em_andamento', 'concluida'])}).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Status inválido.'});

  const task = db
    .prepare(
      `SELECT jt.*, j.user_id as journey_owner_id
       FROM journey_tasks jt JOIN journeys j ON j.id = jt.journey_id
       WHERE jt.id = ?`,
    )
    .get(taskId) as Record<string, unknown> | undefined;

  if (!task) return res.status(404).json({error: 'Tarefa não encontrada.'});

  // Proteção contra IDOR/BOLA (§28): somente titular da jornada, chefia da tarefa ou gestor da ambientação
  const isOwner = task.journey_owner_id === req.user!.id;
  const isSupervisor = task.responsible_actor === 'chefia' && hasPermission(req.user!.roles, 'journey:supervisor_tasks');
  const isJourneyManager = hasPermission(req.user!.roles, 'journey:manage');

  if (!isOwner && !isSupervisor && !isJourneyManager) {
    return res.status(403).json({error: 'Você não tem permissão para alterar esta tarefa.'});
  }

  const now = new Date().toISOString();
  const completedAt = parsed.data.status === 'concluida' ? now : null;
  const onTime =
    parsed.data.status === 'concluida'
      ? new Date(now) <= new Date(`${String(task.due_date)}T23:59:59Z`)
        ? 1
        : 0
      : null;

  db.prepare(
    'UPDATE journey_tasks SET status = ?, completed_at = ?, completed_on_time = ? WHERE id = ?',
  ).run(parsed.data.status, completedAt, onTime, taskId);

  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'JOURNEY_TASK_UPDATED',
    resourceType: 'journey_task',
    resourceId: taskId,
    metadata: {status: parsed.data.status},
  });

  res.json({ok: true, status: parsed.data.status, completedAt});
});

apiRouter.post('/journey/assessments/:assessmentId/submit', requireAuth, (req: AuthenticatedRequest, res) => {
  const {assessmentId} = req.params;
  const parsed = z
    .object({
      roleClarityScore: z.number().int().min(1).max(5),
      teamSupportScore: z.number().int().min(1).max(5),
      supervisorSupportScore: z.number().int().min(1).max(5),
      belongingScore: z.number().int().min(1).max(5),
      expectationsMetScore: z.number().int().min(1).max(5),
      qualitativeComment: z.string().trim().max(1000).optional().default(''),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({error: 'Preencha todas as escalas de 1 a 5.'});
  }

  const assess = db
    .prepare(
      `SELECT ja.*, j.user_id as owner_id
       FROM journey_assessments ja JOIN journeys j ON j.id = ja.journey_id
       WHERE ja.id = ?`,
    )
    .get(assessmentId) as Record<string, unknown> | undefined;

  if (!assess) return res.status(404).json({error: 'Avaliação não encontrada.'});
  if (assess.owner_id !== req.user!.id) {
    return res.status(403).json({error: 'Você só pode responder suas próprias avaliações.'});
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE journey_assessments
    SET status = 'respondida', role_clarity_score = ?, team_support_score = ?,
        supervisor_support_score = ?, belonging_score = ?, expectations_met_score = ?,
        qualitative_comment = ?, submitted_at = ?
    WHERE id = ?
  `).run(
    parsed.data.roleClarityScore,
    parsed.data.teamSupportScore,
    parsed.data.supervisorSupportScore,
    parsed.data.belongingScore,
    parsed.data.expectationsMetScore,
    parsed.data.qualitativeComment,
    now,
    assessmentId,
  );

  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'JOURNEY_ASSESSMENT_SUBMITTED',
    resourceType: 'journey_assessment',
    resourceId: assessmentId,
    metadata: {milestoneDays: assess.milestone_days},
  });

  res.json({ok: true, submittedAt: now});
});

apiRouter.post('/journey/support', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      category: z.string().trim().min(2),
      subject: z.string().trim().min(4, 'Informe um assunto objetivo.'),
      description: z.string().trim().min(10, 'Descreva brevemente a dificuldade para direcionarmos o apoio.'),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({error: parsed.error.issues[0]?.message || 'Dados inválidos.'});
  }

  const journey = db.prepare('SELECT id FROM journeys WHERE user_id = ?').get(req.user!.id) as
    | {id: string}
    | undefined;
  if (!journey) {
    return res.status(400).json({error: 'Nenhuma jornada ativa vinculada à sua conta.'});
  }

  const id = generateId();
  const now = new Date().toISOString();
  const unitByCategory: Record<string, string> = {
    'Acessos e sistemas': 'CGTI',
    'Equipamentos e infraestrutura': 'DGC / Logística',
    'Orientações institucionais': 'CGP / Ambientação',
    'Aprendizagem e clareza de atribuições': 'Chefia / CGP',
    'Integração e convivência': 'PQVT / CGP',
    Acessibilidade: 'Comitê DEI / DGC',
    'Outros assuntos pertinentes': 'CGP / Ambientação',
  };
  const assignedUnit = unitByCategory[parsed.data.category] || 'CGP / Ambientação';

  db.prepare(`
    INSERT INTO journey_support_requests (
      id, journey_id, user_id, category, subject, description, status, assigned_unit, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'aberta', ?, ?)
  `).run(id, journey.id, req.user!.id, parsed.data.category, parsed.data.subject, parsed.data.description, assignedUnit, now);

  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'JOURNEY_SUPPORT_CREATED',
    resourceType: 'journey_support_request',
    resourceId: id,
    metadata: {category: parsed.data.category, assignedUnit},
  });

  res.status(201).json({id, status: 'aberta', assignedUnit, createdAt: now});
});

// ============================================================================
// 4. MÓDULO PQVT — ATIVIDADES FÍSICAS, ESPORTIVAS E DE LAZER (§14)
// ============================================================================

apiRouter.get('/activities', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const rows = db
    .prepare(
      `SELECT a.*,
              (SELECT COUNT(*) FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.status = 'confirmada') as enrolled_count,
              (SELECT COUNT(*) FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.status = 'lista_espera') as waitlist_count,
              (SELECT status FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.user_id = ?) as my_status,
              (SELECT checkin_code FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.user_id = ?) as my_checkin_code,
              (SELECT attendance_confirmed FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.user_id = ?) as my_attendance,
              EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = ? AND f.item_type = 'activity' AND f.item_id = a.id) as is_favorite
       FROM activities a ORDER BY a.featured DESC, a.next_session_iso ASC`,
    )
    .all(userId, userId, userId, userId);

  res.json({activities: rows});
});

apiRouter.get('/activities/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const activity = db
    .prepare(
      `SELECT a.*,
              (SELECT COUNT(*) FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.status = 'confirmada') as enrolled_count,
              (SELECT COUNT(*) FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.status = 'lista_espera') as waitlist_count,
              (SELECT status FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.user_id = ?) as my_status,
              (SELECT checkin_code FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.user_id = ?) as my_checkin_code,
              (SELECT attendance_confirmed FROM activity_registrations ar WHERE ar.activity_id = a.id AND ar.user_id = ?) as my_attendance,
              EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = ? AND f.item_type = 'activity' AND f.item_id = a.id) as is_favorite
       FROM activities a WHERE a.id = ?`,
    )
    .get(userId, userId, userId, userId, req.params.id);

  if (!activity) return res.status(404).json({error: 'Atividade não encontrada.'});

  const myFeedback = db
    .prepare('SELECT rating, comment, created_at FROM activity_feedback WHERE activity_id = ? AND user_id = ?')
    .get(req.params.id, userId);

  res.json({activity, myFeedback: myFeedback || null});
});

// Transação atômica para controle de vagas e lista de espera (§14)
apiRouter.post('/activities/:id/register', requireAuth, (req: AuthenticatedRequest, res) => {
  const activityId = req.params.id;
  const userId = req.user!.id;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    const act = db
      .prepare('SELECT id, title, capacity, status FROM activities WHERE id = ?')
      .get(activityId) as {id: string; title: string; capacity: number; status: string} | undefined;
    if (!act) throw Object.assign(new Error('Atividade não encontrada.'), {statusCode: 404});
    if (act.status !== 'aberta') throw Object.assign(new Error('Inscrições encerradas para esta atividade.'), {statusCode: 400});

    const existing = db
      .prepare('SELECT id, status FROM activity_registrations WHERE activity_id = ? AND user_id = ?')
      .get(activityId, userId) as {id: string; status: string} | undefined;

    if (existing && (existing.status === 'confirmada' || existing.status === 'lista_espera')) {
      return {status: existing.status, alreadyRegistered: true, title: act.title};
    }

    const enrolled = (
      db
        .prepare("SELECT COUNT(*) as c FROM activity_registrations WHERE activity_id = ? AND status = 'confirmada'")
        .get(activityId) as {c: number}
    ).c;

    const assignedStatus = enrolled < act.capacity ? 'confirmada' : 'lista_espera';
    const checkinCode = assignedStatus === 'confirmada' ? `QR-${generateId().slice(0, 8).toUpperCase()}` : null;

    if (existing) {
      db.prepare(
        'UPDATE activity_registrations SET status = ?, checkin_code = ?, updated_at = ? WHERE id = ?',
      ).run(assignedStatus, checkinCode, now, existing.id);
    } else {
      db.prepare(`
        INSERT INTO activity_registrations (id, activity_id, user_id, status, attendance_confirmed, checkin_code, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)
      `).run(generateId(), activityId, userId, assignedStatus, checkinCode, now, now);
    }

    db.prepare(`
      INSERT INTO notifications (id, user_id, category, title, message, link_path, is_operational, is_read, created_at)
      VALUES (?, ?, 'atividades', ?, ?, ?, 0, 0, ?)
    `).run(
      generateId(),
      userId,
      assignedStatus === 'confirmada' ? 'Inscrição confirmada no PQVT' : 'Inclusão na lista de espera',
      assignedStatus === 'confirmada'
        ? `Sua vaga em "${act.title}" foi confirmada.`
        : `As vagas de "${act.title}" estão preenchidas no momento. Você entrou na lista de espera.`,
      `/app/atividades/${activityId}`,
      now,
    );

    return {status: assignedStatus, checkinCode, alreadyRegistered: false, title: act.title};
  });

  try {
    const result = tx();
    logAuditEvent({
      actorUserId: userId,
      actorEmail: req.user!.email,
      action: 'PQVT_ACTIVITY_REGISTERED',
      resourceType: 'activity',
      resourceId: activityId,
      metadata: {status: result.status},
    });
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({error: err.message || 'Erro ao realizar inscrição.'});
  }
});

apiRouter.post('/activities/:id/cancel', requireAuth, (req: AuthenticatedRequest, res) => {
  const activityId = req.params.id;
  const userId = req.user!.id;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    const existing = db
      .prepare('SELECT id, status FROM activity_registrations WHERE activity_id = ? AND user_id = ?')
      .get(activityId, userId) as {id: string; status: string} | undefined;
    if (!existing || existing.status === 'cancelada') {
      throw Object.assign(new Error('Nenhuma inscrição ativa encontrada.'), {statusCode: 404});
    }

    const wasConfirmed = existing.status === 'confirmada';
    db.prepare(
      "UPDATE activity_registrations SET status = 'cancelada', checkin_code = NULL, updated_at = ? WHERE id = ?",
    ).run(now, existing.id);

    // Promoção automática da lista de espera em transação atômica (§14)
    let promotedUserId: string | null = null;
    if (wasConfirmed) {
      const nextInLine = db
        .prepare(
          `SELECT id, user_id FROM activity_registrations
           WHERE activity_id = ? AND status = 'lista_espera'
           ORDER BY created_at ASC LIMIT 1`,
        )
        .get(activityId) as {id: string; user_id: string} | undefined;

      if (nextInLine) {
        const newCode = `QR-${generateId().slice(0, 8).toUpperCase()}`;
        db.prepare(
          "UPDATE activity_registrations SET status = 'confirmada', checkin_code = ?, updated_at = ? WHERE id = ?",
        ).run(newCode, now, nextInLine.id);
        promotedUserId = nextInLine.user_id;

        const act = db.prepare('SELECT title FROM activities WHERE id = ?').get(activityId) as {title: string};
        db.prepare(`
          INSERT INTO notifications (id, user_id, category, title, message, link_path, is_operational, is_read, created_at)
          VALUES (?, ?, 'atividades', 'Vaga liberada na lista de espera!', ?, ?, 1, 0, ?)
        `).run(
          generateId(),
          nextInLine.user_id,
          `Sua inscrição em "${act.title}" foi promovida da lista de espera para confirmada.`,
          `/app/atividades/${activityId}`,
          now,
        );
      }
    }
    return {ok: true, promotedWaitlist: Boolean(promotedUserId)};
  });

  try {
    const result = tx();
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({error: err.message});
  }
});

apiRouter.post('/activities/:id/feedback', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().min(3, 'Escreva um breve comentário sobre a experiência.').max(600),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: parsed.error.issues[0]?.message});

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO activity_feedback (id, activity_id, user_id, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(activity_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment
  `).run(generateId(), req.params.id, req.user!.id, parsed.data.rating, parsed.data.comment, now);

  res.json({ok: true});
});

// Favoritos (atividades e documentos)
apiRouter.post('/favorites/toggle', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({itemType: z.enum(['activity', 'document']), itemId: z.string().min(1)})
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Parâmetros inválidos.'});

  const exists = db
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .get(req.user!.id, parsed.data.itemType, parsed.data.itemId);

  if (exists) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?').run(
      req.user!.id,
      parsed.data.itemType,
      parsed.data.itemId,
    );
    return res.json({favorited: false});
  }
  db.prepare('INSERT INTO favorites (user_id, item_type, item_id, created_at) VALUES (?, ?, ?, ?)').run(
    req.user!.id,
    parsed.data.itemType,
    parsed.data.itemId,
    new Date().toISOString(),
  );
  return res.json({favorited: true});
});

// ============================================================================
// 5. MÓDULO EVENTOS (AGENDA INSTITUCIONAL INTEGRADA + ICS — §16)
// ============================================================================

apiRouter.get('/events', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const rows = db
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'confirmada') as enrolled_count,
              (SELECT status FROM event_registrations er WHERE er.event_id = e.id AND er.user_id = ?) as my_status
       FROM events e WHERE e.status = 'publicado' ORDER BY e.start_iso ASC`,
    )
    .all(userId);
  res.json({events: rows});
});

apiRouter.get('/events/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const row = db
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'confirmada') as enrolled_count,
              (SELECT status FROM event_registrations er WHERE er.event_id = e.id AND er.user_id = ?) as my_status
       FROM events e WHERE e.id = ?`,
    )
    .get(userId, req.params.id);
  if (!row) return res.status(404).json({error: 'Evento não encontrado.'});
  res.json({event: row});
});

apiRouter.post('/events/:id/register', requireAuth, (req: AuthenticatedRequest, res) => {
  const evt = db.prepare('SELECT id, title, capacity FROM events WHERE id = ?').get(req.params.id) as
    | {id: string; title: string; capacity: number | null}
    | undefined;
  if (!evt) return res.status(404).json({error: 'Evento não encontrado.'});

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO event_registrations (id, event_id, user_id, status, attendance_confirmed, created_at)
    VALUES (?, ?, ?, 'confirmada', 0, ?)
    ON CONFLICT(event_id, user_id) DO UPDATE SET status = 'confirmada'
  `).run(generateId(), evt.id, req.user!.id, now);

  res.json({ok: true, status: 'confirmada'});
});

apiRouter.post('/events/:id/cancel', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?').run(
    req.params.id,
    req.user!.id,
  );
  res.json({ok: true});
});

apiRouter.get('/events/:id/ics', requireAuth, (req: AuthenticatedRequest, res) => {
  const evt = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!evt) return res.status(404).json({error: 'Evento não encontrado.'});

  const ics = buildEventIcs({
    id: String(evt.id),
    title: String(evt.title),
    description: String(evt.description),
    location: String(evt.location),
    startIso: String(evt.start_iso),
    endIso: String(evt.end_iso),
    organizer: String(evt.organizer),
  });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="enap-evento-${evt.id}.ics"`);
  res.send(ics);
});

// ============================================================================
// 6. MÓDULO FALA, ENAP! (§15)
// ============================================================================

apiRouter.get('/fala-enap', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const mine = db
    .prepare('SELECT * FROM feedback_submissions WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
  const whatChanged = db
    .prepare(
      `SELECT id, category, title, change_summary, institutional_reply, updated_at
       FROM feedback_submissions WHERE implemented_highlight = 1 ORDER BY updated_at DESC`,
    )
    .all();
  res.json({myContributions: mine, whatChanged});
});

apiRouter.post('/fala-enap', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      category: z.string().trim().min(2),
      title: z.string().trim().min(4, 'Informe um título claro para sua contribuição.').max(140),
      description: z.string().trim().min(10, 'Detalhe sua ideia, sugestão ou relato.').max(2000),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: parsed.error.issues[0]?.message});

  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO feedback_submissions (id, user_id, category, title, description, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'recebida', ?, ?)
  `).run(id, req.user!.id, parsed.data.category, parsed.data.title, parsed.data.description, now, now);

  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'FALA_ENAP_SUBMITTED',
    resourceType: 'feedback_submission',
    resourceId: id,
    metadata: {category: parsed.data.category},
  });

  res.status(201).json({id, status: 'recebida', createdAt: now});
});

// ============================================================================
// 7. MÓDULO ENQUETES (SEPARAÇÃO ANÔNIMA + LIMIAR n >= 10 — §17)
// ============================================================================

function computeSurveyAggregates(survey: Record<string, unknown>) {
  const threshold = Number(survey.min_aggregation_threshold || 10);
  const responses = db
    .prepare('SELECT answers_json FROM survey_responses WHERE survey_id = ?')
    .all(survey.id) as Array<{answers_json: string}>;

  const totalResponses = responses.length;
  const suppressed = totalResponses < threshold;
  const questions = JSON.parse(String(survey.questions_json)) as Array<Record<string, any>>;

  if (suppressed) {
    return {
      totalResponses,
      threshold,
      suppressed: true,
      suppressionReason: `Resultados agregados suprimidos até atingir o limiar mínimo configurado de ${threshold} respostas (atual: ${totalResponses}), protegendo contra risco de reidentificação.`,
      questionSummaries: [],
    };
  }

  const parsedAnswers = responses.map((r) => JSON.parse(r.answers_json) as Record<string, any>);
  const questionSummaries = questions.map((q) => {
    if (q.type === 'single_choice' || q.type === 'likert') {
      const counts: Record<string, number> = {};
      for (const opt of q.options || []) counts[opt] = 0;
      for (const ans of parsedAnswers) {
        const val = ans[q.id];
        if (val && counts[val] !== undefined) counts[val] += 1;
        else if (val) counts[val] = (counts[val] || 0) + 1;
      }
      return {
        questionId: q.id,
        label: q.label,
        type: q.type,
        data: Object.entries(counts).map(([name, value]) => ({
          name,
          value,
          percent: Math.round((value / totalResponses) * 100),
        })),
      };
    }
    if (q.type === 'multiple_choice') {
      const counts: Record<string, number> = {};
      for (const opt of q.options || []) counts[opt] = 0;
      for (const ans of parsedAnswers) {
        const vals = Array.isArray(ans[q.id]) ? ans[q.id] : [];
        for (const v of vals) counts[v] = (counts[v] || 0) + 1;
      }
      return {
        questionId: q.id,
        label: q.label,
        type: q.type,
        data: Object.entries(counts).map(([name, value]) => ({
          name,
          value,
          percent: Math.round((value / totalResponses) * 100),
        })),
      };
    }
    if (q.type === 'rating' || q.type === 'numeric') {
      const nums = parsedAnswers.map((a) => Number(a[q.id])).filter((n) => !Number.isNaN(n));
      const avg = nums.length > 0 ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)) : null;
      return {questionId: q.id, label: q.label, type: q.type, average: avg, responsesCount: nums.length};
    }
    const textCount = parsedAnswers.filter((a) => String(a[q.id] || '').trim().length > 0).length;
    return {
      questionId: q.id,
      label: q.label,
      type: q.type,
      textResponsesCount: textCount,
      note: 'Respostas textuais livres são analisadas de forma consolidada pela equipe para evitar exposição individual.',
    };
  });

  return {totalResponses, threshold, suppressed: false, questionSummaries};
}

apiRouter.get('/surveys', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const rows = db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM survey_responses sr WHERE sr.survey_id = s.id) as response_count,
              EXISTS(SELECT 1 FROM survey_eligibility se WHERE se.survey_id = s.id AND se.user_id = ?) as already_answered
       FROM surveys s ORDER BY s.status ASC, s.closes_at ASC`,
    )
    .all(userId);
  res.json({surveys: rows});
});

apiRouter.get('/surveys/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!survey) return res.status(404).json({error: 'Enquete não encontrada.'});

  const alreadyAnswered = Boolean(
    db
      .prepare('SELECT 1 FROM survey_eligibility WHERE survey_id = ? AND user_id = ?')
      .get(survey.id, userId),
  );
  const canSeeResults = Boolean(survey.show_results_to_users) || hasPermission(req.user!.roles, 'surveys:manage');
  const aggregates = canSeeResults ? computeSurveyAggregates(survey) : null;

  res.json({
    survey: {
      ...survey,
      questions: JSON.parse(String(survey.questions_json)),
      alreadyAnswered,
    },
    aggregates,
  });
});

apiRouter.post('/surveys/:id/respond', requireAuth, (req: AuthenticatedRequest, res) => {
  const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!survey) return res.status(404).json({error: 'Enquete não encontrada.'});
  if (survey.status !== 'aberta') return res.status(400).json({error: 'Esta enquete já foi encerrada.'});

  const parsed = z.object({answers: z.record(z.string(), z.any())}).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Respostas inválidas.'});

  const already = db
    .prepare('SELECT 1 FROM survey_eligibility WHERE survey_id = ? AND user_id = ?')
    .get(survey.id, req.user!.id);
  if (already) {
    return res.status(409).json({error: 'Sua participação nesta enquete já foi registrada.'});
  }

  const now = new Date().toISOString();
  const isAnonymous = survey.anonymity_mode === 'anonima';

  const tx = db.transaction(() => {
    // 1. Registra apenas o fato da participação para impedir duplicidade
    db.prepare(
      'INSERT INTO survey_eligibility (survey_id, user_id, participated_at) VALUES (?, ?, ?)',
    ).run(survey.id, req.user!.id, now);

    // 2. Em pesquisas efetivamente anônimas, NÃO armazena user_id na resposta (§17)
    db.prepare(
      'INSERT INTO survey_responses (id, survey_id, user_id, answers_json, submitted_at) VALUES (?, ?, ?, ?, ?)',
    ).run(generateId(), survey.id, isAnonymous ? null : req.user!.id, JSON.stringify(parsed.data.answers), now);
  });
  tx();

  res.status(201).json({ok: true, anonymityMode: survey.anonymity_mode});
});

// ============================================================================
// 8. REPOSITÓRIO, COMITÊ DEI, NOTIFICAÇÕES E MEU PERFIL (§18, §19, §20, §21)
// ============================================================================

apiRouter.get('/repository', requireAuth, (req: AuthenticatedRequest, res) => {
  const canRestricted = hasPermission(req.user!.roles, 'admin:access');
  const docs = db
    .prepare(
      `SELECT d.*,
              EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = ? AND f.item_type = 'document' AND f.item_id = d.id) as is_favorite
       FROM documents d
       WHERE d.editorial_status = 'publicado' AND (? = 1 OR d.is_restricted = 0)
       ORDER BY d.updated_at DESC`,
    )
    .all(req.user!.id, canRestricted ? 1 : 0);
  res.json({documents: docs});
});

apiRouter.get('/comite-dei', requireAuth, (_req, res) => {
  const projects = db.prepare('SELECT * FROM committee_projects ORDER BY created_at DESC').all();
  const events = db
    .prepare("SELECT * FROM events WHERE source_module = 'comite_dei' ORDER BY start_iso ASC")
    .all();
  const docs = db
    .prepare(
      "SELECT * FROM documents WHERE subject LIKE '%Diversidade%' AND is_restricted = 0 ORDER BY updated_at DESC",
    )
    .all();

  // Indicadores agregados institucionais fielmente extraídos do RGI 2025 (págs. 16-17, sem dados individualizados)
  const rgi2025AggregatedMetrics = {
    sourceNote: 'Dados agregados institucionais extraídos do Relatório de Gestão Integrado 2025 (RGI 2025, págs. 16–17). Nenhum registro individualizado é exposto.',
    workforceTotalActive: 411,
    workforceInExercise: 396,
    genderDistribution: [
      {label: 'Mulheres em exercício', count: 234, percent: 59},
      {label: 'Homens em exercício', count: 162, percent: 41},
    ],
    leadershipGender: [
      {label: 'Mulheres em posições de liderança', percent: 62},
      {label: 'Homens em posições de liderança', percent: 38},
    ],
    leadershipBlackPercent: 34,
    pgdDistribution: [
      {label: 'Teletrabalho parcial', count: 160, percent: 55},
      {label: 'Teletrabalho integral', count: 99, percent: 34},
      {label: 'Presencial', count: 27, percent: 9},
      {label: 'Teletrabalho no exterior', count: 7, percent: 2},
    ],
  };

  res.json({projects, events, documents: docs, rgi2025AggregatedMetrics});
});

apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(req.user!.id);
  res.json({notifications: rows});
});

apiRouter.patch('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
    req.params.id,
    req.user!.id,
  );
  res.json({ok: true});
});

apiRouter.post('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ok: true});
});

apiRouter.get('/profile/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const sessions = db
    .prepare(
      `SELECT id, user_agent, ip_address, last_activity_at, created_at
       FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_activity_at DESC`,
    )
    .all(userId)
    .map((s: any) => ({...s, isCurrent: s.id === req.sessionId}));

  const myActivities = db
    .prepare(
      `SELECT a.id, a.title, a.schedule_summary, a.location, ar.status, ar.checkin_code
       FROM activity_registrations ar JOIN activities a ON a.id = ar.activity_id
       WHERE ar.user_id = ? AND ar.status != 'cancelada' ORDER BY ar.updated_at DESC`,
    )
    .all(userId);

  const myEvents = db
    .prepare(
      `SELECT e.id, e.title, e.start_iso, e.location, er.status
       FROM event_registrations er JOIN events e ON e.id = er.event_id
       WHERE er.user_id = ? ORDER BY e.start_iso ASC`,
    )
    .all(userId);

  const myFavorites = db
    .prepare('SELECT item_type, item_id, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);

  const myContributions = db
    .prepare('SELECT id, category, title, status, created_at FROM feedback_submissions WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);

  res.json({
    profile: req.user,
    sessions,
    myActivities,
    myEvents,
    myFavorites,
    myContributions,
  });
});

apiRouter.patch('/profile/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      preferredName: z.string().trim().min(2).max(60).optional(),
      socialName: z.string().trim().max(120).nullable().optional(),
      accessibilityPrefs: z
        .object({
          largeText: z.boolean(),
          highContrast: z.boolean(),
          reducedMotion: z.boolean(),
        })
        .optional(),
      notificationPrefs: z
        .object({
          jornada: z.boolean(),
          atividades: z.boolean(),
          eventos: z.boolean(),
          enquetes: z.boolean(),
          comunicados: z.boolean(),
          emailChannel: z.boolean(),
          webPushChannel: z.boolean(),
        })
        .optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({error: 'Preferências inválidas.'});

  const now = new Date().toISOString();
  const current = req.user!;
  db.prepare(`
    UPDATE users
    SET preferred_name = ?, social_name = ?, accessibility_prefs_json = ?, notification_prefs_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    parsed.data.preferredName ?? current.preferredName,
    parsed.data.socialName !== undefined ? parsed.data.socialName : current.socialName ?? null,
    JSON.stringify(parsed.data.accessibilityPrefs ?? current.accessibilityPrefs),
    JSON.stringify(parsed.data.notificationPrefs ?? current.notificationPrefs),
    now,
    current.id,
  );

  res.json({ok: true, user: hydrateUser(current.id, true)});
});

apiRouter.post('/profile/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z
        .string()
        .min(8, 'A nova senha deve ter pelo menos 8 caracteres.')
        .refine((v) => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v), 'Inclua maiúsculas, minúsculas e números.'),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: parsed.error.issues[0]?.message});

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as {
    password_hash: string;
  };
  if (!verifyPassword(parsed.data.currentPassword, row.password_hash)) {
    return res.status(400).json({error: 'Senha atual incorreta.'});
  }

  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    hashPassword(parsed.data.newPassword),
    new Date().toISOString(),
    req.user!.id,
  );

  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'PASSWORD_CHANGED',
    resourceType: 'user',
    resourceId: req.user!.id,
  });

  res.json({ok: true});
});

apiRouter.post('/profile/sessions/:sessionId/revoke', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ?').run(
    new Date().toISOString(),
    req.params.sessionId,
    req.user!.id,
  );
  res.json({ok: true});
});

// ============================================================================
// 9. AMBIENTE ADMINISTRATIVO E INTELIGÊNCIA DE GESTÃO (§22–§25)
// ============================================================================

apiRouter.get('/admin/overview', requireAuth, requirePermission('admin:access'), (_req, res) => {
  const counts = {
    users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as {c: number}).c,
    preboardingActive: (
      db.prepare("SELECT COUNT(*) as c FROM invitations WHERE status NOT IN ('ingresso_confirmado','encerrado_cancelado')").get() as {c: number}
    ).c,
    journeysActive: (db.prepare("SELECT COUNT(*) as c FROM journeys WHERE status = 'ativa'").get() as {c: number}).c,
    openSupport: (db.prepare("SELECT COUNT(*) as c FROM journey_support_requests WHERE status != 'resolvida'").get() as {c: number}).c,
    activitiesOpen: (db.prepare("SELECT COUNT(*) as c FROM activities WHERE status = 'aberta'").get() as {c: number}).c,
    surveysOpen: (db.prepare("SELECT COUNT(*) as c FROM surveys WHERE status = 'aberta'").get() as {c: number}).c,
    feedbackPending: (db.prepare("SELECT COUNT(*) as c FROM feedback_submissions WHERE status IN ('recebida','em_analise')").get() as {c: number}).c,
    improvementPlans: (db.prepare('SELECT COUNT(*) as c FROM improvement_plans').get() as {c: number}).c,
  };
  const recentAudit = db
    .prepare('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 8')
    .all();

  res.json({counts, recentAudit});
});

// Gestão de usuários e perfis
apiRouter.get('/admin/users', requireAuth, requirePermission('users:manage'), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, email, full_name, preferred_name, employment_type, organizational_unit,
              position_title, entry_date, is_active, mfa_enabled, created_at
       FROM users ORDER BY full_name ASC`,
    )
    .all() as Array<Record<string, unknown>>;

  const users = rows.map((r) => {
    const roles = (
      db.prepare('SELECT role_code FROM user_roles WHERE user_id = ?').all(r.id) as Array<{
        role_code: RoleCode;
      }>
    ).map((x) => x.role_code);
    return {...r, roles};
  });
  res.json({users, roleLabels: ROLE_LABELS});
});

apiRouter.patch('/admin/users/:id/roles', requireAuth, requirePermission('users:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z.object({roles: z.array(z.string()).min(1)}).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Selecione ao menos um papel.'});

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT INTO user_roles (user_id, role_code, granted_at) VALUES (?, ?, ?)');
    for (const r of parsed.data.roles) {
      ins.run(req.params.id, r, now);
    }
  });
  tx();

  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'USER_ROLES_UPDATED',
    resourceType: 'user',
    resourceId: req.params.id,
    metadata: {roles: parsed.data.roles},
  });

  res.json({ok: true});
});

apiRouter.get('/admin/roles-matrix', requireAuth, requirePermission('roles:view'), (_req, res) => {
  res.json({
    roles: Object.entries(ROLE_LABELS).map(([code, label]) => ({
      code,
      label,
      permissions: ROLE_PERMISSIONS[code as RoleCode] || [],
    })),
  });
});

// Gestão de Pré-ingresso e Cofre Segregado
apiRouter.get('/admin/preboarding', requireAuth, requirePermission('preboarding:manage'), (_req, res) => {
  const cases = db
    .prepare(
      `SELECT i.*, s.id as submission_id, s.cpf_masked, s.orgao_origem, s.submitted_at,
              rb.account_type, rb.bank_name, rb.account_masked
       FROM invitations i
       LEFT JOIN preboarding_submissions s ON s.invitation_id = i.id
       LEFT JOIN restricted_bank_details rb ON rb.submission_id = s.id
       ORDER BY i.updated_at DESC`,
    )
    .all();

  res.json({cases});
});

apiRouter.post('/admin/preboarding/invites', requireAuth, requirePermission('preboarding:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      inviteeName: z.string().trim().min(3),
      email: z.string().trim().email(),
      modality: z.enum(['GAEG_NS', 'GAEG_NI']),
      targetUnit: z.string().trim().min(2),
      proposedPosition: z.string().trim().min(2),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Preencha todos os campos do convite.'});

  const id = generateId();
  const code = `ENAP-2026-${parsed.data.modality === 'GAEG_NS' ? 'NS' : 'NI'}${Math.floor(10 + Math.random() * 89)}`;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  db.prepare(`
    INSERT INTO invitations (
      id, code, email, invitee_name, modality, target_unit, proposed_position,
      status, assigned_to_user_id, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'convite_encaminhado', ?, ?, ?, ?)
  `).run(
    id,
    code,
    parsed.data.email.toLowerCase(),
    parsed.data.inviteeName,
    parsed.data.modality,
    parsed.data.targetUnit,
    parsed.data.proposedPosition,
    req.user!.id,
    expires,
    now,
    now,
  );

  db.prepare(
    `INSERT INTO preboarding_status_history (id, invitation_id, status, note, actor_name, actor_user_id, created_at)
     VALUES (?, ?, 'convite_encaminhado', 'Convite institucional emitido pela equipe de pré-ingresso.', ?, ?, ?)`,
  ).run(generateId(), id, req.user!.fullName, req.user!.id, now);

  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'PREBOARDING_INVITE_CREATED',
    resourceType: 'invitation',
    resourceId: id,
    metadata: {modality: parsed.data.modality},
  });

  res.status(201).json({id, code, status: 'convite_encaminhado'});
});

apiRouter.patch('/admin/preboarding/:id/status', requireAuth, requirePermission('preboarding:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      status: z.enum([
        'convite_encaminhado',
        'preenchimento_iniciado',
        'formulario_recebido',
        'em_analise',
        'complementacao_solicitada',
        'complementacao_recebida',
        'consulta_orgao_origem',
        'preparacao_ingresso',
        'ingresso_confirmado',
        'encerrado_cancelado',
      ]),
      note: z.string().trim().min(3, 'Registre uma justificativa ou observação da movimentação.'),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: parsed.error.issues[0]?.message});

  const now = new Date().toISOString();
  db.prepare('UPDATE invitations SET status = ?, updated_at = ? WHERE id = ?').run(
    parsed.data.status,
    now,
    req.params.id,
  );
  db.prepare(
    `INSERT INTO preboarding_status_history (id, invitation_id, status, note, actor_name, actor_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(generateId(), req.params.id, parsed.data.status, parsed.data.note, req.user!.fullName, req.user!.id, now);

  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'PREBOARDING_STATUS_CHANGED',
    resourceType: 'invitation',
    resourceId: req.params.id,
    metadata: {status: parsed.data.status},
  });

  res.json({ok: true});
});

// Acesso auditado ao cofre segregado (APENAS `preboarding:view_restricted_vault` — bloqueado até para `admin_tecnico`!)
apiRouter.get(
  '/admin/preboarding/submissions/:submissionId/vault',
  requireAuth,
  requirePermission('preboarding:view_restricted_vault'),
  (req: AuthenticatedRequest, res) => {
    const bankRow = db
      .prepare('SELECT encrypted_payload FROM restricted_bank_details WHERE submission_id = ?')
      .get(req.params.submissionId) as {encrypted_payload: string} | undefined;
    const sensRow = db
      .prepare('SELECT encrypted_payload FROM restricted_sensitive_attributes WHERE submission_id = ?')
      .get(req.params.submissionId) as {encrypted_payload: string} | undefined;

    if (!bankRow || !sensRow) {
      return res.status(404).json({error: 'Compartimento segregado não encontrado para esta submissão.'});
    }

    logAuditEvent({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'RESTRICTED_VAULT_DECRYPTED',
      resourceType: 'preboarding_submission',
      resourceId: req.params.submissionId,
      outcome: 'sucesso',
      metadata: {note: 'Consulta autorizada ao compartimento segregado (dados bancários/sensíveis).'},
    });

    res.json({
      bankDetails: decryptVaultJson(bankRow.encrypted_payload),
      sensitiveAttributes: decryptVaultJson(sensRow.encrypted_payload),
    });
  },
);

// Parâmetros GAEG
apiRouter.patch(
  '/admin/gaeg-parameters/:modality',
  requireAuth,
  requirePermission('preboarding:manage_gaeg_params'),
  (req: AuthenticatedRequest, res) => {
    const parsed = z
      .object({
        gaegValue: z.number().positive(),
        maxTotalRemuneration: z.number().positive(),
        declarationText: z.string().trim().min(20),
        legalBasis: z.string().trim().min(5),
        validFrom: z.string().trim().min(8),
        validUntil: z.string().trim().nullable().optional(),
        version: z.string().trim().min(1),
        validatedBy: z.string().trim().min(3),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Parâmetros inválidos.'});

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE gaeg_parameters
      SET gaeg_value = ?, max_total_remuneration = ?, declaration_text = ?, legal_basis = ?,
          valid_from = ?, valid_until = ?, version = ?, validated_by = ?, updated_at = ?
      WHERE modality = ?
    `).run(
      parsed.data.gaegValue,
      parsed.data.maxTotalRemuneration,
      parsed.data.declarationText,
      parsed.data.legalBasis,
      parsed.data.validFrom,
      parsed.data.validUntil ?? null,
      parsed.data.version,
      parsed.data.validatedBy,
      now,
      req.params.modality,
    );

    logAuditEvent({
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'GAEG_PARAMETERS_UPDATED',
      resourceType: 'gaeg_parameter',
      resourceId: req.params.modality,
      metadata: {version: parsed.data.version},
    });

    res.json({ok: true});
  },
);

// Gestão da Jornada de Ambientação (Tabela, Kanban, Linha do tempo, Calendário, Modelos)
apiRouter.get('/admin/journeys', requireAuth, requirePermission('journey:manage'), (_req, res) => {
  const journeys = db
    .prepare(
      `SELECT j.*, u.full_name, u.preferred_name, u.email, u.organizational_unit, u.position_title
       FROM journeys j JOIN users u ON u.id = j.user_id ORDER BY j.expected_entry_date DESC`,
    )
    .all() as Array<Record<string, unknown>>;

  const enriched = journeys.map((j) => {
    const tasks = db
      .prepare('SELECT * FROM journey_tasks WHERE journey_id = ? ORDER BY sort_order ASC')
      .all(j.id) as Array<Record<string, unknown>>;
    const completed = tasks.filter((t) => t.status === 'concluida').length;
    const overdue = tasks.filter(
      (t) => t.status !== 'concluida' && new Date(`${String(t.due_date)}T23:59:59Z`) < new Date(),
    ).length;
    return {
      ...j,
      tasks,
      totalTasks: tasks.length,
      completedTasks: completed,
      overdueTasks: overdue,
      progressPercent: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
    };
  });

  const supportRequests = db
    .prepare(
      `SELECT sr.*, u.full_name as requester_name, u.organizational_unit
       FROM journey_support_requests sr JOIN users u ON u.id = sr.user_id ORDER BY sr.created_at DESC`,
    )
    .all();

  const templates = db.prepare('SELECT * FROM journey_templates ORDER BY updated_at DESC').all();

  res.json({journeys: enriched, supportRequests, templates});
});

apiRouter.patch('/admin/journeys/support/:id', requireAuth, requirePermission('journey:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      status: z.enum(['aberta', 'em_andamento', 'resolvida']),
      resolutionNote: z.string().trim().min(3),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Informe status e encaminhamento.'});

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE journey_support_requests SET status = ?, resolution_note = ?, resolved_at = ? WHERE id = ?',
  ).run(
    parsed.data.status,
    parsed.data.resolutionNote,
    parsed.data.status === 'resolvida' ? now : null,
    req.params.id,
  );
  res.json({ok: true});
});

// Gestão de Atividades PQVT, Eventos, Fala Enap, Enquetes, Repositório, Comitê DEI
apiRouter.post('/admin/activities', requireAuth, requirePermission('activities:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      title: z.string().trim().min(4),
      description: z.string().trim().min(10),
      category: z.string().trim().min(2),
      modality: z.enum(['Presencial', 'Virtual', 'Híbrida']),
      location: z.string().trim().min(2),
      scheduleSummary: z.string().trim().min(3),
      nextSessionIso: z.string().trim().min(8),
      responsibleName: z.string().trim().min(2),
      capacity: z.number().int().min(1).max(500),
      accessibilityResources: z.string().trim().min(4),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Verifique os campos da atividade.'});

  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO activities (
      id, title, description, image_url, category, eligible_audience, modality, location,
      schedule_summary, next_session_iso, responsible_name, capacity, registration_deadline,
      participation_criteria, accessibility_resources, additional_guidelines, status, featured, created_at
    ) VALUES (?, ?, ?, '/src/assets/images/pqvt_bem_estar_1795080544676.jpg', ?, 'Toda a comunidade Enap', ?, ?, ?, ?, ?, ?, ?, 'Inscrição prévia pelo Enap e-Vida.', ?, 'Participação voluntária e acolhedora.', 'aberta', 0, ?)
  `).run(
    id,
    parsed.data.title,
    parsed.data.description,
    parsed.data.category,
    parsed.data.modality,
    parsed.data.location,
    parsed.data.scheduleSummary,
    parsed.data.nextSessionIso,
    parsed.data.responsibleName,
    parsed.data.capacity,
    parsed.data.nextSessionIso.slice(0, 10),
    parsed.data.accessibilityResources,
    now,
  );

  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'PQVT_ACTIVITY_CREATED',
    resourceType: 'activity',
    resourceId: id,
  });

  res.status(201).json({id});
});

apiRouter.post('/admin/events', requireAuth, requirePermission('events:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      title: z.string().trim().min(4),
      description: z.string().trim().min(10),
      sourceModule: z.enum(['jornada', 'pqvt', 'comite_dei', 'institucional']),
      category: z.string().trim().min(2),
      startIso: z.string().trim().min(10),
      endIso: z.string().trim().min(10),
      location: z.string().trim().min(2),
      modality: z.enum(['Presencial', 'Virtual', 'Híbrida']),
      organizer: z.string().trim().min(2),
      capacity: z.number().int().min(1).nullable().optional(),
      accessibilityResources: z.string().trim().min(4),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Verifique os dados do evento.'});

  const id = generateId();
  db.prepare(`
    INSERT INTO events (
      id, title, description, image_url, source_module, category, start_iso, end_iso,
      location, modality, eligible_audience, organizer, program_json, capacity,
      accessibility_resources, materials_json, status, created_at
    ) VALUES (?, ?, ?, '/src/assets/images/jornada_acolhimento_1795080544095.jpg', ?, ?, ?, ?, ?, ?, 'Toda a comunidade Enap', ?, '["Programação institucional em atualização"]', ?, ?, '[]', 'publicado', ?)
  `).run(
    id,
    parsed.data.title,
    parsed.data.description,
    parsed.data.sourceModule,
    parsed.data.category,
    parsed.data.startIso,
    parsed.data.endIso,
    parsed.data.location,
    parsed.data.modality,
    parsed.data.organizer,
    parsed.data.capacity ?? null,
    parsed.data.accessibilityResources,
    new Date().toISOString(),
  );
  res.status(201).json({id});
});

apiRouter.get('/admin/fala-enap', requireAuth, requirePermission('feedback:manage'), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT f.*, u.preferred_name, u.organizational_unit
       FROM feedback_submissions f JOIN users u ON u.id = f.user_id ORDER BY f.created_at DESC`,
    )
    .all();
  res.json({contributions: rows});
});

apiRouter.patch('/admin/fala-enap/:id', requireAuth, requirePermission('feedback:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      status: z.enum(['recebida', 'em_analise', 'em_avaliacao_unidade', 'respondida', 'incorporada_plano', 'encerrada']),
      institutionalReply: z.string().trim().min(4),
      implementedHighlight: z.boolean().optional(),
      changeSummary: z.string().trim().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Informe status e devolutiva institucional.'});

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE feedback_submissions
    SET status = ?, institutional_reply = ?, implemented_highlight = ?, change_summary = ?, updated_at = ?
    WHERE id = ?
  `).run(
    parsed.data.status,
    parsed.data.institutionalReply,
    parsed.data.implementedHighlight ? 1 : 0,
    parsed.data.changeSummary || null,
    now,
    req.params.id,
  );
  res.json({ok: true});
});

apiRouter.post('/admin/surveys', requireAuth, requirePermission('surveys:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      title: z.string().trim().min(5),
      purpose: z.string().trim().min(10),
      eligibleAudience: z.string().trim().min(3),
      opensAt: z.string().trim().min(8),
      closesAt: z.string().trim().min(8),
      anonymityMode: z.enum(['identificada', 'confidencial', 'anonima']),
      minAggregationThreshold: z.number().int().min(3).max(100).default(10),
      privacyNotice: z.string().trim().min(10),
      questions: z.array(z.record(z.string(), z.any())).min(1),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Verifique os campos da enquete.'});

  const id = generateId();
  db.prepare(`
    INSERT INTO surveys (
      id, title, purpose, eligible_audience, opens_at, closes_at, anonymity_mode,
      allow_edit, show_results_to_users, min_aggregation_threshold, privacy_notice,
      version, questions_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, '1.0', ?, 'aberta', ?)
  `).run(
    id,
    parsed.data.title,
    parsed.data.purpose,
    parsed.data.eligibleAudience,
    parsed.data.opensAt,
    parsed.data.closesAt,
    parsed.data.anonymityMode,
    parsed.data.minAggregationThreshold,
    parsed.data.privacyNotice,
    JSON.stringify(parsed.data.questions),
    new Date().toISOString(),
  );

  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'SURVEY_PUBLISHED',
    resourceType: 'survey',
    resourceId: id,
    metadata: {anonymityMode: parsed.data.anonymityMode, threshold: parsed.data.minAggregationThreshold},
  });

  res.status(201).json({id});
});

apiRouter.post('/admin/repository', requireAuth, requirePermission('repository:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      title: z.string().trim().min(4),
      description: z.string().trim().min(10),
      authorUnit: z.string().trim().min(2),
      category: z.string().trim().min(2),
      subject: z.string().trim().min(2),
      keywords: z.string().trim().min(2),
      format: z.string().trim().min(2),
      contentPreview: z.string().trim().min(10),
      isRestricted: z.boolean().default(false),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Verifique os metadados do documento.'});

  const id = generateId();
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO documents (
      id, title, description, author_unit, category, subject, keywords, published_at,
      version, updated_at, authorized_audience, format, source_label, content_preview,
      versions_history_json, is_restricted, editorial_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1.0', ?, ?, ?, 'Cadastro editorial demonstrativo', ?, ?, ?, 'publicado')
  `).run(
    id,
    parsed.data.title,
    parsed.data.description,
    parsed.data.authorUnit,
    parsed.data.category,
    parsed.data.subject,
    parsed.data.keywords,
    today,
    today,
    parsed.data.isRestricted ? 'Perfis administrativos autorizados' : 'Toda a comunidade Enap',
    parsed.data.format,
    parsed.data.contentPreview,
    JSON.stringify([{version: '1.0', date: today, note: 'Publicação inicial.'}]),
    parsed.data.isRestricted ? 1 : 0,
  );
  res.status(201).json({id});
});

apiRouter.post('/admin/comite-dei/projects', requireAuth, requirePermission('dei:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      title: z.string().trim().min(4),
      type: z.enum(['projeto', 'campanha', 'grupo_trabalho', 'plano_acao']),
      summary: z.string().trim().min(10),
      responsibleUnit: z.string().trim().min(2),
      status: z.string().trim().min(2),
      dueDate: z.string().trim().optional(),
      deliverables: z.array(z.string()).default([]),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Verifique os campos da iniciativa DEI.'});

  const id = generateId();
  db.prepare(`
    INSERT INTO committee_projects (id, title, type, summary, responsible_unit, status, due_date, deliverables_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    parsed.data.title,
    parsed.data.type,
    parsed.data.summary,
    parsed.data.responsibleUnit,
    parsed.data.status,
    parsed.data.dueDate || null,
    JSON.stringify(parsed.data.deliverables),
    new Date().toISOString(),
  );
  res.status(201).json({id});
});

// ============================================================================
// 10. INDICADORES ESTRATÉGICOS, EXPORTAÇÃO CSV E LABORATÓRIO DE MELHORIA (§24–§25)
// ============================================================================

function gatherIndicatorInputs() {
  const eligibleNewcomers = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE entry_date >= '2026-01-01'").get() as {c: number}
  ).c;
  const journeyParticipants = (
    db.prepare("SELECT COUNT(*) as c FROM journeys WHERE expected_entry_date >= '2026-01-01'").get() as {c: number}
  ).c;

  const day1Total = (
    db.prepare('SELECT COUNT(*) as c FROM journey_tasks WHERE is_essential_day1 = 1').get() as {c: number}
  ).c;
  const day1OnTime = (
    db.prepare('SELECT COUNT(*) as c FROM journey_tasks WHERE is_essential_day1 = 1 AND completed_on_time = 1').get() as {c: number}
  ).c;

  const assessRows = db
    .prepare("SELECT milestone_days, role_clarity_score, team_support_score, supervisor_support_score, belonging_score FROM journey_assessments WHERE status = 'respondida'")
    .all() as Array<Record<string, number | null>>;

  const roleClarityScores30 = assessRows.filter((r) => r.milestone_days === 30 && r.role_clarity_score !== null).map((r) => Number(r.role_clarity_score));
  const roleClarityScores60 = assessRows.filter((r) => r.milestone_days === 60 && r.role_clarity_score !== null).map((r) => Number(r.role_clarity_score));
  const roleClarityScores90 = assessRows.filter((r) => r.milestone_days === 90 && r.role_clarity_score !== null).map((r) => Number(r.role_clarity_score));

  const supportScores30 = assessRows
    .filter((r) => r.milestone_days === 30 && r.team_support_score !== null && r.supervisor_support_score !== null)
    .map((r) => (Number(r.team_support_score) + Number(r.supervisor_support_score)) / 2);
  const supportScores90 = assessRows
    .filter((r) => r.milestone_days === 90 && r.team_support_score !== null && r.supervisor_support_score !== null)
    .map((r) => (Number(r.team_support_score) + Number(r.supervisor_support_score)) / 2);

  const belongingScores = assessRows.filter((r) => r.belonging_score !== null).map((r) => Number(r.belonging_score));

  const supports = db.prepare('SELECT status, created_at, resolved_at FROM journey_support_requests').all() as Array<{
    status: string;
    created_at: string;
    resolved_at: string | null;
  }>;
  const resolvedSupports = supports.filter((s) => s.status === 'resolvida');
  const resolutionHours = resolvedSupports
    .filter((s) => s.resolved_at)
    .map((s) => Math.max(1, (new Date(s.resolved_at!).getTime() - new Date(s.created_at).getTime()) / 3_600_000));

  const pqvtCap = (db.prepare('SELECT COALESCE(SUM(capacity), 0) as s FROM activities').get() as {s: number}).s;
  const pqvtEnrolled = (
    db.prepare("SELECT COUNT(*) as c FROM activity_registrations WHERE status = 'confirmada'").get() as {c: number}
  ).c;

  const surveysPublished = (db.prepare('SELECT COUNT(*) as c FROM surveys').get() as {c: number}).c;
  const surveyResponsesTotal = (db.prepare('SELECT COUNT(*) as c FROM survey_responses').get() as {c: number}).c;
  const improvementPlansTotal = (db.prepare('SELECT COUNT(*) as c FROM improvement_plans').get() as {c: number}).c;
  const improvementPlansImplemented = (
    db.prepare("SELECT COUNT(*) as c FROM improvement_plans WHERE status = 'implementado'").get() as {c: number}
  ).c;

  return {
    eligibleNewcomers,
    journeyParticipants,
    essentialDay1TasksTotal: day1Total,
    essentialDay1TasksOnTime: day1OnTime,
    roleClarityScores30,
    roleClarityScores60,
    roleClarityScores90,
    supportScores30,
    supportScores90,
    belongingScores,
    supportRequestsTotal: supports.length,
    supportRequestsResolved: resolvedSupports.length,
    supportResolutionHours: resolutionHours,
    pqvtCapacityTotal: pqvtCap,
    pqvtConfirmedRegistrations: pqvtEnrolled,
    surveysPublished,
    surveyResponsesTotal,
    improvementPlansImplemented,
    improvementPlansTotal,
    minSuppressionThreshold: 10,
  };
}

apiRouter.get('/admin/indicators', requireAuth, requirePermission('indicators:view'), (_req, res) => {
  const inputs = gatherIndicatorInputs();
  const indicators = computeStrategicIndicators(inputs);

  // Série longitudinal fictícia (claramente rotulada como demonstrativa)
  const longitudinalSeries = [
    {periodo: 'Ciclo 30 dias (Fictício)', clarezaPapel: 4.1, apoioVinculos: 4.4, cobertura: 88},
    {periodo: 'Ciclo 60 dias (Fictício)', clarezaPapel: 4.4, apoioVinculos: 4.5, cobertura: 91},
    {periodo: 'Ciclo 90 dias (Fictício)', clarezaPapel: 4.6, apoioVinculos: 4.7, cobertura: 92},
  ];

  res.json({
    indicators,
    longitudinalSeries,
    methodologicalNote:
      'Todos os dados exibidos neste painel são fictícios (ambiente de demonstração). Os percentuais de 96%, 70% e 100% citados na apresentação da Semana de Inovação NÃO são transportados como evidência atual comprovada — sua divulgação requer confirmação de amostra, período, instrumento, taxa de resposta e possíveis vieses. Ausência de dados nunca é exibida como zero.',
  });
});

apiRouter.get('/admin/indicators/export.csv', requireAuth, requirePermission('indicators:export'), (req: AuthenticatedRequest, res) => {
  const indicators = computeStrategicIndicators(gatherIndicatorInputs());
  const headers = [
    'Codigo',
    'Indicador',
    'Dimensao',
    'Valor_Exibido',
    'Status',
    'Amostra_N',
    'Unidade',
    'Periodicidade',
    'Fonte_Dados',
    'Limitacoes_Metodologicas',
  ];
  const rows = indicators.map((i) => [
    i.code,
    i.name,
    i.dimension.toUpperCase(),
    i.displayValue,
    i.status,
    i.sampleSize,
    i.unit,
    i.periodicity,
    i.dataSource,
    i.methodologicalLimitations,
  ]);

  const csv = buildBrazilianCsv(headers, rows);
  logAuditEvent({
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'INDICATORS_EXPORTED_CSV',
    resourceType: 'indicators',
    metadata: {rowCount: rows.length},
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="enap-evida-indicadores-demonstracao.csv"');
  res.send(csv);
});

apiRouter.get('/admin/improvement-plans', requireAuth, requirePermission('improvement:manage'), (_req, res) => {
  const plans = db.prepare('SELECT * FROM improvement_plans ORDER BY updated_at DESC').all();
  res.json({plans});
});

apiRouter.post('/admin/improvement-plans', requireAuth, requirePermission('improvement:manage'), (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      title: z.string().trim().min(4),
      journeyPhase: z.enum(['Preparação', 'Acolhimento', 'Aprendizagem', 'Integração', 'Pertencimento']),
      canvasExperience: z.string().trim().min(6),
      canvasNeed: z.string().trim().min(6),
      canvasAction: z.string().trim().min(6),
      canvasOwner: z.string().trim().min(3),
      canvasEvidence: z.string().trim().min(6),
      hypothesis: z.string().trim().min(5),
      priority: z.enum(['alta', 'media', 'baixa']),
      status: z.enum(['descoberta', 'piloto', 'em_execucao', 'avaliacao', 'implementado']).default('descoberta'),
      linkedIndicatorCode: z.string().trim().optional(),
      pilotCriteria: z.string().trim().min(5),
      dueDate: z.string().trim().min(8),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Preencha todas as 5 perguntas do Canvas e os critérios do piloto.'});

  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO improvement_plans (
      id, title, journey_phase, canvas_experience, canvas_need, canvas_action,
      canvas_owner, canvas_evidence, hypothesis, priority, status,
      linked_indicator_code, pilot_criteria, due_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    parsed.data.title,
    parsed.data.journeyPhase,
    parsed.data.canvasExperience,
    parsed.data.canvasNeed,
    parsed.data.canvasAction,
    parsed.data.canvasOwner,
    parsed.data.canvasEvidence,
    parsed.data.hypothesis,
    parsed.data.priority,
    parsed.data.status,
    parsed.data.linkedIndicatorCode || null,
    parsed.data.pilotCriteria,
    parsed.data.dueDate,
    now,
    now,
  );
  res.status(201).json({id});
});

apiRouter.patch('/admin/improvement-plans/:id/status', requireAuth, requirePermission('improvement:manage'), (req, res) => {
  const parsed = z
    .object({
      status: z.enum(['descoberta', 'piloto', 'em_execucao', 'avaliacao', 'implementado']),
      learnings: z.string().trim().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Status inválido.'});

  db.prepare('UPDATE improvement_plans SET status = ?, learnings = COALESCE(?, learnings), updated_at = ? WHERE id = ?').run(
    parsed.data.status,
    parsed.data.learnings || null,
    new Date().toISOString(),
    req.params.id,
  );
  res.json({ok: true});
});

apiRouter.get('/admin/audit', requireAuth, requirePermission('audit:view'), (req, res) => {
  const action = String(req.query.action || '').trim();
  const rows = action
    ? db
        .prepare('SELECT * FROM audit_events WHERE action LIKE ? ORDER BY created_at DESC LIMIT 100')
        .all(`%${action}%`)
    : db.prepare('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 100').all();
  res.json({events: rows});
});
