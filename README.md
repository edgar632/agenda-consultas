# Clínica Escolar - Sistema de Agenda de Consultas

Um sistema para gerenciar consultas em clínicas escolares, desenvolvido com Express.js, SQLite e EJS.

## Visão Geral

Atende às necessidades de uma clínica escolar no gerenciamento de:

- **Pacientes**: Cadastro, edição, exclusão e busca de pacientes
- **Profissionais**: Gerenciamento de profissionais e suas especialidades
- **Consultas**: Agendamento, reagendamento, cancelamento e conclusão de consultas

## Características Principais

### Funcionalidades

- **CRUD** para Pacientes, Profissionais e Consultas
- **Validações** em todos os formulários (backend e frontend)
- **Prevenção de Sobreposição** de horários para profissionais
- **Cancelamento com Antecedência** (mínimo 2 horas)
- **Busca e Filtros** em todas as listagens
- **Mensagens Padronizadas** de sucesso e erro

### Validações Implementadas

#### Pacientes
- Nome obrigatório
- Email com validação de formato
- Email único
- Telefone obrigatório
- Proteção contra exclusão com consultas ativas

#### Profissionais
- Nome obrigatório
- Especialidade obrigatória
- Proteção contra exclusão com consultas ativas

#### Consultas
- Paciente obrigatório
- Profissional obrigatório
- Data e hora obrigatórias
- Data deve ser no futuro
- Prevenção automática de sobreposição de horários
- Cancelamento requer 2 horas de antecedência
- Status válido (agendada, cancelada, concluída)

## Como instalar e iniciar

### Pré-requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn

### Instalação

1. Navegue até o diretório do projeto:
```bash
cd clinica_escolar_agenda
```

2. Instale as dependências:
```bash
npm install
```

3. Iniciar o servidor:
```bash
npm run iniciar
```

O servidor estará disponível em `http://localhost:3000`


## Estrutura do Projeto

```
clinica_escolar_agenda/
├── servidor.js              # Arquivo principal do servidor
├── package.json             # Dependências do projeto
├── clinica.db              # Banco de dados SQLite
├── README.md               
├── public/
│   └── style.css          # Estilização CSS
└── visoes/
    ├── index.ejs           # Página inicial
    ├── erro.ejs            # Página de erro
    ├── layout.ejs          # Layout base
    ├── pacientes/
    │   ├── lista.ejs       # Listagem de pacientes
    │   └── formulario.ejs  # Formulário de pacientes
    ├── profissionais/
    │   ├── lista.ejs       # Listagem de profissionais
    │   └── formulario.ejs  # Formulário de profissionais
    └── consultas/
        ├── lista.ejs       # Listagem de consultas
        └── formulario.ejs  # Formulário de consultas
```

## Rotas

### Pacientes
- `GET /pacientes` - Listar pacientes
- `GET /pacientes/novo` - Formulário para novo paciente
- `POST /pacientes` - Criar novo paciente
- `GET /pacientes/:id/editar` - Formulário para editar paciente
- `POST /pacientes/:id` - Atualizar paciente
- `POST /pacientes/:id/deletar` - Deletar paciente

### Profissionais
- `GET /profissionais` - Listar profissionais
- `GET /profissionais/novo` - Formulário para novo profissional
- `POST /profissionais` - Criar novo profissional
- `GET /profissionais/:id/editar` - Formulário para editar profissional
- `POST /profissionais/:id` - Atualizar profissional
- `POST /profissionais/:id/deletar` - Deletar profissional

### Consultas
- `GET /consultas` - Listar consultas
- `GET /consultas/novo` - Formulário para agendar consulta
- `POST /consultas` - Agendar consulta
- `GET /consultas/:id/editar` - Formulário para reagendar consulta
- `POST /consultas/:id` - Atualizar consulta
- `POST /consultas/:id/cancelar` - Cancelar consulta
- `POST /consultas/:id/concluir` - Concluir consulta

## Banco de Dados

O sistema utiliza SQLite com as tabelas:

### Tabela: pacientes
```sql
CREATE TABLE pacientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT NOT NULL,
  dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Tabela: profissionais
```sql
CREATE TABLE profissionais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Tabela: consultas
```sql
CREATE TABLE consultas (
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
)
```

## Segurança

- Validações no backend 
- Proteção contra SQL Injection com prepared statements
- Validação de formato de email
- Validação de dados obrigatórios
- Mensagens de erro padronizadas

## Tecnologias Utilizadas

### Backend
- **Express.js** - Framework web
- **SQLite** - Banco de dados
- **express-validator** - Validação de dados
- **body-parser** - Parser de requisições

### Frontend
- **EJS** - Template engine
- **CSS** - Estilização
- **HTML** - Estrutura
- **JavaScript Vanilla** - Interatividade

## Exemplo de Uso

### Criar um Paciente

1. Acesse `http://localhost:3000/pacientes`
2. Clique em "+ Novo Paciente"
3. Preencha os campos:
   - Nome: João Silva
   - Email: joao@email.com
   - Telefone: (00) 12345-6789
4. Clique em "Cadastrar Paciente"

### Agendar uma Consulta

1. Acesse `http://localhost:3000/consultas`
2. Clique em "+ Nova Consulta"
3. Selecione um paciente
4. Selecione um profissional
5. Escolha data e hora
6. Clique em "Agendar Consulta"
