import express from 'express';
import sqlite3 from 'sqlite3';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import { body, validationResult } from 'express-validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const porta = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const bancoDados = new sqlite3.Database(path.join(__dirname, 'clinica.db'), (erro) => {
  if (erro) {
    console.error('Erro ao conectar ao banco de dados:', erro);
  } else {
    console.log('Conectado ao banco de dados SQLite');
    inicializarBancoDados();
  }
});

// executar queries com Promise
function executarQuery(sql, parametros = []) {
  return new Promise((resolver, rejeitar) => {
    bancoDados.run(sql, parametros, function(erro) {
      if (erro) rejeitar(erro);
      else resolver({ id: this.lastID, mudancas: this.changes });
    });
  });
}

function obterDados(sql, parametros = []) {
  return new Promise((resolver, rejeitar) => {
    bancoDados.all(sql, parametros, (erro, linhas) => {
      if (erro) rejeitar(erro);
      else resolver(linhas || []);
    });
  });
}

function obterUmDado(sql, parametros = []) {
  return new Promise((resolver, rejeitar) => {
    bancoDados.get(sql, parametros, (erro, linha) => {
      if (erro) rejeitar(erro);
      else resolver(linha);
    });
  });
}

// tabelas do banco de dados
function inicializarBancoDados() {
  const tabelas = [
    `CREATE TABLE IF NOT EXISTS pacientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      telefone TEXT NOT NULL,
      dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS profissionais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      especialidade TEXT NOT NULL,
      dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS consultas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pacienteId INTEGER NOT NULL,
      profissionalId INTEGER NOT NULL,
      dataHora DATETIME NOT NULL,
      status TEXT DEFAULT 'agendada',
      motivoCancelamento TEXT,
      dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pacienteId) REFERENCES pacientes(id),
      FOREIGN KEY (profissionalId) REFERENCES profissionais(id),
      CHECK (status IN ('agendada', 'cancelada', 'concluída'))
    )`
  ];

  tabelas.forEach(sql => {
    bancoDados.run(sql, (erro) => {
      if (erro) console.error('Erro ao criar tabela:', erro);
    });
  });
}

// ROTAS DE PACIENTES

app.get('/pacientes', async (req, res) => {
  try {
    const busca = req.query.busca || '';
    let sql = 'SELECT * FROM pacientes';
    let parametros = [];

    if (busca) {
      sql += ' WHERE nome LIKE ? OR email LIKE ? OR telefone LIKE ?';
      parametros = [`%${busca}%`, `%${busca}%`, `%${busca}%`];
    }

    sql += ' ORDER BY nome';
    const pacientes = await obterDados(sql, parametros);
    res.render('pacientes/lista', { pacientes, busca });
  } catch (erro) {
    console.error('Erro ao listar pacientes:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao listar pacientes' });
  }
});

app.get('/pacientes/novo', (req, res) => {
  res.render('pacientes/formulario', { paciente: null, erros: [] });
});

app.post('/pacientes', [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('telefone').trim().notEmpty().withMessage('Telefone é obrigatório')
], async (req, res) => {
  try {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      return res.render('pacientes/formulario', { paciente: req.body, erros: erros.array() });
    }

    const { nome, email, telefone } = req.body;

    const existente = await obterUmDado('SELECT id FROM pacientes WHERE email = ?', [email]);
    if (existente) {
      return res.render('pacientes/formulario', { 
        paciente: req.body, 
        erros: [{ msg: 'Email já cadastrado' }] 
      });
    }

    await executarQuery(
      'INSERT INTO pacientes (nome, email, telefone) VALUES (?, ?, ?)',
      [nome, email, telefone]
    );

    res.redirect('/pacientes?mensagem=Paciente criado com sucesso');
  } catch (erro) {
    console.error('Erro ao criar paciente:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao criar paciente' });
  }
});

app.get('/pacientes/:id/editar', async (req, res) => {
  try {
    const paciente = await obterUmDado('SELECT * FROM pacientes WHERE id = ?', [req.params.id]);
    if (!paciente) {
      return res.status(404).render('erro', { mensagem: 'Paciente não encontrado' });
    }
    res.render('pacientes/formulario', { paciente, erros: [] });
  } catch (erro) {
    console.error('Erro ao buscar paciente:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao buscar paciente' });
  }
});

app.post('/pacientes/:id', [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('telefone').trim().notEmpty().withMessage('Telefone é obrigatório')
], async (req, res) => {
  try {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      const paciente = await obterUmDado('SELECT * FROM pacientes WHERE id = ?', [req.params.id]);
      return res.render('pacientes/formulario', { paciente, erros: erros.array() });
    }

    const { nome, email, telefone } = req.body;

    const existente = await obterUmDado(
      'SELECT id FROM pacientes WHERE email = ? AND id != ?',
      [email, req.params.id]
    );
    if (existente) {
      const paciente = await obterUmDado('SELECT * FROM pacientes WHERE id = ?', [req.params.id]);
      return res.render('pacientes/formulario', { 
        paciente, 
        erros: [{ msg: 'Email já cadastrado' }] 
      });
    }

    await executarQuery(
      'UPDATE pacientes SET nome = ?, email = ?, telefone = ?, dataAtualizacao = CURRENT_TIMESTAMP WHERE id = ?',
      [nome, email, telefone, req.params.id]
    );

    res.redirect('/pacientes?mensagem=Paciente atualizado com sucesso');
  } catch (erro) {
    console.error('Erro ao atualizar paciente:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao atualizar paciente' });
  }
});

app.post('/pacientes/:id/deletar', async (req, res) => {
  try {
    const consultas = await obterDados('SELECT id FROM consultas WHERE pacienteId = ?', [req.params.id]);
    if (consultas.length > 0) {
      return res.status(400).render('erro', { 
        mensagem: 'Não é possível deletar paciente com consultas agendadas' 
      });
    }

    await executarQuery('DELETE FROM pacientes WHERE id = ?', [req.params.id]);
    res.redirect('/pacientes?mensagem=Paciente deletado com sucesso');
  } catch (erro) {
    console.error('Erro ao deletar paciente:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao deletar paciente' });
  }
});

// ROTAS DE PROFISSIONAIS

app.get('/profissionais', async (req, res) => {
  try {
    const busca = req.query.busca || '';
    let sql = 'SELECT * FROM profissionais';
    let parametros = [];

    if (busca) {
      sql += ' WHERE nome LIKE ? OR especialidade LIKE ?';
      parametros = [`%${busca}%`, `%${busca}%`];
    }

    sql += ' ORDER BY nome';
    const profissionais = await obterDados(sql, parametros);
    res.render('profissionais/lista', { profissionais, busca });
  } catch (erro) {
    console.error('Erro ao listar profissionais:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao listar profissionais' });
  }
});

app.get('/profissionais/novo', (req, res) => {
  res.render('profissionais/formulario', { profissional: null, erros: [] });
});

app.post('/profissionais', [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('especialidade').trim().notEmpty().withMessage('Especialidade é obrigatória')
], async (req, res) => {
  try {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      return res.render('profissionais/formulario', { profissional: req.body, erros: erros.array() });
    }

    const { nome, especialidade } = req.body;
    await executarQuery(
      'INSERT INTO profissionais (nome, especialidade) VALUES (?, ?)',
      [nome, especialidade]
    );

    res.redirect('/profissionais?mensagem=Profissional criado com sucesso');
  } catch (erro) {
    console.error('Erro ao criar profissional:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao criar profissional' });
  }
});

app.get('/profissionais/:id/editar', async (req, res) => {
  try {
    const profissional = await obterUmDado('SELECT * FROM profissionais WHERE id = ?', [req.params.id]);
    if (!profissional) {
      return res.status(404).render('erro', { mensagem: 'Profissional não encontrado' });
    }
    res.render('profissionais/formulario', { profissional, erros: [] });
  } catch (erro) {
    console.error('Erro ao buscar profissional:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao buscar profissional' });
  }
});

app.post('/profissionais/:id', [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('especialidade').trim().notEmpty().withMessage('Especialidade é obrigatória')
], async (req, res) => {
  try {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      const profissional = await obterUmDado('SELECT * FROM profissionais WHERE id = ?', [req.params.id]);
      return res.render('profissionais/formulario', { profissional, erros: erros.array() });
    }

    const { nome, especialidade } = req.body;
    await executarQuery(
      'UPDATE profissionais SET nome = ?, especialidade = ?, dataAtualizacao = CURRENT_TIMESTAMP WHERE id = ?',
      [nome, especialidade, req.params.id]
    );

    res.redirect('/profissionais?mensagem=Profissional atualizado com sucesso');
  } catch (erro) {
    console.error('Erro ao atualizar profissional:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao atualizar profissional' });
  }
});

app.post('/profissionais/:id/deletar', async (req, res) => {
  try {
    const consultas = await obterDados('SELECT id FROM consultas WHERE profissionalId = ?', [req.params.id]);
    if (consultas.length > 0) {
      return res.status(400).render('erro', { 
        mensagem: 'Não é possível deletar profissional com consultas agendadas' 
      });
    }

    await executarQuery('DELETE FROM profissionais WHERE id = ?', [req.params.id]);
    res.redirect('/profissionais?mensagem=Profissional deletado com sucesso');
  } catch (erro) {
    console.error('Erro ao deletar profissional:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao deletar profissional' });
  }
});

//ROTAS DE CONSULTAS
app.get('/consultas', async (req, res) => {
  try {
    const busca = req.query.busca || '';
    const status = req.query.status || '';
    const data = req.query.data || '';

    let sql = `SELECT c.*, p.nome as nomePaciente, prof.nome as nomeProfissional, prof.especialidade 
               FROM consultas c 
               JOIN pacientes p ON c.pacienteId = p.id 
               JOIN profissionais prof ON c.profissionalId = prof.id`;
    let parametros = [];
    let condicoes = [];

    if (busca) {
      condicoes.push('(p.nome LIKE ? OR prof.nome LIKE ?)');
      parametros.push(`%${busca}%`, `%${busca}%`);
    }

    if (status) {
      condicoes.push('c.status = ?');
      parametros.push(status);
    }

    if (data) {
      condicoes.push('DATE(c.dataHora) = ?');
      parametros.push(data);
    }

    if (condicoes.length > 0) {
      sql += ' WHERE ' + condicoes.join(' AND ');
    }

    sql += ' ORDER BY c.dataHora DESC';
    const consultas = await obterDados(sql, parametros);
    res.render('consultas/lista', { consultas, busca, status, data });
  } catch (erro) {
    console.error('Erro ao listar consultas:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao listar consultas' });
  }
});

app.get('/consultas/novo', async (req, res) => {
  try {
    const pacientes = await obterDados('SELECT id, nome FROM pacientes ORDER BY nome');
    const profissionais = await obterDados('SELECT id, nome, especialidade FROM profissionais ORDER BY nome');
    res.render('consultas/formulario', { consulta: null, pacientes, profissionais, erros: [] });
  } catch (erro) {
    console.error('Erro ao carregar formulário:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao carregar formulário' });
  }
});

app.post('/consultas', [
  body('pacienteId').isInt().withMessage('Paciente inválido'),
  body('profissionalId').isInt().withMessage('Profissional inválido'),
  body('dataHora').notEmpty().withMessage('Data e hora são obrigatórias')
], async (req, res) => {
  try {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      const pacientes = await obterDados('SELECT id, nome FROM pacientes ORDER BY nome');
      const profissionais = await obterDados('SELECT id, nome, especialidade FROM profissionais ORDER BY nome');
      return res.render('consultas/formulario', { consulta: req.body, pacientes, profissionais, erros: erros.array() });
    }

    const { pacienteId, profissionalId, dataHora } = req.body;

    const dataConsulta = new Date(dataHora);
    if (dataConsulta <= new Date()) {
      const pacientes = await obterDados('SELECT id, nome FROM pacientes ORDER BY nome');
      const profissionais = await obterDados('SELECT id, nome, especialidade FROM profissionais ORDER BY nome');
      return res.render('consultas/formulario', { 
        consulta: req.body, 
        pacientes, 
        profissionais,
        erros: [{ msg: 'A data e hora da consulta deve ser no futuro' }] 
      });
    }

    const sobreposicao = await obterUmDado(`
      SELECT id FROM consultas 
      WHERE profissionalId = ? 
      AND status = 'agendada'
      AND datetime(dataHora) BETWEEN datetime(?, '-1 hour') AND datetime(?, '+1 hour')
    `, [profissionalId, dataHora, dataHora]);

    if (sobreposicao) {
      const pacientes = await obterDados('SELECT id, nome FROM pacientes ORDER BY nome');
      const profissionais = await obterDados('SELECT id, nome, especialidade FROM profissionais ORDER BY nome');
      return res.render('consultas/formulario', { 
        consulta: req.body, 
        pacientes, 
        profissionais,
        erros: [{ msg: 'Profissional já possui consulta agendada neste horário' }] 
      });
    }

    await executarQuery(
      'INSERT INTO consultas (pacienteId, profissionalId, dataHora, status) VALUES (?, ?, ?, ?)',
      [pacienteId, profissionalId, dataHora, 'agendada']
    );

    res.redirect('/consultas?mensagem=Consulta agendada com sucesso');
  } catch (erro) {
    console.error('Erro ao criar consulta:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao criar consulta' });
  }
});

app.get('/consultas/:id/editar', async (req, res) => {
  try {
    const consulta = await obterUmDado(`
      SELECT c.*, p.nome as nomePaciente, prof.nome as nomeProfissional 
      FROM consultas c 
      JOIN pacientes p ON c.pacienteId = p.id 
      JOIN profissionais prof ON c.profissionalId = prof.id 
      WHERE c.id = ?
    `, [req.params.id]);

    if (!consulta) {
      return res.status(404).render('erro', { mensagem: 'Consulta não encontrada' });
    }

    const pacientes = await obterDados('SELECT id, nome FROM pacientes ORDER BY nome');
    const profissionais = await obterDados('SELECT id, nome, especialidade FROM profissionais ORDER BY nome');
    res.render('consultas/formulario', { consulta, pacientes, profissionais, erros: [] });
  } catch (erro) {
    console.error('Erro ao buscar consulta:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao buscar consulta' });
  }
});

app.post('/consultas/:id', [
  body('pacienteId').isInt().withMessage('Paciente inválido'),
  body('profissionalId').isInt().withMessage('Profissional inválido'),
  body('dataHora').notEmpty().withMessage('Data e hora são obrigatórias')
], async (req, res) => {
  try {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      const consulta = await obterUmDado('SELECT * FROM consultas WHERE id = ?', [req.params.id]);
      const pacientes = await obterDados('SELECT id, nome FROM pacientes ORDER BY nome');
      const profissionais = await obterDados('SELECT id, nome, especialidade FROM profissionais ORDER BY nome');
      return res.render('consultas/formulario', { consulta, pacientes, profissionais, erros: erros.array() });
    }

    const { pacienteId, profissionalId, dataHora } = req.body;

    const dataConsulta = new Date(dataHora);
    if (dataConsulta <= new Date()) {
      const consulta = await obterUmDado('SELECT * FROM consultas WHERE id = ?', [req.params.id]);
      const pacientes = await obterDados('SELECT id, nome FROM pacientes ORDER BY nome');
      const profissionais = await obterDados('SELECT id, nome, especialidade FROM profissionais ORDER BY nome');
      return res.render('consultas/formulario', { 
        consulta, 
        pacientes, 
        profissionais,
        erros: [{ msg: 'A data e hora da consulta deve ser no futuro' }] 
      });
    }

    const sobreposicao = await obterUmDado(`
      SELECT id FROM consultas 
      WHERE profissionalId = ? 
      AND id != ?
      AND status = 'agendada'
      AND datetime(dataHora) BETWEEN datetime(?, '-1 hour') AND datetime(?, '+1 hour')
    `, [profissionalId, req.params.id, dataHora, dataHora]);

    if (sobreposicao) {
      const consulta = await obterUmDado('SELECT * FROM consultas WHERE id = ?', [req.params.id]);
      const pacientes = await obterDados('SELECT id, nome FROM pacientes ORDER BY nome');
      const profissionais = await obterDados('SELECT id, nome, especialidade FROM profissionais ORDER BY nome');
      return res.render('consultas/formulario', { 
        consulta, 
        pacientes, 
        profissionais,
        erros: [{ msg: 'Profissional já possui consulta agendada neste horário' }] 
      });
    }

    await executarQuery(
      'UPDATE consultas SET pacienteId = ?, profissionalId = ?, dataHora = ?, dataAtualizacao = CURRENT_TIMESTAMP WHERE id = ?',
      [pacienteId, profissionalId, dataHora, req.params.id]
    );

    res.redirect('/consultas?mensagem=Consulta atualizada com sucesso');
  } catch (erro) {
    console.error('Erro ao atualizar consulta:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao atualizar consulta' });
  }
});

app.post('/consultas/:id/cancelar', async (req, res) => {
  try {
    const consulta = await obterUmDado('SELECT * FROM consultas WHERE id = ?', [req.params.id]);
    
    if (!consulta) {
      return res.status(404).render('erro', { mensagem: 'Consulta não encontrada' });
    }

    if (consulta.status !== 'agendada') {
      return res.status(400).render('erro', { 
        mensagem: 'Apenas consultas agendadas podem ser canceladas' 
      });
    }

    const dataConsulta = new Date(consulta.dataHora);
    const agora = new Date();
    const diferenca = (dataConsulta - agora) / (1000 * 60 * 60);

    if (diferenca < 2) {
      return res.status(400).render('erro', { 
        mensagem: 'Cancelamento deve ser feito com no mínimo 2 horas de antecedência' 
      });
    }

    const { motivo } = req.body;
    await executarQuery(
      'UPDATE consultas SET status = ?, motivoCancelamento = ?, dataAtualizacao = CURRENT_TIMESTAMP WHERE id = ?',
      ['cancelada', motivo || '', req.params.id]
    );

    res.redirect('/consultas?mensagem=Consulta cancelada com sucesso');
  } catch (erro) {
    console.error('Erro ao cancelar consulta:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao cancelar consulta' });
  }
});

app.post('/consultas/:id/concluir', async (req, res) => {
  try {
    const consulta = await obterUmDado('SELECT * FROM consultas WHERE id = ?', [req.params.id]);
    
    if (!consulta) {
      return res.status(404).render('erro', { mensagem: 'Consulta não encontrada' });
    }

    if (consulta.status !== 'agendada') {
      return res.status(400).render('erro', { 
        mensagem: 'Apenas consultas agendadas podem ser concluídas' 
      });
    }

    await executarQuery(
      'UPDATE consultas SET status = ?, dataAtualizacao = CURRENT_TIMESTAMP WHERE id = ?',
      ['concluída', req.params.id]
    );

    res.redirect('/consultas?mensagem=Consulta concluída com sucesso');
  } catch (erro) {
    console.error('Erro ao concluir consulta:', erro);
    res.status(500).render('erro', { mensagem: 'Erro ao concluir consulta' });
  }
});

//ROTA INICIAL 
app.get('/', (req, res) => {
  res.render('index');
});


app.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});
