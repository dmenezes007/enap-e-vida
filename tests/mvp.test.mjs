import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import pg from 'pg';

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const {port} = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

test('piloto PostgreSQL: ingresso, perfis e agenda', {timeout: 90_000}, async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Configure TEST_DATABASE_URL com um banco PostgreSQL de teste.');
  const target = new URL(process.env.TEST_DATABASE_URL);
  const schema = 'evida_mvp_' + randomBytes(8).toString('hex');
  const control = new pg.Client({connectionString: target.href});
  await control.connect();
  t.after(() => control.end());
  await control.query(`CREATE SCHEMA ${schema}`);
  target.searchParams.set('options', `-c search_path=${schema}`);
  const port = await availablePort();
  const env = {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: target.href,
    VAULT_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  };
  const base = `http://127.0.0.1:${port}`;
  let app;
  async function stopApp() {
    if (!app || app.exitCode !== null || app.signalCode !== null) return;
    const exited = once(app, 'exit');
    app.kill();
    await exited;
  }
  t.after(async () => {
    await stopApp();
  });

  async function startApp() {
    app = spawn(process.execPath, ['build/server.mjs'], {env, stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    app.stderr.setEncoding('utf8').on('data', (data) => { stderr += data; });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && app.exitCode === null) {
      try {
        const health = await fetch(base + '/healthz', {signal: AbortSignal.timeout(1500)});
        if (health.ok) return;
      } catch {
        // O processo pode ainda estar inicializando o banco.
      }
      await delay(150);
    }
    assert.fail(stderr || 'O servidor não atingiu o estado saudável.');
  }

  async function request(path, expected, {cookie, body, method = body ? 'POST' : 'GET'} = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (body) headers['Content-Type'] = 'application/json';
    const result = await fetch(base + path, {
      method, headers, body: body && JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
    assert.ok([expected].flat().includes(result.status), `${method} ${path}: HTTP ${result.status}`);
    return result;
  }

  async function login(email, mfaCode) {
    const result = await request('/api/auth/login', 200, {body: {email, password: 'EnapDemo@2026', mfaCode}});
    const cookie = result.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    return cookie.split(';')[0];
  }

  try {
    await startApp();
    await request('/api/dashboard', 401);
    assert.match(await (await request('/', 200)).text(), /<script[^>]+assets\/index-/);
    assert.deepEqual(
      Buffer.from(await (await request('/enap-e-vida.png', 200)).arrayBuffer()),
      await readFile(new URL('../enap-e-vida.png', import.meta.url)),
    );
    const adminEmail = 'admin@demo.enap.gov.br';
    const withoutMfa = await request('/api/auth/login', 401, {body: {email: adminEmail, password: 'EnapDemo@2026'}});
    assert.equal((await withoutMfa.json()).mfaRequired, true);
    const admin = await login(adminEmail, '202600');
    const intake = await login('preingresso.gestao@demo.enap.gov.br', '202600');
    const participant = await login('acompanhamento30@demo.enap.gov.br');
    const manager = await login('chefia@demo.enap.gov.br');
    await request('/api/admin/overview', 200, {cookie: admin});
    await request('/api/admin/overview', 403, {cookie: participant});
    await request('/api/dashboard', 200, {cookie: participant});
    await request('/api/journey/me', 200, {cookie: participant});
    const account = await request('/api/auth/register', 201, {body: {
      fullName: 'Conta Fictícia', email: 'conta@example.test', employmentType: 'Servidor',
      organizationalUnit: 'Unidade Fictícia', positionTitle: 'Cargo Fictício', entryDate: '2026-11-23',
      password: 'SenhaFicticia123', confirmPassword: 'SenhaFicticia123',
    }});
    const registered = account.headers.get('set-cookie').split(';')[0];
    await request('/api/journey/me', 200, {cookie: registered});
    await request('/api/admin/overview', 403, {cookie: registered});

    const invitation = {code: 'ENAP-2026-NS01', email: 'pre.ns@demo.enap.gov.br', modality: 'GAEG_NS'};
    const initial = await request('/api/preboarding/verify-invite', 200, {body: invitation});
    assert.equal((await initial.json()).invite.modality, 'GAEG_NS');
    const ni = await request('/api/preboarding/verify-invite', 200, {
      body: {code: 'ENAP-2026-NI02', email: 'pre.ni@demo.enap.gov.br'},
    });
    assert.equal((await ni.json()).invite.modality, 'GAEG_NI');
    const draft = {nome: 'Participante Fictício', contaBancaria: 'CONTA-FICTICIA'};
    await request('/api/preboarding/save-draft', 200, {body: {...invitation, draft}});
    const saved = await control.query(`SELECT draft_json FROM ${schema}.invitations WHERE code = $1`, [invitation.code]);
    assert.match(saved.rows[0].draft_json, /^v1:/);
    assert.ok(!saved.rows[0].draft_json.includes(draft.contaBancaria));
    await stopApp();
    await startApp();
    const session = await request('/api/auth/me', 200, {cookie: participant});
    assert.equal((await session.json()).authenticated, true);
    const restored = await request('/api/preboarding/verify-invite', 200, {body: invitation});
    assert.deepEqual((await restored.json()).invite.draft, draft);

    const formData = {
      ...draft, cpf: '52998224725', naturalidadeUf: 'Cidade Teste DF', racaCor: 'Não informado',
      dataNascimento: '1990-01-01', rg: 'FICTICIO', orgaoExpedidor: 'TESTE', filiacao: 'Pessoa Fictícia',
      tituloEleitor: 'TESTE01', escolaridade: 'Superior', formacao: 'Teste',
      residenciasUltimos10Anos: [{cidade: 'Cidade Teste', uf: 'DF', periodo: '2020–2026'}],
      enderecoAtual: 'Rua Fictícia', telefoneParticular: '6100000000', orgaoOrigem: 'Órgão Fictício',
      cargoEfetivo: 'Cargo Fictício', matriculaSiape: '00000', ingressoServicoPublico: '2020-01-01',
      estagioProbatorioConcluido: 'SIM', entradaPorCotas: 'NAO', pessoaComDeficiencia: 'NAO', estaEmPgd: 'NAO',
      propostaCargoFuncaoEnap: 'Cargo Fictício', orgaoExercicioAtual: 'Órgão Fictício',
      selecaoMedianteEdital: 'Não', negociacaoPreviaCedente: 'Não', mudancaDomicilio: 'NAO',
      tipoConta: 'CONTA_SALARIO', banco: 'Banco Fictício', agenciaComDv: '0000', cienteRemuneracaoMaxima: true,
      chefiaNome: 'Chefia Fictícia', chefiaEmail: 'chefia@example.test', chefiaCargo: 'Cargo Fictício',
      chefiaOrgao: 'Órgão Fictício', cienteAvisoPrivacidade: true,
    };
    const submit = () => request('/api/preboarding/submit', [201, 409], {body: {...invitation, formData}});
    const receipts = await Promise.all([submit(), submit()]);
    assert.deepEqual(receipts.map(({status}) => status).sort(), [201, 409]);
    const protocol = (await receipts.find(({status}) => status === 201).json()).protocol;
    await request('/api/preboarding/track', 200, {body: {protocol, email: invitation.email}});
    await request('/api/preboarding/track', 404, {body: {protocol, email: 'outro@example.test'}});
    const submission = await control.query(`SELECT id FROM ${schema}.preboarding_submissions WHERE protocol = $1`, [protocol]);
    const vault = `/api/admin/preboarding/submissions/${submission.rows[0].id}/vault`;
    await request(vault, 403, {cookie: admin});
    await request(vault, 200, {cookie: intake});

    const eventId = 'evt-03';
    const event = `/api/events/${eventId}`;
    await control.query(
      `UPDATE ${schema}.events SET capacity = 1, start_iso = $1, end_iso = $2 WHERE id = $3`,
      [new Date(Date.now() + 60_000).toISOString(), new Date(Date.now() + 120_000).toISOString(), eventId],
    );
    const registrations = await Promise.all([participant, manager].map(async (cookie) => {
      const result = await request(event + '/register', 200, {method: 'POST', cookie});
      return {cookie, status: (await result.json()).status};
    }));
    const confirmed = registrations.find(({status}) => status === 'confirmada');
    const waiting = registrations.find(({status}) => status === 'lista_espera');
    assert.ok(confirmed && waiting);
    await request(event + '/attendance', 409, {method: 'POST', cookie: confirmed.cookie});
    await request(event + '/cancel', 200, {method: 'POST', cookie: confirmed.cookie});
    const promoted = await request(event, 200, {cookie: waiting.cookie});
    assert.equal((await promoted.json()).event.my_status, 'confirmada');
    const notifications = await request('/api/notifications', 200, {cookie: waiting.cookie});
    assert.ok((await notifications.json()).notifications.some(({link_path}) => link_path === '/app/eventos/' + eventId));
    await control.query(`UPDATE ${schema}.events SET start_iso = $1 WHERE id = $2`, [new Date().toISOString(), eventId]);
    await request(event + '/attendance', 403, {method: 'POST', cookie: confirmed.cookie});
    await request(event + '/attendance', 200, {method: 'POST', cookie: waiting.cookie});
    const attended = await request(event, 200, {cookie: waiting.cookie});
    assert.equal((await attended.json()).event.my_attendance_confirmed, 1);
    assert.match(await (await request(event + '/ics', 200, {cookie: waiting.cookie})).text(), /BEGIN:VALARM\r\nTRIGGER:-PT30M/);
  } finally {
    await stopApp();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
  }
});
